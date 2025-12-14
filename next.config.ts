import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
};

if (!process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES) {
  process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES = path.join(
    process.cwd(),
    "src/styles/next-font-google-mocks.cjs",
  );
}

export default nextConfig;
