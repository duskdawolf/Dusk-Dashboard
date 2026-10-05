import React from "react";
import { ImageResponse } from "next/og";
import sharp, { type OverlayOptions } from "sharp";
import { formatLocation } from "./format";
import type { NextStopCopy, RouteContext } from "./types";
import type { BrandConfig } from "@/lib/alpha71/types";
import { downloadBrandAssetBuffer } from "@/lib/alpha71/brand-assets";

const WIDTH = 1152;
const HEIGHT = 2048;
const CARD_WIDTH = 900;

function cut(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function routeCard(key: string, label: string, title: string, location: string, accent: string) {
  return (
    <div key={key} style={{ width: CARD_WIDTH, display: "flex", flexDirection: "column", gap: 6, border: `2px solid ${accent}`, borderRadius: 28, background: "rgba(7,16,27,.84)", padding: "20px 28px", minHeight: 122, justifyContent: "center" }}>
      <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: 2.1, textTransform: "uppercase", color: accent }}>{label}</div>
      <div style={{ fontSize: 29, lineHeight: 1.04, fontWeight: 900, color: "white" }}>{cut(title, 64)}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#b9c9dd" }}>{cut(location, 72)}</div>
    </div>
  );
}

function mascotPosition(placement: "hero_left" | "hero_right" | "center_low" | undefined, width: number, height: number) {
  if (placement === "hero_right") return { left: WIDTH - width - 38, top: 980 };
  if (placement === "center_low") return { left: Math.round((WIDTH - width) / 2), top: 1260 };
  return { left: 38, top: 980 };
}

function logoPosition(placement: "footer_right" | "footer_left" | "header_right" | "off" | undefined, width: number, height: number) {
  if (placement === "header_right") return { left: WIDTH - width - 40, top: 42 };
  if (placement === "footer_left") return { left: 40, top: HEIGHT - height - 42 };
  return { left: WIDTH - width - 40, top: HEIGHT - height - 42 };
}

async function buildTextOverlay(route: RouteContext, copy: NextStopCopy): Promise<Buffer> {
  const appearanceText = route.current.appearanceMode ? `Appearance: ${route.current.appearanceMode}` : null;
  const element = (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", color: "white", fontFamily: "sans-serif" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(180deg, rgba(4,9,19,.16), rgba(4,9,19,.05) 38%, rgba(4,9,19,.24) 62%, rgba(4,9,19,.34))" }} />
      <div style={{ position: "absolute", inset: "34px 0 30px", display: "flex", flexDirection: "column", alignItems: "center", gap: 13 }}>
        <div style={{ width: CARD_WIDTH, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, marginBottom: 1 }}>
          <div style={{ color: "#64ecff", fontSize: 22, fontWeight: 900, letterSpacing: 5.2 }}>DUSK INDUSKRIES</div>
          <div style={{ color: "white", fontSize: 57, lineHeight: 1.01, fontWeight: 900, textAlign: "center" }}>{copy.headline}</div>
          <div style={{ color: "#d2deef", fontSize: 22, fontWeight: 700, textAlign: "center" }}>{cut(copy.subheadline, 96)}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 11 }}>
          {route.previous.slice(-2).map((event) => routeCard(event.id, copy.pastLabel, event.title, formatLocation(event), "#b58cff"))}
        </div>

        <div style={{ width: 920, display: "flex", flexDirection: "column", border: "3px solid #ff5ca8", borderRadius: 40, background: "rgba(6,12,23,.79)", padding: "32px 38px", marginTop: 4, marginBottom: 8, minHeight: 790 }}>
          <div style={{ color: "#64ecff", fontSize: 23, fontWeight: 900, letterSpacing: 3, textTransform: "uppercase", textAlign: "center" }}>{copy.currentEventKicker}</div>
          <div style={{ color: "white", fontSize: 70, lineHeight: .98, fontWeight: 900, marginTop: 10, textAlign: "center" }}>{copy.currentEventTitle}</div>

          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10, marginTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", borderRadius: 999, background: "rgba(100,236,255,.16)", border: "1px solid rgba(100,236,255,.38)", padding: "9px 15px", color: "#e9fbff", fontSize: 23, fontWeight: 800 }}>{copy.locationLine}</div>
            <div style={{ display: "flex", alignItems: "center", borderRadius: 999, background: "rgba(255,92,168,.16)", border: "1px solid rgba(255,92,168,.38)", padding: "9px 15px", color: "#fff0f7", fontSize: 23, fontWeight: 800 }}>{copy.dateLine}</div>
          </div>

          {appearanceText ? <div style={{ marginTop: 13, color: "#bed9ee", fontSize: 19, fontWeight: 800, textAlign: "center" }}>{appearanceText}</div> : null}

          <div style={{ marginTop: 27, color: "#64ecff", fontSize: 27, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", textAlign: "center" }}>{copy.findMeTitle}</div>
          <div style={{ width: 760, alignSelf: "center", display: "flex", flexDirection: "column", gap: 13, marginTop: 15 }}>
            {copy.findMeItems.slice(0, 5).map((item, index) => (
              <div key={`${item}-${index}`} style={{ display: "flex", gap: 13, alignItems: "flex-start", color: "#f6f9ff", fontSize: 25, fontWeight: 700, lineHeight: 1.15 }}>
                <div style={{ width: 11, height: 11, borderRadius: 999, background: "#64ecff", flexShrink: 0, marginTop: 9 }} />
                <div>{cut(item, 92)}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "auto", paddingTop: 26, color: "#becde1", fontSize: 21, fontStyle: "italic", fontWeight: 700, textAlign: "center" }}>{cut(copy.flavorText, 110)}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 11 }}>
          {route.next.slice(0, 2).map((event) => routeCard(event.id, copy.futureLabel, event.title, formatLocation(event), "#64ecff"))}
        </div>

        <div style={{ width: CARD_WIDTH, display: "flex", justifyContent: "center", color: "#8ea4bf", fontSize: 18, fontWeight: 800, marginTop: 1 }}>@duskdawolf • past paws → present chaos → future deployments</div>
      </div>
    </div>
  );

  const response = new ImageResponse(element, { width: WIDTH, height: HEIGHT });
  return Buffer.from(await response.arrayBuffer());
}

async function mascotOverlay(brandConfig: BrandConfig): Promise<OverlayOptions | null> {
  if (!brandConfig.settings?.composite_mascot || !brandConfig.primaryMascot) return null;
  const source = await downloadBrandAssetBuffer(brandConfig.primaryMascot.storage_path);
  const scale = Math.max(0.5, Math.min(1.35, Number(brandConfig.settings.mascot_scale || 1)));
  const width = Math.round(250 * scale);
  const height = Math.round(330 * scale);
  const pos = mascotPosition(brandConfig.settings.mascot_placement, width, height);
  const normalized = await sharp(source).rotate().resize({ width, height, fit: "contain", withoutEnlargement: false }).png().toBuffer();
  return { input: normalized, left: pos.left, top: pos.top, blend: "over" };
}

async function brandLogoOverlay(brandConfig: BrandConfig): Promise<OverlayOptions | null> {
  if (!brandConfig.settings?.composite_logo || !brandConfig.logo || brandConfig.settings.logo_placement === "off") return null;
  const source = await downloadBrandAssetBuffer(brandConfig.logo.storage_path);
  const scale = Math.max(0.42, Math.min(1.25, Number(brandConfig.settings.logo_scale || 1)));
  const width = Math.round(150 * scale);
  const height = Math.round(150 * scale);
  const pos = logoPosition(brandConfig.settings.logo_placement, width, height);
  const normalized = await sharp(source).rotate().resize({ width, height, fit: "contain", withoutEnlargement: false }).png().toBuffer();
  return { input: normalized, left: pos.left, top: pos.top, blend: "over" };
}

export async function composeNextStopPoster(args: { background: Buffer; route: RouteContext; copy: NextStopCopy; brandConfig?: BrandConfig | null; }) {
  const { background, route, copy, brandConfig } = args;
  const textOverlay = await buildTextOverlay(route, copy);
  const overlays: OverlayOptions[] = [{ input: textOverlay, left: 0, top: 0, blend: "over" }];
  if (brandConfig?.settings?.use_brand_assets_in_next_stop) {
    const mascot = await mascotOverlay(brandConfig);
    if (mascot) overlays.push(mascot);
    const logo = await brandLogoOverlay(brandConfig);
    if (logo) overlays.push(logo);
  }
  return await sharp(background).rotate().resize(WIDTH, HEIGHT, { fit: "cover" }).composite(overlays).webp({ quality: 92 }).toBuffer();
}
