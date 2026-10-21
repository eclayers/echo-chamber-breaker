import { describe, it, expect, beforeEach } from "vitest";
import { honestyEngine } from "../src/services/honestyEngine.js";
import { sessionStore } from "../src/services/sessionStore.js";

describe("Intellectual Honesty Engine & Ledger Suite", () => {
  const testUserId = `test-user-${Date.now()}`;

  beforeEach(async () => {
    // Reset test profile to 50.0
    await honestyEngine.calibrateBaseline(testUserId, 50.0, "Test reset");
  });

  it("initializes with default baseline score of 50.0", async () => {
    const report = await honestyEngine.getHonestyReport(testUserId);
    expect(report.currentScore).toBe(50.0);
    expect(report.radarMetrics).toBeDefined();
    expect(report.radarMetrics.opennessToEvidence).toBeGreaterThan(0);
  });

  it("increments score and records event on high rationality engagement", async () => {
    const assessment = {
      quality: "HIGH_RATIONALITY" as const,
      scoreDelta: 4.5,
      reason: "Grappled with core trade-offs directly.",
      addressedBlindSpots: ["Documentation benefits"],
      acknowledgedValidPoints: [],
      counterQualityScore: 85,
      feedbackSay: "Strong engagement.",
    };

    const { event, profile } = await honestyEngine.applyEngagement(
      testUserId,
      assessment,
      "Future of Work"
    );

    expect(profile.currentScore).toBe(54.5);
    expect(profile.engagedCount).toBe(1);
    expect(event.eventType).toBe("ENGAGEMENT_RECORDED");
    expect(event.delta).toBe(4.5);

    const events = await sessionStore.getEvents(testUserId);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].resultingScore).toBe(54.5);
  });

  it("awards high score delta and increases openness on concession", async () => {
    const assessment = {
      quality: "CONCESSION" as const,
      scoreDelta: 8.5,
      reason: "Acknowledged counter-evidence.",
      addressedBlindSpots: ["Mentorship trade-offs"],
      acknowledgedValidPoints: ["In-person speed during crisis"],
      counterQualityScore: 95,
      feedbackSay: "Honest belief update.",
    };

    const { event, profile } = await honestyEngine.applyEngagement(
      testUserId,
      assessment,
      "Future of Work"
    );

    expect(profile.currentScore).toBe(58.5);
    expect(profile.concessionCount).toBe(1);
    expect(event.eventType).toBe("CONCESSION_GRANTED");
    expect(profile.concessionRate).toBeGreaterThan(0);
  });

  it("decrements score visibly on low-effort dismissal", async () => {
    const { event, profile } = await honestyEngine.applyDismissal(
      testUserId,
      "Dismissed steelman with one word"
    );

    expect(profile.currentScore).toBe(47.0);
    expect(profile.dismissedCount).toBe(1);
    expect(event.eventType).toBe("CHALLENGE_DISMISSED");
    expect(event.delta).toBe(-3.0);
  });

  it("strictly clamps scores within 0.0 to 100.0", async () => {
    // Attempt extreme baseline
    await honestyEngine.calibrateBaseline(testUserId, 150.0);
    let report = await honestyEngine.getHonestyReport(testUserId);
    expect(report.currentScore).toBe(100.0);

    await honestyEngine.calibrateBaseline(testUserId, -50.0);
    report = await honestyEngine.getHonestyReport(testUserId);
    expect(report.currentScore).toBe(0.0);
  });
});
