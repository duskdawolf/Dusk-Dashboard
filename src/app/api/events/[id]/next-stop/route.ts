import { NextRequest, NextResponse } from "next/server";
import { requireAlpha7Admin, alpha7ErrorResponse } from "@/lib/alpha7/auth";
import { generateNextStopCopy } from "@/lib/next-stop/copy";
import {
  generateNextStopBackgroundAsset,
  loadStoredBackground,
  renderNextStopFromBackground,
} from "@/lib/next-stop/generate";
import { persistNextStop, persistNextStopBackground, saveNextStopCopy } from "@/lib/next-stop/persist";
import { getNextStopState, setNextStopBackgroundStatus, setNextStopStatus } from "@/lib/next-stop/state";
import type { NextStopCopy } from "@/lib/next-stop/types";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAlpha7Admin();
    const { id } = await context.params;
    return NextResponse.json(await getNextStopState(id));
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAlpha7Admin();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = body.action ?? "generate";
    const state = await getNextStopState(id);

    if (action === "generate_copy") {
      const copy = await generateNextStopCopy(state.route);
      await saveNextStopCopy(id, copy);
      return NextResponse.json({ ok: true, copy, status: "stale" });
    }

    if (action === "generate_background") {
      await setNextStopBackgroundStatus(id, "generating");
      try {
        const bg = await generateNextStopBackgroundAsset(state.route, state.copy, user.id);
        await persistNextStopBackground(state.route, bg);
        return NextResponse.json({ ok: true, backgroundUrl: bg.backgroundUrl, backgroundPath: bg.backgroundPath, status: "generated" });
      } catch (error) {
        await setNextStopBackgroundStatus(id, "failed").catch(() => undefined);
        throw error;
      }
    }

    if (action === "generate_card_from_background" || action === "regenerate_image") {
      if (!state.backgroundPath) {
        return NextResponse.json({ error: "No saved background yet. Generate a background first." }, { status: 400 });
      }
      await setNextStopStatus(id, "generating");
      try {
        const background = await loadStoredBackground(state.backgroundPath);
        const asset = await renderNextStopFromBackground(
          state.route,
          background,
          state.copy as NextStopCopy | null,
          user.id,
        );
        await persistNextStop(state.route, asset);
        return NextResponse.json({ ok: true, ...asset, status: "generated" });
      } catch (error) {
        await setNextStopStatus(id, "failed").catch(() => undefined);
        throw error;
      }
    }

    if (action === "refresh_all") {
      await setNextStopBackgroundStatus(id, "generating");
      await setNextStopStatus(id, "generating");
      try {
        const bg = await generateNextStopBackgroundAsset(state.route, state.copy, user.id);
        await persistNextStopBackground(state.route, bg);
        const asset = await renderNextStopFromBackground(state.route, bg.background, bg.copy, user.id);
        await persistNextStop(state.route, asset);
        return NextResponse.json({ ok: true, ...asset, backgroundUrl: bg.backgroundUrl, status: "generated" });
      } catch (error) {
        await setNextStopBackgroundStatus(id, "failed").catch(() => undefined);
        await setNextStopStatus(id, "failed").catch(() => undefined);
        throw error;
      }
    }

    // default generate: use saved background if present; otherwise generate one then build card.
    if (state.backgroundPath) {
      await setNextStopStatus(id, "generating");
      try {
        const background = await loadStoredBackground(state.backgroundPath);
        const asset = await renderNextStopFromBackground(
          state.route,
          background,
          state.copy as NextStopCopy | null,
          user.id,
        );
        await persistNextStop(state.route, asset);
        return NextResponse.json({ ok: true, ...asset, status: "generated" });
      } catch (error) {
        await setNextStopStatus(id, "failed").catch(() => undefined);
        throw error;
      }
    }

    await setNextStopBackgroundStatus(id, "generating");
    await setNextStopStatus(id, "generating");
    try {
      const bg = await generateNextStopBackgroundAsset(state.route, state.copy, user.id);
      await persistNextStopBackground(state.route, bg);
      const asset = await renderNextStopFromBackground(state.route, bg.background, bg.copy, user.id);
      await persistNextStop(state.route, asset);
      return NextResponse.json({ ok: true, ...asset, backgroundUrl: bg.backgroundUrl, status: "generated" });
    } catch (error) {
      await setNextStopBackgroundStatus(id, "failed").catch(() => undefined);
      await setNextStopStatus(id, "failed").catch(() => undefined);
      throw error;
    }
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
