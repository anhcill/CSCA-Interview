"use client";

import dynamic from "next/dynamic";
import { PageLoadingState } from "@/components/ui/page-state";

const DashboardClient = dynamic(() => import("./dashboard-client"), {
  loading: () => <DashboardLoading />,
  ssr: false
});

export function DashboardClientEntry() {
  return <DashboardClient />;
}

function DashboardLoading() {
  return <PageLoadingState description="Đang đồng bộ dashboard và tiến độ luyện tập của bạn." />;
}
