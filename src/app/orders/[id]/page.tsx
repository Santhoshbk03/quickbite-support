import type { Metadata } from "next";

import { OrderDetail } from "@/components/orders/order-detail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order ${decodeURIComponent(id)}` };
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="h-full overflow-y-auto">
      <OrderDetail orderId={decodeURIComponent(id)} />
    </main>
  );
}
