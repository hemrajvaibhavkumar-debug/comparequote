# QuoteCompare AI - Project Context

QuoteCompare AI is a specialized tool designed to automate the extraction and comparison of procurement quotations. It uses Google's Gemini AI to parse unstructured data from text, PDFs, images, and emails into a structured, side-by-side comparison table.

## Project Overview

- **Purpose**: Automate quotation comparison for procurement teams.
- **Architecture**: 
  - **Frontend**: React 19 SPA powered by Vite and Tailwind CSS 4.
  - **Backend**: Express.js server that handles API requests, database persistence, and Gmail integration.
  - **AI Engine**: Google Gemini (`gemini-2.5-flash` for general extraction, `gemini-3.1-pro-preview` for Gmail analysis).
  - **Database**: PostgreSQL (intended for Neon DB) for saving and retrieving comparison tables.

## Key Technologies

- **Frontend**: React, React Router, Tailwind CSS 4, Framer Motion, Lucide Icons.
- **Backend**: Node.js, Express, PostgreSQL (`pg`), Google APIs (`googleapis`).
- **AI**: `@google/genai` (Google Generative AI SDK).
- **Build Tools**: Vite, Esbuild, `tsx` for TypeScript execution.

## Building and Running

### Prerequisites
- Node.js (v18+ recommended)
- A Google Gemini API Key
- (Optional) A PostgreSQL database (e.g., Neon DB)
- (Optional) Google OAuth Client ID for Gmail integration

### Environment Setup
Create a `.env` file in the root (referencing `.env.example`):
```env
GEMINI_API_KEY=your_api_key_here
DATABASE_URL=your_postgres_connection_string
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

### Commands
- **Install Dependencies**: `npm install`
- **Development**: `npm run dev` (Starts Express server with Vite middleware)
- **Build**: `npm run build` (Builds frontend to `dist/` and bundles `server.ts` to `dist/server.js`)
- **Production**: `npm start` (Runs the bundled production server)
- **Lint/Type Check**: `npm run lint`

## Project Structure

- `server.ts`: Main entry point. Configures Express, initializes the database, and integrates Vite for dev mode.
- `serverGmail.ts`: Handles Gmail API integration and email parsing via Gemini.
- `src/services/gemini.ts`: Core AI service for extracting quotation data from text and files.
- `src/Builder.tsx`: The primary interface for data input (upload, text paste, or Gmail sync).
- `src/components/ComparisonTable.tsx`: Complex UI component for rendering and editing comparison data.
- `src/types.ts`: TypeScript interfaces for the application's data models.
- `metadata.json`: Contains project-wide configuration or metadata.

## Development Conventions

- **Type Safety**: Strictly typed with TypeScript. Ensure any new components or services follow the existing interfaces in `src/types.ts`.
- **AI Prompts**: Extraction logic is sensitive to prompt engineering in `src/services/gemini.ts` and `serverGmail.ts`. Always test with sample quotations after modifications.
- **Styling**: Uses Tailwind CSS 4. Note that some utility scripts (`fix_colors.cjs`) exist to manage color consistency across components.
- **Database**: Uses `pg` with raw SQL for schema initialization and basic CRUD. Updates to the schema should be reflected in the initialization block in `server.ts`.
- **Exports**: Supports CSV (via `papaparse`) and PDF (via `html2canvas` and `jspdf`) exports.

## Usage Guide

1. **Extraction**: Users can paste quotation text or upload files (PDF/Images) in the "Compare" tab.
2. **Gmail Sync**: Authenticate with Google to pull recent emails with attachments and have Gemini extract quotes directly from them.
3. **Refinement**: Extracted data is presented in an editable table for manual adjustments.
4. **Persistence**: Tables can be saved to the database using a unique "Doc No." and later retrieved from the "Saved Tables" tab.
