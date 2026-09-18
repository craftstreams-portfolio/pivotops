"use client";

export default function SuggestionFeed({
  suggestion,
}: {
  suggestion: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <h2 className="text-sm font-semibold mb-2">
        Auto-Suggestion Engine
      </h2>

      <p className="text-sm text-zinc-300">
        {suggestion}
      </p>
    </div>
  );
}