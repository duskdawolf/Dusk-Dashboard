"use client";

import { useEffect, useState } from "react";

export function Alpha31WhereToFindDuskCard(props: {
  conPrepId: string;
  eventId: string;
  whereToFind: any;
  onChanged: () => Promise<void> | void;
}) {
  const [note, setNote] = useState(props.whereToFind?.manualNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setNote(props.whereToFind?.manualNote ?? "");
  }, [props.whereToFind?.manualNote]);

  async function saveNote() {
    setBusy(true);
    setError("");

    try {
      const res = await fetch(
        `/api/alpha8/con-preps/${props.conPrepId}/records`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            resource: "event",
            id: props.eventId,
            values: {
              find_me_notes: note.trim() || null,
            },
          }),
        },
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Could not save public note.");
      }

      await props.onChanged();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save public note.",
      );
    } finally {
      setBusy(false);
    }
  }

  const lines: string[] = props.whereToFind?.publicLines ?? [];

  return (
    <div className="grid gap-4">
      <div>
        <div className="text-base font-black text-white">
          Where to Find Dusk
        </div>
        <div className="mt-1 text-xs leading-5 text-slate-500">
          This is the canonical public appearance data used here and by
          Next Stop.
        </div>
      </div>

      <div className="grid gap-2">
        {lines.map((line, index) => (
          <div
            key={`${line}-${index}`}
            className="rounded-xl border border-white/8 bg-white/[0.025] px-3 py-3 text-sm leading-6 text-slate-300"
          >
            {line}
          </div>
        ))}
      </div>

      <label className="grid gap-1.5">
        <span className="text-[11px] font-black uppercase tracking-[.16em] text-cyan-300">
          Additional public note
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Usually around the lobby after programming…"
          className="min-h-20 rounded-xl border border-white/10 bg-[#07101b] p-3 text-sm text-white outline-none"
        />
        <span className="text-[10px] text-slate-600">
          Schedule appearances stay structured above. Use this only for
          useful general guidance.
        </span>
      </label>

      <button
        type="button"
        disabled={busy}
        onClick={saveNote}
        className="w-fit rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-xs font-black text-cyan-200 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save public note"}
      </button>

      {error ? (
        <div className="rounded-xl bg-red-400/10 p-3 text-xs text-red-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}
