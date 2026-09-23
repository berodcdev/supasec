import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera um servidor Node autocontido em .next/standalone para uma imagem Docker enxuta.
  output: "standalone",
};

export default nextConfig;
