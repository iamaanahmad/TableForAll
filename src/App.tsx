import { useEffect, useMemo, useState } from "react";
import { ConvexProvider, ConvexReactClient, useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  Check,
  CircleAlert,
  ExternalLink,
  Mail,
  RefreshCw,
  Send,
  Sparkles,
  Users,
  Vote,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { applyPreviewReply, castPreviewVote, confirmPreviewPlan, createPreviewPlan } from "./preview";
import type { PlanSnapshot } from "./types";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

type AsyncAction = "reply" | "research" | "final" | "vote" | null;

type RawPlan = {
  plan: { _id: Id<"plans">; title: string; city: string; status: "collecting" | "voting" | "confirmed"; finalMessageId?: string };
  guests: Array<{ _id: Id<"guests">; name: string; email: string; reply?: string; repliedAt?: number }>;
  constraints: Array<{ _id: Id<"constraints">; kind: "time" | "area" | "budget" | "food" | "safety"; value: string }>;
  venues: Array<{
    _id: Id<"venues">;
    name: string;
    url: string;
    neighborhood: string;
    cuisine: string;
    priceBand: string;
    sourceCheckedAt?: number;
    sourceTitle?: string;
    sourceSnippet?: string;
    fitNotes: string[];
    allergenRisk?: string;
    excluded: boolean;
    votes: number;
  }>;
  events: Array<{
    _id: Id<"integrationEvents">;
    provider: "openai" | "firecrawl" | "agentmail";
    kind: string;
    detail: string;
    status: "succeeded" | "failed";
    createdAt: number;
  }>;
};

function adaptConnectedPlan(raw: RawPlan): PlanSnapshot {
  return {
    mode: "connected",
    plan: {
      id: raw.plan._id,
      title: raw.plan.title,
      city: raw.plan.city,
      status: raw.plan.status,
      finalMessageId: raw.plan.finalMessageId,
    },
    guests: raw.guests.map((guest) => ({ ...guest, id: guest._id })),
    constraints: raw.constraints.map((constraint) => ({ ...constraint, id: constraint._id })),
    venues: raw.venues.map((venue) => ({ ...venue, id: venue._id })),
    events: raw.events.map((event) => ({ ...event, id: event._id })),
  };
}

function ConnectedApp() {
  const ensureDemoPlan = useMutation(api.plans.ensureDemoPlan);
  const castVote = useMutation(api.plans.castVote);
  const syncReply = useAction(api.integrations.processMarkedTestReply);
  const researchVenues = useAction(api.integrations.researchAllVenues);
  const sendFinal = useAction(api.integrations.sendFinalPlan);
  const raw = useQuery(api.plans.getDemoPlan, {}) as RawPlan | null | undefined;
  const [busy, setBusy] = useState<AsyncAction>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void ensureDemoPlan().catch((cause: unknown) => setError(errorMessage(cause)));
  }, [ensureDemoPlan]);

  if (!raw) return <LoadingShell error={error} />;
  const snapshot = adaptConnectedPlan(raw);

  async function run(action: Exclude<AsyncAction, "vote" | null>, operation: () => Promise<unknown>) {
    setBusy(action);
    setError(null);
    try {
      await operation();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dashboard
      snapshot={snapshot}
      busy={busy}
      error={error}
      onReply={() => run("reply", syncReply)}
      onResearch={() => run("research", researchVenues)}
      onVote={async (venueId) => {
        setBusy("vote");
        setError(null);
        try {
          await castVote({ venueId: venueId as Id<"venues"> });
        } catch (cause) {
          setError(errorMessage(cause));
        } finally {
          setBusy(null);
        }
      }}
      onFinal={() => run("final", sendFinal)}
    />
  );
}

function PreviewApp() {
  const [snapshot, setSnapshot] = useState(createPreviewPlan);
  const [busy, setBusy] = useState<AsyncAction>(null);

  async function preview(action: Exclude<AsyncAction, "vote" | null>, update: () => void) {
    setBusy(action);
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    update();
    setBusy(null);
  }

  return (
    <Dashboard
      snapshot={snapshot}
      busy={busy}
      error={null}
      onReply={() => preview("reply", () => setSnapshot(applyPreviewReply))}
      onResearch={() => preview("research", () => setSnapshot((current) => ({
        ...current,
        events: [{ id: "preview-research", provider: "preview", kind: "research.previewed", detail: "Three cited venue sources shown in preview", createdAt: Date.now() }, ...current.events],
      })))}
      onVote={async (venueId) => setSnapshot((current) => castPreviewVote(current, venueId))}
      onFinal={() => preview("final", () => setSnapshot(confirmPreviewPlan))}
    />
  );
}

function Dashboard({
  snapshot,
  busy,
  error,
  onReply,
  onResearch,
  onVote,
  onFinal,
}: {
  snapshot: PlanSnapshot;
  busy: AsyncAction;
  error: string | null;
  onReply: () => Promise<void>;
  onResearch: () => Promise<void>;
  onVote: (venueId: string) => Promise<void>;
  onFinal: () => Promise<void>;
}) {
  const maya = snapshot.guests.find((guest) => guest.name === "Maya");
  const replyProcessed = Boolean(maya?.repliedAt);
  const replied = snapshot.guests.filter((guest) => guest.repliedAt).length;
  const ranked = useMemo(
    () => [...snapshot.venues].sort((a, b) => Number(a.excluded) - Number(b.excluded) || b.votes - a.votes),
    [snapshot.venues],
  );
  const winner = ranked.find((venue) => !venue.excluded);
  const firecrawlChecks = snapshot.venues.filter((venue) => venue.sourceCheckedAt).length;
  const providerState = (provider: "openai" | "firecrawl" | "agentmail") => {
    const event = snapshot.events.find((item) => item.provider === provider);
    return event?.status === "failed" ? "failed" : event ? "verified" : "ready";
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="TableForAll home">
          <span className="brand-mark"><span /><span /><span /></span>
          <span>TableForAll</span>
        </a>
        <div className={snapshot.mode === "connected" ? "live-status connected" : "live-status"}>
          <span className="pulse" /> {snapshot.mode === "connected" ? "Convex connected" : "Interactive preview"}
        </div>
        <span className="avatar" aria-label="Plan host">SA</span>
      </header>

      <main id="top">
        <section className="plan-hero">
          <div>
            <p className="eyebrow">Friday dinner · Brooklyn</p>
            <h1>One table everyone can say yes to.</h1>
            <p className="hero-copy">Email replies become one cited shortlist. Guests install nothing.</p>
          </div>
          <div className="hero-action">
            {replyProcessed ? (
              <span className="reply-complete"><Check size={17} /> Maya's safety need is in the plan</span>
            ) : (
              <>
                <span className="mail-label"><Mail size={16} /> 1 guest reply ready</span>
                <button className="primary-button" onClick={() => void onReply()} disabled={busy !== null}>
                  {busy === "reply" ? <><RefreshCw className="spin" size={17} /> Reading reply</> : <>Sync guest reply <ArrowRight size={18} /></>}
                </button>
              </>
            )}
          </div>
        </section>

        {snapshot.mode === "preview" && (
          <p className="preview-banner"><CircleAlert size={15} /> Preview data only. No sponsor call or email runs without configured keys.</p>
        )}
        {error && <p className="error-banner" role="alert"><CircleAlert size={15} /> {error}</p>}

        <section className="constraint-strip" aria-label="Dinner plan constraints">
          <div className="progress-copy"><span className="progress-number">{replied}/6</span><span>guests replied</span></div>
          <div className="constraint-list">
            {snapshot.constraints.map((constraint) => (
              <span className={constraint.kind === "safety" ? "constraint alert" : "constraint"} key={constraint.id}>
                {constraint.kind === "safety" && <CircleAlert size={14} />}{constraint.value}
              </span>
            ))}
          </div>
        </section>

        <div className="dashboard-grid">
          <section className="panel inbox-panel">
            <div className="panel-heading">
              <div><p className="panel-kicker">AgentMail + OpenAI</p><h2>Guest replies</h2></div>
              <span className="count">{replied} of 6</span>
            </div>
            <div className="reply-list">
              <Reply guest={maya} highlight />
              {snapshot.guests.filter((guest) => guest.name !== "Maya" && guest.repliedAt).slice(0, 2).map((guest) => (
                <Reply guest={guest} key={guest.id} />
              ))}
            </div>
            <div className="provider-ledger" aria-label="Sponsor call status">
              <ProviderStatus name="AgentMail" state={providerState("agentmail")} preview={snapshot.mode === "preview"} />
              <ProviderStatus name="OpenAI" state={providerState("openai")} preview={snapshot.mode === "preview"} />
            </div>
          </section>

          <section className="panel venue-panel">
            <div className="panel-heading">
              <div><p className="panel-kicker">Firecrawl research</p><h2>Live shortlist</h2></div>
              <button className="icon-text-button" onClick={() => void onResearch()} disabled={busy !== null}>
                <RefreshCw className={busy === "research" ? "spin" : ""} size={14} />
                {firecrawlChecks ? `${Math.min(firecrawlChecks, 3)} sources checked` : "Check sources"}
              </button>
            </div>
            <div className="venue-list">
              {ranked.map((venue, index) => (
                <article className={venue.excluded ? "venue excluded" : index === 0 ? "venue recommended" : "venue"} key={venue.id}>
                  <div className="venue-rank">{venue.excluded ? "×" : index + 1}</div>
                  <div className="venue-content">
                    <div className="venue-title-row">
                      <div><h3>{venue.name}</h3><p>{venue.neighborhood} · {venue.priceBand}</p></div>
                      {!venue.excluded && (
                        <button className="vote-button" onClick={() => void onVote(venue.id)} disabled={busy !== null} aria-label={`${venue.votes} votes for ${venue.name}. Cast vote`}>
                          <Vote size={15} /> {venue.votes}
                        </button>
                      )}
                    </div>
                    {venue.excluded ? (
                      <p className="risk-copy"><CircleAlert size={14} /> Removed until allergy safety is confirmed.</p>
                    ) : (
                      <div className="tag-row">{venue.fitNotes.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div>
                    )}
                    <a href={venue.url} target="_blank" rel="noreferrer">
                      {venue.sourceTitle || "Restaurant source"} <ExternalLink size={12} />
                    </a>
                  </div>
                </article>
              ))}
            </div>
            <p className="safety-note">Menu data can change. Confirm allergies directly with the venue.</p>
          </section>

          <aside className="decision-card">
            <p className="panel-kicker">Convex live state</p>
            <h2>{snapshot.plan.status === "confirmed" ? "Dinner confirmed" : "Ready for a vote"}</h2>
            <div className="winner-orbit">
              <div className="winner-icon"><Users size={25} /></div>
              <div><strong>{winner?.name}</strong><span>{winner?.votes ?? 0} votes</span></div>
            </div>
            <div className="decision-stats">
              <div><span>Guests</span><strong>6</strong></div>
              <div><span>Venues</span><strong>{ranked.filter((venue) => !venue.excluded).length}</strong></div>
              <div><span>Replies</span><strong>{replied}</strong></div>
            </div>
            <button className={replyProcessed ? "final-button" : "secondary-button"} onClick={() => void onFinal()} disabled={!replyProcessed || busy !== null || snapshot.plan.status === "confirmed"}>
              {snapshot.plan.status === "confirmed" ? <><Check size={16} /> Final plan ready</> : busy === "final" ? <><RefreshCw className="spin" size={16} /> Preparing</> : <><Send size={16} /> {snapshot.mode === "preview" ? "Preview final message" : "Prepare final plan"}</>}
            </button>
            <p className="demo-note">No email is sent during the public demo.</p>
          </aside>
        </div>

        <footer className="activity-bar">
          <span className="activity-dot" /><strong>Latest</strong>
          <span>{snapshot.events[0]?.detail || "Waiting for the next reply"}</span>
          <span className="activity-time">now</span>
        </footer>
      </main>
    </div>
  );
}

function Reply({ guest, highlight = false }: { guest?: PlanSnapshot["guests"][number]; highlight?: boolean }) {
  const replied = Boolean(guest?.repliedAt);
  return (
    <article className={`reply ${highlight && !replied ? "new" : "processed"}`}>
      <div className={`reply-avatar ${highlight ? "maya" : ""}`}>{guest?.name.slice(0, 1) || "?"}</div>
      <div>
        <div className="reply-meta"><strong>{guest?.name || "Guest"}</strong><span>{replied ? "received" : "waiting"}</span></div>
        <p>{guest?.reply || "Friday after 7 works. One important thing: I have a severe nut allergy."}</p>
        <span className="extraction"><Sparkles size={13} /> {replied ? "Preferences extracted" : "Ready to sync"}</span>
      </div>
    </article>
  );
}

function ProviderStatus({ name, state, preview }: { name: string; state: "ready" | "verified" | "failed"; preview: boolean }) {
  const label = state === "failed" ? "quota blocked" : state === "verified" ? "verified" : preview ? "needs live keys" : "ready";
  return <span className={state === "verified" ? "provider-status ran" : state === "failed" ? "provider-status failed" : "provider-status"}><span />{name}: {label}</span>;
}

function LoadingShell({ error }: { error: string | null }) {
  return <div className="loading-shell"><RefreshCw className="spin" size={22} /><p>{error || "Starting the Convex plan…"}</p></div>;
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "The action did not complete.";
}

export default function App() {
  if (!convexClient) return <PreviewApp />;
  return <ConvexProvider client={convexClient}><ConnectedApp /></ConvexProvider>;
}
