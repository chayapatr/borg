# Borg

A visual project management and knowledge organization platform built with SvelteKit. Borg combines canvas-based project visualization with traditional task management, creating a collaborative workspace where teams can organize projects, tasks, timelines, and knowledge in an interconnected visual interface.

## Features

### 🎨 Visual Canvas Interface

- **Project Canvas**: Individual project workspaces with rich node-based content
- **Project Portfolio**: Overview canvas showing all projects with summary information
- **Universal Nodes**: Support for notes (Post-It style), images, iframes, and stickers
- **Drag & Drop**: Intuitive visual organization with @xyflow/svelte

### 📋 Task Management

- **Node-Centric Tasks**: Tasks attached to specific canvas elements
- **Person Assignment**: Assign tasks to team members with profile integration
- **Due Dates**: Track deadlines with overdue detection
- **Status Tracking**: Active/resolved task states with reactivation capability
- **Hierarchical Views**: Organize tasks by Project → Node → Task structure

### 👥 Collaboration

- **People Management**: Team member profiles and contact information
- **Project Collaboration**: Multi-user access with member/collaborator roles
- **Real-time Updates**: Live synchronization when using Firebase backend
- **Timeline Events**: Track project milestones and important dates

## Getting Started

### Prerequisites

- Node.js 22
- pnpm

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
```

### Development

```bash
# Run Firebase emulators
docker-compose up -d

# Start app
pnpm dev
```

When using Firebase emulators, the fake Google Sign-In dialog will let you create fake accounts and sign in with any email address. Use an email starting with "admin" (e.g., `admin@example.com`) to automatically get admin permissions.

### Building

```bash
# Create production build
pnpm build

# Preview production build
pnpm preview
```

## Code Quality

```bash
# Type checking
pnpm check

# Linting and formatting
pnpm lint
pnpm format
```
