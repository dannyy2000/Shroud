"use client";

import dynamic from "next/dynamic";

const HomePage = dynamic(() => import("~~/components/pages/HomePage"), {
  ssr: false,
  loading: () => <PageSkeleton />,
});

function PageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="h-10 w-64 rounded mb-4 animate-pulse" style={{ backgroundColor: "#30363d" }} />
      <div className="h-4 w-96 rounded mb-8 animate-pulse" style={{ backgroundColor: "#30363d" }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-48 rounded-xl animate-pulse" style={{ backgroundColor: "#161b22" }} />
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  return <HomePage />;
}
