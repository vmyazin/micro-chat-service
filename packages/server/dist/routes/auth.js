"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const hono_1 = require("hono");
const server_1 = require("@simplewebauthn/server");
const authRouter = new hono_1.Hono();
exports.authRouter = authRouter;
function generateUserId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
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
    });
    return c.json(options);
});
//# sourceMappingURL=auth.js.map