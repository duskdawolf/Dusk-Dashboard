import { NextRequest, NextResponse } from 'next/server';
import { alpha7ErrorResponse, requireAlpha7Admin } from '@/lib/alpha7/auth';
import { getBrandConfig, uploadBrandAsset } from '@/lib/alpha71/brand-assets';

const MAX_BYTES = 8 * 1024 * 1024;

export async function GET() {
  try {
    const user = await requireAlpha7Admin();
    const config = await getBrandConfig(user.id);
    return NextResponse.json(config);
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAlpha7Admin();
    const form = await request.formData();
    const label = String(form.get('label') ?? '').trim();
    const assetKind = String(form.get('assetKind') ?? '').trim() as 'mascot_art'|'logo'|'style_ref';
    const file = form.get('file');

    if (!label || !assetKind || !(file instanceof File)) {
      return NextResponse.json({ error: 'label, assetKind, and file are required.' }, { status: 400 });
    }
    if (!['mascot_art','logo','style_ref'].includes(assetKind)) {
      return NextResponse.json({ error: 'Invalid asset kind.' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Use an image file up to 8 MB.' }, { status: 400 });
    }
    if (!['image/png','image/webp','image/jpeg'].includes(file.type)) {
      return NextResponse.json({ error: 'Use PNG, WebP, or JPG.' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const asset = await uploadBrandAsset({
      userId: user.id,
      fileName: file.name,
      mimeType: file.type,
      bytes,
      assetKind,
      label,
    });

    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
