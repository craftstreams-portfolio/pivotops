const insights = [
  "Recruitment efficiency improved by 18%",
  "AI workflows reduced manual review load",
  "Recovery engine stabilized hiring operations",
  "Workflow automation saved operational cost",
];

export default function ExecutiveInsights() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
      <h2 className="text-xl font-semibold mb-6">
        Executive Insights
      </h2>

      <div className="space-y-4">
        {insights.map((item) => (
          <div
            key={item}
            className="border-l-2 border-emerald-500 pl-4"
          >
            <p className="text-sm text-zinc-300">
              {item}
            </p>

            <span className="text-xs text-zinc-500">
              Updated recently
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}