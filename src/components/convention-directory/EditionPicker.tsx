"use client";
import { useEffect, useState } from "react";
import type { PublicEdition } from "@/lib/convention-directory/model";
import { ConventionInformation } from "./ConventionInformation";

export function EditionPicker({
  selected,
  onSelect,
}: {
  selected: PublicEdition | null;
  onSelect: (edition: PublicEdition | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [editions, setEditions] = useState<PublicEdition[]>([]);
  const [series, setSeries] = useState<{ id: string; name: string }[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/convention-directory?q=${encodeURIComponent(query)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setEditions(data.editions);
        setSeries(data.series);
      } catch (e) {
        if (!controller.signal.aborted)
          setMessage(e instanceof Error ? e.message : "Search failed");
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, reload]);
  async function refresh(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/convention-directory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seriesId: id }),
      });
      const data = await response.json();
      setMessage(data.message || data.error);
      setReload((r) => r + 1);
      if (selected) {
        const res = await fetch(
          `/api/convention-directory?q=${encodeURIComponent(selected.name)}`,
          { cache: "no-store" },
        );
        const result = await res.json();
        if (res.ok)
          onSelect(
            result.editions.find((e: PublicEdition) => e.id === selected.id) ??
              selected,
          );
      }
    } catch {
      setMessage(
        "Refresh failed. Last verified directory facts remain available.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-3 rounded-2xl border border-cyan-300/20 p-4">
      <label className="grid gap-2">
        Search official Convention Directory
        <input
          aria-label="Search official Convention Directory"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Convention name or year"
          className="w-full rounded-xl border border-white/10 bg-[#07101b] p-3 text-white"
        />
      </label>
      <select
        aria-label="Official Convention Edition"
        value={selected?.id ?? ""}
        onChange={(e) =>
          onSelect(editions.find((d) => d.id === e.target.value) ?? null)
        }
        className="w-full rounded-xl border border-white/10 bg-[#07101b] p-3 text-white"
      >
        <option value="">Select an official edition</option>
        {selected && !editions.some((e) => e.id === selected.id) ? (
          <option value={selected.id}>{selected.name}</option>
        ) : null}
        {editions.map((e) => (
          <option
            key={e.id}
            value={e.id}
            disabled={!e.start_at || e.status === "cancelled"}
          >
            {e.name} · {e.start_at?.slice(0, 10) || "Dates TBA"} ·{" "}
            {e.location || "Location TBA"}
            {e.status === "cancelled" ? " · Cancelled" : ""}
          </option>
        ))}
      </select>
      {selected ? (
        <>
          <ConventionInformation edition={selected} />
          <button
            type="button"
            disabled={busy}
            className="button-secondary"
            onClick={() => refresh(selected.series_id)}
          >
            {busy ? "Checking…" : "Check official source for updates"}
          </button>
        </>
      ) : null}
      {!editions.length ? (
        <p className="text-sm text-slate-400">
          No verified edition matches. Request a source check below, or ask a
          directory administrator to review it.
        </p>
      ) : null}
      {!selected
        ? series.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={busy}
              onClick={() => refresh(s.id)}
              className="button-secondary"
            >
              Check for editions: {s.name}
            </button>
          ))
        : null}
      {message ? (
        <p role="status" className="text-sm text-cyan-200">
          {message}
        </p>
      ) : null}
    </div>
  );
}
