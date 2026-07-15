import { NextResponse } from "next/server";
import { getWritableDb } from "@/lib/db";
import { auditTrailRows } from "@/services/audit-trail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ events: auditTrailRows(getWritableDb(), 200) });
  } catch (error) {
    console.error("audit_trail_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Audit Trail indisponivel." }, { status: 500 });
  }
}
