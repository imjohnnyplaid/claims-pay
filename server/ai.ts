// javascript_openai integration - AI services for claim coding and risk assessment
import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing required OpenAI secret: OPENAI_API_KEY');
}

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ClaimCodes {
  icd10?: string[];
  cpt?: string[];
}

export async function autoCodeClaim(rawClaimData: string): Promise<ClaimCodes> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are a medical coding expert. Analyze healthcare claim data and assign appropriate ICD-10 diagnosis codes and CPT procedure codes. Respond with JSON in this exact format: { "icd10": ["code1", "code2"], "cpt": ["code1", "code2"] }`,
        },
        {
          role: "user",
          content: `Analyze this claim and provide ICD-10 and CPT codes:\n\n${rawClaimData}`,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1000,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      icd10: result.icd10 || [],
      cpt: result.cpt || [],
    };
  } catch (error: any) {
    console.error("AI coding error:", error);
    // Fallback to basic codes if AI fails
    return {
      icd10: ["Z00.00"], // General medical examination
      cpt: ["99213"], // Office visit
    };
  }
}

export async function calculateRiskScore(
  claimAmount: number,
  codes: ClaimCodes,
  providerHistory?: {
    totalClaims: number;
    acceptedClaims: number;
    avgClaimAmount: number;
  }
): Promise<number> {
  // Rule-based risk scoring (0-100, higher = better)
  let score = 50; // Base score

  // Factor 1: Claim amount (reasonable amounts score higher)
  if (claimAmount > 0 && claimAmount < 10000) {
    score += 20; // Typical claim range
  } else if (claimAmount >= 10000 && claimAmount < 50000) {
    score += 10; // Higher claims get moderate boost
  } else if (claimAmount >= 50000) {
    score -= 10; // Very high claims are riskier
  }

  // Factor 2: Coding completeness (both ICD-10 and CPT present)
  if (codes.icd10 && codes.icd10.length > 0) {
    score += 15;
  }
  if (codes.cpt && codes.cpt.length > 0) {
    score += 15;
  }

  // Factor 3: Provider history
  if (providerHistory) {
    const acceptanceRate = (providerHistory.acceptedClaims / providerHistory.totalClaims) * 100;
    if (acceptanceRate > 90) {
      score += 20; // Excellent track record
    } else if (acceptanceRate > 70) {
      score += 10; // Good track record
    } else if (acceptanceRate < 50) {
      score -= 15; // Poor track record
    }
  }

  // Ensure score is within 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function enhanceRiskScoreWithAI(
  claimAmount: number,
  codes: ClaimCodes,
  rawClaimData: string
): Promise<number> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are a healthcare claims risk analyst. Assess the likelihood that an insurance claim will be approved based on the provided information. Score from 0-100 where 100 = very likely to be approved, 0 = very likely to be denied. Respond with JSON: { "score": number, "reason": string }`,
        },
        {
          role: "user",
          content: `Assess this claim:
Amount: $${claimAmount}
ICD-10 Codes: ${codes.icd10?.join(", ") || "None"}
CPT Codes: ${codes.cpt?.join(", ") || "None"}
Details: ${rawClaimData}`,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return Math.max(0, Math.min(100, Math.round(result.score || 50)));
  } catch (error: any) {
    console.error("AI risk scoring error:", error);
    // Fallback to rule-based scoring
    return calculateRiskScore(claimAmount, codes);
  }
}
