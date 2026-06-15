"use client";

import { useEffect, useState, useRef } from "react";
import { supabase }          from "@/lib/supabase";
import { useTenant }         from "@/lib/hooks/useTenant";
import { getCurrentProfile } from "@/lib/profile/profile.service";
import {
  Award, Plus, X, Upload, Search,
  Briefcase, Star, ChevronDown,
  Loader2, CheckCircle2, Users,
  BadgeCheck, Edit3, Save,
} from "lucide-react";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
interface ShowcaseProfile {
  id:             string;
  tenant_id:      string;
  user_id:        string | null;
  title:          string | null;
  description:    string | null;
  created_by:     string;
  created_at:     string;
  headline:       string | null;
  bio:            string | null;
  role:           string | null;
  department:     string | null;
  certifications: string[];
  achievements:   string[];
  profile_image:  string | null;
  media_url:      string | null;
  metadata:       any;
  tags:           string[] | null;
}

interface CurrentProfile {
  id:        string;
  full_name: string | null;
  email:     string | null;
  role?:     string | null;
  department?: string | null;
}

const DEPARTMENTS = [
  "All Departments",
  "Engineering", "Product", "Design", "Marketing",
  "Sales", "HR", "Finance", "Operations",
  "Legal", "Recruitment", "Compliance",
];

function getInitials(name: string | null) {
  if (!name) return "?";
  const p = name.trim().split(" ");
  return p.length >= 2
    ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase()
    : p[0][0].toUpperCase();
}

function extractMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const e = err as Record<string, any>;
  return e.message ?? e.details ?? JSON.stringify(e);
}

// ─────────────────────────────────────────
// SHOWCASE CARD
// ─────────────────────────────────────────
function ShowcaseCard({
  profile, onEdit, isOwn,
}: {
  profile: ShowcaseProfile;
  onEdit:  (p: ShowcaseProfile) => void;
  isOwn:   boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const certs    = profile.certifications ?? [];
  const achieves = profile.achievements   ?? [];
  const name     = profile.title ?? profile.created_by ?? "Unknown";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden
                    hover:border-zinc-700 transition group">

      {/* Profile image / avatar */}
      <div className="relative h-24 bg-gradient-to-br from-indigo-900/40 to-zinc-900">
        {profile.profile_image || profile.media_url ? (
          <img
            src={profile.profile_image ?? profile.media_url ?? ""}
            alt={name}
            className="w-full h-full object-cover opacity-40"
          />
        ) : null}
        <div className="absolute bottom-0 left-5 translate-y-1/2">
          <div className="w-14 h-14 rounded-full border-2 border-zinc-900
                          bg-indigo-500/30 text-indigo-200 flex items-center
                          justify-center text-xl font-bold shadow-lg">
            {getInitials(name)}
          </div>
        </div>
        {isOwn && (
          <button
            onClick={() => onEdit(profile)}
            className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-black/50
                       hover:bg-black/70 flex items-center justify-center
                       opacity-0 group-hover:opacity-100 transition"
          >
            <Edit3 size={13} className="text-white" />
          </button>
        )}
      </div>

      <div className="px-5 pt-9 pb-5 space-y-3">
        {/* Name + role */}
        <div>
          <h3 className="text-base font-bold text-white">{name}</h3>
          {profile.headline && (
            <p className="text-xs text-indigo-400 mt-0.5">{profile.headline}</p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {profile.role && (
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Briefcase size={9} /> {profile.role}
              </span>
            )}
            {profile.department && (
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Users size={9} /> {profile.department}
              </span>
            )}
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">{profile.bio}</p>
        )}

        {/* Certifications */}
        {certs.length > 0 && (
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Certifications</p>
            <div className="flex flex-wrap gap-1.5">
              {certs.slice(0, expanded ? undefined : 3).map((c, i) => (
                <span key={i} className="flex items-center gap-1 text-[10px] px-2 py-0.5
                                         rounded-full bg-emerald-500/10 text-emerald-400
                                         border border-emerald-500/20">
                  <BadgeCheck size={9} /> {c}
                </span>
              ))}
              {!expanded && certs.length > 3 && (
                <button onClick={() => setExpanded(true)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300">
                  +{certs.length - 3} more
                </button>
              )}
            </div>
          </div>
        )}

        {/* Achievements */}
        {achieves.length > 0 && (
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Achievements</p>
            <div className="flex flex-wrap gap-1.5">
              {achieves.slice(0, expanded ? undefined : 2).map((a, i) => (
                <span key={i} className="flex items-center gap-1 text-[10px] px-2 py-0.5
                                         rounded-full bg-amber-500/10 text-amber-400
                                         border border-amber-500/20">
                  <Star size={9} /> {a}
                </span>
              ))}
              {!expanded && achieves.length > 2 && (
                <button onClick={() => setExpanded(true)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300">
                  +{achieves.length - 2} more
                </button>
              )}
            </div>
          </div>
        )}

        {expanded && (
          <button onClick={() => setExpanded(false)}
            className="text-[10px] text-zinc-600 hover:text-zinc-400">
            Show less
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// EDIT / CREATE MODAL
// ─────────────────────────────────────────
function ShowcaseModal({
  tenantId, currentUser, existing, onClose, onSaved,
}: {
  tenantId:    string;
  currentUser: CurrentProfile | null;
  existing:    ShowcaseProfile | null;
  onClose:     () => void;
  onSaved:     () => void;
}) {
  const [headline,        setHeadline]        = useState(existing?.headline        ?? "");
  const [bio,             setBio]             = useState(existing?.bio             ?? "");
  const [role,            setRole]            = useState(existing?.role            ?? currentUser?.role        ?? "");
  const [department,      setDepartment]      = useState(existing?.department      ?? currentUser?.department  ?? "");
  const [certInput,       setCertInput]       = useState("");
  const [certs,           setCerts]           = useState<string[]>(existing?.certifications ?? []);
  const [achieveInput,    setAchieveInput]    = useState("");
  const [achievements,    setAchievements]    = useState<string[]>(existing?.achievements ?? []);
  const [imageFile,       setImageFile]       = useState<File | null>(null);
  const [imagePreview,    setImagePreview]    = useState<string | null>(existing?.profile_image ?? null);
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const addCert = () => {
    if (certInput.trim()) { setCerts((p) => [...p, certInput.trim()]); setCertInput(""); }
  };
  const addAchieve = () => {
    if (achieveInput.trim()) { setAchievements((p) => [...p, achieveInput.trim()]); setAchieveInput(""); }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!currentUser) return;
    setSaving(true);
    setError("");

    try {
      let imageUrl = existing?.profile_image ?? null;

      if (imageFile) {
        const ext  = imageFile.name.split(".").pop();
        const path = `showcase/${tenantId}/${currentUser.id}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("chat-media").upload(path, imageFile, { upsert: true });
        if (upErr) throw new Error(upErr.message);
        const { data } = supabase.storage.from("chat-media").getPublicUrl(path);
        imageUrl = data.publicUrl;
      }

      const payload = {
        tenant_id:      tenantId,
        user_id:        currentUser.id,
        title:          currentUser.full_name ?? currentUser.email,
        created_by:     currentUser.full_name ?? currentUser.email ?? "Unknown",
        headline:       headline.trim()   || null,
        bio:            bio.trim()        || null,
        role:           role.trim()       || null,
        department:     department.trim() || null,
        certifications: certs,
        achievements,
        profile_image:  imageUrl,
        updated_at:     new Date().toISOString(),
      };

      if (existing?.id) {
        const { error } = await supabase
          .from("showcases").update(payload).eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("showcases").insert({ ...payload, created_at: new Date().toISOString() });
        if (error) throw new Error(error.message);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(extractMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-6">
      <div className="w-full max-w-lg mx-4 rounded-2xl border border-zinc-800 bg-[#0f0f1a] p-6 space-y-4">

        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">
            {existing ? "Edit Showcase" : "Create Showcase Profile"}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* Avatar upload */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full border border-zinc-700 overflow-hidden
                          bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
            {imagePreview
              ? <img src={imagePreview} alt="avatar" className="w-full h-full object-cover" />
              : <span className="text-xl font-bold text-indigo-300">
                  {getInitials((currentUser?.full_name ?? currentUser?.email) ?? null)}
                </span>
            }
          </div>
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-700
                       text-xs text-zinc-400 hover:text-white hover:border-zinc-600 transition">
            <Upload size={13} /> Upload Photo
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={handleImageSelect} />
        </div>

        {/* Fields */}
        {[
          { label: "Headline", value: headline, setter: setHeadline, placeholder: "e.g. Senior Nurse · 5 Years Experience" },
          { label: "Role",     value: role,     setter: setRole,     placeholder: "e.g. Registered Nurse" },
          { label: "Department",value: department,setter: setDepartment,placeholder: "e.g. Clinical" },
        ].map(({ label, value, setter, placeholder }) => (
          <div key={label}>
            <label className="text-xs text-zinc-500 mb-1.5 block">{label}</label>
            <input value={value} onChange={(e) => setter(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5
                         text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition" />
          </div>
        ))}

        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Bio</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)}
            placeholder="Tell the team about yourself..."
            rows={3}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5
                       text-sm text-white placeholder-zinc-600 outline-none
                       focus:border-zinc-600 transition resize-none" />
        </div>

        {/* Certifications */}
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Certifications</label>
          <div className="flex gap-2">
            <input value={certInput} onChange={(e) => setCertInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCert(); } }}
              placeholder="e.g. BLS/CPR, RN License..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2
                         text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition" />
            <button onClick={addCert}
              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm transition">
              Add
            </button>
          </div>
          {certs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {certs.map((c, i) => (
                <span key={i} className="flex items-center gap-1 text-[11px] px-2.5 py-1
                                         rounded-full bg-emerald-500/10 text-emerald-400
                                         border border-emerald-500/20">
                  <BadgeCheck size={10} /> {c}
                  <button onClick={() => setCerts((p) => p.filter((_, j) => j !== i))}
                    className="ml-0.5 hover:text-white"><X size={9} /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Achievements */}
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Achievements</label>
          <div className="flex gap-2">
            <input value={achieveInput} onChange={(e) => setAchieveInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAchieve(); } }}
              placeholder="e.g. Top Recruiter Q1, 100% Compliance..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2
                         text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition" />
            <button onClick={addAchieve}
              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm transition">
              Add
            </button>
          </div>
          {achievements.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {achievements.map((a, i) => (
                <span key={i} className="flex items-center gap-1 text-[11px] px-2.5 py-1
                                         rounded-full bg-amber-500/10 text-amber-400
                                         border border-amber-500/20">
                  <Star size={10} /> {a}
                  <button onClick={() => setAchievements((p) => p.filter((_, j) => j !== i))}
                    className="ml-0.5 hover:text-white"><X size={9} /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-zinc-800 text-sm text-zinc-400 hover:text-white transition">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                       bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold
                       disabled:opacity-40 transition">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving..." : existing ? "Save Changes" : "Create Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────
export default function ShowcasePage() {
  const { tenantId, loading: tenantLoading } = useTenant();

  const [profiles,    setProfiles]    = useState<ShowcaseProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentProfile | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [editing,     setEditing]     = useState<ShowcaseProfile | null>(null);
  const [search,      setSearch]      = useState("");
  const [department,  setDepartment]  = useState("All Departments");

  useEffect(() => {
    getCurrentProfile().then((p) => { if (p) setCurrentUser(p); });
  }, []);

  const load = async () => {
    if (tenantLoading) return;
    const { data } = await supabase
      .from("showcases").select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    setProfiles((data ?? []) as ShowcaseProfile[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenantId, tenantLoading]);

  useEffect(() => {
    if (tenantLoading) return;
    const channel = supabase.channel("showcase-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "showcases" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, tenantLoading]);

  const visible = profiles.filter((p) => {
    const name = (p.title ?? p.created_by ?? "").toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) ||
      (p.role ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.headline ?? "").toLowerCase().includes(search.toLowerCase());
    const matchDept = department === "All Departments" || p.department === department;
    return matchSearch && matchDept;
  });

  const myProfile = profiles.find((p) => p.user_id === currentUser?.id);

  if (loading || tenantLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading showcase...
      </div>
    );
  }

  return (
    <>
      {showModal && (
        <ShowcaseModal
          tenantId={tenantId}
          currentUser={currentUser}
          existing={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={() => { load(); }}
        />
      )}

      <div className="p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Award size={22} className="text-indigo-400" /> Showcase
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Internal talent visibility · certifications · achievements
            </p>
          </div>
          <button
            onClick={() => { setEditing(myProfile ?? null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600
                       hover:bg-indigo-500 text-white text-sm font-semibold transition">
            <Plus size={15} />
            {myProfile ? "Edit My Profile" : "Add My Profile"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Profiles",        value: profiles.length },
            { label: "Certifications",  value: profiles.reduce((s, p) => s + (p.certifications?.length ?? 0), 0) },
            { label: "Achievements",    value: profiles.reduce((s, p) => s + (p.achievements?.length ?? 0), 0) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5">
            <Search size={14} className="text-zinc-600 flex-shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, role or headline..."
              className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none" />
            {search && (
              <button onClick={() => setSearch("")} className="text-zinc-600 hover:text-zinc-400">
                <X size={14} />
              </button>
            )}
          </div>
          <select value={department} onChange={(e) => setDepartment(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5
                       text-sm text-white outline-none cursor-pointer">
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d} className="bg-zinc-900">{d}</option>
            ))}
          </select>
        </div>

        {/* Grid */}
        {visible.length === 0 ? (
          <div className="border border-dashed border-zinc-800 rounded-xl p-10 text-center text-sm text-zinc-600">
            {search || department !== "All Departments"
              ? "No profiles match your search."
              : "No showcase profiles yet. Add yours to get started!"}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((p) => (
              <ShowcaseCard
                key={p.id}
                profile={p}
                isOwn={p.user_id === currentUser?.id}
                onEdit={(profile) => { setEditing(profile); setShowModal(true); }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}