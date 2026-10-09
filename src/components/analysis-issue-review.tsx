"use client";
import { useState } from "react";
import type { CallRecord } from "@/lib/domain/types";
import { api, errorText } from "./workspace-shell";
export function AnalysisIssueReview({
  call,
  onSave,
}: {
  call: CallRecord;
  onSave: (call: CallRecord) => void;
}) {
  const [draft, setDraft] = useState<{
      issueId: string;
      version: number;
      sourceRevision: number;
      generation: number;
    } | null>(null),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [latest, setLatest] = useState<CallRecord | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ call: CallRecord }>(
        `/api/calls/${call.id}/issues`,
        {
          method: "POST",
          body: JSON.stringify({
            version: draft.version,
            issueId: draft.issueId,
            reason,
          }),
        },
      );
      onSave(result.call);
      setDraft(null);
      setReason("");
    } catch (err) {
      setError(errorText(err));
      try {
        setLatest(
          (await api<{ call: CallRecord }>(`/api/calls/${call.id}`)).call,
        );
      } catch {}
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="detail-section">
      <h3>Review withheld advice and outcomes</h3>
      {call.analysis?.reviewIssues?.map((issue) => (
        <div className="fact" key={issue.id}>
          <div>
            <strong>{issue.target.replaceAll("_", " ")}</strong>
            <p>{issue.message}</p>
            <button
              className="text-link"
              disabled={busy}
              onClick={() => {
                setDraft({
                  issueId: issue.id,
                  version: call.version,
                  sourceRevision: call.sourceRevision ?? 0,
                  generation: call.analysisGeneration ?? 0,
                });
                setError("");
                setLatest(null);
              }}
            >
              Review this issue
            </button>
          </div>
        </div>
      ))}
      {draft && (
        <form onSubmit={submit}>
          <p>
            Confirm that unsupported advice stays withheld or the unresolved
            result stays unknown. This does not establish a new fact or clear
            other warnings.
          </p>
          <label>
            Reason
            <textarea
              aria-label="Issue resolution reason"
              required
              minLength={10}
              maxLength={800}
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          {latest && (
            <button
              type="button"
              className="text-link"
              disabled={
                busy ||
                (latest.sourceRevision ?? 0) !== draft.sourceRevision ||
                (latest.analysisGeneration ?? 0) !== draft.generation ||
                !latest.analysis?.reviewIssues?.some(
                  (i) => i.id === draft.issueId,
                )
              }
              onClick={() => {
                setDraft({ ...draft, version: latest.version });
                onSave(latest);
                setLatest(null);
                setError("");
              }}
            >
              Use current version and retain reason
            </button>
          )}
          <button
            className="button primary"
            disabled={busy || reason.trim().length < 10}
          >
            Confirm withholding or unknown
          </button>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => setDraft(null)}
          >
            Cancel
          </button>
        </form>
      )}
      {!!call.issueDecisions?.length && (
        <div>
          <h4>Issue review history</h4>
          {call.issueDecisions.map((d) => (
            <div key={d.id} className="audit-row">
              <strong>{d.issueId}</strong>
              <p>{d.reason}</p>
              <small>
                Source {d.sourceRevision} · analysis {d.analysisGeneration}
              </small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
