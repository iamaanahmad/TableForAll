import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

type ExtractedReply = {
  time: string[];
  area: string[];
  budget: string[];
  food: string[];
  safety: string[];
};

type PlanView = {
  plan: { _id: Id<"plans">; title: string; city: string };
  guests: Array<{ _id: Id<"guests">; name: string; email: string; repliedAt?: number }>;
  venues: Array<{
    _id: Id<"venues">;
    name: string;
    neighborhood: string;
    url: string;
    votes: number;
    excluded: boolean;
  }>;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function responseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as { output_text?: unknown; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (typeof record.output_text === "string") return record.output_text;
  for (const item of record.output ?? []) {
    const text = item.content?.find((content) => content.type === "output_text")?.text;
    if (text) return text;
  }
  return null;
}

async function extractReply(message: string) {
  const apiKey = requiredEnv("OPENAI_API_KEY");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      store: false,
      instructions: "Extract only explicit dinner constraints. Keep safety needs separate. Do not infer allergy guarantees.",
      input: message,
      text: {
        format: {
          type: "json_schema",
          name: "dinner_constraints",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["time", "area", "budget", "food", "safety"],
            properties: {
              time: { type: "array", items: { type: "string" } },
              area: { type: "array", items: { type: "string" } },
              budget: { type: "array", items: { type: "string" } },
              food: { type: "array", items: { type: "string" } },
              safety: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed with ${response.status}`);
  const payload = (await response.json()) as { id?: string };
  const text = responseText(payload);
  if (!text) throw new Error("OpenAI returned no structured output");
  return { responseId: payload.id ?? "openai-response", extracted: JSON.parse(text) as ExtractedReply };
}

async function applyReply(
  ctx: ActionCtx,
  guestEmail: string,
  message: string,
  messageId?: string,
) {
  const { responseId, extracted } = await extractReply(message);
  await ctx.runMutation(internal.plans.applyGuestReply, {
    guestEmail,
    message,
    messageId,
    extracted,
    responseId,
    providerStatus: "succeeded",
    providerDetail: `${extracted.safety.length + extracted.food.length} food and safety constraints extracted`,
  });
  return { responseId, extracted };
}

async function verifyAgentMailAccount() {
  const apiKey = requiredEnv("AGENTMAIL_API_KEY");
  const response = await fetch("https://api.agentmail.to/v0/auth/me", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) throw new Error(`AgentMail account check failed with ${response.status}`);
  const payload = (await response.json()) as {
    inbox_id?: string;
    pod_id?: string;
    organization_id?: string;
  };
  return payload.inbox_id ?? payload.pod_id ?? payload.organization_id ?? "agentmail-account";
}

export const processMarkedTestReply = action({
  args: {},
  handler: async (ctx) => {
    const inboxId = await verifyAgentMailAccount();
    const plan = (await ctx.runQuery(api.plans.getDemoPlan, {})) as PlanView | null;
    if (!plan) throw new Error("Demo plan is not initialized");
    await ctx.runMutation(internal.plans.recordAgentMailConnection, {
      planId: plan.plan._id,
      inboxId,
    });
    const message = "Friday after 7 works. One important thing: I have a severe nut allergy.";
    try {
      return await applyReply(ctx, "maya.tableforall@example.test", message, "marked-test-reply");
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "OpenAI request failed";
      if (!detail.includes("OpenAI request failed with 429")) throw cause;
      const extracted: ExtractedReply = {
        time: ["Friday after 7"],
        area: [],
        budget: [],
        food: [],
        safety: ["Severe nut allergy"],
      };
      await ctx.runMutation(internal.plans.applyGuestReply, {
        guestEmail: "maya.tableforall@example.test",
        message,
        messageId: "marked-test-reply",
        extracted,
        responseId: "openai-quota-fallback",
        providerStatus: "failed",
        providerDetail: "OpenAI returned 429. The marked demo reply used the local safety fallback.",
      });
      return { responseId: "openai-quota-fallback", extracted, fallback: true };
    }
  },
});

export const syncLatestAgentMailReply = action({
  args: {},
  handler: async (ctx) => {
    const apiKey = requiredEnv("AGENTMAIL_API_KEY");
    const inboxId = requiredEnv("AGENTMAIL_INBOX_ID");
    const plan = (await ctx.runQuery(api.plans.getDemoPlan, {})) as PlanView | null;
    if (!plan) throw new Error("Demo plan is not initialized");
    const listResponse = await fetch(
      `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages?limit=20`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!listResponse.ok) throw new Error(`AgentMail list failed with ${listResponse.status}`);
    const list = (await listResponse.json()) as {
      messages?: Array<{ message_id?: string; from?: string; labels?: string[]; subject?: string }>;
    };
    const candidate = (list.messages ?? []).find((message) => {
      const sender = message.from?.toLowerCase() ?? "";
      return message.labels?.includes("received") && plan.guests.some((guest) => sender.includes(guest.email.toLowerCase()));
    });
    if (!candidate?.message_id || !candidate.from) throw new Error("No unread marked guest reply was found");
    const sender = plan.guests.find((guest) => candidate.from?.toLowerCase().includes(guest.email.toLowerCase()));
    if (!sender) throw new Error("The newest reply is not from a marked test guest");
    const messageResponse = await fetch(
      `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages/${encodeURIComponent(candidate.message_id)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!messageResponse.ok) throw new Error(`AgentMail message fetch failed with ${messageResponse.status}`);
    const message = (await messageResponse.json()) as { extracted_text?: string; text?: string };
    const body = message.extracted_text || message.text;
    if (!body) throw new Error("The AgentMail reply has no readable text body");
    await ctx.runMutation(internal.plans.recordAgentMailInbound, {
      planId: plan.plan._id,
      messageId: candidate.message_id,
      guestEmail: sender.email,
    });
    return applyReply(ctx, sender.email, body, candidate.message_id);
  },
});

export const researchAllVenues = action({
  args: {},
  handler: async (ctx) => {
    const apiKey = requiredEnv("FIRECRAWL_API_KEY");
    const plan = (await ctx.runQuery(api.plans.getDemoPlan, {})) as PlanView | null;
    if (!plan) throw new Error("Demo plan is not initialized");
    const checked: string[] = [];
    for (const venue of plan.venues) {
      const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: venue.url, formats: ["markdown"], onlyMainContent: true, maxAge: 86_400_000 }),
      });
      if (!response.ok) throw new Error(`Firecrawl failed for ${venue.name} with ${response.status}`);
      const payload = (await response.json()) as {
        data?: { markdown?: string; metadata?: { title?: string; sourceURL?: string; scrapeId?: string } };
      };
      const markdown = payload.data?.markdown?.replace(/\s+/g, " ").trim();
      if (!markdown) throw new Error(`Firecrawl returned no content for ${venue.name}`);
      await ctx.runMutation(internal.plans.saveVenueResearch, {
        venueId: venue._id,
        sourceTitle: payload.data?.metadata?.title || venue.name,
        sourceSnippet: markdown.slice(0, 240),
        externalId: payload.data?.metadata?.scrapeId,
      });
      checked.push(venue.name);
    }
    return { checked };
  },
});

export const sendFinalPlan = action({
  args: {},
  handler: async (ctx) => {
    const inboxId = await verifyAgentMailAccount();
    const plan = (await ctx.runQuery(api.plans.getDemoPlan, {})) as PlanView | null;
    if (!plan) throw new Error("Demo plan is not initialized");
    const winner = [...plan.venues]
      .filter((venue) => !venue.excluded)
      .sort((a, b) => b.votes - a.votes)[0];
    if (!winner) throw new Error("No safe shortlist venue is available");
    const preparationId = `no-send:${inboxId}`;
    await ctx.runMutation(internal.plans.recordFinalPrepared, {
      planId: plan.plan._id,
      preparationId,
      winner: winner.name,
    });
    return { preparationId, winner: winner.name, sent: false };
  },
});
