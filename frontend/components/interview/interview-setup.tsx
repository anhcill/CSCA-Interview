"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  activeInterviewSessionStorageKey,
  createInterviewSession
} from "@/lib/interview-client";
import {
  getStoredLocale,
  interviewModeToBackendLanguage,
  localeChangedEvent,
  localeToBackendLanguage,
  messages,
  setStoredInterviewLanguageMode,
  type InterviewLanguageMode,
  type Locale
} from "@/lib/i18n";
import { fetchMyProfile } from "@/lib/profile-client";

const stepKeys = ["personal", "target", "capability", "studyPlan"] as const;

type SetupForm = {
  age: string;
  degreeLevel: "BACHELOR" | "MASTER";
  fullName: string;
  gender: "MALE" | "FEMALE";
  language: InterviewLanguageMode;
  mode: "PRACTICE" | "MOCK_TEST" | "SCORING";
  scholarshipType: string;
  studyPlan: string;
  targetMajor: string;
  targetSchool: string;
};

const initialForm: SetupForm = {
  age: "22",
  degreeLevel: "BACHELOR",
  fullName: "Nguyễn Văn A",
  gender: "MALE",
  language: "ZH",
  mode: "PRACTICE",
  scholarshipType: "CSC",
  studyPlan: "Tập trung nâng cao tiếng Trung, hoàn thành các môn nền tảng, tham gia dự án nghiên cứu và chuẩn bị định hướng nghề nghiệp sau tốt nghiệp.",
  targetMajor: "Trí tuệ nhân tạo",
  targetSchool: "Đại học Thanh Hoa"
};

export function InterviewSetup() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SetupForm>(initialForm);
  const [locale, setLocale] = useState<Locale>("vi");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");
  const t = messages[locale].setup;

  const stepLabels = useMemo(() => stepKeys.map((key) => t.steps[key]), [t.steps]);
  const progress = useMemo(() => ((step + 1) / stepKeys.length) * 100, [step]);

  useEffect(() => {
    const initialLocale = getStoredLocale();
    setLocale(initialLocale);
    setForm((current) => ({
      ...current,
      language: current.language === "ZH" ? localeToBackendLanguage(initialLocale) : current.language
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
      try {
        const data = await fetchMyProfile();

        if (ignore || !data.profile) {
          return;
        }

        setForm((current) => ({
          ...current,
          age: data.profile?.age?.toString() ?? current.age,
          degreeLevel: data.profile?.degreeLevel ?? current.degreeLevel,
          scholarshipType: data.profile?.scholarshipType ?? current.scholarshipType,
          studyPlan: data.profile?.studyPlan ?? current.studyPlan,
          targetMajor: data.profile?.targetMajor ?? current.targetMajor,
          targetSchool: data.profile?.targetSchool ?? current.targetSchool
        }));
        setProfileNotice(t.profileLoaded);
      } catch {
        setProfileNotice(t.profileMissing);
      }
    }

    hydrateFromProfile();

    return () => {
      ignore = true;
    };
  }, [t.profileLoaded, t.profileMissing]);

  function updateForm<Key extends keyof SetupForm>(key: Key, value: SetupForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validateStep(stepIndex: number) {
    const age = Number(form.age);
    const validation = t.validation;
    let message = "";

    if (stepIndex === 0) {
      if (form.fullName.trim().length < 2) message = validation.fullName;
      else if (!Number.isFinite(age) || age < 13 || age > 80) message = validation.age;
    }

    if (stepIndex === 1) {
      if (!form.targetSchool.trim()) message = validation.targetSchool;
      else if (!form.targetMajor.trim()) message = validation.targetMajor;
      else if (!form.scholarshipType.trim()) message = validation.scholarshipType;
    }

    if (stepIndex === 3 && form.studyPlan.trim().length < 20) {
      message = validation.studyPlan;
    }

    setError(message);
    return !message;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(current + 1, stepKeys.length - 1));
  }

  function goBack() {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
  }

  function goToStep(nextStep: number) {
    if (nextStep <= step) {
      setError("");
      setStep(nextStep);
      return;
    }

    if (!validateStep(step)) return;
    setStep(Math.min(nextStep, step + 1));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step < stepKeys.length - 1) {
      goNext();
      return;
    }

    if (!validateStep(step)) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const backendLanguage = interviewModeToBackendLanguage(form.language);
      const age = Number(form.age);
      const data = await createInterviewSession({
        age: Number.isFinite(age) ? age : undefined,
        degreeLevel: form.degreeLevel,
        fullName: form.fullName,
        language: backendLanguage,
        mode: form.mode,
        scholarshipType: form.scholarshipType,
        studyPlan: form.studyPlan,
        targetMajor: form.targetMajor,
        targetSchool: form.targetSchool
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
    <main id="main-content" className="min-h-screen bg-[#f3f6f8] p-3 text-[#101b3f] sm:p-5" tabIndex={-1}>
      <section className="mx-auto grid min-h-[calc(100vh-24px)] max-w-7xl gap-5 lg:grid-cols-[1.08fr_0.92fr]">
        <form onSubmit={handleSubmit} className="rounded-lg border border-[#d8dee8] bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] sm:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-black uppercase text-[#0a347d]">{t.eyebrow}</p>
              <h1 className="mt-2 text-3xl font-black">{t.title}</h1>
            </div>
            <Link href="/dashboard" className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-[#d8e3f2] px-4 text-sm font-black text-[#263553] transition hover:bg-[#f6f8fb]">
              {t.dashboard}
            </Link>
          </div>

          <div className="mt-7">
            <div className="h-2 overflow-hidden rounded-full bg-[#dce6f5]" role="progressbar" aria-label={stepLabels[step]} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
              <div className="h-full rounded-full bg-[#0a347d]" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-4">
              {stepLabels.map((label, index) => (
                <button
                  type="button"
                  key={label}
                  onClick={() => goToStep(index)}
                  className="focus-ring min-h-11 text-left"
                  aria-current={index === step ? "step" : undefined}
                >
                  <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-sm font-black ${index <= step ? "bg-[#0a347d] text-white" : "bg-white text-[#51607b] ring-1 ring-[#d6e0ef]"}`}>
                    {index + 1}
                  </span>
                  <span className="mt-2 block text-center text-xs font-black text-[#51607b]">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 min-h-[360px]">
            {profileNotice ? (
              <p className="mb-5 rounded-lg border border-[#d8e3f2] bg-[#f7faff] px-4 py-3 text-sm font-bold text-[#51607b]" aria-live="polite">
                {profileNotice}
              </p>
            ) : null}
            {step === 0 ? <PersonalStep form={form} t={t} updateForm={updateForm} /> : null}
            {step === 1 ? <TargetStep form={form} t={t} updateForm={updateForm} /> : null}
            {step === 2 ? <CapabilityStep form={form} t={t} updateForm={updateForm} /> : null}
            {step === 3 ? <StudyPlanStep form={form} t={t} updateForm={updateForm} /> : null}
          </div>

          {error ? (
            <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700" role="alert">{error}</p>
          ) : null}

          <div className="mt-7 flex items-center justify-between gap-4 border-t border-[#dce6f5] pt-6">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0 || isSubmitting}
              className="focus-ring min-h-11 rounded-lg border border-[#d8e3f2] px-6 text-sm font-black text-[#102456] transition hover:bg-[#f6f8fb] disabled:opacity-45"
            >
              {t.back}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="focus-ring min-h-11 rounded-lg bg-[#0a347d] px-8 text-sm font-black text-white shadow-lg shadow-blue-950/20 transition hover:bg-[#082b68] disabled:opacity-60"
            >
              {step === stepKeys.length - 1 ? (isSubmitting ? t.creating : t.createRoom) : t.next}
            </button>
          </div>
        </form>

        <aside className="overflow-hidden rounded-lg border border-[#d8dee8] bg-[#111827] text-white shadow-[0_18px_55px_rgba(15,23,42,0.12)]">
          <div className="relative min-h-[260px] bg-[url('/auth/image/image1.png')] bg-cover bg-center" role="img" aria-label={t.previewTitle}>
            <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-[#111827]/58 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <p className="text-sm font-black uppercase text-[#f6c445]">{t.roomPreview}</p>
              <h2 className="mt-2 text-3xl font-black">{t.previewTitle}</h2>
            </div>
          </div>
          <div className="space-y-4 p-6">
            <PreviewRow label={t.candidate} value={form.fullName || t.empty} />
            <PreviewRow label={t.degree} value={form.degreeLevel === "BACHELOR" ? t.bachelor : t.master} />
            <PreviewRow label={t.school} value={form.targetSchool || t.empty} />
            <PreviewRow label={t.major} value={form.targetMajor || t.empty} />
            <PreviewRow label={t.scholarship} value={form.scholarshipType || t.empty} />
            <div className="rounded-lg border border-white/18 bg-white/10 p-4">
              <p className="text-xs font-black uppercase text-white/58">{t.mode}</p>
              <p className="mt-2 text-lg font-black">
                {form.mode === "PRACTICE" ? t.practice : form.mode === "MOCK_TEST" ? t.mock : t.scoring}
              </p>
            </div>
          </div>
        </aside>
      </section>

      {isSubmitting ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-white/20 border-t-blue-500" />
            <div className="h-10 w-10 animate-pulse rounded-full bg-blue-500/30 flex items-center justify-center">
              <div className="h-5 w-5 rounded-full bg-blue-600" />
            </div>
          </div>
          <h2 className="mt-6 text-xl font-black text-white">Đang tạo phòng phỏng vấn</h2>
          <p className="mt-2 text-sm font-bold text-slate-300 max-w-[280px] animate-pulse">
            AI đang phân tích hồ sơ và cá nhân hóa bộ câu hỏi cho bạn...
          </p>
        </div>
      ) : null}
    </main>
  );
}

function PersonalStep({
  form,
  t,
  updateForm
}: {
  form: SetupForm;
  t: (typeof messages)["vi"]["setup"];
  updateForm: <Key extends keyof SetupForm>(key: Key, value: SetupForm[Key]) => void;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField label={t.fullName} required value={form.fullName} onChange={(value) => updateForm("fullName", value)} />
      <TextField label={t.age} max={80} min={13} required type="number" value={form.age} onChange={(value) => updateForm("age", value)} />
      <RadioGroup
        label={t.degree}
        options={[["BACHELOR", t.bachelor], ["MASTER", t.master]]}
        value={form.degreeLevel}
        onChange={(value) => updateForm("degreeLevel", value as SetupForm["degreeLevel"])}
      />
      <RadioGroup
        label={t.gender}
        options={[["MALE", t.male], ["FEMALE", t.female]]}
        value={form.gender}
        onChange={(value) => updateForm("gender", value as SetupForm["gender"])}
      />
    </div>
  );
}

function TargetStep({
  form,
  t,
  updateForm
}: {
  form: SetupForm;
  t: (typeof messages)["vi"]["setup"];
  updateForm: <Key extends keyof SetupForm>(key: Key, value: SetupForm[Key]) => void;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField label={t.targetSchool} required value={form.targetSchool} onChange={(value) => updateForm("targetSchool", value)} />
      <TextField label={t.targetMajor} required value={form.targetMajor} onChange={(value) => updateForm("targetMajor", value)} />
      <TextField label={t.scholarshipType} required value={form.scholarshipType} onChange={(value) => updateForm("scholarshipType", value)} />
      <SelectField
        label={t.interviewLanguage}
        value={form.language}
        options={[["ZH", t.languageZh], ["VI", t.languageVi], ["EN", t.languageEn], ["BILINGUAL", t.languageBilingual]]}
        onChange={(value) => updateForm("language", value as SetupForm["language"])}
      />
    </div>
  );
}

function CapabilityStep({
  form,
  t,
  updateForm
}: {
  form: SetupForm;
  t: (typeof messages)["vi"]["setup"];
  updateForm: <Key extends keyof SetupForm>(key: Key, value: SetupForm[Key]) => void;
}) {
  return (
    <div className="space-y-5">
      <SelectField
        label={t.mode}
        value={form.mode}
        options={[["PRACTICE", t.practice], ["MOCK_TEST", t.mock], ["SCORING", t.scoring]]}
        onChange={(value) => updateForm("mode", value as SetupForm["mode"])}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {["HSK/IELTS", "GPA", "Hoạt động"].map((item) => (
          <div key={item} className="rounded-lg border border-[#d8e3f2] bg-[#f7faff] p-4">
            <p className="text-sm font-black text-[#102456]">{item}</p>
            <p className="mt-2 text-xs font-bold leading-5 text-[#6a7891]">{t.personalizeHint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StudyPlanStep({
  form,
  t,
  updateForm
}: {
  form: SetupForm;
  t: (typeof messages)["vi"]["setup"];
  updateForm: <Key extends keyof SetupForm>(key: Key, value: SetupForm[Key]) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-[#102456]">{t.studyPlan}</span>
      <textarea
        value={form.studyPlan}
        onChange={(event) => updateForm("studyPlan", event.target.value)}
        className="mt-2 min-h-[220px] w-full rounded-lg border border-[#d8e3f2] bg-white px-4 py-3 text-sm font-semibold leading-7 outline-none transition focus:border-[#0a347d]"
        minLength={20}
        placeholder={t.studyPlanPlaceholder}
        required
      />
    </label>
  );
}

function TextField({
  label,
  max,
  min,
  onChange,
  required,
  type = "text",
  value
}: {
  label: string;
  max?: number;
  min?: number;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-[#102456]">{label}</span>
      <input
        max={max}
        min={min}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-lg border border-[#d8e3f2] bg-white px-4 text-sm font-semibold outline-none transition focus:border-[#0a347d]"
      />
    </label>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-[#102456]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-lg border border-[#d8e3f2] bg-white px-4 text-sm font-black outline-none transition focus:border-[#0a347d]"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>{labelText}</option>
        ))}
      </select>
    </label>
  );
}

function RadioGroup({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  value: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-black text-[#102456]">{label}</legend>
      <div className="mt-4 flex flex-wrap gap-5">
        {options.map(([optionValue, labelText]) => (
          <label key={optionValue} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#31405f]">
            <input
              checked={value === optionValue}
              onChange={() => onChange(optionValue)}
              type="radio"
              className="h-4 w-4"
            />
            {labelText}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/18 bg-white/10 px-4 py-3">
      <span className="text-xs font-black uppercase text-white/58">{label}</span>
      <span className="text-right text-sm font-black">{value}</span>
    </div>
  );
}
