const runtimeCaching = require("next-pwa/cache");

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline",
  },
  additionalManifestEntries: [
    { url: "/offline", revision: "offline-v1" },
    { url: "/offline/venda", revision: "offline-v1" },
    { url: "/offline/receber", revision: "offline-v1" },
    { url: "/offline/despesa", revision: "offline-v1" },
  ],
  runtimeCaching,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: false,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

module.exports = withPWA(nextConfig);
