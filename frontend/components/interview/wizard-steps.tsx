"use client";

import { AlertCircle, BookOpen, Check, Clock, FileText, Loader2, School, Sparkles, Upload, User, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SchoolCombobox } from "@/components/schools/school-combobox";
import { apiGet } from "@/lib/api";
import type { InterviewLanguageMode } from "@/lib/i18n";
import type { StudyPlanParseMetadata, UserProfileDto } from "@/lib/profile-client";
import type { SchoolDto } from "@/lib/schools-client";

export type WizardSetupForm = {
  applicantNameZh: string;
  gpa: string;
  hskLevel: string;
  ieltsScore: string;
  language: InterviewLanguageMode;
  majorId: string;
  mode: "PRACTICE" | "MOCK_TEST" | "SCORING";
  otherLanguages: string;
  plannedDurationMinutes: number;
  schoolId: string;
  scholarshipId: string;
  scholarshipType: string;
  studyPlan: string;
  studyPlanFileContent: string;
  studyPlanFileName: string;
  targetMajor: string;
  targetSchool: string;
};

type ReadyItem = {
  done: boolean;
  label: string;
};

type MajorOption = {
  degreeLevel: "BACHELOR" | "MASTER";
  id: string;
  name: string;
  nameZh?: string | null;
};

type ScholarshipOption = {
  code?: string | null;
  id: string;
  name: string;
};

type LookupResponse<T> = {
  data: T[];
};

type SelectOption = [string, string];

export function ProfileWizardStep({
  form,
  isLoadingProfile,
  isProfileReady,
  onChange,
  onStudyPlanFileSelect,
  profile,
  readyCount,
  readyItems
}: {
  form: WizardSetupForm;
  isLoadingProfile: boolean;
  isProfileReady: boolean;
  onChange: <Key extends keyof WizardSetupForm>(key: Key, value: WizardSetupForm[Key]) => void;
  onStudyPlanFileSelect: (file: File) => void;
  profile: UserProfileDto | null;
  readyCount: number;
  readyItems: ReadyItem[];
}) {
  const { majors, scholarships } = useApplicationOptions();
  const majorValue = getSelectedMajorId(form, majors);
  const scholarshipValue = getSelectedScholarshipId(form, scholarships);

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_0.82fr]">
      <div className="rounded-lg border border-border bg-background p-5 shadow-[var(--shadow-ui)]">
        <StepHeader eyebrow="Bước 1" icon={User} title="Hồ sơ cá nhân" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <TextInput label="Tên tiếng Trung" value={form.applicantNameZh} placeholder="Ví dụ: Nguyễn Minh An" onChange={(value) => onChange("applicantNameZh", value)} />
          <TextInput label="GPA" value={form.gpa} placeholder="Ví dụ: 3.6/4.0" onChange={(value) => onChange("gpa", value)} />
          <TextInput label="HSK" value={form.hskLevel} placeholder="Ví dụ: HSK 5" onChange={(value) => onChange("hskLevel", value)} />
          <TextInput label="IELTS" value={form.ieltsScore} placeholder="Ví dụ: 6.5" onChange={(value) => onChange("ieltsScore", value)} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {readyItems.map((item) => (
            <ChecklistPill key={item.label} done={item.done} label={item.label} />
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-primary/5 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-foreground">Hồ sơ nộp</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${isProfileReady ? "bg-[hsl(var(--success))] text-white" : "bg-accent text-accent-foreground"}`}>
            {isProfileReady ? "Sẵn sàng" : `${readyCount}/${readyItems.length} mục`}
          </span>
        </div>
        {isLoadingProfile ? (
          <p className="mt-4 rounded-lg bg-background px-4 py-3 text-sm font-bold text-muted-foreground">Đang tải profile...</p>
        ) : (
          <div className="mt-4 grid gap-4">
            {!profile ? (
              <div className="rounded-lg border border-accent/50 bg-accent/10 p-4 text-sm font-bold leading-6 text-foreground">
                Chưa có profile apply. Bạn vẫn có thể nhập thông tin cho buổi luyện này.
              </div>
            ) : null}
            <SchoolCombobox
              label="Trường apply"
              value={form.targetSchool}
              onChange={(value, school) => {
                onChange("targetSchool", value);
                onChange("schoolId", school?.id ?? "");
              }}
            />
            <OptionSelect
              label="Ngành apply"
              value={majorValue}
              placeholder="Chọn ngành"
              options={majors.map((major) => [major.id, `${major.name} (${formatDegreeLabel(major.degreeLevel)})${major.nameZh ? ` · ${major.nameZh}` : ""}`] as SelectOption)}
              onChange={(value) => {
                const major = majors.find((item) => item.id === value);
                onChange("majorId", major?.id ?? "");
                onChange("targetMajor", major?.name ?? "");
              }}
            />
            <OptionSelect
              label="Loại học bổng"
              value={scholarshipValue}
              placeholder="Chọn học bổng"
              options={scholarships.map((scholarship) => [scholarship.id, `${scholarship.name}${scholarship.code ? ` · ${scholarship.code}` : ""}`] as SelectOption)}
              onChange={(value) => {
                const scholarship = scholarships.find((item) => item.id === value);
                onChange("scholarshipId", scholarship?.id ?? "");
                onChange("scholarshipType", scholarship?.name ?? "");
              }}
            />
            <TextInput label="Ngoại ngữ" value={form.otherLanguages} placeholder="Ví dụ: HSK 5, IELTS 6.5" onChange={(value) => onChange("otherLanguages", value)} />
            <StudyPlanSourceBox
              fileName={form.studyPlanFileName}
              studyPlan={form.studyPlan}
              onFileSelect={onStudyPlanFileSelect}
              onRemove={() => {
                onChange("studyPlan", "");
                onChange("studyPlanFileContent", "");
                onChange("studyPlanFileName", "");
              }}
            />
          </div>
        )}
        <Link href="/profile" className="focus-ring mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-black text-foreground">
          Sửa profile
        </Link>
      </div>
    </section>
  );
}

export function TargetWizardStep({
  degreeLabel,
  form,
  onChange,
  onSchoolChange,
  profile,
  scholarshipLabel
}: {
  degreeLabel: string;
  form: WizardSetupForm;
  onChange: <Key extends keyof WizardSetupForm>(key: Key, value: WizardSetupForm[Key]) => void;
  onSchoolChange: (value: string, school?: SchoolDto) => void;
  profile: UserProfileDto | null;
  scholarshipLabel: string;
}) {
  const { majors, scholarships } = useApplicationOptions();
  const majorValue = getSelectedMajorId(form, majors);
  const scholarshipValue = getSelectedScholarshipId(form, scholarships);

  return (
    <section className="rounded-lg border border-border bg-background p-5 shadow-[var(--shadow-ui)]">
      <StepHeader eyebrow="Bước 2" icon={School} title="Mục tiêu du học" />
      <div className="mt-5">
        <SchoolCombobox label="Trường mục tiêu" value={form.targetSchool} onChange={onSchoolChange} />
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <OptionSelect
          label="Chuyên ngành"
          value={majorValue}
          placeholder="Chọn ngành"
          options={majors.map((major) => [major.id, `${major.name} (${formatDegreeLabel(major.degreeLevel)})${major.nameZh ? ` · ${major.nameZh}` : ""}`] as SelectOption)}
          onChange={(value) => {
            const major = majors.find((item) => item.id === value);
            onChange("majorId", major?.id ?? "");
            onChange("targetMajor", major?.name ?? "");
          }}
        />
        <OptionSelect
          label="Học bổng"
          value={scholarshipValue}
          placeholder="Chọn học bổng"
          options={scholarships.map((scholarship) => [scholarship.id, `${scholarship.name}${scholarship.code ? ` · ${scholarship.code}` : ""}`] as SelectOption)}
          onChange={(value) => {
            const scholarship = scholarships.find((item) => item.id === value);
            onChange("scholarshipId", scholarship?.id ?? "");
            onChange("scholarshipType", scholarship?.name ?? "");
          }}
        />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <FactCard label="Hệ đào tạo" value={degreeLabel} />
        <FactCard label="Chuyên ngành" value={form.targetMajor || profile?.targetMajor || "Chưa nhập"} />
        <FactCard label="Học bổng" value={form.scholarshipType || scholarshipLabel || "Chưa nhập"} />
      </div>
    </section>
  );
}

export function ModeWizardStep({
  durationOptions,
  form,
  languageOptions,
  modeOptions,
  onChange
}: {
  durationOptions: readonly number[];
  form: WizardSetupForm;
  languageOptions: SelectOption[];
  modeOptions: SelectOption[];
  onChange: <Key extends keyof WizardSetupForm>(key: Key, value: WizardSetupForm[Key]) => void;
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-lg border border-border bg-background p-5 shadow-[var(--shadow-ui)]">
        <StepHeader eyebrow="Bước 3" icon={Sparkles} title="Chế độ luyện tập" />
        <div className="mt-5 grid gap-3">
          {modeOptions.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange("mode", value as WizardSetupForm["mode"])}
              className={`focus-ring flex min-h-14 items-center justify-between rounded-lg border px-4 text-left text-sm font-black transition ${
                form.mode === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
              }`}
              aria-pressed={form.mode === value}
            >
              {label}
              {form.mode === value ? <Check size={18} /> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-primary/5 p-5">
        <StepHeader eyebrow="Thiết lập" icon={Clock} title="Ngôn ngữ và thời lượng" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <SelectField label="Ngôn ngữ phỏng vấn" value={form.language} options={languageOptions} onChange={(value) => onChange("language", value as WizardSetupForm["language"])} />
          <NumberInput label="Tùy chỉnh phút" value={form.plannedDurationMinutes} onChange={(value) => onChange("plannedDurationMinutes", clampDuration(value))} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {durationOptions.map((minutes) => (
            <button
              type="button"
              key={minutes}
              onClick={() => onChange("plannedDurationMinutes", minutes)}
              className={`focus-ring min-h-12 rounded-lg border px-4 text-sm font-black transition ${
                form.plannedDurationMinutes === minutes ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
              }`}
              aria-pressed={form.plannedDurationMinutes === minutes}
            >
              {formatDurationLabel(minutes)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ConfirmWizardStep({
  degreeLabel,
  form,
  isProfileReady,
  profile,
  selectedTargetSchool
}: {
  degreeLabel: string;
  form: WizardSetupForm;
  isProfileReady: boolean;
  profile: UserProfileDto | null;
  selectedTargetSchool: string;
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
      <div className="rounded-lg border border-border bg-background p-5 shadow-[var(--shadow-ui)]">
        <StepHeader eyebrow="Bước 4" icon={Check} title="Xác nhận & bắt đầu" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <FactCard label="Ứng viên" value={form.applicantNameZh || "Chưa nhập"} />
          <FactCard label="Hệ đào tạo" value={degreeLabel} />
          <FactCard label="Trường" value={selectedTargetSchool || "Chưa nhập"} />
          <FactCard label="Ngành" value={form.targetMajor || profile?.targetMajor || "Chưa nhập"} />
          <FactCard label="Học bổng" value={form.scholarshipType || "Chưa nhập"} />
          <FactCard label="Chế độ" value={modeLabel(form.mode)} />
          <FactCard label="Thời lượng" value={formatDurationLabel(form.plannedDurationMinutes)} />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-[#17120f] text-white shadow-[var(--shadow-ui)]">
        <div className="relative min-h-[220px] bg-[url('/auth/image/image1.png')] bg-cover bg-center" role="img" aria-label="Phòng phỏng vấn">
          <div className="absolute inset-0 bg-gradient-to-t from-[#17120f] via-[#17120f]/64 to-transparent" />
          <div className="absolute bottom-5 left-5 right-5">
            <p className="text-xs font-black uppercase text-[#e5a93b]">Preview</p>
            <h2 className="mt-2 text-2xl font-black">Phòng luyện phỏng vấn</h2>
          </div>
        </div>
        <div className="space-y-3 p-5">
    <PreviewRow label="Trạng thái" value={isProfileReady ? "Sẵn sàng" : "Thiếu hồ sơ"} />
          <PreviewRow label="HSK / IELTS" value={[form.hskLevel, form.ieltsScore].filter(Boolean).join(" / ") || "Chưa nhập"} />
          <p className="rounded-lg border border-white/15 bg-white/10 p-4 text-sm font-semibold leading-6 text-white/82">
            {form.studyPlan || profile?.studyPlan || "Study plan chưa có dữ liệu."}
          </p>
        </div>
      </div>
    </section>
  );
}

function StepHeader({ eyebrow, icon: Icon, title }: { eyebrow: string; icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Icon size={20} />
      </span>
      <div>
        <p className="text-xs font-black uppercase text-primary">{eyebrow}</p>
        <h2 className="text-xl font-black text-foreground">{title}</h2>
      </div>
    </div>
  );
}

function TextInput({ label, onChange, placeholder, value }: { label: string; onChange: (value: string) => void; placeholder: string; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-12 w-full rounded-lg border border-border bg-background px-4 text-sm font-semibold outline-none transition focus:border-primary"
      />
    </label>
  );
}

function NumberInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: number }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type="number"
        min={10}
        max={180}
        className="mt-2 h-12 w-full rounded-lg border border-border bg-background px-4 text-sm font-semibold outline-none transition focus:border-primary"
      />
    </label>
  );
}

function SelectField({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: SelectOption[]; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-border bg-background px-4 text-sm font-black outline-none transition focus:border-primary">
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>{labelText}</option>
        ))}
      </select>
    </label>
  );
}

function OptionSelect({ label, onChange, options, placeholder, value }: { label: string; onChange: (value: string) => void; options: SelectOption[]; placeholder: string; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-lg border border-border bg-background px-4 text-sm font-black outline-none transition focus:border-primary"
      >
        <option value="">{placeholder}</option>
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>{labelText}</option>
        ))}
      </select>
    </label>
  );
}

function ChecklistPill({ done, label }: ReadyItem) {
  return (
    <span className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-black ${done ? "bg-[hsl(var(--success))] text-white" : "bg-muted text-muted-foreground"}`}>
      <Check size={14} />
      {label}
    </span>
  );
}

function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-4 py-3">
      <p className="text-xs font-black uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-foreground">{value}</p>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/15 bg-white/10 px-4 py-3">
      <span className="text-xs font-black uppercase text-white/58">{label}</span>
      <span className="text-right text-sm font-black">{value}</span>
    </div>
  );
}

function useApplicationOptions() {
  const [majors, setMajors] = useState<MajorOption[]>([]);
  const [scholarships, setScholarships] = useState<ScholarshipOption[]>([]);

  useEffect(() => {
    let ignore = false;

    async function loadOptions() {
      try {
        const [majorResponse, scholarshipResponse] = await Promise.all([
          apiGet<LookupResponse<MajorOption>>("/api/majors?active=all&limit=200", { cacheMs: 5 * 60_000 }),
          apiGet<LookupResponse<ScholarshipOption>>("/api/scholarships?active=all&limit=100", { cacheMs: 5 * 60_000 })
        ]);

        if (ignore) return;
        setMajors(majorResponse.data);
        setScholarships(scholarshipResponse.data);
      } catch {
        if (ignore) return;
        setMajors([]);
        setScholarships([]);
      }
    }

    void loadOptions();

    return () => {
      ignore = true;
    };
  }, []);

  return { majors, scholarships };
}

function getSelectedMajorId(form: WizardSetupForm, majors: MajorOption[]) {
  return form.majorId || majors.find((major) => major.name === form.targetMajor)?.id || "";
}

function getSelectedScholarshipId(form: WizardSetupForm, scholarships: ScholarshipOption[]) {
  return form.scholarshipId || scholarships.find((scholarship) => scholarship.name === form.scholarshipType)?.id || "";
}

function formatDegreeLabel(level: MajorOption["degreeLevel"]) {
  return level === "MASTER" ? "Thạc sĩ" : "Đại học";
}

function clampDuration(value: string) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return 30;
  return Math.min(180, Math.max(10, Math.round(minutes)));
}

function formatDurationLabel(minutes: number) {
  if (minutes === 60) return "1 giờ";
  if (minutes % 60 === 0) return `${minutes / 60} giờ`;
  if (minutes > 60) return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
  return `${minutes} phút`;
}

function modeLabel(mode: WizardSetupForm["mode"]) {
  if (mode === "MOCK_TEST") return "Thi thử thời gian thực";
  if (mode === "SCORING") return "Phòng chấm điểm";
  return "Có gợi ý";
}

export function StudyPlanWizardStep({
  form,
  onFileSelect,
  onChange
}: {
  form: WizardSetupForm;
  onFileSelect: (file: File) => void;
  onChange: <Key extends keyof WizardSetupForm>(key: Key, value: WizardSetupForm[Key]) => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-background p-5 shadow-[var(--shadow-ui)]">
      <StepHeader eyebrow="Bước 4" icon={BookOpen} title="Kế hoạch học tập (Study Plan)" />
      <p className="text-xs text-muted-foreground mt-1">
        Study Plan lấy từ profile nếu học viên đã upload file. Nếu chưa có file, hãy upload PDF, DOCX, TXT hoặc ảnh scan tại đây.
      </p>
      <div className="mt-4">
        <StudyPlanSourceBox
          fileName={form.studyPlanFileName}
          studyPlan={form.studyPlan}
          onFileSelect={onFileSelect}
          onRemove={() => {
            onChange("studyPlan", "");
            onChange("studyPlanFileContent", "");
            onChange("studyPlanFileName", "");
          }}
        />
      </div>
    </section>
  );
}


function StudyPlanSourceBox({
  fileName,
  onFileSelect,
  onRemove,
  studyPlan
}: {
  fileName: string;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  studyPlan: string;
}) {
  const [dragActive, setDragActive] = useState(false);

  function handleDrag(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(event.type === "dragenter" || event.type === "dragover");
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  }

  if (fileName) {
    return (
      <div className="rounded-lg border border-border bg-background p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText size={20} />
            </span>
            <div className="min-w-0">
              <p className="break-words text-sm font-black text-foreground">{fileName}</p>
              <p className="mt-1 text-xs font-bold text-muted-foreground">Đã lấy Study Plan từ profile/file upload.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Xóa file Study Plan"
            title="Xóa file Study Plan"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-xs font-black uppercase text-muted-foreground">Nội dung trích xuất</p>
          <p className="mt-2 max-h-44 overflow-y-auto whitespace-pre-wrap text-sm font-semibold leading-6 text-foreground">
            {studyPlan || "Nội dung sẽ được trích xuất sau khi lưu profile."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      className={`relative flex min-h-44 flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition ${
        dragActive ? "border-primary bg-primary/5" : "border-border bg-muted/35 hover:border-primary/60"
      }`}
    >
      <Upload size={32} className="text-muted-foreground" />
      <p className="mt-3 text-sm font-black text-foreground">Chưa có Study Plan trong profile</p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">Upload PDF, DOCX, TXT hoặc ảnh scan. Hệ thống sẽ trích xuất nội dung để AI phân tích.</p>
      <input
        type="file"
        accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelect(file);
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="Upload Study Plan"
      />
    </div>
  );
}

export function StudyPlanAnalysisWizardStep({
  analysis,
  isLoading,
  error,
  onRetry
}: {
  analysis: any;
  isLoading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <section className="rounded-lg border border-border bg-background p-8 text-center shadow-[var(--shadow-ui)] flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="animate-spin text-primary mb-4" size={36} />
        <h3 className="text-lg font-black text-foreground">AI đang phân tích Study Plan</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Giáo sư AI đang đối chiếu kế hoạch của bạn với các yêu cầu của trường và ngành học tiêu chuẩn Trung Quốc...
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border border-border bg-background p-8 text-center shadow-[var(--shadow-ui)] flex flex-col items-center justify-center min-h-[300px]">
        <p className="text-sm font-bold text-red-500">{error}</p>
        <p className="mt-2 text-xs text-muted-foreground">Bạn có thể thử lại hoặc tiếp tục bước tiếp theo mà không cần phân tích.</p>
        <button
          type="button"
          onClick={onRetry}
          className="focus-ring mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-black text-primary-foreground"
        >
          Thử phân tích lại
        </button>
      </section>
    );
  }

  if (!analysis) return null;

  const parseMetadata = analysis.parseMetadata as StudyPlanParseMetadata | undefined;
  const parseWarnings = parseMetadata?.warnings ?? [];
  const strengths = normalizeAnalysisItems(analysis.strengths);
  const weaknesses = normalizeAnalysisItems(analysis.weaknesses);
  const suggestions = normalizeAnalysisItems(analysis.suggestions);
  const generatedQuestions = normalizeAnalysisItems(analysis.generatedQuestions);

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
      <div className="rounded-lg border border-border bg-background p-5 shadow-[var(--shadow-ui)] flex flex-col gap-4">
        <StepHeader eyebrow="Bước 5" icon={Sparkles} title="Phân tích Study Plan bằng AI" />

        {parseWarnings.length ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-black uppercase">Cảnh báo đọc file</p>
                <ul className="mt-1 space-y-1 text-xs font-semibold leading-5">
                  {parseWarnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
                {parseMetadata ? (
                  <p className="mt-2 text-[11px] font-bold opacity-80">
                    {parseMetadata.fileName ? `${parseMetadata.fileName} · ` : ""}{parseMetadata.extractedTextLength} ký tự đã đọc
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* Alignment score */}
        <div className="flex items-center gap-4 rounded-xl bg-primary/5 p-4 border border-primary/10">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-black text-primary-foreground shadow-md">
            {analysis.alignmentScore}%
          </div>
          <div>
            <h4 className="text-sm font-black text-foreground">Mức độ phù hợp với mục tiêu</h4>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Điểm số dựa trên sự tương thích giữa Study Plan của bạn với yêu cầu của trường và ngành học mục tiêu.
            </p>
          </div>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-green-700/20 bg-green-500/5 p-4">
            <h5 className="text-xs font-black uppercase text-green-700">✅ Điểm mạnh</h5>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground font-semibold">
              {strengths.map((item: string, idx: number) => (
                <li key={idx} className="flex gap-1.5"><span className="text-green-600 shrink-0">•</span> {item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-red-700/20 bg-red-500/5 p-4">
            <h5 className="text-xs font-black uppercase text-red-700">⚠️ Điểm yếu / Cần sửa</h5>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground font-semibold">
              {weaknesses.map((item: string, idx: number) => (
                <li key={idx} className="flex gap-1.5"><span className="text-red-600 shrink-0">•</span> {item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Suggestions */}
        <div className="rounded-lg border border-blue-700/20 bg-blue-500/5 p-4">
          <h5 className="text-xs font-black uppercase text-blue-700">💡 Gợi ý cải thiện</h5>
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground font-semibold">
            {suggestions.map((item: string, idx: number) => (
              <li key={idx} className="flex gap-1.5"><span className="text-blue-600 shrink-0">•</span> {item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background p-5 shadow-[var(--shadow-ui)]">
        <h3 className="text-sm font-black text-foreground flex items-center gap-1.5 mb-3">
          <span>📋 Các câu hỏi phỏng vấn dự kiến (AI tạo)</span>
        </h3>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          Giáo sư AI dự kiến sẽ đặt các câu hỏi sau dựa trên thông tin kế hoạch học tập của bạn. Hãy chuẩn bị kỹ câu trả lời.
        </p>
        <div className="space-y-3">
          {generatedQuestions.map((item: string, idx: number) => (
            <div key={idx} className="p-3 rounded-lg bg-muted text-xs font-bold text-foreground border border-border flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary">
                {idx + 1}
              </span>
              <p className="leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function normalizeAnalysisItems(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split("\n").map((item) => item.trim()).filter(Boolean);
  }

  return [];
}
