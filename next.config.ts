// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
//   // ビルド時の TypeScript 型エラーを無視して公開を優先する
//   typescript: {
//     ignoreBuildErrors: true,
//   },
//   // ビルド時の ESLint (警告・エラー) を無視して公開を優先する
//   eslint: {
//     ignoreDuringBuilds: true,
//   },
// };

// export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 💡 'eslint' キーを削除またはコメントアウトしました */
  // eslint: {
  //   ignoreDuringBuilds: true,
  // },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;