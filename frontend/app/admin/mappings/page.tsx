"use client";

import { Calendar, Link as LinkIcon, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";

type LookupItem = { id: string; name: string; code?: string | null; degreeLevel?: string | null };
type LookupResponse = { data: LookupItem[] };

type AdmissionSeason = {
  admission_year: number;
  ends_at?: string | null;
  id: string;
  name: string;
  note?: string | null;
  starts_at?: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
};

type SchoolMajor = {
  admission_seasons?: AdmissionSeason | null;
  id: string;
  majors: LookupItem;
  note?: string | null;
  schools: LookupItem;
};

type SchoolScholarship = {
  admission_seasons?: AdmissionSeason | null;
  id: string;
  note?: string | null;
  scholarships: LookupItem;
  schools: LookupItem;
};

type SeasonsResponse = { data: AdmissionSeason[]; statuses: AdmissionSeason["status"][] };
type SchoolMajorsResponse = { data: SchoolMajor[] };
type SchoolScholarshipsResponse = { data: SchoolScholarship[] };

const emptySeason = { admissionYear: new Date().getFullYear(), endsAt: "", name: "", note: "", startsAt: "", status: "DRAFT" as AdmissionSeason["status"] };
const emptySchoolMajor = { admissionSeasonId: "", majorId: "", note: "", schoolId: "" };
const emptySchoolScholarship = { admissionSeasonId: "", note: "", scholarshipId: "", schoolId: "" };

export default function AdminMappingsPage() {
  const [schools, setSchools] = useState<LookupItem[]>([]);
  const [majors, setMajors] = useState<LookupItem[]>([]);
  const [scholarships, setScholarships] = useState<LookupItem[]>([]);
  const [seasons, setSeasons] = useState<AdmissionSeason[]>([]);
  const [seasonStatuses, setSeasonStatuses] = useState<AdmissionSeason["status"][]>(["DRAFT", "ACTIVE", "ARCHIVED"]);
  const [schoolMajors, setSchoolMajors] = useState<SchoolMajor[]>([]);
  const [schoolScholarships, setSchoolScholarships] = useState<SchoolScholarship[]>([]);
  const [seasonForm, setSeasonForm] = useState(emptySeason);
  const [editSeasonId, setEditSeasonId] = useState<string | null>(null);
  const [schoolMajorForm, setSchoolMajorForm] = useState(emptySchoolMajor);
  const [schoolScholarshipForm, setSchoolScholarshipForm] = useState(emptySchoolScholarship);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const token = getAuthToken();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextSchools, nextMajors, nextScholarships, nextSeasons, nextSchoolMajors, nextSchoolScholarships] = await Promise.all([
        apiGet<LookupResponse>("/api/schools?active=all&limit=100", { token }),
        apiGet<LookupResponse>("/api/majors?active=all&limit=100", { token }),
        apiGet<LookupResponse>("/api/scholarships?active=all&limit=100", { token }),
        apiGet<SeasonsResponse>("/api/admin/admission-seasons", { token }),
        apiGet<SchoolMajorsResponse>("/api/admin/school-majors", { token }),
        apiGet<SchoolScholarshipsResponse>("/api/admin/school-scholarships", { token })
      ]);
      setSchools(nextSchools.data);
      setMajors(nextMajors.data);
      setScholarships(nextScholarships.data);
      setSeasons(nextSeasons.data);
      setSeasonStatuses(nextSeasons.statuses);
      setSchoolMajors(nextSchoolMajors.data);
      setSchoolScholarships(nextSchoolScholarships.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải mapping");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      admissionYear: Number(seasonForm.admissionYear),
      endsAt: seasonForm.endsAt || null,
      name: seasonForm.name,
      note: seasonForm.note || null,
      startsAt: seasonForm.startsAt || null,
      status: seasonForm.status
    };
    try {
      if (editSeasonId) {
        await apiPut(`/api/admin/admission-seasons/${editSeasonId}`, body, { token });
      } else {
        await apiPost("/api/admin/admission-seasons", body, { token });
      }
      setSeasonForm(emptySeason);
      setEditSeasonId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu mùa tuyển sinh");
    } finally {
      setSaving(false);
    }
  }

  async function saveSchoolMajor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiPost("/api/admin/school-majors", {
        admissionSeasonId: schoolMajorForm.admissionSeasonId || null,
        majorId: schoolMajorForm.majorId,
        note: schoolMajorForm.note || null,
        schoolId: schoolMajorForm.schoolId
      }, { token });
      setSchoolMajorForm(emptySchoolMajor);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu mapping trường-ngành");
    } finally {
      setSaving(false);
    }
  }

  async function saveSchoolScholarship(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiPost("/api/admin/school-scholarships", {
        admissionSeasonId: schoolScholarshipForm.admissionSeasonId || null,
        note: schoolScholarshipForm.note || null,
        scholarshipId: schoolScholarshipForm.scholarshipId,
        schoolId: schoolScholarshipForm.schoolId
      }, { token });
      setSchoolScholarshipForm(emptySchoolScholarship);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu mapping trường-học bổng");
    } finally {
      setSaving(false);
    }
  }

  async function removeMapping(kind: "major" | "scholarship", id: string) {
    if (!confirm("Xóa mapping này?")) return;
    setError("");
    try {
      await apiDelete(`/api/admin/${kind === "major" ? "school-majors" : "school-scholarships"}/${id}`, { token });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa mapping");
    }
  }

  function editSeason(season: AdmissionSeason) {
    setEditSeasonId(season.id);
    setSeasonForm({
      admissionYear: season.admission_year,
      endsAt: toDateInput(season.ends_at),
      name: season.name,
      note: season.note ?? "",
      startsAt: toDateInput(season.starts_at),
      status: season.status
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6 flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-center">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-indigo-600 hover:underline">&larr; Admin</Link>
          <h1 className="mt-1 text-2xl font-bold">Mappings</h1>
          <p className="mt-1 text-sm text-slate-500">Mùa tuyển sinh, trường-ngành và trường-học bổng.</p>
        </div>
      </div>

      {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <section className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <form onSubmit={saveSeason} className="rounded-lg border bg-white p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Calendar size={18} />Mùa tuyển sinh</h2>
          <div className="mt-4 grid gap-3">
            <input className="min-h-10 rounded-lg border px-3 text-sm" placeholder="Tên mùa" value={seasonForm.name} onChange={(event) => setSeasonForm({ ...seasonForm, name: event.target.value })} required />
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="min-h-10 rounded-lg border px-3 text-sm" min={2000} max={2100} type="number" value={seasonForm.admissionYear} onChange={(event) => setSeasonForm({ ...seasonForm, admissionYear: Number(event.target.value) })} />
              <select className="min-h-10 rounded-lg border px-3 text-sm" value={seasonForm.status} onChange={(event) => setSeasonForm({ ...seasonForm, status: event.target.value as AdmissionSeason["status"] })}>
                {seasonStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <input className="min-h-10 rounded-lg border px-3 text-sm" type="date" value={seasonForm.startsAt} onChange={(event) => setSeasonForm({ ...seasonForm, startsAt: event.target.value })} />
              <input className="min-h-10 rounded-lg border px-3 text-sm" type="date" value={seasonForm.endsAt} onChange={(event) => setSeasonForm({ ...seasonForm, endsAt: event.target.value })} />
            </div>
            <textarea className="min-h-20 rounded-lg border px-3 py-2 text-sm" placeholder="Note" value={seasonForm.note} onChange={(event) => setSeasonForm({ ...seasonForm, note: event.target.value })} />
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="min-h-10 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white disabled:opacity-50">{editSeasonId ? "Cập nhật" : "Thêm mùa"}</button>
              {editSeasonId ? <button type="button" onClick={() => { setEditSeasonId(null); setSeasonForm(emptySeason); }} className="min-h-10 rounded-lg border px-4 text-sm font-bold">Hủy</button> : null}
            </div>
          </div>
        </form>

        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-lg font-bold">Danh sách mùa</h2>
          {loading ? <div className="mt-4"><ListSkeleton rows={4} /></div> : seasons.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Tên</th>
                    <th className="px-3 py-2">Năm</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2">Thời gian</th>
                    <th className="px-3 py-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {seasons.map((season) => (
                    <tr key={season.id} className="border-t">
                      <td className="px-3 py-2 font-bold">{season.name}</td>
                      <td className="px-3 py-2">{season.admission_year}</td>
                      <td className="px-3 py-2">{season.status}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{toDateInput(season.starts_at) || "-"} - {toDateInput(season.ends_at) || "-"}</td>
                      <td className="px-3 py-2"><button type="button" onClick={() => editSeason(season)} className="text-xs font-bold text-indigo-700 hover:underline">Sửa</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="mt-4"><EmptyState title="Chưa có mùa" description="Thêm mùa tuyển sinh đầu tiên." /></div>}
        </section>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <MappingPanel
          form={schoolMajorForm}
          kind="major"
          loading={loading}
          majors={majors}
          onDelete={(id) => void removeMapping("major", id)}
          onSubmit={saveSchoolMajor}
          rows={schoolMajors}
          schools={schools}
          seasons={seasons}
          setForm={setSchoolMajorForm}
          title="Trường - ngành"
        />
        <MappingPanel
          form={schoolScholarshipForm}
          kind="scholarship"
          loading={loading}
          onDelete={(id) => void removeMapping("scholarship", id)}
          onSubmit={saveSchoolScholarship}
          rows={schoolScholarships}
          scholarships={scholarships}
          schools={schools}
          seasons={seasons}
          setForm={setSchoolScholarshipForm}
          title="Trường - học bổng"
        />
      </div>
    </main>
  );
}

function MappingPanel(props: {
  form: typeof emptySchoolMajor | typeof emptySchoolScholarship;
  kind: "major" | "scholarship";
  loading: boolean;
  majors?: LookupItem[];
  onDelete: (id: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  rows: Array<SchoolMajor | SchoolScholarship>;
  scholarships?: LookupItem[];
  schools: LookupItem[];
  seasons: AdmissionSeason[];
  setForm: (form: any) => void;
  title: string;
}) {
  const targetItems = props.kind === "major" ? props.majors ?? [] : props.scholarships ?? [];
  const targetKey = props.kind === "major" ? "majorId" : "scholarshipId";

  return (
    <section className="rounded-lg border bg-white p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><LinkIcon size={18} />{props.title}</h2>
      <form onSubmit={props.onSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
        <select className="min-h-10 rounded-lg border px-3 text-sm" value={props.form.schoolId} onChange={(event) => props.setForm({ ...props.form, schoolId: event.target.value })} required>
          <option value="">Chọn trường</option>
          {props.schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
        </select>
        <select className="min-h-10 rounded-lg border px-3 text-sm" value={(props.form as any)[targetKey]} onChange={(event) => props.setForm({ ...props.form, [targetKey]: event.target.value })} required>
          <option value="">{props.kind === "major" ? "Chọn ngành" : "Chọn học bổng"}</option>
          {targetItems.map((item) => <option key={item.id} value={item.id}>{item.name}{item.degreeLevel ? ` (${item.degreeLevel})` : ""}{item.code ? ` - ${item.code}` : ""}</option>)}
        </select>
        <select className="min-h-10 rounded-lg border px-3 text-sm" value={props.form.admissionSeasonId} onChange={(event) => props.setForm({ ...props.form, admissionSeasonId: event.target.value })}>
          <option value="">Không gắn mùa</option>
          {props.seasons.map((season) => <option key={season.id} value={season.id}>{season.name} {season.admission_year}</option>)}
        </select>
        <input className="min-h-10 rounded-lg border px-3 text-sm" placeholder="Ghi chú" value={props.form.note} onChange={(event) => props.setForm({ ...props.form, note: event.target.value })} />
        <button type="submit" className="min-h-10 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white md:col-span-2">Thêm mapping</button>
      </form>

      <div className="mt-5">
        {props.loading ? <ListSkeleton rows={5} /> : props.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Trường</th>
                  <th className="px-3 py-2">{props.kind === "major" ? "Ngành" : "Học bổng"}</th>
                  <th className="px-3 py-2">Mùa</th>
                  <th className="px-3 py-2">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {props.rows.map((row) => {
                  const target = props.kind === "major" ? (row as SchoolMajor).majors : (row as SchoolScholarship).scholarships;
                  return (
                    <tr key={row.id} className="border-t">
                      <td className="px-3 py-2 font-semibold">{row.schools.name}</td>
                      <td className="px-3 py-2">{target.name}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{row.admission_seasons ? `${row.admission_seasons.name} ${row.admission_seasons.admission_year}` : "-"}</td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => props.onDelete(row.id)} className="inline-flex items-center gap-1 text-xs font-bold text-red-700 hover:underline">
                          <Trash2 size={13} />
                          Xóa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="Chưa có mapping" description="Thêm mapping bằng form bên trên." />}
      </div>
    </section>
  );
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}
