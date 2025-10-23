import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Shared types for date range filtering
export const dateRangeValues = ["day", "week", "month", "qtd", "ytd", "year"] as const;
export type DateRange = typeof dateRangeValues[number];
export const dateRangeSchema = z.enum(dateRangeValues);

// Users table - supports multiple roles (provider, admin, bank)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("provider"), // provider, admin, bank
  internalRole: text("internal_role"), // For admin users only: super_admin, admin, team_member
  status: text("status").notNull().default("approved"), // pending, approved, rejected, active, suspended, invited
  invitedBy: varchar("invited_by"), // user id who sent the invite
  firstName: text("first_name"),
  lastName: text("last_name"),
  isPrimaryEntity: boolean("is_primary_entity").notNull().default(true), // true for main provider/bank accounts
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Provider profiles
export const providers = pgTable("providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  providerName: text("provider_name").notNull(),
  npi: text("npi").notNull().unique(),
  tin: text("tin").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  bankRoutingNumber: text("bank_routing_number"),
  bankAccountNumber: text("bank_account_number"),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull().default("5.00"), // default 5%
  isActive: boolean("is_active").notNull().default(true),
  // EHR Integration fields
  ehrSystem: text("ehr_system"), // Epic, Cerner, Allscripts, Athenahealth, etc.
  ehrApiEndpoint: text("ehr_api_endpoint"), // FHIR API endpoint URL
  ehrClientId: text("ehr_client_id"), // OAuth2 client ID
  ehrClientSecret: text("ehr_client_secret"), // SECURITY: OAuth2 client secret - MUST be encrypted at rest in production (use KMS/vault)
  ehrEnabled: boolean("ehr_enabled").notNull().default(false),
  ehrLastSync: timestamp("ehr_last_sync"),
  // Notification settings
  notificationSettings: jsonb("notification_settings").$type<{
    emailNotifications?: boolean;
    claimStatusUpdates?: boolean;
    paymentConfirmations?: boolean;
    weeklyReports?: boolean;
  }>(),
  // Instant Payment Threshold settings
  instantPaymentThreshold: jsonb("instant_payment_threshold").$type<{
    interval?: string; // daily, weekly, monthly
    claimLimitType?: string; // fixed, percentage
    claimLimitValue?: number; // number or percentage (0-100)
  }>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Bank profiles - for banking partners who fund claims
export const banks = pgTable("banks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  bankName: text("bank_name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  bankPhone: text("bank_phone").notNull(),
  website: text("website"),
  // Primary contact information
  contactName: text("contact_name").notNull(),
  contactTitle: text("contact_title").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone").notNull(),
  // Payment/ACH information for funding transfers
  achRoutingNumber: text("ach_routing_number").notNull(), // SECURITY: Should be encrypted at rest in production
  achAccountNumber: text("ach_account_number").notNull(), // SECURITY: Should be encrypted at rest in production
  achAccountType: text("ach_account_type").notNull().default("checking"), // checking, savings
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Claims table
export const claims = pgTable("claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => providers.id),
  patientName: text("patient_name").notNull(),
  patientId: text("patient_id"),
  claimAmount: decimal("claim_amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("submitted"), // submitted, coding, coded, risk_check, approved, rejected, paid, insurance_submitted, reimbursed
  source: text("source").notNull().default("manual"), // manual, ehr_auto, ehr_emulator
  rawClaimData: text("raw_claim_data"), // original uploaded text/data
  codes: jsonb("codes").$type<{ icd10?: string[], cpt?: string[] }>(), // AI-generated codes
  riskScore: integer("risk_score"), // 0-100
  payoutAmount: decimal("payout_amount", { precision: 12, scale: 2 }), // 95% of claim amount
  rejectionReason: text("rejection_reason"),
  fundingAgreementId: varchar("funding_agreement_id"), // link to bank funding
  bankId: varchar("bank_id"), // ref to funding bank for purchased claims (for bank activity metrics)
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  codedAt: timestamp("coded_at"),
  assessedAt: timestamp("assessed_at"),
  paidAt: timestamp("paid_at"),
});

// Payments/Transactions table
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  claimId: varchar("claim_id").notNull().references(() => claims.id),
  providerId: varchar("provider_id").notNull().references(() => providers.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  type: text("type").notNull(), // payout, reimbursement
  status: text("status").notNull().default("pending"), // pending, completed, failed
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  bankId: varchar("bank_id"), // reference to bank if funded
  feeAmount: decimal("fee_amount", { precision: 12, scale: 2 }), // bank fee/interest
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Historical claims data uploaded during onboarding
export const historicalClaims = pgTable("historical_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => providers.id),
  claimData: jsonb("claim_data").notNull(), // parsed CSV/PDF data
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

// Team members (linked to primary provider account)
export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => providers.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("member"), // admin, member
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
});

// Insurance Submissions - track claims sent to insurance companies
export const insuranceSubmissions = pgTable("insurance_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  claimId: varchar("claim_id").notNull().references(() => claims.id),
  payerName: text("payer_name").notNull(), // insurance company name
  payerId: text("payer_id"), // payer identifier
  submissionDate: timestamp("submission_date").notNull().defaultNow(),
  expectedReimbursement: decimal("expected_reimbursement", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("submitted"), // submitted, accepted, processing, paid, denied
  // EDI X12 837 (Claim Submission) tracking
  edi837ControlNumber: text("edi_837_control_number"), // 837 transaction control number
  edi837Status: text("edi_837_status").notNull().default("pending"), // pending, sent, acknowledged, rejected
  edi837SentAt: timestamp("edi_837_sent_at"),
  // EDI X12 835 (Remittance Advice) tracking
  edi835ControlNumber: text("edi_835_control_number"), // 835 ERA control number
  edi835Status: text("edi_835_status"), // received, processed, reconciled
  edi835ReceivedAt: timestamp("edi_835_received_at"),
  remittanceAdviceNumber: text("remittance_advice_number"), // ERA/EOB number
  adjudicationDate: timestamp("adjudication_date"),
  denialReason: text("denial_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Reimbursements - payments received from insurance
export const reimbursements = pgTable("reimbursements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  insuranceSubmissionId: varchar("insurance_submission_id").notNull().references(() => insuranceSubmissions.id),
  claimId: varchar("claim_id").notNull().references(() => claims.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  paymentMethod: text("payment_method"), // ACH, Check, Wire
  referenceNumber: text("reference_number"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Funding Agreements - bank funding records for claim batches
export const fundingAgreements = pgTable("funding_agreements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bankId: varchar("bank_id").notNull().references(() => users.id), // user with role="bank"
  providerId: varchar("provider_id").notNull().references(() => providers.id), // provider being funded
  fundingAmount: decimal("funding_amount", { precision: 12, scale: 2 }).notNull(),
  feeRate: decimal("fee_rate", { precision: 5, scale: 2 }).notNull(), // percentage fee
  status: text("status").notNull().default("active"), // active, settled, defaulted
  fundedAt: timestamp("funded_at").notNull().defaultNow(),
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Funding Logs - track bank funding activity for claim purchases
export const fundingLogs = pgTable("funding_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bankId: varchar("bank_id").notNull().references(() => users.id), // bank providing funds
  claimId: varchar("claim_id").notNull().references(() => claims.id), // claim being funded
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(), // funding amount transferred
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Claim Lifecycle Events - audit trail for all claim status changes
export const claimLifecycleEvents = pgTable("claim_lifecycle_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  claimId: varchar("claim_id").notNull().references(() => claims.id),
  eventType: text("event_type").notNull(), // submitted, coded, risk_assessed, approved, rejected, paid, insurance_submitted, reimbursed
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>(), // additional event data
  performedBy: varchar("performed_by"), // user who triggered the event
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Bank Statements - periodic summaries for bank partners
export const bankStatements = pgTable("bank_statements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bankId: varchar("bank_id").notNull().references(() => users.id),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  totalFunded: decimal("total_funded", { precision: 12, scale: 2 }).notNull(),
  totalReimbursed: decimal("total_reimbursed", { precision: 12, scale: 2 }).notNull(),
  totalFees: decimal("total_fees", { precision: 12, scale: 2 }).notNull(),
  outstandingAmount: decimal("outstanding_amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Invitations - for admin and bank user invitations
export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull(), // admin, bank
  status: text("status").notNull().default("pending"), // pending, accepted, approved, rejected, expired
  token: text("token").notNull().unique(), // unique token for invitation link
  invitedBy: varchar("invited_by").notNull().references(() => users.id),
  userId: varchar("user_id"), // set when user accepts invitation
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  provider: one(providers, {
    fields: [users.id],
    references: [providers.userId],
  }),
  bank: one(banks, {
    fields: [users.id],
    references: [banks.userId],
  }),
  teamMemberships: many(teamMembers),
  fundingAgreements: many(fundingAgreements), // for bank users
  bankStatements: many(bankStatements), // for bank users
}));

export const providersRelations = relations(providers, ({ one, many }) => ({
  user: one(users, {
    fields: [providers.userId],
    references: [users.id],
  }),
  claims: many(claims),
  transactions: many(transactions),
  historicalClaims: many(historicalClaims),
  teamMembers: many(teamMembers),
  fundingAgreements: many(fundingAgreements),
}));

export const banksRelations = relations(banks, ({ one }) => ({
  user: one(users, {
    fields: [banks.userId],
    references: [users.id],
  }),
}));

export const claimsRelations = relations(claims, ({ one, many }) => ({
  provider: one(providers, {
    fields: [claims.providerId],
    references: [providers.id],
  }),
  transactions: many(transactions),
  insuranceSubmissions: many(insuranceSubmissions),
  reimbursements: many(reimbursements),
  lifecycleEvents: many(claimLifecycleEvents),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  claim: one(claims, {
    fields: [transactions.claimId],
    references: [claims.id],
  }),
  provider: one(providers, {
    fields: [transactions.providerId],
    references: [providers.id],
  }),
}));

export const historicalClaimsRelations = relations(historicalClaims, ({ one }) => ({
  provider: one(providers, {
    fields: [historicalClaims.providerId],
    references: [providers.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  provider: one(providers, {
    fields: [teamMembers.providerId],
    references: [providers.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

export const insuranceSubmissionsRelations = relations(insuranceSubmissions, ({ one, many }) => ({
  claim: one(claims, {
    fields: [insuranceSubmissions.claimId],
    references: [claims.id],
  }),
  reimbursements: many(reimbursements),
}));

export const reimbursementsRelations = relations(reimbursements, ({ one }) => ({
  insuranceSubmission: one(insuranceSubmissions, {
    fields: [reimbursements.insuranceSubmissionId],
    references: [insuranceSubmissions.id],
  }),
  claim: one(claims, {
    fields: [reimbursements.claimId],
    references: [claims.id],
  }),
}));

export const fundingAgreementsRelations = relations(fundingAgreements, ({ one }) => ({
  bank: one(users, {
    fields: [fundingAgreements.bankId],
    references: [users.id],
  }),
  provider: one(providers, {
    fields: [fundingAgreements.providerId],
    references: [providers.id],
  }),
}));

export const claimLifecycleEventsRelations = relations(claimLifecycleEvents, ({ one }) => ({
  claim: one(claims, {
    fields: [claimLifecycleEvents.claimId],
    references: [claims.id],
  }),
}));

export const bankStatementsRelations = relations(bankStatements, ({ one }) => ({
  bank: one(users, {
    fields: [bankStatements.bankId],
    references: [users.id],
  }),
}));

// ========== RBAC Tables ==========

// Permissions - fine-grained actions on resources
export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // format: <action>:<resource>:<scope> e.g. "read:users:all", "update:user:own"
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Roles - collections of permissions (for internal users only)
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // super_admin, admin, team_member
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Role-Permission junction table
export const rolePermissions = pgTable("role_permissions", {
  roleId: varchar("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: varchar("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Audit Logs - track all user management actions
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id), // who performed the action
  action: text("action").notNull(), // e.g., "update:user:password", "create:user", "suspend:user"
  targetId: varchar("target_id"), // affected user/resource id
  targetType: text("target_type"), // user, role, permission, etc.
  details: jsonb("details").$type<{
    before?: Record<string, any>;
    after?: Record<string, any>;
    [key: string]: any;
  }>(), // before/after values and other metadata
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations for RBAC tables
export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
  email: z.string().email("Invalid email address"),
});

export const insertProviderSchema = createInsertSchema(providers).omit({
  id: true,
  createdAt: true,
  ehrLastSync: true,
}).extend({
  npi: z.string().length(10, "NPI must be 10 digits"),
  tin: z.string().min(9, "TIN must be at least 9 digits"),
  bankRoutingNumber: z.string().length(9, "Routing number must be 9 digits").optional(),
  bankAccountNumber: z.string().min(4, "Account number required").optional(),
  ehrSystem: z.enum(["Epic", "Cerner", "Allscripts", "Athenahealth", "eClinicalWorks", "NextGen", "EHR_EMULATOR", "Other"]).optional(),
  ehrApiEndpoint: z.union([z.literal(""), z.string().url("Invalid API endpoint URL")]).optional(),
  ehrClientId: z.string().optional(),
  ehrClientSecret: z.string().optional(),
});

export const insertBankSchema = createInsertSchema(banks).omit({
  id: true,
  createdAt: true,
}).extend({
  bankName: z.string().min(1, "Bank name required"),
  address: z.string().min(1, "Address required"),
  city: z.string().min(1, "City required"),
  state: z.string().length(2, "State must be 2 characters"),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code"),
  bankPhone: z.string().min(10, "Phone number required"),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
  contactName: z.string().min(1, "Contact name required"),
  contactTitle: z.string().min(1, "Contact title required"),
  contactEmail: z.string().email("Invalid contact email"),
  contactPhone: z.string().min(10, "Contact phone required"),
  achRoutingNumber: z.string().length(9, "Routing number must be 9 digits"),
  achAccountNumber: z.string().min(4, "Account number required"),
  achAccountType: z.enum(["checking", "savings"]),
});

export const insertClaimSchema = createInsertSchema(claims).omit({
  id: true,
  submittedAt: true,
  codedAt: true,
  assessedAt: true,
  paidAt: true,
}).extend({
  claimAmount: z.union([z.number(), z.string()]).transform(val => typeof val === 'number' ? val.toString() : val),
  patientName: z.string().min(1, "Patient name required"),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertHistoricalClaimSchema = createInsertSchema(historicalClaims).omit({
  id: true,
  uploadedAt: true,
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  invitedAt: true,
});

export const insertInsuranceSubmissionSchema = createInsertSchema(insuranceSubmissions).omit({
  id: true,
  createdAt: true,
  submissionDate: true,
  adjudicationDate: true,
}).extend({
  expectedReimbursement: z.union([z.number(), z.string()]).transform(val => typeof val === 'number' ? val.toString() : val),
});

export const insertReimbursementSchema = createInsertSchema(reimbursements).omit({
  id: true,
  createdAt: true,
}).extend({
  amount: z.union([z.number(), z.string()]).transform(val => typeof val === 'number' ? val.toString() : val),
});

export const insertFundingAgreementSchema = createInsertSchema(fundingAgreements).omit({
  id: true,
  createdAt: true,
  fundedAt: true,
  settledAt: true,
}).extend({
  fundingAmount: z.union([z.number(), z.string()]).transform(val => typeof val === 'number' ? val.toString() : val),
  feeRate: z.union([z.number(), z.string()]).transform(val => typeof val === 'number' ? val.toString() : val),
});

export const insertFundingLogSchema = createInsertSchema(fundingLogs).omit({
  id: true,
  createdAt: true,
  timestamp: true,
}).extend({
  amount: z.union([z.number(), z.string()]).transform(val => typeof val === 'number' ? val.toString() : val),
});

export const insertClaimLifecycleEventSchema = createInsertSchema(claimLifecycleEvents).omit({
  id: true,
  createdAt: true,
});

export const insertBankStatementSchema = createInsertSchema(bankStatements).omit({
  id: true,
  createdAt: true,
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
  acceptedAt: true,
  approvedAt: true,
});

export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
  createdAt: true,
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertProvider = z.infer<typeof insertProviderSchema>;
export type Provider = typeof providers.$inferSelect;

export type InsertBank = z.infer<typeof insertBankSchema>;
export type Bank = typeof banks.$inferSelect;

export type InsertClaim = z.infer<typeof insertClaimSchema>;
export type Claim = typeof claims.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertHistoricalClaim = z.infer<typeof insertHistoricalClaimSchema>;
export type HistoricalClaim = typeof historicalClaims.$inferSelect;

export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;

export type InsertInsuranceSubmission = z.infer<typeof insertInsuranceSubmissionSchema>;
export type InsuranceSubmission = typeof insuranceSubmissions.$inferSelect;

export type InsertReimbursement = z.infer<typeof insertReimbursementSchema>;
export type Reimbursement = typeof reimbursements.$inferSelect;

export type InsertFundingAgreement = z.infer<typeof insertFundingAgreementSchema>;
export type FundingAgreement = typeof fundingAgreements.$inferSelect;

export type InsertFundingLog = z.infer<typeof insertFundingLogSchema>;
export type FundingLog = typeof fundingLogs.$inferSelect;

export type InsertClaimLifecycleEvent = z.infer<typeof insertClaimLifecycleEventSchema>;
export type ClaimLifecycleEvent = typeof claimLifecycleEvents.$inferSelect;

export type InsertBankStatement = z.infer<typeof insertBankStatementSchema>;
export type BankStatement = typeof bankStatements.$inferSelect;

export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitations.$inferSelect;

export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type Permission = typeof permissions.$inferSelect;

export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;

export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
