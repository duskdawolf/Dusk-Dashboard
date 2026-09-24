"use client";

import { FormEvent, useState } from "react";

type ContextType = "global" | "deployment" | "social";

type Action = {
  id: string;
  title: string;
  explanation?: string | null;
  action_type: string;
  status: string;
  requires_reauth: boolean;
  payload: Record<string, unknown>;
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function ChaosCopilot({
  contextType = "global",
  conPrepId,
  postId,
  compact = false,
}: {
  contextType?: ContextType;
  conPrepId?: string | null;
  postId?: string | null;
  compact?: boolean;
}) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [reauthActionId, setReauthActionId] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  async function send(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || busy) return;

    setMessages((current) => [...current, { role: "user", content: message }]);
    setInput("");
    setBusy(true);
    setStatus("Chaos Copilot is thinking...");

    const response = await fetch("/api/admin/copilot/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        contextType,
        conPrepId: conPrepId ?? null,
        postId: postId ?? null,
        threadId,
      }),
    });

    const body = await response.json();
    setBusy(false);

    if (!response.ok) {
      setStatus(body.error ?? "Chaos Copilot failed.");
      return;
    }

    setThreadId(body.threadId);
    setMessages((current) => [
      ...current,
      { role: "assistant", content: body.message },
    ]);
    setActions((current) => [
      ...current,
      ...(body.actions ?? []).filter(
        (candidate: Action) =>
          !current.some((action) => action.id === candidate.id),
      ),
    ]);
    setStatus("");
  }

  async function decision(
    action: Action,
    decision: "approve" | "reject",
    grant?: string,
  ) {
    setStatus(
      decision === "approve"
        ? "Applying approved action..."
        : "Rejecting proposal...",
    );

    const response = await fetch(
      `/api/admin/copilot/actions/${action.id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(grant
            ? { "X-Chaos-Reauth-Grant": grant }
            : {}),
        },
        body: JSON.stringify({ decision }),
      },
    );

    const body = await response.json();

    if (response.status === 428) {
      setReauthActionId(action.id);
      setStatus(
        "Fresh Supabase reauthentication is required for this sensitive action.",
      );
      return;
    }

    if (!response.ok) {
      setStatus(body.error ?? "Could not apply proposal.");
      return;
    }

    setActions((current) =>
      current.map((item) =>
        item.id === action.id
          ? {
              ...item,
              status:
                decision === "approve"
                  ? "completed"
                  : "rejected",
            }
          : item,
      ),
    );
    setStatus(
      decision === "approve"
        ? "Action applied."
        : "Proposal rejected.",
    );
  }

  async function reauthenticate(event: FormEvent) {
    event.preventDefault();
    if (!reauthActionId || !password) return;

    setStatus("Reauthenticating with Supabase...");

    const response = await fetch("/api/admin/copilot/reauth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password,
        purpose: `copilot-action:${reauthActionId}`,
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      setStatus(body.error ?? "Reauthentication failed.");
      return;
    }

    const action = actions.find(
      (candidate) => candidate.id === reauthActionId,
    );

    setPassword("");
    setReauthActionId(null);

    if (action) {
      await decision(action, "approve", body.grant);
    }
  }

  return (
    <section
      className={`overflow-hidden rounded-3xl border border-dusk-aqua/25 bg-[radial-gradient(circle_at_top_right,rgba(97,232,255,.09),transparent_40%),rgba(7,15,26,.96)] ${
        compact ? "p-4" : "p-5 sm:p-6"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">AI operations layer</div>
          <h2 className={`${compact ? "text-xl" : "text-3xl"} font-black`}>
            CHAOS COPILOT™
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {contextType === "deployment"
              ? "Scoped to this Tactical Deployment."
              : contextType === "social"
                ? "Scoped to Social Ops."
                : "Global Dusk operations context."}
          </p>
        </div>
        <span className="tag !mt-0">
          proposals require approval
        </span>
      </div>

      {messages.length ? (
        <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-2xl border p-3 text-sm ${
                message.role === "user"
                  ? "ml-6 border-white/10 bg-white/[0.04]"
                  : "mr-6 border-dusk-aqua/15 bg-dusk-aqua/5"
              }`}
            >
              <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                {message.role === "user" ? "You" : "Chaos Copilot"}
              </div>
              <div className="whitespace-pre-wrap text-slate-200">
                {message.content}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-sm text-slate-400">
          {contextType === "deployment"
            ? "Try: “Build my packing list,” “What am I missing?”, or “Break Donk Toss Kit into a detailed checklist.”"
            : contextType === "social"
              ? "Try: “Rewrite this for each platform” or “What should I schedule next based on the data we actually have?”"
              : "Try: “What’s my biggest operational problem right now?”"}
        </div>
      )}

      {actions.filter((action) => action.status === "proposed").length ? (
        <div className="mt-4 space-y-3">
          <div className="eyebrow">Proposed actions</div>
          {actions
            .filter((action) => action.status === "proposed")
            .map((action) => (
              <div
                key={action.id}
                className="rounded-2xl border border-dusk-gold/20 bg-dusk-gold/5 p-4"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <strong className="block">{action.title}</strong>
                    {action.explanation ? (
                      <p className="mt-1 text-xs text-slate-400">
                        {action.explanation}
                      </p>
                    ) : null}
                  </div>
                  {action.requires_reauth ? (
                    <span className="rounded-full border border-dusk-pink/30 px-2 py-1 text-[9px] font-black uppercase text-dusk-pink">
                      reauth required
                    </span>
                  ) : null}
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-black text-slate-500">
                    Inspect payload
                  </summary>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-black/25 p-3 text-[10px] text-slate-500">
                    {JSON.stringify(action.payload, null, 2)}
                  </pre>
                </details>

                <div className="mt-3 flex gap-2">
                  <button
                    className="button-primary"
                    type="button"
                    onClick={() => decision(action, "approve")}
                  >
                    {action.requires_reauth
                      ? "Approve + reauthenticate"
                      : "Apply"}
                  </button>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => decision(action, "reject")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
        </div>
      ) : null}

      {reauthActionId ? (
        <form
          className="mt-4 rounded-2xl border border-dusk-pink/30 bg-dusk-pink/5 p-4"
          onSubmit={reauthenticate}
        >
          <div className="eyebrow">Sensitive action confirmation</div>
          <p className="mt-1 text-sm text-slate-300">
            Re-enter the current Supabase account password. A one-use,
            ten-minute grant is created and consumed for this action only.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className="form-input flex-1"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Current password"
              autoComplete="current-password"
            />
            <button className="button-primary" type="submit">
              Reauthenticate
            </button>
            <button
              className="button-secondary"
              type="button"
              onClick={() => {
                setReauthActionId(null);
                setPassword("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <form className="mt-4" onSubmit={send}>
        <textarea
          className="form-input min-h-24 resize-y"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Tell Chaos Copilot what you need..."
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            AI changes are staged as proposals. Sensitive actions require
            explicit approval + Supabase reauthentication.
          </p>
          <button
            className="button-primary"
            type="submit"
            disabled={busy || !input.trim()}
          >
            {busy ? "Thinking..." : "Send to Chaos"}
          </button>
        </div>
      </form>

      {status ? (
        <p className="mt-3 text-sm text-slate-400">{status}</p>
      ) : null}
    </section>
  );
}
