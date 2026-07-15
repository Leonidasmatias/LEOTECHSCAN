import type { DatabaseSync } from "node:sqlite";
import { copernicusForSite, ensureCopernicusTables } from "@/services/copernicus-engine";

export function satelliteValidationForSite(db: DatabaseSync, siteId: number) {
  ensureCopernicusTables(db);
  const latest = db.prepare("SELECT validation_score validationScore,recent_scene_available recentSceneAvailable,evidence_level evidenceLevel,recommendation,created_at createdAt FROM site_satellite_validation WHERE site_id = ? ORDER BY id DESC LIMIT 1").get(siteId) as Record<string, unknown> | undefined;
  const lastScene = db.prepare("SELECT acquisition_date acquisitionDate,scene_id sceneId,orbit_direction orbitDirection,polarization FROM copernicus_scenes WHERE site_id = ? ORDER BY acquisition_date DESC LIMIT 1").get(siteId) as Record<string, unknown> | undefined;
  if (latest) {
    return {
      satelliteValidationScore: Number(latest.validationScore || 0),
      recentSceneAvailable: Boolean(latest.recentSceneAvailable),
      evidenceLevel: String(latest.evidenceLevel || "Insuficiente"),
      lastSceneDate: String(lastScene?.acquisitionDate || ""),
      validationRecommendation: String(latest.recommendation || ""),
      scene: lastScene || null,
    };
  }
  const generated = copernicusForSite(db, siteId, undefined, undefined, true);
  return {
    satelliteValidationScore: Number(generated?.validation.validationScore || 0),
    recentSceneAvailable: Boolean(generated?.validation.recentSceneAvailable),
    evidenceLevel: String(generated?.validation.evidenceLevel || "Insuficiente"),
    lastSceneDate: String(generated?.scenes[0]?.acquisitionDate || ""),
    validationRecommendation: String(generated?.recommendation || "Sem evidencia Copernicus disponivel."),
    scene: generated?.scenes[0] || null,
  };
}
