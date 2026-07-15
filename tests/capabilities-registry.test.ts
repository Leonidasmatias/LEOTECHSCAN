// STAGE 0 -- WP0.10 Initial Automated Tests (10 of 10).
// Covers WP0.3 Capability Truth Registry + WP0.4/WP0.12 badge rollout. Scans every component
// file for capabilityKey="..." literals and asserts each one resolves to a real entry in
// config/capabilities.json with a status from the allowed vocabulary -- catching the case where
// a screen references a capability key that was renamed or removed from the registry (a badge
// silently rendering nothing is exactly the kind of truth-baseline regression Stage 0 exists to
// prevent). Reads only source files already in the repo -- no network, no database.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import capabilitiesRegistry from "@/config/capabilities.json";

const ALLOWED_STATUSES = ["operational", "partial", "simulated", "disabled", "planned", "unavailable"];

function findComponentFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return findComponentFiles(full);
    return entry.name.endsWith(".tsx") ? [full] : [];
  });
}

function extractCapabilityKeys(componentsDir: string): Set<string> {
  const keys = new Set<string>();
  for (const file of findComponentFiles(componentsDir)) {
    const content = fs.readFileSync(file, "utf8");
    for (const match of content.matchAll(/capabilityKey=\{?"([a-z0-9_]+)"\}?/g)) {
      keys.add(match[1]);
    }
  }
  return keys;
}

describe("Capability Truth Registry consistency (WP0.3 / WP0.4 / WP0.12)", () => {
  it("test 10/10: every capabilityKey referenced in a component resolves to a registered entry with a valid status", () => {
    const componentsDir = path.resolve(__dirname, "..", "components");
    const referencedKeys = extractCapabilityKeys(componentsDir);
    const registry = (capabilitiesRegistry as { capabilities: Array<{ key: string; status: string }> }).capabilities;
    const registryKeys = new Set(registry.map((entry) => entry.key));

    expect(referencedKeys.size).toBeGreaterThan(0); // sanity: the scan itself must find something

    const missing = [...referencedKeys].filter((key) => !registryKeys.has(key));
    expect(missing).toEqual([]);

    for (const entry of registry) {
      expect(ALLOWED_STATUSES).toContain(entry.status);
    }
  });
});
