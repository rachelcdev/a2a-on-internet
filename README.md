# A2A Agent on Cloudflare Workers

A simple Agent-to-Agent (A2A) protocol-compliant agent deployed on Cloudflare Workers. This agent responds with "Hello World" and demonstrates the core concepts of the A2A protocol.

## What is A2A?

The Agent2Agent (A2A) Protocol is an open standard for AI agent communication and interoperability. It allows different agents to discover each other's capabilities, exchange messages, and collaborate on tasks.

## Features

- ✅ **Agent Card Discovery** - Expose agent capabilities via `/.well-known/agent-card.json`
- ✅ **Message Send** - Synchronous message handling with task creation
- ✅ **Message Stream** - Real-time streaming updates via Server-Sent Events (SSE)
- ✅ **Task Management** - Get, list, and cancel tasks
- ✅ **JSON-RPC 2.0** - Standard protocol for method calls
- ✅ **Publicly Accessible** - Deployed on Cloudflare Workers for global reach

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Cloudflare account (free tier works)
- `wrangler` CLI (installed via npm)

## Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Locally

```bash
npm run dev
```

This starts the worker at `http://localhost:8787`

### 3. Test the Agent Card

```bash
curl http://localhost:8787/.well-known/agent-card.json
```

Expected response:
```json
{
  "name": "Hello World Agent",
  "description": "Just a hello world agent",
  "url": "http://localhost:8787",
  "version": "1.0.0",
  "skills": [...]
}
```

### 4. Send a Message

```bash
curl -X POST http://localhost:8787/a2a/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "message/send",
    "params": {
      "message": {
        "messageId": "msg-123",
        "role": "user",
        "parts": [{"kind": "text", "text": "Hello!"}],
        "kind": "message"
      }
    }
  }'
```

Expected response includes a completed task with the agent's "Hello World" response.

### 5. Test Streaming

```bash
curl -N -X POST http://localhost:8787/a2a/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "message/stream",
    "params": {
      "message": {
        "messageId": "msg-456",
        "role": "user",
        "parts": [{"kind": "text", "text": "Stream me!"}],
        "kind": "message"
      }
    }
  }'
```

You'll see Server-Sent Events streaming in real-time.

## Deployment to Cloudflare Workers

### 1. Login to Cloudflare

```bash
npx wrangler login
```

This opens a browser window to authenticate with your Cloudflare account.

### 2. Deploy

```bash
npm run deploy
```

This command will:
- Build the TypeScript code
- Upload to Cloudflare Workers
- Return a public URL like `https://a2a-agent.your-subdomain.workers.dev`

### 3. Test Public Deployment

Replace `YOUR-WORKER-URL` with your actual worker URL:

**Test Agent Card:**
```bash
curl https://YOUR-WORKER-URL.workers.dev/.well-known/agent-card.json
```

**Send a Message:**
```bash
curl -X POST https://YOUR-WORKER-URL.workers.dev/a2a/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "message/send",
    "params": {
      "message": {
        "messageId": "msg-prod-1",
        "role": "user",
        "parts": [{"kind": "text", "text": "Hello from the cloud!"}],
        "kind": "message"
      }
    }
  }'
```

## A2A Protocol Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/agent-card.json` | GET | Agent discovery and capabilities |
| `/a2a/jsonrpc` | POST | JSON-RPC 2.0 endpoint for all methods |

### Supported JSON-RPC Methods

| Method | Description |
|--------|-------------|
| `message/send` | Send a message and get complete task response |
| `message/stream` | Send a message and stream updates via SSE |
| `tasks/get` | Get a specific task by ID |
| `tasks/list` | List all tasks (paginated) |
| `tasks/cancel` | Cancel a running task |

## Project Structure

```
├── src/
│   ├── index.ts       # Main Cloudflare Worker with routing
│   ├── agent.ts       # Hello World agent logic
│   └── types.ts       # A2A protocol TypeScript types
├── package.json       # Dependencies and scripts
├── tsconfig.json      # TypeScript configuration
├── wrangler.toml      # Cloudflare Workers configuration
└── README.md          # This file
```

## Customizing the Agent

To modify the agent's behavior, edit `src/agent.ts`:

```typescript
export class HelloWorldAgent {
  async invoke(): Promise<string> {
    // Change this to customize the response
    return 'Hello World';
  }
}
```

To add more skills, update the agent card in `src/index.ts`:

```typescript
skills: [
  {
    id: 'your_skill_id',
    name: 'Your Skill Name',
    description: 'What your skill does',
    tags: ['tag1', 'tag2'],
  },
],
```

## Resources

- [A2A Protocol Specification](https://a2a-protocol.org/latest/specification/)
- [A2A JavaScript SDK](https://github.com/a2aproject/a2a-js)
- [A2A Samples Repository](https://github.com/a2aproject/a2a-samples)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

## License

MIT

## Disclaimer

Important: This sample code is for demonstration purposes and illustrates the mechanics of the Agent-to-Agent (A2A) protocol. When building production applications, treat any agent operating outside of your direct control as a potentially untrusted entity.

All data received from an external agent should be handled as untrusted input. Implement appropriate security measures, input validation, and secure handling of credentials to protect your systems and users.