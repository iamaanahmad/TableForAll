import posthog from "posthog-js";

const POSTHOG_PUBLIC_KEY = "phc_ovQVn9vSJdteSBV7ujT7Ur9icJuv6KoYA8kTLFX5dt5H";
const POSTHOG_INGEST_HOST = "https://us.i.posthog.com";

export type AnalyticsMode = "connected" | "preview";
export type ActivationStep = "reply_sync" | "venue_research" | "venue_vote" | "final_plan";

let initialized = false;
let dashboardViewCaptured = false;

export function initializeAnalytics() {
  if (initialized || typeof window === "undefined") return;

  posthog.init(POSTHOG_PUBLIC_KEY, {
    api_host: POSTHOG_INGEST_HOST,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    person_profiles: "identified_only",
  });
  initialized = true;
}

export function captureDashboardView(mode: AnalyticsMode) {
  if (dashboardViewCaptured) return;
  dashboardViewCaptured = true;
  capture("activation_dashboard_viewed", { route: "dinner_dashboard", mode });
}

export function captureActivationStarted(step: ActivationStep, mode: AnalyticsMode) {
  capture("activation_step_started", { step, mode });
}

export function captureActivationCompleted(
  step: ActivationStep,
  mode: AnalyticsMode,
  outcome: "success" | "failure",
) {
  capture("activation_step_completed", { step, mode, outcome });

  if (step === "final_plan" && outcome === "success") {
    capture("product_activated", { mode });
  }
}

function capture(event: string, properties: Record<string, string>) {
  if (!initialized) return;
  posthog.capture(event, properties);
}
