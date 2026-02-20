import { verifyAuthenticationResponse } from '@simplewebauthn/server';
export default {
  async fetch(req, env, ctx) {
    try {
      await verifyAuthenticationResponse({
        response: { id: "test", rawId: "test", type: "public-key", response: { authenticatorData: "a", clientDataJSON: "b", signature: "c", userHandle: "d" }},
        expectedChallenge: "chal",
        expectedOrigin: "http://localhost",
        expectedRPID: "localhost",
        credential: { id: "test", publicKey: new Uint8Array([1,2,3]), counter: 0 }
      });
      return new Response("OK");
    } catch(e) {
      return new Response(e.stack || e.message);
    }
  }
}
