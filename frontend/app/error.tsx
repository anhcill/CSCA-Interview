"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
      <div className="text-6xl">💥</div>
      <h1 className="text-2xl font-bold text-foreground">Đã xảy ra lỗi</h1>
      <p className="max-w-md text-center text-muted-foreground">
        {error.message || "Một lỗi không xác định đã xảy ra. Vui lòng thử lại."}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">Mã lỗi: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Thử lại
        </button>
        <Link
          href="/"
          className="rounded-md border border-border px-6 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
