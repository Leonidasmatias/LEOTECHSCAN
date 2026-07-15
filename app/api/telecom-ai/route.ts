import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { answerTelecomQuestion } from "@/services/telecom-ai-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const question = request.nextUrl.searchParams.get("q") || "Gerar resumo executivo nacional";
  try {
    return NextResponse.json(answerTelecomQuestion(getDb(), question));
  } catch (error) {
    console.error("telecom_ai_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Telecom AI indisponivel." }, { status: 500 });
  }
}
