import type { Metadata } from "next";

import { OrdersList } from "@/components/orders/orders-list";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage() {
  return (
    <main className="h-full overflow-y-auto">
      <OrdersList />
    </main>
  );
}
