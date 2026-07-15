import { NextRequest, NextResponse } from "next/server";
import { getWritableDb } from "@/lib/db";
import { recalculateDataTrust } from "@/services/data-trust-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(5000, Math.max(1, Number(body.limit || 500)));
    return NextResponse.json(recalculateDataTrust(getWritableDb(), limit));
  } catch (error) {
    console.error("data_trust_recalculate_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Recalculo Data Trust indisponivel." }, { status: 500 });
  }
}
