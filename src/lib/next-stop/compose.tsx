import React from 'react';
import { ImageResponse } from 'next/og';
import sharp, { type OverlayOptions } from 'sharp';
import { formatLocation } from './format';
import type { NextStopCopy, RouteContext } from './types';
import type { BrandConfig } from '@/lib/alpha71/types';
import { downloadBrandAssetBuffer } from '@/lib/alpha71/brand-assets';

const WIDTH = 1152;
const HEIGHT = 2048;

function cut(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function routeCard(key: string, label: string, title: string, location: string, accent: string) {
  return (
    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 7, border: `3px solid ${accent}`, borderRadius: 30, background: 'rgba(7,16,27,.84)', padding: '24px 34px', minHeight: 160, justifyContent: 'center' }}>
      <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: accent }}>{label}</div>
      <div style={{ fontSize: 40, lineHeight: 1.05, fontWeight: 900, color: 'white' }}>{cut(title, 64)}</div>
      <div style={{ fontSize: 23, fontWeight: 700, color: '#b9c9dd' }}>{cut(location, 70)}</div>
    </div>
  );
}

function overlayPlacement(placement: 'hero_left'|'hero_right'|'center_low'|undefined, width: number, height: number) {
  if (placement === 'hero_right') return { left: 710, top: 835, width, height };
  if (placement === 'center_low') return { left: 376, top: 1180, width, height };
  return { left: 65, top: 840, width, height };
}

function logoPlacement(placement: 'footer_right'|'footer_left'|'header_right'|'off'|undefined, width: number, height: number) {
  if (placement === 'header_right') return { left: WIDTH - width - 62, top: 64, width, height };
  if (placement === 'footer_left') return { left: 62, top: HEIGHT - height - 72, width, height };
  return { left: WIDTH - width - 62, top: HEIGHT - height - 72, width, height };
}

export async function composeNextStopPoster(args: {
  background: Buffer;
  route: RouteContext;
  copy: NextStopCopy;
  brandConfig?: BrandConfig | null;
}) {
  const { background, route, copy, brandConfig } = args;
  const backgroundUrl = `data:image/webp;base64,${background.toString('base64')}`;

  const element = (
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden', background: '#07101b', color: 'white', fontFamily: 'sans-serif' }}>
      <img src={backgroundUrl} alt="" width={WIDTH} height={HEIGHT} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', background: 'linear-gradient(180deg, rgba(4,9,19,.35), rgba(4,9,19,.28) 35%, rgba(4,9,19,.58))' }} />
      <div style={{ position: 'absolute', inset: '48px 72px 34px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ color: '#64ecff', fontSize: 25, fontWeight: 900, letterSpacing: 5 }}>DUSK INDUSKRIES</div>
          <div style={{ color: 'white', fontSize: 55, lineHeight: 1, fontWeight: 900, textAlign: 'center' }}>{copy.headline}</div>
          <div style={{ color: '#c7d4e6', fontSize: 22, fontWeight: 700, textAlign: 'center' }}>{cut(copy.subheadline, 90)}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {route.previous.slice(-2).map((event) => routeCard(event.id, copy.pastLabel, event.title, formatLocation(event), '#b58cff'))}
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 720, flexDirection: 'column', border: '4px solid #ff5ca8', borderRadius: 48, background: 'rgba(6,12,23,.82)', padding: '42px 48px', marginTop: 14, marginBottom: 14 }}>
          <div style={{ color: '#64ecff', fontSize: 26, fontWeight: 900, letterSpacing: 3, textTransform: 'uppercase' }}>{copy.currentEventKicker}</div>
          <div style={{ color: 'white', fontSize: 76, lineHeight: 0.98, fontWeight: 900, marginTop: 18 }}>{copy.currentEventTitle}</div>
          <div style={{ color: '#ff87be', fontSize: 34, fontWeight: 900, marginTop: 25 }}>{copy.locationLine}</div>
          <div style={{ color: '#d8e4f2', fontSize: 28, fontWeight: 800, marginTop: 7 }}>{copy.dateLine}</div>
          <div style={{ color: '#64ecff', fontSize: 28, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', marginTop: 42 }}>{copy.findMeTitle}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 19 }}>
            {copy.findMeItems.slice(0, 4).map((item, index) => (
              <div key={`${item}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 15, color: '#f6f9ff', fontSize: 27, fontWeight: 700 }}>
                <div style={{ width: 13, height: 13, borderRadius: 99, background: '#64ecff', flexShrink: 0 }} />
                <div>{cut(item, 62)}</div>
              </div>
            ))}
          </div>
          <div style={{ color: '#becde1', fontSize: 22, fontStyle: 'italic', fontWeight: 700, marginTop: 'auto', paddingTop: 30 }}>{cut(copy.flavorText, 100)}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {route.next.slice(0, 2).map((event) => routeCard(event.id, copy.futureLabel, event.title, formatLocation(event), '#64ecff'))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', color: '#8ea4bf', fontSize: 20, fontWeight: 800, marginTop: 8 }}>
          @duskdawolf • past paws → present chaos → future deployments
        </div>
      </div>
    </div>
  );

  const response = new ImageResponse(element, { width: WIDTH, height: HEIGHT });
  const png = Buffer.from(await response.arrayBuffer());
  let image = sharp(png);

  if (brandConfig?.settings?.use_brand_assets_in_next_stop) {
    const composites: OverlayOptions[] = [];

    if (brandConfig.settings.composite_mascot && brandConfig.primaryMascot) {
      const mascot = await downloadBrandAssetBuffer(brandConfig.primaryMascot.storage_path);
      const scale = Math.max(0.55, Math.min(1.6, Number(brandConfig.settings.mascot_scale || 1)));
      const width = Math.round(300 * scale);
      const height = Math.round(300 * scale);
      const place = overlayPlacement(brandConfig.settings.mascot_placement, width, height);
      composites.push({ input: await sharp(mascot).resize({ width, height, fit: 'contain' }).png().toBuffer(), left: place.left, top: place.top, blend: 'over' });
    }

    if (brandConfig.settings.composite_logo && brandConfig.logo && brandConfig.settings.logo_placement !== 'off') {
      const logo = await downloadBrandAssetBuffer(brandConfig.logo.storage_path);
      const scale = Math.max(0.4, Math.min(1.6, Number(brandConfig.settings.logo_scale || 1)));
      const width = Math.round(180 * scale);
      const height = Math.round(180 * scale);
      const place = logoPlacement(brandConfig.settings.logo_placement, width, height);
      composites.push({ input: await sharp(logo).resize({ width, height, fit: 'contain' }).png().toBuffer(), left: place.left, top: place.top, blend: 'over' });
    }

    if (composites.length) {
      image = image.composite(composites);
    }
  }

  return image.webp({ quality: 92 }).toBuffer();
}
