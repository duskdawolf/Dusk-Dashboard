"use client";

import { useState } from "react";
import {
  MediaLibraryPicker,
  type MediaLibraryItem,
} from "@/components/media/MediaLibraryPicker";

export function CaseStudyMediaManager(props: {
  eventId: string;
  attachments: any[];
  onChanged: () => Promise<void> | void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState("");

  async function attach(item: MediaLibraryItem) {
    setError("");
    const res = await fetch(`/api/alpha92/events/${props.eventId}/media`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mediaId: item.id }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not attach media.");
    await props.onChanged();
  }

  async function patch(
    attachmentId: string,
    values: Record<string, unknown>,
  ) {
    const res = await fetch(`/api/alpha92/events/${props.eventId}/media`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attachmentId, ...values }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not update media.");
    await props.onChanged();
  }

  async function remove(attachment: any) {
    if (
      !window.confirm(
        `Remove "${attachment.media?.title ?? "this media"}" from the Case Study? The library file will not be deleted.`,
      )
    ) {
      return;
    }

    const res = await fetch(`/api/alpha92/events/${props.eventId}/media`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attachmentId: attachment.id }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not detach media.");
    await props.onChanged();
  }

  async function move(index: number, direction: -1 | 1) {
    const otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= props.attachments.length) return;

    const current = props.attachments[index];
    const other = props.attachments[otherIndex];

    await Promise.all([
      patch(current.id, { sort_order: other.sort_order }),
      patch(other.id, { sort_order: current.sort_order }),
    ]);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-black text-white">Case Study Media</div>
          <div className="mt-1 text-xs text-slate-500">
            Assets stay in Media Library; this only attaches them to this event.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded-xl bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950"
        >
          + Add Media
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {props.attachments.map((attachment, index) => {
          const media = attachment.media;
          return (
            <article
              key={attachment.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]"
            >
              {media?.kind === "video" ? (
                <video
                  src={media.url}
                  controls
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <img
                  src={media?.url}
                  alt={media?.alt_text || media?.title || "Case study media"}
                  className="aspect-square w-full object-cover"
                />
              )}

              <div className="grid gap-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-black text-white">
                      {media?.title ?? "Media"}
                    </div>
                    {attachment.featured ? (
                      <div className="mt-1 text-[10px] font-black uppercase tracking-wider text-cyan-300">
                        Featured
                      </div>
                    ) : null}
                  </div>
                </div>

                <input
                  defaultValue={
                    attachment.caption_override ?? media?.caption ?? ""
                  }
                  placeholder="Case Study caption"
                  onBlur={(e) =>
                    patch(attachment.id, {
                      caption_override: e.currentTarget.value,
                    }).catch((err) => setError(err.message))
                  }
                  className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-[11px] text-slate-200"
                />

                <div className="flex flex-wrap gap-1">
                  {!attachment.featured && media?.kind === "image" ? (
                    <button
                      type="button"
                      onClick={() =>
                        patch(attachment.id, { featured: true }).catch((err) =>
                          setError(err.message),
                        )
                      }
                      className="rounded-lg bg-cyan-300/10 px-2 py-1 text-[10px] font-bold text-cyan-200"
                    >
                      Feature
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() =>
                      move(index, -1).catch((err) => setError(err.message))
                    }
                    className="rounded-lg bg-white/[0.05] px-2 py-1 text-[10px] font-bold text-slate-300 disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={index === props.attachments.length - 1}
                    onClick={() =>
                      move(index, 1).catch((err) => setError(err.message))
                    }
                    className="rounded-lg bg-white/[0.05] px-2 py-1 text-[10px] font-bold text-slate-300 disabled:opacity-30"
                  >
                    →
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      remove(attachment).catch((err) => setError(err.message))
                    }
                    className="rounded-lg bg-red-400/10 px-2 py-1 text-[10px] font-bold text-red-200"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {!props.attachments.length ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
          No Case Study media yet. Pick from Media Library or upload a new asset
          from inside the picker.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <MediaLibraryPicker
        open={pickerOpen}
        title="Add Media to Case Study"
        onClose={() => setPickerOpen(false)}
        onSelect={(item) =>
          attach(item).catch((err) => setError(err.message))
        }
      />
    </div>
  );
}
