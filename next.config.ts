import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === 'production';

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: !isProduction,
});

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
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
      "www.delishkitchen.tv",
      // クラシル
      "kurashiru.com",
      "video.kurashiru.com",
      "image.kurashiru.com",
      //　白ごはん.com
      "sirogohan.com",
      "image.sirogohan.com",
      "www.sirogohan.com",
      // その他
      "placehold.jp"
    ],
  },
};

module.exports = isProduction ? withPWA(nextConfig) : nextConfig;
