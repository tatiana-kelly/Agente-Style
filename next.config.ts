import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sem isto o Turbopack sobe uma pasta e pega o package-lock.json do diretorio pai.
  turbopack: { root: __dirname },
  // Identifica o deploy: ao navegar numa aba aberta antes de um deploy novo, o
  // Next percebe a troca e recarrega a pagina em vez de seguir com JS antigo.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
};

export default nextConfig;
