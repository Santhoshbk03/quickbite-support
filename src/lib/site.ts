/**
 * Site identity for metadata and social previews. Server-side only for `url`: VERCEL_* variables are
 * not exposed to the browser bundle.
 */
export const SITE = {
  name: "QuickBite Support",
  title: "QuickBite Support",
  description:
    "A demo customer support app for a food delivery service: chat with a support assistant, track orders, and read the policies behind every answer.",
  repoUrl: "https://github.com/Santhoshbk03/quickbite-support",
} as const;

export function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
