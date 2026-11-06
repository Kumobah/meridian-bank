import React from "react";

export function SkeletonBar({ className = "" }) {
  return <div className={`animate-pulse rounded bg-line ${className}`} />;
}

export function SkeletonStatCard() {
  return (
    <div className="rounded-2xl border border-line bg-white shadow-sm p-6">
      <SkeletonBar className="h-3 w-20" />
      <SkeletonBar className="mt-2 h-3 w-14" />
      <SkeletonBar className="mt-5 h-8 w-32" />
      <SkeletonBar className="mt-2 h-3 w-24" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center justify-between px-6 py-3.5">
      <div>
        <SkeletonBar className="h-3.5 w-36" />
        <SkeletonBar className="mt-2 h-3 w-24" />
      </div>
      <SkeletonBar className="h-4 w-16" />
    </div>
  );
}
