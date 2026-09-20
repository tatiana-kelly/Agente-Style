import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sem isto o Turbopack sobe uma pasta e pega o package-lock.json do diretorio pai.
  turbopack: { root: __dirname },
  /* config options here */
};

export default nextConfig;
