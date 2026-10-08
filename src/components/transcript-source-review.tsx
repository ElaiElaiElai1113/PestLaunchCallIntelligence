"use client";
import { useEffect, useRef, useState } from "react";
import type { CallRecord, Segment } from "@/lib/domain/types";
import { api, errorText } from "./workspace-shell";
import { activeProcessing } from "@/lib/domain/source-review";
const clock = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const rolesFor = (call: CallRecord) =>
  Object.fromEntries(call.segments.map((s) => [s.id, s.speaker]));
export function TranscriptSourceReview({
  call,
  onClose,
  onSave,
  onRefresh,
}: {
  call: CallRecord;
  onClose: () => void;
  onSave: (call: CallRecord) => void;
  onRefresh: (call: CallRecord) => void;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    [reviewed, setReviewed] = useState(call),
    [latest, setLatest] = useState<CallRecord | null>(null),
    [roles, setRoles] = useState(rolesFor(call)),
    [complete, setComplete] = useState(false),
    [quality, setQuality] = useState(false),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    returnFocus.current ??= document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      returnFocus.current?.focus();
    };
  }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ call: CallRecord }>(
        `/api/calls/${reviewed.id}/source-review`,
        {
          method: "POST",
          body: JSON.stringify({
            version: reviewed.version,
            roles: reviewed.segments.map((s) => ({
              segmentId: s.id,
              speaker: roles[s.id],
            })),
            completenessVerified: complete,
            qualityVerified: quality,
            reason,
          }),
        },
      );
      onSave(result.call);
    } catch (e) {
      setError(errorText(e));
      if (
        e instanceof Error &&
        (e.message === "STALE_SOURCE_REVIEW" ||
          e.message === "PROCESSING_ACTIVE")
      ) {
        try {
          const result = await api<{ call: CallRecord }>(
            `/api/calls/${reviewed.id}`,
          );
          setLatest(result.call);
          onRefresh(result.call);
        } catch {
          setError(
            "The latest transcript could not be reached. Close this review and try again.",
          );
        }
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="modal source-review-modal"
      aria-labelledby="source-review-title"
      onCancel={() => {
        if (!busy) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id="source-review-title">Review transcript</h2>
        <button
          className="icon-button"
          aria-label="Close transcript review"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <p className="muted">
        {reviewed.mode === "sample"
          ? "Review the complete fictional dialogue. This text-only example has no recording; these confirmations concern its displayed text only."
          : "Listen to the entire privately prepared recording and compare it with the transcript. Leave mixed or unclear speakers Unknown. This review does not change words or timestamps."}
      </p>
      <form onSubmit={save}>
        <div className="source-role-list">
          {reviewed.segments.map((segment) => (
            <div className="source-role-row" key={segment.id}>
              <div>
                <span className="muted">{clock(segment.startMs)}</span>
                <p>{segment.text}</p>
              </div>
              <label>
                Speaker at {clock(segment.startMs)}
                <select
                  aria-label={`Speaker ${segment.id}`}
                  value={roles[segment.id]}
                  disabled={busy}
                  onChange={(e) =>
                    setRoles({
                      ...roles,
                      [segment.id]: e.target.value as Segment["speaker"],
                    })
                  }
                >
                  <option value="unknown">Unknown</option>
                  <option value="employee">Employee</option>
                  <option value="customer">Customer</option>
                </select>
              </label>
            </div>
          ))}
        </div>
        <label className="source-confirmation">
          <input
            type="checkbox"
            checked={complete}
            onChange={(e) => setComplete(e.target.checked)}
            disabled={busy}
          />
          {reviewed.mode === "sample"
            ? "I reviewed the complete fictional dialogue."
            : "I checked the whole prepared recording and verified that the transcript captures the complete conversation."}
        </label>
        <label className="source-confirmation">
          <input
            type="checkbox"
            checked={quality}
            onChange={(e) => setQuality(e.target.checked)}
            disabled={busy}
          />
          {reviewed.mode === "sample"
            ? "I checked the accuracy of the displayed fictional text."
            : "I checked transcript accuracy against the prepared recording; no unresolved transcription-quality issue remains."}
        </label>
        <label>
          Reason for transcript review
          <textarea
            value={reason}
            maxLength={800}
            rows={3}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={10}
          />
        </label>
        <p className="muted">
          Saving preserves the original source and review history. Existing
          analysis becomes previous history; it must run again before a current
          grade can be published.
        </p>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        {latest && (
          <div className="notice">
            <p>
              Your reason draft is preserved. Inspect the latest source and
              confirm it again before saving.
            </p>
            <button
              type="button"
              className="button"
              onClick={() => {
                setReviewed(latest);
                setRoles(rolesFor(latest));
                setComplete(false);
                setQuality(false);
                setLatest(null);
                setError("");
              }}
            >
              Refresh transcript review
            </button>
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={
              busy ||
              !!latest ||
              activeProcessing(reviewed) ||
              reason.trim().length < 10
            }
          >
            Save transcript review
          </button>
        </div>
      </form>
    </dialog>
  );
}
