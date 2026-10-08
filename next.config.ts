import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";
const config: NextConfig = {
  distDir: process.env.PESTLAUNCH_QA_DIST_DIR || ".next",
  agentRules: false,
  devIndicators: false,
  turbopack: { root: process.cwd() },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default withWorkflow(config);
