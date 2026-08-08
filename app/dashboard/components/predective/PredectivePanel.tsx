"use client";

import { usePredictiveStream } from "./usePredictiveStream";
import RiskMeter from "./RiskMeter";
import ForecastTimeline from "./ForecastTimeline";
import SuggestionFeed from "./SuggestionFeed";

export default function PredictivePanel() {
  const data = usePredictiveStream();

  if (!data) {
    return (
      <div className="text-zinc-500 text-sm">
        Loading predictive engine...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RiskMeter risk={data.risk} />

      <ForecastTimeline forecast={data.forecast} />

      <SuggestionFeed suggestion={data.suggestion} />
    </div>
  );
}