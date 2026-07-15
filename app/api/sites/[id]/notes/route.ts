import { NextRequest, NextResponse } from "next/server";
import { getWritableDb } from "@/lib/db";
import { addSiteNote, getSiteNotes } from "@/services/site-notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ notes: getSiteNotes(getWritableDb(), Number(id)) });
  } catch (error) {
    console.error("site_notes_read_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Notas indisponiveis." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const note = addSiteNote(getWritableDb(), Number(id), String(body.note || ""));
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("site_notes_write_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Nao foi possivel registrar a observacao." }, { status: 400 });
  }
}
