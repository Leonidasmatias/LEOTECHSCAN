import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { marketSnapshot } from "@/services/market-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(marketSnapshot(getDb()));
  } catch (error) {
    console.error("market_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Market Intelligence indisponivel." }, { status: 500 });
  }
}
