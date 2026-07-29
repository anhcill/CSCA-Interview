import { DegreeLevel } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "../../db/prisma.js";
import {
  InvalidApplicationTargetError,
  resolveApplicationTargets
} from "./application-targets.service.js";

const baseInput = {
  degreeLevel: DegreeLevel.BACHELOR,
  majorId: "11111111-1111-4111-8111-111111111111",
  scholarshipId: "22222222-2222-4222-8222-222222222222",
  scholarshipType: "Tên học bổng nhập tay",
  schoolId: "33333333-3333-4333-8333-333333333333",
  targetMajor: "Tên ngành nhập tay",
  targetSchool: "Tên trường nhập tay"
};

describe("resolveApplicationTargets", () => {
  it("uses canonical names from selected IDs", async () => {
    vi.mocked(prisma.major.findFirst).mockResolvedValue({
      degreeLevel: DegreeLevel.BACHELOR,
      id: baseInput.majorId,
      name: "Thương mại điện tử"
    } as any);
    vi.mocked(prisma.school.findFirst).mockResolvedValue({
      id: baseInput.schoolId,
      name: "Đại học Mục tiêu"
    } as any);
    vi.mocked(prisma.scholarship.findFirst).mockResolvedValue({
      id: baseInput.scholarshipId,
      name: "CSC"
    } as any);
    vi.mocked(prisma.school_majors.findFirst).mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444"
    } as any);

    await expect(resolveApplicationTargets(baseInput)).resolves.toEqual({
      majorId: baseInput.majorId,
      scholarshipId: baseInput.scholarshipId,
      scholarshipType: "CSC",
      schoolId: baseInput.schoolId,
      targetMajor: "Thương mại điện tử",
      targetSchool: "Đại học Mục tiêu"
    });
  });

  it("rejects a major from another degree level", async () => {
    vi.mocked(prisma.major.findFirst).mockResolvedValue({
      degreeLevel: DegreeLevel.MASTER,
      id: baseInput.majorId,
      name: "Thương mại điện tử"
    } as any);
    vi.mocked(prisma.school.findFirst).mockResolvedValue({
      id: baseInput.schoolId,
      name: "Đại học Mục tiêu"
    } as any);
    vi.mocked(prisma.scholarship.findFirst).mockResolvedValue({
      id: baseInput.scholarshipId,
      name: "CSC"
    } as any);
    vi.mocked(prisma.school_majors.findFirst).mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444"
    } as any);

    await expect(resolveApplicationTargets(baseInput)).rejects.toEqual(
      new InvalidApplicationTargetError("Ngành đã chọn không thuộc hệ đào tạo đang apply.")
    );
  });

  it("rejects a major that is not offered by the selected school", async () => {
    vi.mocked(prisma.major.findFirst).mockResolvedValue({
      degreeLevel: DegreeLevel.BACHELOR,
      id: baseInput.majorId,
      name: "Thương mại điện tử"
    } as any);
    vi.mocked(prisma.school.findFirst).mockResolvedValue({
      id: baseInput.schoolId,
      name: "Đại học Mục tiêu"
    } as any);
    vi.mocked(prisma.scholarship.findFirst).mockResolvedValue({
      id: baseInput.scholarshipId,
      name: "CSC"
    } as any);
    vi.mocked(prisma.school_majors.findFirst).mockResolvedValue(null);

    await expect(resolveApplicationTargets(baseInput)).rejects.toEqual(
      new InvalidApplicationTargetError("Ngành đã chọn không thuộc trường này. Vui lòng chọn lại đúng ngành do trường đào tạo.")
    );
  });

  it("keeps trimmed free-text targets when no IDs are selected", async () => {
    await expect(
      resolveApplicationTargets({
        ...baseInput,
        majorId: null,
        scholarshipId: null,
        schoolId: null,
        scholarshipType: "  CSC khác  ",
        targetMajor: "  Ngành tùy chỉnh  ",
        targetSchool: "  Trường tùy chỉnh  "
      })
    ).resolves.toEqual({
      majorId: null,
      scholarshipId: null,
      scholarshipType: "CSC khác",
      schoolId: null,
      targetMajor: "Ngành tùy chỉnh",
      targetSchool: "Trường tùy chỉnh"
    });
  });
});
