"use client";

import { useEffect, useState } from "react";

type Props = {
  label: string;
  value: number;
  suffix?: string;
};

export default function AnimatedKPI({
  label,
  value,
  suffix = "",
}: Props) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;

    const step = value / 30;

    const interval = setInterval(() => {
      start += step;

      if (start >= value) {
        start = value;
        clearInterval(interval);
      }

      setDisplay(Math.floor(start));
    }, 30);

    return () => clearInterval(interval);
  }, [value]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <p className="text-sm text-zinc-400">
        {label}
      </p>

      <h2 className="text-3xl font-bold mt-2">
        {display}
        {suffix}
      </h2>
    </div>
  );
}