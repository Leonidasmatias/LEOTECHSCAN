import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { getWritableDb } from "@/lib/db";
import { csvRows } from "@/utils/csv";
import { simplePdf } from "@/utils/pdf";
import { dossierLines, evidenceCenterForSite } from "@/services/evidence-center-engine";
import { recordAudit } from "@/services/audit-trail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get("id") || 0);
    const format = request.nextUrl.searchParams.get("format") || "csv";
    const db = getWritableDb();
    const dossier = evidenceCenterForSite(db, id, true);
    if (!dossier) return NextResponse.json({ error: "Site nao encontrado." }, { status: 404 });
    const exportDir = path.resolve(process.cwd(), "..", "EXPORTACOES");
    await mkdir(exportDir, { recursive: true });
    if (format === "pdf") {
      const pdf = simplePdf(`Dossie Tecnico - ${dossier.site.site}`, dossierLines(dossier));
      const out = path.join(exportDir, "site_technical_dossier.pdf");
      await writeFile(out, pdf);
      recordAudit(db, "DOSSIER_EXPORTED", "site", id, `Dossie tecnico PDF gerado para ${dossier.site.site}`, { format });
      return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="site_technical_dossier.pdf"` } });
    }
    const rows = [["CAMPO","VALOR"], ...dossierLines(dossier).map((line) => {
      const index = line.indexOf(":");
      return index > -1 ? [line.slice(0, index), line.slice(index + 1).trim()] : ["INFO", line];
    })];
    const out = path.join(exportDir, "telecom_evidence_center.csv");
    await writeFile(out, csvRows(rows), { encoding: "utf8" });
    recordAudit(db, "DOSSIER_EXPORTED", "site", id, `Dossie tecnico CSV gerado para ${dossier.site.site}`, { format });
    return new NextResponse(Readable.toWeb(createReadStream(out)) as ReadableStream, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="telecom_evidence_center.csv"` } });
  } catch (error) {
    console.error("evidence_center_export_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Exportacao do dossie indisponivel." }, { status: 500 });
  }
}
