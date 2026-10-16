"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, LockKeyhole, LogIn, RefreshCw } from "lucide-react";
import { post } from "./lib/api";

export interface AuthConfiguration {
  provider: "demo" | "supabase";
  supabaseConfigured: boolean;
  syntheticOnly: true;
}

export default function AuthForm({ configuration, initialError, onSignedIn, onRetry }: {
  configuration: AuthConfiguration;
  initialError?: string;
  onSignedIn: () => Promise<void>;
  onRetry: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configuration.supabaseConfigured || busy) return;
    setBusy(true);
    setError("");
    try {
      await post("/auth/login", { email: email.trim(), password });
      setPassword("");
      await onSignedIn();
    } catch (err) {
      setPassword("");
      setError((err as Error).message);
    } finally { setBusy(false); }
  }

  return <main className="boot-screen" style={{ padding: 24 }}>
    <section className="panel" style={{ width: "min(430px, 100%)", padding: 30 }} aria-labelledby="sign-in-heading">
      <span className="large-icon" style={{ marginBottom: 23 }}><LockKeyhole size={25}/></span>
      <h1 id="sign-in-heading" style={{ fontSize: 29 }}>Sign in to Zuma</h1>
      <p style={{ color: "#444", fontSize: 13, marginTop: 10, marginBottom: 22 }}>Use your authorized clinician account to review permitted patient records.</p>
      {!configuration.supabaseConfigured && <p className="inline-error" role="alert" style={{ marginBottom: 18 }}>Supabase sign-in is selected, but the server configuration is incomplete. A system administrator must configure authentication before access is available.</p>}
      <form onSubmit={signIn} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label><span className="label" style={{ marginBottom: 7 }}>Work email</span><input className="search-field" style={{ width: "100%", color: "#111", background: "#fff" }} type="email" name="email" autoComplete="username" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy || !configuration.supabaseConfigured}/></label>
        <label><span className="label" style={{ marginBottom: 7 }}>Password</span><input className="search-field" style={{ width: "100%", color: "#111", background: "#fff" }} type="password" name="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={event => setPassword(event.target.value)} disabled={busy || !configuration.supabaseConfigured}/></label>
        {(error || initialError) && <p className="inline-error" role="alert">{error || initialError}</p>}
        <button className="button primary" type="submit" disabled={busy || !configuration.supabaseConfigured || !email.trim() || !password}><LogIn size={16}/>{busy ? "Signing in…" : "Sign in to workspace"}</button>
      </form>
      <p style={{ fontSize: 11, color: "#444", marginTop: 18, lineHeight: 1.7 }}>Access requires an active clinician membership. This prototype uses public repository sample records.</p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 15, marginTop: 23 }}><a className="subtle-link" href="/"><ArrowLeft size={13}/>Product overview</a><button className="subtle-link" disabled={busy} onClick={onRetry}><RefreshCw size={12}/>Refresh configuration</button></div>
    </section>
  </main>;
}
