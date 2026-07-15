# Stage 0 — Capability Truth Registry (WP0.3 / WP0.4 / WP0.12)

## The problem this solves

Before Stage 0, whether a screen's data was real, derived, or entirely synthetic was decided independently by whoever wrote that screen, with no shared vocabulary and no single place to check. The Copernicus/Sentinel-1 screens were the worst offender (see WP0.4 below) but not the only one.

## The registry

`config/capabilities.json` is now the single source of truth for what every screen in the app can honestly claim about itself. Shape:

```json
{
  "schemaVersion": "...",
  "generatedBy": "...",
  "note": "...",
  "capabilities": [
    {
      "key": "mission_control",
      "displayName": "Mission Control",
      "status": "operational",
      "evidenceType": "real_data",
      "backendAvailable": true,
      "dataSource": "sites (SQLite local)",
      "limitations": "...",
      "lastValidatedAt": "2026-07-15"
    }
  ]
}
```

`status` is one of six values: `operational`, `partial`, `simulated`, `disabled`, `planned`, `unavailable`. As of this stage, the 22 entries break down as:

- **operational (5):** mission_control, alert_center, market_intelligence, data_quality, telecom_ai
- **partial (10):** site_mapping, rollout_intelligence, opportunities, duplicate_detection, national_timeline, digital_twin, strategic_planning, scenario_planner, advanced_gis, sentinel_core
- **simulated (5):** copernicus_catalogue, sentinel_1_metadata, data_trust, evidence_center, intelligence_graph
- **unavailable (2):** sentinel_1_processing, sentinel_1_change_detection
- **disabled / planned (0 each):** reserved for future use; no current capability needs them.

(Run `GET /api/system-health` for a live count — WP0.11 surfaces this same breakdown at runtime.)

## How screens use it

`components/CapabilityBadge.tsx` exports:
- `getCapability(key)` — looks up an entry by key.
- `<CapabilityBadge capabilityKey="..." />` — a small colored pill (color keyed to status via `.cap-*` CSS classes in `app/globals.css`) showing the status label (e.g. "SIMULADO", "OPERACIONAL").
- `<CapabilityNote capabilityKey="..." />` — the badge plus the entry's `limitations` text, for screens where a one-line caveat matters more than just a pill.

No screen hardcodes a status string. If a capability's real status changes, updating `capabilities.json` updates every badge referencing that key automatically — there is exactly one place to edit.

## WP0.12 coverage

Every one of the 22 registry keys is now referenced by at least one `capabilityKey="..."` usage somewhere in `components/`. This is verified automatically, not just asserted: `tests/capabilities-registry.test.ts` scans every `.tsx` file under `components/` for `capabilityKey="..."` literals and asserts (a) every referenced key exists in the registry and (b) every registry entry's `status` is one of the six allowed values. If a screen is renamed and its capability key becomes stale, or a new screen references a key that doesn't exist yet, this test catches it.

Two entries — `sentinel_1_processing` and `sentinel_1_change_detection` — have no dedicated screen of their own, because neither feature exists anywhere in this codebase yet. Rather than leave them unreferenced (which the old registry-consistency bar would have still passed, since "referenced in UI" was only checked one direction), Stage 0 added them explicitly, marked `unavailable`, in the Copernicus screen's governance panel — the place a user would naturally look for "what about SAR processing / change detection." That is the more honest choice than saying nothing.

## What this does not do

The registry records what Stage 0's audit determined to be true as of `lastValidatedAt`. It is not automatically kept in sync with the underlying code — if `services/copernicus-engine.ts` changes again in Stage 1+, whoever makes that change is responsible for updating `capabilities.json` to match. Nothing enforces that link mechanically yet; that would be a reasonable Stage 1+ backlog item, not something Stage 0 claims to have solved.
