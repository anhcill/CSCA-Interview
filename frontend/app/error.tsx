"use client";

import { PageErrorState } from "@/components/ui/page-state";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageErrorState
      title="Không thể tải trang"
      description={error.message || "Có lỗi xảy ra khi xử lý dữ liệu."}
      action={(
        <button type="button" onClick={reset} className="focus-ring inline-flex min-h-10 items-center rounded-lg bg-red-700 px-4 text-sm font-black text-white">
          Thử lại
        </button>
      )}
    />
  );
}
