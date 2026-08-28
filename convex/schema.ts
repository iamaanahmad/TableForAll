import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  plans: defineTable({
    slug: v.string(),
    title: v.string(),
    city: v.string(),
    hostEmail: v.string(),
    status: v.union(v.literal("collecting"), v.literal("voting"), v.literal("confirmed")),
    createdAt: v.number(),
    finalMessageId: v.optional(v.string()),
    finalSentAt: v.optional(v.number()),
  }).index("by_slug", ["slug"]),
  guests: defineTable({
    planId: v.id("plans"),
    name: v.string(),
    email: v.string(),
    reply: v.optional(v.string()),
    replyMessageId: v.optional(v.string()),
    repliedAt: v.optional(v.number()),
  })
    .index("by_plan", ["planId"])
    .index("by_plan_email", ["planId", "email"]),
  constraints: defineTable({
    planId: v.id("plans"),
    guestId: v.id("guests"),
    kind: v.union(v.literal("time"), v.literal("area"), v.literal("budget"), v.literal("food"), v.literal("safety")),
    value: v.string(),
    sourceMessageId: v.optional(v.string()),
  }).index("by_plan", ["planId"]),
  venues: defineTable({
    planId: v.id("plans"),
    name: v.string(),
    url: v.string(),
    neighborhood: v.string(),
    cuisine: v.string(),
    priceBand: v.string(),
    sourceCheckedAt: v.optional(v.number()),
    sourceTitle: v.optional(v.string()),
    sourceSnippet: v.optional(v.string()),
    fitNotes: v.array(v.string()),
    allergenRisk: v.optional(v.string()),
    requiresConfirmation: v.boolean(),
    excluded: v.boolean(),
  }).index("by_plan", ["planId"]),
  votes: defineTable({
    planId: v.id("plans"),
    guestId: v.id("guests"),
    venueId: v.id("venues"),
    createdAt: v.number(),
  })
    .index("by_plan", ["planId"])
    .index("by_guest", ["guestId"]),
  integrationEvents: defineTable({
    planId: v.id("plans"),
    provider: v.union(v.literal("agentmail"), v.literal("firecrawl"), v.literal("openai")),
    kind: v.string(),
    externalId: v.optional(v.string()),
    detail: v.string(),
    status: v.union(v.literal("succeeded"), v.literal("failed")),
    createdAt: v.number(),
  }).index("by_plan", ["planId"]),
});
