# Protocol Page — Animation Design Reference

`apps/web/app/protocol/page.tsx` — Layman section interactive illustrations.

---

## Core Pattern: Phase-Based State Machine

Every demo uses the same structural foundation:

```tsx
const [phase, setPhase] = useState(0);

useEffect(() => {
  const DURATIONS = [/* ms per phase */];
  const ids: ReturnType<typeof setTimeout>[] = [];

  const cycle = () => {
    let t = 0;
    DURATIONS.forEach((d, i) => {
      ids.push(setTimeout(() => setPhase(i), t));
      t += d;
    });
    ids.push(setTimeout(cycle, t)); // infinite loop
  };

  cycle();
  return () => ids.forEach(clearTimeout); // cleanup on unmount
}, []);
```

**Why this pattern:**
- All visual state is derived from a single integer — easy to reason about
- Durations are co-located in one array — trivial to adjust pacing globally
- `clearTimeout` on every collected ID ensures no memory leaks or stale callbacks after unmount
- No external animation library state or refs needed beyond Framer Motion's `animate` prop

---

## Shared UI Conventions

### Status Banner
Every demo has a top-centered pill label that transitions with `AnimatePresence mode="wait"`, keyed on `phase`. It changes color based on semantic meaning:

| State | Light scheme | Dark scheme |
|-------|-------------|-------------|
| Neutral/default | `bg-white text-slate-500 border-slate-200` | `bg-slate-800 text-slate-400 border-slate-700` |
| Danger/destruction | `bg-red-50 text-red-500 border-red-200` | `bg-red-950/70 text-red-400 border-red-800` |
| Success/delivered | `bg-green-50 text-green-600 border-green-200` | — |
| Forming/constructive | `bg-amber-50 text-amber-600 border-amber-200` | `bg-amber-950/70 text-amber-400 border-amber-800` |
| Ghost/anonymous | `bg-purple-50 text-purple-600 border-purple-200` | — |

Banner transition: `initial={{ opacity: 0, y: -8 }}` → `animate={{ opacity: 1, y: 0 }}` → `exit={{ opacity: 0, y: 6 }}`, duration `0.2s`.

### Sub-labels Under Nodes
Nodes (people, server) have a `h-4` reserved slot below their name for contextual micro-labels ("✓ Unlocked", "Anonymous", "No idea who", etc.). These use `AnimatePresence` so they don't cause layout shift — the fixed height holds the space whether or not the label is present.

---

## Demo 1 — The Sealed Box (`LaymanEncryptionDemo`)

**Concept:** End-to-end encryption. The server relays but cannot read.

**Presentation style:** Horizontal journey with three nodes (You · Server · Friend).

**Phases:** 14 total — forward trip (0–6) then reverse reply (7–13).

```
Forward:  You → [sealed] → Server [blocked] → Friend [opens]
Reverse:  Friend → [sealed] → Server [blocked] → You [opens]
```

**Message position logic:**
```tsx
const msgLeft =
  phase <= 1   ? '15%'   // at You
  : phase <= 3 ? '50%'   // at Server
  : phase <= 8 ? '85%'   // at Friend
  : phase <= 10 ? '50%'  // at Server (return)
  : '15%';               // back at You
```
The Framer Motion `animate={{ left: msgLeft }}` transition drives movement; position changes between phases cause the travel animation automatically.

**Key visual moments:**
- **Sealing (phase 1 / 8):** Amber key badge on the sender's avatar scales to 1.6× and rotates ±35°. The open letter (blue/green lines) swaps to a dark sealed box via `AnimatePresence mode="wait"`.
- **Server blocked (phase 3 / 10):** Server card pulses red (background/border keyframes over 0.9s), a red ✕ badge springs in, "Encrypted" micro-label fades in below.
- **Unsealing (phase 5 / 12):** Receiver's key badge pulses. Dark box swaps back to open letter.
- **Reply differentiation:** Return-trip message uses `bg-green-50 border-green-300` lines vs outgoing `bg-white border-blue-300` — the color encodes direction.

**Node keys:**
- You and Friend each have an amber `KeyIcon` badge (w-6 h-6, bg-amber-400 rounded-full). Server has none — this is the visual proof of the concept.

---

## Demo 2 — Self-Destructing Keys (`LaymanRatchetDemo`)

**Concept:** Forward secrecy. Each message uses a unique key that is destroyed immediately after use.

**Presentation style:** Theatrical center-stage. A single large key occupies the center; no travel path. Completely different from the other two demos.

**Phases:** 7 per key cycle. State also tracks `keyIndex` (increments each cycle via `setKeyIndex(prev => prev + 1)`).

```
0  Active key glows center-stage
1  Message sent
2  Overheat — key turns red, shakes
3  Explosion — 12 particles burst outward
4  Smoke — blurry blobs drift up; DESTROYED label
5  New key assembles (spring entrance + orbiting sparkles)
6  New key ready
```

**Color scheme: Dark** (only demo with dark background).

Background: `radial-gradient(ellipse at center, rgba(120,53,15,0.25) 0%, #020617 65%)` — deep navy with warm amber center glow.

**Explosion particles (12):**
```tsx
const PARTICLES = [
  { dx:  0,   dy: -58, color: 'bg-amber-400', size: 'w-2 h-2' },
  { dx:  41,  dy: -41, color: 'bg-orange-400', size: 'w-1.5 h-1.5' },
  // ... 8 compass directions + 4 diagonal shards
];
```
Each particle: `initial={{ x:0, y:0, opacity:1, scale:1 }}` → `animate={{ x:dx, y:dy, opacity:0, scale:0 }}`, easeOut, 0.55s, staggered by `i * 0.015s`.

**Smoke clouds (5):**
`bg-slate-400/35` blobs with Tailwind `blur-md`/`blur-lg`. Animate from y=10 to y=-58, opacity `[0, 0.5, 0]`, scale `[0.4, 1.8, 2.5]` over 1.5s. Staggered 0.25–0.45s delays.

**Key card states:**
- Normal: `bg-slate-800 border-amber-500`, `boxShadow: 0 0 26px rgba(251,191,36,0.35)`
- Overheat: `bg-slate-900 border-red-500`, `boxShadow: 0 0 32px rgba(239,68,68,0.55)`, shakes `rotate: [-15, 15, -15, 15, 0]` at 0.15s repeat
- New forming: spring entrance from `scale: 0.2, rotate: -25` + 6 orbiting `bg-amber-400` sparkle dots (pulsing opacity/scale, staggered 0.12s apart)

**Vault imagery (background):**
Three concentric rings (`w-36`, `w-48`, `w-60`) at 8–20% amber opacity. A bolt ring (8 bolts) rotates 360° over 90s. Four spoke lines at 0°/45°/90°/135°, 10% opacity. Entirely `pointer-events-none`.

**Key graveyard trail:**
Sliding window of last 5 keys shown at `bottom-5`. `AnimatePresence` handles entrance (`scale: 0, y: 10` → `scale: 1, y: 0`) and exit (`scale: 0, x: -16`). Destroyed keys: `bg-slate-800 border-slate-700` with ✕. Active key: `bg-amber-900/40 border-amber-500`.

---

## Demo 3 — The Ghost Courier (`LaymanGhostDemo`)

**Concept:** Sealed Sender. The server processes the message but cannot identify who sent it.

**Presentation style:** Horizontal journey (same layout as Demo 1) with identity-erasure as the central metaphor.

**Phases:** 7.

```
0  Normal — visible UsersIcon, no token
1  Token issued — amber KeyIcon badge springs onto avatar
2  Ghost out — avatar fades to 28% opacity, blurs 1.5px, icon swaps to GhostIcon, "Anonymous" label
3  Sending — sealed purple box + amber "token" tag travels to server
4  At server — server pulses purple, "sender: null" code popup appears
5  Forwarding — box continues to Friend
6  Delivered — Friend glows green; avatar becomes visible again
```

**Ghosting effect:**
```tsx
animate={{
  opacity: isGhost ? 0.28 : 1,
  backgroundColor: isGhost ? '#faf5ff' : '#ede9fe',
  borderColor: isGhost ? '#e9d5ff' : '#c4b5fd',
  filter: isGhost ? 'blur(1.5px)' : 'blur(0px)',
}}
```
Icon swap via `AnimatePresence mode="wait"` between `<UsersIcon>` and `<GhostIcon>`, keyed `"user"` / `"ghost"`.

**Token tag:** Small `bg-amber-400` pill with text `"token"` positioned `-bottom-2.5 -right-2.5` on the message box. Fades to 40% opacity after delivery (phase > 5).

**`sender: null` popup:**
```tsx
className="font-mono text-[11px] bg-slate-900 text-white px-2.5 py-1.5 rounded-lg"
```
Contains `sender: <span className="text-purple-400 italic">null</span>`. Springs in with `initial={{ opacity:0, y:6, scale:0.9 }}`.

**Message box:** `bg-purple-900 border-purple-700` (purple-themed, distinct from the blue/green boxes in Demo 1).

**Color accent:** Purple throughout (`purple-50`, `purple-100`, `purple-400`, `purple-600`) to match the ghost/anonymity concept established in the page's icon and copy.

---

## Demo 4 — The Token Lifecycle (`NerdGhostDemo`)

**Concept:** Sealed Sender for engineers. A three-node pipeline (Client · Server · Group) with inline code annotations that appear per phase, teaching the protocol by showing the actual request/response payloads.

**Presentation style:** Horizontal journey (same layout as Demo 1 & 3) with a floating code annotation zone above the nodes.

**Phases:** 8.

```
0  Idle              — three nodes at rest
1  GET /tokens       — purple dot travels Client → Server; GET /api/tokens pill appears
2  Token issued      — amber token pill travels Server → Client; "stored: SHA256(token)" annotation
3  Message sealed    — code block shows { sender_id: null, token, payload: AES-GCM }
4  Dispatching       — sealed purple box + token tag + "sender: null" label travels to Server
5  Hash lookup       — Server pulses purple; db.lookup(SHA256(token)) annotation with pulsing "→ searching…"
6  Null result       — ø badge on Server; annotation resolves to → { hash: "a3f9…", sender: null }
7  Delivered         — box continues to Group; Group glows green; token tag fades to 30% opacity
```

**Code annotation zone:** `absolute` positioned at `top: 26%`, above the node row. Single `AnimatePresence mode="wait"` wrapping a `motion.div` keyed on phase (phases 6 and 7 share key `6` so the null result stays stable while delivery completes).

**`sender: null` label:** Appears above the traveling message box during phases 3–6 as a dark monospace pill (`bg-slate-900 text-purple-400`), consistent with the Ghost Courier demo's popup style.

**Pulsing search animation (phase 5):** `motion.span` with `opacity: [0.35, 1, 0.35]` looping at 0.9s — communicates "the server is trying but cannot find the sender."

**Speed coefficient:** `T = 1.2` in DURATIONS.map — adjust to scale all phase durations globally.

---

## Design Principles

### Each demo teaches differently
- **Demo 1** (Sealed Box): Linear journey — reinforces the metaphor of a message physically traveling through intermediaries.
- **Demo 2** (Ratchet): Center-stage spotlight — forces attention on the single key being destroyed; the accumulating graveyard makes "each message, unique key, gone forever" viscerally clear.
- **Demo 3** (Ghost): Journey + identity transformation — the ghosting of the sender avatar is the message.
- **Demo 4** (Token Lifecycle): Journey + code annotations — the actual protocol payloads appear inline, teaching what the server receives and why it cannot link sender identity.

### Color semantics
- **Amber/gold**: Keys, encryption, protection — positive/constructive
- **Red**: Destruction, blocking, failure-to-read — signals danger or finality
- **Green**: Successful delivery, receipt confirmation
- **Purple**: Anonymity, ghost, hidden identity
- **Slate/dark**: Sealed/encrypted content (the dark box = you can't see inside)

### Animation timing philosophy
- Phase durations are generous (700ms–1600ms) to let each moment breathe
- Transitions between phases are fast (150–400ms) to feel responsive
- Looping without any user input — purely observational, not interactive
- To adjust global pace: multiply all values in `DURATIONS` by a constant (e.g. `× 1.3` was applied to `LaymanGhostDemo`)

### Accessibility considerations
- All demos are `select-none` and `pointer-events-none` on background elements
- Labels provide text equivalents for all visual state changes
- No animation depends solely on color — shape, text, and position also change
