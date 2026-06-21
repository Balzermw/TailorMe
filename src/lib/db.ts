import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import type {
  ApplicationRow,
  ApplicationStatus,
  MichaelStatus,
  Profile,
  ApplyResult,
  TailoredDoc,
  ProofPoint,
} from "@/lib/types";

interface DbApplication {
  id: string;
  company: string;
  role: string;
  fit_score: number | null;
  status: string;
  michael_status: string;
  result: ApplyResult | null;
  created_at: string;
}

function rowToApp(r: DbApplication): ApplicationRow {
  return {
    id: r.id,
    company: r.company,
    role: r.role,
    fitScore: r.fit_score,
    status: r.status as ApplicationStatus,
    michaelStatus: r.michael_status as MichaelStatus,
    createdAt: r.created_at,
    result: r.result,
  };
}

/** Signed-in user's profile + credit balance, or null in demo mode / signed out. */
export async function getProfile(): Promise<Profile | null> {
  const sb = await getServerSupabase();
  if (!sb) return null;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb
    .from("profiles")
    .select("id,email,full_name,credits")
    .eq("id", user.id)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    credits: data.credits,
  };
}

/** Signed-in user's applications, newest first. Empty in demo mode / signed out. */
export async function listApplications(): Promise<ApplicationRow[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return [];
  const { data } = await sb
    .from("applications")
    .select("id,company,role,fit_score,status,michael_status,result,created_at")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => rowToApp(r as DbApplication));
}

/** One application owned by the signed-in user, or null. RLS-scoped. */
export async function getApplication(id: string): Promise<ApplicationRow | null> {
  const sb = await getServerSupabase();
  if (!sb) return null;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb
    .from("applications")
    .select("id,company,role,fit_score,status,michael_status,result,created_at")
    .eq("id", id)
    .single();
  return data ? rowToApp(data as DbApplication) : null;
}

/** Signed-in user's structured base resume (build-from-scratch / editor). RLS-scoped. */
export async function getSavedResumeDoc(): Promise<{
  id: string;
  name: string;
  doc: TailoredDoc | null;
  source: string;
  proofPoints: ProofPoint[];
} | null> {
  const sb = await getServerSupabase();
  if (!sb) return null;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  // select("*") so this works before the doc/source migration is applied.
  const { data } = await sb
    .from("resumes")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    doc: (data.doc ?? null) as TailoredDoc | null,
    source: (data.source ?? "uploaded") as string,
    proofPoints:
      ((data.stats as { proofPoints?: ProofPoint[] } | null)?.proofPoints ?? []),
  };
}

/**
 * Persist an edited result blob for the signed-in owner. Manual editing only —
 * NEVER calls consume_credit. Ownership is enforced by RLS and the explicit
 * user_id match. Returns true on success.
 */
export async function updateApplicationResult(
  id: string,
  result: ApplyResult,
): Promise<boolean> {
  const sb = await getServerSupabase();
  if (!sb) return false;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return false;
  const { error } = await sb
    .from("applications")
    .update({
      result,
      fit_score: result.fit?.overall ?? null,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  return !error;
}
