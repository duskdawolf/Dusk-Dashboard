"use client";

import Link from "next/link";
import { useState } from "react";
import {
  MediaLibraryPicker,
  type MediaLibraryItem,
} from "./MediaLibraryPicker";

export function BrandMediaImportPage() {
  const [assetKind, setAssetKind] = useState<
    "mascot_art" | "logo" | "style_ref"
  >("mascot_art");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function select(item: MediaLibraryItem) {
    setError("");
    setMessage("");
    const res = await fetch("/api/alpha91/brand-from-media", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mediaId: item.id,
        assetKind,
        label: item.title,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not create brand asset.");
    setMessage(
      `"${item.title}" was added to Brand Reference Assets. You can now select it in Brand & Media settings.`,
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 p-5 md:p-8">
      <header>
        <div className="text-xs font-black uppercase tracking-[.2em] text-pink-300">
          Brand & Media
        </div>
        <h1 className="mt-1 text-3xl font-black text-white">
          Use Media Library Asset
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Promote an existing library image into Dusk&apos;s Brand Reference
          Assets without uploading it again.
        </p>
      </header>

      <section className="grid gap-4 rounded-3xl border border-white/10 bg-[#0c1727] p-5">
        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Brand role
          </span>
          <select
            value={assetKind}
            onChange={(e) => setAssetKind(e.target.value as any)}
            className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
          >
            <option value="mascot_art">Dusk mascot art</option>
            <option value="logo">Dusk Induskries logo</option>
            <option value="style_ref">Style reference</option>
          </select>
        </label>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-fit rounded-xl bg-pink-400 px-4 py-2.5 text-sm font-black text-white"
        >
          Choose from Media Library
        </button>

        {message ? (
          <div className="rounded-xl bg-cyan-300/10 p-3 text-sm text-cyan-100">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </section>

      <div className="flex gap-2">
        <Link
          href="/dashboard/media"
          className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black text-slate-300"
        >
          Media Library
        </Link>
        <Link
          href="/dashboard/settings/brand"
          className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black text-slate-300"
        >
          Brand Settings
        </Link>
      </div>

      <MediaLibraryPicker
        open={pickerOpen}
        kind="image"
        title="Choose Brand Image"
        onClose={() => setPickerOpen(false)}
        onSelect={(item) =>
          select(item).catch((e) => setError(e.message))
        }
      />
    </main>
  );
}
