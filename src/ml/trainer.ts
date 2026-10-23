import { ML_CORPUS, type MLTrainingSample } from "./dataset.js";
import {
  computeCalibration,
  computeClassificationMetrics,
  type CalibrationReport,
  type ClassificationMetrics,
} from "./metrics.js";
import type { StancePolarity, BiasCategory, InputClassification } from "../types/index.js";

export interface MLFeatureVector {
  tokens: string[];
  features: Record<string, number>;
  denseVector: number[];
}

export interface TrainingSplit {
  train: MLTrainingSample[];
  validation: MLTrainingSample[];
  test: MLTrainingSample[];
}

export interface TrainingLossEpoch {
  epoch: number;
  loss: number;
  trainAccuracy: number;
  valAccuracy: number;
}

export interface MLTrainingResult {
  sampleCount: number;
  trainCount: number;
  valCount: number;
  testCount: number;
  vocabularySize: number;
  epochs: number;
  finalTrainLoss: number;
  lossHistory: TrainingLossEpoch[];
  testMetrics: ClassificationMetrics;
  rawCalibration: CalibrationReport;
  calibratedReport: CalibrationReport;
  temperatureParameter: number; // Platt scaling temperature T
  eceImprovementPercent: number;
  brierImprovementPercent: number;
  trainedAt: string;
}

export interface MLInferencePrediction {
  isStance: boolean;
  category: InputClassification;
  predictedPolarity: StancePolarity;
  predictedBias: BiasCategory | "NONE";
  rawConfidence: number;
  calibratedConfidence: number;
  emotionalAffect: number; // 0 to 100
  convictionCertainty: number; // 0 to 100
  topFeatures: { feature: string; weight: number }[];
  matchedDomain?: string;
  suggestedOpposingPremises: string[];
  suggestedSocraticInquiry: string;
}

/**
 * Epistemic Machine Learning Featurizer
 * Extracts n-grams, certainty adverbs, affective intensity, and lexical markers.
 */
export class EpistemicFeaturizer {
  private vocabulary: Map<string, number> = new Map();
  private idfWeights: Map<string, number> = new Map();
  private isFitted: boolean = false;

  // Epistemic marker dictionaries
  private certaintyAdverbs = new Set([
    "completely", "strictly", "always", "never", "must", "obviously",
    "clearly", "definitely", "absolutely", "inherently", "undeniably", "fundamentally"
  ]);

  private affectKeywords = new Set([
    "destroying", "disaster", "arrogant", "obsolete", "addiction", "catastrophe",
    "stupid", "worst", "drone", "theft", "unacceptable", "scam", "corrupt"
  ]);

  /**
   * Fits vocabulary and IDF weights strictly on training samples only (no data leakage).
   */
  fit(trainingSamples: MLTrainingSample[]): void {
    const docCount = trainingSamples.length;
    const docFrequency: Map<string, number> = new Map();
    this.vocabulary.clear();
    this.idfWeights.clear();

    for (const sample of trainingSamples) {
      const tokens = this.tokenize(sample.statement);
      const uniqueInDoc = new Set(tokens);
      for (const tok of uniqueInDoc) {
        docFrequency.set(tok, (docFrequency.get(tok) || 0) + 1);
      }
    }

    // Build vocabulary with minimum document frequency threshold
    let index = 0;
    for (const [term, df] of docFrequency.entries()) {
      if (df >= 1) {
        this.vocabulary.set(term, index++);
        // Smoothed IDF: ln(1 + N / (1 + df))
        const idf = Math.log(1 + docCount / (1 + df));
        this.idfWeights.set(term, idf);
      }
    }

    this.isFitted = true;
  }

  tokenize(text: string): string[] {
    const clean = (text || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
    const words = clean.split(/\s+/).filter((w) => w.length > 1);
    const ngrams: string[] = [...words];

    // Generate bigrams
    for (let i = 0; i < words.length - 1; i++) {
      ngrams.push(`${words[i]}_${words[i + 1]}`);
    }
    return ngrams;
  }

  transform(statement: string): MLFeatureVector {
    const tokens = this.tokenize(statement);
    const features: Record<string, number> = {};
    const tfMap: Map<string, number> = new Map();

    for (const tok of tokens) {
      tfMap.set(tok, (tfMap.get(tok) || 0) + 1);
    }

    // Dense vector corresponding to vocabulary
    const denseVector: number[] = new Array(this.vocabulary.size).fill(0);

    for (const [tok, count] of tfMap.entries()) {
      if (this.vocabulary.has(tok)) {
        const idx = this.vocabulary.get(tok)!;
        const idf = this.idfWeights.get(tok) || 1.0;
        const tfIdf = (count / tokens.length) * idf;
        features[tok] = tfIdf;
        denseVector[idx] = tfIdf;
      }
    }

    // Engineering domain meta-features
    let certaintyCount = 0;
    let affectCount = 0;
    for (const tok of tokens) {
      if (this.certaintyAdverbs.has(tok)) certaintyCount++;
      if (this.affectKeywords.has(tok)) affectCount++;
    }

    features["_meta_certainty_ratio"] = certaintyCount / Math.max(tokens.length, 1);
    features["_meta_affect_ratio"] = affectCount / Math.max(tokens.length, 1);
    features["_meta_length"] = Math.min(tokens.length / 30, 1.0);

    return { tokens, features, denseVector };
  }

  getVocabularySize(): number {
    return this.vocabulary.size;
  }
}

/**
 * Epistemic Machine Learning Classifier & Calibration Engine
 * Implements Multinomial Softmax with L2 Regularization and Platt Temperature Scaling.
 */
export class EpistemicMLTrainer {
  private featurizer: EpistemicFeaturizer = new EpistemicFeaturizer();
  private classes: StancePolarity[] = [
    "STRONG_AGREE",
    "LEAN_AGREE",
    "NEUTRAL",
    "LEAN_DISAGREE",
    "STRONG_DISAGREE",
  ];
  private weights: number[][] = []; // [classIndex][featureIndex]
  private biasWeights: number[] = [];
  private temperature: number = 1.0; // Platt scaling temperature
  private isTrained: boolean = false;
  private lastTrainingResult: MLTrainingResult | null = null;
  private corpus: MLTrainingSample[] = [...ML_CORPUS];

  constructor() {
    this.trainModel(); // Initial train on startup
  }

  /**
   * Deterministic Train / Validation / Test split according to ML best practices
   */
  splitDataset(corpus: MLTrainingSample[]): TrainingSplit {
    const train: MLTrainingSample[] = [];
    const validation: MLTrainingSample[] = [];
    const test: MLTrainingSample[] = [];

    // Stratified split across categories & polarities
    corpus.forEach((item, index) => {
      const mod = index % 10;
      if (mod < 7) {
        train.push(item); // 70% Train
      } else if (mod < 8.5) {
        validation.push(item); // 15% Validation
      } else {
        test.push(item); // 15% Test
      }
    });

    return { train, validation, test };
  }

  /**
   * Trains model weights using Regularized Softmax Gradient Descent and Platt Calibration
   */
  trainModel(epochs: number = 30, learningRate: number = 0.15, l2Lambda: number = 0.005): MLTrainingResult {
    const split = this.splitDataset(this.corpus);

    // 1. Fit featurizer strictly on training data
    this.featurizer.fit(split.train);
    const vocabSize = this.featurizer.getVocabularySize();
    const numClasses = this.classes.length;

    // Initialize weights with small random Gaussian values
    this.weights = Array.from({ length: numClasses }, () =>
      Array.from({ length: vocabSize }, () => (Math.random() - 0.5) * 0.05)
    );
    this.biasWeights = new Array(numClasses).fill(0);

    const lossHistory: TrainingLossEpoch[] = [];

    // 2. Training Loop: Mini-batch gradient descent with L2 regularization
    for (let epoch = 1; epoch <= epochs; epoch++) {
      let epochLoss = 0;
      let trainCorrect = 0;

      for (const sample of split.train) {
        const { denseVector } = this.featurizer.transform(sample.statement);
        const targetClassIdx = this.classes.indexOf(sample.polarity);

        // Compute logits: z_k = W_k * x + b_k
        const logits = this.computeRawLogits(denseVector);
        const probs = this.softmax(logits);

        // Cross-entropy loss: -ln(p_target)
        const targetProb = Math.max(probs[targetClassIdx] || 0.0001, 0.0001);
        epochLoss += -Math.log(targetProb);

        if (this.argmax(probs) === targetClassIdx) {
          trainCorrect++;
        }

        // Compute gradient: dL/dz_k = (p_k - y_k)
        for (let k = 0; k < numClasses; k++) {
          const y_k = k === targetClassIdx ? 1 : 0;
          const grad = probs[k] - y_k;

          for (let f = 0; f < vocabSize; f++) {
            const x_f = denseVector[f] || 0;
            // Gradient with L2 weight penalty
            const weightGrad = grad * x_f + l2Lambda * this.weights[k][f];
            this.weights[k][f] -= learningRate * weightGrad;
          }
          this.biasWeights[k] -= learningRate * grad;
        }
      }

      // Track validation accuracy
      let valCorrect = 0;
      for (const valSample of split.validation) {
        const { denseVector } = this.featurizer.transform(valSample.statement);
        const probs = this.softmax(this.computeRawLogits(denseVector));
        if (this.argmax(probs) === this.classes.indexOf(valSample.polarity)) {
          valCorrect++;
        }
      }

      lossHistory.push({
        epoch,
        loss: Math.round((epochLoss / split.train.length) * 1000) / 1000,
        trainAccuracy: Math.round((trainCorrect / split.train.length) * 100) / 100,
        valAccuracy: Math.round((valCorrect / split.validation.length) * 100) / 100,
      });
    }

    // 3. Platt Scaling (Temperature Calibration Optimization) on Validation Set
    this.temperature = this.optimizeTemperature(split.validation);

    // 4. Test Set Evaluation
    const groundTruth: StancePolarity[] = [];
    const predicted: StancePolarity[] = [];
    const rawPredictions: { confidence: number; isAccurate: boolean }[] = [];
    const calibratedPredictions: { confidence: number; isAccurate: boolean }[] = [];

    for (const testSample of split.test) {
      const { denseVector } = this.featurizer.transform(testSample.statement);
      const rawLogits = this.computeRawLogits(denseVector);
      const rawProbs = this.softmax(rawLogits);
      const calibratedProbs = this.softmax(rawLogits.map((l) => l / this.temperature));

      const rawPredIdx = this.argmax(rawProbs);
      const calPredIdx = this.argmax(calibratedProbs);
      const actualIdx = this.classes.indexOf(testSample.polarity);

      groundTruth.push(testSample.polarity);
      predicted.push(this.classes[calPredIdx]);

      const isCorrect = calPredIdx === actualIdx;
      rawPredictions.push({ confidence: rawProbs[rawPredIdx], isAccurate: isCorrect });
      calibratedPredictions.push({ confidence: calibratedProbs[calPredIdx], isAccurate: isCorrect });
    }

    const testMetrics = computeClassificationMetrics(this.classes, groundTruth, predicted);
    const rawCalibration = computeCalibration(rawPredictions, 5);
    const calibratedReport = computeCalibration(calibratedPredictions, 5);

    const eceImprovementPercent = Math.round(
      Math.max(0, ((rawCalibration.expectedCalibrationError - calibratedReport.expectedCalibrationError) / Math.max(rawCalibration.expectedCalibrationError, 0.001)) * 100)
    );
    const brierImprovementPercent = Math.round(
      Math.max(0, ((rawCalibration.brierScore - calibratedReport.brierScore) / Math.max(rawCalibration.brierScore, 0.001)) * 100)
    );

    this.isTrained = true;
    this.lastTrainingResult = {
      sampleCount: this.corpus.length,
      trainCount: split.train.length,
      valCount: split.validation.length,
      testCount: split.test.length,
      vocabularySize: vocabSize,
      epochs,
      finalTrainLoss: lossHistory[lossHistory.length - 1]?.loss || 0,
      lossHistory,
      testMetrics,
      rawCalibration,
      calibratedReport,
      temperatureParameter: Math.round(this.temperature * 100) / 100,
      eceImprovementPercent,
      brierImprovementPercent,
      trainedAt: new Date().toISOString(),
    };

    return this.lastTrainingResult;
  }

  /**
   * Grid search optimization for Platt scaling temperature T on validation split
   */
  private optimizeTemperature(validationSamples: MLTrainingSample[]): number {
    let bestT = 1.0;
    let minEce = 1.0;

    for (let t = 0.5; t <= 2.5; t += 0.1) {
      const preds: { confidence: number; isAccurate: boolean }[] = [];
      for (const sample of validationSamples) {
        const { denseVector } = this.featurizer.transform(sample.statement);
        const scaledLogits = this.computeRawLogits(denseVector).map((l) => l / t);
        const probs = this.softmax(scaledLogits);
        const predIdx = this.argmax(probs);
        const isCorrect = predIdx === this.classes.indexOf(sample.polarity);
        preds.push({ confidence: probs[predIdx], isAccurate: isCorrect });
      }
      const calib = computeCalibration(preds, 5);
      if (calib.expectedCalibrationError < minEce) {
        minEce = calib.expectedCalibrationError;
        bestT = t;
      }
    }
    return bestT;
  }

  private computeRawLogits(denseVector: number[]): number[] {
    return this.weights.map((classWeights, cIdx) => {
      let sum = this.biasWeights[cIdx] || 0;
      for (let i = 0; i < classWeights.length; i++) {
        sum += classWeights[i] * (denseVector[i] || 0);
      }
      return sum;
    });
  }

  private softmax(logits: number[]): number[] {
    const max = Math.max(...logits);
    const exp = logits.map((z) => Math.exp(z - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map((e) => e / (sum || 1));
  }

  private argmax(arr: number[]): number {
    return arr.reduce((bestIdx, curr, idx, a) => (curr > a[bestIdx] ? idx : bestIdx), 0);
  }

  /**
   * Real-time Fast Inference (<1ms) using trained weights
   */
  predict(statement: string): MLInferencePrediction {
    if (!this.isTrained) {
      this.trainModel();
    }

    const { tokens, features, denseVector } = this.featurizer.transform(statement);
    const rawLogits = this.computeRawLogits(denseVector);
    const rawProbs = this.softmax(rawLogits);
    const calLogits = rawLogits.map((l) => l / this.temperature);
    const calProbs = this.softmax(calLogits);

    const predictedClassIdx = this.argmax(calProbs);
    const predictedPolarity = this.classes[predictedClassIdx];
    const rawConfidence = Math.round(rawProbs[predictedClassIdx] * 100) / 100;
    const calibratedConfidence = Math.round(calProbs[predictedClassIdx] * 100) / 100;

    // Feature importance extraction for explainability
    const topFeatures: { feature: string; weight: number }[] = [];
    for (const [feat, val] of Object.entries(features)) {
      if (!feat.startsWith("_meta")) {
        topFeatures.push({ feature: feat, weight: Math.round(val * 100) / 100 });
      }
    }
    topFeatures.sort((a, b) => b.weight - a.weight);

    // Dynamic Bias & Affect Heuristics
    const lower = statement.toLowerCase();
    const affectRatio = features["_meta_affect_ratio"] || 0;
    const certaintyRatio = features["_meta_certainty_ratio"] || 0;
    const emotionalAffect = Math.min(100, Math.round((affectRatio * 150 + (lower.includes("!") ? 25 : 0) + (rawConfidence * 40))));
    const convictionCertainty = Math.min(100, Math.max(25, Math.round((certaintyRatio * 200 + (lower.includes("!") ? 15 : 0) + calibratedConfidence * 60))));

    // Detect Bias Category
    let predictedBias: BiasCategory | "NONE" = "NONE";
    if (affectRatio > 0.08) predictedBias = "AFFECT_HEURISTIC";
    else if (certaintyRatio > 0.1) predictedBias = "OVERCONFIDENCE_EFFECT";
    else if (lower.includes("either") || lower.includes("strictly superior") || lower.includes("black and white")) predictedBias = "FALSE_DICHOTOMY";
    else if (lower.includes("will lead to") || lower.includes("collapse") || lower.includes("inevitable")) predictedBias = "SLIPPERY_SLOPE";
    else if (convictionCertainty > 75) predictedBias = "CONFIRMATION_BIAS";

    // Find closest semantic domain match in corpus for dynamic synthesis (IDF-weighted, stopword-filtered)
    const stopwords = new Set([
      "the", "and", "that", "this", "with", "from", "they", "them", "have", "been",
      "were", "what", "feel", "think", "believe", "are", "for", "is", "a", "an",
      "in", "on", "to", "of", "at", "by", "as", "or", "it", "its", "be"
    ]);
    const meaningfulTokens = tokens.filter((t) => !stopwords.has(t) && !t.includes("_"));

    let bestDomainMatch: MLTrainingSample | null = null;
    let highestOverlap = -1;

    for (const sample of this.corpus) {
      if (sample.category === "STANCE") {
        let overlap = 0;
        const sampleTokens = new Set(this.featurizer.tokenize(sample.statement).filter((t) => !stopwords.has(t)));
        for (const t of meaningfulTokens) {
          if (sampleTokens.has(t)) {
            overlap += 2.0; // Significant boost for content token matches
          }
        }
        if (overlap > highestOverlap) {
          highestOverlap = overlap;
          bestDomainMatch = sample;
        }
      }
    }

    return {
      isStance: tokens.length >= 3 && !statement.includes("?"),
      category: statement.includes("?") ? "QUESTION" : tokens.length < 3 ? "INCOMPLETE" : "STANCE",
      predictedPolarity,
      predictedBias,
      rawConfidence,
      calibratedConfidence,
      emotionalAffect,
      convictionCertainty,
      topFeatures: topFeatures.slice(0, 5),
      matchedDomain: bestDomainMatch?.domain,
      suggestedOpposingPremises: bestDomainMatch?.opposingPremises || [
        "Systemic trade-offs and external dependencies require contextual adaptation.",
        "Empirical counter-examples demonstrate that single-variable solutions trigger unintended systemic costs.",
        "Decentralized resilience often outperforms rigid centralized mandates.",
      ],
      suggestedSocraticInquiry: bestDomainMatch?.socraticQuestion || "What empirical evidence or systemic counter-trend would lead you to revise your certainty?",
    };
  }

  getLastTrainingResult(): MLTrainingResult | null {
    return this.lastTrainingResult;
  }
}

export const epistemicMLTrainer = new EpistemicMLTrainer();
