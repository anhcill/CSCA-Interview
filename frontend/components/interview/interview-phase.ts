export type InterviewPhaseKey =
  | "INTRODUCTION"
  | "ACADEMIC"
  | "SCHOOL_MAJOR"
  | "MAJOR_EXPERTISE"
  | "STUDY_PLAN"
  | "SCHOLARSHIP_CAREER"
  | "SITUATION";

export type InterviewPhasePresentation = {
  key: InterviewPhaseKey;
  label: string;
  targetMinutes: number;
};

const phaseByCategory: Record<string, InterviewPhasePresentation> = {
  ACADEMIC: { key: "ACADEMIC", label: "Thành tích học tập", targetMinutes: 3 },
  CAREER_PLAN: { key: "SCHOLARSHIP_CAREER", label: "Học bổng và nghề nghiệp", targetMinutes: 4 },
  PERSONAL: { key: "INTRODUCTION", label: "Giới thiệu bản thân", targetMinutes: 5 },
  RESEARCH: { key: "MAJOR_EXPERTISE", label: "Kiến thức chuyên ngành", targetMinutes: 6 },
  SCHOLARSHIP: { key: "SCHOLARSHIP_CAREER", label: "Học bổng và nghề nghiệp", targetMinutes: 4 },
  SCHOOL_MAJOR: { key: "SCHOOL_MAJOR", label: "Trường và ngành học", targetMinutes: 4 },
  SITUATION: { key: "SITUATION", label: "Phản biện và tình huống", targetMinutes: 3 },
  STUDY_PLAN: { key: "STUDY_PLAN", label: "Kế hoạch học tập/nghiên cứu", targetMinutes: 5 }
};

export function getInterviewPhasePresentation(category: string): InterviewPhasePresentation {
  return phaseByCategory[category]
    ?? { key: "STUDY_PLAN", label: "Kế hoạch học tập/nghiên cứu", targetMinutes: 5 };
}
