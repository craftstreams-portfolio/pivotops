export default function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-64 bg-zinc-800 animate-pulse rounded-xl" />
      <div className="h-4 w-96 bg-zinc-800 animate-pulse rounded-xl" />

      <div className="grid grid-cols-4 gap-4 mt-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 bg-zinc-800 animate-pulse rounded-2xl"
          />
        ))}
      </div>

      <div className="h-64 bg-zinc-800 animate-pulse rounded-2xl mt-6" />
    </div>
  );
}