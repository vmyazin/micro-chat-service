import { test, expect, type BrowserContext, type Page } from '@playwright/test';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

interface TestUser {
  userId: string;
  sessionId: string;
}

async function createTestUser(displayName: string): Promise<TestUser> {
  const resp = await fetch(`${API_URL}/api/test/create-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName }),
  });
  if (!resp.ok) {
    throw new Error(`Failed to create test user (${resp.status}): ${await resp.text()}`);
  }
  return resp.json() as Promise<TestUser>;
}

async function loginWithSession(context: BrowserContext, sessionId: string): Promise<void> {
  await context.addCookies([
    {
      name: 'session',
      value: sessionId,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

/**
 * Wait for an element to be visible, retrying with a short poll interval.
 * Used for elements that appear after async operations (tree key setup, WS events).
 */
async function waitForText(page: Page, text: string, timeout = 15000): Promise<void> {
  await expect(page.getByText(text)).toBeVisible({ timeout });
}

test.describe('Two-user encrypted chat', () => {
  test('Alice and Bob can exchange encrypted messages', async ({ browser }) => {
    // Create two test users via the test endpoint
    const alice = await createTestUser('Alice-E2E');
    const bob = await createTestUser('Bob-E2E');

    // Open isolated browser contexts for each user
    const aliceCtx = await browser.newContext();
    const bobCtx = await browser.newContext();
    const alicePage = await aliceCtx.newPage();
    const bobPage = await bobCtx.newPage();

    // Inject session cookies before navigating
    await loginWithSession(aliceCtx, alice.sessionId);
    await loginWithSession(bobCtx, bob.sessionId);

    // ── Alice: create a group ────────────────────────────────────────────────
    await alicePage.goto('/chat');
    await alicePage.getByTestId('new-group-btn').click();
    await alicePage.getByTestId('group-name-input').fill('E2E Test Group');
    await alicePage.getByTestId('create-group-submit').click();

    // Wait for navigation to the new group chat (TreeKEM initGroup runs here)
    await alicePage.waitForURL(/\/chat\/[a-f0-9]+/, { timeout: 15000 });

    // ── Alice: create an invite link ─────────────────────────────────────────
    await alicePage.getByTestId('group-settings-btn').click();
    // Wait for the settings drawer to open
    await alicePage.getByTestId('invite-btn').waitFor({ state: 'visible' });
    await alicePage.getByTestId('invite-btn').click();

    // Wait for invite code input to appear and get its value
    const inviteCodeInput = alicePage.getByTestId('invite-code');
    await inviteCodeInput.waitFor({ state: 'visible', timeout: 10000 });
    const inviteLink = await inviteCodeInput.inputValue();
    expect(inviteLink).toMatch(/\/invite\/[a-f0-9]+/);

    // Extract just the code from the invite link
    const codeMatch = inviteLink.match(/\/invite\/([a-f0-9]+)/);
    expect(codeMatch).not.toBeNull();
    const inviteCode = codeMatch![1];

    // Close settings drawer
    await alicePage.keyboard.press('Escape');

    // Set up listener BEFORE Bob joins so we capture Alice's addMemberToTree
    // tree-update (the one that includes the Welcome for Bob). Alice must finish
    // committing the new epoch before we send a message, otherwise the message
    // is encrypted at the old epoch and Bob cannot decrypt it.
    const addMemberTreeUpdate = alicePage.waitForResponse(
      (resp) => resp.url().includes('/tree-update') && resp.status() === 200,
      { timeout: 20000 },
    );

    // ── Bob: accept the invite ───────────────────────────────────────────────
    await bobPage.goto(`/invite/${inviteCode}`);
    // After accepting, Bob should be redirected to the group chat
    await bobPage.waitForURL(/\/chat\/[a-f0-9]+/, { timeout: 15000 });

    // Wait for Alice's addMemberToTree to complete (epoch 2 committed + Welcome sent)
    await addMemberTreeUpdate;
    // Wait for Bob's page to finish all pending network requests (tree-state fetch,
    // message history, etc.), then add an explicit pause for the async crypto work
    // that follows — Welcome processing, epoch-2 key derivation, and the IndexedDB
    // write all happen after the last HTTP response and are invisible to networkidle.
    await bobPage.waitForLoadState('networkidle', { timeout: 10000 });
    await bobPage.waitForTimeout(2000); // let IndexedDB key storage settle

    // ── Alice: send a message ────────────────────────────────────────────────
    const aliceMsg = 'Hello Bob, this message is end-to-end encrypted!';
    const msgInput = alicePage.getByTestId('message-input');
    // toBeEnabled waits for disabled={loading} to clear (useMessages initial load)
    await expect(msgInput).toBeEnabled({ timeout: 10000 });
    await msgInput.fill(aliceMsg);
    await msgInput.press('Enter');
    // Confirm send succeeded: input should be cleared
    await expect(msgInput).toHaveValue('', { timeout: 5000 });

    // Alice should see her own message
    await waitForText(alicePage, aliceMsg);

    // ── Bob: wait for Alice's message and reply ──────────────────────────────
    // Bob needs time for the TreeKEM welcome to arrive and be processed
    await waitForText(bobPage, aliceMsg, 20000);

    const bobMsg = 'Hi Alice! Got your encrypted message!';
    const bobMsgInput = bobPage.getByTestId('message-input');
    await expect(bobMsgInput).toBeEnabled({ timeout: 10000 });
    await bobMsgInput.fill(bobMsg);
    await bobMsgInput.press('Enter');
    await expect(bobMsgInput).toHaveValue('', { timeout: 5000 });

    // Both users should see Bob's message
    await waitForText(bobPage, bobMsg);
    await waitForText(alicePage, bobMsg, 15000);

    await aliceCtx.close();
    await bobCtx.close();
  });
});
