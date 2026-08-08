/**
 * MENTION PARSER
 * Extracts @user, @department, @all mentions from any text
 * Returns structured mention objects ready to emit as events
 */

export type MentionType = "user" | "department" | "all";

export interface ParsedMention {
  raw:      string;       // the full @token as typed
  type:     MentionType;
  refId:    string | null; // user_id or department name
  refName:  string;        // display name
}

// ─────────────────────────────────────────
// KNOWN DEPARTMENTS (extend as needed)
// ─────────────────────────────────────────
const DEPARTMENT_KEYWORDS = new Set([
  "engineering", "product", "design", "marketing",
  "sales", "hr", "finance", "operations", "legal",
  "compliance", "recruitment", "management",
]);

// ─────────────────────────────────────────
// MAIN PARSER
// ─────────────────────────────────────────
export function extractMentions(
  content:  string,
  profiles: { id: string; full_name: string | null; email: string | null }[] = []
): ParsedMention[] {
  if (!content?.trim()) return [];

  // Match @word or @"multi word" or @all
  const regex = /@([\w.+-]+)/gi;
  const matches = [...content.matchAll(regex)];
  if (!matches.length) return [];

  const mentions: ParsedMention[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const raw     = match[0];
    const token   = match[1].toLowerCase();

    if (seen.has(token)) continue;
    seen.add(token);

    // @all — escalation level
    if (token === "all" || token === "everyone" || token === "team") {
      mentions.push({ raw, type: "all", refId: null, refName: "all" });
      continue;
    }

    // Match against known department keywords
    if (DEPARTMENT_KEYWORDS.has(token)) {
      mentions.push({
        raw,
        type:    "department",
        refId:   token,
        refName: token.charAt(0).toUpperCase() + token.slice(1),
      });
      continue;
    }

    // Try to match against profiles by name or email prefix
    const profile = profiles.find((p) => {
      const nameLower  = (p.full_name ?? "").toLowerCase().replace(/\s+/g, "");
      const emailPre   = (p.email ?? "").split("@")[0].toLowerCase();
      const firstName  = (p.full_name ?? "").split(" ")[0].toLowerCase();
      return (
        nameLower  === token ||
        emailPre   === token ||
        firstName  === token
      );
    });

    if (profile) {
      mentions.push({
        raw,
        type:    "user",
        refId:   profile.id,
        refName: profile.full_name ?? profile.email ?? token,
      });
    } else {
      // Unknown mention — treat as user with unresolved ref
      mentions.push({
        raw,
        type:    "user",
        refId:   null,
        refName: token,
      });
    }
  }

  return mentions;
}

// ─────────────────────────────────────────
// HIGHLIGHT mentions in text (returns HTML string)
// ─────────────────────────────────────────
export function highlightMentions(content: string): string {
  return content.replace(
    /@([\w.+-]+)/gi,
    (match) =>
      `<span class="mention-highlight text-indigo-400 font-semibold">${match}</span>`
  );
}

// ─────────────────────────────────────────
// CHECK if content has any mentions
// ─────────────────────────────────────────
export function hasMentions(content: string): boolean {
  return /@[\w.+-]+/gi.test(content);
}