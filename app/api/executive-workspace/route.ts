import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { executiveWorkspace } from "@/services/enterprise-v3-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(executiveWorkspace(getDb()));
  } catch (error) {
    console.error("executive_workspace_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Executive Workspace indisponivel." }, { status: 500 });
  }
}
