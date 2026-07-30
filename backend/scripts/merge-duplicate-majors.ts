import { Prisma, PrismaClient, type DegreeLevel } from "@prisma/client";
import { normalizeSearchText } from "../src/utils/search-normalize.js";

const prisma = new PrismaClient();
const applyChanges = process.argv.includes("--apply");

const metadataFields = [
  "nameZh",
  "nameEn",
  "description",
  "requirements",
  "researchAreas",
  "researchLabs",
  "careerOutcomes",
  "interviewFocus"
] as const;

type MajorRow = Awaited<ReturnType<typeof loadMajors>>[number];
type DuplicateGroup = {
  canonical: MajorRow;
  duplicates: MajorRow[];
  key: string;
};

function identityKeys(major: {
  degreeLevel: DegreeLevel;
  name: string;
  nameEn?: string | null;
  nameZh?: string | null;
}) {
  return [major.name, major.nameEn, major.nameZh]
    .map((name) => normalizeSearchText(name ?? ""))
    .filter(Boolean)
    .map((name) => `${major.degreeLevel}:${name}`);
}

function referenceCount(major: MajorRow) {
  return Object.values(major._count).reduce((total, count) => total + count, 0);
}

function metadataCount(major: MajorRow) {
  return metadataFields.filter((field) => Boolean(major[field]?.trim())).length;
}

function chooseCanonical(majors: MajorRow[]) {
  return [...majors].sort((left, right) => (
    Number(right.isActive) - Number(left.isActive)
    || referenceCount(right) - referenceCount(left)
    || metadataCount(right) - metadataCount(left)
    || left.createdAt.getTime() - right.createdAt.getTime()
    || left.id.localeCompare(right.id)
  ))[0]!;
}

async function loadMajors() {
  return prisma.major.findMany({
    orderBy: [{ degreeLevel: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          interviewSessions: true,
          questionAssignments: true,
          questions: true,
          school_majors: true,
          userProfiles: true
        }
      }
    }
  });
}

function findDuplicateGroups(majors: MajorRow[]): DuplicateGroup[] {
  const parents = majors.map((_, index) => index);
  const find = (index: number): number => {
    if (parents[index] !== index) parents[index] = find(parents[index]!);
    return parents[index]!;
  };
  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };
  const firstByIdentity = new Map<string, number>();
  majors.forEach((major, index) => {
    for (const key of identityKeys(major)) {
      const existingIndex = firstByIdentity.get(key);
      if (existingIndex === undefined) firstByIdentity.set(key, index);
      else union(existingIndex, index);
    }
  });

  const grouped = new Map<number, MajorRow[]>();
  majors.forEach((major, index) => {
    const root = find(index);
    const group = grouped.get(root) ?? [];
    group.push(major);
    grouped.set(root, group);
  });

  const duplicateGroups = [...grouped.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const canonical = chooseCanonical(group);
      const sharedIdentities = identityKeys(canonical).filter((key) => (
        group.some((major) => major.id !== canonical.id && identityKeys(major).includes(key))
      ));
      return {
        canonical,
        duplicates: group.filter((major) => major.id !== canonical.id),
        key: sharedIdentities[0] ?? identityKeys(canonical)[0]!
      };
    });

  for (const group of duplicateGroups) {
    if (!group.key) {
      throw new Error(`Không xác định được khóa trùng cho nhóm ngành ${group.canonical.id}`);
    }
  }

  return duplicateGroups.sort((left, right) => left.key.localeCompare(right.key));
}

function buildMetadataUpdate(group: DuplicateGroup): Prisma.MajorUpdateInput {
  const data: Prisma.MajorUpdateInput = {
    isActive: group.canonical.isActive || group.duplicates.some((major) => major.isActive)
  };
  for (const field of metadataFields) {
    if (group.canonical[field]?.trim()) continue;
    const replacement = group.duplicates
      .map((major) => major[field]?.trim())
      .find((value): value is string => Boolean(value));
    if (replacement) data[field] = replacement;
  }
  return data;
}

async function mergeSchoolMajorLinks(
  tx: Prisma.TransactionClient,
  canonicalId: string,
  allIds: string[]
) {
  const links = await tx.school_majors.findMany({
    where: { major_id: { in: allIds } },
    orderBy: { created_at: "asc" }
  });
  const buckets = new Map<string, typeof links>();
  for (const link of links) {
    const key = `${link.school_id}:${link.admission_season_id ?? "all"}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(link);
    buckets.set(key, bucket);
  }

  let deleted = 0;
  let updated = 0;
  for (const bucket of buckets.values()) {
    const keeper = bucket.find((link) => link.major_id === canonicalId) ?? bucket[0]!;
    const redundantIds = bucket.filter((link) => link.id !== keeper.id).map((link) => link.id);
    if (redundantIds.length) {
      const result = await tx.school_majors.deleteMany({ where: { id: { in: redundantIds } } });
      deleted += result.count;
    }
    if (keeper.major_id !== canonicalId) {
      await tx.school_majors.update({
        where: { id: keeper.id },
        data: { major_id: canonicalId }
      });
      updated += 1;
    }
  }
  return { deleted, updated };
}

async function mergeQuestionAssignments(
  tx: Prisma.TransactionClient,
  canonicalId: string,
  allIds: string[]
) {
  const assignments = await tx.questionAssignment.findMany({
    where: { majorId: { in: allIds } },
    orderBy: { createdAt: "asc" }
  });
  const buckets = new Map<string, typeof assignments>();
  for (const assignment of assignments) {
    const key = `${assignment.questionId}:${assignment.schoolId}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(assignment);
    buckets.set(key, bucket);
  }

  let deleted = 0;
  let updated = 0;
  for (const bucket of buckets.values()) {
    const keeper = bucket.find((assignment) => assignment.majorId === canonicalId) ?? bucket[0]!;
    const redundantIds = bucket
      .filter((assignment) => assignment.id !== keeper.id)
      .map((assignment) => assignment.id);
    if (redundantIds.length) {
      const result = await tx.questionAssignment.deleteMany({ where: { id: { in: redundantIds } } });
      deleted += result.count;
    }
    if (keeper.majorId !== canonicalId) {
      await tx.questionAssignment.update({
        where: { id: keeper.id },
        data: { majorId: canonicalId }
      });
      updated += 1;
    }
  }
  return { deleted, updated };
}

async function mergeGroup(group: DuplicateGroup) {
  const duplicateIds = group.duplicates.map((major) => major.id);
  const allIds = [group.canonical.id, ...duplicateIds];
  return prisma.$transaction(async (tx) => {
    const schoolLinks = await mergeSchoolMajorLinks(tx, group.canonical.id, allIds);
    const assignments = await mergeQuestionAssignments(tx, group.canonical.id, allIds);
    const [questions, profiles, sessions] = await Promise.all([
      tx.question.updateMany({
        where: { majorId: { in: duplicateIds } },
        data: { majorId: group.canonical.id }
      }),
      tx.userProfile.updateMany({
        where: { majorId: { in: duplicateIds } },
        data: { majorId: group.canonical.id }
      }),
      tx.interviewSession.updateMany({
        where: { majorId: { in: duplicateIds } },
        data: { majorId: group.canonical.id }
      })
    ]);
    await tx.major.update({
      where: { id: group.canonical.id },
      data: buildMetadataUpdate(group)
    });
    const removedMajors = await tx.major.deleteMany({
      where: { id: { in: duplicateIds } }
    });

    const result = {
      assignments,
      canonicalId: group.canonical.id,
      profiles: profiles.count,
      questions: questions.count,
      removedMajors: removedMajors.count,
      schoolLinks,
      sessions: sessions.count
    };
    await tx.admin_audit_logs.create({
      data: {
        action: "MAJOR_DUPLICATES_MERGED",
        after_data: result,
        before_data: {
          canonical: {
            id: group.canonical.id,
            name: group.canonical.name
          },
          duplicates: group.duplicates.map((major) => ({
            id: major.id,
            name: major.name
          })),
          normalizedKey: group.key
        },
        entity_id: group.canonical.id,
        entity_type: "major"
      }
    });
    return result;
  }, {
    maxWait: 10_000,
    timeout: 60_000
  });
}

async function main() {
  const majors = await loadMajors();
  const groups = findDuplicateGroups(majors);
  console.log(JSON.stringify({
    applyChanges,
    duplicateGroups: groups.length,
    duplicateMajors: groups.reduce((total, group) => total + group.duplicates.length, 0),
    groups: groups.map((group) => ({
      canonical: {
        active: group.canonical.isActive,
        id: group.canonical.id,
        name: group.canonical.name,
        nameEn: group.canonical.nameEn,
        nameZh: group.canonical.nameZh,
        references: referenceCount(group.canonical)
      },
      degreeLevel: group.canonical.degreeLevel,
      duplicates: group.duplicates.map((major) => ({
        active: major.isActive,
        id: major.id,
        name: major.name,
        nameEn: major.nameEn,
        nameZh: major.nameZh,
        references: referenceCount(major)
      }))
    }))
  }, null, 2));

  if (!applyChanges || !groups.length) return;
  const results = [];
  for (const group of groups) {
    results.push(await mergeGroup(group));
  }
  console.log(JSON.stringify({
    mergedGroups: results.length,
    results
  }, null, 2));

  const remainingGroups = findDuplicateGroups(await loadMajors());
  if (remainingGroups.length) {
    throw new Error(`Vẫn còn ${remainingGroups.length} nhóm ngành trùng sau khi gộp`);
  }
  console.log("MERGE_DUPLICATE_MAJORS_OK");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
