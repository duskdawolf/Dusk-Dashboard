"use client";

import { useState } from "react";

export function QuoteForm() {
  const [status, setStatus] = useState<string>("");

  async function submit(formData: FormData) {
    setStatus("Submitting...");
    const payload = {
      name: String(formData.get("name") ?? ""),
      contact: String(formData.get("contact") ?? ""),
      stickerType: String(formData.get("stickerType") ?? ""),
      quantity: Number(formData.get("quantity") ?? 0),
      size: String(formData.get("size") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    };

    const response = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json();
    setStatus(response.ok ? body.message : body.error ?? "Something went wrong.");
  }

  return (
    <form action={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="form-label">Name<input name="name" className="form-input" required /></label>
        <label className="form-label">Email or Telegram<input name="contact" className="form-input" required /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="form-label">Sticker type
          <select name="stickerType" className="form-input"><option>Kiss-cut</option><option>Die-cut</option><option>Holographic</option><option>Specialty</option></select>
        </label>
        <label className="form-label">Quantity
          <select name="quantity" className="form-input"><option value="25">25</option><option value="50">50</option><option value="100">100</option><option value="250">250+</option></select>
        </label>
      </div>
      <label className="form-label">Size<select name="size" className="form-input"><option>2 in</option><option>3 in</option><option>4 in</option><option>Custom</option></select></label>
      <label className="form-label">Project notes<textarea name="notes" className="form-input min-h-32" /></label>
      <div className="flex flex-wrap items-center gap-4">
        <button className="button-primary" type="submit">Request quote</button>
        <span className="text-sm text-slate-400">{status}</span>
      </div>
    </form>
  );
}
