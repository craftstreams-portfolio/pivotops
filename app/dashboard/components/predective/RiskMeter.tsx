"use client";

export default function RiskMeter({ risk }: { risk: number }) {
  const percent = Math.round(risk * 100);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <h2 className="text-sm font-semibold mb-2">
        System Risk
      </h2>

      <div className="text-2xl font-bold text-emerald-400">
        {percent}%
      </div>

      <div className="w-full bg-zinc-800 h-2 rounded-full mt-3">
        <div
          className="h-2 bg-red-500 rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}