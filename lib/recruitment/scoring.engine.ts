import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TYPES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type ScoringDecision =
  | "auto_interview"   // score >= auto_interview threshold
  | "manual_review"    // score >= manual_review threshold but < auto_interview
  | "auto_reject";     // score < manual_review threshold

export interface ScoreThreshold {
  id:             string;
  tenant_id:      string;
  manager_id:     string | null;
  auto_interview: number;
  manual_review:  number;
}

export interface ScoringResult {
  score:      number;
  decision:   ScoringDecision;
  summary:    string;
  flags:      string[];
  keywords:   string[];       // matched keywords for transparency
  thresholds: ScoreThreshold;
}

export interface ApplicationPayload {
  name:             string;
  email:            string;
  phone:            string;
  role:             string;
  years_experience: number;
  current_employer: string;
  cover_letter:     string;  // candidate-pasted text (summary/skills/experience)
  resume_text?:     string;  // extracted from uploaded resume file (weighted higher)
  linkedin_url:     string;
  resume_url:       string | null;
  resume_name:      string | null;
  tenant_id:        string;
}

function extractMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const e = err as Record<string, any>;
  return e.message ?? e.details ?? e.hint ?? JSON.stringify(e);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ROLE â†’ KEYWORD DICTIONARY
// Maps job role categories to keywords
// scanned across: Professional Summary,
// Core Skills, and Work Experience duties
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ROLE_KEYWORD_MAP: Record<string, string[]> = {
  nurse: [
    "patient care","medication administration","clinical assessment","vital signs",
    "iv insertion","wound care","triage","patient education","care plan","charting",
    "ehr","emr","epic","cerner","bedside manner","shift handover","infection control",
    "bls","acls","rn","lpn","cna","registered nurse","licensed practical nurse",
    "nursing license","pharmacology","documentation","patient monitoring",
    "catheter","nasogastric","post-operative","pre-operative","telemetry",
  ],
  physician: [
    "diagnosis","differential diagnosis","clinical examination","treatment plan",
    "patient rounds","surgical procedure","medical history","prescriptions",
    "referrals","icd-10","cpt coding","electronic health record","board certified",
    "residency","fellowship","attending physician","clinical trials","evidence-based",
    "chronic disease management","preventive care","acute care",
  ],
  allied: [
    "rehabilitation","therapeutic intervention","patient assessment","functional goals",
    "treatment modalities","progress notes","discharge planning","multidisciplinary",
    "occupational therapy","physical therapy","speech therapy","respiratory therapy",
    "diagnostic imaging","patient outcomes","care coordination",
  ],
  locum: [
    "locum tenens","travel nurse","per diem","credentialing","multi-site","float pool",
    "temporary placement","contract position","flexible scheduling","rapid onboarding",
    "licensure compact","cross-trained","adaptable","diverse patient populations",
  ],
  pharmacist: [
    "drug dispensing","prescription verification","medication counseling","drug interaction",
    "compounding","formulary management","clinical pharmacy","mtm","medication therapy",
    "pharmacy technician","controlled substances","drug utilization","patient counseling",
    "pharmacovigilance","inventory management","clinical decision support",
  ],
  therapist: [
    "cognitive behavioral therapy","cbt","psychotherapy","mental health assessment",
    "treatment planning","crisis intervention","group therapy","individual therapy",
    "dsm-5","biopsychosocial","trauma-informed","motivational interviewing",
    "evidence-based practice","session notes","therapeutic alliance","case management",
  ],
  radiographer: [
    "diagnostic imaging","x-ray","mri","ct scan","ultrasound","fluoroscopy",
    "pacs","radiation safety","contrast administration","positioning","image quality",
    "radiographic technique","patient preparation","dose optimization","film processing",
    "modality","arrt","radiologic technologist",
  ],
  admin: [
    "scheduling","medical records","billing","coding","insurance verification",
    "prior authorization","patient registration","hipaa compliance","icd coding",
    "appointment management","electronic health record","front desk","revenue cycle",
    "accounts receivable","healthcare administration","compliance",
  ],
  software: [
    "software development","software engineering","full stack","frontend","backend",
    "javascript","typescript","react","node.js","python","java","api","rest api",
    "microservices","cloud","aws","azure","docker","kubernetes","ci/cd","git",
    "agile","scrum","unit testing","code review","system design","database","sql",
    "distributed systems","scalability","debugging","version control","devops",
  ],
  engineering: [
    "engineering","design","cad","project management","quality assurance","testing",
    "specifications","prototyping","manufacturing","maintenance","troubleshooting",
    "technical documentation","compliance","safety standards","optimization",
    "root cause analysis","continuous improvement","cross-functional",
  ],
  sales: [
    "sales","business development","lead generation","crm","pipeline","quota",
    "negotiation","account management","client relationships","prospecting",
    "revenue growth","closing","b2b","b2c","upselling","customer acquisition",
  ],
  finance: [
    "financial analysis","accounting","budgeting","forecasting","reconciliation",
    "financial reporting","gaap","audit","accounts payable","accounts receivable",
    "excel","financial modeling","variance analysis","compliance","cash flow",
  ],
  general: [
    "communication","teamwork","leadership","problem solving","time management",
    "project management","collaboration","analytical","detail-oriented","organized",
    "stakeholder management","process improvement","reporting","documentation",
    "customer service","adaptable","results-driven","cross-functional",
  ],
  default: [
    "professional","experienced","skilled","trained","communication","teamwork",
    "leadership","problem solving","project management","collaboration","analytical",
    "results-driven","detail-oriented","organized","documentation","compliance",
    "stakeholder","process improvement","time management","adaptable",
  ],
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RESUME SECTIONS PARSER
// Attempts to isolate the three scored sections
// from the free-text cover_letter / resume text
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface ParsedResumeSections {
  professionalSummary: string;
  coreSkills:          string;
  workExperience:      string;
  fullText:            string;
}

function parseResumeSections(text: string): ParsedResumeSections {
  const lower = text.toLowerCase();

  // Section header patterns
  const SUMMARY_HEADERS   = /professional\s+summary|summary|profile|about\s+me|objective/i;
  const SKILLS_HEADERS    = /core\s+skills|skills|competencies|expertise|key\s+skills|technical\s+skills/i;
  const EXPERIENCE_HEADERS= /work\s+experience|experience|employment|employment\s+history|professional\s+experience|career\s+history/i;
  const OTHER_HEADERS     = /education|certifications?|references?|awards?|achievements?/i;

  // Split text into labelled segments
  const lines = text.split(/\n/);
  const segments: { header: string; content: string[] }[] = [{ header: "unknown", content: [] }];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (SUMMARY_HEADERS.test(trimmed)    && trimmed.length < 60) { segments.push({ header: "summary",    content: [] }); }
    else if (SKILLS_HEADERS.test(trimmed) && trimmed.length < 60) { segments.push({ header: "skills",     content: [] }); }
    else if (EXPERIENCE_HEADERS.test(trimmed) && trimmed.length < 60) { segments.push({ header: "experience", content: [] }); }
    else if (OTHER_HEADERS.test(trimmed) && trimmed.length < 60)  { segments.push({ header: "other",      content: [] }); }
    else { segments[segments.length - 1].content.push(trimmed); }
  }

  const extract = (key: string) =>
    segments.filter((s) => s.header === key).map((s) => s.content.join(" ")).join(" ").trim();

  return {
    professionalSummary: extract("summary"),
    coreSkills:          extract("skills"),
    workExperience:      extract("experience"),
    fullText:            text,
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ROLE CATEGORY DETECTOR
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function detectRoleCategory(role: string): string {
  const r = role.toLowerCase();
  if (/nurse|nursing|rn|lpn|cna/.test(r))            return "nurse";
  if (/physician|doctor|md|do|surgeon/.test(r))        return "physician";
  if (/allied|therapist|technician|therapy/.test(r))   return "allied";
  if (/locum|travel/.test(r))                          return "locum";
  if (/pharmacist|pharmacy/.test(r))                   return "pharmacist";
  if (/therapist|counsell?or|psychologist/.test(r))    return "therapist";
  if (/radiograph|imaging|radiolog/.test(r))            return "radiographer";
  if (/software|developer|engineer|programmer|full.?stack|frontend|backend|devops|data scientist/.test(r)) return "software";
  if (/mechanical|electrical|civil|industrial|manufacturing|qa engineer|quality engineer/.test(r)) return "engineering";
  if (/sales|business development|account executive|account manager/.test(r)) return "sales";
  if (/finance|accountant|accounting|financial|bookkeeper|auditor/.test(r)) return "finance";
  if (/admin|coordinator|manager|director|clerk|assistant|operations/.test(r)) return "admin";
  return "general";
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// KEYWORD MATCH ENGINE
// Scans only the three scored sections
// Returns matched keywords and a 0-100 score
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function coverageForText(text: string, role: string): { matched: string[]; coverage: number } {
  if (!text || !text.trim()) return { matched: [], coverage: 0 };
  const sections = parseResumeSections(text);
  const category = detectRoleCategory(role);
  const keywords = [...new Set([...(ROLE_KEYWORD_MAP[category] ?? []), ...ROLE_KEYWORD_MAP.default])];
  const summaryText    = sections.professionalSummary || sections.fullText.slice(0, 500);
  const skillsText     = sections.coreSkills          || sections.fullText.slice(500, 1500);
  const experienceText = sections.workExperience       || sections.fullText.slice(1500);
  const matched = new Set<string>();
  for (const kw of keywords) {
    const k = kw.toLowerCase();
    if (summaryText.toLowerCase().includes(k) || skillsText.toLowerCase().includes(k) || experienceText.toLowerCase().includes(k)) matched.add(kw);
  }
  const arr = Array.from(matched);
  return { matched: arr, coverage: keywords.length ? arr.length / keywords.length : 0 };
}

function coverageToScore(coverage: number): number {
  let score: number;
  if      (coverage >= 0.90) score = 90 + Math.round(coverage * 10);
  else if (coverage >= 0.60) score = 75 + Math.round((coverage - 0.6) / 0.3 * 20);
  else if (coverage >= 0.30) score = 45 + Math.round((coverage - 0.3) / 0.3 * 30);
  else if (coverage >= 0.10) score = 20 + Math.round((coverage - 0.1) / 0.2 * 25);
  else                       score = Math.round(coverage * 200);
  return Math.min(97, Math.max(0, score));
}

function scoreResumeKeywords(
  sections: ParsedResumeSections,
  role:     string
): { score: number; matched: string[]; coverage: number } {
  const category = detectRoleCategory(role);
  // Combine with default universal keywords
  const keywords = [
    ...new Set([
      ...(ROLE_KEYWORD_MAP[category] ?? []),
      ...ROLE_KEYWORD_MAP.default,
    ]),
  ];

  // Text to scan â€” only the three sections (weighted)
  // If sections are empty (no headings found), fall back to full text
  const summaryText    = sections.professionalSummary || sections.fullText.slice(0, 500);
  const skillsText     = sections.coreSkills          || sections.fullText.slice(500, 1500);
  const experienceText = sections.workExperience       || sections.fullText.slice(1500);

  const matched = new Set<string>();

  // Check each keyword across each section (case-insensitive)
  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    if (
      summaryText.toLowerCase().includes(kwLower)    ||
      skillsText.toLowerCase().includes(kwLower)     ||
      experienceText.toLowerCase().includes(kwLower)
    ) {
      matched.add(kw);
    }
  }

  const matchedArr = Array.from(matched);
  const coverage   = keywords.length > 0 ? matchedArr.length / keywords.length : 0;

  // Score curve: coverage maps to 0-100
  // 0% coverage â†’ 0, 30%+ coverage â†’ 60+, 60%+ â†’ 85+, 90%+ â†’ 95+
  let score: number;
  if      (coverage >= 0.90) score = 90 + Math.round(coverage * 10);
  else if (coverage >= 0.60) score = 75 + Math.round((coverage - 0.6) / 0.3 * 20);
  else if (coverage >= 0.30) score = 45 + Math.round((coverage - 0.3) / 0.3 * 30);
  else if (coverage >= 0.10) score = 20 + Math.round((coverage - 0.1) / 0.2 * 25);
  else                       score = Math.round(coverage * 200); // 0-20

  // Cap at 97 â€” 100 reserved for manually overridden
  score = Math.min(97, Math.max(0, score));

  return { score, matched: matchedArr, coverage };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// OUTCOME MESSAGE GENERATOR
// Returns only a final summary â€” no breakdown
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildSummaryMessage(
  score:    number,
  decision: ScoringDecision,
  role:     string,
  matched:  string[],
  thresholds: ScoreThreshold
): { summary: string; flags: string[] } {
  const flags: string[] = [];
  let summary: string;

  if (decision === "auto_interview") {
    summary =
      `This candidate demonstrates strong alignment with the ${role} role, scoring ${score}/100 ` +
      `based on keyword relevance across their Professional Summary, Core Skills, and Work Experience. ` +
      `Key competencies identified: ${matched.slice(0, 6).join(", ")}. ` +
      `Recommended for immediate interview scheduling.`;

  } else if (decision === "manual_review") {
    summary =
      `This candidate shows moderate alignment with the ${role} role, scoring ${score}/100. ` +
      `Some relevant experience was identified (${matched.slice(0, 4).join(", ")}) but the resume ` +
      `does not fully reflect the depth of expertise typically required. Recruiter review recommended ` +
      `before advancing.`;

    if (matched.length < 5) {
      flags.push("Limited keyword coverage across core resume sections");
    }
    if (!matched.some((k) => ["bls","acls","rn","lpn","registered nurse","licensed"].includes(k.toLowerCase()))) {
      flags.push("Licensing or certification keywords not detected");
    }

  } else {
    summary =
      `This candidate scored ${score}/100 against the ${role} requirements. ` +
      `Insufficient keyword alignment was found across Professional Summary, Core Skills, and ` +
      `Work Experience sections. The minimum threshold for review is ${thresholds.manual_review}/100. ` +
      `Application does not meet current role requirements.`;

    if (matched.length === 0) {
      flags.push("No role-relevant keywords detected in resume");
    } else if (matched.length < 3) {
      flags.push(`Only ${matched.length} relevant keyword${matched.length === 1 ? "" : "s"} found`);
    }
    flags.push(`Score ${score} is below the minimum review threshold of ${thresholds.manual_review}`);
  }

  return { summary, flags };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET THRESHOLDS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getScoreThresholds(
  tenantId:   string,
  managerId?: string
): Promise<ScoreThreshold> {
  // Try manager-specific threshold first
  if (managerId) {
    const { data } = await supabase
      .from("score_thresholds")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("manager_id", managerId)
      .maybeSingle();
    if (data) return data as ScoreThreshold;
  }

  // Try tenant default (manager_id is null)
  const { data } = await supabase
    .from("score_thresholds")
    .select("*")
    .eq("tenant_id", tenantId)
    .is("manager_id", null)
    .maybeSingle();

  if (data) return data as ScoreThreshold;

  // Hardcoded fallback â€” no DB write, no upsert, no constraint needed
  return {
    id:             "default",
    tenant_id:      tenantId,
    manager_id:     null,
    auto_interview: 75,
    manual_review:  50,
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// UPDATE THRESHOLDS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function upsertScoreThresholds(
  tenantId:      string,
  autoInterview: number,
  manualReview:  number,
  managerId?:    string
): Promise<ScoreThreshold> {
  if (autoInterview <= manualReview) {
    throw new Error("Auto-interview threshold must be higher than manual review threshold");
  }
  if (manualReview < 0 || autoInterview > 100) {
    throw new Error("Thresholds must be between 0 and 100");
  }

  // Check if a row already exists
  const query = supabase
    .from("score_thresholds")
    .select("*")
    .eq("tenant_id", tenantId);

  const { data: existing } = managerId
    ? await query.eq("manager_id", managerId).maybeSingle()
    : await query.is("manager_id", null).maybeSingle();

  if (existing) {
    // Update existing row by id â€” no constraint needed
    const { data, error } = await supabase
      .from("score_thresholds")
      .update({
        auto_interview: autoInterview,
        manual_review:  manualReview,
        updated_at:     new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(`Failed to update thresholds: ${extractMessage(error)}`);
    return data as ScoreThreshold;
  }

  // Insert new row
  const { data, error } = await supabase
    .from("score_thresholds")
    .insert({
      tenant_id:      tenantId,
      manager_id:     managerId ?? null,
      auto_interview: autoInterview,
      manual_review:  manualReview,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to insert thresholds: ${extractMessage(error)}`);
  return data as ScoreThreshold;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SCORE CANDIDATE â€” PRODUCTION ENTRY POINT
// Pure resume keyword scoring.
// Input text must contain the resume body
// (cover_letter field is used as the full
// resume text â€” copy-paste or extracted PDF).
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function scoreCandidate(
  payload:    ApplicationPayload,
  thresholds: ScoreThreshold
): Promise<ScoringResult> {
  // Resume file text is weighted higher than the pasted cover letter.
  const resumeText = (payload.resume_text ?? "").trim();
  const coverText  = (payload.cover_letter ?? "").trim();
  const extraFlags: string[] = [];

  if (!resumeText && !coverText) {
    return {
      score:      0,
      decision:   "auto_reject",
      summary:    `No resume content was provided for scoring. A resume with Professional Summary, Core Skills, and Work Experience sections is required.`,
      flags:      ["No resume text submitted"],
      keywords:   [],
      thresholds,
    };
  }

  const resumeCov = coverageForText(resumeText, payload.role);
  const coverCov  = coverageForText(coverText, payload.role);

  // Resume 70% / cover letter 30%. If the resume file is missing or unreadable,
  // score the cover letter alone and flag for manual review.
  let blendedCoverage: number;
  let resumeReadable = true;
  if (resumeText) {
    blendedCoverage = 0.7 * resumeCov.coverage + 0.3 * coverCov.coverage;
  } else {
    blendedCoverage = coverCov.coverage;
    resumeReadable = false;
    extraFlags.push("Resume file could not be read - scored on cover letter only; manual review advised");
  }

  const score   = coverageToScore(blendedCoverage);
  const matched = Array.from(new Set([...resumeCov.matched, ...coverCov.matched]));

  // Decision routing
  let decision: ScoringDecision;
  if      (score >= thresholds.auto_interview) decision = "auto_interview";
  else if (score >= thresholds.manual_review)  decision = "manual_review";
  else                                          decision = "auto_reject";

  // An unreadable resume must never auto-pass on cover letter alone.
  if (!resumeReadable && decision === "auto_interview") {
    decision = "manual_review";
  }

  const { summary, flags } = buildSummaryMessage(score, decision, payload.role, matched, thresholds);

  return { score, decision, summary, flags: [...flags, ...extraFlags], keywords: matched, thresholds };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PROCESS APPLICATION â€” end to end
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function processApplication(
  payload: ApplicationPayload
): Promise<{ candidateId: string; result: ScoringResult }> {
  // Validate required fields
  if (!payload.name?.trim())  throw new Error("Applicant name is required");
  if (!payload.email?.trim()) throw new Error("Applicant email is required");
  if (!payload.role?.trim())  throw new Error("Role applied for is required");
  if (!payload.tenant_id)     throw new Error("Tenant ID is required");

  // Email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    throw new Error("Invalid email address format");
  }

  // Duplicate check â€” prevent same email reapplying
  const { data: existing } = await supabase
    .from("candidates")
    .select("id, status")
    .eq("email", payload.email.trim().toLowerCase())
    .eq("tenant_id", payload.tenant_id)
    .not("status", "eq", "rejected")
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error(
      "An active application already exists for this email address. " +
      "If you believe this is an error, please contact the recruitment team."
    );
  }

  // Get scoring thresholds
  const thresholds = await getScoreThresholds(payload.tenant_id);

  // Extract text from the uploaded resume file (weighted higher than cover letter)
  try {
    const { extractResumeText } = await import("./resume-extract");
    const extracted = await extractResumeText(payload.resume_url);
    if (extracted.ok) payload.resume_text = extracted.text;
  } catch (e) {
    console.error("Resume extraction error:", e instanceof Error ? e.message : e);
  }

  // Score the candidate
  const result = await scoreCandidate(payload, thresholds);

  // Determine initial status
  const status =
    result.decision === "auto_interview" ? "interview"          :
    result.decision === "manual_review"  ? "recruitment_review" :
    "rejected";

  // Insert candidate record
  const { data: candidate, error } = await supabase
    .from("candidates")
    .insert({
      name:             payload.name.trim(),
      email:            payload.email.trim().toLowerCase(),
      phone:            payload.phone            ?? null,
      role:             payload.role.trim(),
      years_experience: payload.years_experience ?? null,
      current_employer: payload.current_employer ?? null,
      cover_letter:     payload.cover_letter     ?? null,
      linkedin_url:     payload.linkedin_url     ?? null,
      resume_url:       payload.resume_url       ?? null,
      resume_name:      payload.resume_name      ?? null,
      ai_score:         result.score,
      ai_summary:       result.summary,
      ai_flags:         result.flags,
      score_threshold:  thresholds.auto_interview,
      status,
      tenant_id:        payload.tenant_id,
      source:           "application_form",
      decision:
        result.decision === "auto_interview" ? "STRONG_HIRE" :
        result.decision === "manual_review"  ? "REVIEW"      : "REJECT",
      created_at:       new Date().toISOString(),
      updated_at:       new Date().toISOString(),
      ...(status === "rejected" ? { rejected_at: new Date().toISOString() } : {}),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create candidate record: ${extractMessage(error)}`);

  return { candidateId: candidate.id, result };
}

