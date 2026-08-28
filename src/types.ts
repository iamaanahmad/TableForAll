export type Sponsor = "openai" | "firecrawl" | "agentmail" | "preview";

export type PlanStatus = "collecting" | "voting" | "confirmed";

export type PlanSnapshot = {
  mode: "preview" | "connected";
  plan: {
    id: string;
    title: string;
    city: string;
    status: PlanStatus;
    finalMessageId?: string;
  };
  guests: Array<{
    id: string;
    name: string;
    email: string;
    reply?: string;
    repliedAt?: number;
  }>;
  constraints: Array<{
    id: string;
    kind: "time" | "area" | "budget" | "food" | "safety";
    value: string;
  }>;
  venues: Array<{
    id: string;
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
    id: string;
    provider: Sponsor;
    kind: string;
    detail: string;
    status?: "succeeded" | "failed";
    createdAt: number;
  }>;
};
