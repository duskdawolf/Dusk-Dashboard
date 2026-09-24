"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  ReviewPlatform,
  SocialReview,
  SocialReviewSubmission,
} from "@/lib/social/review-types";

export type SocialReviewApplyPatch = {
  masterCaption?: string;
  platformCaption?: { platform: ReviewPlatform; caption: string };
  mediaOrder?: string[];
  platformSchedule?: { platform: ReviewPlatform; scheduledAt: string };
  includeDeploymentLink?: boolean;
};

function label(platform: ReviewPlatform) {
  if (platform === "twitter") return "X";
  if (platform === "instagram") return "Instagram";
  if (platform === "telegram") return "Telegram";
  return "Bluesky";
}

function niceTime(iso: string | null) {
  if (!iso) return "No timing recommendation";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function SocialReviewModal({
  open,
  onClose,
  submission,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  submission: SocialReviewSubmission | null;
  onApply: (patch: SocialReviewApplyPatch) => void;
}) {
  const [review, setReview] = useState<SocialReview | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);

  const submissionKey = useMemo(
    () => (submission ? JSON.stringify(submission) : ""),
    [submission],
  );

  useEffect(() => {
    setReview(null);
    setThreadId(null);
    setStatus("");
    setQuestion("");
    setChat([]);
  }, [submissionKey]);

  useEffect(() => {
    if (open && submission && !review && !busy) {
      void runReview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function runReview(followup?: string) {
    if (!submission || busy) return;

    setBusy(true);
    setStatus(
      followup
        ? "Chaos is revising the review..."
        : "Chaos is reviewing wording, timing, media, and reach...",
    );

    const response = await fetch("/api/admin/social/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submission,
        threadId,
        question: followup || null,
        existingReview: followup && review ? review : null,
      }),
    });

    const body = await response.json();
    setBusy(false);

    if (!response.ok) {
      setStatus(body.error ?? "Chaos Social Review failed.");
      return;
    }

    setThreadId(body.threadId);
    setReview(body.review);

    if (followup) {
      setChat((current) => [
        ...current,
        { role: "user", text: followup },
        {
          role: "assistant",
          text: body.review?.chatReply || body.review?.summary || "Review updated.",
        },
      ]);
    }

    setStatus(
      body.performance?.webUsed
        ? "Dusk data was sparse in at least one area, so Chaos also used online guidance and labeled it below."
        : body.review?.dataBasis?.mode === "dusk"
          ? "Review based on Dusk-specific performance history."
          : "Review complete. Sparse areas are labeled with lower confidence.",
    );
  }

  async function sendFollowup(event: FormEvent) {
    event.preventDefault();
    const value = question.trim();
    if (!value) return;
    setQuestion("");
    await runReview(value);
  }

  function applyAll() {
    if (!review) return;
    onApply({ masterCaption: review.wording.recommendedMasterCaption });
    if (review.media.recommendedOrder.length) {
      onApply({ mediaOrder: review.media.recommendedOrder });
    }
    for (const item of review.platformReviews) {
      onApply({
        platformCaption: {
          platform: item.platform,
          caption: item.recommendedCaption,
        },
      });
      if (item.recommendedScheduledAt) {
        onApply({
          platformSchedule: {
            platform: item.platform,
            scheduledAt: item.recommendedScheduledAt,
          },
        });
      }
    }
    const linkVotes = review.platformReviews.filter((item) => item.includeDeploymentLink).length;
    if (review.platformReviews.length) {
      onApply({ includeDeploymentLink: linkVotes >= Math.ceil(review.platformReviews.length / 2) });
    }
  }

  if (!open || !submission) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto max-w-7xl rounded-3xl border border-dusk-aqua/20 bg-[#07101b] shadow-2xl">
        <div className="sticky top-0 z-20 flex flex-wrap items-start justify-between gap-4 rounded-t-3xl border-b border-white/10 bg-[#07101b]/95 p-5 backdrop-blur">
          <div>
            <div className="eyebrow">Pre-publication review</div>
            <h2 className="text-3xl font-black">CHAOS COPILOT™ · SOCIAL REVIEW</h2>
            <p className="mt-1 text-sm text-slate-500">
              {submission.title} · suggestions only — Review never publishes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {review ? (
              <button className="button-primary" type="button" onClick={applyAll}>
                Apply All Suggestions
              </button>
            ) : null}
            <button className="button-secondary" type="button" disabled={busy} onClick={() => void runReview()}>
              Re-review
            </button>
            <button className="button-secondary" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-[.8fr_1.2fr]">
          <aside className="space-y-4">
            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="eyebrow">Your submission</div>
              <h3 className="mt-1 font-black">{submission.title}</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">
                {submission.masterCaption}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {submission.platforms.map((item) => (
                  <span className="tag !mt-0" key={item.platform}>{label(item.platform)}</span>
                ))}
              </div>
              <dl className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Media</dt><dd>{submission.mediaIds.length}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Base schedule</dt><dd className="text-right">{submission.scheduledAt ? new Date(submission.scheduledAt).toLocaleString() : "Not scheduled"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Deployment link</dt><dd>{submission.includeDeploymentLink ? "Included" : "Off"}</dd></div>
              </dl>
            </section>

            {review ? (
              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <div className="eyebrow">Evidence basis</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="tag !mt-0">{review.dataBasis.mode}</span>
                  <span className="tag !mt-0">{review.dataBasis.confidence} confidence</span>
                  <span className="tag !mt-0">{review.dataBasis.internalSamples} Dusk samples</span>
                </div>
                <p className="mt-3 text-sm text-slate-400">{review.dataBasis.explanation}</p>

                {review.webUsed ? (
                  <div className="mt-4 rounded-xl border border-dusk-gold/20 bg-dusk-gold/5 p-3 text-xs text-slate-300">
                    Online guidance was used because Dusk-specific data was sparse. Recommendations that depend on it are labeled <strong>web</strong>.
                  </div>
                ) : null}

                {review.sources?.length ? (
                  <div className="mt-4 space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">Online sources</div>
                    {review.sources.map((source) => (
                      <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block truncate text-xs font-bold text-dusk-aqua">
                        {source.title} ↗
                      </a>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className="rounded-2xl border border-dusk-aqua/15 bg-dusk-aqua/5 p-4">
              <div className="eyebrow">Ask about this review</div>
              {chat.length ? (
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                  {chat.map((item, index) => (
                    <div key={`${item.role}-${index}`} className={`rounded-xl p-3 text-sm ${item.role === "user" ? "ml-5 bg-white/[0.05]" : "mr-5 border border-dusk-aqua/10 bg-black/15"}`}>
                      <div className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-600">{item.role === "user" ? "You" : "Chaos"}</div>
                      <div className="whitespace-pre-wrap text-slate-300">{item.text}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Ask why a time was chosen, keep your wording but change timing, or tell Chaos to make one platform more chaotic.
                </p>
              )}
              <form className="mt-3 space-y-2" onSubmit={sendFollowup}>
                <textarea className="form-input min-h-20" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Why later on Instagram? Keep my original wording but optimize timing..." />
                <button className="button-primary" type="submit" disabled={busy || !question.trim()}>{busy ? "Reviewing..." : "Ask Chaos"}</button>
              </form>
            </section>
          </aside>

          <main className="space-y-4">
            {busy && !review ? (
              <div className="panel"><div className="eyebrow">Reviewing</div><p className="mt-2 text-slate-400">{status}</p></div>
            ) : null}

            {review ? (
              <>
                <section className="rounded-2xl border border-dusk-aqua/20 bg-dusk-aqua/5 p-5">
                  <div className="eyebrow">Chaos verdict</div>
                  <h3 className="mt-1 text-2xl font-black">{review.summary}</h3>
                  <p className="mt-3 text-sm text-slate-300">{review.reachAssessment}</p>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div><div className="eyebrow">Wording</div><h3 className="text-xl font-black">Master caption</h3></div>
                    <button className="button-primary" type="button" onClick={() => onApply({ masterCaption: review.wording.recommendedMasterCaption })}>Apply Revision</button>
                  </div>
                  <p className="mt-3 text-sm text-slate-400">{review.wording.assessment}</p>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-black/15 p-4"><div className="text-[10px] font-black uppercase tracking-widest text-slate-600">Yours</div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">{submission.masterCaption}</p></div>
                    <div className="rounded-xl border border-dusk-aqua/20 bg-dusk-aqua/5 p-4"><div className="text-[10px] font-black uppercase tracking-widest text-dusk-aqua">Chaos</div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{review.wording.recommendedMasterCaption}</p></div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">{review.wording.reason}</p>
                </section>

                <section className="space-y-3">
                  <div><div className="eyebrow">Platform fit + timing</div><h3 className="text-xl font-black">Per-platform review</h3></div>
                  {review.platformReviews.map((item) => {
                    const original = submission.platforms.find((row) => row.platform === item.platform)?.captionOverride || submission.masterCaption;
                    const currentTime = submission.platforms.find((row) => row.platform === item.platform)?.scheduledAt || submission.scheduledAt || null;
                    return (
                      <div key={item.platform} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div><strong className="text-xl">{label(item.platform)}</strong><p className="mt-1 text-sm text-slate-400">{item.verdict}</p></div>
                          <div className="flex flex-wrap gap-2"><span className="tag !mt-0">{item.timingBasis} timing</span><span className="tag !mt-0">{item.confidence} confidence</span></div>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <div className="rounded-xl border border-white/10 p-3"><div className="text-[10px] font-black uppercase tracking-widest text-slate-600">Current</div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">{original}</p></div>
                          <div className="rounded-xl border border-dusk-aqua/20 bg-dusk-aqua/5 p-3">
                            <div className="flex items-center justify-between gap-3"><div className="text-[10px] font-black uppercase tracking-widest text-dusk-aqua">Suggested</div><button className="text-xs font-black text-dusk-aqua" type="button" onClick={() => onApply({ platformCaption: { platform: item.platform, caption: item.recommendedCaption } })}>Apply wording</button></div>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{item.recommendedCaption}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-white/10 p-3">
                            <div className="text-xs font-black">Timing</div>
                            <div className="mt-1 text-xs text-slate-500">Current: {niceTime(currentTime)}</div>
                            <div className="mt-1 text-sm text-slate-300">Chaos: {niceTime(item.recommendedScheduledAt)}</div>
                            <p className="mt-2 text-xs text-slate-500">{item.timingRationale}</p>
                            {item.recommendedScheduledAt ? (
                              <button className="button-secondary mt-3" type="button" onClick={() => onApply({ platformSchedule: { platform: item.platform, scheduledAt: item.recommendedScheduledAt! } })}>Use {label(item.platform)} time</button>
                            ) : null}
                          </div>
                          <div className="rounded-xl border border-white/10 p-3">
                            <div className="text-xs font-black">Media + deployment link</div>
                            <p className="mt-2 text-xs text-slate-400">{item.mediaAdvice}</p>
                            <p className="mt-2 text-xs text-slate-500">{item.includeDeploymentLink ? "Use deployment link" : "Skip deployment link"} · {item.deploymentLinkRationale}</p>
                            <button className="button-secondary mt-3" type="button" onClick={() => onApply({ includeDeploymentLink: item.includeDeploymentLink })}>Use link setting globally</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><div className="eyebrow">Media</div><h3 className="text-xl font-black">Order + format</h3></div>
                    {review.media.recommendedOrder.length ? <button className="button-secondary" type="button" onClick={() => onApply({ mediaOrder: review.media.recommendedOrder })}>Apply media order</button> : null}
                  </div>
                  <p className="mt-3 text-sm text-slate-300">{review.media.assessment}</p>
                  <p className="mt-2 text-xs text-slate-500">{review.media.rationale}</p>
                </section>

                {review.quickWins.length ? (
                  <section className="rounded-2xl border border-dusk-gold/20 bg-dusk-gold/5 p-5">
                    <div className="eyebrow">Quick wins</div>
                    <div className="mt-3 space-y-2">{review.quickWins.map((item) => <div key={item} className="rounded-xl border border-white/10 bg-black/10 p-3 text-sm text-slate-300">{item}</div>)}</div>
                  </section>
                ) : null}
              </>
            ) : null}
            {status ? <p className="text-sm text-slate-500">{status}</p> : null}
          </main>
        </div>
      </div>
    </div>
  );
}
