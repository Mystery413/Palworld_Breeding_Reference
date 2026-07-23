import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "帕鲁育种实验室 1.0",
    template: "%s · 帕鲁育种实验室",
  },
  description: "按用途与游戏进度选择毕业帕鲁，自由编辑四词条，并从现有库存生成完整孵化路线。",
  openGraph: {
    title: "帕鲁育种实验室 1.0",
    description: "18 类毕业方案、116 个进度选择与可编辑四词条，一步生成完整孵化路线。",
    images: [{ url: "/og-graduate.png", width: 1731, height: 909, alt: "帕鲁育种实验室毕业帕鲁孵化助手" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-graduate.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
