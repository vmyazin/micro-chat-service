# MicroChat

A privacy-focused group messaging service with end-to-end encryption.

## Security Claims

- **End-to-end encrypted** — we can't read your messages
- **Server-side crypto-erasure** when groups are deleted
- **Minimal metadata retention**
- **Built on audited, standard protocols** (MLS - RFC 9420)

## Monorepo Structure

```
micro-chat-service/
├── packages/
│   ├── server/      # Backend API and WebSocket server
│   ├── client/      # Client SDK for messaging
│   ├── crypto/      # MLS protocol implementation and key management
│   └── shared/      # Shared types and utilities
├── apps/
│   └── web/         # Web application
├── package.json     # Root workspace configuration
├── pnpm-workspace.yaml
└── tsconfig.json    # Base TypeScript configuration
```

## Getting Started

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check all packages
pnpm typecheck

# Start development
pnpm dev

# Start web app only
pnpm dev:web
```

## Documentation

- [THREAT_MODEL.md](./THREAT_MODEL.md) - Security threat model and design decisions
- [AGENTS.md](./AGENTS.md) - Development guidance
