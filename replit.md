# ClaimPay - Healthcare Payment Platform

## Overview
ClaimPay is a same-day payment platform for healthcare providers that leverages AI for claim coding and risk assessment to facilitate instant payments. Providers receive 95% of their claim value upfront, with ClaimPay managing the subsequent insurance reimbursement process. The project aims to revolutionize healthcare payments by providing rapid liquidity to providers.

## User Preferences
No specific user preferences were provided in the original `replit.md` file. The agent should infer best practices for coding, communication, and workflow.

## System Architecture

### UI/UX Decisions
The platform utilizes a professional healthcare fintech UI design system.
- **Color Scheme**: Primary professional blue (220 90% 56%), accent teal (172 66% 50%).
- **Typography**: Inter for UI text, JetBrains Mono for code/data displays.
- **Spacing**: Consistent use of small (4-6), medium (8-12), and large (16+) spacing units.
- **Components**: Follows Shadcn UI patterns with hover-elevate/active-elevate-2 effects.
- **Theming**: Full dark mode support with a theme toggle in all dashboards.

### Technical Implementations
ClaimPay is built as a full-stack application.
- **Frontend**: React, TypeScript, Wouter for routing, and TanStack Query for data management.
- **Backend**: Express.js with TypeScript.
- **Database**: PostgreSQL with Drizzle ORM, hosted on Neon.
- **Authentication**: Passport.js with session-based authentication for role-based access control.
- **UI Framework**: Shadcn UI, Tailwind CSS for styling, and Recharts for data visualization.
- **Security**: Credential redaction for sensitive information in API responses; production environments require at-rest encryption and HIPAA-compliant audit logging.

### Feature Specifications
The platform includes comprehensive functionalities for providers, administrators, and banks.
- **Provider Onboarding**: A 6-step wizard guides providers through setup, including practice information, banking details, and EHR integration.
- **EHR Integration**: Connects to major EHR systems (Epic, Cerner, Allscripts, Athenahealth, generic FHIR R4) via OAuth2, enabling automatic claim synchronization every 15 minutes.
- **AI-Powered Claim Processing**: Utilizes OpenAI GPT-5 for automatic ICD-10 and CPT coding from EHR encounters or manual submissions.
- **Risk Scoring**: A rule-based engine assesses claim approval probability (0-100 score); scores ≥80 trigger instant payment.
- **Instant Payments**: Approved claims receive 95% of their value instantly via Stripe ACH payouts.
- **Role-Based Dashboards**: Dedicated dashboards for Providers (metrics, claim tracking, EHR status), Admins (system health, user management, analytics), and Banks (funding metrics, portfolio performance).
- **User Management**: Advanced admin tools for user management, including RBAC, bulk actions, and audit logging.
- **Settings Hub**: Comprehensive provider settings for managing user credentials, contact info, EHR connections, banking, team members, notifications, and instant payment thresholds.
- **Portal Switching**: Admin/super_admin users can impersonate provider or bank roles to view data from their perspective.

### System Design Choices
- **Schema-first Development**: Types defined in `shared/schema.ts` for consistency.
- **Data Fetching**: TanStack Query is used for efficient data fetching and cache invalidation.
- **Form Validation**: React Hook Form and Zod ensure robust form validation.
- **Security**: Granular permission-based UI rendering and complete RBAC system across 3 roles (super_admin, admin, team_member) with 33 distinct permissions.

## External Dependencies

-   **OpenAI GPT-5**: Used for AI-powered claim coding and risk assessment.
-   **Stripe**: Payment gateway for instant ACH provider payouts.
-   **PostgreSQL (Neon)**: Primary database for all application data.
-   **FHIR R4 APIs**: Integration with Electronic Health Record (EHR) systems like Epic, Cerner, Allscripts, and Athenahealth for automatic claim synchronization.
-   **Passport.js**: Authentication middleware.
-   **Shadcn UI**: UI component library.
-   **Tailwind CSS**: Utility-first CSS framework.
-   **Recharts**: Charting library for data visualization.