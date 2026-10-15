import { createClient, type Session } from "@supabase/supabase-js";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { ClinicalError, DEMO_DOCTOR } from "./clinical/engine";

export interface AuthIdentity {
  userId: string | null;
  actor: { id: string; name: string; role: "doctor"; hospitalId: "B"; hospital: string };
}
const ACCESS = "clinical_access";
const REFRESH = "clinical_refresh";
export function authProvider(): "supabase" | "demo" {
  const provider = process.env.AUTH_PROVIDER ?? "demo";
  if (provider !== "demo" && provider !== "supabase") throw new ClinicalError(503, "AUTH_PROVIDER_INVALID", "The authentication provider configuration is invalid.");
  return provider;
}
const keys = () => ({ url: process.env.SUPABASE_URL?.trim(), secret: (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim(), publishable: (process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY)?.trim() });
export const supabaseConfigured = () => { const c = keys(); return Boolean(c.url && c.secret && c.publishable); };
export function supabaseAdmin() {
  const config = keys();
  if (!config.url || !config.secret || !config.publishable) throw new ClinicalError(503, "SUPABASE_NOT_CONFIGURED", "Supabase server authentication and storage are not configured.");
  if (!config.url.startsWith("https://") && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(config.url)) throw new ClinicalError(503, "SUPABASE_TRANSPORT_INVALID", "Supabase must use HTTPS except for an explicit local development server.");
  return createClient(config.url, config.secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
function publicClient() {
  supabaseAdmin();
  const config = keys();
  return createClient(config.url!, config.publishable!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
function writeTokens(c: Context, session: Session) {
  const options = { httpOnly: true, sameSite: "Lax" as const, path: "/api", secure: process.env.NODE_ENV === "production" };
  setCookie(c, ACCESS, session.access_token, { ...options, maxAge: session.expires_in });
  setCookie(c, REFRESH, session.refresh_token, { ...options, maxAge: 86400 });
}
async function membershipFor(userId: string): Promise<AuthIdentity> {
  const { data, error } = await supabaseAdmin().from("clinician_memberships").select("user_id,hospital_id,role,active,display_name").eq("user_id", userId).eq("hospital_id", "B").eq("role", "doctor").eq("active", true).maybeSingle();
  if (error) throw new ClinicalError(503, "MEMBERSHIP_UNAVAILABLE", "The clinician membership service is unavailable.");
  if (!data || data.user_id !== userId || data.hospital_id !== "B" || data.role !== "doctor" || data.active !== true) throw new ClinicalError(403, "MEMBERSHIP_REQUIRED", "An active Meridian clinician membership is required for this prototype.");
  return { userId, actor: { id: userId, name: typeof data.display_name === "string" && data.display_name.trim() ? data.display_name.trim().slice(0, 120) : "Authorized clinician", role: "doctor", hospitalId: "B", hospital: "Meridian Medical" } };
}
export async function verifyIdentity(c: Context): Promise<AuthIdentity> {
  if (authProvider() === "demo") return { userId: null, actor: DEMO_DOCTOR };
  const access = getCookie(c, ACCESS);
  const refresh = getCookie(c, REFRESH);
  if (!access && !refresh) throw new ClinicalError(401, "AUTHENTICATION_REQUIRED", "Sign in with your authorized clinician account.");
  let result = access ? await supabaseAdmin().auth.getUser(access) : null;
  if ((!result || result.error || !result.data.user) && refresh) {
    const renewed = await publicClient().auth.refreshSession({ refresh_token: refresh });
    if (renewed.error || !renewed.data.session) throw new ClinicalError(401, "AUTHENTICATION_EXPIRED", "Your clinician session has expired. Sign in again.");
    writeTokens(c, renewed.data.session);
    result = await supabaseAdmin().auth.getUser(renewed.data.session.access_token);
  }
  if (!result || result.error || !result.data.user) throw new ClinicalError(401, "AUTHENTICATION_INVALID", "The clinician session could not be verified.");
  return membershipFor(result.data.user.id);
}
export async function signIn(c: Context, email: string, password: string): Promise<AuthIdentity> {
  if (authProvider() !== "supabase") throw new ClinicalError(409, "AUTH_PROVIDER_DEMO", "Email sign-in is not enabled in local demonstration mode.");
  const result = await publicClient().auth.signInWithPassword({ email, password });
  if (result.error || !result.data.session || !result.data.user) throw new ClinicalError(401, "SIGN_IN_FAILED", "Sign-in failed. Check your credentials and clinician access.");
  const verified = await supabaseAdmin().auth.getUser(result.data.session.access_token);
  if (verified.error || !verified.data.user) throw new ClinicalError(401, "SIGN_IN_FAILED", "The new clinician session could not be verified.");
  const identity = await membershipFor(verified.data.user.id);
  writeTokens(c, result.data.session);
  return identity;
}
export async function signOut(c: Context) {
  const access = getCookie(c, ACCESS);
  try {
    if (authProvider() === "supabase" && access && supabaseConfigured()) await supabaseAdmin().auth.admin.signOut(access, "local");
  } finally {
    deleteCookie(c, ACCESS, { path: "/api" });
    deleteCookie(c, REFRESH, { path: "/api" });
  }
}
