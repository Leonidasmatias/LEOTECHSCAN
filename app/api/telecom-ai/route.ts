import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { answerTelecomQuestion } from "@/services/telecom-ai-engine";
import { clampQueryText } from "@/lib/request-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // WP0.7: free-text input is length-bounded before reaching the rule engine.
  const question = clampQueryText(request.nextUrl.searchParams.get("q"), 300, "Gerar resumo executivo nacional");
  try {
    return NextResponse.json(answerTelecomQuestion(getDb(), question));
  } catch (error) {
    console.error("telecom_ai_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Telecom AI indisponivel." }, { status: 500 });
  }
}
