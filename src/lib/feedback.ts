import { supabase } from "./supabase";

/**
 * What players send from the Feedback page.
 *
 * Stored in the `feedback` table, which anyone may write to and nobody can
 * read through the API: Sara reads it in the Supabase dashboard. A signed-in
 * player's row carries their account id, filled in by the database.
 */

export type FeedbackKind = "bug" | "uncomfortable" | "idea";

export const MIN_MESSAGE = 3;
export const MAX_MESSAGE = 2000;
export const MAX_CONTACT = 200;

export type FeedbackDraft = {
  kind: FeedbackKind;
  message: string;
  /** An email, if they'd like a reply. Optional. */
  contact: string;
  /** The page they came from, so a bug can be found. */
  page: string;
};

/** Why a draft can't be sent yet, or null when it can. */
export function feedbackProblem(draft: FeedbackDraft): string | null {
  const message = draft.message.trim();
  if (message.length < MIN_MESSAGE) return "Write a few words first.";
  if (message.length > MAX_MESSAGE) return `Keep it under ${MAX_MESSAGE.toLocaleString()} characters.`;
  if (draft.contact.trim().length > MAX_CONTACT) return "That email is too long.";
  return null;
}

/** The row as it goes to the database: trimmed, capped, nothing extra. */
export function feedbackRow(draft: FeedbackDraft, userAgent = "") {
  return {
    kind: draft.kind,
    message: draft.message.trim(),
    contact: draft.contact.trim() || null,
    page: draft.page.slice(0, 200) || null,
    user_agent: userAgent.slice(0, 400) || null,
  };
}

export type SendResult = "sent" | "offline" | "busy" | "failed";

export async function sendFeedback(draft: FeedbackDraft): Promise<SendResult> {
  if (!supabase) return "offline";
  const { error } = await supabase
    .from("feedback")
    .insert(feedbackRow(draft, typeof navigator === "undefined" ? "" : navigator.userAgent));
  if (!error) return "sent";
  // The flood guard: too many at once, from everyone.
  if (error.code === "P0001") return "busy";
  if (import.meta.env.DEV) console.warn("Feedback not sent:", error.message);
  return "failed";
}
