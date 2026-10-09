"use client";
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Trash2,
  Database,
  KeyRound,
} from "lucide-react";
import { api, errorText, useWorkspace } from "@/components/workspace-shell";
import { useCalls } from "@/components/call-list";
import { ConfirmDelete } from "@/components/call-detail";
type RetentionSummary = { retained: number; pendingDeletion: number };
export default function DataControls() {
  const { session } = useWorkspace(),
    { calls, reload } = useCalls(),
    [confirm, setConfirm] = useState(false),
    [message, setMessage] = useState(""),
    [summary, setSummary] = useState<RetentionSummary | null>(null),
    [loading, setLoading] = useState(false),
    [summaryError, setSummaryError] = useState("");
  const refreshSummary = useCallback(async () => {
    setLoading(true);
    setSummaryError("");
    try {
      setSummary(await api<RetentionSummary>("/api/test-data"));
    } catch (error) {
      setSummary(null);
      setSummaryError(errorText(error));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    setSummary(null);
    if (session.identity.role === "owner") void refreshSummary();
  }, [session.identity.role, session.identity.workspaceId, refreshSummary]);
  async function remove() {
    try {
      const receipt = await api<{ deleted: number; at: string }>(
        "/api/test-data",
        { method: "DELETE", body: JSON.stringify({ confirmation: "DELETE" }) },
      );
      setMessage(
        `${receipt.deleted} conversations deleted. No conversation content is retained in the deletion receipt.`,
      );
      setConfirm(false);
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      await Promise.allSettled([refreshSummary(), reload()]);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR DATA, YOUR CONTROL</span>
          <h1>Data controls</h1>
          <p>
            Check setup status and manage the conversations retained for this
            test.
          </p>
        </div>
        <span className="scope-label">
          <ShieldCheck size={14} />
          Private workspace
        </span>
      </div>
      <section className="panel settings-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">WORKSPACE READINESS</span>
            <h2>Connection status</h2>
          </div>
        </div>
        <div className="setup-row">
          <span className="setup-icon">
            <Database size={20} />
          </span>
          <div>
            <strong>Persistent workspace</strong>
            <p>
              {session.backendConfigured
                ? "Supabase is configured. Hosted acceptance still requires verification."
                : "Local fictional data persists across reloads. Supabase credentials have not been added."}
            </p>
          </div>
          <span
            className={`badge ${session.backendConfigured ? "green" : "neutral"}`}
          >
            {session.backendConfigured ? "Configured" : "Local sample"}
          </span>
        </div>
        <div className="setup-row">
          <span className="setup-icon">
            <KeyRound size={20} />
          </span>
          <div>
            <strong>Recording analysis</strong>
            <p>
              {session.aiConfigured
                ? "Server credentials are present. Live analysis has not been verified by this status alone."
                : "AI API key is intentionally empty. Transcription and analysis require it before they can run."}
            </p>
          </div>
          <span className={`badge ${session.aiConfigured ? "green" : "amber"}`}>
            {session.aiConfigured ? "Configured" : "Not configured"}
          </span>
        </div>
        <div className="setup-row">
          <span className="setup-icon">
            <ShieldCheck size={20} />
          </span>
          <div>
            <strong>Private workspace</strong>
            <p>
              Only invited workspace members can access recordings and results.
            </p>
          </div>
          <span className="badge green">Protected</span>
        </div>
      </section>
      <section className="panel settings-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TEST DATA RETENTION</span>
            <h2>
              {session.identity.role === "owner"
                ? "Retained conversations"
                : "Available conversations"}
            </h2>
          </div>
          <span className="retained-count">
            {session.identity.role === "owner"
              ? summary
                ? summary.retained
                : "—"
              : calls.length}
          </span>
        </div>
        <div className="retention-info">
          {session.identity.role === "owner" && loading && (
            <p role="status">Loading retained conversations…</p>
          )}
          {session.identity.role === "owner" && summaryError && (
            <p className="error-text" role="alert">
              Retained count is unavailable. {summaryError}
            </p>
          )}
          {summary && summary.pendingDeletion > 0 && (
            <p role="status">
              {summary.pendingDeletion} conversation(s) still need deletion
              cleanup. Retry deletion to finish.
            </p>
          )}
          <p>
            {session.identity.mode === "sample"
              ? "This workspace contains fictional samples only. No client recordings have been imported here."
              : "Recordings and their derived content are private and may only be used for this test."}
          </p>
          <div>
            <CheckCircle2 size={16} />
            Deletion removes the application’s recording, transcript, result and
            review copies.
          </div>
          <div>
            <AlertCircle size={16} />
            Provider logs, backups and storage retention require separate
            verification before claiming full deletion.
          </div>
        </div>
        {session.identity.role === "owner" && (
          <div className="deletion-area">
            <div>
              <strong>Delete all test conversations</strong>
              <p>
                This clears the entire current workspace’s call data. Code and
                fictional fixture definitions remain.
              </p>
            </div>
            <button
              className="button destructive"
              disabled={loading || summary === null || summary.retained === 0}
              onClick={() => setConfirm(true)}
            >
              <Trash2 size={16} />
              {summary && summary.pendingDeletion > 0
                ? "Retry deletion cleanup"
                : "Delete test data"}
            </button>
          </div>
        )}
      </section>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {confirm && (
        <ConfirmDelete
          label="Delete all test conversations?"
          detail={`This removes ${summary?.retained ?? "—"} conversations and all their application results and review history. It cannot be undone.`}
          onClose={() => setConfirm(false)}
          onConfirm={remove}
        />
      )}
    </>
  );
}
