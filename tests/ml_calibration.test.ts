import { describe, it, expect } from "vitest";
import {
  computeCalibration,
  computeClassificationMetrics,
  evaluateSteelmanQuality,
} from "../src/ml/metrics.js";
import { BENCHMARK_DATASET, runBenchmarkEvaluation } from "../src/ml/evaluation.js";
import { cognitiveAdapter } from "../src/services/bedrockAdapter.js";

describe("ML Epistemic Calibration & Best Practices Suite (/ml-best-practices)", () => {
  it("computes Expected Calibration Error (ECE) and Brier Score accurately", () => {
    // 5 perfectly calibrated predictions
    const predictions = [
      { confidence: 0.9, isAccurate: true },
      { confidence: 0.8, isAccurate: true },
      { confidence: 0.7, isAccurate: true },
      { confidence: 0.4, isAccurate: false },
      { confidence: 0.1, isAccurate: false },
    ];

    const report = computeCalibration(predictions, 5);
    expect(report.sampleCount).toBe(5);
    expect(report.brierScore).toBeLessThan(0.15); // low error
    expect(report.expectedCalibrationError).toBeLessThan(0.25);
    expect(report.bins.length).toBe(5);
  });

  it("computes multi-class confusion matrix, precision, recall, and Macro-F1", () => {
    const labels = ["STRONG_AGREE", "LEAN_AGREE", "NEUTRAL"];
    const groundTruth = ["STRONG_AGREE", "STRONG_AGREE", "LEAN_AGREE", "NEUTRAL"];
    const predicted = ["STRONG_AGREE", "LEAN_AGREE", "LEAN_AGREE", "NEUTRAL"];

    const metrics = computeClassificationMetrics(labels, groundTruth, predicted);
    expect(metrics.accuracy).toBe(0.75); // 3 of 4
    expect(metrics.macroF1).toBeGreaterThan(0.6);
    expect(metrics.confusionMatrix["STRONG_AGREE"]["STRONG_AGREE"]).toBe(1);
    expect(metrics.confusionMatrix["STRONG_AGREE"]["LEAN_AGREE"]).toBe(1);
  });

  it("evaluates Steelman Quality Index (SQI) and enforces voice brevity constraint", () => {
    const validSay = "Distributed teams force structured documentation that hallway chatter often ignores.";
    const opposing = "Distributed operations enforce better written documentation.";
    const premises = [
      { premise: "Documentation", evidenceOrMechanism: "Remote teams record architecture in durable repos." },
    ];
    const question = "What empirical evidence would change your mind on remote productivity?";

    const sqi = evaluateSteelmanQuality(validSay, opposing, premises, question);
    expect(sqi.isVoiceCompliant).toBe(true);
    expect(sqi.voiceWordCount).toBeLessThanOrEqual(40);
    expect(sqi.compositeScore).toBeGreaterThanOrEqual(75);
    expect(["A+", "A", "B"]).toContain(sqi.grade);

    // Test non-compliant verbose say text (> 40 words)
    const verboseSay =
      "This is a very long speech output that exceeds forty words because someone did not follow the non-negotiable voice UX guidelines specified in the product architecture document for the Alexa track submission, which requires spoken responses to remain under forty words for auditory comprehension.";
    const failedSqi = evaluateSteelmanQuality(verboseSay, opposing, premises, question);
    expect(failedSqi.isVoiceCompliant).toBe(false);
    expect(failedSqi.compositeScore).toBeLessThan(sqi.compositeScore);
  });

  it("runs end-to-end benchmark evaluation across domain slices", async () => {
    const predictions = [];
    for (const bCase of BENCHMARK_DATASET) {
      const stance = await cognitiveAdapter.analyzeStance(bCase.statement);
      const steelman = await cognitiveAdapter.generateSteelman(bCase.statement, stance);
      predictions.push({
        caseId: bCase.id,
        predictedPolarity: stance.polarity,
        predictedConfidence: stance.confidence,
        steelman,
      });
    }

    const summary = runBenchmarkEvaluation(predictions);
    expect(summary.sampleCount).toBe(BENCHMARK_DATASET.length);
    expect(summary.classificationMetrics.accuracy).toBeGreaterThanOrEqual(0.8);
    expect(summary.averageSteelmanQualityScore).toBeGreaterThanOrEqual(75);
    expect(Object.keys(summary.domainSliceMetrics).length).toBeGreaterThanOrEqual(3);
  });
});
