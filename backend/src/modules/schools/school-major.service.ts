import { DegreeLevel, type Prisma } from "@prisma/client";
import { normalizeSearchText } from "../../utils/search-normalize.js";

export type MajorReference =
  | { id: string }
  | {
      degreeLevel: DegreeLevel;
      name: string;
      nameEn?: string | null;
      nameZh?: string | null;
    };

type CatalogMajor = {
  degreeLevel: DegreeLevel;
  id: string;
  isActive: boolean;
  name: string;
  nameEn: string | null;
  nameZh: string | null;
};

export class MajorReferenceNotFoundError extends Error {
  constructor() {
    super("MAJOR_NOT_FOUND");
  }
}

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

export async function resolveMajorReferences(
  tx: Prisma.TransactionClient,
  references: MajorReference[]
) {
  if (!references.length) {
    return { createdMajors: 0, majors: [] as Array<Pick<CatalogMajor, "degreeLevel" | "id" | "name">> };
  }

  const referencedIds = references
    .filter((reference): reference is { id: string } => "id" in reference)
    .map((reference) => reference.id);
  const degreeLevels = [...new Set(
    references
      .filter((reference): reference is Exclude<MajorReference, { id: string }> => !("id" in reference))
      .map((reference) => reference.degreeLevel)
  )];
  const catalog = await tx.major.findMany({
    where: {
      OR: [
        ...(referencedIds.length ? [{ id: { in: referencedIds } }] : []),
        ...(degreeLevels.length ? [{ degreeLevel: { in: degreeLevels } }] : [])
      ]
    },
    orderBy: [
      { isActive: "desc" },
      { createdAt: "asc" }
    ],
    select: {
      degreeLevel: true,
      id: true,
      isActive: true,
      name: true,
      nameEn: true,
      nameZh: true
    }
  });
  const byId = new Map(catalog.map((major) => [major.id, major]));
  const byIdentity = new Map<string, CatalogMajor>();
  for (const major of catalog) {
    for (const key of identityKeys(major)) {
      if (!byIdentity.has(key)) byIdentity.set(key, major);
    }
  }

  let createdMajors = 0;
  const resolved = new Map<string, Pick<CatalogMajor, "degreeLevel" | "id" | "name">>();
  for (const reference of references) {
    if ("id" in reference) {
      const existing = byId.get(reference.id);
      if (!existing) throw new MajorReferenceNotFoundError();
      const major = existing.isActive
        ? existing
        : await tx.major.update({
            where: { id: existing.id },
            data: { isActive: true },
            select: {
              degreeLevel: true,
              id: true,
              isActive: true,
              name: true,
              nameEn: true,
              nameZh: true
            }
          });
      resolved.set(major.id, major);
      continue;
    }

    const candidateKeys = identityKeys(reference);
    const existing = candidateKeys
      .map((key) => byIdentity.get(key))
      .find((major): major is CatalogMajor => Boolean(major));
    if (existing) {
      const major = await tx.major.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          ...(!existing.nameEn && reference.nameEn?.trim() ? { nameEn: reference.nameEn.trim() } : {}),
          ...(!existing.nameZh && reference.nameZh?.trim() ? { nameZh: reference.nameZh.trim() } : {})
        },
        select: {
          degreeLevel: true,
          id: true,
          isActive: true,
          name: true,
          nameEn: true,
          nameZh: true
        }
      });
      byId.set(major.id, major);
      for (const key of identityKeys(major)) byIdentity.set(key, major);
      resolved.set(major.id, major);
      continue;
    }

    const major = await tx.major.upsert({
      where: {
        name_degreeLevel: {
          degreeLevel: reference.degreeLevel,
          name: reference.name
        }
      },
      create: {
        degreeLevel: reference.degreeLevel,
        isActive: true,
        name: reference.name,
        nameEn: reference.nameEn?.trim() || null,
        nameZh: reference.nameZh?.trim() || null
      },
      update: {
        isActive: true,
        nameEn: reference.nameEn?.trim() || undefined,
        nameZh: reference.nameZh?.trim() || undefined
      },
      select: {
        degreeLevel: true,
        id: true,
        isActive: true,
        name: true,
        nameEn: true,
        nameZh: true
      }
    });
    createdMajors += 1;
    byId.set(major.id, major);
    for (const key of identityKeys(major)) byIdentity.set(key, major);
    resolved.set(major.id, major);
  }

  return {
    createdMajors,
    majors: [...resolved.values()]
  };
}
