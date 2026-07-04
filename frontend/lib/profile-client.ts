import { apiGet, apiPut } from "./api";
import { getAuthToken } from "./auth-client";

export type StudyPlanParseMetadata = {
  extractedTextLength: number;
  fileName: string | null;
  fileType?: "pdf" | "docx" | "txt" | "image";
  ocrPageCount?: number;
  ocrProvider?: "openai";
  ocrUsed?: boolean;
  originalTextLength?: number;
  pageCount?: number;
  parseStatus: "success" | "warning" | "failed";
  truncated?: boolean;
  warnings: string[];
};

export type UserProfileDto = {
  additionalNotes: string | null;
  age: number | null;
  awards: string | null;
  careerPlan: string | null;
  createdAt: string;
  degreeLevel: "BACHELOR" | "MASTER";
  extracurricularActivities: string | null;
  gpa: string | null;
  hskLevel: string | null;
  hskkLevel: string | null;
  id: string;
  ieltsScore: string | null;
  majorId: string | null;
  otherLanguages: string | null;
  researchExperience: string | null;
  schoolId: string | null;
  scholarshipId: string | null;
  scholarshipType: string;
  strengths: string | null;
  studyPlan: string;
  studyPlanFileName: string | null;
  studyPlanFileContent: string | null;
  studyPlanFileUrl: string | null;
  studyPlanParseMetadata?: StudyPlanParseMetadata | null;
  targetMajor: string;
  targetSchool: string;
  toeflScore: string | null;
  updatedAt: string;
  userId: string;
  weaknesses: string | null;
  workExperience: string | null;
};

export type ProfileInput = {
  additionalNotes?: string | null;
  age?: number | null;
  awards?: string | null;
  careerPlan?: string | null;
  degreeLevel: "BACHELOR" | "MASTER";
  extracurricularActivities?: string | null;
  gpa?: string | null;
  hskLevel?: string | null;
  hskkLevel?: string | null;
  ieltsScore?: string | null;
  majorId?: string | null;
  otherLanguages?: string | null;
  researchExperience?: string | null;
  schoolId?: string | null;
  scholarshipId?: string | null;
  scholarshipType: string;
  strengths?: string | null;
  studyPlan?: string | null;
  studyPlanFileName?: string | null;
  studyPlanFileContent?: string | null;
  targetMajor: string;
  targetSchool: string;
  toeflScore?: string | null;
  weaknesses?: string | null;
  workExperience?: string | null;
};

type ProfileResponse = {
  profile: UserProfileDto | null;
};

type UpdateProfileResponse = {
  message: string;
  profile: UserProfileDto;
  studyPlanParseMetadata?: StudyPlanParseMetadata | null;
};

function getRequiredToken() {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Bạn cần đăng nhập để cập nhật profile");
  }

  return token;
}

export async function fetchMyProfile() {
  return apiGet<ProfileResponse>("/api/profiles/me", {
    token: getRequiredToken()
  });
}

export async function updateMyProfile(input: ProfileInput) {
  return apiPut<UpdateProfileResponse>("/api/profiles/me", input, {
    token: getRequiredToken()
  });
}
