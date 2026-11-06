import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // One canonical host. safecampus.net and www.safecampus.net both
      // served the site, and Supabase's session cookies are per-host, so
      // someone who signed in on one appeared signed out on the other —
      // and every email link now points at www (lib/siteUrl.ts). Done here
      // rather than in Vercel's domain settings so it lives in version
      // control and can't be lost in the dashboard.
      //
      // /api/ is excluded on purpose. Stripe, SignalWire and Planning Center
      // may have webhook or callback URLs registered against the apex, and
      // they don't follow redirects: a 308 there would silently drop
      // payment and SMS events rather than move them.
      {
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: "safecampus.net" }],
        destination: "https://www.safecampus.net/:path",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
