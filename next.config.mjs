/** @type {import("next").NextConfig} */
const nextConfig = {
  // Puppeteer precisa rodar como módulo Node nativo, fora do bundle.
  serverExternalPackages: ["puppeteer-core"],
};

export default nextConfig;
