import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageShell } from "../components/SiteHeader";
import Segmented from "../components/Segmented";
import {
  feedbackProblem,
  MAX_MESSAGE,
  sendFeedback,
  type FeedbackKind,
  type SendResult,
} from "../lib/feedback";
import { playTap } from "../lib/sound";

const KINDS: { key: FeedbackKind; label: string; value: FeedbackKind }[] = [
  { key: "bug", label: "Something's broken", value: "bug" },
  { key: "uncomfortable", label: "Something felt wrong", value: "uncomfortable" },
  { key: "idea", label: "An idea", value: "idea" },
];

const PROMPT: Record<FeedbackKind, { label: string; placeholder: string }> = {
  bug: {
    label: "What happened, and where?",
    placeholder: "I typed Peru in Five clues and nothing happened.",
  },
  uncomfortable: {
    label: "What felt wrong?",
    placeholder: "The red flash on a wrong answer is hard to look at.",
  },
  idea: {
    label: "What would you add or change?",
    placeholder: "A daily for capitals.",
  },
};

const NOT_SENT: Record<Exclude<SendResult, "sent">, string> = {
  offline: "Feedback can't be sent from this copy of the game.",
  busy: "Lots of messages just now. Try again in a few minutes.",
  failed: "Couldn't send it. Check your connection and try again.",
};

/**
 * Bugs, things that felt wrong, and ideas, straight into a table Sara reads.
 * No account needed: the people most likely to hit a bug on the first visit
 * are the ones who haven't made one.
 */
export default function Feedback() {
  const [params] = useSearchParams();
  // The page they were on, for a bug report: passed by the footer link.
  const from = params.get("from") ?? "";
  const [kind, setKind] = useState<FeedbackKind>(
    (KINDS.find((k) => k.key === params.get("kind"))?.value as FeedbackKind) ?? "bug"
  );
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"idle" | "sending" | SendResult>("idle");
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const draft = { kind, message, contact, page: from };
    const issue = feedbackProblem(draft);
    setProblem(issue);
    if (issue || state === "sending") return;
    playTap();
    setState("sending");
    setState(await sendFeedback(draft));
  };

  if (state === "sent") {
    return (
      <PageShell>
        <div className="mx-auto mt-10 max-w-md text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-300">Sent</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
            Thank you. Sara reads every one.
          </h1>
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => {
                playTap();
                setMessage("");
                setState("idle");
              }}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-200 transition-colors hover:bg-white/10"
            >
              Send another
            </button>
            <Link
              to={from.startsWith("/") ? from : "/"}
              onClick={playTap}
              className="rounded-lg bg-teal-300 px-4 py-2 text-sm font-semibold text-teal-950 transition-colors hover:bg-teal-200"
            >
              Back to the game →
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const prompt = PROMPT[kind];
  return (
    <PageShell>
      <div className="mx-auto mt-5 max-w-lg">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Feedback</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Found a bug, hit something that felt off, or thought of something to add? Sara reads
          every message.
        </p>

        <form
          onSubmit={submit}
          className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
        >
          <Segmented label="It's about" options={KINDS} value={kind} onChange={setKind} />
          <div className="border-t border-white/[0.07] px-4 py-3.5">
            <label
              htmlFor="feedback-message"
              className="text-xs font-medium uppercase tracking-wider text-zinc-400"
            >
              {prompt.label}
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setProblem(null);
              }}
              placeholder={prompt.placeholder}
              rows={6}
              maxLength={MAX_MESSAGE}
              autoFocus
              className="mt-2 w-full resize-y rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/40"
            />
            <p className="mt-1 text-right text-[11px] tabular-nums text-zinc-600">
              {message.length.toLocaleString()} / {MAX_MESSAGE.toLocaleString()}
            </p>
          </div>
          <div className="border-t border-white/[0.07] px-4 py-3.5">
            <label
              htmlFor="feedback-contact"
              className="text-xs font-medium uppercase tracking-wider text-zinc-400"
            >
              Your email, if you'd like a reply
            </label>
            <input
              id="feedback-contact"
              type="email"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              autoComplete="email"
              placeholder="Optional"
              className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/40"
            />
          </div>
          <div className="flex items-center gap-3 border-t border-white/[0.07] px-4 py-3.5">
            <p role="status" className="min-w-0 flex-1 text-xs text-rose-300">
              {problem ?? (state !== "idle" && state !== "sending" ? NOT_SENT[state] : "")}
            </p>
            <button
              type="submit"
              disabled={state === "sending"}
              className="shrink-0 rounded-lg bg-teal-300 px-5 py-2 text-sm font-semibold text-teal-950 transition-colors hover:bg-teal-200 disabled:opacity-60"
            >
              {state === "sending" ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
        <p className="mt-3 text-xs text-zinc-600">
          Sent with the page you came from and your browser type, so a bug can be found.{" "}
          <Link to="/privacy" className="underline underline-offset-2 hover:text-zinc-400">
            Privacy
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
