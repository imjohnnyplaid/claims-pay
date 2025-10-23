import type { IStorage } from "./storage";
import { fetchNewEncounters } from "./ehr";
import { autoCodeClaim, calculateRiskScore, type ClaimCodes } from "./ai";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-09-30.clover",
});

/**
 * EHR Auto-Sync Service
 * Polls connected EHR systems every 15 minutes and automatically:
 * 1. Pulls new encounters/claims
 * 2. AI codes with ICD-10/CPT
 * 3. Risk scores and approves/rejects
 * 4. Processes payment for approved claims
 */

export class EHRSyncService {
  private storage: IStorage;
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Start background sync service (every 15 minutes)
   */
  start() {
    if (this.syncInterval) {
      console.log("EHR sync service already running");
      return;
    }

    console.log("Starting EHR auto-sync service (15 min intervals)");
    
    // Initial sync after 1 minute
    setTimeout(() => this.syncAll(), 60000);

    // Then every 15 minutes
    this.syncInterval = setInterval(() => this.syncAll(), 15 * 60 * 1000);
  }

  /**
   * Stop background sync service
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log("EHR sync service stopped");
    }
  }

  /**
   * Sync all providers with EHR enabled
   */
  async syncAll() {
    if (this.isSyncing) {
      console.log("Sync already in progress, skipping...");
      return;
    }

    this.isSyncing = true;
    console.log("Starting EHR sync for all providers...");

    try {
      const providers = await this.storage.getAllProviders();
      const ehrProviders = providers.filter((p) => p.ehrEnabled);

      console.log(`Found ${ehrProviders.length} providers with EHR enabled`);

      for (const provider of ehrProviders) {
        try {
          await this.syncProvider(provider.id);
        } catch (error: any) {
          console.error(`Failed to sync provider ${provider.id}:`, error.message);
          // Continue with next provider even if one fails
        }
      }

      console.log("EHR sync complete");
    } catch (error: any) {
      console.error("EHR sync error:", error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single provider's EHR system
   */
  async syncProvider(providerId: string): Promise<number> {
    const provider = await this.storage.getProvider(providerId);
    if (!provider || !provider.ehrEnabled) {
      throw new Error("Provider not found or EHR not enabled");
    }

    console.log(`Syncing EHR for provider ${provider.providerName} (${provider.ehrSystem})...`);

    try {
      // Fetch new encounters since last sync
      const encounters = await fetchNewEncounters(provider, provider.ehrLastSync || undefined);

      console.log(`Found ${encounters.length} new encounters for ${provider.providerName}`);

      let processedCount = 0;

      for (const encounter of encounters) {
        try {
          // Create claim from encounter
          const claim = await this.storage.createClaim({
            providerId: provider.id,
            patientName: encounter.patientName,
            patientId: encounter.patientId,
            claimAmount: encounter.totalCharge.toString(),
            rawClaimData: encounter.notes,
            status: "submitted",
            source: "ehr_auto",
          });

          console.log(`Created claim ${claim.id} for encounter ${encounter.id}`);

          // Step 1: Coding - extract from emulator structured data if available, otherwise use AI
          let codingResult;
          if (encounter.structuredData?.conditions && encounter.structuredData?.procedures) {
            // Extract codes directly from emulator's structured data
            codingResult = {
              icd10: encounter.structuredData.conditions.map((c: any) => c.code),
              cpt: encounter.structuredData.procedures.map((p: any) => p.code),
            };
            console.log(`Extracted codes from emulator data for claim ${claim.id}`);
          } else {
            // Fall back to AI coding for manual claims
            codingResult = await autoCodeClaim(encounter.notes);
          }
          
          const updatedClaim = await this.storage.updateClaim(claim.id, {
            status: "coded",
            codes: codingResult,
            codedAt: new Date(),
          });

          console.log(`Coded claim ${claim.id}: ${codingResult.icd10?.length || 0} ICD-10, ${codingResult.cpt?.length || 0} CPT`);

          // Step 2: Risk Assessment
          const riskScore = await calculateRiskScore(
            parseFloat(claim.claimAmount),
            codingResult,
            undefined
          );

          const assessedClaim = await this.storage.updateClaim(claim.id, {
            status: riskScore >= 80 ? "approved" : "rejected",
            riskScore,
            assessedAt: new Date(),
            rejectionReason: riskScore < 80 ? "Risk score below threshold" : undefined,
          });

          console.log(`Assessed claim ${claim.id}: risk score ${riskScore}`);

          // Step 3: Payment (if approved)
          if (riskScore >= 80) {
            const claimAmountNum = parseFloat(claim.claimAmount);
            const commissionRate = parseFloat(provider.commissionRate);
            const payoutAmount = claimAmountNum * (1 - commissionRate / 100);

            // Create Stripe payment
            if (provider.bankAccountNumber && provider.bankRoutingNumber) {
              try {
                // In production, create actual payout
                // For now, simulate successful payment
                const transaction = await this.storage.createTransaction({
                  claimId: claim.id,
                  providerId: provider.id,
                  amount: payoutAmount.toString(),
                  type: "payout",
                  status: "completed",
                  stripePaymentIntentId: `sim_${Date.now()}`,
                });

                await this.storage.updateClaim(claim.id, {
                  status: "paid",
                  payoutAmount: payoutAmount.toString(),
                  paidAt: new Date(),
                });

                console.log(`Paid claim ${claim.id}: $${payoutAmount.toFixed(2)}`);
                processedCount++;
              } catch (paymentError: any) {
                console.error(`Payment failed for claim ${claim.id}:`, paymentError.message);
              }
            } else {
              console.log(`Skipping payment for claim ${claim.id}: no banking info`);
            }
          }
        } catch (claimError: any) {
          console.error(`Failed to process encounter ${encounter.id}:`, claimError.message);
          // Continue with next encounter
        }
      }

      // Update last sync time
      await this.storage.updateProvider(provider.id, {
        ehrLastSync: new Date(),
      });

      console.log(`Completed sync for ${provider.providerName}: ${processedCount}/${encounters.length} claims processed`);

      return processedCount;
    } catch (error: any) {
      console.error(`EHR sync failed for provider ${provider.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      running: this.syncInterval !== null,
      syncing: this.isSyncing,
    };
  }
}
