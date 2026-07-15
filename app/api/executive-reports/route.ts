import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { getDb, getWritableDb } from "@/lib/db";
import { csvRows } from "@/utils/csv";
import { simplePdf } from "@/utils/pdf";
import { executiveReportRows } from "@/services/enterprise-v3-engine";
import { copernicusCsvRows } from "@/services/copernicus-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  "resumo-executivo-nacional": "Resumo Executivo Nacional",
  "comparativo-tim-vivo": "Comparativo TIM x VIVO",
  "oportunidades-expansao": "Oportunidades de Expansao",
  "qualidade-cadastral": "Qualidade Cadastral",
  "planejamento-rollout": "Planejamento de Rollout",
  "alertas-criticos": "Alertas Criticos",
  "ranking-municipios": "Ranking de Municipios",
  "strategic-planning-report": "Strategic Planning Report",
  "scenario-planner-report": "Scenario Planner Report",
  "copernicus-site-validation": "Copernicus Site Validation Report",
};

function filename(type: string, format: string) {
  if (type === "resumo-executivo-nacional") return format === "csv" ? "executive_report_summary.csv" : "executive_report_summary.pdf";
  if (type === "copernicus-site-validation") return format === "csv" ? "copernicus_site_validation.csv" : "copernicus_site_validation.pdf";
  return `${type.replace(/-/g, "_")}.${format}`;
}

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get("type") || "resumo-executivo-nacional";
    const format = request.nextUrl.searchParams.get("format") || "csv";
    if (!labels[type]) return NextResponse.json({ error: "Tipo de relatorio invalido." }, { status: 400 });
    const rows = type === "copernicus-site-validation" ? copernicusCsvRows(getWritableDb()) : executiveReportRows(getDb(), type);
    const exportDir = path.resolve(process.cwd(), "..", "EXPORTACOES");
    await mkdir(exportDir, { recursive: true });
    if (format === "pdf") {
      const pdf = simplePdf(labels[type], rows.slice(0, 35).map((row) => row.join(" | ")));
      const out = path.join(exportDir, filename(type, "pdf"));
      await writeFile(out, pdf);
      return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${path.basename(out)}"` } });
    }
    const out = path.join(exportDir, filename(type, "csv"));
    await writeFile(out, csvRows(rows), { encoding: "utf8" });
    return new NextResponse(Readable.toWeb(createReadStream(out)) as ReadableStream, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${path.basename(out)}"` } });
  } catch (error) {
    console.error("executive_report_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Relatorio executivo indisponivel." }, { status: 500 });
  }
}
