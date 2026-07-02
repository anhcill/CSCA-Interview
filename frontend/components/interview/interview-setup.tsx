"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ProgressTracker } from "@/components/interview/progress-tracker";
import {
  ConfirmWizardStep,
  ModeWizardStep,
  ProfileWizardStep,
  TargetWizardStep,
  StudyPlanWizardStep,
  StudyPlanAnalysisWizardStep,
  type WizardSetupForm
} from "@/components/interview/wizard-steps";
import {
  activeInterviewSessionStorageKey,
  createInterviewSession
} from "@/lib/interview-client";
import {
  getStoredInterviewLanguageMode,
  getStoredLocale,
  interviewModeToBackendLanguage,
  localeChangedEvent,
  localeToBackendLanguage,
  messages,
  setStoredInterviewLanguageMode,
  type Locale
} from "@/lib/i18n";
import { apiPost } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";
import { fetchMyProfile, updateMyProfile, type UserProfileDto } from "@/lib/profile-client";

const durationOptions = [30, 60, 90] as const;
const stepLabels = ["Profile", "Mục tiêu", "Chế độ", "Study Plan", "Phân tích AI", "Bắt đầu"];

const initialForm: WizardSetupForm = {
  applicantNameZh: "",
  gpa: "",
  hskLevel: "",
  ieltsScore: "",
  language: "ZH",
  majorId: "",
  mode: "PRACTICE",
  otherLanguages: "",
  plannedDurationMinutes: 30,
  schoolId: "",
  scholarshipId: "",
  scholarshipType: "",
  studyPlan: "",
  targetMajor: "",
  targetSchool: ""
};

export function InterviewSetup() {
  const router = useRouter();
  const [form, setForm] = useState<WizardSetupForm>(initialForm);
  const [currentStep, setCurrentStep] = useState(0);
  const [studyPlanAnalysis, setStudyPlanAnalysis] = useState<any | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [locale, setLocale] = useState<Locale>("vi");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [profileNotice, setProfileNotice] = useState("");
  const t = messages[locale].setup;
  const selectedTargetSchool = form.targetSchool.trim() || profile?.targetSchool || "";
  const selectedSchoolId = form.targetSchool.trim()
    ? form.schoolId || (form.targetSchool.trim() === profile?.targetSchool ? profile.schoolId : null)
    : profile?.schoolId ?? null;

  const readyItems = useMemo(() => {
    return [
      { done: Boolean(selectedTargetSchool), label: t.school },
      { done: Boolean(form.targetMajor.trim()), label: t.major },
      { done: Boolean(form.scholarshipType.trim()), label: t.scholarship },
      { done: Boolean(form.studyPlan.trim().length >= 20), label: t.studyPlan }
    ];
  }, [form.scholarshipType, form.studyPlan, form.targetMajor, selectedTargetSchool, t.major, t.scholarship, t.school, t.studyPlan]);

  const readyCount = readyItems.filter((item) => item.done).length;
  const isProfileReady = readyCount === readyItems.length;
  const degreeLabel = profile?.degreeLevel === "MASTER" ? t.master : t.bachelor;
  const scholarshipLabel = profile?.scholarshipType || t.empty;

  useEffect(() => {
    const initialLocale = getStoredLocale();
    setLocale(initialLocale);
    const storedMode = getStoredInterviewLanguageMode();
    setForm((current) => ({
      ...current,
      language: storedMode || localeToBackendLanguage(initialLocale)
    }));

    function handleLocaleChanged(event: Event) {
      const nextLocale = (event as CustomEvent<{ locale: Locale }>).detail?.locale;
      if (nextLocale) setLocale(nextLocale);
    }

    window.addEventListener(localeChangedEvent, handleLocaleChanged);
    return () => window.removeEventListener(localeChangedEvent, handleLocaleChanged);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function hydrateFromProfile() {
      setIsLoadingProfile(true);
      try {
        const data = await fetchMyProfile();

        if (ignore) return;

        setProfile(data.profile);
        if (data.profile) {
          const loadedProfile = data.profile;
          setForm((current) => ({
            ...current,
            gpa: current.gpa || loadedProfile.gpa || "",
            hskLevel: current.hskLevel || loadedProfile.hskLevel || "",
            ieltsScore: current.ieltsScore || loadedProfile.ieltsScore || "",
            majorId: current.majorId || loadedProfile.majorId || "",
            otherLanguages: current.otherLanguages || buildLanguageSummary(loadedProfile),
            schoolId: current.schoolId || loadedProfile.schoolId || "",
            scholarshipId: current.scholarshipId || loadedProfile.scholarshipId || "",
            scholarshipType: current.scholarshipType || loadedProfile.scholarshipType || "",
            studyPlan: current.studyPlan || loadedProfile.studyPlan || "",
            targetMajor: current.targetMajor || loadedProfile.targetMajor || "",
            targetSchool: current.targetSchool || loadedProfile.targetSchool || ""
          }));
        }
        setProfileNotice(data.profile ? t.profileLoaded : t.profileMissing);
      } catch (err) {
        if (ignore) return;
        const message = err instanceof Error ? err.message : t.profileMissing;
        setProfileNotice(t.profileMissing);
        if (message.toLowerCase().includes("dang nhap") || message.toLowerCase().includes("đăng nhập")) {
          router.replace("/login");
        }
      } finally {
        if (!ignore) setIsLoadingProfile(false);
      }
    }

    hydrateFromProfile();

    return () => {
      ignore = true;
    };
  }, [router, t.profileLoaded, t.profileMissing]);

  function updateForm<Key extends keyof WizardSetupForm>(key: Key, value: WizardSetupForm[Key]) {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === "hskLevel" || key === "ieltsScore") {
        next.otherLanguages = syncLanguageSummary(next.otherLanguages, next.hskLevel, next.ieltsScore);
      }

      return next;
    });
  }

  function validateForm() {
    if (!isProfileReady) {
      setError("Cần đủ trường, ngành, học bổng và study plan trước khi tạo phòng.");
      return false;
    }

    if (!selectedTargetSchool) {
      setError("Cần chọn trường mục tiêu trước khi tạo phòng.");
      return false;
    }

    setError("");
    return true;
  }

  async function goNext() {
    if (currentStep >= stepLabels.length - 1) return;

    if (currentStep === 1 && !selectedTargetSchool) {
      setError("Cần chọn trường mục tiêu trước khi sang bước tiếp theo.");
      return;
    }

    if (currentStep === 3) {
      if (!form.studyPlan || form.studyPlan.trim().length < 10) {
        setError("Vui lòng nhập Study Plan tối thiểu 10 ký tự để phân tích.");
        return;
      }
      setIsAnalyzing(true);
      setAnalysisError("");
      try {
        const token = getAuthToken();
        const res = await apiPost<any>("/api/interviews/analyze-study-plan", {
          studyPlan: form.studyPlan,
          schoolId: selectedSchoolId || null,
          majorId: form.majorId || null,
          scholarshipId: form.scholarshipId || null,
          scholarshipType: form.scholarshipType,
          targetSchool: selectedTargetSchool,
          targetMajor: form.targetMajor
        }, { token });
        setStudyPlanAnalysis(res);
      } catch (err: any) {
        console.error(err);
        setAnalysisError(err.message || "Không thể phân tích Study Plan bằng AI");
      } finally {
        setIsAnalyzing(false);
      }
    }

    setError("");
    setCurrentStep((step) => Math.min(stepLabels.length - 1, step + 1));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (currentStep < stepLabels.length - 1) {
      await goNext();
      return;
    }

    if (!validateForm()) return;

    setIsSubmitting(true);
    setError("");

    try {
      await updateMyProfile({
        additionalNotes: profile?.additionalNotes ?? null,
        age: profile?.age ?? null,
        awards: profile?.awards ?? null,
        careerPlan: profile?.careerPlan ?? null,
        degreeLevel: profile?.degreeLevel ?? "BACHELOR",
        extracurricularActivities: profile?.extracurricularActivities ?? null,
        gpa: form.gpa.trim() || null,
        hskLevel: form.hskLevel.trim() || null,
        hskkLevel: profile?.hskkLevel ?? null,
        ieltsScore: form.ieltsScore.trim() || null,
        majorId: form.majorId || profile?.majorId || null,
        otherLanguages: form.otherLanguages.trim() || null,
        researchExperience: profile?.researchExperience ?? null,
        schoolId: selectedSchoolId,
        scholarshipId: form.scholarshipId || profile?.scholarshipId || null,
        scholarshipType: form.scholarshipType.trim(),
        strengths: profile?.strengths ?? null,
        studyPlan: form.studyPlan.trim(),
        targetMajor: form.targetMajor.trim(),
        targetSchool: selectedTargetSchool,
        toeflScore: profile?.toeflScore ?? null,
        weaknesses: profile?.weaknesses ?? null,
        workExperience: profile?.workExperience ?? null
      });

      const backendLanguage = interviewModeToBackendLanguage(form.language);
      const data = await createInterviewSession({
        language: backendLanguage,
        mode: form.mode,
        majorId: form.majorId || null,
        plannedDurationMinutes: form.plannedDurationMinutes,
        schoolId: selectedSchoolId,
        scholarshipId: form.scholarshipId || null,
        scholarshipType: form.scholarshipType.trim(),
        studyPlan: form.studyPlan.trim(),
        targetMajor: form.targetMajor.trim(),
        targetSchool: selectedTargetSchool
      });

      sessionStorage.setItem(activeInterviewSessionStorageKey, data.session.id);
      setStoredInterviewLanguageMode(form.language);
      router.push(`/interview?sessionId=${data.session.id}${form.language === "BILINGUAL" ? "&mode=bilingual" : ""}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : t.createFailed;
      setError(message);

      if (message.toLowerCase().includes("dang nhap") || message.toLowerCase().includes("đăng nhập")) {
        router.replace("/login");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main id="main-content" className="page-band min-h-screen p-3 text-foreground sm:p-5" tabIndex={-1}>
      <form onSubmit={handleSubmit} className="mx-auto max-w-7xl">
        <section className="rounded-lg border border-border bg-background/88 p-5 shadow-[var(--shadow-ui)] backdrop-blur sm:p-7">
          <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 lg:flex-row lg:items-center">
            <div>
              <p className="type-caption text-primary">{t.eyebrow}</p>
              <h1 className="type-display mt-2">{t.title}</h1>
              <p className="type-body mt-2 max-w-2xl text-muted-foreground">
                Luồng 4 bước giúp chốt hồ sơ, mục tiêu, chế độ luyện tập và bắt đầu phòng phỏng vấn.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/profile" className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-black transition hover:bg-muted">
                Sửa profile
              </Link>
              <Link href="/dashboard" className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-black transition hover:bg-muted">
                {t.dashboard}
              </Link>
            </div>
          </div>

          <div className="mt-6">
            <ProgressTracker currentStep={currentStep} stepLabels={stepLabels} />
          </div>

          {profileNotice ? (
            <p className="mt-6 rounded-lg border border-border bg-primary/5 px-4 py-3 text-sm font-bold text-muted-foreground" aria-live="polite">
              {profileNotice}
            </p>
          ) : null}

          {error ? (
            <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200" role="alert">{error}</p>
          ) : null}

          <div className="mt-7">
            {currentStep === 0 ? (
              <ProfileWizardStep
                form={form}
                isLoadingProfile={isLoadingProfile}
                isProfileReady={isProfileReady}
                onChange={updateForm}
                profile={profile}
                readyCount={readyCount}
                readyItems={readyItems}
              />
            ) : null}

            {currentStep === 1 ? (
              <TargetWizardStep
                degreeLabel={degreeLabel}
                form={form}
                onChange={updateForm}
                onSchoolChange={(value, school) => {
                  setForm((current) => ({
                    ...current,
                    schoolId: school?.id ?? "",
                    targetSchool: value
                  }));
                }}
                profile={profile}
                scholarshipLabel={scholarshipLabel}
              />
            ) : null}

            {currentStep === 2 ? (
              <ModeWizardStep
                durationOptions={durationOptions}
                form={form}
                languageOptions={[["ZH", t.languageZh], ["VI", t.languageVi], ["EN", t.languageEn], ["BILINGUAL", t.languageBilingual]]}
                modeOptions={[["PRACTICE", t.practice], ["MOCK_TEST", t.mock], ["SCORING", t.scoring]]}
                onChange={updateForm}
              />
            ) : null}

            {currentStep === 3 ? (
              <StudyPlanWizardStep
                form={form}
                onChange={updateForm}
              />
            ) : null}

            {currentStep === 4 ? (
              <StudyPlanAnalysisWizardStep
                analysis={studyPlanAnalysis}
                isLoading={isAnalyzing}
                error={analysisError}
              />
            ) : null}

            {currentStep === 5 ? (
              <ConfirmWizardStep
                degreeLabel={degreeLabel}
                form={form}
                isProfileReady={isProfileReady}
                profile={profile}
                selectedTargetSchool={selectedTargetSchool}
              />
            ) : null}
          </div>

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => {
                setError("");
                setCurrentStep((step) => Math.max(0, step - 1));
              }}
              disabled={currentStep === 0 || isSubmitting}
              className="focus-ring min-h-11 rounded-lg border border-border px-5 text-sm font-black transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Quay lại
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingProfile || isAnalyzing || (currentStep === stepLabels.length - 1 && !isProfileReady)}
              className="focus-ring min-h-11 rounded-lg bg-primary px-8 text-sm font-black text-primary-foreground shadow-[0_14px_32px_rgba(184,29,36,0.18)] transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAnalyzing ? "Đang phân tích..." : currentStep < stepLabels.length - 1 ? "Tiếp tục" : isSubmitting ? t.creating : "Bắt đầu phỏng vấn"}
            </button>
          </div>
        </section>
      </form>

      {isSubmitting ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#17120f]/70 p-4 text-center backdrop-blur-sm">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-white/20 border-t-accent" />
            <div className="flex h-10 w-10 animate-pulse items-center justify-center rounded-full bg-primary/30">
              <div className="h-5 w-5 rounded-full bg-primary" />
            </div>
          </div>
          <h2 className="mt-6 text-xl font-black text-white">Đang tạo phòng phỏng vấn</h2>
          <p className="mt-2 max-w-[280px] animate-pulse text-sm font-bold text-white/72">
            AI đang phân tích profile và cá nhân hóa bộ câu hỏi cho bạn...
          </p>
        </div>
      ) : null}
    </main>
  );
}

function buildLanguageSummary(profile: UserProfileDto) {
  return [
    formatCertificate("HSK", profile.hskLevel),
    formatCertificate("HSKK", profile.hskkLevel),
    formatCertificate("IELTS", profile.ieltsScore),
    formatCertificate("TOEFL", profile.toeflScore),
    profile.otherLanguages ?? ""
  ].filter(Boolean).join(" | ");
}

function formatCertificate(prefix: string, value: string | null) {
  if (!value) return "";
  return value.trim().toLowerCase().startsWith(prefix.toLowerCase()) ? value : `${prefix} ${value}`;
}

function syncLanguageSummary(currentSummary: string, hskLevel: string, ieltsScore: string) {
  const extras = currentSummary
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !/^HSK\b/i.test(item) && !/^IELTS\b/i.test(item));

  return [
    formatInputCertificate("HSK", hskLevel),
    formatInputCertificate("IELTS", ieltsScore),
    ...extras
  ].filter(Boolean).join(", ");
}

function formatInputCertificate(prefix: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.toLowerCase().startsWith(prefix.toLowerCase()) ? trimmed : `${prefix} ${trimmed}`;
}
