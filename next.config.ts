import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // React Strict Mode is now compatible with Fabric.js
  // Canvas element is created dynamically in useCanvasInit
  // React 严格模式现在与 Fabric.js 兼容
  // Canvas 元素在 useCanvasInit 中动态创建
  reactStrictMode: false,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
}

export default nextConfig
