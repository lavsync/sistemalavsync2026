import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Planilhas grandes (1700+ vendas) ultrapassam o default de 1MB.
      // 10MB cobre folha de ~14k vendas, com margem.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
