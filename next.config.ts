import type { NextConfig } from "next";

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = withPWA({
  reactStrictMode: true,
  experimental: {
    turbo: {
      rules: {},
    },
  },
  images: {
    domains: [],
  },
});

module.exports = nextConfig;
