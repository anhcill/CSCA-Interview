import { Suspense } from "react";
import { InterviewRoom } from "@/components/interview/interview-room";
import { PageLoadingState } from "@/components/ui/page-state";

export default function InterviewPage() {
  return (
    <Suspense fallback={<PageLoadingState description="Đang tải phòng phỏng vấn." />}>
      <InterviewRoom />
    </Suspense>
  );
}
