"use client";

import { Camera, CheckCircle, Eye, Mic, Sun, Target, XCircle } from "lucide-react";
import type { ComponentType } from "react";

export type CameraCheckStatus = "idle" | "ok" | "warning";

export type CameraSystemChecks = {
  camera: CameraCheckStatus;
  centerFace: CameraCheckStatus;
  faceVisible: CameraCheckStatus;
  lighting: CameraCheckStatus;
  mic: CameraCheckStatus;
};

type CheckConfig = {
  Icon: ComponentType<{ size?: number; className?: string }>;
  key: keyof CameraSystemChecks;
  label: string;
};

const checkConfigs: CheckConfig[] = [
  { Icon: Camera, key: "camera", label: "Camera OK" },
  { Icon: Mic, key: "mic", label: "Mic OK" },
  { Icon: Eye, key: "faceVisible", label: "Face visible" },
  { Icon: Sun, key: "lighting", label: "Lighting" },
  { Icon: Target, key: "centerFace", label: "Center face" }
];

export function CameraCheckPanel({ checks }: { checks: CameraSystemChecks }) {
  const readyCount = checkConfigs.filter((item) => checks[item.key] === "ok").length;

  return (
    <div className="rounded-3xl border border-[#F0EBE7] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#2B231F]">Kiểm tra hệ thống</h3>
          <p className="mt-1 text-[11px] font-bold text-[#8C837E]">{readyCount}/5 tín hiệu sẵn sàng</p>
        </div>
        <span className={`rounded-lg px-2 py-0.5 text-[9px] font-extrabold tracking-wider ${readyCount >= 4 ? "bg-[#EBFDF2] text-[#28A745]" : "bg-[#FFF5E6] text-[#FD7E14]"}`}>
          {readyCount >= 4 ? "Ready" : "Checking"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {checkConfigs.map((item) => (
          <CheckItem key={item.key} config={item} status={checks[item.key]} />
        ))}
      </div>
    </div>
  );
}

function CheckItem({ config, status }: { config: CheckConfig; status: CameraCheckStatus }) {
  const Icon = config.Icon;
  const isOk = status === "ok";
  const isWarning = status === "warning";

  return (
    <div className={`flex min-h-[66px] items-center gap-2 rounded-2xl border p-3 ${isOk ? "border-[#D1F7E2] bg-[#EBFDF2]" : isWarning ? "border-[#FFE0B8] bg-[#FFF5E6]" : "border-[#F0EBE7] bg-[#FCF9F7]"}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${isOk ? "bg-white text-[#28A745]" : isWarning ? "bg-white text-[#FD7E14]" : "bg-white text-[#8C837E]"}`}>
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-extrabold text-[#2B231F]">{config.label}</p>
        <p className={`mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold ${isOk ? "text-[#28A745]" : isWarning ? "text-[#FD7E14]" : "text-[#8C837E]"}`}>
          {isOk ? <CheckCircle size={11} /> : <XCircle size={11} />}
          {isOk ? "OK" : isWarning ? "Cần chỉnh" : "Đang chờ"}
        </p>
      </div>
    </div>
  );
}
