"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase }        from "@/lib/supabase";
import { useTenant }       from "@/lib/hooks/useTenant";
import { getCurrentProfile } from "@/lib/profile/profile.service";
import { processMentions, extractMentions, getUserNotifications, markUserNotificationsRead } from "@/lib/mentions/mention.engine";
import {
  Plus, CheckCircle2, Circle, Trash2,
  Bell, Brain, AlertTriangle, ChevronDown,
  Calendar, User, Flag, X, Loader2,
  TrendingUp, ShieldAlert,
} from "lucide-react";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
type Priority  = "low" | "medium" | "high";
type RiskLevel = "normal" | "medium" | "high" | "critical";

interface TaskAttention {
  users:       string[];
  departments: string[];
  escalated:   boolean;
}

interface Task {
  id:            string;
  title:         string;
  description:   string | null;
  priority:      Priority;
  status:        string;
  done:          boolean;
  assignee?:     string | null;
  assigned_to?:  string | null;
  created_by?:   string | null;
  due_date?:     string | null;
  tenant_id:     string;
  created_at:    string;
  attention?:    TaskAttention | null;
  mention_count?: number;
  risk_level?:   RiskLevel;
}

interface Notification {
  id:         string;
  message:    string;
  type:       string;
  read:       boolean;
  task_id:    string | null;
  created_at: string;
}

interface Profile {
  id:        string;
  full_name: string | null;
  email:     string | null;
}

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────
const PRIORITY_STYLES: Record<Priority, string> = {
  low:    "text-blue-400  bg-blue-500/10  border-blue-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  high:   "text-red-400   bg-red-500/10   border-red-500/20",
};

const RISK_CONFIG: Record<RiskLevel, { label: string; cls: string; icon: React.ElementType }> = {
  normal:   { label: "Normal",   cls: "text-zinc-500  bg-zinc-800       border-zinc-700",          icon: TrendingUp   },
  medium:   { label: "Medium",   cls: "text-amber-400 bg-amber-500/10   border-amber-500/20",      icon: AlertTriangle },
  high:     { label: "High",     cls: "text-orange-400 bg-orange-500/10 border-orange-500/20",     icon: AlertTriangle },
  critical: { label: "Critical", cls: "text-red-400   bg-red-500/10     border-red-500/20",        icon: ShieldAlert  },
};

// ─────────────────────────────────────────
// MENTION HIGHLIGHT — renders @mentions in blue
// ─────────────────────────────────────────
function HighlightedText({ text }: { text: string }) {
  const parts = text.split(/(@\w[\w\s]*?)(?=\s|$)/g);
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className="text-indigo-400 font-medium">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

// ─────────────────────────────────────────
// MENTION DROPDOWN — shows @mention suggestions
// ─────────────────────────────────────────
function MentionDropdown({
  query, profiles, onSelect,
}: {
  query:    string;
  profiles: Profile[];
  onSelect: (name: string) => void;
}) {
  const departments = [
    "engineering","product","design","marketing","sales",
    "hr","finance","operations","legal","recruitment",
  ];

  const matchedUsers = profiles.filter((p) => {
    const name = (p.full_name ?? p.email ?? "").toLowerCase();
    return name.includes(query.toLowerCase());
  }).slice(0, 4);

  const matchedDepts = departments.filter((d) =>
    d.includes(query.toLowerCase())
  ).slice(0, 3);

  const showAll = "all".includes(query.toLowerCase()) || query === "";

  if (!matchedUsers.length && !matchedDepts.length && !showAll) return null;

  return (
    <div className="absolute bottom-full left-0 mb-1 w-56 bg-zinc-900 border border-zinc-700
                    rounded-xl shadow-2xl z-50 overflow-hidden">
      {showAll && (
        <button
          onClick={() => onSelect("all")}
          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-zinc-800 transition text-left"
        >
          <ShieldAlert size={13} className="text-red-400" />
          <span className="text-xs text-red-400 font-semibold">@all — Escalate to everyone</span>
        </button>
      )}
      {matchedDepts.map((d) => (
        <button key={d} onClick={() => onSelect(d)}
          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-zinc-800 transition text-left">
          <Brain size={12} className="text-amber-400" />
          <span className="text-xs text-amber-400">@{d}</span>
          <span className="text-[10px] text-zinc-600 ml-auto">dept</span>
        </button>
      ))}
      {matchedUsers.map((p) => (
        <button key={p.id} onClick={() => onSelect(p.full_name?.split(" ")[0].toLowerCase() ?? p.email?.split("@")[0] ?? "")}
          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-zinc-800 transition text-left">
          <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center
                          justify-center text-[9px] font-bold flex-shrink-0">
            {(p.full_name ?? p.email ?? "?")[0].toUpperCase()}
          </div>
          <span className="text-xs text-white">@{p.full_name?.split(" ")[0].toLowerCase() ?? p.email?.split("@")[0]}</span>
          <span className="text-[10px] text-zinc-600 ml-auto">user</span>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// NOTIFICATIONS PANEL
// ─────────────────────────────────────────
function NotificationsPanel({
  notifications, onClose, onMarkRead,
}: {
  notifications: Notification[];
  onClose:       () => void;
  onMarkRead:    () => void;
}) {
  const typeIcon: Record<string, string> = {
    mention:          "💬",
    escalation:       "🚨",
    mention_resolved: "✅",
  };

  return (
    <div className="absolute right-0 top-11 w-80 max-h-96 overflow-y-auto bg-zinc-900
                    border border-zinc-800 rounded-2xl shadow-2xl z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 sticky top-0 bg-zinc-900">
        <div className="flex items-center gap-2">
          <Bell size={13} className="text-indigo-400" />
          <span className="text-xs font-semibold text-white">Notifications</span>
          {notifications.filter((n) => !n.read).length > 0 && (
            <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full">
              {notifications.filter((n) => !n.read).length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onMarkRead} className="text-[10px] text-zinc-500 hover:text-white transition">
            Mark all read
          </button>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition">
            <X size={14} />
          </button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <p className="text-xs text-zinc-600 text-center py-6">No notifications yet</p>
      ) : (
        notifications.map((n) => (
          <div key={n.id} className={`px-4 py-3 border-b border-zinc-800/50 ${!n.read ? "bg-indigo-500/5" : ""}`}>
            <div className="flex items-start gap-2">
              <span className="text-sm flex-shrink-0">{typeIcon[n.type] ?? "🔔"}</span>
              <p className="text-xs text-white/80 leading-relaxed">{n.message}</p>
            </div>
            <p className="text-[10px] text-zinc-600 mt-1 ml-6">
              {new Date(n.created_at).toLocaleString()}
            </p>
          </div>
        ))
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────
export default function TaskCenterPage() {
  const { tenantId, loading: tenantLoading } = useTenant();

  const [tasks,         setTasks]         = useState<Task[]>([]);
  const [profiles,      setProfiles]      = useState<Profile[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentUser,   setCurrentUser]   = useState<Profile | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [filter,        setFilter]        = useState<"all" | "open" | "done" | "critical">("all");
  const [showNotifs,    setShowNotifs]    = useState(false);

  // Form state
  const [input,       setInput]       = useState("");
  const [description, setDescription] = useState("");
  const [priority,    setPriority]    = useState<Priority>("medium");
  const [dueDate,     setDueDate]     = useState("");
  const [showForm,    setShowForm]    = useState(false);

  // Mention state
  const [mentionQuery,   setMentionQuery]   = useState<string | null>(null);
  const [showMentions,   setShowMentions]   = useState(false);
  const inputRef   = useRef<HTMLInputElement>(null);
  const descRef    = useRef<HTMLTextAreaElement>(null);

  // ── Load current user ────────────────────
  useEffect(() => {
    getCurrentProfile().then((p) => {
      if (p) setCurrentUser(p);
    });
  }, []);

  // ── Load profiles for @mention ───────────
  useEffect(() => {
    if (tenantLoading) return;
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("tenant_id", tenantId)
      .then(({ data }) => setProfiles(data ?? []));
  }, [tenantId, tenantLoading]);

  // ── Load notifications ───────────────────
  const loadNotifications = useCallback(async () => {
    if (!currentUser) return;
    const data = await getUserNotifications(currentUser.id, tenantId, 30);
    setNotifications(data as Notification[]);
  }, [currentUser, tenantId]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  // ── Load tasks ───────────────────────────
  const load = async () => {
    if (tenantLoading) return;
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) { console.error("Failed to load tasks:", error.message); return; }
    setTasks(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenantId, tenantLoading]);

  // ── Realtime ─────────────────────────────
  useEffect(() => {
    if (tenantLoading) return;
    const channel = supabase.channel("tasks-live")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          const updated = payload.new as Task;
          if (!updated) return;
          setTasks((prev) => {
            const exists = prev.find((t) => t.id === updated.id);
            return exists
              ? prev.map((t) => t.id === updated.id ? { ...t, ...updated } : t)
              : [updated, ...prev];
          });
        }
      )
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => loadNotifications()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId, tenantLoading, loadNotifications]);

  // ── Mention input detection ───────────────
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    setter: (v: string) => void
  ) => {
    const val   = e.target.value;
    setter(val);
    const lastAt = val.lastIndexOf("@");
    if (lastAt !== -1) {
      const afterAt = val.slice(lastAt + 1);
      if (!afterAt.includes(" ") || afterAt === "") {
        setMentionQuery(afterAt);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
    setMentionQuery(null);
  };

  const handleMentionSelect = (
    name:   string,
    current: string,
    setter:  (v: string) => void
  ) => {
    const lastAt = current.lastIndexOf("@");
    const before = current.slice(0, lastAt);
    setter(`${before}@${name} `);
    setShowMentions(false);
    setMentionQuery(null);
  };

  // ── Create task ───────────────────────────
  const handleAdd = async () => {
    if (!input.trim() || saving || !currentUser) return;
    setSaving(true);

    const tempId: string = `opt-${Date.now()}`;
    const optimistic: Task = {
      id:         tempId,
      title:      input.trim(),
      description:description.trim() || null,
      priority,
      status:     "active",
      done:       false,
      assignee:   null,
      assigned_to:null,
      created_by: currentUser.id,
      due_date:   dueDate || null,
      tenant_id:  tenantId,
      created_at: new Date().toISOString(),
      attention:  { users: [], departments: [], escalated: false },
      mention_count: 0,
      risk_level: "normal",
    };

    setTasks((prev) => [optimistic, ...prev]);
    const savedInput       = input.trim();
    const savedDescription = description.trim();
    setInput("");
    setDescription("");
    setDueDate("");
    setShowForm(false);

    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title:       savedInput,
          description: savedDescription || null,
          priority,
          status:      "active",
          done:        false,
          created_by:  currentUser.id,
          due_date:    dueDate || null,
          tenant_id:   tenantId,
          attention:   { users: [], departments: [], escalated: false },
          mention_count: 0,
          risk_level:  "normal",
          created_at:  new Date().toISOString(),
          updated_at:  new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      setTasks((prev) => prev.map((t) => t.id === tempId ? data : t));

      // Process @mentions in title and description
      const fullContent = `${savedInput} ${savedDescription}`;
      if (fullContent.includes("@")) {
        await processMentions({
          content:   fullContent,
          context:   "task",
          taskId:    data.id,
          createdBy: currentUser.full_name ?? currentUser.email ?? "Unknown",
          tenantId,
          profiles,
        });
      }

    } catch (err) {
      console.error("Failed to create task:", err instanceof Error ? err.message : err);
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle done ───────────────────────────
  const handleToggle = async (task: Task) => {
    const newDone = !task.done;
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, done: newDone } : t));
    const { error } = await supabase
      .from("tasks")
      .update({ done: newDone, status: newDone ? "completed" : "active", updated_at: new Date().toISOString() })
      .eq("id", task.id);
    if (error) {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, done: task.done } : t));
    }
  };

  // ── Delete ────────────────────────────────
  const handleDelete = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { console.error("Delete failed:", error.message); load(); }
  };

  // ── Derived ───────────────────────────────
  const visible = tasks.filter((t) => {
    if (filter === "open")     return !t.done;
    if (filter === "done")     return  t.done;
    if (filter === "critical") return t.risk_level === "critical" || t.risk_level === "high";
    return true;
  });

  const openCount     = tasks.filter((t) => !t.done).length;
  const doneCount     = tasks.filter((t) =>  t.done).length;
  const criticalCount = tasks.filter((t) => t.risk_level === "critical" || t.risk_level === "high").length;
  const unreadCount   = notifications.filter((n) => !n.read).length;

  if (loading || tenantLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading tasks...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Task Center</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Create, assign and track tasks · Use @name to mention teammates
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifs((o) => !o)}
              className="relative w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800
                         hover:border-zinc-700 flex items-center justify-center transition"
            >
              <Bell size={15} className="text-zinc-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-500
                                 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <NotificationsPanel
                notifications={notifications}
                onClose={() => setShowNotifs(false)}
                onMarkRead={async () => {
                  if (currentUser) await markUserNotificationsRead(currentUser.id);
                  loadNotifications();
                }}
              />
            )}
          </div>

          {/* New task button */}
          <button
            onClick={() => setShowForm((o) => !o)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600
                       hover:bg-indigo-500 text-white text-sm font-semibold transition"
          >
            <Plus size={14} />
            New Task
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Open",     value: openCount,     color: "text-white"         },
          { label: "Done",     value: doneCount,     color: "text-emerald-400"   },
          { label: "Critical", value: criticalCount, color: "text-red-400"       },
          { label: "Total",    value: tasks.length,  color: "text-zinc-400"      },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Create Task</h2>

          {/* Title with @mention */}
          <div className="relative">
            <label className="text-xs text-zinc-500 mb-1.5 block">
              Title — type @ to mention a teammate or department
            </label>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => handleInputChange(e, setInput)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !showMentions) handleAdd();
                if (e.key === "Escape") setShowMentions(false);
              }}
              placeholder="e.g. Review onboarding docs @sarah @hr"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                         text-sm text-white placeholder-zinc-600 outline-none
                         focus:border-indigo-500/50 transition"
            />
            {showMentions && mentionQuery !== null && (
              <MentionDropdown
                query={mentionQuery}
                profiles={profiles}
                onSelect={(name) => handleMentionSelect(name, input, setInput)}
              />
            )}
          </div>

          {/* Description with @mention */}
          <div className="relative">
            <label className="text-xs text-zinc-500 mb-1.5 block">Description (optional)</label>
            <textarea
              ref={descRef}
              value={description}
              onChange={(e) => handleInputChange(e, setDescription)}
              onKeyDown={(e) => { if (e.key === "Escape") setShowMentions(false); }}
              placeholder="Add more context... @mention teammates for attention"
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                         text-sm text-white placeholder-zinc-600 outline-none
                         focus:border-indigo-500/50 transition resize-none"
            />
          </div>

          {/* Priority + due date */}
          <div className="flex gap-3 flex-wrap">
            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">Priority</label>
              <div className="flex gap-1.5">
                {(["low", "medium", "high"] as Priority[]).map((p) => (
                  <button key={p} onClick={() => setPriority(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition capitalize
                      ${priority === p ? PRIORITY_STYLES[p] : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block flex items-center gap-1">
                <Calendar size={10} /> Due Date
              </label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5
                           text-xs text-white outline-none focus:border-zinc-500 transition" />
            </div>
          </div>

          {/* Xavier mention preview */}
          {(input + description).includes("@") && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-indigo-500/5 border border-indigo-500/15">
              <Brain size={13} className="text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-indigo-400 font-medium">Xavier AI will process these mentions</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {extractMentions(input + " " + description, profiles).map((m) => (
                    `@${m.refName} (${m.type})`
                  )).join(" · ")}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => { setShowForm(false); setInput(""); setDescription(""); setDueDate(""); }}
              className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:text-white transition">
              Cancel
            </button>
            <button onClick={handleAdd} disabled={!input.trim() || saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                         bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold
                         disabled:opacity-40 transition">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? "Creating..." : "Create Task"}
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: "all",      label: "All",      count: tasks.length },
          { key: "open",     label: "Open",     count: openCount    },
          { key: "done",     label: "Done",     count: doneCount    },
          { key: "critical", label: "Critical", count: criticalCount },
        ] as const).map(({ key, label, count }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${filter === key ? "bg-white/10 text-white border border-white/20" : "text-zinc-500 hover:text-zinc-300"}`}>
            {label}
            {count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full
                ${key === "critical" && count > 0 ? "bg-red-500/20 text-red-400" : "text-zinc-600"}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Task list */}
      {visible.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-xl p-10 text-center text-sm text-zinc-600">
          {filter === "all" ? "No tasks yet. Create one above." : `No ${filter} tasks.`}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((task) => {
            const risk     = (task.risk_level ?? "normal") as RiskLevel;
            const RiskIcon = RISK_CONFIG[risk].icon;
            const isCritical = risk === "critical" || risk === "high";
            const mentionCount = task.mention_count ?? 0;
            const isEscalated  = task.attention?.escalated ?? false;

            return (
              <div key={task.id}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3.5
                            hover:border-zinc-700 transition group
                  ${isCritical
                    ? "border-red-500/20 bg-red-500/[0.03]"
                    : task.done
                      ? "border-zinc-800/50 bg-zinc-900/50 opacity-60"
                      : "border-zinc-800 bg-zinc-900"
                  }`}
              >
                {/* Checkbox */}
                <button onClick={() => handleToggle(task)}
                  className="flex-shrink-0 mt-0.5 text-zinc-600 hover:text-emerald-400 transition">
                  {task.done
                    ? <CheckCircle2 size={17} className="text-emerald-500" />
                    : <Circle size={17} />
                  }
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${task.done ? "line-through text-zinc-600" : "text-white"}`}>
                    <HighlightedText text={task.title} />
                  </p>

                  {task.description && (
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">
                      <HighlightedText text={task.description} />
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {/* Priority */}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${PRIORITY_STYLES[task.priority]}`}>
                      {task.priority}
                    </span>

                    {/* Risk */}
                    {risk !== "normal" && (
                      <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${RISK_CONFIG[risk].cls}`}>
                        <RiskIcon size={9} />
                        {RISK_CONFIG[risk].label}
                      </span>
                    )}

                    {/* Escalated */}
                    {isEscalated && (
                      <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full font-semibold">
                        <ShieldAlert size={9} /> @all escalated
                      </span>
                    )}

                    {/* Mention count */}
                    {mentionCount > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                        <Brain size={9} /> {mentionCount} mention{mentionCount > 1 ? "s" : ""}
                      </span>
                    )}

                    {/* Due date */}
                    {task.due_date && (
                      <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border
                        ${new Date(task.due_date) < new Date() && !task.done
                          ? "text-red-400 bg-red-500/10 border-red-500/20"
                          : "text-zinc-500 bg-zinc-800 border-zinc-700"
                        }`}>
                        <Calendar size={9} />
                        {new Date(task.due_date).toLocaleDateString()}
                        {new Date(task.due_date) < new Date() && !task.done && " · Overdue"}
                      </span>
                    )}

                    {/* Assignee */}
                    {(task.assignee ?? task.assigned_to) && (
                      <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                        <User size={9} />
                        {task.assignee ?? task.assigned_to}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button onClick={() => handleDelete(task.id)}
                  className="flex-shrink-0 text-zinc-700 hover:text-red-400
                             transition opacity-0 group-hover:opacity-100 mt-0.5">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Xavier AI banner */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5">
          <Brain size={14} className="text-red-400 flex-shrink-0" />
          <p className="text-xs text-zinc-400">
            <span className="text-red-400 font-semibold">Xavier AI · </span>
            {criticalCount} task{criticalCount > 1 ? "s" : ""} require{criticalCount === 1 ? "s" : ""} immediate attention.
            {" "}Tasks with @all mentions are escalated to all managers automatically.
          </p>
        </div>
      )}
    </div>
  );
}