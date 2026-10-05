type MetricCardProps = {
  title: string;
  value: string;
  change: string;
};

export default function MetricCard({
  title,
  value,
  change,
}: MetricCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-400">
          {title}
        </p>

        <span className="text-xs text-emerald-400">
          {change}
        </span>
      </div>

      <h2 className="text-3xl font-bold tracking-tight">
        {value}
      </h2>
    </div>
  );
}