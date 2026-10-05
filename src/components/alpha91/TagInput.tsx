"use client";

import { useEffect, useMemo, useState } from "react";

function split(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

export function TagInput(props: {
  name?: string;
  defaultTags?: string[] | string | null;
  label?: string;
}) {
  const initial = Array.isArray(props.defaultTags)
    ? props.defaultTags.join(", ")
    : String(props.defaultTags ?? "");

  const [value, setValue] = useState(initial);
  const [suggestions, setSuggestions] = useState<
    Array<{ tag: string; count: number }>
  >([]);

  useEffect(() => {
    fetch("/api/alpha91/tags", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => setSuggestions(json.items ?? []))
      .catch(() => {});
  }, []);

  const current = useMemo(() => split(value), [value]);

  function add(tag: string) {
    if (
      current.some(
        (existing) => existing.toLowerCase() === tag.toLowerCase(),
      )
    ) {
      return;
    }
    setValue([...current, tag].join(", "));
  }

  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">
        {props.label ?? "Tags"}
      </span>
      <input
        name={props.name ?? "tags"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Convention, Halloween, Hosting"
        className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-sm text-white"
      />
      <div className="flex flex-wrap gap-1.5">
        {suggestions
          .filter(
            (item) =>
              !current.some(
                (tag) => tag.toLowerCase() === item.tag.toLowerCase(),
              ),
          )
          .slice(0, 10)
          .map((item) => (
            <button
              key={item.tag}
              type="button"
              onClick={() => add(item.tag)}
              className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-cyan-200"
            >
              + {item.tag}
            </button>
          ))}
      </div>
      <span className="text-[10px] text-slate-600">
        Comma separated · suggestions are based on tags used before.
      </span>
    </label>
  );
}
