# ClaimPay Design Guidelines

## Design Approach: Professional Fintech System

**Selected Approach:** Design System (Data-Focused)
**Primary References:** Stripe Dashboard + Linear App + Healthcare.gov
**Justification:** Healthcare fintech requires trust, clarity, and efficiency. Drawing from Stripe's payment interface professionalism, Linear's data density handling, and healthcare.gov's accessibility standards.

**Core Principles:**
- Trust through clarity: Every element communicates reliability
- Information hierarchy: Critical data always accessible within 2 clicks
- Progressive disclosure: Complex features revealed contextually
- Speed perception: Immediate feedback on all actions

## Color Palette

**Light Mode:**
- Primary: 220 90% 56% (Professional blue - trust, reliability)
- Background: 0 0% 100% (Pure white - clinical clarity)
- Surface: 220 13% 97% (Subtle gray - card elevation)
- Border: 220 13% 91% (Soft definition)
- Text Primary: 220 9% 15% (Near black - readability)
- Text Secondary: 220 9% 46% (Muted for hierarchy)
- Success: 142 76% 36% (Claim approved - reassuring green)
- Warning: 38 92% 50% (Needs attention - amber)
- Error: 0 84% 60% (Rejection/critical - red)
- Info: 199 89% 48% (Status updates - cyan)

**Dark Mode:**
- Primary: 220 90% 62% (Brighter for contrast)
- Background: 222 47% 11% (Deep navy-black)
- Surface: 217 33% 17% (Elevated cards)
- Border: 217 33% 25% (Visible separation)
- Text Primary: 210 40% 98% (High contrast white)
- Text Secondary: 217 11% 65% (Readable gray)

**Accent:** 172 66% 50% (Teal - payment actions, CTAs)

## Typography

**Font Families:**
- Primary: 'Inter' (body, UI elements - excellent readability at all sizes)
- Mono: 'JetBrains Mono' (claim codes, IDs, financial data)
- Display: 'Inter' at 600+ weight (headings)

**Scale:**
- Display: text-4xl to text-6xl, font-semibold (dashboard headers, hero)
- Heading 1: text-3xl, font-semibold (page titles)
- Heading 2: text-2xl, font-semibold (section headers)
- Heading 3: text-xl, font-medium (card titles)
- Body Large: text-base, font-normal (primary content)
- Body: text-sm, font-normal (secondary content, table cells)
- Small: text-xs, font-normal (meta info, timestamps)
- Caption: text-xs, font-medium, uppercase, tracking-wide (labels)

## Layout System

**Spacing Primitives:** Use Tailwind units of 1, 2, 3, 4, 6, 8, 12, 16
- Micro spacing: 1-2 (tight groupings, button padding)
- Component spacing: 4-6 (between related elements)
- Section spacing: 8-12 (cards, major groups)
- Page spacing: 16+ (between major sections)

**Grid System:**
- Container: max-w-7xl for dashboards, max-w-6xl for forms
- Responsive columns: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
- Dashboard cards: 3-4 columns on desktop, stack on mobile
- Claims table: full width with horizontal scroll on mobile

**Vertical Rhythm:**
- Page padding: py-8 md:py-12
- Section spacing: space-y-8 md:space-y-12
- Card internal: p-6 md:p-8

## Component Library

### Navigation
- **Top Bar:** Fixed header with logo left, user profile/notifications right, bg-surface with border-b
- **Sidebar:** Collapsible left nav (280px expanded, 64px collapsed), grouped sections with icons
- **Breadcrumbs:** Secondary navigation showing path, text-sm with chevron separators

### Data Display
- **Metric Cards:** Grid layout, large number display (text-3xl), comparison indicator (↑ 12% vs yesterday), icon top-right, subtle gradient background
- **Claims Table:** Striped rows, sticky header, status badges, sortable columns, inline actions (View, Download), pagination footer
- **Charts:** Line charts for trends (Chart.js/Recharts), bar charts for comparisons, donut for percentages, muted colors with primary accent
- **Status Badges:** Pill-shaped, color-coded (Processing: blue, Approved: green, Rejected: red, Paid: teal), size variants (sm for table, md for cards)

### Forms & Inputs
- **Text Fields:** Floating labels, border focus ring-2, helper text below, error state with icon
- **File Upload:** Drag-drop zone with dashed border, file preview cards, progress bar during upload
- **Select/Dropdown:** Custom styled, search-enabled for long lists (provider selection), grouped options
- **Multi-step Forms:** Progress indicator top, numbered steps, previous/next navigation, save draft option

### Actions
- **Primary Button:** bg-primary, hover:brightness-110, px-6 py-3, rounded-lg, font-medium
- **Secondary Button:** border-2 border-primary, text-primary, same dimensions
- **Outline Buttons on Images:** backdrop-blur-md, bg-white/10, border-white/30 - no custom hover states
- **Icon Buttons:** Square 40x40, hover:bg-surface transition, tooltip on hover
- **Floating Action:** Fixed bottom-right, size-16, rounded-full, shadow-2xl (quick claim submission)

### Overlays
- **Modal:** Centered, max-w-2xl, backdrop blur, slide-up animation, close X top-right
- **Drawer:** Slide from right, 480px width, full height, for detailed views (claim details, settings)
- **Toast Notifications:** Top-right stack, auto-dismiss 5s, icon + message + action, slide-in animation
- **Tooltips:** Dark background, white text, arrow pointer, position-aware, max-w-xs

### Specialized Components
- **Risk Score Display:** Circular progress (0-100), gradient fill green→yellow→red based on score, percentage center
- **Payment Timeline:** Vertical stepper showing claim journey (Submitted → Coded → Assessed → Approved → Paid), timestamps, expandable details
- **Provider Card:** Avatar, name, NPI, active claims count, acceptance rate, quick actions dropdown
- **Bank Funding Widget:** Total funded, outstanding reimbursements, projected ROI, approve/reject buttons

## Page-Specific Layouts

### Provider Onboarding
- **Hero Section:** Full-width gradient background (primary to primary-dark), centered content, large heading "Get Paid Today, Not in 30 Days", subheading, CTA button, trust indicators below (security badges, "HIPAA Compliant")
- **Multi-Step Form:** 5 steps (Account → Practice Info → Banking → Team → Historical Data), progress bar top, cards for each section, validation on blur, submit with loading state

### Provider Dashboard  
- **Header:** Welcome message, date range selector (Today/Week/Month/QTD/YTD/Year tabs), export button
- **Metrics Grid:** 4 columns (Submitted Claims, Acceptance Rate, Total Paid, Avg Payment Time), large numbers, trend indicators
- **Quick Actions:** 3 columns (Submit New Claim, View Pending, Download Reports), icon cards, hover lift effect
- **Claims Table:** Full width below, filterable (status, date range), searchable, 10 rows with pagination
- **Portfolio Chart:** Line graph showing revenue trend vs historical, toggle view (daily/weekly/monthly)

### Admin Dashboard
- **Overview Grid:** 2x2 metrics (Active Customers, Total Payments Out, Insurance Reimbursements In, Net Profit), color-coded
- **Customer List:** Table with rep assignment, onboarding status, claim volume, filters sidebar
- **AI System Health:** Status cards (Model Uptime, Error Rate, Processing Speed), real-time indicators
- **Revenue Chart:** Stacked area chart (Payments vs Reimbursements over time), legend with toggles

### Bank Partner Portal
- **Funding Summary:** Hero metrics (Total Funded, Outstanding, Default Rate <2%), confidence indicators
- **Claim Batches:** Accordion list, expandable details, approve/decline batch actions
- **Risk Dashboard:** Portfolio exposure visualization, high-risk alerts, historical performance

## Images

**Hero Images:**
- Provider Onboarding: Abstract illustration of instant payment flow (money moving from claim to bank), teal/blue gradient background, positioned right side of hero content
- Provider Dashboard: Background pattern of subtle claim code elements (faded ICD-10/CPT codes), very low opacity
- Bank Portal: Financial data visualization abstract (subtle charts/graphs pattern), blue monochrome

**Decorative Elements:**
- Success states: Checkmark illustrations for approved claims
- Empty states: Friendly illustrations for "No claims yet" with CTA to submit first claim
- Error states: Informative graphics for troubleshooting

## Animations

**Use Sparingly:**
- Skeleton loaders: During data fetch (subtle pulse)
- Status transitions: Smooth color change when claim status updates (200ms ease)
- Page transitions: Fade-in content (150ms)
- Micro-interactions: Button press scale (0.98), hover lift on cards (2px translateY)
- NO scroll-triggered animations, NO complex timeline sequences

## Accessibility & Dark Mode

- Maintain WCAG AA contrast ratios (4.5:1 for text, 3:1 for UI)
- Dark mode: Consistent across entire app including forms, tables, and modals
- Focus indicators: 2px ring with 2px offset, primary color
- Keyboard navigation: All interactive elements accessible via tab
- Screen reader: Proper ARIA labels on all data visualizations and dynamic content
- Form validation: Clear error messages, programmatically associated with fields

**Dark Mode Implementation:**
- Toggle in user menu (moon/sun icon)
- Persist preference in localStorage
- All form inputs have dark backgrounds matching surface color
- Charts use darker backgrounds with adjusted color brightness