"use client";

import { Calendar, Lock, Mail, Phone, Search, Unlock, UserCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { apiGet, apiPut } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

type AdminUserSummary = {
  createdAt: string;
  email: string;
  fullName: string;
  id: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  phone?: string | null;
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
  _count: { interviewSessions: number };
};

type UserProfile = {
  age?: number | null;
  degreeLevel?: string | null;
  targetSchool?: string | null;
  targetMajor?: string | null;
  scholarshipType?: string | null;
  hskLevel?: string | null;
  hskkLevel?: string | null;
  ieltsScore?: string | null;
  toeflScore?: string | null;
  gpa?: string | null;
  studyPlan?: string | null;
  careerPlan?: string | null;
  strengths?: string | null;
  weaknesses?: string | null;
};

type InterviewHistoryItem = {
  answeredQuestions: number;
  createdAt: string;
  id: string;
  language: string;
  mode: string;
  status: string;
  targetMajor?: string | null;
  targetSchool?: string | null;
  totalQuestions: number;
  totalScore?: number | string | null;
};

type AdminUserDetail = AdminUserSummary & {
  interviewSessions: InterviewHistoryItem[];
  profile?: UserProfile | null;
};

type UsersResponse = {
  data: AdminUserSummary[];
  page: number;
  total: number;
  totalPages: number;
};

type UserDetailResponse = { user: AdminUserDetail };

const roleOptions = ["USER", "ADMIN", "SUPER_ADMIN"] as const;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const token = getAuthToken();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let url = `/api/admin/users?page=${page}&limit=30&search=${encodeURIComponent(debouncedSearch)}`;
      if (activeFilter) url += `&active=${activeFilter}`;
      if (roleFilter) url += `&role=${roleFilter}`;

      const response = await apiGet<UsersResponse>(url, { token });
      setUsers(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khong the tai danh sach user");
    } finally {
      setLoading(false);
    }
  }, [activeFilter, debouncedSearch, page, roleFilter, token]);

  const loadUserDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setError("");
    try {
      const response = await apiGet<UserDetailResponse>(`/api/admin/users/${id}`, { token });
      setSelectedUser(response.user);
      setSelectedId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khong the tai chi tiet user");
    } finally {
      setDetailLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!selectedId && users[0]) {
      void loadUserDetail(users[0].id);
    }
  }, [loadUserDetail, selectedId, users]);

  async function updateUserStatus(user: AdminUserSummary, isActive: boolean) {
    const label = isActive ? "mo khoa" : "khoa";
    if (!confirm(`Xac nhan ${label} tai khoan ${user.email}?`)) return;

    setActionId(user.id);
    setError("");
    try {
      await apiPut(`/api/admin/users/${user.id}/status`, { isActive }, { token });
      await loadUsers();
      if (selectedId === user.id) {
        await loadUserDetail(user.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khong the cap nhat trang thai user");
    } finally {
      setActionId(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6 flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-center">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-indigo-600 hover:underline">&larr; Admin</Link>
          <h1 className="mt-1 text-2xl font-bold">Quan ly users</h1>
          <p className="mt-1 text-sm text-slate-500">{total} tai khoan</p>
        </div>
      </div>

      {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <section className="mb-5 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[1fr_180px_180px]">
        <label className="flex min-h-10 items-center gap-2 rounded-lg border px-3">
          <Search size={16} className="text-slate-400" />
          <input
            className="w-full border-0 text-sm outline-none"
            placeholder="Tim theo ten, email, so dien thoai..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <select className="rounded-lg border px-3 py-2 text-sm" value={activeFilter} onChange={(event) => { setActiveFilter(event.target.value); setPage(1); }}>
          <option value="">Tat ca trang thai</option>
          <option value="true">Dang hoat dong</option>
          <option value="false">Dang khoa</option>
        </select>
        <select className="rounded-lg border px-3 py-2 text-sm" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }}>
          <option value="">Tat ca role</option>
          {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="overflow-hidden rounded-lg border bg-white">
          <div className="border-b bg-slate-50 px-4 py-3 text-sm font-bold">Danh sach user</div>
          {loading ? (
            <div className="p-4"><ListSkeleton rows={6} /></div>
          ) : users.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Session</th>
                    <th className="px-4 py-3">Login cuoi</th>
                    <th className="px-4 py-3">Trang thai</th>
                    <th className="px-4 py-3">Thao tac</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className={`border-t hover:bg-slate-50 ${selectedId === user.id ? "bg-indigo-50/60" : ""}`}>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => void loadUserDetail(user.id)} className="text-left">
                          <span className="block font-semibold text-slate-900">{user.fullName}</span>
                          <span className="block text-xs text-slate-500">{user.email}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 font-semibold">{user.role}</td>
                      <td className="px-4 py-3">{user._count.interviewSessions}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(user.lastLoginAt)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge active={user.isActive} />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={actionId === user.id}
                          onClick={() => void updateUserStatus(user, !user.isActive)}
                          className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold disabled:opacity-50 ${user.isActive ? "border-red-200 text-red-700 hover:bg-red-50" : "border-green-200 text-green-700 hover:bg-green-50"}`}
                        >
                          {user.isActive ? <Lock size={14} /> : <Unlock size={14} />}
                          {user.isActive ? "Khoa" : "Mo"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6">
              <EmptyState title="Khong co user" description="Bo loc hien tai khong tra ve tai khoan nao." />
            </div>
          )}
        </section>

        <aside className="rounded-lg border bg-white">
          <div className="border-b bg-slate-50 px-4 py-3 text-sm font-bold">Profile va lich su</div>
          {detailLoading ? (
            <div className="p-4"><ListSkeleton rows={5} /></div>
          ) : selectedUser ? (
            <div className="space-y-5 p-4">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{selectedUser.fullName}</h2>
                    <p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><Mail size={15} />{selectedUser.email}</p>
                    <p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><Phone size={15} />{selectedUser.phone || "Chua co so dien thoai"}</p>
                  </div>
                  <StatusBadge active={selectedUser.isActive} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <InfoPill label="Role" value={selectedUser.role} />
                  <InfoPill label="Ngay tao" value={formatDate(selectedUser.createdAt)} />
                </div>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><UserCheck size={16} />Ho so ung vien</h3>
                {selectedUser.profile ? (
                  <div className="grid gap-2 text-sm">
                    <InfoRow label="Bac hoc" value={selectedUser.profile.degreeLevel} />
                    <InfoRow label="Truong muc tieu" value={selectedUser.profile.targetSchool} />
                    <InfoRow label="Nganh muc tieu" value={selectedUser.profile.targetMajor} />
                    <InfoRow label="Hoc bong" value={selectedUser.profile.scholarshipType} />
                    <InfoRow label="GPA" value={selectedUser.profile.gpa} />
                    <InfoRow label="HSK/HSKK" value={[selectedUser.profile.hskLevel, selectedUser.profile.hskkLevel].filter(Boolean).join(" / ")} />
                    <InfoRow label="IELTS/TOEFL" value={[selectedUser.profile.ieltsScore, selectedUser.profile.toeflScore].filter(Boolean).join(" / ")} />
                  </div>
                ) : (
                  <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">User chua tao profile.</p>
                )}
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Calendar size={16} />20 session gan nhat</h3>
                <div className="space-y-2">
                  {selectedUser.interviewSessions.map((session) => (
                    <div key={session.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{session.targetSchool || "Chua chon truong"}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold">{session.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{session.targetMajor || "Chua chon nganh"} - {session.language} - {formatDate(session.createdAt)}</p>
                      <p className="mt-2 text-xs text-slate-600">{session.answeredQuestions}/{session.totalQuestions} cau - Diem {formatScore(session.totalScore)}</p>
                    </div>
                  ))}
                  {!selectedUser.interviewSessions.length ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Chua co lich su phong van.</p> : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <EmptyState title="Chon user" description="Chon mot user trong bang de xem profile va lich su." />
            </div>
          )}
        </aside>
      </div>

      {totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Prev</button>
          <span className="text-sm font-bold">{page}/{totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Next</button>
        </div>
      ) : null}
    </main>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      {active ? "Hoat dong" : "Dang khoa"}
    </span>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-900">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value || "-"}</span>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatScore(value?: number | string | null) {
  if (value == null) return "-";
  const score = Number(value);
  if (!Number.isFinite(score)) return "-";
  return score.toFixed(1);
}
