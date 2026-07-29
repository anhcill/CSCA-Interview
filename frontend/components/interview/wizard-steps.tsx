"use client";

import { AlertCircle, BookOpen, Check, ChevronDown, Clock, FileText, School, Sparkles, Upload, User, X, type LucideIcon } from "lucide-react";
import { InlineSystemLoading } from "@/components/ui/system-loading";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SchoolCombobox } from "@/components/schools/school-combobox";
import { GpaFields } from "@/components/profile/gpa-fields";
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
  const { majors, scholarships } = useApplicationOptions(form.schoolId);
  const eligibleMajors = majors.filter((major) => major.degreeLevel === (profile?.degreeLevel ?? "BACHELOR"));
  const majorValue = getSelectedMajorId(form, eligibleMajors);
  const scholarshipValue = getSelectedScholarshipId(form, scholarships);

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_0.82fr]">
      <div className="rounded-lg border border-border bg-background p-5 shadow-[var(--shadow-ui)]">
        <StepHeader eyebrow="Bước 1" icon={User} title="Hồ sơ cá nhân" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <TextInput label="Tên tiếng Trung" value={form.applicantNameZh} placeholder="Ví dụ: Nguyễn Minh An" onChange={(value) => onChange("applicantNameZh", value)} />
          <GpaFields
            degreeLevel={profile?.degreeLevel ?? "BACHELOR"}
            value={form.gpa}
            onChange={(value) => onChange("gpa", value)}
          />
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
                if ((school?.id ?? "") !== form.schoolId) {
                  onChange("majorId", "");
                  onChange("targetMajor", "");
                }
                onChange("targetSchool", value);
                onChange("schoolId", school?.id ?? "");
              }}
            />
            <OptionSelect
              label="Ngành apply"
              value={majorValue}
              placeholder={form.schoolId ? "Chọn ngành" : "Chọn trường trước"}
              options={eligibleMajors.map((major) => [major.id, `${major.name} (${formatDegreeLabel(major.degreeLevel)})${major.nameZh ? ` · ${major.nameZh}` : ""}`] as SelectOption)}
              onChange={(value) => {
                const major = eligibleMajors.find((item) => item.id === value);
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
  const { majors, scholarships } = useApplicationOptions(form.schoolId);
  const eligibleMajors = majors.filter((major) => major.degreeLevel === (profile?.degreeLevel ?? "BACHELOR"));
  const majorValue = getSelectedMajorId(form, eligibleMajors);
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
          placeholder={form.schoolId ? "Chọn ngành" : "Chọn trường trước"}
          options={eligibleMajors.map((major) => [major.id, `${major.name} (${formatDegreeLabel(major.degreeLevel)})${major.nameZh ? ` · ${major.nameZh}` : ""}`] as SelectOption)}
          onChange={(value) => {
            const major = eligibleMajors.find((item) => item.id === value);
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
  const [studyPlanExpanded, setStudyPlanExpanded] = useState(false);
  const studyPlanPreview = form.studyPlan || profile?.studyPlan || "Study Plan chưa có dữ liệu.";

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
          <div className="overflow-hidden rounded-lg border border-white/15 bg-white/10">
            <div className="relative">
              <p className={`break-words whitespace-pre-wrap p-4 text-sm font-semibold leading-6 text-white/82 ${studyPlanExpanded ? "" : "max-h-28 overflow-hidden"}`}>
                {studyPlanPreview}
              </p>
              {!studyPlanExpanded ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#29231f] to-transparent" /> : null}
            </div>
            <button
              type="button"
              onClick={() => setStudyPlanExpanded((expanded) => !expanded)}
              className="focus-ring flex min-h-10 w-full items-center justify-center gap-2 border-t border-white/10 px-4 text-xs font-black text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-expanded={studyPlanExpanded}
            >
              {studyPlanExpanded ? "Thu gọn Study Plan" : "Xem toàn bộ Study Plan"}
              <ChevronDown size={16} className={`transition-transform ${studyPlanExpanded ? "rotate-180" : ""}`} />
            </button>
          </div>
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

function useApplicationOptions(schoolId: string) {
  const [majors, setMajors] = useState<MajorOption[]>([]);
  const [scholarships, setScholarships] = useState<ScholarshipOption[]>([]);

  useEffect(() => {
    let ignore = false;

    async function loadOptions() {
      try {
        const [majorResponse, scholarshipResponse] = await Promise.all([
          schoolId
            ? apiGet<LookupResponse<MajorOption>>(`/api/majors?schoolId=${encodeURIComponent(schoolId)}&limit=200`, { cacheMs: 60_000 })
            : Promise.resolve({ data: [] } as LookupResponse<MajorOption>),
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
  }, [schoolId]);

  return { majors, scholarships };
}

function getSelectedMajorId(form: WizardSetupForm, majors: MajorOption[]) {
  return (
    majors.some((major) => major.id === form.majorId)
      ? form.majorId
      : majors.find((major) => major.name === form.targetMajor)?.id
  ) || "";
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
      <InlineSystemLoading
        title="AI đang phân tích Study Plan"
        description="MOLY đang đối chiếu kế hoạch của bạn với yêu cầu của trường và ngành học."
      />
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
  const missingPoints = normalizeAnalysisItems(analysis.missingPoints);
  const suggestions = normalizeAnalysisItems(analysis.suggestions);
  const generatedQuestions = normalizeAnalysisItems(analysis.generatedQuestions);
  const alignmentScore = Math.max(0, Math.min(100, Math.round(Number(analysis.alignmentScore) || 0)));
  const alignmentLabel = alignmentScore >= 75 ? "Phù hợp tốt" : alignmentScore >= 50 ? "Cần bổ sung" : "Cần điều chỉnh lớn";

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-[#ead8c2] bg-[#17120f] text-white shadow-[0_24px_70px_rgba(23,18,15,0.18)] dark:border-slate-700">
        <div className="absolute inset-y-0 right-0 w-full bg-[url('/auth/image/study_abroad_hero.png')] bg-cover bg-center opacity-20 sm:w-[58%] sm:opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#17120f] via-[#17120f]/95 to-[#17120f]/55" />
        <div className="relative flex flex-col gap-7 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:p-10">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#e5a93b]/35 bg-[#e5a93b]/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-[#f4c96f]">
              <Sparkles size={15} /> Báo cáo hồ sơ du học
            </span>
            <h2 className="mt-5 text-3xl font-black leading-tight sm:text-4xl">Phân tích Study Plan bằng AI</h2>
            <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-white/72">
              Báo cáo tập trung vào mức độ phù hợp với trường, ngành và học bổng mục tiêu, kèm các bước cải thiện có thể thực hiện ngay.
            </p>
            {parseMetadata ? (
              <p className="mt-4 inline-flex rounded-lg bg-white/10 px-3 py-2 text-sm font-bold text-white/75">
                {parseMetadata.fileName ? `${parseMetadata.fileName} · ` : ""}{parseMetadata.extractedTextLength.toLocaleString("vi-VN")} ký tự đã phân tích
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm sm:p-5">
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full p-2 shadow-xl"
              style={{ background: `conic-gradient(#e5a93b ${alignmentScore * 3.6}deg, rgba(255,255,255,0.14) 0deg)` }}
            >
              <div className="flex h-full w-full items-center justify-center rounded-full bg-[#17120f] text-2xl font-black">{alignmentScore}%</div>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#f4c96f]">Mức độ phù hợp</p>
              <p className="mt-1 text-xl font-black">{alignmentLabel}</p>
              <p className="mt-1 max-w-44 text-sm font-semibold leading-5 text-white/65">So với mục tiêu trường và ngành hiện tại</p>
            </div>
          </div>
        </div>
      </div>

      {parseWarnings.length ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-black">Lưu ý khi đọc tài liệu</p>
            <ul className="mt-2 space-y-1 text-sm font-semibold leading-6">
              {parseWarnings.map((warning, idx) => <li key={idx}>• {warning}</li>)}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <AnalysisInsightCard icon={Check} items={strengths} title="Nền tảng nổi bật" tone="success" />
        <AnalysisInsightCard icon={AlertCircle} items={weaknesses} title="Điểm cần chỉnh sửa" tone="danger" />
        <AnalysisInsightCard icon={BookOpen} items={missingPoints} title="Nội dung còn thiếu" tone="warning" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#cbdcf4] bg-background shadow-[var(--shadow-ui)] dark:border-slate-700">
        <div className="border-b border-[#dbe7f7] bg-[#eef5ff] px-5 py-5 dark:border-slate-700 dark:bg-slate-900 sm:px-7">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">Kế hoạch hành động</p>
          <h3 className="mt-1 text-2xl font-black text-foreground">Gợi ý cải thiện Study Plan</h3>
          <p className="mt-2 text-base font-semibold leading-7 text-muted-foreground">Ưu tiên xử lý lần lượt các mục dưới đây trước khi nộp hồ sơ hoặc bước vào phỏng vấn.</p>
        </div>
        <ol className="grid gap-0 p-3 sm:grid-cols-2 sm:p-5">
          {suggestions.map((item: string, idx: number) => (
            <li key={idx} className="flex gap-4 rounded-xl p-4 transition hover:bg-muted/60">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-black text-white">{idx + 1}</span>
              <p className="text-[15px] font-semibold leading-7 text-foreground">{item}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#ead8c2] bg-background shadow-[var(--shadow-ui)] dark:border-slate-700">
        <div className="flex flex-col gap-3 border-b border-[#ead8c2] bg-[#fff8ed] px-5 py-5 dark:border-slate-700 dark:bg-slate-900 sm:px-7">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#a76b12] dark:text-[#f4c96f]">Luyện tập cùng giáo sư AI</p>
          <h3 className="text-2xl font-black text-foreground">Câu hỏi phỏng vấn dự kiến</h3>
          <p className="max-w-4xl text-base font-semibold leading-7 text-muted-foreground">Các câu hỏi được tạo trực tiếp từ nội dung Study Plan. Hãy chuẩn bị câu trả lời có ví dụ cụ thể và liên kết rõ với mục tiêu du học.</p>
        </div>
        <ol className="grid gap-4 p-5 lg:grid-cols-2 sm:p-7">
          {generatedQuestions.map((item: string, idx: number) => (
            <li key={idx} className="flex items-start gap-4 rounded-xl border border-border bg-muted/30 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-black text-primary-foreground shadow-sm">{idx + 1}</span>
              <p className="text-base font-bold leading-7 text-foreground">{item}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function AnalysisInsightCard({
  icon: Icon,
  items,
  title,
  tone
}: {
  icon: LucideIcon;
  items: string[];
  title: string;
  tone: "danger" | "success" | "warning";
}) {
  const styles = {
    danger: "border-red-200 bg-red-50/65 text-red-700 dark:border-red-900 dark:bg-red-950/45 dark:text-red-300",
    success: "border-emerald-200 bg-emerald-50/65 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/45 dark:text-emerald-300",
    warning: "border-amber-200 bg-amber-50/65 text-amber-700 dark:border-amber-900 dark:bg-amber-950/45 dark:text-amber-300"
  } as const;

  return (
    <article className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${styles[tone]}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-current/10"><Icon size={21} /></span>
        <h3 className="text-lg font-black">{title}</h3>
      </div>
      <ul className="mt-5 space-y-4">
        {items.length ? items.map((item, idx) => (
          <li key={idx} className="flex gap-3 text-[15px] font-semibold leading-7 text-foreground/85">
            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
            <span>{item}</span>
          </li>
        )) : <li className="text-sm font-semibold text-muted-foreground">Chưa có nhận xét cho mục này.</li>}
      </ul>
    </article>
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
