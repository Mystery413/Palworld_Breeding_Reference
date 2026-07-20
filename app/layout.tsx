import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "帕鲁育种实验室 1.0",
    template: "%s · 帕鲁育种实验室",
  },
  description: "基于 Palworld 1.0 数据的中文育种路线规划工具。",
  openGraph: {
    title: "帕鲁育种实验室 1.0",
    description: "录入已有帕鲁、性别、词条与潜力，生成最短育种路线。",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "帕鲁育种实验室的遗传路线概念图" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
