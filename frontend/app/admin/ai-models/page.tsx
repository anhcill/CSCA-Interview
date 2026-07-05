"use client";

import { Bot, Settings } from "lucide-react";
import Link from "next/link";
import { AiModelRouterPanel } from "@/components/admin/ai-model-router-panel";
import { getAuthToken } from "@/lib/auth-client";

export default function AdminAiModelsPage() {
  const token = getAuthToken();

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-center">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-indigo-600 hover:underline">&larr; Admin</Link>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold">
            <Bot size={24} />
            Model AI theo chức năng
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Chọn provider và model riêng cho tạo câu hỏi, hỏi tiếp, chấm điểm và phân tích Study Plan. Audio vẫn giữ OpenAI STT/TTS.
          </p>
        </div>
        <Link href="/admin/settings" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
          <Settings size={16} />
          Settings khác
        </Link>
      </div>

      <AiModelRouterPanel token={token} />
    </main>
  );
}
