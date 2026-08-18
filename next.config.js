/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      stream: false,
      util: false,
      os: false,
      url: false,
      http: false,
      https: false,
      zlib: false,
      assert: false,
      constants: false,
      crypto: false,
      timers: false,
      tty: false,
      net: false,
      dns: false,
      dgram: false,
      cluster: false,
      module: false,
      'node:stream': false,
      'node:util': false,
      'node:path': false,
      'node:fs': false,
      'node:os': false,
      'node:url': false,
      'node:http': false,
      'node:https': false,
      'node:net': false,
      'node:zlib': false,
      'node:crypto': false,
      'node:timers': false,
      'node:tty': false,
    };
    return config;
  },
};

module.exports = nextConfig;
