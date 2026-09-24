import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { UmamiTracker } from "@/components/analytics/umami";
import { CookieNotice } from "@/components/legal/cookie-notice";
import { AuthRemember } from "@/components/auth/auth-remember";
import { ToastViewport } from "@/components/ui/toast";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Made in Madagascar — Annuaire des produits tech malgaches",
    template: "%s — Made in Madagascar",
  },
  description:
    "L'annuaire de référence des produits tech malgaches. Découvrez les SaaS, applications et outils créés à Madagascar, soutenez les makers et prouvez leurs revenus vérifiés.",
  openGraph: {
    type: "website",
    locale: "fr_MG",
    siteName: "Made in Madagascar",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <UmamiTracker />
          <AuthRemember />
          <Suspense fallback={null}>
            <ToastViewport />
          </Suspense>
          {children}
          <CookieNotice />
        </ThemeProvider>
      </body>
    </html>
  );
}
