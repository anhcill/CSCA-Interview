"use client";

import { Check, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { fetchSchools, type SchoolDto } from "@/lib/schools-client";

type SchoolComboboxProps = {
  className?: string;
  inputClassName?: string;
  label: string;
  onChange: (value: string, school?: SchoolDto) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
};

export function SchoolCombobox({
  className = "",
  inputClassName = "",
  label,
  onChange,
  placeholder = "Tìm trường theo tên Việt/Anh/Trung...",
  required = false,
  value
}: SchoolComboboxProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<SchoolDto[]>([]);
  const [search, setSearch] = useState(value);
  const debouncedSearch = useDebouncedValue(search, 250);

  useEffect(() => {
    if (!isFocused) setSearch(value);
  }, [isFocused, value]);

  useEffect(() => {
    let ignore = false;
    const term = debouncedSearch.trim();

    setIsLoading(true);
    fetchSchools({ limit: 10, search: term })
      .then((response) => {
        if (!ignore) setOptions(response.data);
      })
      .catch(() => {
        if (!ignore) setOptions([]);
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [debouncedSearch]);

  const selectedName = useMemo(() => {
    return options.find((school) => school.name === value || school.nameEn === value || school.nameZh === value)?.name ?? value;
  }, [options, value]);

  function handleSelect(school: SchoolDto) {
    setSearch(school.name);
    setIsFocused(false);
    onChange(school.name, school);
  }

  return (
    <label className={`relative block ${className}`}>
      <span className="text-sm font-black text-[#102456]">
        {label}{required ? " *" : ""}
      </span>
      <span className="relative mt-2 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6a7891]" />
        <input
          value={isFocused ? search : selectedName}
          onBlur={() => window.setTimeout(() => setIsFocused(false), 120)}
          onChange={(event) => {
            setSearch(event.target.value);
            setIsFocused(true);
            onChange(event.target.value);
          }}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          className={`h-12 w-full rounded-xl border border-[#d8e3f2] bg-white pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-[#0a347d] ${inputClassName}`}
        />
      </span>

      {isFocused ? (
        <div className="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-auto rounded-xl border border-[#d8e3f2] bg-white p-2 shadow-[0_18px_48px_rgba(15,23,42,0.16)]">
          {isLoading ? (
            <p className="px-3 py-2 text-sm font-bold text-[#6a7891]">Đang tìm trường...</p>
          ) : options.length ? (
            options.map((school) => (
              <button
                key={school.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(school)}
                className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-[#f4f8ff]"
              >
                <span>
                  <span className="block text-sm font-black text-[#102456]">{school.name}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-[#6a7891]">{schoolSubtitle(school)}</span>
                </span>
                {school.name === value ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : null}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm font-bold text-[#6a7891]">Không có trường phù hợp. Bạn vẫn có thể gõ tên thủ công.</p>
          )}
        </div>
      ) : null}
    </label>
  );
}

function schoolSubtitle(school: SchoolDto) {
  return [school.nameZh, school.nameEn, school.city, school.province].filter(Boolean).join(" • ") || "Chưa có thông tin thêm";
}
