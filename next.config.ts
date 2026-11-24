import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pdfkit', 'exceljs', 'bcryptjs'],
};

export default nextConfig;
