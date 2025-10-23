/**
 * PHI/PII Anonymization Utilities for HIPAA Compliance (Frontend)
 * 
 * Note: Actual anonymization happens server-side using HMAC-SHA256.
 * These utilities help display already-anonymized data from the backend.
 */

/**
 * Display anonymized patient ID (already anonymized by server)
 * Server uses HMAC-SHA256 for true de-identification with 20-char output
 */
export function anonymizePatientId(patientId: string): string {
  if (!patientId) return "PT-UNKNOWN";
  
  if (patientId.startsWith("PT-")) {
    return patientId;
  }
  
  return `PT-${patientId.substring(0, 20).toUpperCase()}`;
}

/**
 * Anonymize patient name - returns anonymized ID
 */
export function anonymizePatientName(patientName: string, patientId: string): string {
  return anonymizePatientId(patientId);
}

/**
 * Mask sensitive portions of encounter ID while keeping it traceable
 */
export function maskEncounterId(encounterId: string): string {
  if (encounterId.length <= 8) {
    return encounterId;
  }
  const visible = encounterId.substring(0, 8);
  return `${visible}...`;
}

/**
 * Check if a field contains PHI that should be anonymized
 */
export function isPHIField(fieldName: string): boolean {
  const phiFields = [
    'patientName',
    'patientId',
    'patientDOB',
    'patientAddress',
    'patientPhone',
    'patientEmail',
    'ssn',
    'medicalRecordNumber',
  ];
  return phiFields.includes(fieldName);
}
