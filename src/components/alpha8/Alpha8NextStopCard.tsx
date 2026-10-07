"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

function ValidationBadge({
  state,
}: {
  state: any;
}) {
  if (!state.imageUrl) return null;

  if (state.validationStatus === "passed") {
    return (
      <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-200">
        Copy checked ✓
      </span>
    );
  }

  if (state.validationStatus === "failed") {
    return (
      <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-100">
        Text check needs review
      </span>
    );
  }

  return (
    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
      Not validated
    </span>
  );
}

export function Alpha8NextStopCard({
  eventId,
}: {
  eventId: string;
}) {
  const [state, setState] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/events/${eventId}/next-stop`,
      { cache: "no-store" },
    );

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error ?? "Could not load Next Stop");
    }

    setState(json);
  }, [eventId]);

  useEffect(() => {
    setState(null);
    load().catch((e) => setError(e.message));
  }, [load]);

  async function run(
    action: string,
    extra: Record<string, unknown> = {},
  ) {
    setBusy(action);
    setError("");

    try {
      const res = await fetch(
        `/api/events/${eventId}/next-stop`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        },
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Generation failed");
      }

      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Generation failed",
      );
    } finally {
      setBusy(null);
    }
  }

  if (!state) {
    return (
      <div className="text-sm text-slate-500">
        Loading Next Stop tools…
      </div>
    );
  }

  const validation = state.validation;
  const hasBackground = Boolean(state.backgroundUrl);
  const hasFinal = Boolean(state.imageUrl);

  return (
    <div id="alpha8-next-stop" className="grid gap-5">
      <div>
        <div className="text-sm font-black text-white">
          Dusk&apos;s Next Stop
        </div>
        <div className="mt-1 text-xs leading-5 text-slate-500">
          Alpha v30 · OpenAI designs the finished poster directly over
          the saved background.
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
        <input
          type="checkbox"
          checked={Boolean(state.allowAiWording)}
          disabled={Boolean(busy)}
          onChange={(e) =>
            run("update_settings", {
              allowAiWording: e.target.checked,
            })
          }
          className="mt-0.5"
        />
        <span className="min-w-0">
          <span className="block text-xs font-black text-white">
            Let AI change wording?
          </span>
          <span className="mt-1 block text-[11px] leading-4 text-slate-500">
            {state.allowAiWording
              ? "ON — AI may shorten/rewrite for design, but facts cannot change."
              : "OFF — visible wording must use the app-provided copy exactly."}
          </span>
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.16em] text-violet-300">
                Saved Background
              </div>
              <div className="mt-1 text-[10px] text-slate-600">
                {hasBackground
                  ? "Reusable · brand references are not resent for final rebuilds"
                  : "Not generated yet"}
              </div>
            </div>
          </div>

          {hasBackground ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.backgroundUrl}
              alt="Saved Next Stop background"
              className="mt-3 aspect-[9/16] w-full rounded-xl border border-white/10 object-cover"
            />
          ) : (
            <div className="mt-3 grid aspect-[9/16] place-items-center rounded-xl border border-dashed border-white/10 text-center text-xs text-slate-600">
              New backgrounds use the 3 selected brand references.
            </div>
          )}

          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() =>
              run(
                hasFinal
                  ? "refresh_all"
                  : hasBackground
                    ? "refresh_all"
                    : "generate_background",
              )
            }
            className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-black text-white disabled:opacity-50"
          >
            {busy === "generate_background" ||
            busy === "refresh_all"
              ? "Generating…"
              : hasBackground
                ? "New Background"
                : "Generate Background"}
          </button>
        </section>

        <section className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-300">
                Final Poster
              </div>
              <div className="mt-1 text-[10px] text-slate-600">
                {state.stale
                  ? "Needs rebuild"
                  : hasFinal
                    ? "Current"
                    : "Not generated yet"}
              </div>
            </div>
            <ValidationBadge state={state} />
          </div>

          {hasFinal ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.imageUrl}
              alt="Current Next Stop poster"
              className="mt-3 aspect-[9/16] w-full rounded-xl border border-white/10 object-cover"
            />
          ) : (
            <div className="mt-3 grid aspect-[9/16] place-items-center rounded-xl border border-dashed border-white/10 px-4 text-center text-xs leading-5 text-slate-600">
              OpenAI will render the full typography, cards, and information
              layout.
            </div>
          )}

          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() =>
              run(
                hasBackground
                  ? "generate_card_from_background"
                  : "generate",
              )
            }
            className="mt-3 w-full rounded-xl bg-cyan-300 px-3 py-2.5 text-xs font-black text-slate-950 disabled:opacity-50"
          >
            {busy === "generate_card_from_background" ||
            busy === "generate"
              ? "Rendering…"
              : hasFinal
                ? "Rebuild Final Poster"
                : "Generate Final Poster"}
          </button>
        </section>
      </div>

      {state.copy?.findMeItems?.length ? (
        <div className="rounded-xl bg-white/[0.035] p-3">
          <div className="text-[11px] font-black uppercase tracking-[.16em] text-cyan-300">
            How to Find Dusk data
          </div>
          <div className="mt-2 text-xs leading-5 text-slate-300">
            {state.copy.findMeItems.slice(0, 5).join(" · ")}
          </div>
        </div>
      ) : null}

      {validation && !validation.passed ? (
        <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.06] p-3">
          <div className="text-[11px] font-black uppercase tracking-[.16em] text-amber-200">
            Text/fact validation
          </div>
          <div className="mt-2 text-xs leading-5 text-amber-50/80">
            The renderer already attempted one automatic correction pass.
            Review the poster before posting.
          </div>

          {validation.missingText?.length ? (
            <div className="mt-2 text-[11px] text-slate-400">
              Missing: {validation.missingText.join(" · ")}
            </div>
          ) : null}

          {validation.incorrectText?.length ? (
            <div className="mt-1 text-[11px] text-slate-400">
              Changed text: {validation.incorrectText.join(" · ")}
            </div>
          ) : null}

          {validation.factualErrors?.length ? (
            <div className="mt-1 text-[11px] text-slate-400">
              Fact issues: {validation.factualErrors.join(" · ")}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl bg-red-400/10 p-3 text-xs text-red-200">
          {error}
        </div>
      ) : null}

      {hasFinal ? (
        <a
          href={`/api/events/${eventId}/next-stop/download`}
          className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-3 py-2.5 text-center text-xs font-black text-cyan-200"
        >
          Download Image
        </a>
      ) : null}

      <Link
        href="/dashboard/settings/brand"
        className="text-xs font-bold text-violet-300 hover:text-violet-200"
      >
        Brand & media settings →
      </Link>
    </div>
  );
}
