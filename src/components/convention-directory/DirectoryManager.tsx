"use client";
import { useEffect, useState } from "react";
import { MediaLibraryPicker } from "@/components/media/MediaLibraryPicker";
import { EditionSchema } from "@/lib/convention-directory/model";

const fields = [
  ["edition_key", "Stable edition identity (keep unchanged after import)"],
  ["name", "Edition name"],
  ["edition_year", "Year"],
  ["start_at", "Official start (ISO date/time)"],
  ["end_at", "Official end (ISO date/time)"],
  ["timezone", "Timezone"],
  ["venue_name", "Venue"],
  ["venue_address", "Venue address"],
  ["location", "City / region / country"],
  ["theme", "Edition theme"],
  ["website_url", "Official edition website"],
  ["registration_url", "Registration link"],
  ["registration_info", "Registration information"],
  ["schedule_url", "Schedule link"],
  ["schedule_info", "Schedule information"],
  ["policies_url", "Policies link"],
  ["policies_info", "Policies"],
  ["social_url", "Official social link"],
  ["banner_url", "Official banner URL"],
  ["logo_url", "Official logo URL"],
];
const blank = {
  edition_key: "",
  name: "",
  website_url: "",
  date_precision: "unknown",
  status: "scheduled",
  hotels: [],
  sources: [],
};
export function DirectoryManager() {
  const [data, setData] = useState<any>({
    series: [],
    editions: [],
    runs: [],
    events: [],
    hotels: [],
    sources: [],
    candidates: [],
  });
  const [seriesId, setSeriesId] = useState("");
  const [series, setSeries] = useState<any>({
    name: "",
    slug: "",
    official_url: "",
    ingest_url: "",
    ingest_format: "jsonld",
    auto_refresh: false,
  });
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [editionId, setEditionId] = useState("");
  const [facts, setFacts] = useState<any>(blank);
  const [source, setSource] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<
    "series_logo" | "edition_logo" | "edition_banner" | null
  >(null);
  async function load() {
    const res = await fetch("/api/admin/convention-directory", {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    setData(json);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  async function save(payload: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/convention-directory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      await load();
      setMessage("Saved.");
      return result;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
      return null;
    } finally {
      setBusy(false);
    }
  }
  function chooseSeries(id: string) {
    setCandidateId(null);
    setSeriesId(id);
    setSeries(
      data.series.find((s: any) => s.id === id) || {
        name: "",
        slug: "",
        official_url: "",
        ingest_url: "",
        ingest_format: "jsonld",
        auto_refresh: false,
      },
    );
    setEditionId("");
    setFacts(blank);
    setConfirmed(false);
  }
  function chooseEdition(id: string) {
    setEditionId(id);
    setConfirmed(false);
    const row = data.editions.find((e: any) => e.id === id);
    if (!row) {
      setFacts(blank);
      setSource("");
      return;
    }
    const allowed = new Set([
      ...fields.map(([key]) => key),
      "date_precision",
      "status",
    ]);
    const next = Object.fromEntries(
      Object.entries(row).filter(([key]) => allowed.has(key)),
    );
    const hotels = data.hotels
      .filter((h: any) => h.edition_id === id)
      .map(
        ({ id: _id, edition_id: _edition, verified_at: _time, ...h }: any) => h,
      );
    const sources = data.sources
      .filter((s: any) => s.edition_id === id && s.authority === "official")
      .map((s: any) => ({ field_name: s.field_name, url: s.url }));
    const proposal = data.candidates?.find(
      (c: any) => c.id === candidateId,
    )?.proposed_facts;
    setFacts(
      proposal
        ? {
            ...next,
            ...proposal,
            edition_key: row.edition_key,
            hotels: proposal.hotels ?? hotels,
            sources: [],
          }
        : { ...next, hotels, sources },
    );
    setSource(
      proposal?.website_url || sources[0]?.url || row.website_url || "",
    );
  }
  const input =
    "w-full rounded-xl border border-white/10 bg-[#07101b] px-3 py-2 text-white";
  const official = data.editions.filter(
    (e: any) => e.verification_status === "official",
  );
  const pendingEvents = data.events.filter(
    (e: any) => !official.some((d: any) => d.id === e.convention_edition_id),
  );
  return (
    <div className="grid gap-6 py-6">
      <h2 className="text-3xl font-black">Convention Directory</h2>
      <p className="text-slate-400">
        Maintain official facts here. Deployment Ops selects these editions;
        personal attendance and reservations stay in each deployment.
      </p>
      <p role="status" className="text-cyan-200">
        {message}
      </p>
      <section className="card grid gap-4">
        <h3 className="text-xl font-bold">
          Convention Series and official source
        </h3>
        <select
          className={input}
          aria-label="Convention Series"
          value={seriesId}
          onChange={(e) => chooseSeries(e.target.value)}
        >
          <option value="">New series</option>
          {data.series.map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["name", "Series name"],
            ["slug", "Stable series slug"],
            ["official_url", "Approved official website"],
            ["ingest_url", "Official refresh source URL"],
            ["discovery_url", "Optional secondary discovery URL (review only)"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                className={input}
                value={series[key] ?? ""}
                onChange={(e) =>
                  setSeries({ ...series, [key]: e.target.value })
                }
              />
            </label>
          ))}
        </div>
        <label>
          Source format
          <select
            className={input}
            value={series.ingest_format}
            onChange={(e) =>
              setSeries({ ...series, ingest_format: e.target.value })
            }
          >
            <option value="jsonld">
              Official webpage with structured Event metadata
            </option>
            <option value="directory-json">Official directory JSON feed</option>
          </select>
        </label>
        <label>
          Secondary discovery format
          <select
            className={input}
            value={series.discovery_format || "jsonld"}
            onChange={(e) =>
              setSeries({ ...series, discovery_format: e.target.value })
            }
          >
            <option value="jsonld">
              Webpage with structured Event metadata
            </option>
            <option value="directory-json">Directory JSON feed</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={series.auto_refresh}
            onChange={(e) =>
              setSeries({ ...series, auto_refresh: e.target.checked })
            }
          />{" "}
          Trust this official source for automatic refresh and new edition
          discovery
        </label>
        <p className="text-xs text-slate-400">
          Enable only after checking this source belongs to the convention.
          Unsupported pages report failure and require manual curation. No facts
          are inferred from arbitrary page text.
        </p>
        {series.last_error ? (
          <p className="text-red-200">Last refresh: {series.last_error}</p>
        ) : null}
        <p className="text-xs">
          Last attempt: {series.last_attempt_at || "Never"} · Last success:{" "}
          {series.last_success_at || "Never"}
        </p>
        <div className="flex gap-3">
          <button
            disabled={busy}
            className="button-primary"
            onClick={async () => {
              const result = await save({
                action: "series",
                ...(seriesId ? { id: seriesId } : {}),
                name: series.name,
                slug: series.slug,
                official_url: series.official_url,
                ingest_url: series.ingest_url || null,
                ingest_format: series.ingest_format,
                auto_refresh: series.auto_refresh,
                discovery_url: series.discovery_url || null,
                discovery_format: series.discovery_format || "jsonld",
              });
              if (result) setSeriesId(result.id);
            }}
          >
            Save series
          </button>
          {seriesId ? (
            <>
              <button
                className="button-secondary"
                onClick={() => setPicker("series_logo")}
              >
                Choose series logo
              </button>
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
                    const r = await res.json();
                    setMessage(r.message || r.error);
                    await load();
                  } catch {
                    setMessage("Refresh failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Refresh / discover editions
              </button>
            </>
          ) : null}
        </div>
      </section>
      {seriesId ? (
        <form
          className="card grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            await save({
              action: "official_source",
              seriesId,
              url: form.get("url"),
              kind: form.get("kind"),
              confirmedOfficial: true,
            });
          }}
        >
          <h3 className="text-xl font-bold">
            Additional official evidence sources
          </h3>
          <p className="text-sm text-slate-400">
            Approve only websites or specific social accounts you have verified
            belong to this convention.
          </p>
          {(data.officialSources ?? [])
            .filter((s: any) => s.series_id === seriesId)
            .map((s: any) => (
              <p key={s.id}>
                {s.kind}: {s.url} · checked {s.verified_at}
              </p>
            ))}
          <label>
            Official source URL
            <input required name="url" type="url" className={input} />
          </label>
          <select
            name="kind"
            aria-label="Official source type"
            className={input}
          >
            <option value="website">Official website</option>
            <option value="social">Official social account</option>
          </select>
          <label>
            <input required type="checkbox" /> I verified this source belongs to
            the convention.
          </label>
          <button disabled={busy} className="button-secondary">
            Approve official evidence source
          </button>
        </form>
      ) : null}
      {seriesId ? (
        <section className="card grid gap-4">
          <h3 className="text-xl font-bold">Edition facts and verification</h3>
          <select
            className={input}
            aria-label="Edition to maintain"
            value={editionId}
            onChange={(e) => chooseEdition(e.target.value)}
          >
            <option value="">New official edition</option>
            {data.editions
              .filter((e: any) => e.series_id === seriesId)
              .map((e: any) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.edition_year || "Year unknown"} ·{" "}
                  {e.verification_status}
                </option>
              ))}
          </select>
          <p className="text-sm text-slate-400">
            Use a stable identity for this occurrence (prefer its official
            occurrence-specific URL). Different occurrences may share a year.
            Retain the identity when dates change. Imported entries remain
            unavailable for new deployments until verified.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  className={input}
                  disabled={key === "edition_key" && Boolean(editionId)}
                  value={facts[key] ?? ""}
                  onChange={(e) =>
                    setFacts({
                      ...facts,
                      [key]:
                        key === "edition_year"
                          ? e.target.value
                            ? Number(e.target.value)
                            : null
                          : e.target.value || null,
                    })
                  }
                />
              </label>
            ))}
          </div>
          <label>
            Date precision
            <select
              className={input}
              value={facts.date_precision}
              onChange={(e) =>
                setFacts({ ...facts, date_precision: e.target.value })
              }
            >
              {["unknown", "date_only", "exact"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              className={input}
              value={facts.status}
              onChange={(e) => setFacts({ ...facts, status: e.target.value })}
            >
              {["scheduled", "postponed", "cancelled"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <h4 className="font-bold">Official hotels (public information)</h4>
          {(facts.hotels ?? []).map((hotel: any, index: number) => (
            <div
              key={index}
              className="grid gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-2"
            >
              {[
                ["source_key", "Stable hotel identity"],
                ["name", "Hotel name"],
                ["address", "Address"],
                ["booking_url", "Official booking link"],
                ["booking_opens_at", "Booking opens (ISO date/time)"],
                ["booking_closes_at", "Booking closes (ISO date/time)"],
                ["block_info", "Published block information"],
                ["source_url", "Official convention hotel source"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    className={input}
                    value={hotel[key] ?? ""}
                    onChange={(e) =>
                      setFacts({
                        ...facts,
                        hotels: facts.hotels.map((h: any, i: number) =>
                          i === index
                            ? { ...h, [key]: e.target.value || null }
                            : h,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <label>
                Hotel role
                <select
                  className={input}
                  value={hotel.role}
                  onChange={(e) =>
                    setFacts({
                      ...facts,
                      hotels: facts.hotels.map((h: any, i: number) =>
                        i === index ? { ...h, role: e.target.value } : h,
                      ),
                    })
                  }
                >
                  {["main", "overflow", "secondary", "staff", "other"].map(
                    (r) => (
                      <option key={r}>{r}</option>
                    ),
                  )}
                </select>
              </label>
              <button
                className="button-secondary"
                onClick={() =>
                  setFacts({
                    ...facts,
                    hotels: facts.hotels.filter(
                      (_: any, i: number) => i !== index,
                    ),
                  })
                }
              >
                Remove official hotel
              </button>
            </div>
          ))}
          <button
            className="button-secondary"
            onClick={() =>
              setFacts({
                ...facts,
                hotels: [
                  ...(facts.hotels ?? []),
                  {
                    source_key: "",
                    name: "",
                    role: "main",
                    source_url: source,
                  },
                ],
              })
            }
          >
            Add official hotel
          </button>
          <label>
            Primary official verification source
            <input
              className={input}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </label>
          {(facts.sources ?? []).map((s: any, index: number) => (
            <div key={index} className="flex gap-2">
              <input
                aria-label="Fact or field name"
                className={input}
                value={s.field_name}
                onChange={(e) =>
                  setFacts({
                    ...facts,
                    sources: facts.sources.map((v: any, i: number) =>
                      i === index ? { ...v, field_name: e.target.value } : v,
                    ),
                  })
                }
              />
              <input
                aria-label="Official fact source URL"
                className={input}
                value={s.url}
                onChange={(e) =>
                  setFacts({
                    ...facts,
                    sources: facts.sources.map((v: any, i: number) =>
                      i === index ? { ...v, url: e.target.value } : v,
                    ),
                  })
                }
              />
              <button
                onClick={() =>
                  setFacts({
                    ...facts,
                    sources: facts.sources.filter(
                      (_: any, i: number) => i !== index,
                    ),
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
          <button
            className="button-secondary"
            onClick={() =>
              setFacts({
                ...facts,
                sources: [
                  ...(facts.sources ?? []),
                  { field_name: "", url: "" },
                ],
              })
            }
          >
            Add field source
          </button>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            I checked these edition facts against the official source.
          </label>
          <button
            disabled={busy || !confirmed}
            className="button-primary"
            onClick={async () => {
              const checked = EditionSchema.safeParse(facts);
              if (!checked.success) {
                setMessage(
                  checked.error.issues
                    .map((i) => `${i.path.join(".")}: ${i.message}`)
                    .join("; "),
                );
                return;
              }
              const result = await save({
                action: "edition",
                seriesId,
                sourceUrl: source,
                facts: checked.data,
                confirmedOfficial: true,
                candidateId,
              });
              if (result) {
                setEditionId(result.id);
                setConfirmed(false);
                setCandidateId(null);
              }
            }}
          >
            Verify and save edition
          </button>
          {editionId ? (
            <label>
              <input
                type="checkbox"
                checked={Boolean(
                  data.editions.find((e: any) => e.id === editionId)
                    ?.public_hotels,
                )}
                onChange={(e) =>
                  void save({
                    action: "hotel_visibility",
                    editionId,
                    publicHotels: e.target.checked,
                  })
                }
              />{" "}
              Show official hotel information publicly (off by default)
            </label>
          ) : null}
          {editionId ? (
            <div className="flex gap-2">
              <button
                className="button-secondary"
                onClick={() => setPicker("edition_banner")}
              >
                Choose edition banner
              </button>
              <button
                className="button-secondary"
                onClick={() => setPicker("edition_logo")}
              >
                Choose edition logo
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
      <section className="card grid gap-3">
        <h3 className="text-xl font-bold">
          Candidates and conflicts awaiting official review
        </h3>
        {(data.candidates ?? []).map((c: any) => (
          <div key={c.id} className="rounded-xl border border-white/10 p-3">
            <strong>{c.proposed_facts.name}</strong>
            <p>{c.reason}</p>
            <p className="text-sm">
              Source authority: {c.authority} · Unverified · {c.discovered_at}
            </p>
            <a
              href={c.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-300 underline"
            >
              Discovery evidence
            </a>
            <div className="mt-2 flex gap-3">
              <button
                className="button-secondary"
                onClick={() => {
                  chooseSeries(c.series_id);
                  setCandidateId(c.id);
                  setFacts({
                    ...blank,
                    ...c.proposed_facts,
                    sources: [],
                    hotels: c.proposed_facts.hotels ?? [],
                  });
                  setSource("");
                  setMessage(
                    "Review these proposed facts above against the official source. Resolve conflicting identity using the existing edition or a distinct occurrence key.",
                  );
                }}
              >
                Review proposed facts
              </button>
              <button
                disabled={busy}
                className="button-secondary"
                onClick={() =>
                  void save({
                    action: "candidate",
                    candidateId: c.id,
                    status: "dismissed",
                  })
                }
              >
                Dismiss candidate
              </button>
            </div>
          </div>
        ))}
        {!(data.candidates ?? []).length ? <p>No pending candidates.</p> : null}
      </section>
      <section className="card grid gap-3">
        <h3 className="text-xl font-bold">Legacy deployments needing review</h3>
        <p>
          Match each deployment to a verified edition. This changes only its
          directory reference.
        </p>
        {pendingEvents.length ? (
          pendingEvents.map((e: any) => (
            <form
              key={e.id}
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void save({
                  action: "link",
                  eventId: e.id,
                  editionId: form.get("edition"),
                });
              }}
              className="grid gap-2"
            >
              <strong>{e.title}</strong>
              <select className={input} name="edition" required>
                <option value="">Select verified edition</option>
                {official.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.edition_year}
                  </option>
                ))}
              </select>
              <button disabled={busy} className="button-secondary">
                Link existing deployment
              </button>
            </form>
          ))
        ) : (
          <p>
            No unresolved convention deployments in your accessible records.
          </p>
        )}
      </section>
      <section className="card">
        <h3 className="text-xl font-bold">Recent directory checks</h3>
        {data.runs.map((r: any) => (
          <p className="mt-2 text-sm" key={r.id}>
            {r.created_at} · {r.outcome} · {r.message || r.source_url}
          </p>
        ))}
      </section>
      <MediaLibraryPicker
        open={Boolean(picker)}
        kind="image"
        onClose={() => setPicker(null)}
        onSelect={async (item) => {
          await save({
            action: "media",
            id: picker === "series_logo" ? seriesId : editionId,
            target: picker,
            mediaId: item.id,
          });
        }}
      />
    </div>
  );
}
