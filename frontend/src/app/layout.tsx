import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Saiv | Gasless Web3 Savings Platform",
  description:
    "Saiv delivers a seamless, gasless Web3 savings experience with powerful group coordination, automated wallets, and intuitive dashboards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetBrainsMono.variable} min-h-screen bg-slate-950 font-sans text-slate-100 antialiased`}
      >
        <Providers>
          <div className="min-h-screen bg-slate-950">
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.1),_transparent_45%)]" />
            <div className="relative z-10 flex min-h-screen flex-col">
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
