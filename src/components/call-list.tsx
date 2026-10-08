"use client";
import { useEffect, useState, useRef, useTransition } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronRight,
  Phone,
  Search,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CallRecord } from "@/lib/domain/types";
import { outcomeLabel } from "@/lib/domain/outcomes";
import { pendingProcessing } from "@/lib/domain/processing-attempt";
import { analysisCurrent } from "@/lib/domain/source-review";
import { matchesCallFilters } from "@/lib/domain/call-filters";
import { api, errorText, useWorkspace } from "./workspace-shell";
export const time = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
export const purposeLabel = (purpose: string | undefined) =>
  purpose
    ? purpose.charAt(0).toUpperCase() + purpose.slice(1)
    : "Awaiting analysis";
export function outcome(call: CallRecord) {
  return outcomeLabel(call);
}
export function GradeBadge({ call }: { call: CallRecord }) {
  if (call.analysis && !analysisCurrent(call))
    return <span className="badge amber">Analysis needs to run again</span>;
  return (
    <span className={`badge ${call.score?.grade || "amber"}`}>
      {call.score?.grade
        ? `${purposeLabel(call.score.grade)} · ${call.score.points}/${call.score.denominator}`
        : call.analysis
          ? `Partial · ${call.score?.points}/${call.score?.denominator}`
          : "Pending"}
    </span>
  );
}
export function StatusBadge({ call }: { call: CallRecord }) {
  return (
    <span
      className={`status ${call.status === "ready" ? "green" : call.status === "failed" ? "red" : call.status === "needs_review" || call.status === "privacy_review" ? "amber" : "blue"}`}
    >
      <span />
      {pendingProcessing(call)
        ? "Waiting to start"
        : call.errorCode === "AI_NOT_CONFIGURED"
          ? "Awaiting AI"
          : call.errorCode === "PRIVACY_APPROVAL_REQUIRED"
            ? "Privacy held"
            : call.status === "needs_review"
              ? "Needs review"
              : call.status === "privacy_review"
                ? "Privacy review"
                : call.status === "queued" &&
                    call.errorCode === "UPLOAD_PENDING"
                  ? "Awaiting upload"
                  : purposeLabel(call.status.replaceAll("_", " "))}
    </span>
  );
}
export function useCalls() {
  const [calls, setCalls] = useState<CallRecord[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const reload = async () => {
    try {
      const result = await api<{ calls: CallRecord[] }>("/api/calls");
      setCalls(result.calls);
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void reload();
    const timer = setInterval(reload, 5000);
    return () => clearInterval(timer);
  }, []);
  return { calls, loading, error, reload };
}
export function CallRows({
  calls,
  back = "/calls",
}: {
  calls: CallRecord[];
  back?: string;
}) {
  return (
    <div className="call-table">
      <div className="call-table-head">
        <span>CONVERSATION</span>
        <span>PURPOSE & OUTCOME</span>
        <span>SCORECARD</span>
        <span>STATUS</span>
        <span />
      </div>
      {calls.map((call) => (
        <Link
          className="call-row"
          href={`/calls/${call.id}?back=${encodeURIComponent(back)}`}
          key={call.id}
        >
          <div className="call-name">
            <span className="call-icon">
              <Phone size={17} />
            </span>
            <div>
              <strong>{call.analysis?.title || call.label}</strong>
              <span>
                {call.label} <span className="middot">·</span>{" "}
                {time(call.durationMs)} <span className="middot">·</span>{" "}
                {call.rep || "Employee not provided"}
              </span>
            </div>
          </div>
          <div className="call-purpose">
            <strong>{purposeLabel(call.analysis?.purpose)}</strong>
            <span>{outcome(call)}</span>
          </div>
          <div>
            <GradeBadge call={call} />
          </div>
          <div>
            <StatusBadge call={call} />
          </div>
          <ChevronRight size={17} className="muted" />
        </Link>
      ))}
    </div>
  );
}
export function CallLog({ review = false }: { review?: boolean }) {
  const { calls, loading, error } = useCalls(),
    { openUpload } = useWorkspace(),
    urlParams = useSearchParams(),
    router = useRouter();
  const [draft, setDraft] = useState(urlParams.toString()),
    [isPending, startTransition] = useTransition();
  const latest = useRef(new URLSearchParams(urlParams.toString()));
  const params = new URLSearchParams(draft);
  useEffect(() => {
    if (!isPending) {
      latest.current = new URLSearchParams(urlParams.toString());
      setDraft(urlParams.toString());
    }
  }, [urlParams, isPending]);
  const query = params.get("q") || "",
    purpose = params.get("purpose") || "",
    status = params.get("status") || "",
    grade = params.get("grade") || "";
  function filter(key: string, value: string) {
    const next = new URLSearchParams(latest.current.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    latest.current = next;
    setDraft(next.toString());
    startTransition(() =>
      router.replace(
        `${review ? "/review" : "/calls"}${next.size ? "?" + next.toString() : ""}`,
        { scroll: false },
      ),
    );
  }
  const filtered = calls.filter((call) =>
    matchesCallFilters(call, params, review),
  );
  const back = `${review ? "/review" : "/calls"}${params.size ? "?" + params.toString() : ""}`;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {review
              ? "FOCUS ON WHAT NEEDS ATTENTION"
              : "YOUR CONVERSATIONS, IN CONTEXT"}
          </span>
          <h1>
            {review ? "Needs review" : "Calls"}
            <span className="count-pill">
              {review
                ? calls.filter((x) =>
                    ["needs_review", "privacy_review"].includes(x.status),
                  ).length
                : calls.length}
            </span>
          </h1>
          <p>
            {review
              ? "Resolve uncertainty before treating an assessment as final."
              : "A clear record of what happened and what comes next."}
          </p>
        </div>
        <span className="scope-label">All recording dates</span>
      </div>
      {review && (
        <div className="review-intro">
          <ClipboardIcon />
          <div>
            <strong>Keep the evidence in the conversation.</strong>
            <p>
              Open a flagged call, inspect the transcript, and save a reasoned
              correction. Original assessments stay in the review history.
            </p>
          </div>
        </div>
      )}
      <section className="panel">
        <div className="filters">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search calls"
              value={query}
              onChange={(e) => filter("q", e.target.value)}
              placeholder="Search conversations…"
            />
          </label>
          <div className="filter-selects">
            <SlidersHorizontal size={16} />
            <select
              aria-label="Filter by purpose"
              value={purpose}
              onChange={(e) => filter("purpose", e.target.value)}
            >
              <option value="">All purposes</option>
              <option value="sales">Sales</option>
              <option value="general">General</option>
              <option value="retention">Retention</option>
              <option value="unknown">Unknown</option>
            </select>
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => filter("status", e.target.value)}
            >
              <option value="">All statuses</option>
              {[
                "ready",
                "needs_review",
                "privacy_review",
                "queued",
                "transcribing",
                "analyzing",
                "failed",
              ].map((x) => (
                <option key={x} value={x}>
                  {purposeLabel(x.replaceAll("_", " "))}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by grade"
              value={grade}
              onChange={(e) => filter("grade", e.target.value)}
            >
              <option value="">All grades</option>
              <option value="gold">Gold</option>
              <option value="green">Green</option>
              <option value="below">Below</option>
            </select>
          </div>
        </div>
        {loading ? (
          <div className="empty-state">Loading conversations…</div>
        ) : error ? (
          <div className="empty-state error-text" role="alert">
            {error}
          </div>
        ) : filtered.length ? (
          <CallRows calls={filtered} back={back} />
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <Phone size={24} />
            </span>
            <h2>
              {calls.length
                ? "No matching conversations"
                : review
                  ? "You’re all caught up"
                  : "Your first conversation starts here"}
            </h2>
            <p>
              {calls.length
                ? "Try a different search or reset your filters."
                : review
                  ? "Calls with unresolved questions will appear here."
                  : "Add a call to see its outcome, scorecard and coaching in one place."}
            </p>
            {calls.length ? (
              <button
                className="button"
                onClick={() => {
                  latest.current = new URLSearchParams();
                  setDraft("");
                  startTransition(() =>
                    router.replace(review ? "/review" : "/calls"),
                  );
                }}
              >
                <RotateCcw size={16} />
                Reset filters
              </button>
            ) : (
              !review && (
                <button className="button primary" onClick={openUpload}>
                  Add your first call
                  <ArrowUpRight size={16} />
                </button>
              )
            )}
          </div>
        )}
        <div className="table-footer">
          <span>
            {filtered.length} conversation{filtered.length === 1 ? "" : "s"}
          </span>
          <span>Original call dates stay unknown unless provided.</span>
        </div>
      </section>
    </>
  );
}
function ClipboardIcon() {
  return (
    <span className="review-intro-icon">
      <SlidersHorizontal size={20} />
    </span>
  );
}
