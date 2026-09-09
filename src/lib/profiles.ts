import { supabase } from "./supabase";

/** The public half of an account: what a leaderboard would show. */
export type Profile = {
  id: string;
  username: string;
  /** ISO 3166-1 alpha-2, matching the flags the game already ships. */
  country: string | null;
};

/** Mirrors the database's check constraint, so bad names fail before the trip. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

/**
 * Why a name can't be used, or null if it can. Kept next to the pattern so the
 * message and the rule can't drift apart.
 */
export function usernameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 3) return "At least 3 characters.";
  if (trimmed.length > 16) return "At most 16 characters.";
  if (!USERNAME_PATTERN.test(trimmed))
    return "Letters, numbers and underscores only.";
  return null;
}

/**
 * Whether the form holds anything worth sending.
 *
 * The save button reads this: with nothing changed it says "Saved" and stays
 * disabled, rather than reverting to "Save changes" and inviting a second
 * click that would do nothing. An empty flag and no flag are the same thing,
 * which is the only comparison here that isn't literal.
 */
export function hasUnsavedChanges(
  username: string,
  country: string,
  profile: Profile | null
): boolean {
  return (
    username.trim() !== (profile?.username ?? "") ||
    (country || null) !== (profile?.country ?? null)
  );
}

function client() {
  if (!supabase) throw new Error("Accounts aren't configured.");
  return supabase;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await client()
    .from("profiles")
    .select("id, username, country")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** True if nobody else has taken the name, compared case-insensitively. */
export async function usernameFree(name: string, selfId?: string) {
  const query = client()
    .from("profiles")
    .select("id")
    .ilike("username", name.trim());
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).every((row) => row.id === selfId);
}

/** Creates the profile on first sign-in, or edits it later. Same shape either way. */
export async function saveProfile(profile: Profile): Promise<Profile> {
  const { data, error } = await client()
    .from("profiles")
    .upsert(
      {
        id: profile.id,
        username: profile.username.trim(),
        country: profile.country,
      },
      { onConflict: "id" }
    )
    .select("id, username, country")
    .single();
  if (error) throw error;
  return data;
}

/** Turns Postgres' unique-violation into something worth reading. */
export function describeSaveError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === "23505") return "That name is taken. Try another.";
  if (code === "23514") return "Letters, numbers and underscores only, 3–16.";
  const message = (error as { message?: string })?.message;
  return message ?? "Something went wrong. Try again.";
}
