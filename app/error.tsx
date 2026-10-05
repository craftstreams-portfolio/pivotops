"use client";

export default function GlobalError() {
  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">
        Something went wrong
      </h1>

      <p>
        PivotOps encountered an unexpected
        issue.
      </p>
    </div>
  );
}