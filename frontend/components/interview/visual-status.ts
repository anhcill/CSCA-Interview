import type { FaceAnalysisStatus } from "@/lib/hooks/use-face-analysis";
import type { VisualCheckState } from "@/lib/visual-analysis";
import type { CameraCheckStatus } from "./camera-check-panel";
import type { VisualMetricsStatus } from "./visual-metrics-panel";

export function getVisualMetricsStatus(status: FaceAnalysisStatus, timestamp: number): VisualMetricsStatus {
  if (status === "error" || status === "unsupported") return "unavailable";
  if (status === "running" && timestamp > 0) return "live";
  return "neutral";
}

export function mapVisualCheckToCameraStatus(check: VisualCheckState, status: FaceAnalysisStatus): CameraCheckStatus {
  if (status === "error" || status === "unsupported") return "unavailable";
  return check;
}
