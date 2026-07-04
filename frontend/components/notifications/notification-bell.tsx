"use client";

import { Check, Loader2 } from "lucide-react";

const BellIcon = ({ size = 19, className = "" }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
import Link from "next/link";
import { useCallback, useEffect, useState, useRef } from "react";
import { apiGet, apiPut } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const token = getAuthToken();

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiGet<{ count: number }>("/api/notifications/unread-count", { token });
      setUnreadCount(data.count);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  }, [token]);

  const fetchRecentNotifications = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await apiGet<{ items: NotificationItem[] }>("/api/notifications?limit=5", { token });
      setNotifications(data.items || []);
    } catch (error) {
      console.error("Error fetching recent notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUnreadCount();
    // Poll unread count every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (isOpen) {
      fetchRecentNotifications();
    }
  }, [fetchRecentNotifications, isOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllRead = async () => {
    if (!token) return;
    try {
      await apiPut("/api/notifications/read-all", {}, { token });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      console.error("Error marking all read:", error);
    }
  };

  const markAsRead = async (id: string) => {
    if (!token) return;
    try {
      await apiPut(`/api/notifications/${id}/read`, {}, { token });
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (error) {
      console.error("Error marking notification read:", error);
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return "Vừa xong";
      if (diffMins < 60) return `${diffMins} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      return date.toLocaleDateString("vi-VN", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="focus-ring flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted relative text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Thông báo"
      >
        <BellIcon size={19} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground animate-pulse shadow-md">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-background p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h3 className="text-sm font-black text-foreground">Thông báo gần đây</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
              >
                <Check size={14} />
                Đọc tất cả
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="animate-spin text-primary mb-2" size={24} />
                <span className="text-xs font-bold">Đang tải thông báo...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-xs font-bold text-muted-foreground">
                Không có thông báo nào.
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() => !notification.isRead && markAsRead(notification.id)}
                  disabled={notification.isRead}
                  className={`flex w-full flex-col gap-1 p-3 rounded-lg text-left transition-colors disabled:cursor-default ${
                    notification.isRead ? "hover:bg-muted/50" : "cursor-pointer bg-primary/5 hover:bg-primary/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-xs font-black ${notification.isRead ? "text-foreground" : "text-primary"}`}>
                      {notification.title}
                    </span>
                    {!notification.isRead && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-medium line-clamp-2 leading-relaxed">
                    {notification.message}
                  </p>
                  <span className="text-[10px] text-muted-foreground/75 font-semibold mt-1">
                    {formatTime(notification.createdAt)}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-border pt-2 mt-1">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="block w-full text-center py-2 text-xs font-black text-muted-foreground hover:text-foreground transition-colors hover:bg-muted rounded-lg"
            >
              Xem tất cả thông báo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
