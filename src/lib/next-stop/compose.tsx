import React from "react";
import { ImageResponse } from "next/og";
import sharp, { type OverlayOptions } from "sharp";
import { formatLocation } from "./format";
import type { NextStopCopy, RouteContext } from "./types";
import type { BrandConfig } from "@/lib/alpha71/types";
import { downloadBrandAssetBuffer } from "@/lib/alpha71/brand-assets";

const WIDTH = 1152;
const HEIGHT = 2048;

function cut(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function routeCard(key: string, label: string, title: string, location: string, accent: string) {
  return (
    <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6, border: `2px solid ${accent}`, borderRadius: 28, background: "rgba(7,16,27,.82)", padding: "22px 30px", minHeight: 128, justifyContent: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: accent }}>{label}</div>
      <div style={{ fontSize: 28, lineHeight: 1.05, fontWeight: 900, color: "white" }}>{cut(title, 64)}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#b9c9dd" }}>{cut(location, 72)}</div>
    </div>
  );
}

function mascotPosition(placement: "hero_left" | "hero_right" | "center_low" | undefined, width: number, height: number) {
  if (placement === "hero_right") return { left: WIDTH - width - 60, top: 930 };
  if (placement === "center_low") return { left: Math.round((WIDTH - width) / 2), top: 1220 };
  return { left: 48, top: 920 };
}

function logoPosition(placement: "footer_right" | "footer_left" | "header_right" | "off" | undefined, width: number, height: number) {
  if (placement === "header_right") return { left: WIDTH - width - 54, top: 46 };
  if (placement === "footer_left") return { left: 54, top: HEIGHT - height - 52 };
  return { left: WIDTH - width - 54, top: HEIGHT - height - 52 };
}

async function buildTextOverlay(route: RouteContext, copy: NextStopCopy): Promise<Buffer> {
  const appearanceText = route.current.appearanceMode ? `Appearance: ${route.current.appearanceMode}` : null;
  const element = (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", color: "white", fontFamily: "sans-serif" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(180deg, rgba(4,9,19,.2), rgba(4,9,19,.08) 35%, rgba(4,9,19,.3) 60%, rgba(4,9,19,.38))" }} />

      <div style={{ position: "absolute", inset: "36px 54px 34px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <div style={{ color: "#64ecff", fontSize: 24, fontWeight: 900, letterSpacing: 5 }}>DUSK INDUSKRIES</div>
          <div style={{ color: "white", fontSize: 58, lineHeight: 1.02, fontWeight: 900, textAlign: "center" }}>{copy.headline}</div>
          <div style={{ color: "#d2deef", fontSize: 23, fontWeight: 700, textAlign: "center" }}>{cut(copy.subheadline, 96)}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {route.previous.slice(-2).map((event) => routeCard(event.id, copy.pastLabel, event.title, formatLocation(event), "#b58cff"))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", border: "3px solid #ff5ca8", borderRadius: 40, background: "rgba(6,12,23,.76)", padding: "34px 38px", marginTop: 6, marginBottom: 10, minHeight: 820 }}>
          <div style={{ color: "#64ecff", fontSize: 24, fontWeight: 900, letterSpacing: 3, textTransform: "uppercase" }}>{copy.currentEventKicker}</div>
          <div style={{ color: "white", fontSize: 72, lineHeight: .98, fontWeight: 900, marginTop: 12 }}>{copy.currentEventTitle}</div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 22 }}>
            <div style={{ display: "flex", alignItems: "center", borderRadius: 999, background: "rgba(100,236,255,.16)", border: "1px solid rgba(100,236,255,.38)", padding: "10px 16px", color: "#e9fbff", fontSize: 24, fontWeight: 800 }}>{copy.locationLine}</div>
            <div style={{ display: "flex", alignItems: "center", borderRadius: 999, background: "rgba(255,92,168,.16)", border: "1px solid rgba(255,92,168,.38)", padding: "10px 16px", color: "#fff0f7", fontSize: 24, fontWeight: 800 }}>{copy.dateLine}</div>
          </div>

          {appearanceText ? (
            <div style={{ marginTop: 14, color: "#bed9ee", fontSize: 20, fontWeight: 800 }}>{appearanceText}</div>
          ) : null}

          <div style={{ marginTop: 28, color: "#64ecff", fontSize: 28, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" }}>{copy.findMeTitle}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
            {copy.findMeItems.slice(0, 5).map((item, index) => (
              <div key={`${item}-${index}`} style={{ display: "flex", gap: 14, alignItems: "flex-start", color: "#f6f9ff", fontSize: 26, fontWeight: 700, lineHeight: 1.15 }}>
                <div style={{ width: 12, height: 12, borderRadius: 999, background: "#64ecff", flexShrink: 0, marginTop: 9 }} />
                <div>{cut(item, 92)}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "auto", paddingTop: 28, color: "#becde1", fontSize: 22, fontStyle: "italic", fontWeight: 700 }}>{cut(copy.flavorText, 110)}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {route.next.slice(0, 2).map((event) => routeCard(event.id, copy.futureLabel, event.title, formatLocation(event), "#64ecff"))}
        </div>

        <div style={{ display: "flex", justifyContent: "center", color: "#8ea4bf", fontSize: 19, fontWeight: 800, marginTop: 2 }}>@duskdawolf • past paws → present chaos → future deployments</div>
      </div>
    </div>
  );

  const response = new ImageResponse(element, { width: WIDTH, height: HEIGHT });
  return Buffer.from(await response.arrayBuffer());
}

async function mascotOverlay(brandConfig: BrandConfig): Promise<OverlayOptions | null> {
  if (!brandConfig.settings?.composite_mascot || !brandConfig.primaryMascot) return null;
  const source = await downloadBrandAssetBuffer(brandConfig.primaryMascot.storage_path);
  const scale = Math.max(0.55, Math.min(1.45, Number(brandConfig.settings.mascot_scale || 1)));
  const width = Math.round(280 * scale);
  const height = Math.round(360 * scale);
  const pos = mascotPosition(brandConfig.settings.mascot_placement, width, height);
  const normalized = await sharp(source).rotate().resize({ width, height, fit: "contain", withoutEnlargement: false }).png().toBuffer();
  return { input: normalized, left: pos.left, top: pos.top, blend: "over" };
}

async function brandLogoOverlay(brandConfig: BrandConfig): Promise<OverlayOptions | null> {
  if (!brandConfig.settings?.composite_logo || !brandConfig.logo || brandConfig.settings.logo_placement === "off") return null;
  const source = await downloadBrandAssetBuffer(brandConfig.logo.storage_path);
  const scale = Math.max(0.45, Math.min(1.35, Number(brandConfig.settings.logo_scale || 1)));
  const width = Math.round(164 * scale);
  const height = Math.round(164 * scale);
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
