# MicroChat

A privacy-focused group messaging service with end-to-end encryption.

## Security Claims

- **End-to-end encrypted** — we can't read your messages
- **Server-side crypto-erasure** when groups are deleted
- **Minimal metadata retention**
- **Built on audited, standard protocols** (MLS - RFC 9420)
- **Sealed Sender** — send messages without revealing your identity to the server

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

## Sealed Sender

MicroChat now supports **Sealed Sender**, a privacy feature that hides the sender's identity from the server while still allowing recipients to verify who sent the message.

### How It Works

1. **Token Issuance**: Before sending a sealed message, your client requests a pool of anonymous tokens from the server. The server stores only the SHA-256 hashes of these tokens, not the tokens themselves, and does not link them to your identity.

2. **Message Sending**: When you send a sealed message, your client includes a token in the request. The server verifies the token is valid (was issued for this group) and marks it used, then stores the message with `sender_id = NULL`.

3. **Identity Encryption**: Your sender identity is encrypted with the group's key and included in the message payload. Only group members with the decryption key can read it.

### What the Server Knows

| Metadata | Sealed Sender | Regular Send |
|----------|---------------|--------------|
| Message content | Encrypted | Encrypted |
| Sender identity | **Hidden** | Stored in database |
| Group membership | Yes (token validation) | Yes |
| Timestamp | Yes | Yes |
| IP address | Yes (rate limiting) | Yes |

### Usage

```typescript
// Enable Sealed Sender when creating the client
const client = new MicroChatClient({
  baseUrl: 'http://localhost:8787',
  enableSealedSender: true,
});

// Pre-fetch tokens before sending (optional but recommended)
await client.prefetchSenderTokens(groupId);

// Send a sealed message
await client.sendMessage(groupId, content, epoch, {
  sealedSender: true,
  senderId: userId,
  senderName: displayName,
});
```

### Security Notes

- Tokens expire after 24 hours
- Each token can only be used once
- The server still knows you are a member of the group (needed to issue tokens)
- Sealed Sender provides protection against the server correlating messages to users, but does not provide perfect anonymity against timing analysis

## Documentation

- [THREAT_MODEL.md](./THREAT_MODEL.md) - Security threat model and design decisions
- [AGENTS.md](./AGENTS.md) - Development guidance
