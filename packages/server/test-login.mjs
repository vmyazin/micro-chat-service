const optionsRes = await fetch('http://localhost:8787/api/auth/login/options', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'test' })
});
const options = await optionsRes.json();
console.log('Options:', options);

if (!options.challenge) process.exit(1);

const verifyRes = await fetch('http://localhost:8787/api/auth/login/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    challenge: options.challenge,
    response: {
      id: "testcred",
      rawId: "testcred",
      type: "public-key",
      response: { clientDataJSON: "a", authenticatorData: "b", signature: "c", userHandle: "d" }
    }
  })
});
const verify = await verifyRes.text();
console.log('Verify:', verify);
