/**
 * Server-Side PHI Anonymization using HMAC-SHA256
 * HIPAA-Compliant pseudonymization with server-held secret
 */

import crypto from 'crypto';

const isDevelopment = process.env.NODE_ENV === 'development';

if (!process.env.ANONYMIZATION_SECRET && !isDevelopment) {
  throw new Error('ANONYMIZATION_SECRET environment variable is required in production');
}

const ANONYMIZATION_SECRET = process.env.ANONYMIZATION_SECRET || 
  (isDevelopment ? crypto.randomBytes(32).toString('hex') : '');

if (!process.env.ANONYMIZATION_SECRET && isDevelopment) {
  console.warn('⚠️  ANONYMIZATION_SECRET not set - using random secret (will change on restart)');
  console.warn('   Set ANONYMIZATION_SECRET environment variable for production');
}

/**
 * Generate cryptographically strong anonymized patient identifier
 * Uses HMAC-SHA256 with server-held secret for true de-identification
 * 20-character output provides ~2^80 collision resistance
 */
export function anonymizePatientId(patientId: string): string {
  if (!patientId) return "PT-UNKNOWN";
  
  const hmac = crypto
    .createHmac('sha256', ANONYMIZATION_SECRET)
    .update(patientId)
    .digest('hex');
  
  return `PT-${hmac.substring(0, 20).toUpperCase()}`;
}

/**
 * Anonymize patient name - returns anonymized ID
 */
export function anonymizePatientName(patientName: string, patientId: string): string {
  return anonymizePatientId(patientId);
}

/**
 * Sanitize claim object by removing/anonymizing all PHI
 * Removes rawClaimData which contains unsanitized encounter PHI
 */
export function sanitizeClaim(claim: any) {
  const { patientName, rawClaimData, ...safeClaim } = claim;
  return {
    ...safeClaim,
    patientId: anonymizePatientId(claim.patientId),
  };
}

/**
 * Sanitize array of claims
 */
export function sanitizeClaims(claims: any[]) {
  return claims.map(sanitizeClaim);
}
