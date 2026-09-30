# LeadFlow AI — Architecture & Free-First Overview

## System Architecture
- **Frontend**: React 19 + TypeScript + Tailwind CSS (Vite SPA).
- **Backend API**: Node.js Express server with Google Gemini 2.5 Flash Cloud AI Gateway.
- **Data Persistence**: Multi-tenant schema with PostgreSQL support via Drizzle ORM and resilient local-first fallback.
- **Telephony & Voice**: Web Speech API + Gemini real-time speech synthesis + Twilio Voice TwiML Webhook (`/api/telephony/voice-webhook`).
- **Security**: SHA-256 Master Owner Password encryption, Terminal Quick-Lock, RBAC (`OWNER`, `ADMIN`, `STAFF`, `VIEWER`), and tenant data isolation.
