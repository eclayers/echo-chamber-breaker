import { sessionStore } from "./sessionStore.js";
import { cognitiveAdapter } from "./bedrockAdapter.js";
import type {
  HonestyEvent,
  HonestyProfile,
  EngagementAssessment,
  EventType,
} from "../types/index.js";

export interface RadarMetrics {
  opennessToEvidence: number; // 0 to 100
  dialecticalRigor: number; // 0 to 100
  rebuttalQuality: number; // 0 to 100
  intellectualHumility: number; // 0 to 100
  consistency: number; // 0 to 100
}

export interface HonestyReportPayload {
  userId: string;
  currentScore: number;
  scoreStatus: "OPEN_MINDED" | "CALIBRATING" | "CONFIRMATION_TRAPPED" | "EXEMPLARY" | "BALANCED" | "DEVELOPING";
  totalChallenges: number;
  engagedCount: number;
  dismissedCount: number;
  concessionCount: number;
  engagementRatePercent: number;
  concessionRatePercent: number;
  radarMetrics: RadarMetrics;
  recentHistory: {
    timestamp: string;
    delta: number;
    resultingScore: number;
    reason: string;
    eventType: EventType;
  }[];
  summaryInsights: string[];
  detectedLanguage?: string;
}

export class HonestyEngine {
  private userLocks = new Map<string, Promise<void>>();

  private async withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.userLocks.get(userId) || Promise.resolve();
    let release: () => void;
    const current = new Promise<void>((r) => {
      release = r;
    });
    this.userLocks.set(
      userId,
      prev.then(() => current)
    );
    try {
      await prev;
      return await fn();
    } finally {
      release!();
      if (this.userLocks.get(userId) === current) {
        this.userLocks.delete(userId);
      }
    }
  }

  private clampScore(score: number): number {
    return Number(Math.min(100.0, Math.max(0.0, score)).toFixed(1));
  }

  async applyEngagement(
    userId: string,
    assessment: EngagementAssessment,
    topic?: string,
    relatedChallengeId?: string
  ): Promise<{ event: HonestyEvent; profile: HonestyProfile }> {
    return this.withUserLock(userId, async () => {
      const profile = await sessionStore.getProfile(userId);

      const oldScore = profile.currentScore;
      const newScore = this.clampScore(oldScore + assessment.scoreDelta);

      profile.currentScore = newScore;
      profile.totalChallenges++;
      profile.engagedCount++;

      if (assessment.quality === "CONCESSION") {
        profile.concessionCount++;
      }

      profile.engagementRate = Number(
        (profile.engagedCount / Math.max(1, profile.totalChallenges)).toFixed(2)
      );
      profile.concessionRate = Number(
        (profile.concessionCount / Math.max(1, profile.engagedCount)).toFixed(2)
      );

      // Update topic metrics
      if (topic) {
        if (!profile.topicMetrics[topic]) {
          profile.topicMetrics[topic] = {
            topic,
            encounters: 0,
            averageEngagement: 0,
            opennessScore: 50,
          };
        }
        const tm = profile.topicMetrics[topic];
        tm.encounters++;
        tm.averageEngagement = Number(
          ((tm.averageEngagement * (tm.encounters - 1) + assessment.counterQualityScore) / tm.encounters).toFixed(1)
        );
        if (assessment.quality === "CONCESSION") {
          tm.opennessScore = Math.min(100, tm.opennessScore + 10);
        }
      }

      const event: HonestyEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId,
        timestamp: new Date().toISOString(),
        eventType:
          assessment.quality === "CONCESSION"
            ? "CONCESSION_GRANTED"
            : "ENGAGEMENT_RECORDED",
        delta: assessment.scoreDelta,
        resultingScore: newScore,
        reason: assessment.reason,
        relatedChallengeId,
        metadata: {
          quality: assessment.quality,
          counterQualityScore: assessment.counterQualityScore,
          topic,
        },
      };

      profile.recentEvents.unshift(event);
      if (profile.recentEvents.length > 20) {
        profile.recentEvents = profile.recentEvents.slice(0, 20);
      }

      await sessionStore.saveProfile(profile);
      await sessionStore.appendEvent(event);

      return { event, profile };
    });
  }

  async applyDismissal(
    userId: string,
    reason: string = "Dismissed steelman challenge without substantive engagement.",
    relatedChallengeId?: string
  ): Promise<{ event: HonestyEvent; profile: HonestyProfile }> {
    return this.withUserLock(userId, async () => {
      const profile = await sessionStore.getProfile(userId);

      const delta = -3.0;
      const newScore = this.clampScore(profile.currentScore + delta);

      profile.currentScore = newScore;
      profile.totalChallenges++;
      profile.dismissedCount++;
      profile.engagementRate = Number(
        (profile.engagedCount / Math.max(1, profile.totalChallenges)).toFixed(2)
      );

      const event: HonestyEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId,
        timestamp: new Date().toISOString(),
        eventType: "CHALLENGE_DISMISSED",
        delta,
        resultingScore: newScore,
        reason,
        relatedChallengeId,
      };

      profile.recentEvents.unshift(event);
      if (profile.recentEvents.length > 20) {
        profile.recentEvents = profile.recentEvents.slice(0, 20);
      }

      await sessionStore.saveProfile(profile);
      await sessionStore.appendEvent(event);

      return { event, profile };
    });
  }

  async calibrateBaseline(
    userId: string,
    baselineScore: number = 50.0,
    notes: string = "Manual baseline reset/calibration"
  ): Promise<{ event: HonestyEvent; profile: HonestyProfile }> {
    return this.withUserLock(userId, async () => {
      const profile = await sessionStore.getProfile(userId);
      const clamped = this.clampScore(baselineScore);
      const delta = Number((clamped - profile.currentScore).toFixed(1));

      profile.currentScore = clamped;
      const event: HonestyEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId,
        timestamp: new Date().toISOString(),
        eventType: "CALIBRATION_BASELINE",
        delta,
        resultingScore: clamped,
        reason: notes,
      };

      profile.recentEvents.unshift(event);
      await sessionStore.saveProfile(profile);
      await sessionStore.appendEvent(event);

      return { event, profile };
    });
  }

  async getHonestyReport(userId: string, language: string = "en"): Promise<HonestyReportPayload> {
    const profile = await sessionStore.getProfile(userId);
    const events = await sessionStore.getEvents(userId, 15);

    let scoreStatus: HonestyReportPayload["scoreStatus"] = "CALIBRATING";
    if (profile.currentScore > 65) scoreStatus = "OPEN_MINDED";
    else if (profile.currentScore < 35) scoreStatus = "CONFIRMATION_TRAPPED";
    else scoreStatus = "CALIBRATING";

    // Compute Radar Dimensions
    const opennessToEvidence = Math.min(
      100,
      Math.max(20, Math.round(profile.concessionRate * 120 + 30))
    );
    const dialecticalRigor = Math.min(
      100,
      Math.max(20, Math.round(profile.engagementRate * 90 + 10))
    );
    const rebuttalQuality = Math.min(
      100,
      Math.max(20, Math.round(profile.currentScore * 0.95 + 5))
    );
    const intellectualHumility = Math.min(
      100,
      Math.max(20, Math.round((profile.concessionCount * 15) / Math.max(1, profile.totalChallenges) * 100 + 40))
    );
    const consistency = Math.min(
      100,
      Math.max(15, Math.min(profile.totalChallenges * 15, 100))
    );

    // Dynamic LLM Epistemic Diagnostic Synthesis
    let summaryInsights: string[];
    try {
      summaryInsights = await cognitiveAdapter.generateEpistemicReport(
        profile,
        events,
        language
      );
    } catch {
      summaryInsights = [
        profile.engagementRate >= 0.75
          ? "High willingness to engage with friction rather than retreating into agreement."
          : "Elevated dismissal rate detected. Stepping into opposing premises will elevate your score.",
        profile.concessionCount > 0
          ? `Recorded ${profile.concessionCount} genuine belief updates upon confronting superior evidence.`
          : "Zero concessions recorded so far; explore whether your convictions leave room for epistemic uncertainty.",
      ];
    }

    return {
      userId,
      currentScore: profile.currentScore,
      scoreStatus,
      totalChallenges: profile.totalChallenges,
      engagedCount: profile.engagedCount,
      dismissedCount: profile.dismissedCount,
      concessionCount: profile.concessionCount,
      engagementRatePercent: Math.round(profile.engagementRate * 100),
      concessionRatePercent: Math.round(profile.concessionRate * 100),
      radarMetrics: {
        opennessToEvidence,
        dialecticalRigor,
        rebuttalQuality,
        intellectualHumility,
        consistency,
      },
      recentHistory: events.map((e) => ({
        timestamp: e.timestamp,
        delta: e.delta,
        resultingScore: e.resultingScore,
        reason: e.reason,
        eventType: e.eventType,
      })),
      summaryInsights,
      detectedLanguage: language,
    };
  }
}

export const honestyEngine = new HonestyEngine();
