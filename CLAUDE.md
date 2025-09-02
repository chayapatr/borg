# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `pnpm dev` - Start development server (uses pnpm, not npm)
- `pnpm build` - Build production version
- `pnpm preview` - Preview production build

### Code Quality
- `pnpm lint` - Run prettier check and eslint
- `pnpm format` - Format code with prettier
- `pnpm check` - Run Svelte type checking
- `pnpm check:watch` - Run Svelte type checking in watch mode

### Firebase Emulator (for testing)
- `docker-compose up` - Start Firebase emulators via Docker
- Access Firebase UI at http://localhost:4000
- Emulator ports: Auth (9099), Firestore (8080), Storage (9199)

## Architecture Overview

### Service Architecture Pattern
The codebase uses a **dual-service architecture** that switches between local storage and Firebase based on the `VITE_SERVICE_MODE` environment variable:

- **Local Mode**: Data stored in browser localStorage (default)
- **Firebase Mode**: Data stored in Firebase with authentication required

The `ServiceFactory` class (`src/lib/services/ServiceFactory.ts`) creates appropriate service instances:
- Projects, Tasks, People, Timeline, Nodes, and User services
- Sticker service always uses Firebase Storage regardless of mode
- Mode switching controlled by `VITE_SERVICE_MODE=firebase` environment variable

### Key Service Interfaces
All services implement interfaces in `src/lib/services/interfaces/`:
- `IProjectsService` - Project management
- `ITaskService` - Task management with hierarchical support
- `IPeopleService` - People/contact management
- `ITimelineService` - Timeline events
- `INodesService` - Canvas node management (uses @xyflow/svelte)
- `IStickerService` - Sticker/image management
- `IUserService` - User profile management

### Firebase Configuration
- Firebase config in `src/lib/firebase/config.ts`
- Auto-connects to emulators when project ID starts with 'demo-'
- Emulator setup via Docker with `firebase.emulator.docker.json`

### Authentication
- Firebase Auth integration via `authStore` (Svelte store)
- User approval system with member/collaborator roles
- Authentication wrapper in `+layout.svelte` only active in Firebase mode

### Frontend Stack
- **SvelteKit 5** with TypeScript
- **TailwindCSS 4** for styling
- **@xyflow/svelte** for canvas/flow diagrams
- **Lucide Svelte** for icons

### Component Structure
- `src/lib/components/` - Reusable components
- `src/lib/components/UniversalNode/` - Canvas node types (Note, Sticker, Image, Iframe)
- `src/lib/components/browser/` - Tab-based browser interface components
- `src/lib/components/fields/` - Dynamic form field system
- `src/lib/components/tasks/` - Task management UI

### Key Patterns
- Services instantiated via factory pattern for mode switching
- Interface-based design for service abstractions
- Svelte stores for state management (`authStore`)
- Dynamic field rendering system for extensible forms
- Canvas-based project visualization with node system

### Environment Variables
- `VITE_SERVICE_MODE` - 'local' or 'firebase' (defaults to local)
- Firebase config variables (API keys, project ID, etc.)
- Use `demo-` prefix in project ID to enable emulator mode

### Development Notes
- Uses pnpm package manager
- Legacy local services marked as deprecated (see `src/lib/services/local/README.md`)
- Firebase emulator setup supports full development workflow
- Authentication required only in Firebase mode