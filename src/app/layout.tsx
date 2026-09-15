import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";

import { Providers } from "@/components/site/providers";
import { resolveSiteUrl, SITE } from "@/lib/site";
import { themeInitScript } from "@/lib/theme-script";

import "./globals.css";

/** Display: an editorial serif with optical sizing and a soft axis. */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

/** Order IDs and amounts: tabular figures. */
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title: { default: SITE.title, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: SITE.title,
    description: SITE.description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.title,
    description: SITE.description,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#1b1815" },
    { media: "(prefers-color-scheme: light)", color: "#f6f2ec" },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${fraunces.variable} ${instrumentSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the remembered theme before first paint; no flash on reload. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-canvas font-sans text-fg antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
