import type { PlanSnapshot } from "./types";

const now = Date.now();

export function createPreviewPlan(): PlanSnapshot {
  return {
    mode: "preview",
    plan: { id: "preview-plan", title: "Friday dinner in Brooklyn", city: "Brooklyn", status: "collecting" },
    guests: [
      { id: "sam", name: "Sam", email: "sam.tableforall@example.test", reply: "Friday after 7 works.", repliedAt: now - 28 * 60_000 },
      { id: "jon-lee", name: "Jon + Lee", email: "jon-lee.tableforall@example.test", reply: "North Brooklyn. Vegetarian options, please.", repliedAt: now - 18 * 60_000 },
      { id: "amir", name: "Amir", email: "amir.tableforall@example.test", reply: "Keep it near $60 each.", repliedAt: now - 12 * 60_000 },
      { id: "nora", name: "Nora", email: "nora.tableforall@example.test", reply: "Friday works for me.", repliedAt: now - 8 * 60_000 },
      { id: "maya", name: "Maya", email: "maya.tableforall@example.test" },
      { id: "voter", name: "Demo voter", email: "voter.tableforall@example.test" },
    ],
    constraints: [
      { id: "time", kind: "time", value: "Friday after 7" },
      { id: "area", kind: "area", value: "North Brooklyn" },
      { id: "budget", kind: "budget", value: "$60 per person" },
      { id: "food", kind: "food", value: "Vegetarian friendly" },
    ],
    venues: [
      {
        id: "rule-of-thirds",
        name: "Rule of Thirds",
        url: "https://www.thirdsbk.com/",
        neighborhood: "Greenpoint",
        cuisine: "Japanese",
        priceBand: "$$$",
        fitNotes: ["Group tables", "Vegetarian options"],
        votes: 3,
        excluded: false,
      },
      {
        id: "laser-wolf",
        name: "Laser Wolf",
        url: "https://www.laserwolfbrooklyn.com/",
        neighborhood: "Williamsburg",
        cuisine: "Israeli grill",
        priceBand: "$$$",
        fitNotes: ["Rooftop", "Shareable plates"],
        votes: 1,
        excluded: false,
      },
      {
        id: "lilia",
        name: "Lilia",
        url: "https://www.lilianewyork.com/menus/",
        neighborhood: "Williamsburg",
        cuisine: "Italian",
        priceBand: "$$$",
        fitNotes: ["Vegetarian options", "Lively room"],
        allergenRisk: "The published menu includes several nut dishes.",
        votes: 2,
        excluded: false,
      },
    ],
    events: [],
  };
}

export function applyPreviewReply(current: PlanSnapshot): PlanSnapshot {
  if (current.guests.find((guest) => guest.id === "maya")?.repliedAt) return current;
  return {
    ...current,
    guests: current.guests.map((guest) =>
      guest.id === "maya"
        ? {
            ...guest,
            reply: "Friday after 7 works. I have a severe nut allergy.",
            repliedAt: Date.now(),
          }
        : guest,
    ),
    constraints: [
      ...current.constraints,
      { id: "safety", kind: "safety", value: "Severe nut allergy" },
    ],
    venues: current.venues.map((venue) => ({
      ...venue,
      excluded: Boolean(venue.allergenRisk),
    })),
    events: [
      {
        id: "preview-reply",
        provider: "preview",
        kind: "reply.previewed",
        detail: "Preview parser added Maya's safety constraint",
        createdAt: Date.now(),
      },
      ...current.events,
    ],
  };
}

export function castPreviewVote(current: PlanSnapshot, venueId: string): PlanSnapshot {
  if (current.venues.find((venue) => venue.id === venueId)?.excluded) return current;
  return {
    ...current,
    plan: { ...current.plan, status: "voting" },
    venues: current.venues.map((venue) =>
      venue.id === venueId ? { ...venue, votes: venue.votes + 1 } : venue,
    ),
    events: [
      {
        id: `preview-vote-${venueId}`,
        provider: "preview",
        kind: "vote.previewed",
        detail: "Preview vote changed the shortlist",
        createdAt: Date.now(),
      },
      ...current.events,
    ],
  };
}

export function confirmPreviewPlan(current: PlanSnapshot): PlanSnapshot {
  return {
    ...current,
    plan: { ...current.plan, status: "confirmed", finalMessageId: "preview-only" },
    events: [
      {
        id: "preview-final",
        provider: "preview",
        kind: "message.previewed",
        detail: "Final plan preview created. No email was sent.",
        createdAt: Date.now(),
      },
      ...current.events,
    ],
  };
}
