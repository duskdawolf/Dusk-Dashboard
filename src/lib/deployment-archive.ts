import { getChaosArchive } from "@/lib/repository";
import type { ChaosArchiveItem } from "@/types";

export type DeploymentArchiveMode = "future" | "past";

function isPast(item: ChaosArchiveItem) {
  const boundary = new Date(
    item.event.endAt ?? item.event.startAt,
  ).valueOf();

  return Number.isFinite(boundary) && boundary < Date.now();
}

function matchesTag(item: ChaosArchiveItem, tag: string) {
  if (!tag) return true;

  const needle = tag.trim().toLowerCase();

  return [
    item.event.tag,
    item.event.eventType,
    item.event.quarter.toUpperCase(),
  ].some(
    (value) =>
      String(value ?? "")
        .trim()
        .toLowerCase() === needle,
  );
}

export async function getDeploymentArchive(
  mode: DeploymentArchiveMode,
  tag = "",
) {
  const archive = await getChaosArchive();

  return archive
    .filter((item) =>
      mode === "past" ? isPast(item) : !isPast(item),
    )
    .filter((item) => matchesTag(item, tag))
    .sort((a, b) => {
      const av = new Date(a.event.startAt).valueOf();
      const bv = new Date(b.event.startAt).valueOf();

      return mode === "past" ? bv - av : av - bv;
    });
}
