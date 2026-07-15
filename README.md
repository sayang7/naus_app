# naus — ask, and see the reasoning

Every answer is broken down into discrete claims: grounded, ambiguous, assumption, or unverifiable. Claims are checked against prior answers in the session and flagged as contradictions if they conflict. The breakdown is not optional — it renders under every answer, always.

## Setup

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure the API key

```bash
cp server/.env.example server/.env
```

Open `server/.env` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

The key lives only on the server and is never sent to or accessible from the frontend.

### 3. Run in development

```bash
npm run dev
```

- Server: `http://localhost:3001`
- Client: `http://localhost:5173`

### 4. Build for production

```bash
npm run build
```

Output: `server/dist/` and `client/dist/`.

## Architecture

```
naus/
├── server/
│   ├── src/
│   │   ├── index.ts      # Express app and routes
│   │   └── anthropic.ts  # Anthropic API call wrappers
│   └── .env.example
└── client/
    └── src/
        ├── App.tsx
        ├── api.ts
        ├── types.ts
        └── components/
            ├── AskInput.tsx
            ├── Conversation.tsx
            ├── Ledger.tsx
            ├── ClaimUnderline.tsx
            ├── OuroborosMark.tsx
            └── ThinkingIndicator.tsx
```

**Session state** is held in memory on the server, keyed by session ID. It resets on server restart — expected for a demo.

**Claim breakdown** uses Anthropic's tool-use API to force structured output. The model returns each claim with `startIndex`/`endIndex` character positions into the answer text, enabling precise inline underline rendering.

**Contradiction detection** runs in the same structured call as claim extraction. Prior commitments are passed in the prompt; the model flags direct conflicts and the server records the contradiction with the prior commitment's ID.

## Notes

- Session state is in-memory only and does not persist across server restarts.
- Claims are extracted and checked using structured analysis of the model's own output.
- The ledger is capped at displaying 15 entries; scroll for older ones.
