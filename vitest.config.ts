// STAGE 0 -- WP0.10 Initial Automated Tests.
// Minimal Vitest config: no framework previously existed in this project. Path alias mirrors
// tsconfig.json's "@/*" mapping so tests can import the same modules the app uses.
import { defineConfig } from "vitest/config";
import path from "node:path";

// STAGE 0 test-environment fix (post-WP0.10 follow-up).
//
// Root cause: node:sqlite is a newer, still-experimental Node built-in. next.config.ts already
// tells Next's own bundler to leave it alone (`serverExternalPackages: ["node:sqlite"]`), which
// is why `npm run build` succeeds -- but that option is Next.js-specific and Vitest's own,
// separate Vite pipeline never reads next.config.ts at all. Without an equivalent instruction,
// Vitest's dependency resolution does not reliably recognize "node:sqlite" as a passthrough
// Node built-in (Node's own newer `isBuiltin()` check knows about it, but the older
// `builtinModules` list that bundlers have historically relied on for auto-externalization does
// not yet include it), so it was being treated as an ordinary package to resolve/bundle and
// failing. `lib/db.ts` is the only module with a real (non-type-only) `import { DatabaseSync }
// from "node:sqlite"`; every test file that imports anything from services/ eventually pulls
// that in transitively, even tests that never call getDb()/getWritableDb() -- so the whole
// suite needs this, not just one test file.
//
// This is a test-runner configuration gap only. It does not change what the application
// imports, how it behaves, or how the production build works -- it just tells Vitest to hand
// any "node:"-prefixed specifier straight to Node's native resolver, mirroring what
// next.config.ts already does for the real app. Declared both under test.server.deps.external
// (Vitest's own dependency-externalization list) and top-level ssr.external (Vite's SSR
// externalization, which Vitest also consults) for robustness across minor Vitest/Vite versions.
const NODE_BUILTIN_EXTERNAL = [/^node:/];

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    server: {
      deps: {
        external: NODE_BUILTIN_EXTERNAL,
      },
    },
  },
  ssr: {
    external: NODE_BUILTIN_EXTERNAL,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
