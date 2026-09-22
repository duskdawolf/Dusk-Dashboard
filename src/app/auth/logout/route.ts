import { NextResponse } from "next/server";
import { createUserSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createUserSupabaseClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
