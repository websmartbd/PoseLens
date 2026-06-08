"use client";

import dynamic from "next/dynamic";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

const PoseCamera = dynamic(() => import("@/components/camera/PoseCamera"), {
  ssr: false,
});

export default function Home() {
  return (
    <main>
      <ErrorBoundary>
        <PoseCamera />
      </ErrorBoundary>
    </main>
  );
}
