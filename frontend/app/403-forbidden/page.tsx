import { ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-red-50 text-red-700">
          <ShieldCheck size={32} />
        </div>
        <p className="mt-6 text-sm font-black uppercase tracking-wide text-red-700">403 Forbidden</p>
        <h1 className="mt-2 text-3xl font-black">Không có quyền truy cập</h1>
        <p className="mt-3 text-sm font-semibold text-slate-500">
          Tài khoản hiện tại không có quyền mở khu vực quản trị.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/dashboard" className="focus-ring inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-black text-white">
            Về Dashboard
          </Link>
          <Link href="/login" className="focus-ring inline-flex min-h-11 items-center rounded-lg border border-border px-5 text-sm font-black">
            Đổi tài khoản
          </Link>
        </div>
      </section>
    </main>
  );
}
