"use client";
import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Phone,
  Plus,
} from "lucide-react";
import { CallRows, useCalls } from "@/components/call-list";
import { useWorkspace } from "@/components/workspace-shell";
import { analysisCurrent } from "@/lib/domain/source-review";
export default function Overview() {
  const { calls, loading, error } = useCalls(),
    { session, openUpload } = useWorkspace();
  const analyzed = calls.filter(analysisCurrent),
    review = calls.filter((x) =>
      ["needs_review", "privacy_review"].includes(x.status),
    ),
    processing = calls.filter((x) =>
      ["queued", "transcribing", "analyzing"].includes(x.status),
    );
  const metrics = [
    {
      label: "Analyzed calls",
      value: analyzed.length,
      note: `${calls.length} total · ${processing.length} processing`,
      icon: AudioLines,
      href: "/calls",
    },
    {
      label: "Inspections booked",
      value: analyzed.filter(
        (x) => x.analysis?.outcomes.inspectionBooked.value === true,
      ).length,
      note: "Inspection commitments",
      icon: CalendarCheck2,
      href: "/calls?outcome=inspectionBooked",
    },
    {
      label: "Treatments accepted",
      value: analyzed.filter(
        (x) => x.analysis?.outcomes.treatmentAccepted.value === true,
      ).length,
      note: "Separate from signed or paid",
      icon: CheckCircle2,
      href: "/calls?outcome=treatmentAccepted",
    },
    {
      label: "Needs review",
      value: review.length,
      note: "Unresolved assessments",
      icon: ClipboardCheck,
      href: "/review",
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A CLEARER VIEW OF YOUR CONVERSATIONS</span>
          <h1>Good conversations start with listening.</h1>
          <p>See what happened, what went well, and where to focus next.</p>
        </div>
        <span className="scope-label">
          {session.identity.mode === "sample"
            ? "Fictional sample calls"
            : "All available calls"}
        </span>
      </div>
      <div className="metrics">
        {metrics.map(({ label, value, note, icon: Icon, href }) => (
          <Link className="metric" href={href} key={label}>
            <div className="metric-top">
              <span>{label}</span>
              <Icon size={19} />
            </div>
            <strong>{loading ? "—" : value}</strong>
            <div>
              <span>{note}</span>
              <ArrowRight size={14} />
            </div>
          </Link>
        ))}
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div className="overview-middle">
        <section className="panel attention-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">WORTH A CLOSER LOOK</span>
              <h2>Your review focus</h2>
            </div>
            <Link className="text-link" href="/review">
              View queue
              <ArrowRight size={15} />
            </Link>
          </div>
          {review.length ? (
            <div className="attention-list">
              {review.slice(0, 3).map((call) => (
                <Link
                  className="attention-item"
                  key={call.id}
                  href={`/calls/${call.id}?tab=scorecard&back=/review`}
                >
                  <span className="attention-marker" />
                  <div>
                    <strong>{call.analysis?.title || call.label}</strong>
                    <p>
                      {call.analysis?.reviewReasons[0]
                        ?.replace("Checkpoint needs review: ", "Confirm ")
                        .replaceAll("_", " ") ||
                        "Privacy needs a manual check."}
                    </p>
                  </div>
                  <ArrowRight size={16} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="attention-empty">
              <CheckCircle2 size={28} />
              <h3>Nothing waiting on you.</h3>
              <p>
                Unclear evidence and incomplete scorecards will appear here.
              </p>
            </div>
          )}
        </section>
        <section className="getting-started">
          <span className="small-icon">
            <AudioLines size={24} />
          </span>
          <span className="eyebrow">FROM CONVERSATION TO CLARITY</span>
          <h2>
            The whole story.
            <br />
            One workspace.
          </h2>
          <p>
            Move from the outcome to the scorecard, then jump straight to the
            words behind it.
          </p>
          <button className="button" onClick={openUpload}>
            <Plus size={16} />
            {session.identity.mode === "sample"
              ? "Explore a fictional call"
              : "Add a recording"}
          </button>
        </section>
      </div>
      <section className="panel recent-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE LATEST IN YOUR WORKSPACE</span>
            <h2>Recent conversations</h2>
          </div>
          <Link className="text-link" href="/calls">
            View all calls
            <ArrowRight size={15} />
          </Link>
        </div>
        {loading ? (
          <div className="empty-state">Loading conversations…</div>
        ) : calls.length ? (
          <CallRows calls={calls.slice(0, 5)} />
        ) : (
          <div className="empty-state compact">
            <Phone size={25} />
            <h3>No calls yet</h3>
            <p>Add your first conversation to start reviewing.</p>
          </div>
        )}
      </section>
      <p className="page-footnote">
        Counts describe calls, not unique customers or verified account actions.
      </p>
    </>
  );
}
