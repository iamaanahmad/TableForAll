import { describe, expect, it } from "vitest";
import { applyPreviewReply, castPreviewVote, confirmPreviewPlan, createPreviewPlan } from "../src/preview";

describe("interactive preview loop", () => {
  it("adds Maya's safety need and removes the risky venue", () => {
    const updated = applyPreviewReply(createPreviewPlan());
    expect(updated.constraints.some((constraint) => constraint.kind === "safety")).toBe(true);
    expect(updated.venues.find((venue) => venue.id === "lilia")?.excluded).toBe(true);
    expect(updated.guests.find((guest) => guest.id === "maya")?.repliedAt).toBeTypeOf("number");
  });

  it("records a vote and prepares the final message without sending email", () => {
    const replied = applyPreviewReply(createPreviewPlan());
    const voted = castPreviewVote(replied, "rule-of-thirds");
    const confirmed = confirmPreviewPlan(voted);
    expect(voted.venues.find((venue) => venue.id === "rule-of-thirds")?.votes).toBe(4);
    expect(confirmed.plan.status).toBe("confirmed");
    expect(confirmed.events[0].detail).toContain("No email was sent");
  });

  it("never votes for an excluded venue", () => {
    const replied = applyPreviewReply(createPreviewPlan());
    expect(castPreviewVote(replied, "lilia")).toBe(replied);
  });
});
