import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
} from "@/lib/supabase/config";

const Schema = z.object({
  password: z.string().min(1).max(500),
  purpose: z.string().min(1).max(160).default("chaos-sensitive-action"),
});

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  const user = await getDashboardUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = Schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  const authClient = createClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const { error } = await authClient.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.password,
  });

  if (error) {
    return NextResponse.json(
      {
        error:
          "Supabase reauthentication failed. Check the current account password.",
      },
      { status: 403 },
    );
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const supabase = createAdminSupabaseClient();

  const { error: grantError } = await supabase
    .from("security_grants")
    .insert({
      user_id: user.id,
      purpose: parsed.data.purpose,
      token_hash: hashToken(token),
      method: "supabase-password",
      expires_at: expiresAt,
    });

  if (grantError) {
    return NextResponse.json(
      { error: "Could not create reauthentication grant." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    grant: token,
    expiresAt,
  });
}
