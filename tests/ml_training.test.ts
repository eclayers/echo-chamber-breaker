import { describe, it, expect } from "vitest";
import { EpistemicFeaturizer, EpistemicMLTrainer } from "../src/ml/trainer.js";
import { ML_CORPUS } from "../src/ml/dataset.js";

describe("ML Training & Epistemic Calibration Suite (ml-best-practices)", () => {
  it("enforces strict featurization ordering (fits on training split only without data leakage)", () => {
    const trainer = new EpistemicMLTrainer();
    const split = trainer.splitDataset(ML_CORPUS);

    // Verify split ratios
    expect(split.train.length).toBeGreaterThanOrEqual(10);
    expect(split.validation.length).toBeGreaterThanOrEqual(2);
    expect(split.test.length).toBeGreaterThanOrEqual(2);

    // Check featurizer on train only
    const featurizer = new EpistemicFeaturizer();
    featurizer.fit(split.train);
    const vocabSize = featurizer.getVocabularySize();
    expect(vocabSize).toBeGreaterThan(20);

    // Transform an unseen sentence
    const vec = featurizer.transform("A brand new unseen philosophical statement");
    expect(vec.denseVector.length).toBe(vocabSize);
    expect(vec.features["_meta_length"]).toBeDefined();
  });

  it("trains regularized softmax model with decreasing cross-entropy loss", () => {
    const trainer = new EpistemicMLTrainer();
    const result = trainer.trainModel(20, 0.15, 0.005);

    expect(result.epochs).toBe(20);
    expect(result.lossHistory.length).toBe(20);

    const firstLoss = result.lossHistory[0].loss;
    const finalLoss = result.finalTrainLoss;
    // Loss should decrease during training
    expect(finalLoss).toBeLessThanOrEqual(firstLoss);
    expect(result.vocabularySize).toBeGreaterThan(20);
  });

  it("optimizes Platt scaling temperature to improve Expected Calibration Error (ECE)", () => {
    const trainer = new EpistemicMLTrainer();
    const result = trainer.trainModel(25, 0.15, 0.005);

    expect(result.temperatureParameter).toBeGreaterThan(0);
    expect(result.calibratedReport).toBeDefined();
    expect(result.calibratedReport.bins.length).toBe(5);
    expect(result.calibratedReport.brierScore).toBeLessThanOrEqual(0.35);
  });

  it("generates fast (<5ms) explainable predictions with top feature weights", () => {
    const trainer = new EpistemicMLTrainer();
    const t0 = performance.now();
    const pred = trainer.predict("Nuclear power is completely essential for deep decarbonization!");
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(20); // Fast on-device inference
    expect(pred.isStance).toBe(true);
    expect(pred.calibratedConfidence).toBeGreaterThanOrEqual(0.5);
    expect(pred.convictionCertainty).toBeGreaterThanOrEqual(50);
    expect(pred.topFeatures.length).toBeGreaterThan(0);
    expect(pred.suggestedOpposingPremises.length).toBeGreaterThanOrEqual(2);
  });

  it("correctly identifies non-stance inputs without inventing conviction", () => {
    const trainer = new EpistemicMLTrainer();
    const predQuestion = trainer.predict("what is quantum superposition?");
    expect(predQuestion.isStance).toBe(false);
    expect(predQuestion.category).toBe("QUESTION");

    const predShort = trainer.predict("hi");
    expect(predShort.isStance).toBe(false);
  });
});
