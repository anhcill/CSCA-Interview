import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
      <div className="text-6xl">🔍</div>
      <h1 className="text-2xl font-bold text-foreground">404 — Không tìm thấy</h1>
      <p className="max-w-md text-center text-muted-foreground">
        Trang bạn đang tìm không tồn tại hoặc đã bị di chuyển.
      </p>
      <Link
        href="/"
        className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Về trang chủ
      </Link>
    </div>
  );
}
