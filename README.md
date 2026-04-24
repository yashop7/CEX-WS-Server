# Exchange WS Railway

A lightweight WebSocket gateway that relays real-time market data from a Redis pub/sub backend to connected trading clients. It sits between the exchange engine and the frontend, broadcasting ticker updates, order book depth changes, and trade events to any number of simultaneous subscribers.

## Architecture

```
Frontend Clients (WebSocket)
        │
        ▼
  Exchange WS Railway          ← this service
  ┌─────────────────────┐
  │  UserManager        │  tracks all active connections
  │  SubscriptionManager│  maps channels → users, owns Redis sub
  └─────────────────────┘
        │
        ▼ Redis Pub/Sub
  Exchange Engine
```

**Flow:**
1. Client connects via WebSocket and sends a `SUBSCRIBE` message with channel names.
2. `SubscriptionManager` subscribes to those Redis channels (only on first subscriber — no duplicate subscriptions).
3. When the engine publishes a market event, Redis delivers it here and it is forwarded to every subscribed client.
4. On disconnect or `UNSUBSCRIBE`, Redis channels are cleaned up when no subscribers remain.

## Project Structure

```
src/
├── index.ts               # HTTP + WebSocket server bootstrap, cron keepalive
├── config.ts              # Loads env vars via dotenv
├── User.ts                # Represents one WebSocket connection; parses client messages
├── UserManager.ts         # Singleton — Map of all live User instances
├── SubscriptionManager.ts # Singleton — Redis pub/sub logic and channel routing
└── types/
    ├── in.ts              # Incoming message types (SUBSCRIBE / UNSUBSCRIBE)
    └── out.ts             # Outgoing message types (ticker, depth, trade)
```

## Message Protocol

### Client → Server

```json
{ "method": "SUBSCRIBE",   "params": ["ticker@BTCUSDT", "depth@BTCUSDT"] }
{ "method": "UNSUBSCRIBE", "params": ["ticker@BTCUSDT"] }
```

### Server → Client

```json
{ "type": "ticker", "data": { "s": "BTCUSDT", "c": "67000", "h": "68000", "l": "66000", "v": "1200", "id": 1, "e": "ticker" } }
{ "type": "depth",  "data": { ... } }
{ "type": "trade",  "data": { ... } }
```

## Environment Variables

Copy `.env.example` and fill in values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `REDIS_ENGINE_DOWNSTREAM_URL` | Redis connection URL for receiving engine pub/sub events |
| `PORT` | HTTP/WebSocket server port (default: `3001`) |

## Getting Started

**Prerequisites:** [Bun](https://bun.sh) ≥ 1.0, a running Redis instance (or Upstash URL).

```bash
# Install dependencies
bun install

# Development
bun run dev

# Production build + start
bun run start
```

The server exposes:
- `ws://HOST:PORT` — WebSocket endpoint for clients
- `GET /health` — health check (returns `200 OK`)

A cron job runs every 12 minutes to log server status and keep the process alive on platforms like Railway.

## Part of a Larger System

This service is one component of a multi-repo exchange platform:

| Repo | Role |
|---|---|
| **Exchange Engine** | Order matching, trade execution, publishes events to Redis |
| **Exchange WS Railway** ← you are here | WebSocket gateway — relays engine events to clients |
| **Frontend** | Trading UI that connects to this gateway |

## Todo

- [ ] User-specific trade subscriptions — when a user's order is filled, push the fill event directly to that user's connection.
