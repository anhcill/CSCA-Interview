"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearAuthSession, logoutAccount } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);

    try {
      await logoutAccount();
    } catch {
      clearAuthSession();
    } finally {
      router.replace("/login");
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
    >
      <LogOut size={16} />
      {isLoading ? "Đang đăng xuất..." : "Đăng xuất"}
    </button>
  );
}
