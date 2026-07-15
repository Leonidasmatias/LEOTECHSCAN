import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { duplicateCandidates } from "@/services/duplicates-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(duplicateCandidates(getDb()));
  } catch (error) {
    console.error("duplicates_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Analise de duplicidades indisponivel." }, { status: 500 });
  }
}
