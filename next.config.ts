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
    domains: [
      // クックパッド
      "cookpad.com",
      "og-image.cookpad.com",
      "img.cpcdn.com",
      // デリッシュキッチン
      "delishkitchen.tv",
      "image.delishkitchen.tv",
      // クラシル
      "kurashiru.com",
      "video.kurashiru.com",
      "image.kurashiru.com",
      // その他
      "placehold.jp"
    ],
  },
});

module.exports = nextConfig;
