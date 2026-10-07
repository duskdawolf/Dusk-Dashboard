import {
  safePublicUrl,
  type PublicEdition,
} from "@/lib/convention-directory/model";

export function ConventionInformation({ edition }: { edition: PublicEdition }) {
  const links = [
    ["Official website", edition.website_url],
    ["Registration", edition.registration_url],
    ["Schedule", edition.schedule_url],
    ["Policies", edition.policies_url],
    ["Social", edition.social_url],
  ];
  return (
    <section className="grid gap-3 rounded-2xl border border-white/10 p-4">
      <h2 className="text-xl font-black">Convention Information</h2>
      <p className="text-sm text-slate-400">
        Official directory · read-only · {edition.series_name}
      </p>
      <h3 className="font-bold">{edition.name}</h3>
      <p>
        {edition.start_at?.slice(0, 10) || "Dates to be announced"}
        {edition.end_at ? ` – ${edition.end_at.slice(0, 10)}` : ""}
        {edition.timezone ? ` (${edition.timezone})` : ""} · {edition.status}
      </p>
      {[
        edition.venue_name,
        edition.venue_address,
        edition.location,
        edition.theme,
        edition.registration_info,
        edition.schedule_info,
        edition.policies_info,
      ]
        .filter(Boolean)
        .map((line, i) => (
          <p key={i} className="text-sm text-slate-300">
            {line}
          </p>
        ))}
      <div className="flex flex-wrap gap-3">
        {links.map(([label, href]) =>
          href && safePublicUrl(href) ? (
            <a
              className="text-cyan-300 underline"
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
            >
              {label}
            </a>
          ) : null,
        )}
      </div>
      {(edition.hotels ?? []).length ? (
        <div className="grid gap-2">
          <h3 className="font-bold">Official hotels</h3>
          {edition.hotels!.map((h, i) => (
            <div key={i} className="rounded-xl bg-white/5 p-3 text-sm">
              <strong>{h.name}</strong> · {h.role}
              <p>{h.address}</p>
              <p>{h.block_info}</p>
              {h.booking_opens_at ? (
                <p>Booking opens {h.booking_opens_at.slice(0, 10)}</p>
              ) : null}
              {h.booking_closes_at ? (
                <p>Booking closes {h.booking_closes_at.slice(0, 10)}</p>
              ) : null}
              {h.booking_url && safePublicUrl(h.booking_url) ? (
                <a
                  className="text-cyan-300 underline"
                  href={h.booking_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Official booking information
                </a>
              ) : null}
              {safePublicUrl(h.source_url) ? (
                <p>
                  <a
                    href={h.source_url}
                    className="text-cyan-300 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Hotel source
                  </a>
                  {h.verified_at
                    ? ` · checked ${h.verified_at.slice(0, 10)}`
                    : ""}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <p className="text-xs text-slate-400">
        Last verified:{" "}
        {new Date(edition.verified_at).toLocaleString("en-US", {
          timeZone: "UTC",
        })}{" "}
        UTC. Official facts may change.
      </p>
      <div className="flex flex-wrap gap-3 text-xs">
        {(edition.sources ?? []).map((s, i) =>
          safePublicUrl(s.url) ? (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-300 underline"
            >
              Source: {s.field_name}
              {s.verified_at ? ` (${s.verified_at.slice(0, 10)})` : ""}
            </a>
          ) : null,
        )}
      </div>
    </section>
  );
}
