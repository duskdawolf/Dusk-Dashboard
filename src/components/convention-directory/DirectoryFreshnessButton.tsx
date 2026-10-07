"use client";
import { useState } from "react";

export function DirectoryFreshnessButton({
  seriesId,
  onRefreshed,
}: {
  seriesId: string;
  onRefreshed: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div className="my-3">
      <button
        className="button-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await fetch("/api/convention-directory", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ seriesId }),
            });
            const json = await res.json();
            setMessage(json.message || json.error);
            if (res.ok) await onRefreshed();
          } catch {
            setMessage(
              "Refresh failed. Last verified official facts remain available.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Checking official source…"
          : "Check official information for updates"}
      </button>
      <p role="status" className="mt-2 text-sm text-slate-400">
        {message}
      </p>
    </div>
  );
}
