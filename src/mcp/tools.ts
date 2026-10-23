import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cognitiveAdapter } from "../services/bedrockAdapter.js";
import { honestyEngine } from "../services/honestyEngine.js";
import { sessionStore } from "../services/sessionStore.js";
import type {
  DebateSession,
  DebateTurn,
  ToolResultPayload,
} from "../types/index.js";

export function enforceVoiceBrevity(say: string, maxWords: number = 40): string {
  const words = say.trim().split(/\s+/);
  if (words.length <= maxWords) return say;
  return words.slice(0, maxWords - 1).join(" ") + "...";
}

function formatToolResponse<T>(say: string, structuredContent: T, mode: "mock" | "bedrock"): {
  content: { type: "text"; text: string }[];
} {
  const boundedSay = enforceVoiceBrevity(say, 40);
  const payload: ToolResultPayload<T> = {
    say: boundedSay,
    structuredContent,
    meta: {
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      mode,
    },
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function registerTools(server: McpServer): void {
  // 1. analyze_stance
  server.tool(
    "analyze_stance",
    "Detect stance strength, certainty, emotion, core claim, and predicted blind spots from a statement.",
    {
      statement: z.string().min(3).describe("The user's opinion, conviction, or moral judgment."),
      userId: z.string().default("default-user").describe("Identifier for user or device profile."),
    },
    async ({ statement, userId }) => {
      const stance = await cognitiveAdapter.analyzeStance(statement);
      const say = stance.say || `Detected high conviction on ${stance.detectedTopic}. I have identified three crucial blind spots in this position.`;
      return formatToolResponse(say, stance, cognitiveAdapter.getMode());
    }
  );

  // 2. steelman
  server.tool(
    "steelman",
    "Generate the strongest charitable opposing argument (steelman) for an opinion. Includes short voice summary (< 40 words) and deep structured screen cards.",
    {
      statement: z.string().min(3).describe("The statement or opinion to steelman."),
      userId: z.string().default("default-user").describe("Identifier for user or device profile."),
    },
    async ({ statement, userId }) => {
      const stance = await cognitiveAdapter.analyzeStance(statement);
      if (!stance.is_stance) {
        return formatToolResponse(
          stance.say || "Please articulate an opinion or conviction you would like challenged.",
          {
            is_stance: false,
            say: stance.say,
            originalClaim: statement,
            reason: stance.coreAssumption || stance.calibrationNotes,
          },
          cognitiveAdapter.getMode()
        );
      }
      const steelmanRes = await cognitiveAdapter.generateSteelman(statement, stance);
      return formatToolResponse(steelmanRes.say, steelmanRes, cognitiveAdapter.getMode());
    }
  );

  // 3. record_engagement
  server.tool(
    "record_engagement",
    "Evaluate whether the user meaningfully grappled with the opposing steelman or dismissed it, and update their private Intellectual Honesty Score.",
    {
      userId: z.string().default("default-user").describe("The user's ID."),
      userReply: z.string().min(1).describe("The user's response to the steelman argument."),
      topic: z.string().default("General").describe("Topic of debate."),
      counterClaim: z.string().optional().describe("Summary of the steelman argument presented."),
      relatedChallengeId: z.string().optional().describe("Associated challenge ID if applicable."),
    },
    async ({ userId, userReply, topic, counterClaim, relatedChallengeId }) => {
      // Reconstruct minimal steelman context for evaluation
      const mockSteelman = await cognitiveAdapter.generateSteelman(counterClaim || "Opposing perspective");
      const assessment = await cognitiveAdapter.evaluateEngagement(userReply, mockSteelman);

      const { event, profile } = await honestyEngine.applyEngagement(
        userId,
        assessment,
        topic,
        relatedChallengeId
      );

      const say = `${assessment.feedbackSay} Your Honesty Score is now ${profile.currentScore}.`;
      return formatToolResponse(
        say,
        {
          assessment,
          event,
          currentScore: profile.currentScore,
          delta: event.delta,
        },
        cognitiveAdapter.getMode()
      );
    }
  );

  // 4. start_debate
  server.tool(
    "start_debate",
    "Initiate an active multi-turn dialectical sparring session around a controversial claim.",
    {
      userId: z.string().default("default-user").describe("The user ID."),
      statement: z.string().min(5).describe("Initial opinion or thesis to debate."),
    },
    async ({ userId, statement }) => {
      const stance = await cognitiveAdapter.analyzeStance(statement);
      if (!stance.is_stance) {
        return formatToolResponse(
          stance.say || "Cannot start a debate on a non-conviction statement.",
          {
            is_stance: false,
            error: "NON_STANCE_INPUT",
            say: stance.say,
          },
          cognitiveAdapter.getMode()
        );
      }
      const profile = await sessionStore.getProfile(userId);
      const initialSteelman = await cognitiveAdapter.generateSteelman(statement, stance);

      const sessionId = `deb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const userTurn: DebateTurn = {
        turnNumber: 1,
        speaker: "USER",
        text: statement,
        analysis: stance,
        timestamp: new Date().toISOString(),
      };

      const assistantTurn: DebateTurn = {
        turnNumber: 2,
        speaker: "ASSISTANT",
        text: initialSteelman.opposingThesis,
        timestamp: new Date().toISOString(),
      };

      const session: DebateSession = {
        sessionId,
        userId,
        topic: stance.detectedTopic,
        originalStatement: statement,
        status: "ACTIVE",
        turns: [userTurn, assistantTurn],
        qualityScores: [],
        initialScore: profile.currentScore,
        netScoreDelta: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await sessionStore.saveDebateSession(session);

      const say = `Debate session started on ${stance.detectedTopic}. ${initialSteelman.say}`;
      return formatToolResponse(
        say,
        {
          session,
          initialSteelman,
        },
        cognitiveAdapter.getMode()
      );
    }
  );

  // 5. continue_debate
  server.tool(
    "continue_debate",
    "Continue an active multi-turn debate session with the user's counter-rebuttal.",
    {
      sessionId: z.string().describe("Active debate session ID."),
      userId: z.string().default("default-user").describe("The user ID."),
      userReply: z.string().min(2).describe("User's counter-rebuttal."),
    },
    async ({ sessionId, userId, userReply }) => {
      const session = await sessionStore.getDebateSession(sessionId);
      if (!session || session.status !== "ACTIVE") {
        const errorSay = "Debate session not found or already concluded.";
        return formatToolResponse(
          errorSay,
          { error: "SESSION_NOT_FOUND", sessionId },
          cognitiveAdapter.getMode()
        );
      }

      const lastAssistantTurn = [...session.turns].reverse().find((t) => t.speaker === "ASSISTANT");
      const currentSteelman = await cognitiveAdapter.generateSteelman(lastAssistantTurn?.text || session.topic);
      const assessment = await cognitiveAdapter.evaluateEngagement(userReply, currentSteelman);

      const { event, profile } = await honestyEngine.applyEngagement(
        userId,
        assessment,
        session.topic,
        sessionId
      );

      session.netScoreDelta = Number((session.netScoreDelta + assessment.scoreDelta).toFixed(1));
      session.qualityScores.push(assessment.counterQualityScore);

      const userTurnNum = session.turns.length + 1;
      session.turns.push({
        turnNumber: userTurnNum,
        speaker: "USER",
        text: userReply,
        analysis: assessment,
        timestamp: new Date().toISOString(),
      });

      // Generate next counter turn
      const nextSteelman = await cognitiveAdapter.generateSteelman(userReply);
      session.turns.push({
        turnNumber: userTurnNum + 1,
        speaker: "ASSISTANT",
        text: nextSteelman.opposingThesis + " " + nextSteelman.epistemicQuestion,
        timestamp: new Date().toISOString(),
      });

      await sessionStore.saveDebateSession(session);

      const say = `${assessment.feedbackSay} ${nextSteelman.say}`;
      return formatToolResponse(
        say,
        {
          session,
          assessment,
          currentScore: profile.currentScore,
          nextSteelman,
        },
        cognitiveAdapter.getMode()
      );
    }
  );

  // 6. conclude_debate
  server.tool(
    "conclude_debate",
    "Conclude an active debate session, summarizing key concessions and final honesty impact.",
    {
      sessionId: z.string().describe("Active debate session ID."),
      userId: z.string().default("default-user").describe("The user ID."),
      finalReflection: z.string().optional().describe("Optional concluding reflection by the user."),
    },
    async ({ sessionId, userId, finalReflection }) => {
      const session = await sessionStore.getDebateSession(sessionId);
      if (!session) {
        return formatToolResponse(
          "Debate session not found.",
          { error: "SESSION_NOT_FOUND" },
          cognitiveAdapter.getMode()
        );
      }

      session.status = "CONCLUDED";
      let bonusDelta = 0;
      if (finalReflection && finalReflection.length > 20) {
        bonusDelta = +3.0;
        await honestyEngine.applyEngagement(
          userId,
          {
            quality: "CONCESSION",
            scoreDelta: bonusDelta,
            reason: "Completed end-of-debate written reflection.",
            addressedBlindSpots: ["Self-correction"],
            acknowledgedValidPoints: ["Dialectical trade-offs"],
            counterQualityScore: 90,
            feedbackSay: "Reflection logged.",
          },
          session.topic,
          sessionId
        );
      }

      await sessionStore.saveDebateSession(session);
      const profile = await sessionStore.getProfile(userId);

      const avgQuality =
        session.qualityScores.length > 0
          ? Math.round(session.qualityScores.reduce((a, b) => a + b, 0) / session.qualityScores.length)
          : 70;

      const say = `Debate concluded on ${session.topic}. Total turns: ${session.turns.length}. Net honesty delta: ${session.netScoreDelta > 0 ? "+" : ""}${session.netScoreDelta}. Final score: ${profile.currentScore}.`;

      return formatToolResponse(
        say,
        {
          sessionId,
          topic: session.topic,
          totalTurns: session.turns.length,
          avgQuality,
          netScoreDelta: session.netScoreDelta,
          currentScore: profile.currentScore,
        },
        cognitiveAdapter.getMode()
      );
    }
  );

  // 7. honesty_report
  server.tool(
    "honesty_report",
    "Get full longitudinal Intellectual Honesty report including score, radar metrics, LLM-generated epistemic diagnosis, and recent history.",
    {
      userId: z.string().default("default-user").describe("The user ID."),
      language: z.string().optional().describe("Optional ISO language code or name (e.g. 'es', 'fr', 'de', 'hi', 'en') for dynamic multilingual report generation."),
    },
    async ({ userId, language }) => {
      const report = await honestyEngine.getHonestyReport(userId, language);
      const say = `Your Intellectual Honesty Score is ${report.currentScore}, categorized as ${report.scoreStatus}. Engagement rate is ${report.engagementRatePercent} percent.`;
      return formatToolResponse(say, report, cognitiveAdapter.getMode());
    }
  );

  // 8. challenge_me
  server.tool(
    "challenge_me",
    "Receive a proactive intellectual challenge drawn from user history or provocative friction topics.",
    {
      userId: z.string().default("default-user").describe("The user ID."),
    },
    async ({ userId }) => {
      const profile = await sessionStore.getProfile(userId);
      const challenge = await cognitiveAdapter.generateProactiveChallenge(profile);
      return formatToolResponse(challenge.say, challenge, cognitiveAdapter.getMode());
    }
  );

  // 9. calibrate_baseline
  server.tool(
    "calibrate_baseline",
    "Calibrate or reset user baseline honesty score and preferences with an auditable event.",
    {
      userId: z.string().default("default-user").describe("The user ID."),
      baselineScore: z.number().min(0).max(100).default(50.0).describe("Target baseline score (0-100)."),
      reason: z.string().default("Manual baseline calibration").describe("Reason for adjustment."),
    },
    async ({ userId, baselineScore, reason }) => {
      const { event, profile } = await honestyEngine.calibrateBaseline(userId, baselineScore, reason);
      const say = `Baseline calibrated to ${profile.currentScore}. Event logged to append-only ledger.`;
      return formatToolResponse(
        say,
        {
          event,
          currentScore: profile.currentScore,
        },
        cognitiveAdapter.getMode()
      );
    }
  );
}
