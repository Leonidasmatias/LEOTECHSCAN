// Type declarations for services/geospatial/spatial-index-sql.mjs.
//
// The implementation is deliberately plain .mjs, not .ts (see the header
// comment in spatial-index-sql.mjs for why: it needs to be importable both
// by scripts/geospatial-spatial-index.mjs via a relative path, outside the
// Next.js/Vite toolchain, and by tests/geospatial-spatial-index.test.ts via
// the "@/" alias through Vitest -- converting it to .ts would require a
// build step neither consumer has). TypeScript does not infer types across
// a bare .mjs file the way it does for .ts, so `npx tsc --noEmit` reported
// "Could not find a declaration file for module
// '@/services/geospatial/spatial-index-sql.mjs'" for every .ts file that
// imports it. This sibling .d.mts file (TypeScript's supported declaration
// counterpart for a .mjs implementation file) describes the real, exact
// exports -- each one is a plain string constant, precisely typed as
// `string`, not `any` -- so both the production adapter
// (scripts/geospatial-spatial-index.mjs) and the test file get full type
// checking against the real shape of this module with no broad `declare
// module "*"` wildcard and no `as any`.

export declare const SITE_SPATIAL_INDEX_TABLE: string;
export declare const SITE_SPATIAL_INDEX_FALLBACK_INDEX: string;
export declare const CREATE_SITE_SPATIAL_INDEX_RTREE_SQL: string;
export declare const CREATE_SITE_SPATIAL_INDEX_FALLBACK_SQL: string;
export declare const INSERT_SITE_SPATIAL_INDEX_ROW_SQL: string;
export declare const DROP_SITE_SPATIAL_INDEX_SQL: string;
