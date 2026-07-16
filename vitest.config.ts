import { defineConfig } from "vitest/config";
import path from "node:path";

// STAGE 0/1 test-environment note (superseded, kept for history -- see below).
//
// This config previously carried a `NODE_BUILTIN_EXTERNAL = [/^node:/]` value, applied to both
// `test.server.deps.external` and the top-level `ssr.external`, to work around node:sqlite not
// being reliably recognized as a passthrough Node built-in by Vitest's Vite-based dependency
// resolution (see docs/stage-0/05_TEST_BASELINE.md for the original failure and
// docs/stage-1/08_TEST_RESULTS.md for the Stage 1 recurrence against the geospatial module).
//
// That workaround was removed in the Checkpoint 2 typecheck fix, for two independent reasons:
//   1. It was never actually a reliable fix -- the whole reason Copernicus's and the geospatial
//      module's test files were split into a pure layer + a source-inspection layer (rather
//      than just being left as-is with this config in place) is that relying on Vitest
//      externalization for node:sqlite did not reliably prevent the collection failure across
//      this toolchain's versions. The architectural fix (pure/adapter split) is what actually
//      solved it; this config was redundant with that fix, not a substitute for it.
//   2. The installed Vitest version's top-level `ssr.external` field is typed `true | string[] |
//      undefined`, not `RegExp[]` -- so this config started failing `npx tsc --noEmit` outright
//      once type-checking was run against it (`Type 'RegExp[]' is not assignable to type "true |
//      string[] | undefined"`).
//
// As of this fix, every test file in tests/ has been confirmed (by direct inspection of its
// import graph) to import only pure, dependency-free modules or to source-inspect
// node:sqlite-touching scripts as plain text via fs.readFileSync -- never importing them as
// modules. None of the 12 current test files has any import path reaching node:sqlite, so no
// externalization configuration is required. If a future test file needs to import a module
// that transitively reaches node:sqlite, the correct fix is the same one already used for
// Copernicus and the geospatial module: split pure logic from the node:sqlite-touching
// adapter, rather than reintroducing this externalization workaround.
//
// GENESIS PHASE 0 RECOVERY NOTE: this file was found truncated (working tree cut off mid-comment,
// with the entire `export default defineConfig(...)` body missing) in the pre-repair working
// tree -- see docs/genesis-phase-0/02_RECOVERY_DECISIONS.md. The comment above is the original,
// genuinely-intended content (preserved as found). The `defineConfig` block below was
// reconstructed from that comment's own stated intent (drop NODE_BUILTIN_EXTERNAL and both
// `external` fields; keep everything else), not invented from scratch.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
