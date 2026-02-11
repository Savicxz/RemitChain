Project Specification: RemitChain (Production Build)

Role: You are a Senior Full-Stack Blockchain Engineer and UI/UX Expert.
Objective: Port the attached single-file React prototype (RemitChainApp.jsx) into a production-ready Next.js 14+ (App Router) application.
Visual Mandate: The UI must look exactly like the provided prototype. Do not deviate from the "Neo-Swiss" aesthetic (Zinc-950 background, border-centric, high typography).

1. Tech Stack (Strict Enforcement)

Framework: Next.js 14+ (App Router, TypeScript).

Styling: Tailwind CSS + clsx + tailwind-merge + lucide-react.

State Management: Zustand (for global wallet/user state).

Blockchain Integration: * @polkadot/extension-dapp (Substrate).

WalletConnect v2 (`@walletconnect/ethereum-provider`) for mobile linking.

Backend/API: Next.js API Routes.

Rate Limiting: Redis (use Vercel KV or Upstash) implemented via Next.js Middleware.

Notifications: Twilio (SMS) & FCM (Push) integrated via API hooks.

2. Design System: "Neo-Swiss Finance"

Reference the prototype code for exact CSS classes.

Tailwind Config (tailwind.config.ts):

{
  theme: {
    extend: {
      colors: {
        background: '#09090b', // Zinc 950 (Global BG)
        surface: '#18181b',    // Zinc 900
        subtle: '#27272a',     // Zinc 800 (Borders)
        primary: '#ffffff',
        secondary: '#a1a1aa',  // Zinc 400
        emerald: { 500: '#10b981' }, // Success
        amber: { 500: '#f59e0b' },   // Pending
      },
      fontFamily: {
        sans: ['var(--font-inter)'], // Google Inter
        mono: ['var(--font-geist-mono)'], // Geist Mono
      },
      letterSpacing: {
        tight: '-0.025em',
        tighter: '-0.05em',
      }
    }
  }
}


Global CSS (app/globals.css):

body { @apply bg-[#09090b] text-white antialiased; }

Selection color: selection:bg-white selection:text-black.

3. Architecture & File Structure

Break the prototype into these modular components:

/src
  /app
    /(auth)
      /login/page.tsx       # The "Borders are Obsolete" Landing Page
    /(dashboard)
      /layout.tsx           # Contains TopNav (Sticky)
      /page.tsx             # Main Overview (Balance + Corridors)
      /corridors/page.tsx   # Full Corridor List
      /compliance/page.tsx  # KYC Status
    /api
      /remittance           # POST: Triggers send logic
      /notify               # POST: Twilio/FCM triggers
    /layout.tsx             # Root layout (Fonts, Providers)
    /middleware.ts          # Redis Rate Limiting logic
  /components
    /ui                     # Reusable Primitives
      /button.tsx           # The specific styles from prototype
      /logo.tsx             # The Ouroboros SVG component
      /badge.tsx            # KYC Status badges
    /features
      /wallet-connect.tsx   # Logic for Polkadot.js
      /send-flow            # The Slide-Over Modal (Complex State)
        /step-corridor.tsx
        /step-amount.tsx
        /step-confirm.tsx
  /lib
    /redis.ts               # Redis connection
    /polkadot.ts            # Chain interaction logic
  /store
    /use-wallet-store.ts    # Zustand store for Auth/Balance


4. Key Implementation Details

A. The Landing Page

Typography: The text "BORDERS ARE OBSOLETE" must be massive (text-7xl or text-8xl), font-bold, tracking-tighter.

Footer: Implement the "Secured By Polkadot" footer exactly as designed (side-by-side with separator).

B. The Send Flow (Slide-Over)

Animation: Use framer-motion for the entry/exit of the modal (Slide from right).

Logic: 1.  User selects Corridor -> State update.
2.  User inputs Amount -> Real-time calculation (fee/rate).
3.  User confirms -> Call /api/remittance/create.

C. The API & Redis

Wrap the /api/remittance route with a Redis rate limiter.

Limit: 5 transactions per minute per IP/Wallet.

D. Wallet Integration

The "Connect Wallet" button must trigger @polkadot/extension-dapp.

If extension is missing, show a clear error or fallback to WalletConnect.

5. Instructions for the Agent

Analyze the provided RemitChainApp.jsx code to extract the exact SVG paths for the Logo and Icons.

Scaffold the Next.js app structure.

Port the UI components first (Landing, Dashboard, Send Modal) to ensure visual fidelity.

Integrate the mock data first, then replace with Zustand stores.

Implement the API routes with the specified Redis middleware.

CRITICAL: The final output must look identical to the prototype. Do not use default Vercel styles. Use the Zinc-950 dark theme provided.
