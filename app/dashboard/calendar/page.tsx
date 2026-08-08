"use client";

import { supabase }    from "../../../lib/supabase";
import { isValidEmail } from "@/lib/validation";
import { useEffect, useState, useCallback } from "react";
import {
  CalendarDays, Clock3, Users, Plus, X, Video,
  Mic, MapPin, Copy, CheckCircle2, Mail, Globe,
  Link2, Loader2, ChevronDown, User, AtSign,
} from "lucide-react";
import { createMeeting, getMeetings } from "../../../lib/calendar/calendar.service";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
interface Meeting {
  id:              string;
  title:           string;
  meeting_type:    string;
  scheduled_start: string;
  scheduled_end:   string;
  department:      string | null;
  candidate_id:    string | null;
  candidate_name:  string | null;
  candidate_email: string | null;
  interviewer_name:string | null;
  timezone:        string | null;
  invite_link:     string | null;
  status:          string;
  description:     string | null;
}

interface Candidate {
  id:    string;
  name:  string;
  email: string;
  role:  string | null;
}

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────
const MEETING_TYPES = [
  { value: "teams_video", label: "Teams Video", icon: Video  },
  { value: "voice",       label: "Voice Call",  icon: Mic    },
  { value: "in_person",   label: "In-Person",   icon: MapPin },
  { value: "interview",   label: "Interview",   icon: Users  },
];

const TYPE_COLORS: Record<string, string> = {
  teams_video: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  voice:       "bg-purple-500/15 text-purple-400 border-purple-500/20",
  in_person:   "bg-amber-500/15 text-amber-400 border-amber-500/20",
  interview:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

const TIMEZONES = [
  { label: "Lagos (WAT)",          value: "Africa/Lagos",           offset: "+01:00" },
  { label: "London (GMT/BST)",     value: "Europe/London",          offset: "+00:00/+01:00" },
  { label: "New York (EST/EDT)",   value: "America/New_York",       offset: "-05:00/-04:00" },
  { label: "Chicago (CST/CDT)",    value: "America/Chicago",        offset: "-06:00/-05:00" },
  { label: "Los Angeles (PST/PDT)",value: "America/Los_Angeles",    offset: "-08:00/-07:00" },
  { label: "Dubai (GST)",          value: "Asia/Dubai",             offset: "+04:00" },
  { label: "Nairobi (EAT)",        value: "Africa/Nairobi",         offset: "+03:00" },
  { label: "Johannesburg (SAST)",  value: "Africa/Johannesburg",    offset: "+02:00" },
  { label: "Paris (CET/CEST)",     value: "Europe/Paris",           offset: "+01:00/+02:00" },
  { label: "Kolkata (IST)",        value: "Asia/Kolkata",           offset: "+05:30" },
  { label: "Singapore (SGT)",      value: "Asia/Singapore",         offset: "+08:00" },
  { label: "Sydney (AEST/AEDT)",   value: "Australia/Sydney",       offset: "+10:00/+11:00" },
];

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function generateInviteLink(meetingId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/interview/join?meetingId=${meetingId}`;
}

function convertToTimezone(isoDate: string, tz: string): string {
  try {
    return new Date(isoDate).toLocaleString("en-US", {
      timeZone:     tz,
      weekday:      "long",
      year:         "numeric",
      month:        "long",
      day:          "numeric",
      hour:         "2-digit",
      minute:       "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return new Date(isoDate).toLocaleString();
  }
}

function buildInviteEmail({
  candidateName,
  candidateEmail,
  role,
  interviewerName,
  scheduledStart,
  scheduledEnd,
  recruiterTz,
  inviteLink,
  meetingType,
  title,
}: {
  candidateName:   string;
  candidateEmail:  string;
  role:            string;
  interviewerName: string;
  scheduledStart:  string;
  scheduledEnd:    string;
  recruiterTz:     string;
  inviteLink:      string;
  meetingType:     string;
  title:           string;
}): { subject: string; body: string } {
  // Convert to multiple common timezones for the candidate
  const commonTzs = [
    { label: "Lagos (WAT)",        tz: "Africa/Lagos"        },
    { label: "London (GMT/BST)",   tz: "Europe/London"       },
    { label: "New York (EST/EDT)", tz: "America/New_York"    },
    { label: "Dubai (GST)",        tz: "Asia/Dubai"          },
  ];

  const tzLines = commonTzs
    .map(({ label, tz }) => `  ${label}: ${convertToTimezone(scheduledStart, tz)}`)
    .join("\n");

  const endFormatted = new Date(scheduledEnd).toLocaleTimeString("en-US", {
    timeZone: recruiterTz, hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });

  const subject = `Interview Invitation — ${role} | ${title}`;

  const body = `Dear ${candidateName},

We are pleased to invite you to an interview for the ${role} position.

────────────────────────────────
INTERVIEW DETAILS
────────────────────────────────
Position:     ${role}
Interviewer:  ${interviewerName}
Format:       ${MEETING_TYPES.find(t => t.value === meetingType)?.label ?? meetingType}
Duration:     ${Math.round((new Date(scheduledEnd).getTime() - new Date(scheduledStart).getTime()) / 60000)} minutes

SCHEDULED TIME (your timezone):
${tzLines}
  End time: ${endFormatted}

────────────────────────────────
JOIN YOUR INTERVIEW
────────────────────────────────
${inviteLink}

Click the link above at your scheduled time to join. Please ensure:
• You have a stable internet connection
• Your camera and microphone are working
• You are in a quiet environment 10 minutes before the interview

If you need to reschedule or have any questions, please reply to this email or contact our recruitment team.

We look forward to speaking with you.

Best regards,
${interviewerName}
PivotOps Recruitment Team`;

  return { subject, body };
}

// ─────────────────────────────────────────
// INVITE CARD — shown after interview is created
// ─────────────────────────────────────────
function InterviewInviteCard({
  meeting,
  onClose,
}: {
  meeting:  Meeting;
  onClose:  () => void;
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [candidateTz, setCandidateTz] = useState("Africa/Lagos");

  const inviteLink = meeting.invite_link ?? generateInviteLink(meeting.id);

  const email = buildInviteEmail({
    candidateName:   meeting.candidate_name   ?? "Candidate",
    candidateEmail:  meeting.candidate_email  ?? "",
    role:            meeting.description      ?? meeting.title,
    interviewerName: meeting.interviewer_name ?? "Recruiter",
    scheduledStart:  meeting.scheduled_start,
    scheduledEnd:    meeting.scheduled_end,
    recruiterTz:     meeting.timezone         ?? "Africa/Lagos",
    inviteLink,
    meetingType:     meeting.meeting_type,
    title:           meeting.title,
  });

  const copy = async (text: string, which: "link" | "body") => {
    await navigator.clipboard.writeText(text);
    if (which === "link") { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }
    else                  { setCopiedBody(true); setTimeout(() => setCopiedBody(false), 2000); }
  };

  const candidateLocalTime = convertToTimezone(meeting.scheduled_start, candidateTz);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-6">
      <div className="w-full max-w-2xl mx-4 rounded-2xl border border-emerald-500/25 bg-[#0a0a14] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-emerald-500/5">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Interview Scheduled</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Meeting summary */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
            <p className="text-sm font-semibold text-white">{meeting.title}</p>
            <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <CalendarDays size={11} />
                {convertToTimezone(meeting.scheduled_start, meeting.timezone ?? "Africa/Lagos")}
              </span>
              {meeting.candidate_name && (
                <span className="flex items-center gap-1">
                  <User size={11} /> {meeting.candidate_name}
                </span>
              )}
              {meeting.candidate_email && (
                <span className="flex items-center gap-1">
                  <AtSign size={11} /> {meeting.candidate_email}
                </span>
              )}
            </div>
          </div>

          {/* Candidate invite link */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">
              Candidate Join Link
            </label>
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5">
              <Link2 size={13} className="text-zinc-500 flex-shrink-0" />
              <span className="text-xs text-zinc-300 font-mono truncate flex-1">{inviteLink}</span>
              <button
                onClick={() => copy(inviteLink, "link")}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition flex-shrink-0"
              >
                {copiedLink ? <CheckCircle2 size={11} className="text-emerald-400" /> : <Copy size={11} />}
                {copiedLink ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Timezone converter */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block flex items-center gap-1">
              <Globe size={11} /> Candidate Timezone Converter
            </label>
            <div className="flex gap-2 flex-wrap items-center">
              <select
                value={candidateTz}
                onChange={e => setCandidateTz(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none cursor-pointer flex-1"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value} className="bg-zinc-900">{tz.label}</option>
                ))}
              </select>
              <div className="flex-1 min-w-48 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
                <p className="text-xs text-zinc-400">{candidateLocalTime}</p>
              </div>
            </div>
          </div>

          {/* Common timezone table */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center gap-2">
              <Globe size={13} className="text-zinc-500" />
              <span className="text-xs font-medium text-zinc-400">Interview Time by Timezone</span>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {TIMEZONES.slice(0, 6).map(tz => (
                <div key={tz.value} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-zinc-500">{tz.label}</span>
                  <span className="text-xs text-white font-medium">
                    {convertToTimezone(meeting.scheduled_start, tz.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Email subject */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block flex items-center gap-1">
              <Mail size={11} /> Email to Candidate
            </label>
            <div className="space-y-2">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Subject</p>
                <p className="text-xs text-white">{email.subject}</p>
              </div>
              <div className="relative">
                <pre className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto font-mono">
                  {email.body}
                </pre>
                <button
                  onClick={() => copy(`Subject: ${email.subject}\n\n${email.body}`, "body")}
                  className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition"
                >
                  {copiedBody ? <CheckCircle2 size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  {copiedBody ? "Copied!" : "Copy email"}
                </button>
              </div>
              {meeting.candidate_email && (
                <a
                  href={`mailto:${meeting.candidate_email}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-sm font-medium hover:bg-indigo-500/20 transition"
                >
                  <Mail size={14} /> Open in Email Client
                </a>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-zinc-800 text-sm text-zinc-400 hover:text-white transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────
export default function CalendarPage() {
  const [meetings,       setMeetings]       = useState<Meeting[]>([]);
  const [candidates,     setCandidates]     = useState<Candidate[]>([]);
  const [currentUser,    setCurrentUser]    = useState<{ id: string; full_name: string | null; email: string | null; tenant_id: string | null } | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showModal,      setShowModal]      = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [inviteMeeting,  setInviteMeeting]  = useState<Meeting | null>(null);

  // Form state
  const [title,          setTitle]          = useState("");
  const [department,     setDepartment]     = useState("Recruitment");
  const [meetingType,    setMeetingType]    = useState("teams_video");
  const [dateVal,        setDateVal]        = useState("");
  const [timeVal,        setTimeVal]        = useState("09:00");
  const [durationMins,   setDurationMins]   = useState(30);
  const [formError,      setFormError]      = useState("");
  const [description,    setDescription]    = useState("");
  const [timezone,       setTimezone]       = useState("Africa/Lagos");
  // Interview-specific
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [candidateEmail,      setCandidateEmail]      = useState("");
  const [candidateName,       setCandidateName]       = useState("");

  const isInterview = meetingType === "interview";

  // Load current user
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      supabase.from("profiles").select("id, full_name, email, tenant_id")
        .eq("id", user.id).single()
        .then(({ data: p }) => setCurrentUser(p));
    });
  }, []);

  // Load candidates for interview scheduling
  useEffect(() => {
    supabase.from("candidates")
      .select("id, name, email, role")
      .in("status", ["interview", "recruitment_review", "hired"])
      .order("created_at", { ascending: false })
      .then(({ data }) => setCandidates((data ?? []) as Candidate[]));
  }, []);

  const loadMeetings = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("calendar_events")
        .select("*")
        .order("starts_at", { ascending: true });

      setMeetings((data ?? []).map((m: any) => ({
        id:               m.id,
        title:            m.title,
        meeting_type:     m.event_type ?? m.meeting_type ?? "teams_video",
        scheduled_start:  m.starts_at  ?? m.scheduled_start,
        scheduled_end:    m.ends_at    ?? m.scheduled_end,
        department:       m.department ?? null,
        candidate_id:     m.candidate_id    ?? null,
        candidate_name:   m.candidate_name  ?? null,
        candidate_email:  m.candidate_email ?? null,
        interviewer_name: m.interviewer_name ?? null,
        timezone:         m.timezone   ?? "Africa/Lagos",
        invite_link:      m.invite_link ?? null,
        status:           m.status     ?? "scheduled",
        description:      m.description ?? null,
      })));
    } catch (err) {
      console.error("Failed loading meetings:", err instanceof Error ? err.message : err);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => { loadMeetings(); }, [loadMeetings]);

  // When candidate is selected, auto-fill email + name
  const handleCandidateSelect = (id: string) => {
    setSelectedCandidateId(id);
    const c = candidates.find(x => x.id === id);
    if (c) {
      setCandidateName(c.name);
      setCandidateEmail(c.email);
      if (!title) setTitle(`Interview — ${c.name} · ${c.role ?? "Candidate"}`);
    }
  };

  const handleCreateMeeting = async () => {
    setFormError("");
    if (!title.trim())  { setFormError("Meeting title is required.");    return; }
    if (!dateVal)        { setFormError("Please pick a date.");           return; }
    if (isInterview && !candidateEmail.trim()) {
      setFormError("Candidate email is required for interview scheduling.");
      return;
    }
    if (isInterview && !isValidEmail(candidateEmail)) {
      setFormError("Please enter a valid candidate email address.");
      return;
    }

    const scheduledStart = new Date(`${dateVal}T${timeVal}:00`);
    const scheduledEnd   = new Date(scheduledStart.getTime() + durationMins * 60 * 1000);
    const meetingId      = crypto.randomUUID();
    const inviteLink     = generateInviteLink(meetingId);

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase.from("calendar_events").insert({
        id:               meetingId,
        title:            title.trim(),
        event_type:       meetingType,
        department:       department.trim() || null,
        description:      description.trim() || null,
        starts_at:        scheduledStart.toISOString(),
        ends_at:          scheduledEnd.toISOString(),
        assigned_user_id: session?.user?.id ?? null,
        tenant_id:        currentUser?.tenant_id ?? null,
        candidate_id:     selectedCandidateId || null,
        candidate_name:   candidateName.trim()  || null,
        candidate_email:  candidateEmail.trim() || null,
        interviewer_name: currentUser?.full_name ?? currentUser?.email ?? "Recruiter",
        timezone,
        invite_link:      isInterview ? inviteLink : null,
        status:           "scheduled",
        created_at:       new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      }).select().single();

      if (error) throw new Error(error.message);

      await loadMeetings();
      setShowModal(false);
      resetForm();

      // Auto-open invite card for interview type
      if (isInterview && data) {
        setInviteMeeting({
          id:               data.id,
          title:            data.title,
          meeting_type:     data.event_type,
          scheduled_start:  data.starts_at,
          scheduled_end:    data.ends_at,
          department:       data.department,
          candidate_id:     data.candidate_id,
          candidate_name:   data.candidate_name,
          candidate_email:  data.candidate_email,
          interviewer_name: data.interviewer_name,
          timezone:         data.timezone,
          invite_link:      data.invite_link,
          status:           data.status,
          description:      data.description,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(msg || "Failed to create meeting. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTitle(""); setDepartment("Recruitment"); setMeetingType("teams_video");
    setDateVal(""); setTimeVal("09:00"); setDurationMins(30); setFormError("");
    setDescription(""); setSelectedCandidateId(""); setCandidateEmail(""); setCandidateName("");
    setTimezone("Africa/Lagos");
  };

  if (initialLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-zinc-500 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading calendar...
      </div>
    );
  }

  const upcoming = meetings.filter(m => new Date(m.scheduled_start) >= new Date());
  const past     = meetings.filter(m => new Date(m.scheduled_start) <  new Date());

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Invite card overlay */}
      {inviteMeeting && (
        <InterviewInviteCard
          meeting={inviteMeeting}
          onClose={() => setInviteMeeting(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendar</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Scheduling · interviews · onboarding · compliance sessions
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5
                     text-sm font-semibold text-black hover:bg-emerald-400 transition"
        >
          <Plus size={15} /> Schedule Meeting
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total",     value: meetings.length,                                             color: "text-white"       },
          { label: "Upcoming",  value: upcoming.length,                                             color: "text-emerald-400" },
          { label: "Interviews",value: meetings.filter(m => m.meeting_type === "interview").length,color: "text-indigo-400"  },
          { label: "Past",      value: past.length,                                                 color: "text-zinc-500"    },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Meetings list */}
      {meetings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-600">
          No meetings scheduled yet. Create your first session above.
        </div>
      ) : (
        <div className="space-y-4">
          {upcoming.length > 0 && (
            <>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Upcoming</p>
              <div className="grid gap-3">
                {upcoming.map(m => (
                  <MeetingCard
                    key={m.id} meeting={m}
                    onShowInvite={() => setInviteMeeting(m)}
                  />
                ))}
              </div>
            </>
          )}
          {past.length > 0 && (
            <>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-4">Past</p>
              <div className="grid gap-3 opacity-60">
                {past.slice(0, 5).map(m => (
                  <MeetingCard
                    key={m.id} meeting={m}
                    onShowInvite={() => setInviteMeeting(m)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* CREATE MEETING MODAL */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-6"
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); resetForm(); } }}
        >
          <div className="w-full max-w-lg mx-4 rounded-2xl border border-zinc-800 bg-[#0f0f1a] p-6 space-y-5">

            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Schedule Meeting</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-zinc-500 hover:text-white transition">
                <X size={18} />
              </button>
            </div>

            {/* Meeting type */}
            <div>
              <label className="text-xs text-zinc-500 mb-2 block">Meeting type</label>
              <div className="grid grid-cols-2 gap-2">
                {MEETING_TYPES.map(({ value, label, icon: Icon }) => (
                  <button key={value} onClick={() => setMeetingType(value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition text-left
                      ${meetingType === value
                        ? "bg-indigo-500/20 border-indigo-400/40 text-indigo-300"
                        : "bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-zinc-200"}`}>
                    <Icon size={14} />{label}
                  </button>
                ))}
              </div>
            </div>

            {/* Candidate selector for interviews */}
            {isInterview && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <Users size={12} /> Interview Candidate
                </p>
                <div>
                  <label className="text-xs text-zinc-500 mb-1.5 block">Select candidate</label>
                  <select
                    value={selectedCandidateId}
                    onChange={e => handleCandidateSelect(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none cursor-pointer"
                  >
                    <option value="" className="bg-zinc-900">Select from active candidates...</option>
                    {candidates.map(c => (
                      <option key={c.id} value={c.id} className="bg-zinc-900">
                        {c.name} — {c.role ?? "Candidate"}
                      </option>
                    ))}
                    <option value="manual" className="bg-zinc-900">Enter manually...</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">Candidate name *</label>
                    <input
                      value={candidateName}
                      onChange={e => setCandidateName(e.target.value)}
                      placeholder="Full name"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">Candidate email *</label>
                    <input
                      type="email"
                      value={candidateEmail}
                      onChange={e => setCandidateEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition"
                    />
                  </div>
                </div>
                <div className="flex items-start gap-2 text-[11px] text-emerald-400/70 bg-emerald-500/5 rounded-lg px-3 py-2">
                  <Link2 size={11} className="mt-0.5 flex-shrink-0" />
                  A unique join link and email draft will be generated automatically after scheduling.
                </div>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">Title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={isInterview ? "e.g. LPN Interview — Sarah Mitchell" : "e.g. Team Sync"}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition"
              />
            </div>

            {/* Department */}
            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">Department</label>
              <input
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition"
              />
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Date *</label>
                <input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-600 transition" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Time *</label>
                <input type="time" value={timeVal} onChange={e => setTimeVal(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-600 transition" />
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block flex items-center gap-1">
                <Globe size={11} /> Your Timezone (for invite)
              </label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none cursor-pointer">
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value} className="bg-zinc-900">{tz.label}</option>
                ))}
              </select>
            </div>

            {/* Duration */}
            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">Duration: {durationMins} min</label>
              <input type="range" min={15} max={120} step={15} value={durationMins}
                onChange={e => setDurationMins(Number(e.target.value))}
                className="w-full accent-emerald-500" />
              <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                <span>15m</span><span>30m</span><span>45m</span><span>60m</span><span>90m</span><span>120m</span>
              </div>
            </div>

            {formError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => { setShowModal(false); resetForm(); }}
                className="flex-1 py-2.5 rounded-xl border border-zinc-800 text-sm text-zinc-400 hover:text-white transition">
                Cancel
              </button>
              <button onClick={handleCreateMeeting} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50 transition">
                {saving ? "Saving..." : isInterview ? "Schedule & Generate Invite" : "Create Meeting"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// MEETING CARD
// ─────────────────────────────────────────
function MeetingCard({ meeting, onShowInvite }: { meeting: Meeting; onShowInvite: () => void }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-700 transition">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-emerald-400 flex-shrink-0" />
            <h3 className="text-base font-semibold text-white truncate">{meeting.title}</h3>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <Clock3 size={11} />
              {convertToTimezone(meeting.scheduled_start, meeting.timezone ?? "Africa/Lagos")}
            </span>
            {meeting.department && (
              <span className="flex items-center gap-1"><Users size={11} />{meeting.department}</span>
            )}
            {meeting.candidate_name && (
              <span className="flex items-center gap-1"><User size={11} />{meeting.candidate_name}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <span className={`text-[11px] font-medium px-3 py-1 rounded-full border uppercase
            ${TYPE_COLORS[meeting.meeting_type] ?? "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
            {MEETING_TYPES.find(t => t.value === meeting.meeting_type)?.label ?? meeting.meeting_type}
          </span>
          {meeting.meeting_type === "interview" && (
            <button
              onClick={onShowInvite}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/25 bg-indigo-500/10 text-indigo-400 text-xs font-medium hover:bg-indigo-500/20 transition"
            >
              <Link2 size={12} /> View Invite
            </button>
          )}
        </div>
      </div>
    </div>
  );
}