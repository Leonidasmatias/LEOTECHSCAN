import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { SITE_SELECT } from "@/api/site-query";
import { siteRow } from "@/services/site-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const id = Number(request.nextUrl.searchParams.get("id"));
  try {
    const raw = getDb().prepare(`SELECT ${SITE_SELECT} FROM sites WHERE id=?`).get(id) as Record<string, unknown> | undefined;
    if (!raw) return NextResponse.json({ error: "Site nao encontrado." }, { status: 404 });
    const site = siteRow(raw);
    const recommendations = [
      `Priorizar leitura de cobertura em ${site.municipio}/${site.uf}.`,
      `Validar redundancia de operadoras na regional ${site.regional}.`,
      site.latitude && site.longitude ? "Coordenadas validas para analise territorial." : "Corrigir coordenadas antes de planejamento.",
      site.operadoraOrigem === "VIVO" ? "Comparar sobreposicao com TIM no municipio." : "Comparar oportunidade VIVO no entorno.",
    ];
    return NextResponse.json({ site: site.site, recommendations, operationalScore: Math.round((site.oriScore + site.geoScore) / 2), expansionPotential: site.oriScore < 60 ? "Alto" : "Moderado", priority: site.oriScore >= 80 ? "Muito Alta" : site.oriScore >= 60 ? "Alta" : "Media" });
  } catch (error) {
    console.error("site_recommendation_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Recomendacao indisponivel." }, { status: 500 });
  }
}
