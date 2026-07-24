"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { SchoolCombobox } from "@/components/schools/school-combobox";
import {
  fetchMyProfile,
  updateMyProfile,
  type ProfileInput,
  type StudyPlanImageFileDto,
  type StudyPlanImageInput,
  type UserProfileDto
} from "@/lib/profile-client";

type ProfileFormState = {
  additionalNotes: string;
  age: string;
  awards: string;
  careerPlan: string;
  degreeLevel: "BACHELOR" | "MASTER";
  extracurricularActivities: string;
  gpa: string;
  hskLevel: string;
  hskkLevel: string;
  ieltsScore: string;
  majorId: string;
  otherLanguages: string;
  researchExperience: string;
  schoolId: string;
  scholarshipId: string;
  scholarshipType: string;
  strengths: string;
  studyPlan: string;
  studyPlanExistingImages: StudyPlanImageFileDto[];
  studyPlanFileName: string;
  studyPlanFileContent: string;
  studyPlanImages: StudyPlanImageInput[];
  studyPlanImagesCleared: boolean;
  targetMajor: string;
  targetSchool: string;
  toeflScore: string;
  weaknesses: string;
  workExperience: string;
};

const defaultForm: ProfileFormState = {
  additionalNotes: "",
  age: "",
  awards: "",
  careerPlan: "",
  degreeLevel: "BACHELOR",
  extracurricularActivities: "",
  gpa: "",
  hskLevel: "",
  hskkLevel: "",
  ieltsScore: "",
  majorId: "",
  otherLanguages: "",
  researchExperience: "",
  schoolId: "",
  scholarshipId: "",
  scholarshipType: "CSC",
  strengths: "",
  studyPlan: "",
  studyPlanExistingImages: [],
  studyPlanFileName: "",
  studyPlanFileContent: "",
  studyPlanImages: [],
  studyPlanImagesCleared: false,
  targetMajor: "",
  targetSchool: "",
  toeflScore: "",
  weaknesses: "",
  workExperience: ""
};

const requiredFields: Array<keyof ProfileFormState> = [
  "targetSchool",
  "targetMajor",
  "scholarshipType",
  "studyPlan"
];

export function ProfileForm() {
  const router = useRouter();
  const [form, setForm] = useState<ProfileFormState>(defaultForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files?.length) {
      void handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      void handleFiles(Array.from(e.target.files));
    }
    e.target.value = "";
  };

  const handleFiles = async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name));
    const documentFiles = files.filter((file) => !imageFiles.includes(file));

    if (documentFiles.length && imageFiles.length) {
      setError("Vui lòng chọn một file PDF/DOCX/TXT hoặc một bộ ảnh, không trộn hai loại trong cùng lần tải.");
      return;
    }
    if (documentFiles.length > 1) {
      setError("Mỗi lần chỉ tải được một file PDF/DOCX/TXT.");
      return;
    }
    if (imageFiles.length) {
      await handleStudyPlanImages(imageFiles);
      return;
    }
    if (documentFiles[0]) await handleDocumentFile(documentFiles[0]);
  };

  const handleDocumentFile = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      setError("Dung lượng tệp tối đa được phép là 15MB.");
      return;
    }

    const allowedExtensions = ["pdf", "docx", "txt"];
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !allowedExtensions.includes(extension)) {
      setError("Định dạng tệp không được hỗ trợ. Vui lòng tải lên file PDF, DOCX hoặc TXT.");
      return;
    }

    setError("");

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result as string;
      setForm((current) => ({
        ...current,
        studyPlanExistingImages: [],
        studyPlanFileName: file.name,
        studyPlanFileContent: base64,
        studyPlanImages: [],
        studyPlanImagesCleared: true,
        studyPlan: `Tệp đã chọn: ${file.name}`
      }));
    };
  };

  const handleStudyPlanImages = async (files: File[]) => {
    const accepted = files.filter((file) => /\.(png|jpe?g|webp)$/i.test(file.name));
    if (accepted.length !== files.length) {
      setError("Ảnh Study Plan chỉ hỗ trợ PNG, JPG, JPEG hoặc WEBP.");
      return;
    }
    if (accepted.some((file) => file.size > 5 * 1024 * 1024)) {
      setError("Mỗi ảnh Study Plan tối đa 5MB.");
      return;
    }

    const replacingExisting = form.studyPlanExistingImages.length > 0 && form.studyPlanImages.length === 0;
    const currentImages = replacingExisting ? [] : form.studyPlanImages;
    if (currentImages.length + accepted.length > 6) {
      setError("Chỉ được tải tối đa 6 ảnh Study Plan.");
      return;
    }
    const totalBytes = currentImages.reduce((total, image) => total + estimateDataUrlBytes(image.fileContent), 0)
      + accepted.reduce((total, image) => total + image.size, 0);
    if (totalBytes > 20 * 1024 * 1024) {
      setError("Tổng dung lượng các ảnh Study Plan tối đa 20MB.");
      return;
    }

    const nextImages = await Promise.all(accepted.map(async (file) => ({
      fileContent: await readFileAsDataUrl(file),
      fileName: file.name
    })));
    setError("");
    setForm((current) => {
      const base = current.studyPlanExistingImages.length && !current.studyPlanImages.length
        ? []
        : current.studyPlanImages;
      const images = [...base, ...nextImages];
      return {
        ...current,
        studyPlan: `Đã chọn ${images.length} ảnh Study Plan`,
        studyPlanExistingImages: [],
        studyPlanFileContent: "",
        studyPlanFileName: "",
        studyPlanImages: images,
        studyPlanImagesCleared: true
      };
    });
  };

  const handlePasteImages = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const images = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (!images.length) return;
    event.preventDefault();
    void handleStudyPlanImages(images.map((file, index) => (
      file.name ? file : new File([file], `study-plan-paste-${Date.now()}-${index + 1}.png`, { type: file.type })
    )));
  };

  const handleRemoveFile = () => {
    setForm((current) => ({
      ...current,
      studyPlanExistingImages: [],
      studyPlanFileName: "",
      studyPlanFileContent: "",
      studyPlanImages: [],
      studyPlanImagesCleared: true,
      studyPlan: ""
    }));
  };

  const handleRemoveImage = (index: number) => {
    setForm((current) => {
      const images = current.studyPlanImages.filter((_, imageIndex) => imageIndex !== index);
      return {
        ...current,
        studyPlan: images.length ? `Đã chọn ${images.length} ảnh Study Plan` : "",
        studyPlanImages: images,
        studyPlanImagesCleared: true
      };
    });
  };

  const completion = useMemo(() => {
    const filled = requiredFields.filter((key) => {
      const value = form[key];
      return typeof value === "string" && value.trim();
    }).length;
    return Math.round((filled / requiredFields.length) * 100);
  }, [form]);

  useEffect(() => {
    let ignore = false;

    async function loadProfile() {
      setError("");
      setIsLoading(true);

      try {
        const data = await fetchMyProfile();

        if (!ignore && data.profile) {
          setForm(profileToForm(data.profile));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Không thể tải profile";
        setError(message);

        if (message.includes("đăng nhập")) {
          router.replace("/login");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      ignore = true;
    };
  }, [router]);

  function updateField<Key extends keyof ProfileFormState>(key: Key, value: ProfileFormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.targetSchool.trim() || !form.targetMajor.trim() || !form.scholarshipType.trim()) {
      setError("Vui lòng nhập đủ trường, ngành và loại học bổng.");
      return;
    }

    const hasStudyPlanSource = Boolean(
      form.studyPlanFileName
      || form.studyPlanImages.length
      || form.studyPlanExistingImages.length
    );
    if (!hasStudyPlanSource || form.studyPlan.trim().length < 10) {
      setError("Vui lòng tải lên tệp Kế hoạch học tập (Study Plan) hợp lệ.");
      return;
    }

    setIsSaving(true);

    try {
      const saved = await updateMyProfile(formToPayload(form));
      setForm(profileToForm(saved.profile));
      setSuccess("Profile đã được lưu. Bạn có thể tạo phòng phỏng vấn theo hồ sơ này.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu profile");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveAndStart() {
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const saved = await updateMyProfile(formToPayload(form));
      setForm(profileToForm(saved.profile));
      router.push("/interview/setup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu profile");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eaf3ff] dark:bg-background p-3 text-[#101b3f] dark:text-foreground sm:p-5 transition-colors duration-150">
      <section className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_340px]">
        <form onSubmit={handleSubmit} className="rounded-[24px] border border-[#c8d8f0] dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-md p-5 shadow-[0_24px_80px_rgba(34,70,120,0.14)] dark:shadow-none sm:p-7 transition-colors duration-150">
          <header className="flex flex-col justify-between gap-4 border-b border-[#dce6f5] dark:border-slate-800 pb-6 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-black uppercase text-[#0a347d] dark:text-amber-500">Profile apply</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.02em] dark:text-slate-100">Hồ sơ luyện phỏng vấn</h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#51607b] dark:text-slate-400">
                Dữ liệu này được dùng để chọn câu hỏi theo trường, ngành, học bổng và tạo câu hỏi AI cá nhân hóa.
              </p>
            </div>
            <Link href="/dashboard" className="w-fit rounded-xl border border-[#d8e3f2] dark:border-slate-800 px-5 py-3 text-sm font-black text-[#101b3f] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
              Dashboard
            </Link>
          </header>

          {isLoading ? (
            <div className="mt-6 rounded-2xl border border-[#d8e3f2] dark:border-slate-800 bg-[#f7faff] dark:bg-slate-950 p-5 text-sm font-bold text-[#51607b] dark:text-slate-400">
              Đang tải profile...
            </div>
          ) : null}

          <div className="mt-7 grid gap-7">
      <FormSection title="Thông tin nộp hồ sơ" description="Các trường bắt buộc để hệ thống chọn câu hỏi phù hợp.">
              <div className="grid gap-5 md:grid-cols-2">
                <SelectField
                  label="Hệ apply"
                  value={form.degreeLevel}
                  onChange={(value) => updateField("degreeLevel", value as ProfileFormState["degreeLevel"])}
                  options={[["BACHELOR", "Đại học"], ["MASTER", "Thạc sĩ"]]}
                />
                <NumberField label="Tuổi" value={form.age} onChange={(value) => updateField("age", value)} />
                <SchoolCombobox
                  label="Trường apply"
                  required
                  value={form.targetSchool}
                  onChange={(value, school) => {
                    setForm((current) => ({
                      ...current,
                      schoolId: school?.id ?? "",
                      targetSchool: value
                    }));
                  }}
                />
                <TextField label="Ngành apply" required value={form.targetMajor} onChange={(value) => updateField("targetMajor", value)} />
                <TextField label="Loại học bổng" required value={form.scholarshipType} onChange={(value) => updateField("scholarshipType", value)} />
                <TextField label="GPA" value={form.gpa} onChange={(value) => updateField("gpa", value)} />
              </div>
            </FormSection>

            <FormSection title="Ngoại ngữ & năng lực" description="Giúp AI điều chỉnh độ khó và đánh giá mức độ sẵn sàng.">
              <div className="grid gap-5 md:grid-cols-2">
                <TextField label="HSK" value={form.hskLevel} onChange={(value) => updateField("hskLevel", value)} />
                <TextField label="HSKK" value={form.hskkLevel} onChange={(value) => updateField("hskkLevel", value)} />
                <TextField label="IELTS" value={form.ieltsScore} onChange={(value) => updateField("ieltsScore", value)} />
                <TextField label="TOEFL" value={form.toeflScore} onChange={(value) => updateField("toeflScore", value)} />
              </div>
              <div className="mt-5">
                <TextArea
                  label="+ Ngoại ngữ / chứng chỉ khác"
                  minRows="min-h-[96px]"
                  value={form.otherLanguages}
                  onChange={(value) => updateField("otherLanguages", value)}
                />
              </div>
            </FormSection>

            <FormSection title="Kinh nghiệm & điểm nổi bật" description="Các chi tiết này làm câu trả lời thuyết phục hơn khi luyện.">
              <div className="grid gap-5 md:grid-cols-2">
                <TextArea label="Giải thưởng / thành tích" value={form.awards} onChange={(value) => updateField("awards", value)} />
                <TextArea label="Nghiên cứu / dự án" value={form.researchExperience} onChange={(value) => updateField("researchExperience", value)} />
                <TextArea label="Hoạt động ngoại khóa" value={form.extracurricularActivities} onChange={(value) => updateField("extracurricularActivities", value)} />
                <TextArea label="Kinh nghiệm làm việc / thực tập" value={form.workExperience} onChange={(value) => updateField("workExperience", value)} />
                <TextArea label="Điểm mạnh" value={form.strengths} onChange={(value) => updateField("strengths", value)} />
                <TextArea label="Điểm cần cải thiện" value={form.weaknesses} onChange={(value) => updateField("weaknesses", value)} />
              </div>
            </FormSection>

            <FormSection title="Kế hoạch học tập" description="Tải một file PDF/DOCX/TXT hoặc dán, kéo thả nhiều ảnh scan để hệ thống đọc theo thứ tự.">
              <div className="space-y-4" onPasteCapture={handlePasteImages}>
                <span className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                  Tệp Study Plan <span className="text-red-500">*</span>
                </span>

                {form.studyPlanFileName ? (
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/20">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 dark:text-white truncate">{form.studyPlanFileName}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">Đã tải lên thành công</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50 dark:border-slate-800 dark:hover:bg-slate-800"
                      title="Xóa tệp"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : form.studyPlanImages.length || form.studyPlanExistingImages.length ? (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white">
                          {(form.studyPlanImages.length || form.studyPlanExistingImages.length)} ảnh Study Plan
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">Ảnh sẽ được OCR cùng nhau theo đúng thứ tự.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="focus-ring rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-600 transition hover:bg-red-50"
                      >
                        Xóa tất cả
                      </button>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {(form.studyPlanImages.length
                        ? form.studyPlanImages
                        : form.studyPlanExistingImages
                      ).map((image, index) => (
                        <div key={`${image.fileName}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black">{index + 1}. {image.fileName}</p>
                            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                              {"sizeBytes" in image ? formatFileSize(image.sizeBytes) : "Ảnh mới"}
                            </p>
                          </div>
                          {form.studyPlanImages.length ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(index)}
                              className="focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-red-600 hover:bg-red-50"
                              aria-label={`Xóa ${image.fileName}`}
                            >
                              <X size={13} />
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Tải hoặc dán ảnh Study Plan"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.currentTarget.querySelector("input")?.click();
                      }
                    }}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
                      dragActive
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 hover:border-primary/45 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30"
                    }`}
                  >
                    <Upload className="text-slate-400 dark:text-slate-500" size={32} />
                    <p className="mt-3 text-sm font-black text-slate-900 dark:text-white">Kéo thả, chọn file hoặc dán ảnh vào đây</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">1 file PDF/DOCX/TXT tối đa 15MB; hoặc tối đa 6 ảnh, mỗi ảnh 5MB</p>
                    <p className="mt-2 rounded-lg bg-white px-3 py-1.5 text-[11px] font-black text-primary dark:bg-slate-950">Ctrl+V để dán một hoặc nhiều ảnh từ clipboard</p>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
                      onChange={handleFileSelect}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </div>
                )}
              </div>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <TextArea label="Định hướng nghề nghiệp" value={form.careerPlan} onChange={(value) => updateField("careerPlan", value)} />
                <TextArea label="Ghi chú thêm" value={form.additionalNotes} onChange={(value) => updateField("additionalNotes", value)} />
              </div>
            </FormSection>
          </div>

          {error ? (
            <p className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>
          ) : null}
          {success ? (
            <p className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</p>
          ) : null}

          <div className="mt-7 flex flex-col justify-between gap-3 border-t border-[#dce6f5] dark:border-slate-800 pt-6 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl border border-[#d8e3f2] dark:border-slate-800 px-6 py-3 text-sm font-black text-[#102456] dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-60"
            >
              {isSaving ? "Đang lưu..." : "Lưu profile"}
            </button>
            <button
              type="button"
              onClick={handleSaveAndStart}
              disabled={isSaving}
              className="rounded-xl bg-[#0a347d] dark:bg-amber-600 dark:hover:bg-amber-700 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-950/20 disabled:opacity-60 transition"
            >
              Lưu và tạo phòng phỏng vấn
            </button>
          </div>
        </form>

        <aside className="h-fit overflow-hidden rounded-lg border border-[#ead8c2] bg-[#17120f] text-white shadow-[0_24px_80px_rgba(23,18,15,0.18)]">
          <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(184,29,36,0.32),rgba(229,169,59,0.14))] p-5">
            <p className="text-xs font-black uppercase tracking-wide text-[#e5a93b]">Mức hoàn thiện</p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Sẵn sàng luyện</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-white/68">
                  Hoàn thiện hồ sơ để AI chọn câu hỏi sát hơn.
                </p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black tabular-nums">{completion}%</p>
                <p className="text-xs font-black uppercase text-white/50">ready</p>
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/12" role="progressbar" aria-label="Mức hoàn thiện profile" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion}>
              <div className="h-full rounded-full bg-[#e5a93b]" style={{ width: `${completion}%` }} />
            </div>
          </div>

          <div className="space-y-3 p-5">
            <ChecklistItem done={Boolean(form.targetSchool.trim())} label="Trường apply" />
            <ChecklistItem done={Boolean(form.targetMajor.trim())} label="Ngành apply" />
            <ChecklistItem done={Boolean(form.scholarshipType.trim())} label="Loại học bổng" />
            <ChecklistItem done={form.studyPlan.trim().length >= 10} label="Study plan" />
          </div>

          <div className="mx-5 mb-5 rounded-lg border border-[#e5a93b]/28 bg-[#e5a93b]/12 p-4">
            <p className="text-sm font-black text-[#fef3c7]">Gợi ý trả lời tốt hơn</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-white/70">
              Viết study plan theo 3 phần: mục tiêu học tập, kế hoạch theo từng năm/kỳ, và định hướng sau tốt nghiệp.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}

function profileToForm(profile: UserProfileDto): ProfileFormState {
  return {
    additionalNotes: profile.additionalNotes ?? "",
    age: profile.age?.toString() ?? "",
    awards: profile.awards ?? "",
    careerPlan: profile.careerPlan ?? "",
    degreeLevel: profile.degreeLevel,
    extracurricularActivities: profile.extracurricularActivities ?? "",
    gpa: profile.gpa ?? "",
    hskLevel: profile.hskLevel ?? "",
    hskkLevel: profile.hskkLevel ?? "",
    ieltsScore: profile.ieltsScore ?? "",
    majorId: profile.majorId ?? "",
    otherLanguages: profile.otherLanguages ?? "",
    researchExperience: profile.researchExperience ?? "",
    schoolId: profile.schoolId ?? "",
    scholarshipId: profile.scholarshipId ?? "",
    scholarshipType: profile.scholarshipType,
    strengths: profile.strengths ?? "",
    studyPlan: profile.studyPlan,
    studyPlanExistingImages: profile.studyPlanImageFiles ?? [],
    studyPlanFileName: profile.studyPlanImageFiles?.length ? "" : profile.studyPlanFileName ?? "",
    studyPlanFileContent: "",
    studyPlanImages: [],
    studyPlanImagesCleared: false,
    targetMajor: profile.targetMajor,
    targetSchool: profile.targetSchool,
    toeflScore: profile.toeflScore ?? "",
    weaknesses: profile.weaknesses ?? "",
    workExperience: profile.workExperience ?? ""
  };
}

function formToPayload(form: ProfileFormState): ProfileInput {
  return {
    additionalNotes: optionalText(form.additionalNotes),
    age: form.age.trim() ? Number(form.age) : null,
    awards: optionalText(form.awards),
    careerPlan: optionalText(form.careerPlan),
    degreeLevel: form.degreeLevel,
    extracurricularActivities: optionalText(form.extracurricularActivities),
    gpa: optionalText(form.gpa),
    hskLevel: optionalText(form.hskLevel),
    hskkLevel: optionalText(form.hskkLevel),
    ieltsScore: optionalText(form.ieltsScore),
    majorId: optionalText(form.majorId),
    otherLanguages: optionalText(form.otherLanguages),
    researchExperience: optionalText(form.researchExperience),
    schoolId: optionalText(form.schoolId),
    scholarshipId: optionalText(form.scholarshipId),
    scholarshipType: form.scholarshipType.trim(),
    strengths: optionalText(form.strengths),
    studyPlan: form.studyPlan.trim(),
    studyPlanFileName: form.studyPlanFileName.trim() ? form.studyPlanFileName.trim() : null,
    studyPlanFileContent: form.studyPlanFileContent.trim() ? form.studyPlanFileContent.trim() : null,
    studyPlanImages: form.studyPlanImages.length
      ? form.studyPlanImages
      : form.studyPlanImagesCleared
        ? null
        : undefined,
    targetMajor: form.targetMajor.trim(),
    targetSchool: form.targetSchool.trim(),
    toeflScore: optionalText(form.toeflScore),
    weaknesses: optionalText(form.weaknesses),
    workExperience: optionalText(form.workExperience)
  };
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Không thể đọc ảnh ${file.name}`));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function estimateDataUrlBytes(value: string) {
  const base64 = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  return Math.floor(base64.length * 0.75);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FormSection({
  children,
  description,
  title
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-[#d8e3f2] dark:border-slate-800 bg-white dark:bg-slate-900/30 p-5 transition-colors">
      <div className="mb-5">
        <h2 className="text-lg font-black text-[#102456] dark:text-slate-200">{title}</h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-[#6a7891] dark:text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

function TextField({
  label,
  onChange,
  required = false,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-[#102456] dark:text-slate-300">
        {label}{required ? " *" : ""}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-xl border border-[#d8e3f2] dark:border-slate-800 bg-white dark:bg-slate-950 px-4 text-sm font-semibold dark:text-slate-100 outline-none transition focus:border-[#0a347d] dark:focus:border-amber-500"
      />
    </label>
  );
}

function NumberField({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-[#102456] dark:text-slate-300">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type="number"
        min={12}
        max={80}
        className="mt-2 h-12 w-full rounded-xl border border-[#d8e3f2] dark:border-slate-800 bg-white dark:bg-slate-950 px-4 text-sm font-semibold dark:text-slate-100 outline-none transition focus:border-[#0a347d] dark:focus:border-amber-500"
      />
    </label>
  );
}

function TextArea({
  label,
  minRows = "min-h-[120px]",
  onChange,
  required = false,
  value
}: {
  label: string;
  minRows?: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-[#102456] dark:text-slate-300">
        {label}{required ? " *" : ""}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 w-full rounded-xl border border-[#d8e3f2] dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold dark:text-slate-100 leading-7 outline-none transition focus:border-[#0a347d] dark:focus:border-amber-500 ${minRows}`}
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
      <span className="text-sm font-black text-[#102456] dark:text-slate-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-xl border border-[#d8e3f2] dark:border-slate-800 bg-white dark:bg-slate-950 px-4 text-sm font-black dark:text-slate-100 outline-none transition focus:border-[#0a347d] dark:focus:border-amber-500"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue} className="dark:bg-slate-950">{labelText}</option>
        ))}
      </select>
    </label>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-lg border border-white/10 bg-white/8 px-3 text-sm font-bold text-white/84">
      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${done ? "bg-[#2e7d32] text-white" : "bg-white/12 text-white/44"}`}>
        {done ? "✓" : "•"}
      </span>
      {label}
    </div>
  );
}
