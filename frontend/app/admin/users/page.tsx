"use client";

import { Calendar, FileText, Lock, Mail, Phone, Search, Unlock, UserCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { apiGet, apiPost, apiPut } from "@/lib/api";
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
  studyPlanFileName?: string | null;
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
  const [passwordDraft, setPasswordDraft] = useState("");
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
      setError(err instanceof Error ? err.message : "Không thể tải danh sách người dùng");
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
      setError(err instanceof Error ? err.message : "Không thể tải chi tiết người dùng");
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
    const label = isActive ? "mở khóa" : "khóa";
    if (!confirm(`Xác nhận ${label} tài khoản ${user.email}?`)) return;

    setActionId(user.id);
    setError("");
    try {
      await apiPut(`/api/admin/users/${user.id}/status`, { isActive }, { token });
      await loadUsers();
      if (selectedId === user.id) {
        await loadUserDetail(user.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật trạng thái người dùng");
    } finally {
      setActionId(null);
    }
  }

  async function updateUserRole(user: AdminUserSummary, role: AdminUserSummary["role"]) {
    if (user.role === role) return;
    if (!confirm(`Đổi role ${user.email} thành ${role}?`)) return;

    setActionId(`${user.id}:role`);
    setError("");
    try {
      await apiPut(`/api/admin/users/${user.id}/role`, { role }, { token });
      await loadUsers();
      if (selectedId === user.id) {
        await loadUserDetail(user.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật role người dùng");
    } finally {
      setActionId(null);
    }
  }

  async function resetUserPassword() {
    if (!selectedUser) return;
    if (passwordDraft.length < 8) {
      setError("Mật khẩu mới cần tối thiểu 8 ký tự");
      return;
    }
    if (!confirm(`Reset mật khẩu cho ${selectedUser.email}?`)) return;

    setActionId(`${selectedUser.id}:password`);
    setError("");
    try {
      await apiPost(`/api/admin/users/${selectedUser.id}/reset-password`, { password: passwordDraft }, { token });
      setPasswordDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể reset mật khẩu");
    } finally {
      setActionId(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6 flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-center">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-indigo-600 hover:underline">&larr; Admin</Link>
          <h1 className="mt-1 text-2xl font-bold">Quản lý người dùng</h1>
          <p className="mt-1 text-sm text-slate-500">{total} tài khoản</p>
        </div>
      </div>

      {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <section className="mb-5 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[1fr_180px_180px]">
        <label className="flex min-h-10 items-center gap-2 rounded-lg border px-3">
          <Search size={16} className="text-slate-400" />
          <input
            className="w-full border-0 text-sm outline-none"
            placeholder="Tìm theo tên, email, số điện thoại..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <select className="rounded-lg border px-3 py-2 text-sm" value={activeFilter} onChange={(event) => { setActiveFilter(event.target.value); setPage(1); }}>
          <option value="">Tất cả trạng thái</option>
          <option value="true">Đang hoạt động</option>
          <option value="false">Đang khóa</option>
        </select>
        <select className="rounded-lg border px-3 py-2 text-sm" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }}>
          <option value="">Tất cả role</option>
          {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="overflow-hidden rounded-lg border bg-white">
          <div className="border-b bg-slate-50 px-4 py-3 text-sm font-bold">Danh sách người dùng</div>
          {loading ? (
            <div className="p-4"><ListSkeleton rows={6} /></div>
          ) : users.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Người dùng</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Buổi</th>
                    <th className="px-4 py-3">Đăng nhập cuối</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Thao tác</th>
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
                      <td className="px-4 py-3">
                        <select
                          className="rounded-lg border px-2 py-1 text-xs font-bold"
                          disabled={actionId === `${user.id}:role`}
                          value={user.role}
                          onChange={(event) => void updateUserRole(user, event.target.value as AdminUserSummary["role"])}
                        >
                          {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                        </select>
                      </td>
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
                          {user.isActive ? "Khóa" : "Mở"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6">
              <EmptyState title="Không có user" description="Bộ lọc hiện tại không trả về tài khoản nào." />
            </div>
          )}
        </section>

        <aside className="rounded-lg border bg-white">
          <div className="border-b bg-slate-50 px-4 py-3 text-sm font-bold">Profile và lịch sử</div>
          {detailLoading ? (
            <div className="p-4"><ListSkeleton rows={5} /></div>
          ) : selectedUser ? (
            <div className="space-y-5 p-4">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{selectedUser.fullName}</h2>
                    <p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><Mail size={15} />{selectedUser.email}</p>
                    <p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><Phone size={15} />{selectedUser.phone || "Chưa có số điện thoại"}</p>
                  </div>
                  <StatusBadge active={selectedUser.isActive} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <InfoPill label="Role" value={selectedUser.role} />
                  <InfoPill label="Ngày tạo" value={formatDate(selectedUser.createdAt)} />
                </div>
                <div className="mt-3 flex flex-col gap-2 rounded-lg border bg-slate-50 p-3">
                  <label className="text-xs font-bold text-slate-600" htmlFor="admin-reset-password">Mật khẩu mới</label>
                  <div className="flex gap-2">
                    <input
                      id="admin-reset-password"
                      className="min-h-10 flex-1 rounded-lg border px-3 text-sm"
                      minLength={8}
                      type="password"
                      value={passwordDraft}
                      onChange={(event) => setPasswordDraft(event.target.value)}
                    />
                    <button
                      type="button"
                      disabled={actionId === `${selectedUser.id}:password`}
                      onClick={() => void resetUserPassword()}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-200 px-3 text-xs font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                    >
                      <Lock size={14} />
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><UserCheck size={16} />Hồ sơ ứng viên</h3>
                {selectedUser.profile ? (
                  <div className="grid gap-2 text-sm">
                    <InfoRow label="Bậc học" value={selectedUser.profile.degreeLevel} />
                    <InfoRow label="Trường mục tiêu" value={selectedUser.profile.targetSchool} />
                    <InfoRow label="Ngành mục tiêu" value={selectedUser.profile.targetMajor} />
                    <InfoRow label="Học bổng" value={selectedUser.profile.scholarshipType} />
                    <InfoRow label="GPA" value={selectedUser.profile.gpa} />
                    <InfoRow label="HSK/HSKK" value={[selectedUser.profile.hskLevel, selectedUser.profile.hskkLevel].filter(Boolean).join(" / ")} />
                    <InfoRow label="IELTS/TOEFL" value={[selectedUser.profile.ieltsScore, selectedUser.profile.toeflScore].filter(Boolean).join(" / ")} />
                    <div className="grid grid-cols-[120px_1fr] gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <span className="text-slate-500">Kế hoạch học tập</span>
                      <span className="font-medium text-slate-900">
                        {selectedUser.profile.studyPlanFileName ? (
                          <a
                            href={`/api/admin/users/${selectedUser.id}/study-plan/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-850 hover:underline font-bold"
                          >
                            <FileText size={14} className="shrink-0" />
                            {selectedUser.profile.studyPlanFileName}
                          </a>
                        ) : (
                          <span className="text-slate-400">Không có file tải lên</span>
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Người dùng chưa tạo hồ sơ.</p>
                )}
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Calendar size={16} />20 buổi gần nhất</h3>
                <div className="space-y-2">
                  {selectedUser.interviewSessions.map((session) => (
                    <div key={session.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{session.targetSchool || "Chưa chọn trường"}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold">{session.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{session.targetMajor || "Chưa chọn ngành"} - {session.language} - {formatDate(session.createdAt)}</p>
                      <p className="mt-2 text-xs text-slate-600">{session.answeredQuestions}/{session.totalQuestions} câu - Điểm {formatScore(session.totalScore)}</p>
                    </div>
                  ))}
                  {!selectedUser.interviewSessions.length ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Chưa có lịch sử phỏng vấn.</p> : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <EmptyState title="Chọn người dùng" description="Chọn một người dùng trong bảng để xem hồ sơ và lịch sử." />
            </div>
          )}
        </aside>
      </div>

      {totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Trước</button>
          <span className="text-sm font-bold">{page}/{totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Sau</button>
        </div>
      ) : null}
    </main>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      {active ? "Hoạt động" : "Đang khóa"}
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
