"use client";

import dynamic from "next/dynamic";

const DepositPage = dynamic(() => import("~~/components/pages/DepositPage"), {
  ssr: false,
});

export default function Page() {
  return <DepositPage />;
}
