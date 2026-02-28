---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/app/(chat)/chat/[groupId]/page.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "Voice messages are sent with the current TreeKEM epoch"
    - "Image messages are sent with the current TreeKEM epoch"
  artifacts:
    - path: "apps/web/app/(chat)/chat/[groupId]/page.tsx"
      provides: "Updated handleSendVoiceMessage and handleSendImage with epoch"
      contains: "treekemManager.getEpoch"
  key_links:
    - from: "apps/web/app/(chat)/chat/[groupId]/page.tsx"
      to: "packages/client/src/message-client.ts"
      via: "client.sendVoiceMessage / client.sendImageMessage epoch param"
      pattern: "getEpoch.*groupId"
---

<objective>
Pass the current TreeKEM epoch to voice and image message sends so all message types use live key material instead of falling back to epoch 0.

Purpose: Text messages already pass the epoch via treekemManager.getEpoch(groupId). Voice and image sends in the same page skip the epoch parameter entirely, breaking forward secrecy for those message types.
Output: page.tsx with epoch passed to all three send paths (text, voice, image).
</objective>

<execution_context>
@/Users/vm/.claude/get-shit-done/workflows/execute-plan.md
@/Users/vm/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/vm/dev/@playground/micro-chat-service/.planning/STATE.md

Key facts discovered during planning:

1. Text messages already pass epoch correctly (line 427 in page.tsx):
   ```ts
   const epoch = treekemManager.getEpoch(groupId as GroupId);
   await sendMessage.mutateAsync({ content, epoch });
   ```

2. Voice messages DO NOT pass epoch (line 435):
   ```ts
   const result = await client.sendVoiceMessage(groupId as GroupId, audioBlob, duration);
   // missing: epoch arg
   ```

3. Image messages DO NOT pass epoch (line 461):
   ```ts
   const result = await client.sendImageMessage(groupId as GroupId, blob, width, height);
   // missing: epoch arg
   ```

4. The client methods accept epoch as an optional parameter:
   - `sendVoiceMessage(groupId, audioBlob, duration, epoch?, options?)`
   - `sendImageMessage(groupId, encryptedBlob, width, height, epoch?, options?)`

5. `treekemManager` is already on scope in `ConversationPage` (line 54):
   ```ts
   const treekemManager = useChatClientStore((state) => state.treekemManager);
   ```

6. All other TreeKEM wiring is already in place:
   - useWebSocket handles treeUpdate events
   - NewGroupDialog calls initGroupTree after group creation
   - invite/[code]/page.tsx calls joinGroupTree after accepting invite
</context>

<tasks>

<task type="auto">
  <name>Task 1: Pass epoch to voice and image message sends</name>
  <files>apps/web/app/(chat)/chat/[groupId]/page.tsx</files>
  <action>
In `handleSendVoiceMessage` and `handleSendImage` inside `ConversationPage`, retrieve the current TreeKEM epoch via `treekemManager.getEpoch(groupId as GroupId)` and pass it as the `epoch` argument to `client.sendVoiceMessage` and `client.sendImageMessage` respectively.

`handleSendVoiceMessage` (around line 431): change
```ts
const result = await client.sendVoiceMessage(
  groupId as GroupId,
  audioBlob,
  duration,
);
```
to
```ts
const epoch = treekemManager.getEpoch(groupId as GroupId);
const result = await client.sendVoiceMessage(
  groupId as GroupId,
  audioBlob,
  duration,
  epoch,
);
```

`handleSendImage` (around line 457): change
```ts
const result = await client.sendImageMessage(
  groupId as GroupId,
  blob,
  width,
  height,
);
```
to
```ts
const epoch = treekemManager.getEpoch(groupId as GroupId);
const result = await client.sendImageMessage(
  groupId as GroupId,
  blob,
  width,
  height,
  epoch,
);
```

No new imports needed — `treekemManager` is already destructured from the store at line 54.
  </action>
  <verify>
    <automated>cd /Users/vm/dev/@playground/micro-chat-service && pnpm --filter @microchat/web exec tsc --noEmit 2>&1 | grep -E "error TS|page\.tsx" | head -20 || echo "no tsc script — checking build" && pnpm --filter @microchat/web build 2>&1 | tail -20</automated>
  </verify>
  <done>Both handleSendVoiceMessage and handleSendImage pass epoch from treekemManager.getEpoch(groupId). Build passes with no new TypeScript errors in page.tsx.</done>
</task>

</tasks>

<verification>
Manual testing steps (per CLAUDE.md requirement):

1. Start dev server: `pnpm dev`
2. Open two browser windows and log in as two different users
3. Have User A create a group and User B join via invite link
4. User A sends a voice message — verify it sends without error (check browser console for epoch-related warnings)
5. User A sends an image — verify it sends without error
6. User B receives both messages and can play/view them
7. In the browser DevTools Network tab, confirm the POST requests to `/api/groups/:id/messages` include a non-zero `epoch` in the request body for voice and image sends
</verification>

<success_criteria>
All three message types (text, voice, image) pass the current TreeKEM epoch when sending. The epoch field in network requests is non-zero (assuming TreeKEM was initialized for the group). No TypeScript errors introduced.
</success_criteria>

<output>
After completion, create `.planning/quick/1-treekem-ui-integration/1-SUMMARY.md`
</output>
