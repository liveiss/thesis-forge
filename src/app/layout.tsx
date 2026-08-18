import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { ToastProvider } from "./components/ToastProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "论文工坊 - AI 辅助论文修改",
  description: "AI 辅助论文修改 · 降 AI 率 · 逻辑审查 · 学术润色 · 五维度检测",
  keywords: ["论文修改", "AI 降重", "论文检测", "学术润色", "毕业论文", "AI 痕迹检测"],
  authors: [{ name: "论文工坊" }],
  openGraph: {
    title: "论文工坊 - AI 辅助论文修改",
    description: "AI 辅助论文修改 · 降 AI 率 · 逻辑审查 · 学术润色 · 五维度检测",
    url: "https://starlit-profiterole-b37340.netlify.app/",
    siteName: "论文工坊",
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "论文工坊 - AI 辅助论文修改",
    description: "AI 辅助论文修改 · 降 AI 率 · 逻辑审查 · 学术润色 · 五维度检测",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-theme-base">
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
