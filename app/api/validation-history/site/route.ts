import { NextRequest, NextResponse } from "next/server";
import { getWritableDb } from "@/lib/db";
import { validationHistory } from "@/services/data-trust-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get("id") || 0);
    return NextResponse.json({ history: validationHistory(getWritableDb(), id) });
  } catch (error) {
    console.error("validation_history_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Historico de validacao indisponivel." }, { status: 500 });
  }
}
