import type { Metadata } from "next";

import { StyleguideContent } from "@/components/styleguide/styleguide-content";

export const metadata: Metadata = {
  title: "Styleguide",
  description:
    "QuickBite Support design tokens, typography, primitives, and every Aceternity component after its retheme, in both themes.",
};

export default function StyleguidePage() {
  return <StyleguideContent />;
}
