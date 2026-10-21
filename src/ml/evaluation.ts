import {
  computeCalibration,
  computeClassificationMetrics,
  evaluateSteelmanQuality,
  type CalibrationReport,
  type ClassificationMetrics,
} from "./metrics.js";
import type { StancePolarity, SteelmanResponse } from "../types/index.js";

export interface BenchmarkCase {
  id: string;
  topicDomain: string;
  statement: string;
  groundTruthPolarity: StancePolarity;
  expectedConfidenceRange: [number, number]; // [min, max]
  keyBlindSpots: string[];
}

export const BENCHMARK_DATASET: BenchmarkCase[] = [
  {
    id: "case-01",
    topicDomain: "Workplace & Labor",
    statement: "Remote work is destroying company culture and productivity, and everyone must return to the office.",
    groundTruthPolarity: "STRONG_AGREE",
    expectedConfidenceRange: [0.85, 0.98],
    keyBlindSpots: [
      "Deep-work focus gains from uninterrupted time",
      "Global access to top-tier specialized talent without relocation friction",
      "Asynchronous documentation habits replacing fragile tribal knowledge",
    ],
  },
  {
    id: "case-02",
    topicDomain: "Workplace & Labor",
    statement: "Offices are completely obsolete and companies forcing hybrid schedules are just run by insecure micromanagers.",
    groundTruthPolarity: "STRONG_AGREE",
    expectedConfidenceRange: [0.85, 0.99],
    keyBlindSpots: [
      "Serendipitous cross-departmental encounters and informal mentoring",
      "Tactile collaboration latency during high-ambiguity crisis resolution",
      "Onboarding isolation and velocity degradation for junior apprentices",
    ],
  },
  {
    id: "case-03",
    topicDomain: "AI Safety & Governance",
    statement: "Frontier AI development should be paused immediately by global treaties because extinction risks outweigh any economic upside.",
    groundTruthPolarity: "STRONG_AGREE",
    expectedConfidenceRange: [0.8, 0.95],
    keyBlindSpots: [
      "Treaty verification impossibility with distributed GPU clusters and adversarial geopolitical competitors",
      "Humanitarian and medical opportunity costs of slowing cure discoveries",
      "Regulatory capture locking in existing dominant tech monopolies",
    ],
  },
  {
    id: "case-04",
    topicDomain: "Energy & Climate",
    statement: "Nuclear energy is too expensive, slow to build, and inherently dangerous to play any serious role in decarbonization.",
    groundTruthPolarity: "STRONG_AGREE",
    expectedConfidenceRange: [0.8, 0.95],
    keyBlindSpots: [
      "Baseload grid stability without massive battery storage mining footprints",
      "Lowest lifecycle deaths per terawatt-hour among all energy sources",
      "Modern Small Modular Reactors (SMRs) with passive walk-away safety systems",
    ],
  },
  {
    id: "case-05",
    topicDomain: "Software Engineering",
    statement: "Dynamic languages are completely unacceptable for enterprise software; static typing is strictly superior in every single scenario.",
    groundTruthPolarity: "STRONG_AGREE",
    expectedConfidenceRange: [0.82, 0.96],
    keyBlindSpots: [
      "Rapid prototyping velocity and exploratory data science iteration cycles",
      "Type system architectural overhead and complex generic boilerplate in early-stage validation",
      "Dynamic meta-programming and expressive DSL flexibility in runtime environments",
    ],
  },
];

export interface BenchmarkEvaluationSummary {
  sampleCount: number;
  classificationMetrics: ClassificationMetrics;
  calibrationReport: CalibrationReport;
  domainSliceMetrics: Record<
    string,
    {
      count: number;
      averageConfidence: number;
      accuracy: number;
    }
  >;
  averageSteelmanQualityScore: number;
}

export function runBenchmarkEvaluation(
  modelPredictions: {
    caseId: string;
    predictedPolarity: StancePolarity;
    predictedConfidence: number;
    steelman: SteelmanResponse;
  }[]
): BenchmarkEvaluationSummary {
  const polarities: StancePolarity[] = [
    "STRONG_AGREE",
    "LEAN_AGREE",
    "NEUTRAL",
    "LEAN_DISAGREE",
    "STRONG_DISAGREE",
  ];

  const groundTruthList: string[] = [];
  const predictedList: string[] = [];
  const calibrationSamples: { confidence: number; isAccurate: boolean }[] = [];
  const domainSlices: Record<string, { count: number; totalConf: number; correct: number }> = {};
  let totalSteelmanScore = 0;

  for (const pred of modelPredictions) {
    const bench = BENCHMARK_DATASET.find((b) => b.id === pred.caseId);
    if (!bench) continue;

    groundTruthList.push(bench.groundTruthPolarity);
    predictedList.push(pred.predictedPolarity);

    const isAccurate = bench.groundTruthPolarity === pred.predictedPolarity;
    calibrationSamples.push({
      confidence: pred.predictedConfidence,
      isAccurate,
    });

    if (!domainSlices[bench.topicDomain]) {
      domainSlices[bench.topicDomain] = { count: 0, totalConf: 0, correct: 0 };
    }
    domainSlices[bench.topicDomain].count++;
    domainSlices[bench.topicDomain].totalConf += pred.predictedConfidence;
    if (isAccurate) domainSlices[bench.topicDomain].correct++;

    const sqi = evaluateSteelmanQuality(
      pred.steelman.say,
      pred.steelman.opposingThesis,
      pred.steelman.coreArguments,
      pred.steelman.epistemicQuestion
    );
    totalSteelmanScore += sqi.compositeScore;
  }

  const classificationMetrics = computeClassificationMetrics(
    polarities,
    groundTruthList,
    predictedList
  );

  const calibrationReport = computeCalibration(calibrationSamples, 5);

  const domainSliceMetrics: Record<
    string,
    { count: number; averageConfidence: number; accuracy: number }
  > = {};
  for (const [domain, stats] of Object.entries(domainSlices)) {
    domainSliceMetrics[domain] = {
      count: stats.count,
      averageConfidence: Number((stats.totalConf / stats.count).toFixed(3)),
      accuracy: Number((stats.correct / stats.count).toFixed(3)),
    };
  }

  return {
    sampleCount: modelPredictions.length,
    classificationMetrics,
    calibrationReport,
    domainSliceMetrics,
    averageSteelmanQualityScore:
      modelPredictions.length > 0
        ? Number((totalSteelmanScore / modelPredictions.length).toFixed(1))
        : 0,
  };
}
