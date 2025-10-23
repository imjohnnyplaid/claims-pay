import type { Provider } from "@shared/schema";
import { ehrEmulator } from "./ehr-emulator";

/**
 * EHR Integration Service
 * Connects to various EHR systems (Epic, Cerner, etc.) using FHIR R4 API
 * to automatically pull claims/encounters for same-day payment processing
 * 
 * Also supports EHR Emulator for testing
 */

// OAuth2 token cache to avoid repeated auth calls
const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

export interface FHIREncounter {
  id: string;
  patientName: string;
  patientId: string;
  date: string;
  type: string;
  diagnoses: string[];
  procedures: string[];
  totalCharge: number;
  notes: string;
}

/**
 * Get OAuth2 access token for EHR system
 */
async function getAccessToken(provider: Provider): Promise<string> {
  if (!provider.ehrClientId || !provider.ehrClientSecret || !provider.ehrApiEndpoint) {
    throw new Error("EHR credentials not configured");
  }

  const cacheKey = `${provider.id}-${provider.ehrSystem}`;
  const cached = tokenCache.get(cacheKey);

  // Return cached token if still valid (5 min buffer)
  if (cached && cached.expiresAt > Date.now() + 300000) {
    return cached.accessToken;
  }

  // Determine OAuth2 token endpoint based on EHR system
  const tokenEndpoint = getTokenEndpoint(provider.ehrSystem!, provider.ehrApiEndpoint);

  try {
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: provider.ehrClientId,
        client_secret: provider.ehrClientSecret,
        scope: "system/Encounter.read system/Patient.read system/Condition.read system/Procedure.read",
      }),
    });

    if (!response.ok) {
      throw new Error(`OAuth2 failed: ${response.statusText}`);
    }

    const data = await response.json();
    const expiresAt = Date.now() + (data.expires_in * 1000);

    // Cache token
    tokenCache.set(cacheKey, {
      accessToken: data.access_token,
      expiresAt,
    });

    return data.access_token;
  } catch (error: any) {
    throw new Error(`Failed to authenticate with ${provider.ehrSystem}: ${error.message}`);
  }
}

/**
 * Get token endpoint URL based on EHR system
 */
function getTokenEndpoint(ehrSystem: string, baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/$/, "");
  
  switch (ehrSystem) {
    case "Epic":
      return `${cleanBase}/oauth2/token`;
    case "Cerner":
      return `${cleanBase}/tenants/{tenant_id}/protocols/oauth2/profiles/smart-v1/token`;
    case "Athenahealth":
      return `${cleanBase}/oauth2/v1/token`;
    case "Allscripts":
      return `${cleanBase}/oauth/token`;
    default:
      // Generic FHIR OAuth2
      return `${cleanBase}/auth/token`;
  }
}

/**
 * Fetch new encounters from EHR system since last sync
 */
export async function fetchNewEncounters(
  provider: Provider,
  sinceDate?: Date
): Promise<FHIREncounter[]> {
  if (!provider.ehrEnabled) {
    return [];
  }

  // Check if this is the emulator - runs before API endpoint check
  if (provider.ehrSystem === "EHR_EMULATOR" || ehrEmulator.isEnabledForProvider(provider.id)) {
    const emulatedEncounters = ehrEmulator.getNewEncountersSince(sinceDate);
    return emulatedEncounters.map(enc => ({
      id: enc.id,
      patientName: enc.patientName,
      patientId: enc.patientId,
      date: enc.encounterDate,
      type: "Emulated Encounter",
      diagnoses: [enc.diagnosis],
      procedures: [enc.procedure],
      totalCharge: enc.totalCharge,
      notes: enc.notes,
    }));
  }

  // For real EHR systems, require API endpoint
  if (!provider.ehrApiEndpoint) {
    return [];
  }

  try {
    const accessToken = await getAccessToken(provider);
    const since = sinceDate || provider.ehrLastSync || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sinceISO = since.toISOString();

    // Fetch encounters using FHIR R4 API
    const encountersUrl = `${provider.ehrApiEndpoint}/Encounter?date=ge${sinceISO}&_include=Encounter:patient&_include=Encounter:diagnosis&_include=Encounter:procedure&_count=50`;

    const response = await fetch(encountersUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/fhir+json",
      },
    });

    if (!response.ok) {
      throw new Error(`FHIR API error: ${response.status} ${response.statusText}`);
    }

    const bundle = await response.json();

    if (!bundle.entry || bundle.entry.length === 0) {
      return [];
    }

    // Parse FHIR resources into our format
    const encounters: FHIREncounter[] = [];
    const resources = bundle.entry.map((e: any) => e.resource);

    const encounterResources = resources.filter((r: any) => r.resourceType === "Encounter");
    const patientResources = resources.filter((r: any) => r.resourceType === "Patient");
    const conditionResources = resources.filter((r: any) => r.resourceType === "Condition");
    const procedureResources = resources.filter((r: any) => r.resourceType === "Procedure");

    for (const encounter of encounterResources) {
      // Get patient info
      const patientRef = encounter.subject?.reference;
      const patient = patientResources.find((p: any) => p.id === patientRef?.split("/")[1]);
      const patientName = patient
        ? `${patient.name?.[0]?.given?.join(" ")} ${patient.name?.[0]?.family}`
        : "Unknown Patient";

      // Get diagnoses (conditions)
      const diagnoses = conditionResources
        .filter((c: any) => c.encounter?.reference?.includes(encounter.id))
        .map((c: any) => c.code?.coding?.[0]?.display || c.code?.text || "Unknown");

      // Get procedures
      const procedures = procedureResources
        .filter((p: any) => p.encounter?.reference?.includes(encounter.id))
        .map((p: any) => p.code?.coding?.[0]?.display || p.code?.text || "Unknown");

      // Extract charge amount (if available in extension or custom field)
      const totalCharge = extractChargeAmount(encounter);

      // Build clinical notes from encounter
      const notes = buildClinicalNotes(encounter, diagnoses, procedures);

      encounters.push({
        id: encounter.id,
        patientName,
        patientId: patient?.id || encounter.id,
        date: encounter.period?.start || new Date().toISOString(),
        type: encounter.type?.[0]?.coding?.[0]?.display || "Encounter",
        diagnoses,
        procedures,
        totalCharge,
        notes,
      });
    }

    return encounters;
  } catch (error: any) {
    console.error(`Failed to fetch encounters from ${provider.ehrSystem}:`, error);
    throw new Error(`EHR sync failed: ${error.message}`);
  }
}

/**
 * Extract charge amount from encounter
 * This varies by EHR system - often in extensions or custom fields
 */
function extractChargeAmount(encounter: any): number {
  // Try common locations for charge data
  if (encounter.extension) {
    const chargeExt = encounter.extension.find(
      (e: any) => e.url?.includes("charge") || e.url?.includes("cost")
    );
    if (chargeExt?.valueMoney?.value) {
      return parseFloat(chargeExt.valueMoney.value);
    }
  }

  // Default estimate based on encounter type
  const encounterType = encounter.type?.[0]?.coding?.[0]?.code || "";
  if (encounterType.includes("99213") || encounterType.includes("outpatient")) {
    return 150.0; // Typical office visit
  }
  if (encounterType.includes("99214")) {
    return 200.0; // Complex office visit
  }
  if (encounterType.includes("99215")) {
    return 250.0; // High complexity
  }

  return 150.0; // Default estimate
}

/**
 * Build clinical notes from FHIR encounter data
 */
function buildClinicalNotes(
  encounter: any,
  diagnoses: string[],
  procedures: string[]
): string {
  const parts: string[] = [];

  // Encounter type
  const type = encounter.type?.[0]?.coding?.[0]?.display || "Clinical encounter";
  parts.push(`Encounter Type: ${type}`);

  // Chief complaint / reason
  if (encounter.reasonCode?.[0]) {
    const reason = encounter.reasonCode[0].coding?.[0]?.display || encounter.reasonCode[0].text;
    parts.push(`Chief Complaint: ${reason}`);
  }

  // Diagnoses
  if (diagnoses.length > 0) {
    parts.push(`Diagnoses: ${diagnoses.join(", ")}`);
  }

  // Procedures
  if (procedures.length > 0) {
    parts.push(`Procedures: ${procedures.join(", ")}`);
  }

  // Duration
  if (encounter.period?.start && encounter.period?.end) {
    const start = new Date(encounter.period.start);
    const end = new Date(encounter.period.end);
    const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
    parts.push(`Duration: ${durationMin} minutes`);
  }

  return parts.join(". ");
}

/**
 * Test EHR connection
 */
export async function testEHRConnection(provider: Provider): Promise<boolean> {
  // Emulator always works
  if (provider.ehrSystem === "EHR_EMULATOR" || ehrEmulator.isEnabledForProvider(provider.id)) {
    return true;
  }
  
  try {
    await getAccessToken(provider);
    return true;
  } catch (error) {
    return false;
  }
}
