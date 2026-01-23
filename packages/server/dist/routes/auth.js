"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const hono_1 = require("hono");
const cookie_1 = require("hono/cookie");
const server_1 = require("@simplewebauthn/server");
const client_1 = require("../db/client");
const authRouter = new hono_1.Hono();
exports.authRouter = authRouter;
function generateUserId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
function generateSessionId() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
function generateCredentialId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
function uint8ArrayToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
authRouter.post('/api/auth/register/options', async (c) => {
    const body = await c.req.json();
    if (!body.displayName || typeof body.displayName !== 'string') {
        return c.json({ error: 'displayName is required' }, 400);
    }
    const userId = generateUserId();
    const userIdBytes = new TextEncoder().encode(userId);
    const userIdBuffer = new Uint8Array(userIdBytes.buffer.slice(0));
    const options = await (0, server_1.generateRegistrationOptions)({
        rpName: c.env.RP_NAME || 'MicroChat',
        rpID: c.env.RP_ID || 'localhost',
        userName: body.displayName,
        userDisplayName: body.displayName,
        userID: userIdBuffer,
        attestationType: 'none',
        excludeCredentials: [],
        authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
        },
        supportedAlgorithmIDs: [-7, -257],
    });
    c.env.CHALLENGE_STORE.set(options.challenge, {
        challenge: options.challenge,
        userId,
        displayName: body.displayName,
        expiresAt: Date.now() + 5 * 60 * 1000,
        type: 'registration',
    });
    return c.json(options);
});
authRouter.post('/api/auth/register/verify', async (c) => {
    const body = await c.req.json();
    if (!body.response || !body.challenge) {
        return c.json({ error: 'response and challenge are required' }, 400);
    }
    const storedChallenge = c.env.CHALLENGE_STORE.get(body.challenge);
    if (!storedChallenge) {
        return c.json({ error: 'Challenge not found or expired' }, 400);
    }
    if (storedChallenge.expiresAt < Date.now()) {
        c.env.CHALLENGE_STORE.delete(body.challenge);
        return c.json({ error: 'Challenge expired' }, 400);
    }
    try {
        const verification = await (0, server_1.verifyRegistrationResponse)({
            response: body.response,
            expectedChallenge: storedChallenge.challenge,
            expectedOrigin: c.env.RP_ORIGIN || 'http://localhost:3000',
            expectedRPID: c.env.RP_ID || 'localhost',
        });
        if (!verification.verified || !verification.registrationInfo) {
            return c.json({ error: 'Registration verification failed' }, 400);
        }
        c.env.CHALLENGE_STORE.delete(body.challenge);
        const db = new client_1.Database(c.env.DB);
        const now = new Date().toISOString();
        const userId = storedChallenge.userId;
        await db.execute('INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)', [userId, storedChallenge.displayName, now]);
        const credId = generateCredentialId();
        const publicKeyBase64 = uint8ArrayToBase64(verification.registrationInfo.credential.publicKey);
        await db.execute('INSERT INTO credentials (id, user_id, credential_id, public_key, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?)', [credId, userId, verification.registrationInfo.credential.id, publicKeyBase64, now, null]);
        const sessionId = generateSessionId();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await db.execute('INSERT INTO sessions (id, user_id, expires_at, device_info, created_at) VALUES (?, ?, ?, ?, ?)', [sessionId, userId, expiresAt, '', now]);
        (0, cookie_1.setCookie)(c, 'session', sessionId, {
            path: '/',
            httpOnly: true,
            secure: c.env.RP_ORIGIN?.startsWith('https') ?? false,
            sameSite: 'Lax',
            maxAge: 30 * 24 * 60 * 60,
        });
        return c.json({
            verified: true,
            userId,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Verification failed';
        return c.json({ error: message }, 400);
    }
});
authRouter.post('/api/auth/login/options', async (c) => {
    const body = await c.req.json().catch(() => ({ username: undefined }));
    const db = new client_1.Database(c.env.DB);
    let allowCredentials = [];
    if (body.username) {
        const users = await db.query('SELECT id FROM users WHERE display_name = ?', [body.username]);
        if (users.length > 0) {
            const credentials = await db.query('SELECT credential_id FROM credentials WHERE user_id = ?', [users[0].id]);
            allowCredentials = credentials.map((cred) => ({
                id: cred.credential_id,
                type: 'public-key',
            }));
        }
    }
    const options = await (0, server_1.generateAuthenticationOptions)({
        rpID: c.env.RP_ID || 'localhost',
        userVerification: 'preferred',
        allowCredentials,
    });
    c.env.CHALLENGE_STORE.set(options.challenge, {
        challenge: options.challenge,
        expiresAt: Date.now() + 5 * 60 * 1000,
        type: 'authentication',
    });
    return c.json(options);
});
//# sourceMappingURL=auth.js.map