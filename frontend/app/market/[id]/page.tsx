"use client";

import { use } from "react";
import dynamic from "next/dynamic";

const MarketDetail = dynamic(
  () => import("~~/components/pages/MarketDetailPage"),
  { ssr: false },
);

export default function MarketDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <MarketDetail id={id} />;
}
