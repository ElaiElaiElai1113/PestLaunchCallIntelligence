"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AudioLines,
  LayoutDashboard,
  Phone,
  ClipboardCheck,
  Settings2,
  Plus,
  LogOut,
  ShieldCheck,
  X,
  ArrowRight,
  FileAudio,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { Identity } from "@/lib/domain/types";
import { SAMPLE_OPTIONS } from "@/lib/samples/fixtures";
import { browserClient } from "@/lib/supabase/browser";
type Session = {
  identity: Identity;
  aiConfigured: boolean;
  processingEnabled: boolean;
  backendConfigured: boolean;
};
const Context = createContext<{
  session: Session;
  openUpload: () => void;
} | null>(null);
export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("Workspace context missing");
  return context;
}
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "REQUEST_FAILED");
  return data;
}
export const ERRORS: Record<string, string> = {
  STALE_REVIEW:
    "This call changed while you were reviewing it. Refresh and try again.",
  AI_NOT_CONFIGURED:
    "AI is not configured yet. Add the server API key when you are ready.",
  INVALID_REQUEST: "Check the required information and try again.",
  PRIVACY_APPROVAL_REQUIRED:
    "Real recordings are held until privacy settings have been verified.",
  EVIDENCE_REQUIRED: "A passed checkpoint needs transcript evidence.",
  DATABASE_UNAVAILABLE: "The workspace could not be reached. Please try again.",
  SIGN_IN_REQUIRED: "Your session expired. Sign in again.",
};
export function errorText(error: unknown) {
  return (
    ERRORS[(error as Error).message] ||
    "We could not complete that action. Please try again."
  );
}
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(),
    router = useRouter();
  const [session, setSession] = useState<Session | null>(null),
    [error, setError] = useState(false),
    [upload, setUpload] = useState(false);
  useEffect(() => {
    let active = true;
    api<Session>("/api/session")
      .then((data) => {
        if (active) setSession(data);
      })
      .catch((e) => {
        if (
          e.message === "SIGN_IN_REQUIRED" ||
          e.message === "WORKSPACE_ACCESS_REQUIRED"
        )
          router.replace("/login");
        else setError(true);
      });
    return () => {
      active = false;
    };
  }, [router]);
  async function logout() {
    if (session?.identity.mode === "live") await browserClient().auth.signOut();
    await api("/api/session", { method: "DELETE" });
    router.replace("/login");
  }
  if (!session)
    return (
      <main className="loading-page">
        <AudioLines size={28} />
        <p>
          {error
            ? "Workspace unavailable. Please reload."
            : "Opening your workspace…"}
        </p>
      </main>
    );
  const nav = [
    { href: "/overview", label: "Overview", icon: LayoutDashboard },
    { href: "/calls", label: "Calls", icon: Phone },
    { href: "/review", label: "Needs review", icon: ClipboardCheck },
  ];
  return (
    <Context.Provider value={{ session, openUpload: () => setUpload(true) }}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="app-shell">
        <aside className="sidebar">
          <Link href="/overview" className="brand">
            <span className="brand-mark">
              <AudioLines size={21} />
            </span>
            PestLaunch<span className="brand-dot">.</span>
          </Link>
          <div className="workspace-label">
            <span className="workspace-avatar">P</span>
            <div>
              <strong>PestLaunch workspace</strong>
              <span>
                {session.identity.mode === "sample"
                  ? "Fictional sample data"
                  : "Private team workspace"}
              </span>
            </div>
            <ShieldCheck size={16} />
          </div>
          <span className="nav-heading">WORKSPACE</span>
          <nav aria-label="Main navigation">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                className={`nav-link ${pathname.startsWith(href) ? "active" : ""}`}
                href={href}
                aria-current={pathname.startsWith(href) ? "page" : undefined}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <Link
              href="/settings/data"
              className={`nav-link ${pathname.startsWith("/settings") ? "active" : ""}`}
            >
              <Settings2 size={18} />
              Data controls
            </Link>
            <div className="member">
              <span className="member-avatar">
                {session.identity.role === "owner" ? "O" : "R"}
              </span>
              <div>
                <strong>
                  {session.identity.mode === "sample"
                    ? "Sample owner"
                    : "Team member"}
                </strong>
                <span>
                  {session.identity.role === "owner"
                    ? "Workspace owner"
                    : "Reviewer"}
                </span>
              </div>
              <button
                className="icon-button"
                onClick={logout}
                aria-label="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>
        <div className="workspace-main">
          <header className="topbar">
            <div>
              <AudioLines size={17} />
              <span>Call Intelligence</span>
              <span className="topbar-separator">/</span>
              <span className="muted">
                {pathname.startsWith("/settings")
                  ? "Data controls"
                  : pathname.startsWith("/review")
                    ? "Review queue"
                    : pathname.startsWith("/calls/")
                      ? "Call workspace"
                      : pathname === "/calls"
                        ? "All calls"
                        : "Overview"}
              </span>
            </div>
            {session.identity.role === "owner" && (
              <button
                className="button primary"
                onClick={() => setUpload(true)}
              >
                <Plus size={17} />
                Add call
              </button>
            )}
          </header>
          {session.identity.mode === "sample" && (
            <div className="environment-strip">
              <span className="sample-dot" />
              <strong>Sample workspace</strong>
              <span>
                Fictional results for testing. Live AI is not connected.
              </span>
              <Link href="/settings/data">
                Setup status
                <ArrowRight size={13} />
              </Link>
            </div>
          )}
          <main id="main-content" className="page-content">
            {children}
          </main>
        </div>
      </div>
      {upload && <UploadDialog onClose={() => setUpload(false)} />}
    </Context.Provider>
  );
}
function UploadDialog({ onClose }: { onClose: () => void }) {
  const { session } = useWorkspace(),
    router = useRouter(),
    dialog = useRef<HTMLDialogElement>(null),
    [selected, setSelected] = useState(SAMPLE_OPTIONS[0].id),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [sanitized, setSanitized] = useState(false),
    [sourceKind, setSourceKind] = useState("synthetic"),
    [rep, setRep] = useState(""),
    [direction, setDirection] = useState(""),
    [recordedAt, setRecordedAt] = useState("");
  useEffect(() => {
    const current = dialog.current;
    current?.showModal();
    return () => current?.close();
  }, []);
  async function addSample() {
    setBusy(true);
    setMessage("");
    try {
      const data = await api<{ call: { id: string } }>("/api/calls", {
        method: "POST",
        body: JSON.stringify({ sample: selected }),
      });
      onClose();
      router.push(`/calls/${data.call.id}`);
      router.refresh();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function upload() {
    if (!file) return;
    setBusy(true);
    setMessage("Preparing recording…");
    try {
      if (file.size > 25_000_000)
        throw new Error("File exceeds the 25 MB limit.");
      const bytes = await file.arrayBuffer();
      const audioContext = new AudioContext();
      let durationMs: number;
      try {
        durationMs = Math.round(
          (await audioContext.decodeAudioData(bytes.slice(0))).duration * 1000,
        );
      } finally {
        await audioContext.close();
      }
      if (durationMs > 3_600_000)
        throw new Error("Recording exceeds the 60-minute limit.");
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      const checksum = Array.from(new Uint8Array(hash))
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
      const intent = await api<{
        callId: string;
        path: string;
        duplicateId?: string;
      }>("/api/calls/upload-intent", {
        method: "POST",
        body: JSON.stringify({
          label: file.name,
          bytes: file.size,
          durationMs,
          checksum,
          extension: file.name.split(".").at(-1)?.toLowerCase(),
          recordedAt: recordedAt ? new Date(recordedAt).toISOString() : null,
          rep: rep.trim() || null,
          direction: direction || null,
          sanitized,
          sourceKind,
        }),
      });
      if (intent.duplicateId) {
        onClose();
        router.push(`/calls/${intent.duplicateId}`);
        return;
      }
      setMessage("Uploading to private storage…");
      const { error } = await browserClient()
        .storage.from("call-source")
        .upload(intent.path, file, { upsert: false });
      if (error && !["409", "Duplicate"].includes(String(error.statusCode)))
        throw error;
      setMessage("Starting analysis…");
      await api("/api/calls/finalize", {
        method: "POST",
        body: JSON.stringify({ callId: intent.callId }),
      });
      onClose();
      router.push(`/calls/${intent.callId}`);
    } catch (e) {
      setMessage(
        (e as Error).message.startsWith("File exceeds") ||
          (e as Error).message.startsWith("Recording exceeds")
          ? (e as Error).message
          : errorText(e),
      );
    } finally {
      setBusy(false);
    }
  }
  const enabled =
    session.backendConfigured &&
    (sourceKind === "synthetic" || session.processingEnabled);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="upload-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === dialog.current && !busy) onClose();
      }}
    >
      <div className="modal-head">
        <div>
          <span className="eyebrow">CALL INTELLIGENCE</span>
          <h2 id="upload-title">Add a conversation</h2>
        </div>
        <button
          className="icon-button"
          disabled={busy}
          onClick={onClose}
          aria-label="Close add call"
        >
          <X size={20} />
        </button>
      </div>
      {session.identity.mode === "sample" ? (
        <>
          <p className="muted">
            Choose a fictional conversation to test the complete review
            experience. These are prepared samples, not AI-generated
            evaluations.
          </p>
          <div className="sample-options">
            {SAMPLE_OPTIONS.map((option) => (
              <label
                className={`sample-option ${selected === option.id ? "selected" : ""}`}
                key={option.id}
              >
                <input
                  type="radio"
                  name="sample"
                  value={option.id}
                  checked={selected === option.id}
                  onChange={() => setSelected(option.id)}
                />
                <div>
                  <strong>{option.title}</strong>
                  <span>{option.description}</span>
                </div>
                {selected === option.id && <CheckCircle2 size={18} />}
              </label>
            ))}
          </div>
          <div className="notice">
            <AlertCircle size={17} />
            <p>
              Real recording analysis is not configured. Your AI API key stays
              empty until you add it.
            </p>
          </div>
          <div className="modal-actions">
            <button className="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              className="button primary"
              onClick={addSample}
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Plus size={17} />
              )}
              Add fictional call
            </button>
          </div>
        </>
      ) : (
        <>
          <label>
            Recording type
            <select
              value={sourceKind}
              onChange={(e) => setSourceKind(e.target.value)}
            >
              <option value="synthetic">Fictional test recording</option>
              <option value="real" disabled={!session.processingEnabled}>
                Client call — privacy approval required
              </option>
            </select>
          </label>
          <label className="file-drop">
            <FileAudio size={30} />
            <strong>{file ? file.name : "Select a recording"}</strong>
            <span>MP3, WAV or M4A · up to 25 MB · 60 minutes</span>
            <input
              type="file"
              accept=".mp3,.wav,.m4a"
              disabled={!enabled || busy}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <div className="form-grid">
            <label>
              Employee, if known
              <input
                value={rep}
                onChange={(e) => setRep(e.target.value)}
                placeholder="Not provided"
              />
            </label>
            <label>
              Direction
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
              >
                <option value="">Not provided</option>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
            </label>
            <label>
              Original recording time, if known
              <input
                type="datetime-local"
                value={recordedAt}
                onChange={(e) => setRecordedAt(e.target.value)}
              />
            </label>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={sanitized}
              onChange={(e) => setSanitized(e.target.checked)}
            />
            I have privately checked and redacted sensitive information from
            this recording.
          </label>
          {(!enabled || !session.aiConfigured) && (
            <div className="notice">
              <AlertCircle size={17} />
              <p>
                {!session.aiConfigured
                  ? "You can upload a fictional recording privately. Analysis waits until the server AI key is added."
                  : "Recording analysis is held until privacy settings are verified."}
              </p>
            </div>
          )}
          <div className="modal-actions">
            <button className="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              className="button primary"
              onClick={upload}
              disabled={!enabled || !file || !sanitized || busy}
            >
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Plus size={17} />
              )}
              {session.aiConfigured ? "Upload and analyze" : "Upload recording"}
            </button>
          </div>
        </>
      )}
      {message && (
        <p role="status" className="fine">
          {message}
        </p>
      )}
    </dialog>
  );
}
