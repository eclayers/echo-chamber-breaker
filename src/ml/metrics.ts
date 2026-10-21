/**
 * Machine Learning & Epistemic Calibration Metrics
 * Implements calibration (ECE, Brier Score), confusion matrices, and Steelman Quality Index (SQI).
 */

export interface CalibrationBin {
  binIndex: number;
  confidenceLower: number;
  confidenceUpper: number;
  count: number;
  avgConfidence: number;
  accuracy: number;
}

export interface CalibrationReport {
  expectedCalibrationError: number; // ECE (0.0 to 1.0, lower is better calibrated)
  maximumCalibrationError: number; // MCE
  brierScore: number; // Brier score (0.0 to 1.0, lower is better)
  sampleCount: number;
  bins: CalibrationBin[];
}

export interface ClassificationMetrics {
  accuracy: number;
  macroF1: number;
  classMetrics: Record<
    string,
    {
      precision: number;
      recall: number;
      f1Score: number;
      support: number;
    }
  >;
  confusionMatrix: Record<string, Record<string, number>>;
}

export interface SteelmanQualityIndex {
  voiceWordCount: number;
  isVoiceCompliant: boolean; // <= 40 words
  premiseCount: number;
  charityScore: number; // 0 to 100
  epistemicDepthScore: number; // 0 to 100
  compositeScore: number; // 0 to 100
  grade: "A+" | "A" | "B" | "C" | "NEEDS_IMPROVEMENT";
}

/**
 * Computes Expected Calibration Error (ECE) and Brier Score
 * Evaluates whether predicted confidence aligns with observed correctness/calibration.
 */
export function computeCalibration(
  predictions: { confidence: number; isAccurate: boolean }[],
  numBins: number = 10
): CalibrationReport {
  if (predictions.length === 0) {
    return {
      expectedCalibrationError: 0,
      maximumCalibrationError: 0,
      brierScore: 0,
      sampleCount: 0,
      bins: [],
    };
  }

  // Calculate Brier Score: (1/N) * sum((p - y)^2)
  let brierSum = 0;
  for (const p of predictions) {
    const y = p.isAccurate ? 1 : 0;
    brierSum += Math.pow(p.confidence - y, 2);
  }
  const brierScore = brierSum / predictions.length;

  // Initialize bins
  const bins: {
    items: { confidence: number; isAccurate: boolean }[];
    lower: number;
    upper: number;
  }[] = [];

  for (let i = 0; i < numBins; i++) {
    bins.push({
      items: [],
      lower: i / numBins,
      upper: (i + 1) / numBins,
    });
  }

  // Place samples into bins
  for (const pred of predictions) {
    const clampedConf = Math.min(Math.max(pred.confidence, 0), 0.9999);
    const binIndex = Math.floor(clampedConf * numBins);
    bins[binIndex].items.push(pred);
  }

  let totalEce = 0;
  let maxCe = 0;
  const processedBins: CalibrationBin[] = [];

  for (let i = 0; i < numBins; i++) {
    const bin = bins[i];
    const count = bin.items.length;
    if (count === 0) {
      processedBins.push({
        binIndex: i,
        confidenceLower: bin.lower,
        confidenceUpper: bin.upper,
        count: 0,
        avgConfidence: (bin.lower + bin.upper) / 2,
        accuracy: 0,
      });
      continue;
    }

    const avgConfidence = bin.items.reduce((s, it) => s + it.confidence, 0) / count;
    const accurateCount = bin.items.filter((it) => it.isAccurate).length;
    const accuracy = accurateCount / count;
    const calibrationGap = Math.abs(accuracy - avgConfidence);

    totalEce += (count / predictions.length) * calibrationGap;
    if (calibrationGap > maxCe) {
      maxCe = calibrationGap;
    }

    processedBins.push({
      binIndex: i,
      confidenceLower: bin.lower,
      confidenceUpper: bin.upper,
      count,
      avgConfidence,
      accuracy,
    });
  }

  return {
    expectedCalibrationError: Number(totalEce.toFixed(4)),
    maximumCalibrationError: Number(maxCe.toFixed(4)),
    brierScore: Number(brierScore.toFixed(4)),
    sampleCount: predictions.length,
    bins: processedBins,
  };
}

/**
 * Computes confusion matrix and multi-class classification metrics (Precision, Recall, F1).
 */
export function computeClassificationMetrics(
  labels: string[],
  groundTruth: string[],
  predicted: string[]
): ClassificationMetrics {
  const confusion: Record<string, Record<string, number>> = {};
  for (const l1 of labels) {
    confusion[l1] = {};
    for (const l2 of labels) {
      confusion[l1][l2] = 0;
    }
  }

  let correct = 0;
  for (let i = 0; i < groundTruth.length; i++) {
    const actual = groundTruth[i];
    const pred = predicted[i];
    if (confusion[actual] && confusion[actual][pred] !== undefined) {
      confusion[actual][pred]++;
    }
    if (actual === pred) correct++;
  }

  const classMetrics: Record<
    string,
    { precision: number; recall: number; f1Score: number; support: number }
  > = {};
  let macroF1Sum = 0;

  for (const label of labels) {
    const tp = confusion[label][label] || 0;
    let fp = 0;
    let fn = 0;

    for (const other of labels) {
      if (other !== label) {
        fp += confusion[other][label] || 0;
        fn += confusion[label][other] || 0;
      }
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const support = tp + fn;

    classMetrics[label] = {
      precision: Number(precision.toFixed(3)),
      recall: Number(recall.toFixed(3)),
      f1Score: Number(f1Score.toFixed(3)),
      support,
    };
    macroF1Sum += f1Score;
  }

  return {
    accuracy: Number((correct / Math.max(1, groundTruth.length)).toFixed(3)),
    macroF1: Number((macroF1Sum / Math.max(1, labels.length)).toFixed(3)),
    classMetrics,
    confusionMatrix: confusion,
  };
}

/**
 * Evaluates the quality of a generated steelman argument.
 * Verifies voice brevity (< 40 words), charity, structural depth, and inquiry potency.
 */
export function evaluateSteelmanQuality(
  sayText: string,
  opposingThesis: string,
  premises: { premise: string; evidenceOrMechanism: string }[],
  epistemicQuestion: string
): SteelmanQualityIndex {
  const words = sayText.trim().split(/\s+/).filter(Boolean);
  const voiceWordCount = words.length;
  const isVoiceCompliant = voiceWordCount > 0 && voiceWordCount <= 40;

  const premiseCount = premises.length;

  // Charity assessment heuristics:
  // - High score for structured evidence and absence of aggressive ad-hominem terms
  const lowerThesis = (opposingThesis + " " + sayText).toLowerCase();
  const toxicMarkers = ["stupid", "idiotic", "clueless", "absurd", "obviously wrong", "fake news"];
  const hasToxicMarkers = toxicMarkers.some((m) => lowerThesis.includes(m));

  let charityScore = 80;
  if (hasToxicMarkers) charityScore -= 40;
  if (premises.some((p) => p.evidenceOrMechanism.length > 20)) charityScore += 15;
  if (isVoiceCompliant) charityScore += 5;
  charityScore = Math.min(100, Math.max(0, charityScore));

  // Epistemic depth: Question ends with '?' and has nuance
  let epistemicDepthScore = 70;
  if (epistemicQuestion.includes("?")) epistemicDepthScore += 15;
  if (epistemicQuestion.length >= 35) epistemicDepthScore += 15;
  epistemicDepthScore = Math.min(100, Math.max(0, epistemicDepthScore));

  const compositeScore = Math.round(
    charityScore * 0.45 + epistemicDepthScore * 0.35 + (isVoiceCompliant ? 20 : 0)
  );

  let grade: SteelmanQualityIndex["grade"] = "NEEDS_IMPROVEMENT";
  if (compositeScore >= 92) grade = "A+";
  else if (compositeScore >= 80) grade = "A";
  else if (compositeScore >= 68) grade = "B";
  else if (compositeScore >= 50) grade = "C";

  return {
    voiceWordCount,
    isVoiceCompliant,
    premiseCount,
    charityScore,
    epistemicDepthScore,
    compositeScore,
    grade,
  };
}
