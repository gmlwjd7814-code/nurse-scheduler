import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Navigation from "@/components/Navigation";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nurse Scheduler AI — 간호사 근무표 자동 생성",
  description: "병원 간호사 3교대 근무 자동 생성 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geist.className} bg-gray-50 min-h-screen antialiased`}>
        <Navigation />
        <main className="max-w-screen-2xl mx-auto px-4 py-6">
          {children}
        </main>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
