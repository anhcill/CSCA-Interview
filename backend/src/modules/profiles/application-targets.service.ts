import { DegreeLevel } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export class InvalidApplicationTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidApplicationTargetError";
  }
}

type ResolveApplicationTargetsInput = {
  degreeLevel: DegreeLevel;
  majorId?: string | null;
  scholarshipId?: string | null;
  scholarshipType: string;
  schoolId?: string | null;
  targetMajor: string;
  targetSchool: string;
};

export async function resolveApplicationTargets(input: ResolveApplicationTargetsInput) {
  const [major, school, scholarship] = await Promise.all([
    input.majorId
      ? prisma.major.findFirst({
          where: { id: input.majorId, isActive: true },
          select: { degreeLevel: true, id: true, name: true }
        })
      : null,
    input.schoolId
      ? prisma.school.findFirst({
          where: { id: input.schoolId, isActive: true },
          select: { id: true, name: true }
        })
      : null,
    input.scholarshipId
      ? prisma.scholarship.findFirst({
          where: { id: input.scholarshipId, isActive: true },
          select: { id: true, name: true }
        })
      : null
  ]);

  if (input.majorId && !major) {
    throw new InvalidApplicationTargetError("Ngành đã chọn không tồn tại hoặc đã ngừng sử dụng.");
  }
  if (major && major.degreeLevel !== input.degreeLevel) {
    throw new InvalidApplicationTargetError("Ngành đã chọn không thuộc hệ đào tạo đang apply.");
  }
  if (input.schoolId && !school) {
    throw new InvalidApplicationTargetError("Trường đã chọn không tồn tại hoặc đã ngừng sử dụng.");
  }
  if (input.scholarshipId && !scholarship) {
    throw new InvalidApplicationTargetError("Học bổng đã chọn không tồn tại hoặc đã ngừng sử dụng.");
  }

  return {
    majorId: major?.id ?? null,
    scholarshipId: scholarship?.id ?? null,
    scholarshipType: scholarship?.name ?? input.scholarshipType.trim(),
    schoolId: school?.id ?? null,
    targetMajor: major?.name ?? input.targetMajor.trim(),
    targetSchool: school?.name ?? input.targetSchool.trim()
  };
}
