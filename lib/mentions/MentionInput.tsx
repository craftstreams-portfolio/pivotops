"use client";

import { useRef, useEffect, forwardRef } from "react";
import { AtSign } from "lucide-react";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
interface Profile {
  id:         string;
  full_name:  string | null;
  email:      string | null;
  department: string | null;
  avatar_url?: string | null;
}

interface MentionInputProps {
  value:            string;
  onChange:         (value: string) => void;
  onSubmit?:        () => void;
  placeholder?:     string;
  suggestions:      Profile[];
  showSuggest:      boolean;
  onSelectSuggestion: (profile: Profile) => void;
  multiline?:       boolean;
  className?:       string;
  disabled?:        boolean;
  autoFocus?:       boolean;
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function getInitials(name: string | null, email: string | null) {
  if (name) {
    const p = name.trim().split(" ");
    return p.length >= 2
      ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase()
      : p[0][0].toUpperCase();
  }
  return email?.[0]?.toUpperCase() ?? "?";
}

// ─────────────────────────────────────────
// MENTION INPUT COMPONENT
// ─────────────────────────────────────────
export function MentionInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Type a message… use @ to mention",
  suggestions,
  showSuggest,
  onSelectSuggestion,
  multiline   = false,
  className   = "",
  disabled    = false,
  autoFocus   = false,
}: MentionInputProps) {
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !multiline) {
      e.preventDefault();
      onSubmit?.();
    }
    if (e.key === "Enter" && !e.shiftKey && multiline && e.ctrlKey) {
      e.preventDefault();
      onSubmit?.();
    }
    if (e.key === "Escape") {
      // handled by parent
    }
  };

  const baseClass = `w-full bg-transparent text-sm text-white placeholder-zinc-600
    outline-none resize-none leading-relaxed ${className}`;

  return (
    <div className="relative w-full">
      {/* Input */}
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className={baseClass}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={baseClass}
        />
      )}

      {/* Suggestion dropdown */}
      {showSuggest && suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-zinc-900 border border-zinc-700
                        rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-zinc-800">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <AtSign size={10} /> Mention
            </p>
          </div>
          {suggestions.map((p) => (
            <button
              key={p.id}
              onMouseDown={(e) => { e.preventDefault(); onSelectSuggestion(p); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 transition text-left"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-300
                              flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
                {p.avatar_url
                  ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                  : getInitials(p.full_name, p.email)
                }
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">
                  {p.full_name ?? p.email}
                </p>
                {p.department && (
                  <p className="text-[10px] text-zinc-500 truncate">{p.department}</p>
                )}
              </div>
            </button>
          ))}
          {/* @all option always shown */}
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              onChange(value.replace(/@[\w.]*$/, "@all "));
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 transition text-left border-t border-zinc-800"
          >
            <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-300
                            flex items-center justify-center text-xs font-bold flex-shrink-0">
              @
            </div>
            <div>
              <p className="text-sm text-amber-300 font-medium">@all</p>
              <p className="text-[10px] text-zinc-500">Notify everyone</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// MENTION RENDERER — renders text with highlighted @mentions
// ─────────────────────────────────────────
export function MentionText({ content }: { content: string }) {
  if (!content) return null;

  const parts = content.split(/(@[\w.+-]+)/g);

  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          const token = part.slice(1).toLowerCase();
          const isAll  = token === "all" || token === "everyone" || token === "team";
          const isDept = ["engineering","product","design","marketing","sales",
            "hr","finance","operations","legal","compliance","recruitment","management"
          ].includes(token);

          return (
            <span
              key={i}
              className={`font-semibold px-0.5 rounded
                ${isAll  ? "text-amber-400 bg-amber-500/10"   :
                  isDept ? "text-emerald-400 bg-emerald-500/10" :
                           "text-indigo-400 bg-indigo-500/10"
                }`}
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}