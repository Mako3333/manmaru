import type { NextConfig } from "next";

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
})

/** @type {import('next').NextConfig} */
const nextConfig = withPWA({
  reactStrictMode: true,
  images: {
    domains: [],
  },
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
})

module.exports = nextConfig