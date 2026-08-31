import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Controle de Vendas",
  description: "Sistema de controle de vendas para sacoleiros e pequenos revendedores",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Controle de Vendas",
  },
};

export const viewport: Viewport = {
  themeColor: "#2f5bf6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="bg-surface-muted font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
