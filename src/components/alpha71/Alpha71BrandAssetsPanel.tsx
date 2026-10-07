"use client";

import { useEffect, useMemo, useState } from 'react';

type Asset = {
  id: string;
  label: string;
  asset_kind: 'mascot_art' | 'logo' | 'style_ref';
  created_at: string;
};

type Settings = {
  primary_mascot_asset_id: string | null;
  secondary_mascot_asset_id: string | null;
  logo_asset_id: string | null;
  use_brand_assets_in_next_stop: boolean;
  composite_mascot: boolean;
  composite_logo: boolean;
  mascot_scale: number;
  logo_scale: number;
  mascot_placement: 'hero_left' | 'hero_right' | 'center_low';
  logo_placement: 'footer_right' | 'footer_left' | 'header_right' | 'off';
};

const defaults: Settings = {
  primary_mascot_asset_id: null,
  secondary_mascot_asset_id: null,
  logo_asset_id: null,
  use_brand_assets_in_next_stop: true,
  composite_mascot: true,
  composite_logo: true,
  mascot_scale: 1,
  logo_scale: 1,
  mascot_placement: 'hero_left',
  logo_placement: 'footer_right',
};

export function Alpha71BrandAssetsPanel() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [settings, setSettings] = useState<Settings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');
  const [assetKind, setAssetKind] = useState<'mascot_art'|'logo'|'style_ref'>('mascot_art');
  const [file, setFile] = useState<File | null>(null);

  const mascotAssets = useMemo(() => assets.filter((a) => a.asset_kind === 'mascot_art'), [assets]);
  const logoAssets = useMemo(() => assets.filter((a) => a.asset_kind === 'logo'), [assets]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/alpha71/brand-assets', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not load brand assets');
      setAssets(json.assets ?? []);
      setSettings({ ...defaults, ...(json.settings ?? {}) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load brand assets');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !file) return;
    setSaving(true);
    setError('');
    try {
      const form = new FormData();
      form.set('label', label.trim());
      form.set('assetKind', assetKind);
      form.set('file', file);
      const res = await fetch('/api/alpha71/brand-assets', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not upload asset');
      setLabel('');
      setFile(null);
      const input = document.getElementById('alpha71-brand-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload asset');
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings(next: Partial<Settings>) {
    const merged = { ...settings, ...next };
    setSettings(merged);
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/alpha71/brand-settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(merged),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not save brand settings');
      setSettings({ ...defaults, ...(json.settings ?? {}) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save brand settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-pink-400/20 bg-gradient-to-br from-pink-400/5 via-violet-400/5 to-cyan-300/5 p-5 md:p-6">
      <div className="text-xs font-black uppercase tracking-[.2em] text-pink-300">Alpha v30</div>
      <h2 className="mt-1 text-2xl font-black text-white">Brand Reference Assets</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-400">
        Upload official Dusk art and the Dusk Induskries logo. Alpha 7.1 can use them as persistent brand anchors and can directly composite them into each Next Stop poster for maximum visual consistency.
      </p>

      {error ? <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div> : null}

      <form onSubmit={upload} className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Asset label"
            className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white placeholder:text-slate-600"
          />
          <select
            value={assetKind}
            onChange={(e) => setAssetKind(e.target.value as any)}
            className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
          >
            <option value="mascot_art">Mascot art</option>
            <option value="logo">Logo</option>
            <option value="style_ref">Style reference</option>
          </select>
          <input
            id="alpha71-brand-file"
            type="file"
            accept="image/png,image/webp,image/jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-slate-300"
          />
        </div>
        <div className="text-xs text-slate-500">
          Best results: upload a clean transparent PNG for Dusk mascot art and a transparent logo file if you have one.
        </div>
        <button type="submit" disabled={saving || !label.trim() || !file} className="w-fit rounded-xl bg-pink-400 px-4 py-3 text-sm font-black text-white disabled:opacity-40">
          {saving ? 'Saving…' : 'Upload Brand Asset'}
        </button>
      </form>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-sm font-black text-white">Choose official anchors</div>
          <div className="mt-3 grid gap-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-400">Primary Dusk art</label>
            <select value={settings.primary_mascot_asset_id ?? ''} onChange={(e) => saveSettings({ primary_mascot_asset_id: e.target.value || null })} className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white">
              <option value="">None</option>
              {mascotAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.label}</option>)}
            </select>

            <label className="text-xs font-black uppercase tracking-wider text-slate-400">Secondary Dusk art</label>
            <select value={settings.secondary_mascot_asset_id ?? ''} onChange={(e) => saveSettings({ secondary_mascot_asset_id: e.target.value || null })} className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white">
              <option value="">None</option>
              {mascotAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.label}</option>)}
            </select>

            <label className="text-xs font-black uppercase tracking-wider text-slate-400">Logo</label>
            <select value={settings.logo_asset_id ?? ''} onChange={(e) => saveSettings({ logo_asset_id: e.target.value || null })} className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white">
              <option value="">None</option>
              {logoAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.label}</option>)}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-sm font-black text-white">Next Stop behavior</div>
          <div className="mt-3 grid gap-3 text-sm text-slate-300">
            <label className="flex items-center gap-3"><input type="checkbox" checked={settings.use_brand_assets_in_next_stop} onChange={(e) => saveSettings({ use_brand_assets_in_next_stop: e.target.checked })} /> Use brand assets in Next Stop generation</label>
            <label className="flex items-center gap-3"><input type="checkbox" checked={settings.composite_mascot} onChange={(e) => saveSettings({ composite_mascot: e.target.checked })} /> Composite official Dusk art directly into the poster</label>
            <label className="flex items-center gap-3"><input type="checkbox" checked={settings.composite_logo} onChange={(e) => saveSettings({ composite_logo: e.target.checked })} /> Composite the Dusk Induskries logo into the poster</label>

            <label className="text-xs font-black uppercase tracking-wider text-slate-400">Mascot placement</label>
            <select value={settings.mascot_placement} onChange={(e) => saveSettings({ mascot_placement: e.target.value as any })} className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white">
              <option value="hero_left">Hero left</option>
              <option value="hero_right">Hero right</option>
              <option value="center_low">Center low</option>
            </select>

            <label className="text-xs font-black uppercase tracking-wider text-slate-400">Logo placement</label>
            <select value={settings.logo_placement} onChange={(e) => saveSettings({ logo_placement: e.target.value as any })} className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white">
              <option value="footer_right">Footer right</option>
              <option value="footer_left">Footer left</option>
              <option value="header_right">Header right</option>
              <option value="off">Off</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-5 text-xs text-slate-500">
        Uploaded assets: {loading ? 'loading…' : assets.length}. Strongest workflow: use a transparent PNG of official Dusk art as the primary mascot asset, plus your logo as the logo asset.
      </div>
    </section>
  );
}
