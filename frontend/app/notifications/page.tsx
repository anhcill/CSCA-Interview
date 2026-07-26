"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { InlineSystemLoading } from "@/components/ui/system-loading";

const BellIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const InboxIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPut } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface PaginatedResponse {
  items: NotificationItem[];
  total: number;
  page: number;
  limit: number;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const limit = 10;

  const token = getAuthToken();

  const fetchNotifications = useCallback(async (currentPage: number) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const skip = (currentPage - 1) * limit;
      const data = await apiGet<PaginatedResponse>(`/api/notifications?limit=${limit}&skip=${skip}`, { token });
      setNotifications(data.items || []);
      setTotal(data.total || 0);
      setPage(data.page || currentPage);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, [limit, token]);

  useEffect(() => {
    fetchNotifications(page);
  }, [fetchNotifications, page]);

  const markAllRead = async () => {
    if (!token) return;
    try {
      await apiPut("/api/notifications/read-all", {}, { token });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      console.error("Error marking all read:", error);
    }
  };

  const markAsRead = async (id: string) => {
    if (!token) return;
    try {
      await apiPut(`/api/notifications/${id}/read`, {}, { token });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (error) {
      console.error("Error marking notification read:", error);
    }
  };

  const formatFullTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "";
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-[var(--background-soft)] text-foreground">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BellIcon size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl text-primary">Trung tâm thông báo</h1>
              <p className="text-sm font-bold text-muted-foreground mt-1">Cập nhật tin tức phỏng vấn và kết quả học tập của bạn</p>
            </div>
          </div>
          {notifications.some((n) => !n.isRead) && (
            <button
              onClick={markAllRead}
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-background border border-border px-4 text-sm font-black text-primary hover:bg-muted transition-colors shadow-sm self-start sm:self-auto"
            >
              <Check size={16} />
              Đánh dấu tất cả đã đọc
            </button>
          )}
        </div>

        {/* Content list */}
        {isLoading ? (
          <InlineSystemLoading
            title="Đang tải thông báo"
            description="MOLY đang cập nhật những thông tin mới nhất dành cho bạn."
          />
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background p-12 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
              <InboxIcon size={28} />
            </div>
            <h3 className="text-lg font-black text-foreground">Hộp thư trống</h3>
            <p className="text-sm font-bold text-muted-foreground mt-1">Bạn không có thông báo nào vào lúc này.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-background overflow-hidden shadow-sm">
              <div className="divide-y divide-border">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`flex flex-col sm:flex-row gap-4 p-5 transition-colors ${
                      notification.isRead ? "bg-background hover:bg-muted/30" : "bg-primary/5 hover:bg-primary/10"
                    }`}
                  >
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-black ${notification.isRead ? "text-foreground" : "text-primary"}`}>
                          {notification.title}
                        </span>
                        {!notification.isRead && (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary uppercase tracking-wider">
                            Mới
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground font-medium leading-relaxed mt-1">
                        {notification.message}
                      </p>
                      <span className="text-xs text-muted-foreground/75 font-semibold mt-2">
                        {formatFullTime(notification.createdAt)}
                      </span>
                    </div>

                    {!notification.isRead && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="focus-ring self-start sm:self-center inline-flex min-h-9 items-center justify-center rounded-lg bg-background border border-border px-3 text-xs font-black text-muted-foreground hover:text-foreground transition-colors shrink-0 shadow-sm"
                      >
                        Đánh dấu đã đọc
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-2">
                <span className="text-xs font-bold text-muted-foreground">
                  Trang {page} / {totalPages} (Tổng {total} thông báo)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
