"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/lib/hooks/useTenant";
import LeaveTimeOff from "@/app/dashboard/components/leave/LeaveTimeOff";
import EmployeeRecords from "@/app/dashboard/components/leave/EmployeeRecords";
import {
  getCurrentProfile, upsertProfile,
  uploadAvatar, getYearsOfService,
  type Profile, type WorkMode,
} from "@/lib/profile/profile.service";
import {
  User, Camera, Save, CheckCircle2, AlertCircle,
  Building2, Briefcase, Globe, Mail, Shield,
  Phone, MapPin, Calendar, Monitor, Home, Users,
} from "lucide-react";

const TIMEZONES = [
  "Africa/Lagos","Africa/Nairobi","Africa/Johannesburg",
  "Europe/London","Europe/Paris","America/New_York",
  "America/Los_Angeles","America/Chicago","Asia/Dubai",
  "Asia/Karachi","Asia/Kolkata","Asia/Singapore","Australia/Sydney",
];

const DEPARTMENTS = [
  "Engineering","Product","Design","Marketing","Sales",
  "HR","Finance","Operations","Legal","Customer Success",
];

const WORK_MODES: { value: WorkMode; label: string; icon: React.ElementType; desc: string }[] = [
  { value: "onsite",  label: "Onsite",  icon: Monitor, desc: "Full-time in office"     },
  { value: "remote",  label: "Remote",  icon: Home,    desc: "Full-time remote"         },
  { value: "hybrid",  label: "Hybrid",  icon: Users,   desc: "Mix of onsite and remote" },
];

interface Toast { id: string; type: "success" | "error"; message: string; }

function Toast({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl
          border text-sm shadow-lg
          ${t.type === "success"
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
            : "bg-red-500/15 border-red-500/30 text-red-300"}`}>
          {t.type === "success"
            ? <CheckCircle2 size={15} className="flex-shrink-0" />
            : <AlertCircle  size={15} className="flex-shrink-0" />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

function getInitials(name: string | null, email: string | null) {
  if (name) {
    const p = name.trim().split(" ");
    return p.length >= 2
      ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase()
      : p[0][0].toUpperCase();
  }
  return email?.[0]?.toUpperCase() ?? "?";
}

function Field({
  label, icon: Icon, required, children,
}: {
  label: string; icon: React.ElementType;
  required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5">
        <Icon size={12} />
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = `w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3
  text-sm text-white placeholder-zinc-600 outline-none
  focus:border-zinc-600 transition`;

const disabledCls = `w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3
  text-sm text-zinc-600 outline-none cursor-not-allowed`;

export default function ProfilePage() {
  const { tenantId, loading: tenantLoading } = useTenant();

  const [profile,         setProfile]         = useState<Profile | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [toasts,          setToasts]          = useState<Toast[]>([]);
  const [isEditing,       setIsEditing]       = useState(false);
  const [section,         setSection]         = useState<"profile" | "leave" | "records">("profile");

  // Form state
  const [fullName,    setFullName]    = useState("");
  const [email,       setEmail]       = useState<string | null>(null);
  const [role,        setRole]        = useState<string | null>(null);
  const [department,  setDepartment]  = useState("");
  const [customDept,  setCustomDept]  = useState("");
  const [position,    setPosition]    = useState("");
  const [timezone,    setTimezone]    = useState("Africa/Lagos");
  const [location,    setLocation]    = useState("");
  const [workMode,    setWorkMode]    = useState<WorkMode>("onsite");
  const [dateJoined,  setDateJoined]  = useState("");
  const [phone,       setPhone]       = useState("");
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (type: "success" | "error", message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  // ── Load ──────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const p = await getCurrentProfile();
        if (p) {
          setProfile(p);
          setIsEditing(false);
          setFullName(p.full_name   ?? "");
          setEmail(p.email          ?? null);
          setRole(p.role            ?? null);
          setDepartment(p.department ?? "");
          setPosition(p.position    ?? "");
          setTimezone(p.timezone    ?? "Africa/Lagos");
          setLocation(p.location    ?? "");
          setWorkMode((p.work_mode  ?? "onsite") as WorkMode);
          setDateJoined(p.date_joined ?? "");
          setPhone(p.phone          ?? "");
          setAvatarUrl(p.avatar_url ?? null);
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          setEmail(session?.user?.email ?? null);
        }
      } catch (err) {
        showToast("error", err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Save ──────────────────────────────────
  const handleSave = async () => {
    if (!fullName.trim())  { showToast("error", "Full name is required");  return; }
    if (!department.trim() && !customDept.trim()) {
      showToast("error", "Department is required"); return;
    }
    if (!position.trim())  { showToast("error", "Position is required");   return; }

    setSaving(true);
    try {
      const saved = await upsertProfile({
        full_name:   fullName.trim(),
        department:  department === "__custom__" ? customDept.trim() : department.trim(),
        position:    position.trim(),
        timezone,
        tenant_id:   tenantId,
        location:    location.trim()   || undefined,
        work_mode:   workMode,
        date_joined: dateJoined        || undefined,
        phone:       phone.trim()      || undefined,
      });
      setProfile(saved);
      setIsEditing(false);
      showToast("success", "Profile saved successfully");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Avatar ────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUrl(URL.createObjectURL(file));
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatar(file);
      setAvatarUrl(url);
      showToast("success", "Avatar updated");
    } catch (err) {
      showToast("error", `Avatar upload failed: ${err instanceof Error ? err.message : String(err)}`);
      setAvatarUrl(profile?.avatar_url ?? null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading || tenantLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        Loading profile...
      </div>
    );
  }

  const isNew = !profile;
  const yearsOfService = getYearsOfService(profile?.date_joined ?? null);

  // Completeness
  const fields = [fullName, department, position, timezone, location, workMode, dateJoined, avatarUrl];
  const filled = fields.filter(Boolean).length;
  const pct    = Math.round((filled / fields.length) * 100);

  return (
    <>
      <Toast toasts={toasts} />

      <div className="p-4 md:p-6 max-w-2xl space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isNew ? "Create Employee Profile" : "Employee Profile"}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            {isNew
              ? "Complete your profile — syncs across clocking, chat, onboarding and all features."
              : "Your profile syncs across clocking, chat, onboarding and all features."
            }
          </p>
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-2">
          {([["profile","Profile"],["leave","Leave / Time Off"],["records","Records"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setSection(id)}
              className={`px-3 py-1.5 rounded-lg text-xs transition
                ${section === id ? "bg-white/[0.07] text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
              {label}
            </button>
          ))}
        </div>

        {section === "leave" && profile && tenantId && (
          <LeaveTimeOff userId={profile.id} tenantId={tenantId} role={profile.role} />
        )}

        {section === "records" && profile && tenantId && (
          <EmployeeRecords
            userId={profile.id}
            tenantId={tenantId}
            role={profile.role}
            fullName={profile.full_name}
            dateJoined={profile.date_joined}
          />
        )}

        {section === "profile" && (<>
        {/* Summary view — collapsed when not editing */}
        {!isEditing && profile && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-zinc-700
                              flex items-center justify-center bg-zinc-800 flex-shrink-0">
                {avatarUrl
                  ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  : <span className="text-xl font-bold text-zinc-400">{getInitials(fullName || null, email)}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-base truncate">{fullName || "—"}</p>
                <p className="text-zinc-500 text-sm truncate">{email}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {role && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{role}</span>}
                  {department && <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{department}</span>}
                  {position && <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">{position}</span>}
                  {workMode && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{workMode}</span>}
                  {location && <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">{location}</span>}
                  {dateJoined && <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">{yearsOfService} tenure</span>}
                </div>
              </div>
            </div>
            <div className="h-px bg-zinc-800" />
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Profile {pct}% complete</span>
              <button onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600
                           hover:bg-indigo-500 text-white text-xs font-semibold transition">
                Edit Profile
              </button>
            </div>
          </div>
        )}

        {(isEditing || !profile) && <>
        {/* Avatar + identity */}
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-zinc-700
                            flex items-center justify-center bg-zinc-800">
              {avatarUrl
                ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                : <span className="text-2xl font-bold text-zinc-400">
                    {getInitials(fullName || null, email)}
                  </span>
              }
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full
                         bg-indigo-600 hover:bg-indigo-500 border-2 border-[#0f0f1a]
                         flex items-center justify-center transition disabled:opacity-50"
            >
              <Camera size={12} className="text-white" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={handleAvatarChange} />
          </div>

          <div className="min-w-0">
            <p className="text-white font-semibold truncate">{fullName || "Your Name"}</p>
            <p className="text-zinc-500 text-sm truncate">{email}</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {role && (
                <span className="text-[11px] px-2 py-0.5 rounded-full
                                 bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {role}
                </span>
              )}
              {workMode && (
                <span className="text-[11px] px-2 py-0.5 rounded-full
                                 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {workMode}
                </span>
              )}
              {!isNew && dateJoined && (
                <span className="text-[11px] px-2 py-0.5 rounded-full
                                 bg-zinc-800 text-zinc-400 border border-zinc-700">
                  {yearsOfService} tenure
                </span>
              )}
            </div>
            {uploadingAvatar && (
              <p className="text-xs text-indigo-400 mt-1">Uploading...</p>
            )}
          </div>
        </div>

        {/* ── FORM ── */}
        <div className="space-y-4">

          {/* Full name */}
          <Field label="Full Name" icon={User} required>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Doe" className={inputCls} />
          </Field>

          {/* Email — read only */}
          <Field label="Email" icon={Mail}>
            <input value={email ?? ""} disabled className={disabledCls} />
          </Field>

          {/* Phone */}
          <Field label="Phone Number" icon={Phone}>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +234 800 000 0000" className={inputCls} />
          </Field>

          {/* Department */}
          <Field label="Department" icon={Building2} required>
            <select value={department} onChange={(e) => setDepartment(e.target.value)}
              className={inputCls + " cursor-pointer"}>
              <option value="" className="bg-zinc-900">Select department...</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d} className="bg-zinc-900">{d}</option>
              ))}
              <option value="__custom__" className="bg-zinc-900">Other (type below)</option>
            </select>
            {department === "__custom__" && (
              <input autoFocus value={customDept}
                onChange={(e) => setCustomDept(e.target.value)}
                placeholder="Type your department..."
                className={inputCls + " mt-2"} />
            )}
          </Field>

          {/* Position */}
          <Field label="Position / Job Title" icon={Briefcase} required>
            <input value={position} onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. Senior Engineer" className={inputCls} />
          </Field>

          {/* Role — read only */}
          {role && (
            <Field label="Role" icon={Shield}>
              <div className={disabledCls}>
                {role} <span className="text-zinc-700 text-xs ml-2">(set by admin)</span>
              </div>
            </Field>
          )}

          {/* Date of engagement */}
          <Field label="Date of Engagement" icon={Calendar}>
            <input type="date" value={dateJoined}
              onChange={(e) => setDateJoined(e.target.value)}
              className={inputCls} />
            {dateJoined && (
              <p className="text-[11px] text-zinc-600 mt-1">
                Years of service: <span className="text-zinc-400">{getYearsOfService(dateJoined)}</span>
              </p>
            )}
          </Field>

          {/* Location */}
          <Field label="Location" icon={MapPin}>
            <input value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Lagos, Nigeria" className={inputCls} />
          </Field>

          {/* Timezone */}
          <Field label="Timezone" icon={Globe}>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
              className={inputCls + " cursor-pointer"}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz} className="bg-zinc-900">{tz}</option>
              ))}
            </select>
          </Field>

          {/* Work mode toggle */}
          <div>
            <label className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
              <Monitor size={12} />
              Work Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {WORK_MODES.map(({ value, label, icon: Icon, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setWorkMode(value)}
                  className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl
                              border text-sm transition-colors
                    ${workMode === value
                      ? "bg-indigo-500/20 border-indigo-400/40 text-indigo-300"
                      : "bg-white/[0.02] border-white/[0.08] text-zinc-500 hover:text-zinc-300"
                    }`}
                >
                  <Icon size={18} />
                  <span className="font-medium text-xs">{label}</span>
                  <span className="text-[10px] text-center opacity-60 leading-tight">{desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Completeness bar */}
        <div>
          <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
            <span>Profile completeness</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500
                ${pct === 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {pct < 100 && (
            <p className="text-[11px] text-zinc-600 mt-1">
              Complete your profile to unlock all features.
            </p>
          )}
        </div>

        {/* Save */}
        <button onClick={handleSave} disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl
                     bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm
                     disabled:opacity-50 transition">
          <Save size={15} />
          {saving ? "Saving..." : isNew ? "Create Profile" : "Save Changes"}
        </button>

        <p className="text-[11px] text-zinc-600 text-center">
          Profile syncs automatically to clocking, chat, onboarding, compliance and task center.
        </p>
        {profile && (
          <button onClick={() => setIsEditing(false)}
            className="w-full py-2 text-xs text-zinc-600 hover:text-zinc-400 transition">
            Cancel editing
          </button>
        )}
        </>}
        </>)}
      </div>
    </>
  );
}