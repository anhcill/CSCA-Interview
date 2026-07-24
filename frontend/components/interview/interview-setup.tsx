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
import { ApiError, apiPost } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";
import { fetchPaymentEntitlement, type PaymentEntitlement } from "@/lib/payments-client";
import { StudyPlanAnalysisProgress } from "@/components/interview/study-plan-analysis-progress";
import { fetchMyProfile, updateMyProfile, type ProfileInput, type StudyPlanParseMetadata, type UserProfileDto } from "@/lib/profile-client";

const durationOptions = [30, 60, 120] as const;
const stepLabels = ["Profile", "Mục tiêu", "Chế độ", "Study Plan", "Phân tích AI", "Bắt đầu"];
const setupDraftStorageKey = "ai_phongvan_interview_setup_draft";

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
  studyPlanFileContent: "",
  studyPlanFileName: "",
  targetMajor: "",
  targetSchool: ""
};

export function InterviewSetup() {
  const router = useRouter();
  const [form, setForm] = useState<WizardSetupForm>(initialForm);
  const [currentStep, setCurrentStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [studyPlanAnalysis, setStudyPlanAnalysis] = useState<any | null>(null);
  const [studyPlanParseMetadata, setStudyPlanParseMetadata] = useState<StudyPlanParseMetadata | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [locale, setLocale] = useState<Locale>("vi");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [profileNotice, setProfileNotice] = useState("");
  const [paymentEntitlement, setPaymentEntitlement] = useState<PaymentEntitlement | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
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
      { done: Boolean(form.studyPlanFileName && form.studyPlan.trim().length >= 10), label: t.studyPlan }
    ];
  }, [form.scholarshipType, form.studyPlan, form.studyPlanFileName, form.targetMajor, selectedTargetSchool, t.major, t.scholarship, t.school, t.studyPlan]);

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

    try {
      const rawDraft = sessionStorage.getItem(setupDraftStorageKey);
      const draft = rawDraft ? JSON.parse(rawDraft) as { currentStep?: number; form?: WizardSetupForm } : null;
      if (draft?.form) {
        setForm((current) => ({
          ...current,
          ...draft.form
        }));
        const restoredStep = Math.min(stepLabels.length - 1, Math.max(0, draft.currentStep ?? 0));
        setCurrentStep(restoredStep);
        setFurthestStep(restoredStep);
      }
    } catch {
      sessionStorage.removeItem(setupDraftStorageKey);
    }

    function handleLocaleChanged(event: Event) {
      const nextLocale = (event as CustomEvent<{ locale: Locale }>).detail?.locale;
      if (nextLocale) setLocale(nextLocale);
    }

    window.addEventListener(localeChangedEvent, handleLocaleChanged);
    return () => window.removeEventListener(localeChangedEvent, handleLocaleChanged);
  }, []);

  useEffect(() => {
    let ignore = false;
    const token = getAuthToken();
    if (!token) return;
    const authToken = token;

    async function checkPayment() {
      setIsCheckingPayment(true);
      try {
        const data = await fetchPaymentEntitlement(form.plannedDurationMinutes, authToken);
        if (!ignore) setPaymentEntitlement(data.entitlement);
      } catch {
        if (!ignore) setPaymentEntitlement(null);
      } finally {
        if (!ignore) setIsCheckingPayment(false);
      }
    }

    void checkPayment();

    return () => {
      ignore = true;
    };
  }, [form.plannedDurationMinutes]);

  useEffect(() => {
    let ignore = false;

    async function hydrateFromProfile() {
      setIsLoadingProfile(true);
      try {
        const data = await fetchMyProfile();

        if (ignore) return;

        setProfile(data.profile);
        setStudyPlanParseMetadata(data.profile?.studyPlanParseMetadata ?? null);
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
            studyPlanFileContent: current.studyPlanFileContent,
            studyPlanFileName: current.studyPlanFileName || loadedProfile.studyPlanFileName || "",
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

  function handleStudyPlanFileSelect(file: File) {
    if (file.size > 15 * 1024 * 1024) {
      setError("Dung lượng tệp tối đa được phép là 15MB.");
      return;
    }

    const allowedExtensions = ["pdf", "docx", "txt", "png", "jpg", "jpeg", "webp"];
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !allowedExtensions.includes(extension)) {
      setError("Định dạng tệp không được hỗ trợ. Vui lòng upload PDF, DOCX, TXT hoặc ảnh PNG/JPG/WEBP.");
      return;
    }

    setError("");
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setStudyPlanAnalysis(null);
      setStudyPlanParseMetadata(null);
      setForm((current) => ({
        ...current,
        studyPlan: `Tệp đã chọn: ${file.name}`,
        studyPlanFileContent: reader.result as string,
        studyPlanFileName: file.name
      }));
    };
  }

  function buildProfilePayload(): ProfileInput {
    return {
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
      studyPlanFileContent: form.studyPlanFileContent.trim() || null,
      studyPlanFileName: form.studyPlanFileName.trim() || null,
      targetMajor: form.targetMajor.trim(),
      targetSchool: selectedTargetSchool,
      toeflScore: profile?.toeflScore ?? null,
      weaknesses: profile?.weaknesses ?? null,
      workExperience: profile?.workExperience ?? null
    };
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

  async function runStudyPlanAnalysis() {
    setIsAnalyzing(true);
    setAnalysisError("");
    try {
      let studyPlanForAnalysis = form.studyPlan.trim();
      let parseMetadataForAnalysis = studyPlanParseMetadata;
      if (form.studyPlanFileContent.trim()) {
        const saved = await updateMyProfile(buildProfilePayload());
        studyPlanForAnalysis = saved.profile.studyPlan;
        parseMetadataForAnalysis = saved.studyPlanParseMetadata ?? saved.profile.studyPlanParseMetadata ?? null;
        setProfile(saved.profile);
        setStudyPlanParseMetadata(parseMetadataForAnalysis);
        setForm((current) => ({
          ...current,
          studyPlan: saved.profile.studyPlan,
          studyPlanFileContent: "",
          studyPlanFileName: saved.profile.studyPlanFileName ?? current.studyPlanFileName
        }));
      }

      const token = getAuthToken();
      const res = await apiPost<any>("/api/interviews/analyze-study-plan", {
        studyPlan: studyPlanForAnalysis,
        schoolId: selectedSchoolId || null,
        majorId: form.majorId || null,
        scholarshipId: form.scholarshipId || null,
        scholarshipType: form.scholarshipType,
        studyPlanFileName: form.studyPlanFileName || profile?.studyPlanFileName || null,
        studyPlanParseMetadata: parseMetadataForAnalysis,
        targetSchool: selectedTargetSchool,
        targetMajor: form.targetMajor
      }, { timeoutMs: 90_000, token });
      setStudyPlanAnalysis(res);
      setStudyPlanParseMetadata(res.parseMetadata ?? parseMetadataForAnalysis);
    } catch (err) {
      console.error(err);
      setAnalysisError(err instanceof Error ? err.message : "Không thể phân tích Study Plan bằng AI");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function goNext() {
    if (currentStep >= stepLabels.length - 1) return;

    if (currentStep === 1 && !selectedTargetSchool) {
      setError("Cần chọn trường mục tiêu trước khi sang bước tiếp theo.");
      return;
    }

    if (currentStep === 3) {
      if (!form.studyPlanFileName || !form.studyPlan || form.studyPlan.trim().length < 10) {
        setError("Vui lòng upload file Study Plan trước khi phân tích.");
        return;
      }
      await runStudyPlanAnalysis();
    }

    setError("");
    setCurrentStep((step) => {
      const nextStep = Math.min(stepLabels.length - 1, step + 1);
      setFurthestStep((furthest) => Math.max(furthest, nextStep));
      return nextStep;
    });
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
      const saved = await updateMyProfile(buildProfilePayload());
      const sessionStudyPlan = saved.profile.studyPlan;
      setProfile(saved.profile);
      setStudyPlanParseMetadata(saved.studyPlanParseMetadata ?? saved.profile.studyPlanParseMetadata ?? null);

      const backendLanguage = interviewModeToBackendLanguage(form.language);
      const data = await createInterviewSession({
        language: backendLanguage,
        mode: form.mode,
        majorId: form.majorId || null,
        plannedDurationMinutes: form.plannedDurationMinutes,
        schoolId: selectedSchoolId,
        scholarshipId: form.scholarshipId || null,
        scholarshipType: form.scholarshipType.trim(),
        studyPlan: sessionStudyPlan,
        targetMajor: form.targetMajor.trim(),
        targetSchool: selectedTargetSchool
      });

      sessionStorage.setItem(activeInterviewSessionStorageKey, data.session.id);
      sessionStorage.removeItem(setupDraftStorageKey);
      setStoredInterviewLanguageMode(form.language);
      router.push(`/interview?sessionId=${data.session.id}${form.language === "BILINGUAL" ? "&mode=bilingual" : ""}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : t.createFailed;
      if (err instanceof ApiError && err.status === 402) {
        sessionStorage.setItem(setupDraftStorageKey, JSON.stringify({ currentStep, form }));
        router.push(`/payment?next=${encodeURIComponent("/interview/setup")}&duration=${form.plannedDurationMinutes}`);
        return;
      }

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
            <ProgressTracker
              currentStep={currentStep}
              furthestStep={furthestStep}
              stepLabels={stepLabels}
              onStepSelect={(step) => {
                setError("");
                setCurrentStep(step);
              }}
            />
          </div>

          {profileNotice ? (
            <p className="mt-6 rounded-lg border border-border bg-primary/5 px-4 py-3 text-sm font-bold text-muted-foreground" aria-live="polite">
              {profileNotice}
            </p>
          ) : null}

          <PaymentFlowNotice
            durationMinutes={form.plannedDurationMinutes}
            entitlement={paymentEntitlement}
            isChecking={isCheckingPayment}
          />

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
                onStudyPlanFileSelect={handleStudyPlanFileSelect}
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
                onFileSelect={handleStudyPlanFileSelect}
                onChange={updateForm}
              />
            ) : null}

            {currentStep === 4 ? (
              <StudyPlanAnalysisWizardStep
                analysis={studyPlanAnalysis}
                isLoading={isAnalyzing}
                error={analysisError}
                onRetry={() => void runStudyPlanAnalysis()}
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

      {isAnalyzing ? <StudyPlanAnalysisProgress /> : null}
    </main>
  );
}

function PaymentFlowNotice({
  durationMinutes,
  entitlement,
  isChecking
}: {
  durationMinutes: number;
  entitlement: PaymentEntitlement | null;
  isChecking: boolean;
}) {
  if (isChecking) {
    return (
      <p className="mt-4 rounded-lg border border-border bg-muted/45 px-4 py-3 text-sm font-bold text-muted-foreground">
        Đang kiểm tra lượt thanh toán cho gói {durationMinutes} phút...
      </p>
    );
  }

  if (entitlement?.hasAccess) {
    if (entitlement.isUnlimited) {
      return (
        <p className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">
          {entitlement.message}
        </p>
      );
    }

    const planLabel = entitlement.availablePayments[0]?.plan?.label ?? `${durationMinutes} phút`;
    return (
      <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
        Đã có lượt thanh toán sẵn sàng cho gói {planLabel}. Bạn có thể tạo phòng phỏng vấn.
      </p>
    );
  }

  if (!entitlement) return null;

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-bold">
        Cần thanh toán gói tối thiểu {durationMinutes} phút trước khi bắt đầu phỏng vấn.
      </p>
      <Link
        href={`/payment?next=${encodeURIComponent("/interview/setup")}&duration=${durationMinutes}`}
        className="focus-ring inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-black text-primary-foreground"
      >
        Thanh toán ngay
      </Link>
    </div>
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
