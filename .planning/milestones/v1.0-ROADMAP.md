# MicroChat Roadmap

> Minimal GSD stub — enables quick task tracking without full milestone ceremony.

## Project

MicroChat is a secure, end-to-end encrypted messaging service built on Cloudflare Workers, WebRTC, and a custom TreeKEM protocol.

## Milestone 1 — MVP

**Status:** In Progress

### Phase 1: Core Chat ✅
### Phase 2: Voice Calls ✅
### Phase 3: TreeKEM Crypto + Server Wiring ✅

### Phase 4: TreeKEM UI Integration

**Goal:** Wire all UI flows (create group, join group, send message) to the TreeKEM lifecycle so the app uses live key material instead of epoch 0 fallbacks.

**Status:** In Progress

**Success Criteria:**
1. `useCreateGroup` calls `initGroupTree()` after group creation
2. `useAcceptInvite` calls `joinGroupTree()` after joining
3. `useWebSocket` handles `treeUpdate` events via `handleTreeUpdate()`
4. All message types (text, voice, image) pass the current epoch when sending
