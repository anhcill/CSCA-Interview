import { Suspense } from "react";
import { InterviewResult } from "@/components/interview/interview-result";
import { PageLoadingState } from "@/components/ui/page-state";

export default function InterviewResultPage() {
  return (
    <Suspense fallback={<PageLoadingState description="Đang tải báo cáo phỏng vấn." />}>
      <InterviewResult />
    </Suspense>
  );
}
