export type BiasCategory =
  | "CONFIRMATION_BIAS"
  | "FALSE_DICHOTOMY"
  | "HASTY_GENERALIZATION"
  | "OVERCONFIDENCE_EFFECT"
  | "AFFECT_HEURISTIC"
  | "STRAW_MAN"
  | "SLIPPERY_SLOPE"
  | "STATUS_QUO_BIAS";

export type StancePolarity =
  | "STRONG_AGREE"
  | "LEAN_AGREE"
  | "NEUTRAL"
  | "LEAN_DISAGREE"
  | "STRONG_DISAGREE";

export type InputClassification =
  | "STANCE"
  | "GREETING"
  | "QUESTION"
  | "INCOMPLETE"
  | "NEUTRAL"
  | "META";

export interface StanceAnalysis {
  is_stance: boolean;
  category?: InputClassification;
  originalStatement: string;
  detectedTopic: string;
  claim: string;
  polarity: StancePolarity;
  confidence: number; // 0.0 to 1.0 (calibrated)
  conviction_certainty?: number; // 0 to 100 (calibrated, spec 3.2)
  emotionalCharge: number; // 0.0 to 1.0
  emotional_charge?: number; // 0 to 100 (affect intensity, spec 3.2)
  detectedFallacies: BiasCategory[];
  blindSpots: string[];
  blind_spots?: string[]; // 2-4 specific, non-generic items (spec 3.2)
  coreAssumption: string;
  unexamined_assumption?: string; // one crisp sentence (spec 3.2)
  topic_label?: string; // short label for UI (spec 3.2)
  calibrationNotes: string;
  say: string; // <= 40 word spoken summary for Alexa (spec 3.2)
  ml_features?: { feature: string; weight: number }[];
  calibrated_probability?: number;
  matched_domain?: string;
}

export interface SteelmanResponse {
  is_stance?: boolean;
  say: string; // Voice-ready string: crisp, punchy, <= 40 words
  originalClaim: string;
  opposingThesis: string;
  foundational_counter_thesis?: string; // one clear opposing thesis sentence (spec 4.2)
  coreArguments: {
    premise: string;
    evidenceOrMechanism: string;
  }[];
  core_structural_premises?: string[]; // spec 4.2 alias
  concessionPoints: string[];
  epistemicQuestion: string; // Provocative follow-up question
  socratic_inquiry?: string; // one sharp question that exposes a tension (spec 4.2)
  challengeId?: string; // uuid
  challenge_id?: string; // spec 4.2 alias
}

export type EngagementQuality =
  | "HIGH_RATIONALITY"
  | "MODERATE_ENGAGEMENT"
  | "CONCESSION"
  | "LOW_EFFORT_DISMISSAL"
  | "DEFENSIVE_STRAWMAN"
  | "IGNORED";

export interface EngagementAssessment {
  quality: EngagementQuality;
  scoreDelta: number;
  reason: string;
  addressedBlindSpots: string[];
  acknowledgedValidPoints: string[];
  counterQualityScore: number; // 0 to 100
  feedbackSay: string; // Speech-optimized feedback
}

export type EventType =
  | "STANCE_ANALYZED"
  | "STEELMAN_OFFERED"
  | "ENGAGEMENT_RECORDED"
  | "CONCESSION_GRANTED"
  | "CHALLENGE_COMPLETED"
  | "CHALLENGE_DISMISSED"
  | "CALIBRATION_BASELINE";

export interface HonestyEvent {
  id: string;
  userId: string;
  timestamp: string;
  eventType: EventType;
  delta: number;
  resultingScore: number;
  reason: string;
  relatedChallengeId?: string;
  metadata?: Record<string, unknown>;
}

export interface TopicHonestyMetric {
  topic: string;
  encounters: number;
  averageEngagement: number;
  opennessScore: number;
}

export interface HonestyProfile {
  userId: string;
  currentScore: number; // Baseline 50.0
  totalChallenges: number;
  engagedCount: number;
  dismissedCount: number;
  concessionCount: number;
  engagementRate: number; // 0.0 to 1.0
  concessionRate: number; // 0.0 to 1.0
  topicMetrics: Record<string, TopicHonestyMetric>;
  recentEvents: HonestyEvent[];
  updatedAt: string;
}

export interface DebateTurn {
  turnNumber: number;
  speaker: "USER" | "ASSISTANT";
  text: string;
  analysis?: StanceAnalysis | EngagementAssessment;
  timestamp: string;
}

export interface DebateSession {
  sessionId: string;
  userId: string;
  topic: string;
  originalStatement: string;
  status: "ACTIVE" | "CONCLUDED" | "ABANDONED";
  turns: DebateTurn[];
  qualityScores: number[];
  initialScore: number;
  netScoreDelta: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProactiveChallenge {
  challengeId: string;
  topic: string;
  say: string;
  provocation: string;
  counterViewToPriorClaim: string;
  priorStatementReference?: string;
  recommendedTimeMinutes: number;
}

export interface ToolResultPayload<T = unknown> {
  say: string;
  structuredContent: T;
  meta: {
    timestamp: string;
    version: string;
    latencyMs?: number;
    mode: "mock" | "bedrock";
  };
}
