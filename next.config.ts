import type { NextConfig } from "next";

// STAGE 0 -- WP0.7 Basic API Protection (audit-v4 risk R2 partial mitigation).
//
// This app has zero authentication today (see docs/stage-0/03_SECURITY_REMEDIATION.md and
// docs/audit-v4/13_RISK_REGISTER.md R2) -- that is NOT fixed by this change and is explicitly
// out of scope for Stage 0 (see docs/audit-v4/17_DECISION_LOG.md). These headers are a
// baseline, additive hardening layer against common browser-side attacks (clickjacking, MIME
// sniffing, referrer leakage, unwanted camera/mic/geolocation access from an embedded page).
// They do not add authentication, authorization, or rate limiting, and must never be
// represented as making this app production-secure for multi-user or public exposure.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["node:sqlite"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
