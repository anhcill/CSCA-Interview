import { apiGet } from "./api";

export type SchoolDto = {
  achievements?: string | null;
  admissionRequirements?: string | null;
  campusInfo?: string | null;
  city: string | null;
  description?: string | null;
  id: string;
  interviewTips?: string | null;
  isActive: boolean;
  name: string;
  nameEn: string | null;
  nameZh: string | null;
  notableAlumni?: string | null;
  province: string | null;
  programLanguage?: string | null;
  ranking?: number | null;
  rankingType?: string | null;
  researchAreas?: string | null;
  strongMajors?: string | null;
  websiteUrl?: string | null;
};

export type SchoolListResponse = {
  data: SchoolDto[];
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export function fetchSchools(input: {
  active?: "all";
  limit?: number;
  search?: string;
  token?: string | null;
} = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(input.limit ?? 12));
  if (input.search?.trim()) params.set("search", input.search.trim());
  if (input.active) params.set("active", input.active);

  return apiGet<SchoolListResponse>(`/api/schools?${params.toString()}`, {
    cacheMs: 60_000,
    token: input.token
  });
}
