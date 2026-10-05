import React from "react";

type KanbanCardProps = {
  card: {
    id?: string;
    title: string;
    meta?: string;
    stage?: string;
  };
  onClick?: () => void;
};

/**
 * ==========================================
 * KANBAN CARD (PIVOTOPS DARK UI STANDARD)
 * ==========================================
 */
export default function KanbanCard({
  card,
  onClick,
}: KanbanCardProps) {
  return (
    <div
      onClick={onClick}
      className="
        group cursor-pointer select-none
        rounded-xl border border-zinc-800
        bg-zinc-900/60 backdrop-blur
        p-3
        transition-all duration-200
        hover:border-zinc-600 hover:bg-zinc-900
        active:scale-[0.99]
      "
    >
      {/* TITLE */}
      <p className="text-sm font-semibold text-white tracking-tight group-hover:text-white">
        {card.title}
      </p>

      {/* META */}
      <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
        {card.meta ?? "No additional details"}
      </p>

      {/* FOOTER BADGE */}
      {card.stage && (
        <div className="mt-2 flex items-center gap-2">
          <span
            className="
              text-[11px] font-medium
              px-2 py-0.5 rounded-full
              bg-indigo-500/10 text-indigo-300
              border border-indigo-500/20
            "
          >
            {card.stage}
          </span>
        </div>
      )}
    </div>
  );
}