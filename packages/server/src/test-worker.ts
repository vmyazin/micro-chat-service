import { verifyAuthenticationResponse } from '@simplewebauthn/server';

type Env = object;

export default {
  async fetch(_req: Request, _env: Env, _ctx: ExecutionContext) {
    try {
      await verifyAuthenticationResponse({
        response: {
          id: 'test',
          rawId: 'test',
          type: 'public-key',
          clientExtensionResults: {},
          response: {
            authenticatorData: 'a',
            clientDataJSON: 'b',
            signature: 'c',
            userHandle: 'd',
          },
        },
        expectedChallenge: 'chal',
        expectedOrigin: 'http://localhost',
        expectedRPID: 'localhost',
        credential: {
          id: 'test',
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 0,
        },
      });
      return new Response('OK');
    } catch (error: unknown) {
      console.error('Test worker auth verification failed', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};
