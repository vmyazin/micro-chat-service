# MicroChat Development Guide

## Package Manager

Use **pnpm** for all package management.

## Commands

- **Build:** `pnpm build`
- **Test:** `pnpm test`
- **Typecheck:** `pnpm typecheck`
- **Development:** `pnpm dev`

## Structure

```
packages/
├── server/   # Backend API, WebSocket server, message routing
├── client/   # Client SDK for encryption, sending, receiving
├── crypto/   # MLS protocol (RFC 9420), key management, crypto-erasure
└── shared/   # Shared TypeScript types and utilities

apps/
└── web/      # Web application frontend
```

## Conventions

- TypeScript strict mode enabled
- Path aliases: `@microchat/server`, `@microchat/client`, `@microchat/crypto`, `@microchat/shared`
- ES2022 target
