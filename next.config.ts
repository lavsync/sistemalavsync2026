import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Planilhas grandes (1700+ vendas) ultrapassam o default de 1MB.
      // 10MB cobre folha de ~14k vendas, com margem. 16MB: a importação da
      // projeção da franqueadora aceita arquivo de até 15 MB (+ multipart).
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
