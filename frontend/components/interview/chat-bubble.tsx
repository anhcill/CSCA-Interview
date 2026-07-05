"use client";

import type { ChatMessage } from "./interview-data";

export function ChatBubble({ message }: { message: ChatMessage }) {
  const isAi = message.author === "ai";
  return (
    <div className={`flex gap-3 items-start ${isAi ? "" : "flex-row-reverse animate-[fade-in_250ms_ease]"}`}>
      {isAi ? (
        <div className="h-8 w-8 shrink-0 rounded-full bg-[#D92C3D] flex items-center justify-center text-white text-[10px] font-extrabold shadow-sm select-none">
          AI
        </div>
      ) : (
        <div className="h-8 w-8 shrink-0 rounded-full bg-[#8C837E] flex items-center justify-center text-white text-[10px] font-extrabold shadow-sm select-none">
          ME
        </div>
      )}
      <div className="flex flex-col gap-1 max-w-[75%]">
        <div className={`rounded-2xl px-4 py-2.5 text-xs font-semibold shadow-sm leading-relaxed ${
          isAi
            ? "bg-[#FDF8F5] border border-[#F0EBE7] text-[#2B231F]"
            : "bg-[#D92C3D] text-white"
        }`}>
          <p className="whitespace-pre-wrap">{message.content}</p>
          {message.translation ? (
            <p className={`mt-1 text-[10px] border-t pt-1 font-semibold leading-normal ${isAi ? "border-[#E8E3DF] text-[#8C837E]" : "border-white/20 text-white/80"}`}>
              {message.translation}
            </p>
          ) : null}
        </div>
        <span className={`text-[8px] font-bold text-[#8C837E] px-1 ${isAi ? "text-left" : "text-right"}`}>{message.time}</span>
      </div>
    </div>
  );
}
