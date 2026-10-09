"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  AudioLines,
  LockKeyhole,
  Check,
  LoaderCircle,
} from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
import { loginEmail } from "@/lib/domain/login-identity";
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await browserClient().auth.signInWithPassword({
        email: loginEmail(email),
        password,
      });
      if (error) throw error;
      router.replace("/overview");
    } catch {
      setError("We could not sign you in. Check your invited account details.");
    } finally {
      setBusy(false);
    }
  }
  async function sample() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/session", { method: "POST" });
      if (!response.ok) throw new Error();
      router.replace("/overview");
    } catch {
      setError("The sample workspace is available in local development only.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <div className="login-story">
        <a className="brand" href="/login">
          <span className="brand-mark">
            <AudioLines size={23} />
          </span>
          PestLaunch<span className="brand-dot">.</span>
        </a>
        <div className="story-copy">
          <span className="eyebrow light">CALL INTELLIGENCE</span>
          <h1>
            Every conversation.
            <br />A clearer next step.
          </h1>
          <p>
            Understand what happened, see the evidence, and turn feedback into
            better customer conversations.
          </p>
          <div className="story-points">
            <span>
              <Check size={17} /> Outcomes with context
            </span>
            <span>
              <Check size={17} /> Scorecards you can inspect
            </span>
            <span>
              <Check size={17} /> Coaching you can use
            </span>
          </div>
        </div>
        <p className="login-foot">
          <LockKeyhole size={15} /> A private workspace for your team
        </p>
      </div>
      <div className="login-form-area">
        <section className="login-card">
          <span className="eyebrow">WELCOME TO YOUR WORKSPACE</span>
          <h2>Let’s take a closer listen.</h2>
          <p className="muted">Sign in to review your team’s calls.</p>
          {configured ? (
            <form onSubmit={signIn}>
              <label>
                Email or username
                <input
                  autoComplete="username"
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address or username"
                />
              </label>
              <label>
                Password
                <input
                  autoComplete="current-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button className="button primary wide" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <>
                    Sign in
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
              <p className="fine">
                Access is by invitation. Contact your workspace owner if you
                need an account.
              </p>
            </form>
          ) : (
            <>
              <div className="sample-note">
                <span className="badge blue">Local preview</span>
                <p>
                  Explore the complete review flow using clearly labeled,
                  fictional conversations.
                </p>
                <p className="fine">
                  Real recording analysis will be available after the backend
                  and AI credentials are configured.
                </p>
              </div>
              <button
                className="button primary wide"
                onClick={sample}
                disabled={busy}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <>
                    Open sample workspace
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </>
          )}
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
