"use client";

import { FormEvent, useState } from "react";

export function CaseStudyEditor(props: {
  eventId: string;
  caseStudy: any;
  onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const data = new FormData(event.currentTarget);
      const res = await fetch(
        `/api/alpha92/events/${props.eventId}/case-study`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            values: {
              title: String(data.get("title") ?? "").trim(),
              status: String(data.get("status") ?? "Draft").trim(),
              challenge: String(data.get("challenge") ?? "").trim(),
              solution: String(data.get("solution") ?? "").trim(),
              outcome: String(data.get("outcome") ?? "").trim(),
              published: data.get("published") === "on",
            },
          }),
        },
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save Case Study.");
      await props.onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save Case Study.");
    } finally {
      setBusy(false);
    }
  }

  const study = props.caseStudy;

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Case Study title
          </span>
          <input
            name="title"
            defaultValue={study?.title ?? ""}
            className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Status
          </span>
          <input
            name="status"
            defaultValue={study?.status ?? "Draft"}
            placeholder="Incident Report Filed"
            className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
          />
        </label>
      </div>

      <label className="grid gap-1.5">
        <span className="text-xs font-black uppercase tracking-wider text-slate-500">
          What happened / challenge
        </span>
        <textarea
          name="challenge"
          defaultValue={study?.challenge ?? ""}
          className="min-h-28 rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs font-black uppercase tracking-wider text-slate-500">
          What Dusk did
        </span>
        <textarea
          name="solution"
          defaultValue={study?.solution ?? ""}
          className="min-h-28 rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs font-black uppercase tracking-wider text-slate-500">
          Outcome / highlights
        </span>
        <textarea
          name="outcome"
          defaultValue={study?.outcome ?? ""}
          className="min-h-28 rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
        />
      </label>

      <label className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-3 text-sm text-slate-300">
        <input
          name="published"
          type="checkbox"
          defaultChecked={Boolean(study?.published)}
        />
        Publish this Case Study in Chaos
      </label>

      {error ? (
        <div className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="w-fit rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save Case Study"}
      </button>
    </form>
  );
}
