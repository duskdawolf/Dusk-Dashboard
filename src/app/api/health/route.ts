import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    supabaseConfigured: supabaseConfigured(),
    service: "dusk-industries",
  });
}
