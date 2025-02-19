import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
const withPWA = require('next-pwa')({
  dest: 'public', // ServiceWorkerやWorkboxファイルの生成先
  register: true,
  skipWaiting: true,
  // ここでキャッシュ戦略などを設定できる
})

module.exports = withPWA({
  // 通常のNext.js設定
  reactStrictMode: true,
})