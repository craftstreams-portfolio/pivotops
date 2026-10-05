"use client";

export default function ForecastTimeline({
  forecast,
}: {
  forecast: any;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <h2 className="text-sm font-semibold mb-3">
        5-Min Forecast
      </h2>

      <div className="space-y-2 text-sm">
        <p>
          Risk Projection:{" "}
          <span className="text-red-400">
            {Math.round(forecast?.next5minRisk * 100)}%
          </span>
        </p>

        <p>
          Trend:{" "}
          <span className="text-yellow-400">
            {forecast?.trend}
          </span>
        </p>
      </div>
    </div>
  );
}