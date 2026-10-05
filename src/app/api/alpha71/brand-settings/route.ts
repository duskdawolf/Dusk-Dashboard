import { NextRequest, NextResponse } from 'next/server';
import { alpha7ErrorResponse, requireAlpha7Admin } from '@/lib/alpha7/auth';
import { updateBrandSettings } from '@/lib/alpha71/brand-assets';

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAlpha7Admin();
    const body = await request.json();
    const settings = await updateBrandSettings(user.id, body ?? {});
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
