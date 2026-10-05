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
  return value.length <= max
    ? value
    : `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function routeCard(
  key: string,
  label: string,
  title: string,
  location: string,
  accent: string,
) {
  return (
    <div
      key={key}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 7,
        border: `3px solid ${accent}`,
        borderRadius: 30,
        background: "rgba(7,16,27,.84)",
        padding: "24px 34px",
        minHeight: 160,
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontSize: 21,
          fontWeight: 800,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: accent,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 40,
          lineHeight: 1.05,
          fontWeight: 900,
          color: "white",
        }}
      >
        {cut(title, 64)}
      </div>
      <div
        style={{
          fontSize: 23,
          fontWeight: 700,
          color: "#b9c9dd",
        }}
      >
        {cut(location, 70)}
      </div>
    </div>
  );
}

function mascotPosition(
  placement: "hero_left" | "hero_right" | "center_low" | undefined,
  width: number,
  height: number,
) {
  if (placement === "hero_right") {
    return {
      left: Math.max(0, WIDTH - width - 70),
      top: 870,
    };
  }

  if (placement === "center_low") {
    return {
      left: Math.max(0, Math.round((WIDTH - width) / 2)),
      top: 1130,
    };
  }

  return {
    left: 70,
    top: 870,
  };
}

function brandLogoPosition(
  placement:
    | "footer_right"
    | "footer_left"
    | "header_right"
    | "off"
    | undefined,
  width: number,
  height: number,
) {
  if (placement === "header_right") {
    return {
      left: Math.max(0, WIDTH - width - 56),
      top: 52,
    };
  }

  if (placement === "footer_left") {
    return {
      left: 56,
      top: Math.max(0, HEIGHT - height - 54),
    };
  }

  return {
    left: Math.max(0, WIDTH - width - 56),
    top: Math.max(0, HEIGHT - height - 54),
  };
}

async function buildTextOverlay(
  route: RouteContext,
  copy: NextStopCopy,
): Promise<Buffer> {
  const element = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background:
            "linear-gradient(180deg, rgba(4,9,19,.24), rgba(4,9,19,.14) 35%, rgba(4,9,19,.42))",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: "48px 72px 34px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <div
            style={{
              color: "#64ecff",
              fontSize: 25,
              fontWeight: 900,
              letterSpacing: 5,
            }}
          >
            DUSK INDUSKRIES
          </div>

          <div
            style={{
              color: "white",
              fontSize: 55,
              lineHeight: 1,
              fontWeight: 900,
              textAlign: "center",
            }}
          >
            {copy.headline}
          </div>

          <div
            style={{
              color: "#c7d4e6",
              fontSize: 22,
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            {cut(copy.subheadline, 90)}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {route.previous
            .slice(-2)
            .map((event) =>
              routeCard(
                event.id,
                copy.pastLabel,
                event.title,
                formatLocation(event),
                "#b58cff",
              ),
            )}
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            minHeight: 720,
            flexDirection: "column",
            border: "4px solid #ff5ca8",
            borderRadius: 48,
            background: "rgba(6,12,23,.76)",
            padding: "42px 48px",
            marginTop: 14,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              color: "#64ecff",
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            {copy.currentEventKicker}
          </div>

          <div
            style={{
              color: "white",
              fontSize: 76,
              lineHeight: 0.98,
              fontWeight: 900,
              marginTop: 18,
            }}
          >
            {copy.currentEventTitle}
          </div>

          <div
            style={{
              color: "#ff87be",
              fontSize: 34,
              fontWeight: 900,
              marginTop: 25,
            }}
          >
            {copy.locationLine}
          </div>

          <div
            style={{
              color: "#d8e4f2",
              fontSize: 28,
              fontWeight: 800,
              marginTop: 7,
            }}
          >
            {copy.dateLine}
          </div>

          <div
            style={{
              color: "#64ecff",
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: 2,
              textTransform: "uppercase",
              marginTop: 42,
            }}
          >
            {copy.findMeTitle}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 18,
              marginTop: 19,
            }}
          >
            {copy.findMeItems.slice(0, 4).map((item, index) => (
              <div
                key={`${item}-${index}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 15,
                  color: "#f6f9ff",
                  fontSize: 27,
                  fontWeight: 700,
                }}
              >
                <div
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 99,
                    background: "#64ecff",
                    flexShrink: 0,
                  }}
                />
                <div>{cut(item, 62)}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              color: "#becde1",
              fontSize: 22,
              fontStyle: "italic",
              fontWeight: 700,
              marginTop: "auto",
              paddingTop: 30,
            }}
          >
            {cut(copy.flavorText, 100)}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {route.next
            .slice(0, 2)
            .map((event) =>
              routeCard(
                event.id,
                copy.futureLabel,
                event.title,
                formatLocation(event),
                "#64ecff",
              ),
            )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            color: "#8ea4bf",
            fontSize: 20,
            fontWeight: 800,
            marginTop: 8,
          }}
        >
          @duskdawolf • past paws → present chaos → future deployments
        </div>
      </div>
    </div>
  );

  try {
    const response = new ImageResponse(element, {
      width: WIDTH,
      height: HEIGHT,
    });

    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Next Stop text-layer render failed: ${message}`);
  }
}

async function mascotOverlay(
  brandConfig: BrandConfig,
): Promise<OverlayOptions | null> {
  if (
    !brandConfig.settings?.composite_mascot ||
    !brandConfig.primaryMascot
  ) {
    return null;
  }

  try {
    const source = await downloadBrandAssetBuffer(
      brandConfig.primaryMascot.storage_path,
    );

    const scale = Math.max(
      0.55,
      Math.min(1.6, Number(brandConfig.settings.mascot_scale || 1)),
    );

    const width = Math.round(330 * scale);
    const height = Math.round(400 * scale);
    const pos = mascotPosition(
      brandConfig.settings.mascot_placement,
      width,
      height,
    );

    const normalized = await sharp(source)
      .rotate()
      .resize({
        width,
        height,
        fit: "contain",
        withoutEnlargement: false,
      })
      .png()
      .toBuffer();

    return {
      input: normalized,
      left: pos.left,
      top: pos.top,
      blend: "over",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Dusk mascot composite failed: ${message}`);
  }
}

async function logoOverlay(
  brandConfig: BrandConfig,
): Promise<OverlayOptions | null> {
  if (
    !brandConfig.settings?.composite_logo ||
    !brandConfig.logo ||
    brandConfig.settings.logo_placement === "off"
  ) {
    return null;
  }

  try {
    const source = await downloadBrandAssetBuffer(
      brandConfig.logo.storage_path,
    );

    const scale = Math.max(
      0.4,
      Math.min(1.6, Number(brandConfig.settings.logo_scale || 1)),
    );

    const width = Math.round(190 * scale);
    const height = Math.round(145 * scale);
    const pos = brandLogoPosition(
      brandConfig.settings.logo_placement,
      width,
      height,
    );

    const normalized = await sharp(source)
      .rotate()
      .resize({
        width,
        height,
        fit: "contain",
        withoutEnlargement: false,
      })
      .png()
      .toBuffer();

    return {
      input: normalized,
      left: pos.left,
      top: pos.top,
      blend: "over",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Dusk logo composite failed: ${message}`);
  }
}

export async function composeNextStopPoster(args: {
  background: Buffer;
  route: RouteContext;
  copy: NextStopCopy;
  brandConfig?: BrandConfig | null;
}) {
  const { background, route, copy, brandConfig } = args;

  // ImageResponse handles only typography and UI shapes now.
  const textOverlay = await buildTextOverlay(route, copy);

  const overlays: OverlayOptions[] = [
    {
      input: textOverlay,
      left: 0,
      top: 0,
      blend: "over",
    },
  ];

  if (
    brandConfig?.settings?.use_brand_assets_in_next_stop
  ) {
    // Render official art AFTER the UI layer so it remains visually exact.
    // This intentionally makes the uploaded asset the strongest identity anchor.
    const mascot = await mascotOverlay(brandConfig);
    if (mascot) overlays.push(mascot);

    const logo = await logoOverlay(brandConfig);
    if (logo) overlays.push(logo);
  }

  try {
    return await sharp(background)
      .rotate()
      .resize(WIDTH, HEIGHT, { fit: "cover" })
      .composite(overlays)
      .webp({ quality: 92 })
      .toBuffer();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Next Stop final composite failed: ${message}`);
  }
}
