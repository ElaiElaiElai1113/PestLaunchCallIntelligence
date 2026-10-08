"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle2,
  Clock3,
  MessageSquareText,
  Search,
  ShieldCheck,
  AudioLines,
  AlertCircle,
  ArrowRight,
  ClipboardCheck,
  X,
  Save,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import type { Assessment, CallRecord, Evidence } from "@/lib/domain/types";
import { RUBRICS, OBJECTION_IDS } from "@/lib/scoring/rubrics";
import { OUTCOME_LABELS } from "@/lib/samples/fixtures";
import { analysisCurrent, activeProcessing } from "@/lib/domain/source-review";
import { TranscriptSourceReview } from "./transcript-source-review";
import { analysisRecovery } from "@/lib/groq/analysis-recovery";
import { matchesCallFilters } from "@/lib/domain/call-filters";
import {
  pendingProcessing,
  retryAvailable,
} from "@/lib/domain/processing-attempt";
import { api, errorText, useWorkspace } from "./workspace-shell";
import {
  GradeBadge,
  StatusBadge,
  time,
  purposeLabel,
  outcome,
  useCalls,
} from "./call-list";
export function CallDetail({ id }: { id: string }) {
  const { session } = useWorkspace(),
    router = useRouter(),
    params = useSearchParams(),
    { calls } = useCalls();
  const [call, setCall] = useState<CallRecord | null>(null),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [search, setSearch] = useState(""),
    [review, setReview] = useState<{
      item: Assessment;
      call: CallRecord;
    } | null>(null),
    [media, setMedia] = useState(""),
    [deleting, setDeleting] = useState(false),
    [sourceReview, setSourceReview] = useState(false),
    audio = useRef<HTMLAudioElement>(null);
  const tab = params.get("tab") || "summary",
    backCandidate = params.get("back") || "/calls",
    back = /^\/(calls|review)(\?|$)/.test(backCandidate)
      ? backCandidate
      : "/calls";
  useEffect(() => {
    let active = true;
    const load = () =>
      api<{ call: CallRecord }>(`/api/calls/${id}`)
        .then((x) => {
          if (active) {
            setCall(x.call);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(errorText(e));
        });
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id]);
  useEffect(() => {
    if (!call?.sanitizedPath) return;
    let active = true;
    api<{ url: string }>(`/api/calls/${id}/media`)
      .then((x) => {
        if (active) setMedia(x.url);
      })
      .catch(() => {});
    const timer = setInterval(() => {
      void api<{ url: string }>(`/api/calls/${id}/media`).then((x) => {
        if (active) setMedia(x.url);
      });
    }, 45000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, call?.sanitizedPath]);
  function selectTab(value: string) {
    const next = new URLSearchParams(params);
    next.set("tab", value);
    router.replace(`/calls/${id}?${next}`, { scroll: false });
  }
  function seek(evidence: Evidence) {
    setSelected(evidence.segmentIds);
    setSearch("");
    const segment = call?.segments.find((x) => x.id === evidence.segmentIds[0]);
    if (segment && audio.current)
      audio.current.currentTime = segment.startMs / 1000;
    if (window.innerWidth < 1100) selectTab("transcript");
    setTimeout(
      () =>
        document.getElementById(evidence.segmentIds[0])?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
          block: "nearest",
        }),
      80,
    );
  }
  async function remove() {
    setDeleting(true);
    try {
      await api(`/api/calls/${id}`, { method: "DELETE" });
      router.push("/calls");
    } catch (e) {
      setError(errorText(e));
      setDeleting(false);
    }
  }
  if (!call)
    return (
      <div className="empty-state" role="status">
        {error || "Opening conversation…"}
      </div>
    );
  const a = call.analysis,
    score = call.score;
  const current = analysisCurrent(call);
  const pending = pendingProcessing(call);
  const recovery = analysisRecovery(call, session.processingEnabled);
  const waitingForAnalysis =
    !current &&
    call.segments.length > 0 &&
    !activeProcessing(call) &&
    call.status !== "privacy_review" &&
    ![
      "UPLOAD_PENDING",
      "PRIVACY_APPROVAL_REQUIRED",
      "PRIVACY_REVIEW_REQUIRED",
    ].includes(call.errorCode ?? "");
  const retryControl =
    session.identity.role === "owner" &&
    retryAvailable(call) &&
    (call.errorCode !== "ANALYSIS_BUDGET_EXCEEDED" ||
      recovery.budget === "admitted") ? (
      <button
        className="button primary"
        disabled={
          !session.aiConfigured ||
          (call.sourceKind !== "synthetic" && !session.processingEnabled)
        }
        onClick={async () => {
          try {
            await api(`/api/calls/${id}/retry`, { method: "POST" });
            setCall((await api<{ call: CallRecord }>(`/api/calls/${id}`)).call);
          } catch (error) {
            setError(errorText(error));
          }
        }}
      >
        {pending
          ? "Retry starting analysis"
          : call.status === "failed"
            ? "Retry processing"
            : "Resume analysis"}
      </button>
    ) : null;
  const backQuery = new URLSearchParams(back.split("?")[1] || "");
  const sequence = calls.filter((call) =>
    matchesCallFilters(call, backQuery, back.startsWith("/review")),
  );
  const index = sequence.findIndex((x) => x.id === id);
  const evidenceButton = (e: Evidence) => (
    <button
      className="evidence-link"
      onClick={() => seek(e)}
      disabled={!e.segmentIds.length}
    >
      <Clock3 size={13} />
      {e.segmentIds.length
        ? time(
            call.segments.find((x) => x.id === e.segmentIds[0])?.startMs || 0,
          )
        : "No timestamp"}
      <ArrowRight size={12} />
    </button>
  );
  return (
    <>
      <div className="detail-top">
        <Link className="text-link muted" href={back}>
          <ArrowLeft size={16} />
          Back to {back.startsWith("/review") ? "review queue" : "calls"}
        </Link>
        <div className="call-navigation">
          <span>
            {index >= 0 ? `${index + 1} of ${sequence.length}` : "Conversation"}
          </span>
          {index > 0 ? (
            <Link
              className="icon-button"
              aria-label="Previous call"
              href={`/calls/${sequence[index - 1].id}?back=${encodeURIComponent(back)}`}
            >
              <ChevronLeft size={18} />
            </Link>
          ) : (
            <button className="icon-button" aria-label="Previous call" disabled>
              <ChevronLeft size={18} />
            </button>
          )}
          {index >= 0 && index < sequence.length - 1 ? (
            <Link
              className="icon-button"
              aria-label="Next call"
              href={`/calls/${sequence[index + 1].id}?back=${encodeURIComponent(back)}`}
            >
              <ChevronRight size={18} />
            </Link>
          ) : (
            <button className="icon-button" aria-label="Next call" disabled>
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
      <div className="detail-heading">
        <div>
          <div className="detail-kicker">
            <span className="eyebrow">{call.label}</span>
            {(call.mode === "sample" || call.sourceKind === "synthetic") && (
              <span className="badge blue">
                {call.mode === "sample"
                  ? "Fictional sample"
                  : "Fictional recording"}
              </span>
            )}
            <StatusBadge call={call} />
          </div>
          <h1>{a?.title || call.label}</h1>
          <div className="detail-metadata">
            <span>{purposeLabel(a?.purpose)}</span>
            <span>{time(call.durationMs)}</span>
            <span>{call.rep || "Employee not provided"}</span>
            <span>
              {call.recordedAt
                ? new Date(call.recordedAt).toLocaleString()
                : "Recording date not provided"}
            </span>
          </div>
        </div>
        {score && (
          <div className="detail-score">
            <GradeBadge call={call} />
            <span>
              {score.unresolved
                ? `${score.unresolved} checkpoints to review`
                : "Deterministic rubric score"}
            </span>
          </div>
        )}
      </div>
      <section className="recording-strip">
        <span className="recording-icon">
          <AudioLines size={21} />
        </span>
        <div className="recording-description">
          <strong>
            {media
              ? "Sanitized recording"
              : call.mode === "sample"
                ? "Fictional transcript preview"
                : "Recording status"}
          </strong>
          <span>
            {media
              ? "Select any evidence timestamp to jump to it."
              : call.mode === "sample"
                ? "Text-only fixture. No recorded customer audio."
                : call.status === "privacy_review"
                  ? "Playback is held for privacy review."
                  : "Playback appears after processing and privacy checks."}
          </span>
        </div>
        {media && !sourceReview && (
          <audio
            ref={audio}
            controls
            preload="metadata"
            src={media}
            onError={() => {
              void api<{ url: string }>(`/api/calls/${id}/media`)
                .then((x) => setMedia(x.url))
                .catch(() => {});
            }}
          />
        )}
        <span className="recording-private">
          <ShieldCheck size={14} />
          Private
        </span>
      </section>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {call.errorCode === "ANALYSIS_BUDGET_EXCEEDED" && (
        <p className="error-text" role="alert">
          {recovery.budget === "admitted"
            ? "Previous analysis exceeded its limit. The current transcript fits the analysis limit; an owner can start analysis. No new result has been produced."
            : errorText(new Error("ANALYSIS_BUDGET_EXCEEDED"))}
        </p>
      )}
      {call.segments.length > 0 && (
        <section className="source-toolbar panel">
          <div>
            <strong>Transcript source</strong>
            <p>
              {!current && a
                ? "Transcript updated — analysis needs to run again."
                : call.segments.some((s) => s.speaker === "unknown")
                  ? "Speaker review needed"
                  : call.transcriptCompleteness === "unverified"
                    ? "Transcript needs review"
                    : call.mode === "sample"
                      ? "Fictional text example; no recording exists."
                      : "Source review stays with this conversation."}
            </p>
          </div>
          <button
            className="button"
            disabled={
              activeProcessing(call) || call.status === "privacy_review"
            }
            onClick={() => {
              audio.current?.pause();
              setSourceReview(true);
            }}
          >
            Review transcript
          </button>
        </section>
      )}
      {waitingForAnalysis && (
        <section className="panel source-status">
          <h2>
            {a ? (
              <>
                Previous analysis — source revision{" "}
                {call.analysisSourceRevision ?? 0}
              </>
            ) : (
              "Transcript awaiting analysis"
            )}
          </h2>
          <p>
            Current transcript source revision: {call.sourceRevision ?? 0}.
            {a
              ? " Previous results remain as history; no current grade is published."
              : " No current analysis or grade is available. Saving transcript review does not start analysis."}
          </p>
          {session.identity.role === "owner" ? (
            <>
              <button
                className="button primary"
                disabled={
                  !session.aiConfigured ||
                  call.mode === "sample" ||
                  !recovery.eligible
                }
                onClick={async () => {
                  try {
                    await api(`/api/calls/${id}/reanalyze`, {
                      method: "POST",
                      body: JSON.stringify({ version: call.version }),
                    });
                    setCall(
                      (await api<{ call: CallRecord }>(`/api/calls/${id}`))
                        .call,
                    );
                  } catch (e) {
                    setError(errorText(e));
                  }
                }}
              >
                {a ? "Re-analyze" : "Analyze transcript"}
              </button>
              {!session.aiConfigured && (
                <p>
                  Analysis is unavailable until AI is configured. No new result
                  has been produced.
                </p>
              )}
              {recovery.blockedReason &&
                (recovery.blockedReason !== "ANALYSIS_BUDGET_EXCEEDED" ||
                  call.errorCode !== "ANALYSIS_BUDGET_EXCEEDED") && (
                  <p>{errorText(new Error(recovery.blockedReason))}</p>
                )}
            </>
          ) : (
            <p>
              {a
                ? "A workspace owner must start re-analysis."
                : "A workspace owner must start analysis."}
            </p>
          )}
        </section>
      )}
      {a && pending && (
        <section className="panel processing-panel">
          <h2>Waiting to start</h2>
          <p>
            Processing has not confirmed a start yet. You can retry starting it.
          </p>
          {retryControl}
        </section>
      )}
      {!a && call.segments.length > 0 && (
        <Transcript
          call={call}
          selected={selected}
          search={search}
          setSearch={setSearch}
          seek={seek}
        />
      )}
      {!a ? (
        <section className="panel processing-panel">
          <span className="empty-icon">
            <LoaderCircle
              size={25}
              className={
                pending ||
                !activeProcessing(call) ||
                call.status === "failed" ||
                call.status === "privacy_review" ||
                call.errorCode === "AI_NOT_CONFIGURED" ||
                call.errorCode === "PRIVACY_APPROVAL_REQUIRED"
                  ? ""
                  : "spin"
              }
            />
          </span>
          <h2>
            {waitingForAnalysis
              ? "Waiting for owner analysis"
              : pending
                ? "Waiting to start"
                : call.errorCode === "AI_NOT_CONFIGURED"
                  ? "Recording stored. AI is not configured."
                  : call.errorCode === "PRIVACY_APPROVAL_REQUIRED"
                    ? "Recording held for privacy approval."
                    : call.status === "failed"
                      ? "This recording needs another try"
                      : call.status === "privacy_review"
                        ? "A private check is needed"
                        : "Your recording is being processed"}
          </h2>
          <p>
            {waitingForAnalysis
              ? "The transcript is preserved. No analysis is currently running; an owner must start it when source and request checks allow."
              : pending
                ? "Processing has not confirmed a start yet. You can retry starting it."
                : call.errorCode === "AI_NOT_CONFIGURED"
                  ? "The recording is stored privately. Add the server AI key later, then resume analysis. No transcript or result has been fabricated."
                  : call.errorCode === "PRIVACY_APPROVAL_REQUIRED"
                    ? "The recording stays private and will not be sent to AI until privacy approval is enabled."
                    : call.status === "privacy_review"
                      ? "Re-upload a privately verified, redacted recording before analysis can continue. No transcript is published."
                      : call.errorCode === "UPLOAD_PENDING"
                        ? "The recording upload has not been finalized. Re-select the file to resume."
                        : "You can leave this screen. The result will stay in your call log."}
          </p>
          <div className="processing-stages">
            {["queued", "transcribing", "analyzing", "ready"].map((stage) => (
              <span
                className={!pending && stage === call.status ? "current" : ""}
                key={stage}
              >
                {purposeLabel(stage)}
              </span>
            ))}
          </div>
          {retryControl}
        </section>
      ) : (
        <div
          className={`detail-grid ${tab === "transcript" ? "transcript-view" : ""}`}
        >
          <section className="analysis-pane">
            <div className="tabs" role="tablist" aria-label="Call detail views">
              {["summary", "scorecard", "coaching", "transcript"].map(
                (value) => (
                  <button
                    key={value}
                    id={`tab-${value}`}
                    className={tab === value ? "active" : ""}
                    role="tab"
                    aria-selected={tab === value}
                    aria-controls={`pane-${value}`}
                    onClick={() => selectTab(value)}
                  >
                    {purposeLabel(value)}
                  </button>
                ),
              )}
            </div>
            <div
              id={`pane-${tab}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
              className="analysis-content"
            >
              {tab === "summary" && (
                <>
                  <div className="outcome-banner">
                    <span className="outcome-icon">
                      <CheckCircle2 size={24} />
                    </span>
                    <div>
                      <span className="eyebrow">WHAT WAS AGREED</span>
                      <h2>{outcome(call)}</h2>
                      <p>{a.summary}</p>
                    </div>
                  </div>
                  <section className="detail-section">
                    <div className="section-title">
                      <MessageSquareText size={18} />
                      <h2>The important details</h2>
                    </div>
                    {a.facts.map((fact, i) => (
                      <div className="fact" key={i}>
                        <div>
                          <span className="eyebrow">{fact.label}</span>
                          <p>{fact.text}</p>
                        </div>
                        {evidenceButton(fact.evidence)}
                      </div>
                    ))}
                  </section>
                  <section className="detail-section">
                    <div className="section-title">
                      <CheckCircle2 size={18} />
                      <h2>Commitments, kept separate</h2>
                    </div>
                    <div className="outcomes-grid">
                      {Object.entries(a.outcomes).map(([key, value]) => (
                        <div className="outcome-fact" key={key}>
                          <span>
                            {OUTCOME_LABELS[key as keyof typeof OUTCOME_LABELS]}
                          </span>
                          <strong
                            className={
                              value.value === true
                                ? "confirmed"
                                : value.value === false
                                  ? "muted"
                                  : "unknown"
                            }
                          >
                            {value.value === true ? (
                              <>
                                <Check size={14} />
                                Confirmed in call
                              </>
                            ) : value.value === false ? (
                              "Explicitly not done"
                            ) : (
                              "Not confirmed"
                            )}
                          </strong>
                          {value.evidence.segmentIds.length > 0 &&
                            evidenceButton(value.evidence)}
                        </div>
                      ))}
                    </div>
                    <p className="fine">
                      A commitment in a conversation does not verify a completed
                      account action.
                    </p>
                  </section>
                  <section className="detail-section">
                    <div className="section-title">
                      <Clock3 size={18} />
                      <h2>What comes next</h2>
                    </div>
                    {a.followups.length ? (
                      a.followups.map((item, i) => (
                        <div className="followup" key={i}>
                          <span className="followup-check">
                            <Clock3 size={16} />
                          </span>
                          <div>
                            <p>{item.text}</p>
                            <span className="badge neutral">
                              {purposeLabel(item.state.replaceAll("_", " "))}
                            </span>
                            {item.dueText && (
                              <span className="fine">
                                {" "}
                                Source wording: “{item.dueText}”
                              </span>
                            )}
                          </div>
                          {evidenceButton(item.evidence)}
                        </div>
                      ))
                    ) : (
                      <p className="muted">
                        No evidence-backed follow-up identified.
                      </p>
                    )}
                  </section>
                </>
              )}
              {tab === "scorecard" && (
                <>
                  <div className="score-summary">
                    <div>
                      <span className="eyebrow">
                        {purposeLabel(a.purpose)} SCORECARD
                      </span>
                      <div className="score-number">
                        {score?.points}
                        <span>/ {score?.denominator}</span>
                      </div>
                      <GradeBadge call={call} />
                    </div>
                    <div>
                      <h2>
                        {score?.grade
                          ? "Every point has a standard."
                          : "A closer look before a final grade."}
                      </h2>
                      <p>
                        {score?.unresolved
                          ? `${score.unresolved} unresolved checkpoints. The original denominator is preserved.`
                          : "Scores are calculated from the checkpoint decisions, using the supplied rubric."}
                      </p>
                      <span className="fine">
                        Gold {a.purpose === "sales" ? "17" : "12"} · Green{" "}
                        {a.purpose === "sales" ? "14–16" : "11"} · Below{" "}
                        {a.purpose === "sales" ? "0–13" : "0–10"}
                      </span>
                    </div>
                  </div>
                  {a.reviewReasons.length > 0 && (
                    <div className="review-reasons">
                      <AlertCircle size={17} />
                      <div>
                        <strong>Review needed</strong>
                        {a.reviewReasons.map((reason, i) => (
                          <p key={i}>
                            {reason
                              .replace("Checkpoint needs review: ", "Confirm ")
                              .replaceAll("_", " ")}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {a.purpose !== "unknown" &&
                    ["Validate", "Understand", "Solve", "Verify"].map(
                      (group) => (
                        <section className="rubric-group" key={group}>
                          <h3>
                            <span>{group}</span>
                            <span>
                              {
                                RUBRICS[
                                  a.purpose as Exclude<
                                    typeof a.purpose,
                                    "unknown"
                                  >
                                ].filter((x) => x.group === group).length
                              }{" "}
                              checkpoints
                            </span>
                          </h3>
                          {RUBRICS[
                            a.purpose as Exclude<typeof a.purpose, "unknown">
                          ]
                            .filter((x) => x.group === group)
                            .map((def) => {
                              const item = a.assessments.find(
                                (x) => x.id === def.id,
                              )!;
                              const policy =
                                a.purpose === "sales" &&
                                a.noObjections &&
                                a.complete &&
                                OBJECTION_IDS.includes(item.id);
                              return (
                                <div className="checkpoint" key={def.id}>
                                  <span
                                    className={`checkpoint-status ${policy ? "policy" : item.status}`}
                                  >
                                    {item.status === "passed" || policy ? (
                                      <Check size={14} />
                                    ) : item.status === "missed" ? (
                                      <X size={14} />
                                    ) : (
                                      <span>?</span>
                                    )}
                                  </span>
                                  <div>
                                    <strong>{def.label}</strong>
                                    <span
                                      className={`checkpoint-word ${policy ? "blue" : item.status === "passed" ? "green" : "muted"}`}
                                    >
                                      {policy
                                        ? "Policy award"
                                        : item.status === "not_applicable"
                                          ? "Applicability unresolved"
                                          : purposeLabel(item.status)}
                                    </span>
                                    <p>
                                      {policy
                                        ? "Four objection points awarded by manual policy: a complete call with reliably no objections."
                                        : item.reason}
                                    </p>
                                    <div className="checkpoint-actions">
                                      {evidenceButton(item.evidence)}
                                      {!policy && (
                                        <button
                                          className="text-link"
                                          onClick={() =>
                                            setReview({
                                              item: structuredClone(item),
                                              call: structuredClone(call),
                                            })
                                          }
                                          aria-label={`Review ${def.label}`}
                                          disabled={
                                            !current || activeProcessing(call)
                                          }
                                        >
                                          <ClipboardCheck size={13} />
                                          Review checkpoint
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </section>
                      ),
                    )}
                  {call.decisions.length > 0 && (
                    <section className="detail-section">
                      <h2>Review history</h2>
                      {call.decisions.map((d) => (
                        <div className="audit-row" key={d.id}>
                          <strong>
                            {d.checkpointId.replaceAll("_", " ")} → {d.status}
                          </strong>
                          <p>{d.reason}</p>
                          <span>
                            Version {d.previousVersion} · Source revision{" "}
                            {d.sourceRevision ?? 0} ·{" "}
                            {new Date(d.at).toLocaleString()}
                          </span>
                        </div>
                      ))}
                      <p className="fine">
                        Original {call.mode === "sample" ? "sample" : "model"}{" "}
                        assessment:{" "}
                        {call.originalAnalysis
                          ? call.originalAnalysis.assessments.filter(
                              (x) => x.status === "passed",
                            ).length
                          : "—"}{" "}
                        passed checkpoints. Original and reviewed results are
                        kept separately.
                      </p>
                    </section>
                  )}
                </>
              )}
              {tab === "coaching" && (
                <>
                  <div className="coaching-heading">
                    <span className="eyebrow">
                      ONE CONVERSATION, BETTER NEXT TIME
                    </span>
                    <h2>Make the next call stronger.</h2>
                    <p>
                      Specific feedback connected to the conversation and its
                      standards.
                    </p>
                  </div>
                  {!a.coaching.length && (
                    <p className="muted">
                      Employee-specific coaching needs speaker review.
                    </p>
                  )}
                  {a.coaching.map((item, i) => (
                    <section className={`coaching-card ${item.kind}`} key={i}>
                      <span className="coaching-kind">
                        {item.kind === "strength" ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          <MessageSquareText size={16} />
                        )}{" "}
                        {item.kind === "strength"
                          ? "Keep doing this"
                          : "Your next practice"}
                      </span>
                      <h3>{item.title}</h3>
                      <p>{item.detail}</p>
                      {item.suggestedResponse && (
                        <blockquote>
                          <span>TRY SAYING</span>“{item.suggestedResponse}”
                        </blockquote>
                      )}
                      <div className="coaching-footer">
                        <span>{item.checkpointId.replaceAll("_", " ")}</span>
                        {evidenceButton(item.evidence)}
                      </div>
                    </section>
                  ))}
                  <p className="fine">
                    {call.mode === "sample"
                      ? "Fictional coaching for interface testing. "
                      : ""}
                    Call handling and sales success are assessed separately.
                  </p>
                </>
              )}
              {tab === "transcript" && (
                <Transcript
                  call={call}
                  selected={selected}
                  search={search}
                  setSearch={setSearch}
                  seek={seek}
                />
              )}
            </div>
          </section>
          {tab !== "transcript" && (
            <aside className="transcript-aside">
              <Transcript
                call={call}
                selected={selected}
                search={search}
                setSearch={setSearch}
                seek={seek}
              />
            </aside>
          )}
        </div>
      )}
      {session.identity.role === "owner" && (
        <div className="detail-footer">
          <span>
            <ShieldCheck size={14} />
            Private conversation · Version {call.version}
          </span>
          <button
            className="text-link danger"
            onClick={() => setDeleting(true)}
          >
            <Trash2 size={14} />
            Delete call
          </button>
        </div>
      )}
      {review && (
        <ReviewDialog
          call={review.call}
          item={review.item}
          onClose={() => setReview(null)}
          onRefresh={setCall}
          onSave={(value) => {
            setCall(value);
            setReview(null);
          }}
        />
      )}
      {sourceReview && (
        <TranscriptSourceReview
          call={call}
          onClose={() => setSourceReview(false)}
          onRefresh={setCall}
          onSave={(value) => {
            setCall(value);
            setSourceReview(false);
          }}
        />
      )}
      {!!call.sourceReviews?.length && (
        <section className="panel source-status">
          <h2>Transcript review history</h2>
          {call.sourceReviews.map((entry) => (
            <div key={entry.id} className="audit-row">
              <strong>Source revision {entry.sourceRevision}</strong>
              <p>{entry.reason}</p>
              <span>
                {entry.changes.length} speaker change(s) · Completeness{" "}
                {entry.completenessVerified ? "verified" : "unverified"} ·
                Quality {entry.qualityVerified ? "verified" : "unverified"}
              </span>
            </div>
          ))}
        </section>
      )}
      {deleting && (
        <ConfirmDelete
          label="Delete this conversation?"
          detail="The recording, transcript, analysis and review history will be removed. This action cannot be undone."
          onClose={() => setDeleting(false)}
          onConfirm={remove}
        />
      )}
    </>
  );
}
function Transcript({
  call,
  selected,
  search,
  setSearch,
  seek,
}: {
  call: CallRecord;
  selected: string[];
  search: string;
  setSearch: (v: string) => void;
  seek: (e: Evidence) => void;
}) {
  const filtered = call.segments.filter((x) =>
    x.text.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="transcript">
      <div className="transcript-header">
        <div>
          <h2>Transcript</h2>
          <span>
            {call.mode === "sample"
              ? "Fictional conversation"
              : "Timestamped segments"}{" "}
            · {call.segments.length} segments
          </span>
        </div>
        <MessageSquareText size={18} />
      </div>
      <label className="search-field">
        <Search size={15} />
        <input
          aria-label="Search transcript"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a word or phrase…"
        />
      </label>
      <div className="transcript-segments">
        {filtered.map((segment) => (
          <button
            id={segment.id}
            key={segment.id}
            className={`transcript-segment ${selected.includes(segment.id) ? "highlighted" : ""}`}
            onClick={() =>
              seek({ segmentIds: [segment.id], quote: segment.text })
            }
          >
            <div>
              <strong>{purposeLabel(segment.speaker)}</strong>
              <span>{time(segment.startMs)}</span>
            </div>
            <p>{segment.text}</p>
          </button>
        ))}
        {!filtered.length && (
          <p className="empty-state compact">
            No matching transcript segments.
          </p>
        )}
      </div>
      <div className="transcript-footer">
        <ShieldCheck size={13} />
        Evidence stays with the conversation.
      </div>
    </div>
  );
}
function ReviewDialog({
  call: initialCall,
  item,
  onClose,
  onSave,
  onRefresh,
}: {
  call: CallRecord;
  item: Assessment;
  onClose: () => void;
  onSave: (c: CallRecord) => void;
  onRefresh: (c: CallRecord) => void;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    [status, setStatus] = useState(
      item.status === "policy_award" ? "passed" : item.status,
    ),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [call, setReviewedCall] = useState(initialCall),
    [latest, setLatest] = useState<CallRecord | null>(null),
    [evidenceIds, setEvidenceIds] = useState(item.evidence.segmentIds);
  const selectedSegments = call.segments.filter((segment) =>
    evidenceIds.includes(segment.id),
  );
  const selectedQuote = selectedSegments
    .map((segment) => segment.text)
    .join(" ");
  useEffect(() => {
    returnFocus.current ??= document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      returnFocus.current?.focus();
    };
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { call: updated } = await api<{ call: CallRecord }>(
        `/api/calls/${call.id}/review`,
        {
          method: "POST",
          body: JSON.stringify({
            version: call.version,
            checkpointId: item.id,
            status,
            reason,
            evidence: {
              segmentIds: selectedSegments.map((segment) => segment.id),
              quote: selectedQuote,
            },
          }),
        },
      );
      onSave(updated);
    } catch (e) {
      setError(errorText(e));
      if (
        e instanceof Error &&
        ["STALE_REVIEW", "STALE_ANALYSIS", "PROCESSING_ACTIVE"].includes(
          e.message,
        )
      ) {
        try {
          const result = await api<{ call: CallRecord }>(
            `/api/calls/${call.id}`,
          );
          setLatest(result.call);
          onRefresh(result.call);
        } catch {
          setError(
            "The latest conversation could not be reached. Close this review and try again.",
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
      className="modal review-modal"
      aria-labelledby="review-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="modal-head">
        <div>
          <span className="eyebrow">EVIDENCE-BASED REVIEW</span>
          <h2 id="review-title">Review checkpoint</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close review"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <p className="review-checkpoint-name">
        {
          RUBRICS[call.analysis?.purpose as "sales"]?.find(
            (x) => x.id === item.id,
          )?.label
        }
      </p>
      <blockquote className="review-quote">
        {selectedQuote ||
          "No quoted evidence is available for this checkpoint."}
      </blockquote>
      <form onSubmit={save}>
        <fieldset className="evidence-picker" disabled={busy}>
          <legend>Transcript evidence for this decision</legend>
          {call.segments.map((segment) => (
            <label className="evidence-choice" key={segment.id}>
              <input
                type="checkbox"
                checked={evidenceIds.includes(segment.id)}
                onChange={(event) =>
                  setEvidenceIds(
                    event.target.checked
                      ? [...evidenceIds, segment.id]
                      : evidenceIds.filter((id) => id !== segment.id),
                  )
                }
              />
              <span>
                {time(segment.startMs)} · {purposeLabel(segment.speaker)} —{" "}
                {segment.text}
              </span>
            </label>
          ))}
        </fieldset>
        <label>
          Checkpoint decision
          <select
            disabled={busy}
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="passed">Passed</option>
            <option value="missed">Missed</option>
            <option value="unknown">Unknown</option>
            <option value="not_applicable">Applicability unresolved</option>
          </select>
        </label>
        <label>
          Reason for this decision
          <textarea
            disabled={busy}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minLength={10}
            maxLength={800}
            required
            rows={3}
            placeholder="Explain what the evidence establishes…"
          />
        </label>
        <p className="fine">
          The original assessment is preserved. Unknown or unresolved
          applicability withholds a final grade.
        </p>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        {latest && (
          <div className="notice">
            <p>
              Your reason draft is preserved. Refresh and inspect the current
              source before saving.
            </p>
            <button
              type="button"
              className="button"
              onClick={() => {
                setReviewedCall(latest);
                setEvidenceIds([]);
                setLatest(null);
                setError("");
              }}
            >
              Refresh checkpoint review
            </button>
          </div>
        )}
        <div className="modal-actions">
          <button
            className="button"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={
              busy ||
              !!latest ||
              activeProcessing(call) ||
              !analysisCurrent(call) ||
              reason.trim().length < 10 ||
              selectedQuote.length > 2000
            }
          >
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Save size={16} />
            )}
            Save review
          </button>
        </div>
      </form>
    </dialog>
  );
}
export function ConfirmDelete({
  label,
  detail,
  onClose,
  onConfirm,
}: {
  label: string;
  detail: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal delete-modal"
      aria-labelledby="delete-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id="delete-title">{label}</h2>
        <button
          className="icon-button"
          aria-label="Close deletion"
          onClick={onClose}
          disabled={busy}
        >
          <X size={20} />
        </button>
      </div>
      <p className="muted">{detail}</p>
      <label>
        Type DELETE to confirm
        <input
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="off"
        />
      </label>
      <div className="modal-actions">
        <button className="button" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          className="button destructive"
          disabled={confirmation !== "DELETE" || busy}
          onClick={async () => {
            setBusy(true);
            await onConfirm();
            setBusy(false);
          }}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Trash2 size={16} />
          )}
          Delete data
        </button>
      </div>
    </dialog>
  );
}
