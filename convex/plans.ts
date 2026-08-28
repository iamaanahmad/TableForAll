import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEMO_SLUG = "brooklyn-friday";

const demoGuests = [
  ["Sam", "sam.tableforall@example.test", true],
  ["Jon + Lee", "jon-lee.tableforall@example.test", true],
  ["Amir", "amir.tableforall@example.test", true],
  ["Nora", "nora.tableforall@example.test", true],
  ["Maya", "maya.tableforall@example.test", false],
  ["Demo voter", "voter.tableforall@example.test", false],
] as const;

const demoVenues = [
  {
    name: "Rule of Thirds",
    url: "https://www.thirdsbk.com/",
    neighborhood: "Greenpoint",
    cuisine: "Japanese",
    priceBand: "$$$",
    fitNotes: ["Group tables", "Vegetarian options"],
  },
  {
    name: "Laser Wolf",
    url: "https://www.laserwolfbrooklyn.com/",
    neighborhood: "Williamsburg",
    cuisine: "Israeli grill",
    priceBand: "$$$",
    fitNotes: ["Rooftop", "Shareable plates"],
  },
  {
    name: "Lilia",
    url: "https://www.lilianewyork.com/menus/",
    neighborhood: "Williamsburg",
    cuisine: "Italian",
    priceBand: "$$$",
    fitNotes: ["Vegetarian options", "Lively room"],
    allergenRisk: "The published menu includes several nut dishes.",
  },
] as const;

export const ensureDemoPlan = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("plans").withIndex("by_slug", (q) => q.eq("slug", DEMO_SLUG)).unique();
    if (existing) return existing._id;

    const planId = await ctx.db.insert("plans", {
      slug: DEMO_SLUG,
      title: "Friday dinner in Brooklyn",
      city: "Brooklyn",
      hostEmail: "host.tableforall@example.test",
      status: "collecting",
      createdAt: Date.now(),
    });

    for (const [name, email, replied] of demoGuests) {
      await ctx.db.insert("guests", {
        planId,
        name,
        email,
        reply: replied ? `${name} shared dinner preferences by email.` : undefined,
        repliedAt: replied ? Date.now() - 15 * 60_000 : undefined,
      });
    }

    const seededGuests = await ctx.db.query("guests").withIndex("by_plan", (q) => q.eq("planId", planId)).collect();
    const sam = seededGuests.find((guest) => guest.name === "Sam");
    if (!sam) throw new Error("Demo guest bootstrap failed");
    for (const [kind, value] of [
      ["time", "Friday after 7"],
      ["area", "North Brooklyn"],
      ["budget", "$60 per person"],
      ["food", "Vegetarian friendly"],
    ] as const) {
      await ctx.db.insert("constraints", { planId, guestId: sam._id, kind, value });
    }

    for (const venue of demoVenues) {
      await ctx.db.insert("venues", {
        planId,
        ...venue,
        fitNotes: [...venue.fitNotes],
        requiresConfirmation: true,
        excluded: false,
      });
    }
    return planId;
  },
});

export const getDemoPlan = query({
  args: {},
  handler: async (ctx) => {
    const plan = await ctx.db.query("plans").withIndex("by_slug", (q) => q.eq("slug", DEMO_SLUG)).unique();
    if (!plan) return null;
    const [guests, constraints, venues, votes, events] = await Promise.all([
      ctx.db.query("guests").withIndex("by_plan", (q) => q.eq("planId", plan._id)).collect(),
      ctx.db.query("constraints").withIndex("by_plan", (q) => q.eq("planId", plan._id)).collect(),
      ctx.db.query("venues").withIndex("by_plan", (q) => q.eq("planId", plan._id)).collect(),
      ctx.db.query("votes").withIndex("by_plan", (q) => q.eq("planId", plan._id)).collect(),
      ctx.db.query("integrationEvents").withIndex("by_plan", (q) => q.eq("planId", plan._id)).collect(),
    ]);
    return {
      plan,
      guests,
      constraints,
      venues: venues.map((venue) => ({
        ...venue,
        votes: votes.filter((vote) => vote.venueId === venue._id).length,
      })),
      events: events.sort((a, b) => b.createdAt - a.createdAt).slice(0, 8),
    };
  },
});

export const castVote = mutation({
  args: { venueId: v.id("venues") },
  handler: async (ctx, { venueId }) => {
    const plan = await ctx.db.query("plans").withIndex("by_slug", (q) => q.eq("slug", DEMO_SLUG)).unique();
    if (!plan) throw new Error("Demo plan is not initialized");
    const venue = await ctx.db.get(venueId);
    if (!venue || venue.planId !== plan._id || venue.excluded) throw new Error("This venue is not available for voting");
    const guests = await ctx.db.query("guests").withIndex("by_plan", (q) => q.eq("planId", plan._id)).collect();
    const voter = guests.find((guest) => guest.name === "Demo voter");
    if (!voter) throw new Error("Demo voter is missing");
    const previous = await ctx.db.query("votes").withIndex("by_guest", (q) => q.eq("guestId", voter._id)).first();
    if (previous) await ctx.db.delete(previous._id);
    await ctx.db.insert("votes", { planId: plan._id, guestId: voter._id, venueId, createdAt: Date.now() });
    await ctx.db.patch(plan._id, { status: "voting" });
  },
});

export const applyGuestReply = internalMutation({
  args: {
    guestEmail: v.string(),
    message: v.string(),
    messageId: v.optional(v.string()),
    extracted: v.object({
      time: v.array(v.string()),
      area: v.array(v.string()),
      budget: v.array(v.string()),
      food: v.array(v.string()),
      safety: v.array(v.string()),
    }),
    responseId: v.string(),
    providerStatus: v.union(v.literal("succeeded"), v.literal("failed")),
    providerDetail: v.string(),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db.query("plans").withIndex("by_slug", (q) => q.eq("slug", DEMO_SLUG)).unique();
    if (!plan) throw new Error("Demo plan is not initialized");
    const guest = await ctx.db
      .query("guests")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .filter((q) => q.eq(q.field("email"), args.guestEmail))
      .unique();
    if (!guest) throw new Error("The reply sender is not a guest on this plan");

    const previous = await ctx.db.query("constraints").withIndex("by_plan", (q) => q.eq("planId", plan._id)).collect();
    for (const constraint of previous.filter((item) => item.guestId === guest._id)) await ctx.db.delete(constraint._id);
    for (const kind of ["time", "area", "budget", "food", "safety"] as const) {
      for (const value of args.extracted[kind]) {
        await ctx.db.insert("constraints", {
          planId: plan._id,
          guestId: guest._id,
          kind,
          value,
          sourceMessageId: args.messageId,
        });
      }
    }

    await ctx.db.patch(guest._id, {
      reply: args.message,
      replyMessageId: args.messageId,
      repliedAt: Date.now(),
    });

    const safetyText = args.extracted.safety.join(" ").toLowerCase();
    const hasNutSafetyNeed = safetyText.includes("nut") || safetyText.includes("peanut");
    const venues = await ctx.db.query("venues").withIndex("by_plan", (q) => q.eq("planId", plan._id)).collect();
    for (const venue of venues) {
      await ctx.db.patch(venue._id, { excluded: Boolean(hasNutSafetyNeed && venue.allergenRisk) });
    }

    await ctx.db.insert("integrationEvents", {
      planId: plan._id,
      provider: "openai",
      kind: "reply.extracted",
      externalId: args.responseId,
      detail: args.providerDetail,
      status: args.providerStatus,
      createdAt: Date.now(),
    });
    return plan._id;
  },
});

export const saveVenueResearch = internalMutation({
  args: {
    venueId: v.id("venues"),
    sourceTitle: v.string(),
    sourceSnippet: v.string(),
    externalId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const venue = await ctx.db.get(args.venueId);
    if (!venue) throw new Error("Venue not found");
    await ctx.db.patch(args.venueId, {
      sourceCheckedAt: Date.now(),
      sourceTitle: args.sourceTitle,
      sourceSnippet: args.sourceSnippet,
    });
    await ctx.db.insert("integrationEvents", {
      planId: venue.planId,
      provider: "firecrawl",
      kind: "venue.researched",
      externalId: args.externalId,
      detail: `${venue.name} source refreshed`,
      status: "succeeded",
      createdAt: Date.now(),
    });
  },
});

export const recordAgentMailInbound = internalMutation({
  args: { planId: v.id("plans"), messageId: v.string(), guestEmail: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("integrationEvents", {
      planId: args.planId,
      provider: "agentmail",
      kind: "message.received",
      externalId: args.messageId,
      detail: `Reply received from ${args.guestEmail}`,
      status: "succeeded",
      createdAt: Date.now(),
    });
  },
});

export const recordAgentMailConnection = internalMutation({
  args: { planId: v.id("plans"), inboxId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("integrationEvents", {
      planId: args.planId,
      provider: "agentmail",
      kind: "connection.checked",
      externalId: args.inboxId,
      detail: "AgentMail account verified. No email sent.",
      status: "succeeded",
      createdAt: Date.now(),
    });
  },
});

export const recordFinalMessage = internalMutation({
  args: { planId: v.id("plans"), messageId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.planId, {
      status: "confirmed",
      finalMessageId: args.messageId,
      finalSentAt: Date.now(),
    });
    await ctx.db.insert("integrationEvents", {
      planId: args.planId,
      provider: "agentmail",
      kind: "message.sent",
      externalId: args.messageId,
      detail: "Final dinner plan sent to the marked test recipient",
      status: "succeeded",
      createdAt: Date.now(),
    });
  },
});

export const recordFinalPrepared = internalMutation({
  args: {
    planId: v.id("plans"),
    preparationId: v.string(),
    winner: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.planId, {
      status: "confirmed",
      finalMessageId: args.preparationId,
      finalSentAt: Date.now(),
    });
    await ctx.db.insert("integrationEvents", {
      planId: args.planId,
      provider: "agentmail",
      kind: "message.prepared",
      externalId: args.preparationId,
      detail: `Final plan prepared for ${args.winner}. No email sent.`,
      status: "succeeded",
      createdAt: Date.now(),
    });
  },
});
