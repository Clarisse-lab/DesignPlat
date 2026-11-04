import { NextResponse } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Público: o navegador precisa do endereço e da chave publishable do Supabase para o login Google. */
export async function GET() {
  return NextResponse.json(
    supabaseConfigured() ? { login: true, supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY } : { login: false },
    { headers: { "Cache-Control": "no-store" } },
  );
}
