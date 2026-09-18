const operations = [
  "Candidate sync running",
  "Interview automation active",
  "Workflow routing stable",
  "Incident replay operational",
];

export default function LiveOperations() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
      <h2 className="text-xl font-semibold mb-6">
        Live Operations
      </h2>

      <div className="space-y-3">
        {operations.map((task) => (
          <div
            key={task}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between"
          >
            <p className="text-sm text-zinc-300">
              {task}
            </p>

            <span className="text-xs text-emerald-400">
              Active
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}