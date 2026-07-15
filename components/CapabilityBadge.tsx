"use client";

// STAGE 0 — Truthful Capability Badges (WP0.4 / WP0.12).
//
// Single source of truth: every badge reads its status straight from
// config/capabilities.json (the Capability Truth Registry created in WP0.3).
// No screen should hardcode a status string — if a capability's real status
// changes, update capabilities.json and every badge referencing that key
// updates automatically. See docs/stage-0/02_CAPABILITY_REGISTRY.md.

import capabilitiesRegistry from "@/config/capabilities.json";

export type CapabilityStatus = "operational" | "partial" | "simulated" | "disabled" | "planned" | "unavailable";

type CapabilityEntry = {
  key: string;
  displayName: string;
  status: CapabilityStatus;
  evidenceType: string;
  backendAvailable: boolean;
  dataSource: string;
  limitations: string;
  lastValidatedAt: string;
};

const REGISTRY = (capabilitiesRegistry as { capabilities: CapabilityEntry[] }).capabilities;

const STATUS_LABEL: Record<CapabilityStatus, string> = {
  operational: "OPERACIONAL",
  partial: "PARCIAL",
  simulated: "SIMULADO",
  disabled: "DESATIVADO",
  planned: "PLANEJADO",
  unavailable: "INDISPONIVEL",
};

export function getCapability(key: string): CapabilityEntry | undefined {
  return REGISTRY.find((entry) => entry.key === key);
}

export function CapabilityBadge({ capabilityKey, showLabel = true }: { capabilityKey: string; showLabel?: boolean }) {
  const entry = getCapability(capabilityKey);
  if (!entry) return null;
  return (
    <span
      className={`cap-badge cap-${entry.status}`}
      title={`${entry.displayName} · fonte: ${entry.dataSource} · ${entry.limitations}`}
    >
      {showLabel ? STATUS_LABEL[entry.status] || entry.status.toUpperCase() : null}
    </span>
  );
}

export function CapabilityNote({ capabilityKey }: { capabilityKey: string }) {
  const entry = getCapability(capabilityKey);
  if (!entry) return null;
  return (
    <p className="cap-note">
      <CapabilityBadge capabilityKey={capabilityKey} />
      <span>{entry.limitations}</span>
    </p>
  );
}
