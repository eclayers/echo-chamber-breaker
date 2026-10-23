import { describe, it, expect } from "vitest";
import { cognitiveAdapter, detectLanguage } from "../src/services/bedrockAdapter.js";
import { honestyEngine } from "../src/services/honestyEngine.js";

describe("Multilingual LLM Understanding & Epistemic Synthesis Suite", () => {
  it("detects diverse world languages accurately across scripts and vocabularies", () => {
    expect(detectLanguage("La energía nuclear es esencial para combatir el cambio climático.").code).toBe("es");
    expect(detectLanguage("Le travail à distance détruit la créativité et la culture d'entreprise.").code).toBe("fr");
    expect(detectLanguage("Künstliche Intelligenz bedroht die menschliche Autonomie und Arbeit.").code).toBe("de");
    expect(detectLanguage("अंतरिक्ष अन्वेषण पर अत्यधिक धन खर्च करना अनुचित है।").code).toBe("hi");
    expect(detectLanguage("Nuclear energy is vital for zero-emission baseload grid stability.").code).toBe("en");
  });

  it("understands and steelmans a Spanish conviction with authentic Spanish dialectics and brevity", async () => {
    const spanishClaim = "La energía nuclear es demasiado peligrosa y los residuos son un riesgo inaceptable.";
    const stance = await cognitiveAdapter.analyzeStance(spanishClaim);
    expect(stance.is_stance).toBe(true);

    const steelman = await cognitiveAdapter.generateSteelman(spanishClaim, stance);
    expect(steelman.is_stance).toBe(true);
    expect(steelman.opposingThesis).toContain("mecanismos fundamentales");
    expect(steelman.epistemicQuestion).toContain("condiciones empíricas");
    
    // Voice brevity
    const wordCount = steelman.say.trim().split(/\s+/).length;
    expect(wordCount).toBeLessThanOrEqual(40);
  });

  it("understands and steelmans a French conviction with native French arguments and Socratic inquiry", async () => {
    const frenchClaim = "Le travail à distance détruit la culture d'entreprise et l'innovation collective.";
    const steelman = await cognitiveAdapter.generateSteelman(frenchClaim);
    expect(steelman.is_stance).toBe(true);
    expect(steelman.opposingThesis).toContain("mécanismes fondamentaux");
    expect(steelman.epistemicQuestion).toContain("conditions empiriques");
    
    const wordCount = steelman.say.trim().split(/\s+/).length;
    expect(wordCount).toBeLessThanOrEqual(40);
  });

  it("recognizes multilingual concessions and rewards intellectual honesty (+8.5 pts)", async () => {
    const mockSteelman = await cognitiveAdapter.generateSteelman("Universal basic income causes systemic inflation.");
    
    // Spanish concession
    const spanishConcession = await cognitiveAdapter.evaluateEngagement(
      "Reconozco que tienes razón sobre los incentivos y la resiliencia sistémica.",
      mockSteelman
    );
    expect(spanishConcession.quality).toBe("CONCESSION");
    expect(spanishConcession.scoreDelta).toBe(8.5);

    // French concession
    const frenchConcession = await cognitiveAdapter.evaluateEngagement(
      "Je concède ce point essentiel concernant les mécanismes de rétroaction.",
      mockSteelman
    );
    expect(frenchConcession.quality).toBe("CONCESSION");
    expect(frenchConcession.scoreDelta).toBe(8.5);

    // German concession
    const germanConcession = await cognitiveAdapter.evaluateEngagement(
      "Ich gebe zu, dass diese systemischen Puffer eine entscheidende Rolle spielen.",
      mockSteelman
    );
    expect(germanConcession.quality).toBe("CONCESSION");
    expect(germanConcession.scoreDelta).toBe(8.5);
  });

  it("synthesizes dynamic LLM epistemic diagnostic reports in Spanish, French, German, and Hindi", async () => {
    const userId = `multilingual-user-${Date.now()}`;
    
    // Initialize user with a debate concession event
    await honestyEngine.calibrateBaseline(userId, 68.0, "Initial calibration");
    await honestyEngine.applyEngagement(
      userId,
      {
        quality: "CONCESSION",
        scoreDelta: 8.5,
        reason: "Updated view when presented with empirical longitudinal data.",
        addressedBlindSpots: ["Longitudinal stability"],
        acknowledgedValidPoints: ["Historical resilience"],
        counterQualityScore: 95,
        feedbackSay: "Exemplary concession.",
      },
      "Decentralized Energy",
      "mock-session"
    );

    // 1. Spanish Report
    const esReport = await honestyEngine.getHonestyReport(userId, "es");
    expect(esReport.detectedLanguage).toBe("es");
    expect(esReport.summaryInsights.length).toBeGreaterThanOrEqual(2);
    expect(esReport.summaryInsights.some((s) => s.includes("disposición") || s.includes("creencias") || s.includes("concesiones"))).toBe(true);

    // 2. French Report
    const frReport = await honestyEngine.getHonestyReport(userId, "fr");
    expect(frReport.detectedLanguage).toBe("fr");
    expect(frReport.summaryInsights.some((s) => s.includes("volonté") || s.includes("croyances") || s.includes("concession"))).toBe(true);

    // 3. German Report
    const deReport = await honestyEngine.getHonestyReport(userId, "de");
    expect(deReport.detectedLanguage).toBe("de");
    expect(deReport.summaryInsights.some((s) => s.includes("Bereitschaft") || s.includes("Überzeugungsanpassungen") || s.includes("Zugeständnisse"))).toBe(true);

    // 4. Hindi Report
    const hiReport = await honestyEngine.getHonestyReport(userId, "hi");
    expect(hiReport.detectedLanguage).toBe("hi");
    expect(hiReport.summaryInsights.some((s) => s.includes("सहमति") || s.includes("संशोधन") || s.includes("रियायतें") || s.includes("तार्किक"))).toBe(true);
  });
});
