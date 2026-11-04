import { NextResponse } from "next/server";
import { isResponse, requireMember } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quem está logado (confere o token e a lista `equipe`). */
export async function GET(request: Request) {
  const member = await requireMember(request);
  if (isResponse(member)) return member;
  return NextResponse.json(member);
}
