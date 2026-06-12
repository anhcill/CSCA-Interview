import Link from "next/link";
import { PageErrorState } from "@/components/ui/page-state";

export default function NotFound() {
  return (
    <PageErrorState
      title="Không tìm thấy trang"
      description="Đường dẫn này không tồn tại hoặc đã được di chuyển."
      action={(
        <Link href="/dashboard" className="focus-ring inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-black text-white">
          Về dashboard
        </Link>
      )}
    />
  );
}
