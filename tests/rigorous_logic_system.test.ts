import { describe, it, expect } from "vitest";
import { classifyInput, cognitiveAdapter } from "../src/services/bedrockAdapter.js";
import { mcpRouter } from "../src/mcp/server.js";
import { honestyEngine } from "../src/services/honestyEngine.js";

describe("Rigorous Logic System & Stance Gating (Normative Spec v1.0)", () => {
  // Acceptance Checklist Item 1: Greeting "hi Alexa" produces NON_STANCE_REPLY
  it("classifies 'hi Alexa' as GREETING with is_stance: false and never a STRONG_AGREE diagnosis", async () => {
    const greetings = ["hi Alexa", "hello", "good morning", "hey", "how are you"];
    for (const text of greetings) {
      const gate = classifyInput(text);
      expect(gate.is_stance).toBe(false);
      expect(gate.category).toBe("GREETING");
      expect(gate.say.length).toBeGreaterThan(0);

      const analysis = await cognitiveAdapter.analyzeStance(text);
      expect(analysis.is_stance).toBe(false);
      expect(analysis.polarity).toBe("NEUTRAL");
      expect(analysis.confidence).toBe(0);
      expect(analysis.conviction_certainty).toBe(0);
      expect(analysis.polarity).not.toBe("STRONG_AGREE");
    }
  });

  // Acceptance Checklist Item 2: Opinion statement produces is_stance: true and specific diagnosis
  it("classifies clear opinions as STANCE with is_stance: true and specific diagnosis", async () => {
    const statement = "Remote work is destroying company culture and productivity, and everyone must return to the office.";
    const gate = classifyInput(statement);
    expect(gate.is_stance).toBe(true);
    expect(gate.category).toBe("STANCE");

    const analysis = await cognitiveAdapter.analyzeStance(statement);
    expect(analysis.is_stance).toBe(true);
    expect(analysis.conviction_certainty).toBeGreaterThanOrEqual(70);
    expect(analysis.blindSpots.length).toBeGreaterThanOrEqual(2);
    expect(analysis.unexamined_assumption).toBeDefined();
    expect(analysis.topic_label).toBeDefined();
  });

  // Acceptance Checklist Item 3: Informational questions and fragments return is_stance: false
  it("rejects questions and incomplete fragments without inventing convictions", async () => {
    const question = "what is the capital of france?";
    const qGate = classifyInput(question);
    expect(qGate.is_stance).toBe(false);
    expect(qGate.category).toBe("QUESTION");

    const fragment = "the thing";
    const fGate = classifyInput(fragment);
    expect(fGate.is_stance).toBe(false);
    expect(fGate.category).toBe("INCOMPLETE");

    const qAnalysis = await cognitiveAdapter.analyzeStance(question);
    expect(qAnalysis.is_stance).toBe(false);
    expect(qAnalysis.confidence).toBe(0);
  });

  // Acceptance Checklist Item 4: Steelman tool returns is_stance: false for greetings
  it("ensures steelman tool returns is_stance: false when statement is a greeting or question", async () => {
    let responseData: any = null;
    const req: any = {
      body: {
        jsonrpc: "2.0",
        id: "steelman-greeting-test",
        method: "tools/call",
        params: {
          name: "steelman",
          arguments: {
            statement: "hi Alexa",
            userId: "test-user-greeting",
          },
        },
      },
    };
    const res: any = {
      json: (d: any) => {
        responseData = d;
      },
      status: () => res,
    };

    await mcpRouter.handleDirectJsonRpc(req, res);
    expect(responseData).toBeDefined();
    const parsed = JSON.parse(responseData.result.content[0].text);
    expect(parsed.structuredContent.is_stance).toBe(false);
  });

  // Acceptance Checklist Item 5: Every tool response speech is strictly <= 40 words
  it("enforces voice brevity contract (say <= 40 words) across all cognitive adapter tools", async () => {
    const statements = [
      "Frontier AI development should be paused immediately by global treaties.",
      "Nuclear energy is too slow, expensive, and dangerous.",
      "i feel pakistan and india and muslims are worst creations in the history",
      "Dynamic programming languages are obsolete for enterprise engineering.",
    ];

    for (const stmt of statements) {
      const steelman = await cognitiveAdapter.generateSteelman(stmt);
      expect(steelman.say).toBeDefined();
      const wordCount = steelman.say.trim().split(/\s+/).length;
      expect(wordCount).toBeLessThanOrEqual(40);
    }
  });

  // Acceptance Checklist Item 6: Engagement actions scoring deltas match canonical specification
  it("applies canonical scoring deltas: Dismiss (-3.0), Concede (+8.5), Rebuttal (+4.5)", async () => {
    const userId = `test-scoring-user-${Date.now()}`;

    // Dismissal
    const dismissal = await honestyEngine.applyDismissal(userId, "Dismissed steelman challenge");
    expect(dismissal.event.delta).toBe(-3.0);
    expect(dismissal.profile.currentScore).toBe(47.0);

    // Concession
    const concession = await honestyEngine.applyEngagement(userId, {
      quality: "CONCESSION",
      scoreDelta: 8.5,
      reason: "Conceded valid counter-point",
      addressedBlindSpots: ["Blindspot 1"],
      acknowledgedValidPoints: ["Premise 1"],
      counterQualityScore: 92,
      feedbackSay: "Concession recorded.",
    });
    expect(concession.event.delta).toBe(8.5);
    expect(concession.profile.currentScore).toBe(55.5);

    // Rebuttal
    const rebuttal = await honestyEngine.applyEngagement(userId, {
      quality: "HIGH_RATIONALITY",
      scoreDelta: 4.5,
      reason: "Submitted substantive counter-rebuttal",
      addressedBlindSpots: ["Blindspot 2"],
      acknowledgedValidPoints: [],
      counterQualityScore: 85,
      feedbackSay: "Rebuttal recorded.",
    });
    expect(rebuttal.event.delta).toBe(4.5);
    expect(rebuttal.profile.currentScore).toBe(60.0);
  });

  // Acceptance Checklist Item 7: Append-only audit trail integrity
  it("records every score change as an append-only ledger event with reason and delta", async () => {
    const userId = `test-audit-user-${Date.now()}`;
    await honestyEngine.applyDismissal(userId, "Action 1");
    await honestyEngine.applyDismissal(userId, "Action 2");

    const report = await honestyEngine.getHonestyReport(userId);
    expect(report.recentHistory.length).toBe(2);
    expect(report.recentHistory[0].reason).toBe("Action 2");
    expect(report.recentHistory[1].reason).toBe("Action 1");
    expect(report.recentHistory[0].resultingScore).toBe(44.0);
  });

  // Acceptance Checklist Item 8: Score status derivation
  it("derives status labels: CONFIRMATION_TRAPPED (<35), CALIBRATING (35-65), OPEN_MINDED (>65)", async () => {
    const lowUser = `low-user-${Date.now()}`;
    await honestyEngine.calibrateBaseline(lowUser, 25.0, "Low test baseline");
    const lowReport = await honestyEngine.getHonestyReport(lowUser);
    expect(lowReport.scoreStatus).toBe("CONFIRMATION_TRAPPED");

    const midUser = `mid-user-${Date.now()}`;
    await honestyEngine.calibrateBaseline(midUser, 50.0, "Mid test baseline");
    const midReport = await honestyEngine.getHonestyReport(midUser);
    expect(midReport.scoreStatus).toBe("CALIBRATING");

    const highUser = `high-user-${Date.now()}`;
    await honestyEngine.calibrateBaseline(highUser, 80.0, "High test baseline");
    const highReport = await honestyEngine.getHonestyReport(highUser);
    expect(highReport.scoreStatus).toBe("OPEN_MINDED");
  });
});
