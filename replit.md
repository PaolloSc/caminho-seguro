# CaminhoSeguro - Plataforma de Mapeamento de Segurança Comunitária

## Overview

CaminhoSeguro é uma aplicação colaborativa de mapeamento de segurança que permite às usuárias relatar e visualizar incidentes e condições de segurança em sua área. Usuárias podem relatar assédio, iluminação precária, locais desertos e abrigos seguros em um mapa interativo. A plataforma incentiva verificação comunitária e discussão através de comentários.

**Idioma**: Português (Brasil)
**Público-alvo**: Mulheres brasileiras

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with custom theme variables and shadcn/ui components
- **Mapping**: Leaflet with react-leaflet bindings using OpenStreetMap tiles
- **Build Tool**: Vite with React plugin

The frontend follows a component-based architecture with:
- Pages in `client/src/pages/`
- Reusable UI components in `client/src/components/ui/` (shadcn/ui library)
- Custom hooks in `client/src/hooks/` for auth, reports, and utilities
- Path aliases configured: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful endpoints defined in `shared/routes.ts` with Zod validation
- **Authentication**: Replit Auth integration with OpenID Connect
- **Session Management**: PostgreSQL-backed sessions via connect-pg-simple

Server structure:
- `server/index.ts` - Entry point and middleware setup
- `server/routes.ts` - API route registration
- `server/storage.ts` - Database access layer (repository pattern)
- `server/db.ts` - Drizzle ORM database connection
- `server/replit_integrations/auth/` - Authentication module

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` and `shared/models/auth.ts`
- **Migrations**: Managed via `drizzle-kit push` command

Database tables:
- `users` - User profiles (required for Replit Auth)
- `sessions` - Session storage (required for Replit Auth)
- `reports` - Safety reports with location, type, severity, and verification count
- `comments` - User comments on reports
- `report_flags` - Denúncias de relatos falsos/inadequados
- `report_verifications` - Registro de verificações por usuária (persistido)

## Security Measures

### Rate Limiting
- 10 reports per hour per IP
- 5 reports per day per user
- 50 verifications per hour per IP
- 100 general requests per 15 minutes

### Privacy Protection
- **Location obfuscation**: Coordinates randomized ±50 meters
- **Display delay**: Reports appear 30 minutes after creation
- **User anonymization**: UserId removed from all API responses
- **Data sanitization**: All user input sanitized with sanitize-html

### Abuse Prevention
- Duplicate verification prevention (persisted in database)
- Report flagging system for community moderation
- Content validation and type restrictions

### Legal Compliance (Brazil)
- LGPD-compliant Privacy Policy page
- Terms of Use page
- DPO contact information
- User rights exercise workflow documented

### Shared Code
The `shared/` directory contains code used by both frontend and backend:
- `schema.ts` - Drizzle table definitions and Zod validation schemas
- `routes.ts` - API route definitions with type-safe request/response schemas
- `models/auth.ts` - User and session table definitions

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### Authentication
- **Replit Auth**: OpenID Connect-based authentication
- Required environment variables: `ISSUER_URL`, `REPL_ID`, `SESSION_SECRET`, `DATABASE_URL`

### Mapping
- **OpenStreetMap**: Tile provider for map display
- **Leaflet**: Core mapping library with React bindings

### UI Components
- **shadcn/ui**: Pre-built accessible components using Radix UI primitives
- **Radix UI**: Headless UI primitives for dialogs, menus, tooltips, etc.
- **Lucide React**: Icon library

### Key NPM Packages
- `@tanstack/react-query` - Server state management
- `zod` - Runtime type validation
- `drizzle-zod` - Zod schema generation from Drizzle tables
- `date-fns` - Date formatting utilities
- `vaul` - Drawer component for mobile interfaces
- `class-variance-authority` - Component variant management