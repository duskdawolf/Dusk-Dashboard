"use client";

import { FormEvent, useMemo, useState } from "react";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  start_at: string;
  location: string | null;
};

type StudyRow = {
  id: string;
  event_id: string | null;
  slug: string;
  title: string;
  image_url: string;
  status: string;
  challenge: string;
  solution: string;
  outcome: string;
  published: boolean;
};

export function CaseStudyManager({
  events,
  initialStudies,
}: {
  events: EventRow[];
  initialStudies: StudyRow[];
}) {
  const [studies, setStudies] = useState(initialStudies);
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? "");
  const [status, setStatus] = useState("");

  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const existing = useMemo(
    () =>
      studies.find(
        (study) =>
          study.event_id === selectedEventId ||
          study.slug === selectedEvent?.slug,
      ),
    [studies, selectedEventId, selectedEvent?.slug],
  );

  async function refresh() {
    const response = await fetch("/api/admin/case-studies", { cache: "no-store" });
    const body = await response.json();
    if (response.ok) setStudies(body.caseStudies ?? []);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEvent) return;

    setStatus("Filing incident report...");
    const formData = new FormData(event.currentTarget);

    const response = await fetch("/api/admin/case-studies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: selectedEvent.id,
        slug: selectedEvent.slug,
        title: String(formData.get("title") ?? selectedEvent.title),
        imageUrl: String(formData.get("imageUrl") ?? ""),
        status: String(formData.get("status") ?? "Filed"),
        challenge: String(formData.get("challenge") ?? ""),
        solution: String(formData.get("solution") ?? ""),
        outcome: String(formData.get("outcome") ?? ""),
        published: formData.get("published") === "on",
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      setStatus(body.detail ?? body.error ?? "Could not save case study.");
      return;
    }

    setStatus("Incident report filed.");
    await refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[330px_1fr]">
      <aside className="panel self-start xl:sticky xl:top-28">
        <div className="eyebrow">Deployment registry</div>
        <h2 className="text-2xl font-black">Choose Event</h2>
        <div className="mt-4 space-y-2">
          {events.map((event) => {
            const filed = studies.some(
              (study) => study.event_id === event.id || study.slug === event.slug,
            );

            return (
              <button
                key={event.id}
                type="button"
                onClick={() => {
                  setSelectedEventId(event.id);
                  setStatus("");
                }}
                className={`w-full rounded-xl border p-3 text-left ${
                  selectedEventId === event.id
                    ? "border-dusk-aqua/40 bg-dusk-aqua/10"
                    : "border-dusk-line bg-white/[0.025]"
                }`}
              >
                <strong className="block">{event.title}</strong>
                <span className="mt-1 block text-xs text-slate-500">
                  {new Date(event.start_at).toLocaleDateString()} ·{" "}
                  {filed ? "report filed" : "analysis pending"}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="panel">
        {selectedEvent ? (
          <>
            <div className="eyebrow">Case Study in Chaos</div>
            <h2 className="text-3xl font-black">{selectedEvent.title}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {selectedEvent.location ?? "Location not recorded"} ·{" "}
              <a
                href={`/chaos/${selectedEvent.slug}`}
                target="_blank"
                className="font-black text-dusk-aqua"
              >
                View public {new Date(selectedEvent.start_at).getTime() > Date.now()
                  ? "Tactical Deployment Plan"
                  : "Incident Report"} ↗
              </a>
              {" · "}
              <a
                href={`/dashboard/posts?eventId=${selectedEvent.id}`}
                className="font-black text-dusk-pink"
              >
                Open Social Ops →
              </a>
            </p>

            <form
              key={`${selectedEvent.id}-${existing?.id ?? "new"}`}
              onSubmit={save}
              className="mt-6 space-y-5"
            >
              <label className="form-label">
                Public report title
                <input
                  className="form-input"
                  name="title"
                  defaultValue={existing?.title ?? selectedEvent.title}
                  required
                />
              </label>

              <label className="form-label">
                Cover image URL
                <input
                  className="form-input"
                  name="imageUrl"
                  defaultValue={existing?.image_url ?? ""}
                  placeholder="Optional — event media will still appear below the report"
                />
              </label>

              <label className="form-label">
                Corporate status
                <input
                  className="form-input"
                  name="status"
                  defaultValue={existing?.status ?? "Incident Report Filed"}
                />
              </label>

              <label className="form-label">
                The Assignment
                <textarea
                  className="form-input min-h-28"
                  name="challenge"
                  defaultValue={existing?.challenge ?? ""}
                  placeholder="What was Dusk supposedly attempting to accomplish?"
                  required
                />
              </label>

              <label className="form-label">
                The Extremely Professional Response
                <textarea
                  className="form-input min-h-32"
                  name="solution"
                  defaultValue={existing?.solution ?? ""}
                  placeholder="What actually happened?"
                  required
                />
              </label>

              <label className="form-label">
                Damage Report
                <textarea
                  className="form-input min-h-32"
                  name="outcome"
                  defaultValue={existing?.outcome ?? ""}
                  placeholder="Results, highlights, collateral chaos, lessons learned..."
                  required
                />
              </label>

              <label className="flex items-center gap-3 text-sm font-bold">
                <input
                  name="published"
                  type="checkbox"
                  defaultChecked={existing?.published ?? false}
                />
                Publish this formal case study
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <button className="button-primary" type="submit">
                  {existing ? "Update incident report" : "File incident report"}
                </button>
                {status ? <span className="text-sm text-slate-400">{status}</span> : null}
              </div>
            </form>
          </>
        ) : (
          <p className="text-slate-400">No event selected.</p>
        )}
      </section>
    </div>
  );
}
