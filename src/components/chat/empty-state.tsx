"use client";

import { LogoMark } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { HoverEffect } from "@/components/ui/card-hover-effect";
import type { HoverEffectItem } from "@/components/ui/card-hover-effect";
import { useSession } from "@/lib/auth/session";
import { firstName } from "@/lib/order-view";

const EXAMPLES: HoverEffectItem[] = [
  {
    id: "latest-order",
    title: "Where is my latest order?",
    description: "Looks up your most recent order.",
    eyebrow: (
      <Badge size="sm" tone="brand">
        Order
      </Badge>
    ),
  },
  {
    id: "late-order",
    title: "Is my order running late?",
    description: "Checks your orders in progress against the time promised at checkout.",
    eyebrow: (
      <Badge size="sm" tone="brand">
        Order
      </Badge>
    ),
  },
  {
    id: "refund-timing",
    title: "How long do UPI refunds take?",
    description: "Answered from the refund timelines policy.",
    eyebrow: <Badge size="sm">Policy</Badge>,
  },
  {
    id: "late-compensation",
    title: "Can I get compensation for a late delivery?",
    description: "Answered from the late delivery policy.",
    eyebrow: <Badge size="sm">Policy</Badge>,
  },
  {
    id: "missing-item",
    title: "An item was missing from my delivery",
    description: "What to do and how refunds for missing items work.",
    eyebrow: <Badge size="sm">Policy</Badge>,
  },
  {
    id: "out-of-scope",
    title: "Do riders get paid per hour?",
    description: "No policy covers this, so the assistant says so instead of guessing.",
    eyebrow: (
      <Badge size="sm" tone="outline">
        Out of scope
      </Badge>
    ),
  },
];

export function ChatEmptyState({
  onPick,
  disabled,
}: {
  onPick: (question: string) => void;
  disabled: boolean;
}) {
  const name = useSession((state) => state.customer?.name);

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-4xl flex-col justify-center px-4 py-10 sm:px-6">
        <LogoMark className="size-10" />
        <h1 className="mt-5 font-display-tight text-3xl font-medium text-fg sm:text-4xl">
          {name ? `How can we help, ${firstName(name)}?` : "How can we help?"}
        </h1>
        <p className="mt-2 max-w-xl text-[0.9375rem] leading-relaxed text-fg-muted">
          Ask about your orders, or about refunds, delivery, payments, and other QuickBite policies.
          Every answer links to the policy it came from.
        </p>
        <HoverEffect
          items={EXAMPLES}
          onSelect={(item) => {
            if (!disabled) onPick(item.title);
          }}
          className="-mx-1.5 mt-8"
        />
      </div>
    </div>
  );
}
