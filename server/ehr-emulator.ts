/**
 * Enhanced EHR Emulator - Comprehensive medical encounter generation
 * Generates realistic patients, encounters with detailed line items, diagnoses, and procedures
 */

export interface EmulatedPatient {
  id: string;
  name: string;
  dob: string;
  gender: string;
  mrn: string; // Medical Record Number
}

export interface ProcedureLineItem {
  cptCode: string;
  description: string;
  modifiers?: string[]; // CPT modifiers like -25, -59, etc.
  units: number;
  chargePerUnit: number;
  totalCharge: number;
}

export interface DiagnosisCode {
  icd10Code: string;
  description: string;
  isPrimary: boolean;
}

export interface EmulatedEncounter {
  id: string;
  patientId: string;
  patientName: string;
  encounterDate: string;
  chiefComplaint: string;
  diagnoses: DiagnosisCode[];
  procedures: ProcedureLineItem[];
  totalCharge: number;
  notes: string;
  // FHIR-like structure for AI coding
  structuredData: {
    resourceType: string;
    patient: { id: string; name: string };
    encounter: { id: string; date: string };
    conditions: Array<{ code: string; display: string }>;
    procedures: Array<{ code: string; display: string; quantity: number; charge: number; modifiers?: string[] }>;
  };
}

// Sample patient database
const SAMPLE_PATIENTS: EmulatedPatient[] = [
  { id: "emu-patient-001", name: "John Smith", dob: "1985-03-15", gender: "Male", mrn: "MRN001" },
  { id: "emu-patient-002", name: "Sarah Johnson", dob: "1990-07-22", gender: "Female", mrn: "MRN002" },
  { id: "emu-patient-003", name: "Michael Davis", dob: "1978-11-08", gender: "Male", mrn: "MRN003" },
  { id: "emu-patient-004", name: "Emily Williams", dob: "1995-05-30", gender: "Female", mrn: "MRN004" },
  { id: "emu-patient-005", name: "Robert Brown", dob: "1972-09-14", gender: "Male", mrn: "MRN005" },
  { id: "emu-patient-006", name: "Jennifer Martinez", dob: "1988-12-03", gender: "Female", mrn: "MRN006" },
  { id: "emu-patient-007", name: "David Anderson", dob: "1965-06-20", gender: "Male", mrn: "MRN007" },
  { id: "emu-patient-008", name: "Lisa Taylor", dob: "1992-04-18", gender: "Female", mrn: "MRN008" },
];

// Comprehensive medical scenarios with detailed coding
const MEDICAL_SCENARIOS = [
  {
    chiefComplaint: "Acute bronchitis with productive cough",
    diagnoses: [
      { icd10Code: "J20.9", description: "Acute bronchitis, unspecified", isPrimary: true },
      { icd10Code: "R05.1", description: "Acute cough", isPrimary: false },
      { icd10Code: "R50.9", description: "Fever, unspecified", isPrimary: false },
    ],
    procedures: [
      { cptCode: "99214", description: "Office visit, established patient, moderate complexity", modifiers: [], units: 1, chargePerUnit: 185.00 },
      { cptCode: "71045", description: "Chest X-ray, single view", modifiers: [], units: 1, chargePerUnit: 95.00 },
      { cptCode: "94640", description: "Nebulizer therapy", modifiers: [], units: 1, chargePerUnit: 45.00 },
      { cptCode: "94060", description: "Spirometry", modifiers: [], units: 1, chargePerUnit: 75.00 },
    ],
  },
  {
    chiefComplaint: "Type 2 diabetes with poor glycemic control",
    diagnoses: [
      { icd10Code: "E11.65", description: "Type 2 diabetes with hyperglycemia", isPrimary: true },
      { icd10Code: "E11.9", description: "Type 2 diabetes without complications", isPrimary: false },
      { icd10Code: "Z79.4", description: "Long-term use of insulin", isPrimary: false },
    ],
    procedures: [
      { cptCode: "99214", description: "Office visit, established patient, moderate complexity", modifiers: [], units: 1, chargePerUnit: 185.00 },
      { cptCode: "80053", description: "Comprehensive metabolic panel", modifiers: [], units: 1, chargePerUnit: 65.00 },
      { cptCode: "83036", description: "Hemoglobin A1c", modifiers: [], units: 1, chargePerUnit: 45.00 },
      { cptCode: "82947", description: "Glucose, blood quantitative", modifiers: [], units: 1, chargePerUnit: 25.00 },
    ],
  },
  {
    chiefComplaint: "Hypertensive crisis with headache",
    diagnoses: [
      { icd10Code: "I10", description: "Essential hypertension", isPrimary: true },
      { icd10Code: "R51.9", description: "Headache, unspecified", isPrimary: false },
      { icd10Code: "R42", description: "Dizziness and giddiness", isPrimary: false },
    ],
    procedures: [
      { cptCode: "99214", description: "Office visit, established patient, moderate complexity", modifiers: [], units: 1, chargePerUnit: 185.00 },
      { cptCode: "93000", description: "Electrocardiogram, complete", modifiers: [], units: 1, chargePerUnit: 85.00 },
      { cptCode: "93784", description: "Ambulatory blood pressure monitoring", modifiers: [], units: 1, chargePerUnit: 120.00 },
    ],
  },
  {
    chiefComplaint: "Acute pharyngitis with fever",
    diagnoses: [
      { icd10Code: "J02.9", description: "Acute pharyngitis, unspecified", isPrimary: true },
      { icd10Code: "R50.9", description: "Fever, unspecified", isPrimary: false },
    ],
    procedures: [
      { cptCode: "99213", description: "Office visit, established patient, low complexity", modifiers: [], units: 1, chargePerUnit: 145.00 },
      { cptCode: "87880", description: "Rapid strep test", modifiers: [], units: 1, chargePerUnit: 35.00 },
      { cptCode: "87070", description: "Throat culture", modifiers: [], units: 1, chargePerUnit: 55.00 },
    ],
  },
  {
    chiefComplaint: "Chronic lower back pain with radiculopathy",
    diagnoses: [
      { icd10Code: "M54.5", description: "Low back pain", isPrimary: true },
      { icd10Code: "M54.16", description: "Radiculopathy, lumbar region", isPrimary: false },
      { icd10Code: "M62.830", description: "Muscle spasm of back", isPrimary: false },
    ],
    procedures: [
      { cptCode: "99214", description: "Office visit, established patient, moderate complexity", modifiers: [], units: 1, chargePerUnit: 185.00 },
      { cptCode: "72100", description: "X-ray lumbar spine, 2-3 views", modifiers: [], units: 1, chargePerUnit: 125.00 },
      { cptCode: "97110", description: "Therapeutic exercises", modifiers: [], units: 2, chargePerUnit: 65.00 },
      { cptCode: "97140", description: "Manual therapy", modifiers: [], units: 1, chargePerUnit: 75.00 },
    ],
  },
  {
    chiefComplaint: "Seasonal allergic rhinitis",
    diagnoses: [
      { icd10Code: "J30.1", description: "Allergic rhinitis due to pollen", isPrimary: true },
      { icd10Code: "R09.81", description: "Nasal congestion", isPrimary: false },
      { icd10Code: "H10.13", description: "Acute atopic conjunctivitis, bilateral", isPrimary: false },
    ],
    procedures: [
      { cptCode: "99214", description: "Office visit, established patient, moderate complexity", modifiers: [], units: 1, chargePerUnit: 185.00 },
      { cptCode: "95004", description: "Allergy testing, percutaneous", modifiers: [], units: 20, chargePerUnit: 12.00 },
      { cptCode: "95165", description: "Allergen immunotherapy, single injection", modifiers: [], units: 1, chargePerUnit: 45.00 },
    ],
  },
  {
    chiefComplaint: "Complicated urinary tract infection",
    diagnoses: [
      { icd10Code: "N39.0", description: "Urinary tract infection, site not specified", isPrimary: true },
      { icd10Code: "R30.0", description: "Dysuria", isPrimary: false },
      { icd10Code: "R31.9", description: "Hematuria, unspecified", isPrimary: false },
    ],
    procedures: [
      { cptCode: "99214", description: "Office visit, established patient, moderate complexity", modifiers: [], units: 1, chargePerUnit: 185.00 },
      { cptCode: "81001", description: "Urinalysis, manual, with microscopy", modifiers: [], units: 1, chargePerUnit: 35.00 },
      { cptCode: "87086", description: "Urine culture, quantitative", modifiers: [], units: 1, chargePerUnit: 55.00 },
      { cptCode: "87184", description: "Susceptibility studies, per agent", modifiers: [], units: 3, chargePerUnit: 25.00 },
    ],
  },
  {
    chiefComplaint: "Migraine with aura and photophobia",
    diagnoses: [
      { icd10Code: "G43.109", description: "Migraine with aura, not intractable", isPrimary: true },
      { icd10Code: "H53.14", description: "Photophobia", isPrimary: false },
      { icd10Code: "R51.9", description: "Headache, unspecified", isPrimary: false },
    ],
    procedures: [
      { cptCode: "99215", description: "Office visit, established patient, high complexity", modifiers: [], units: 1, chargePerUnit: 225.00 },
      { cptCode: "70450", description: "CT head without contrast", modifiers: [], units: 1, chargePerUnit: 495.00 },
      { cptCode: "96372", description: "Therapeutic injection, subcutaneous/IM", modifiers: [], units: 1, chargePerUnit: 65.00 },
    ],
  },
  {
    chiefComplaint: "Annual wellness exam with multiple screenings",
    diagnoses: [
      { icd10Code: "Z00.00", description: "Annual general medical examination", isPrimary: true },
      { icd10Code: "Z13.6", description: "Special screening for cardiovascular disorders", isPrimary: false },
    ],
    procedures: [
      { cptCode: "99396", description: "Periodic preventive visit, established patient 40-64", modifiers: [], units: 1, chargePerUnit: 205.00 },
      { cptCode: "80053", description: "Comprehensive metabolic panel", modifiers: [], units: 1, chargePerUnit: 65.00 },
      { cptCode: "85025", description: "Complete blood count with differential", modifiers: [], units: 1, chargePerUnit: 45.00 },
      { cptCode: "80061", description: "Lipid panel", modifiers: [], units: 1, chargePerUnit: 55.00 },
      { cptCode: "93000", description: "Electrocardiogram, complete", modifiers: [], units: 1, chargePerUnit: 85.00 },
    ],
  },
  {
    chiefComplaint: "Laceration repair with foreign body removal",
    diagnoses: [
      { icd10Code: "S61.411A", description: "Laceration without foreign body of right hand, initial encounter", isPrimary: true },
      { icd10Code: "W45.8XXA", description: "Foreign body in other part of body, initial encounter", isPrimary: false },
    ],
    procedures: [
      { cptCode: "99283", description: "Emergency department visit, moderate complexity", modifiers: [], units: 1, chargePerUnit: 285.00 },
      { cptCode: "12002", description: "Simple repair, scalp/neck/hands, 2.6-7.5cm", modifiers: [], units: 1, chargePerUnit: 165.00 },
      { cptCode: "10120", description: "Foreign body removal, subcutaneous, simple", modifiers: ["-59"], units: 1, chargePerUnit: 125.00 },
      { cptCode: "73130", description: "X-ray hand, minimum 3 views", modifiers: [], units: 1, chargePerUnit: 95.00 },
    ],
  },
];

export class EHREmulator {
  private encounters: EmulatedEncounter[] = [];
  private emulatorEnabled: { [providerId: string]: boolean } = {};

  enableForProvider(providerId: string) {
    this.emulatorEnabled[providerId] = true;
  }

  disableForProvider(providerId: string) {
    this.emulatorEnabled[providerId] = false;
  }

  isEnabledForProvider(providerId: string): boolean {
    return this.emulatorEnabled[providerId] || false;
  }

  getPatients(): EmulatedPatient[] {
    return SAMPLE_PATIENTS;
  }

  getRandomPatient(): EmulatedPatient {
    return SAMPLE_PATIENTS[Math.floor(Math.random() * SAMPLE_PATIENTS.length)];
  }

  /**
   * Generate a comprehensive medical encounter with detailed line items
   */
  generateRandomEncounter(): EmulatedEncounter {
    const patient = this.getRandomPatient();
    const scenario = MEDICAL_SCENARIOS[Math.floor(Math.random() * MEDICAL_SCENARIOS.length)];
    
    // Calculate procedures with modifiers and totals
    const procedures: ProcedureLineItem[] = scenario.procedures.map(proc => ({
      cptCode: proc.cptCode,
      description: proc.description,
      modifiers: proc.modifiers,
      units: proc.units,
      chargePerUnit: proc.chargePerUnit,
      totalCharge: proc.units * proc.chargePerUnit,
    }));

    const totalCharge = procedures.reduce((sum, proc) => sum + proc.totalCharge, 0);

    // Build FHIR-like structured data for AI processing
    const structuredData = {
      resourceType: "Bundle",
      patient: { id: patient.id, name: patient.name },
      encounter: { 
        id: `emu-enc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        date: new Date().toISOString() 
      },
      conditions: scenario.diagnoses.map(d => ({
        code: d.icd10Code,
        display: d.description,
      })),
      procedures: procedures.map(p => ({
        code: p.cptCode,
        display: p.description,
        quantity: p.units,
        charge: p.totalCharge,
        modifiers: p.modifiers,
      })),
    };

    // Generate comprehensive clinical notes
    const notes = `
PATIENT: ${patient.name} (MRN: ${patient.mrn})
DOB: ${patient.dob}
DATE OF SERVICE: ${new Date().toLocaleDateString()}

CHIEF COMPLAINT: ${scenario.chiefComplaint}

DIAGNOSES:
${scenario.diagnoses.map((d, i) => `${i + 1}. ${d.icd10Code} - ${d.description} ${d.isPrimary ? '(PRIMARY)' : '(SECONDARY)'}`).join('\n')}

PROCEDURES PERFORMED:
${procedures.map((p, i) => {
  const modText = p.modifiers && p.modifiers.length > 0 ? ` [Modifiers: ${p.modifiers.join(', ')}]` : '';
  return `${i + 1}. CPT ${p.cptCode}${modText} - ${p.description}
   Units: ${p.units} x $${p.chargePerUnit.toFixed(2)} = $${p.totalCharge.toFixed(2)}`;
}).join('\n\n')}

TOTAL CHARGE: $${totalCharge.toFixed(2)}

STRUCTURED DATA (FHIR-compatible):
${JSON.stringify(structuredData, null, 2)}
`;

    const encounter: EmulatedEncounter = {
      id: structuredData.encounter.id,
      patientId: patient.id,
      patientName: patient.name,
      encounterDate: new Date().toISOString(),
      chiefComplaint: scenario.chiefComplaint,
      diagnoses: scenario.diagnoses,
      procedures,
      totalCharge,
      notes,
      structuredData,
    };

    this.encounters.push(encounter);
    return encounter;
  }

  generateMultipleEncounters(count: number): EmulatedEncounter[] {
    const encounters: EmulatedEncounter[] = [];
    for (let i = 0; i < count; i++) {
      encounters.push(this.generateRandomEncounter());
    }
    return encounters;
  }

  getNewEncountersSince(sinceDate?: Date): EmulatedEncounter[] {
    if (!sinceDate) {
      return this.encounters;
    }
    return this.encounters.filter(
      (enc) => new Date(enc.encounterDate) > sinceDate
    );
  }

  clearEncounters() {
    this.encounters = [];
  }

  getEncounterCount(): number {
    return this.encounters.length;
  }
}

// Global emulator instance
export const ehrEmulator = new EHREmulator();
