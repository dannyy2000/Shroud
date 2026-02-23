/** @type {import('next').NextConfig} */
import webpack from "webpack";

const nextConfig = {
  reactStrictMode: true,
  logging: {
    incomingRequests: false,
  },
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "identicon.starknet.id",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "img.starkurabu.com",
        pathname: "/**",
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  eslint: {
    ignoreDuringBuilds: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  webpack: (config, { dev, isServer }) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:(.*)$/, (resource) => {
        resource.request = resource.request.replace(/^node:/, "");
      }),
    );

    // Enable async WebAssembly and top-level await for Barretenberg (@aztec/bb.js) and Garaga
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      topLevelAwait: true,
    };

    // Prevent WASM modules from being processed by default loaders
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });

    if (dev && !isServer) {
      config.infrastructureLogging = {
        level: "error",
      };
    }

    return config;
  },
  // Required for SharedArrayBuffer (used by Barretenberg parallel prover)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
