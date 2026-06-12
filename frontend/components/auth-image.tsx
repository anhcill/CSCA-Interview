"use client";

import Image from "next/image";
import { useState } from "react";

type AuthImageProps = {
  src: string;
  alt: string;
  fileName: string;
  className?: string;
};

export function AuthImage({ src, alt, fileName, className }: AuthImageProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="flex min-h-[260px] w-full items-center justify-center rounded-2xl border border-dashed border-indigo-200 bg-white/55 p-6 text-center">
        <div>
          <p className="text-sm font-extrabold text-[#101a71]">Chưa có ảnh thiết kế</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
            Lưu ảnh bạn gửi vào:
            <br />
            <span className="font-mono text-[#3728df]">frontend/public/auth/{fileName}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={1200}
      height={900}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}
