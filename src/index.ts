// Cloudflare Worker - A2A Protocol Implementation

import { AgentExecutor } from './agent';
import type {
    AgentCard,
    JsonRpcRequest,
    JsonRpcResponse,
    MessageSendParams,
    TaskGetParams,
    TaskListParams,
    TaskCancelParams,
    Task,
    Event,
} from './types';

// In-memory task store (simple implementation)
const tasks = new Map<string, Task>();

// Agent Card Configuration
function getAgentCard(baseUrl: string): AgentCard {
    return {
        name: 'Hello World Agent',
        description: 'Just a hello world agent',
        url: baseUrl,
        version: '1.0.0',
        protocolVersion: '0.3.0',
        defaultInputModes: ['text'],
        defaultOutputModes: ['text'],
        capabilities: {
            streaming: true,
        },
        skills: [
            {
                id: 'hello_world',
                name: 'Returns hello world',
                description: 'just returns hello world',
                tags: ['hello world'],
                examples: ['hi', 'hello world'],
            },
        ],
        supportsAuthenticatedExtendedCard: false,
    };
}

// Helper: Generate UUID v4 (simple implementation for Workers)
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// Helper: Create JSON-RPC response
function createJsonRpcResponse(id: string | number, result: any): JsonRpcResponse {
    return {
        jsonrpc: '2.0',
        id,
        result,
    };
}

// Helper: Create JSON-RPC error response
function createJsonRpcError(id: string | number, code: number, message: string): JsonRpcResponse {
    return {
        jsonrpc: '2.0',
        id,
        error: {
            code,
            message,
        },
    };
}

// Helper: Parse JSON-RPC request
async function parseJsonRpcRequest(request: Request): Promise<JsonRpcRequest> {
    try {
        const body = await request.json() as any;
        if (!body.jsonrpc || body.jsonrpc !== '2.0') {
            throw new Error('Invalid JSON-RPC version');
        }
        return body as JsonRpcRequest;
    } catch (error) {
        throw new Error('Invalid JSON-RPC request');
    }
}

// SSE Helper: Format SSE event
function formatSSE(event: Event): string {
    return `data: ${JSON.stringify(event)}\n\n`;
}

// Handle message/send - Non-streaming task execution
async function handleMessageSend(params: MessageSendParams): Promise<Task> {
    const executor = new AgentExecutor();
    const taskId = params.taskId || generateUUID();
    const contextId = params.message.contextId || generateUUID();

    const task = await executor.executeSend(taskId, contextId, params.message);
    tasks.set(taskId, task);

    return task;
}

// Handle message/stream - Streaming task execution
async function handleMessageStream(
    params: MessageSendParams,
    writer: WritableStreamDefaultWriter<Uint8Array>,
    encoder: TextEncoder
): Promise<void> {
    const executor = new AgentExecutor();
    const taskId = params.taskId || generateUUID();
    const contextId = params.message.contextId || generateUUID();

    let finalTask: Task | null = null;

    for await (const event of executor.execute(taskId, contextId, params.message)) {
        // Send event as SSE
        await writer.write(encoder.encode(formatSSE(event)));

        // Track final task
        if (event.kind === 'task') {
            finalTask = event;
        } else if (event.kind === 'status-update' && event.final) {
            if (finalTask) {
                finalTask.status = event.status;
            }
        }
    }

    // Store final task
    if (finalTask) {
        tasks.set(taskId, finalTask);
    }
}

// Handle tasks/get
async function handleTasksGet(params: TaskGetParams): Promise<Task | null> {
    return tasks.get(params.taskId) || null;
}

// Handle tasks/list
async function handleTasksList(params: TaskListParams): Promise<{ tasks: Task[] }> {
    const allTasks = Array.from(tasks.values());
    const offset = params.offset || 0;
    const limit = params.limit || 10;

    return {
        tasks: allTasks.slice(offset, offset + limit),
    };
}

// Handle tasks/cancel
async function handleTasksCancel(params: TaskCancelParams): Promise<Task | null> {
    const task = tasks.get(params.taskId);
    if (!task) {
        return null;
    }

    task.status = {
        state: 'canceled',
        timestamp: new Date().toISOString(),
    };
    tasks.set(params.taskId, task);

    return task;
}

// Main Cloudflare Worker fetch handler
export default {
    async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        const baseUrl = `${url.protocol}//${url.host}`;

        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // Route: Agent Card (/.well-known/agent-card.json)
        if (url.pathname === '/.well-known/agent-card.json' && request.method === 'GET') {
            return new Response(JSON.stringify(getAgentCard(baseUrl), null, 2), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                },
            });
        }

        // Route: JSON-RPC endpoint (/a2a/jsonrpc or /a2a/message/send, /a2a/message/stream, etc.)
        if (request.method === 'POST') {
            try {
                const rpcRequest = await parseJsonRpcRequest(request);

                // Handle message/send
                if (rpcRequest.method === 'message/send') {
                    const task = await handleMessageSend(rpcRequest.params);
                    return new Response(JSON.stringify(createJsonRpcResponse(rpcRequest.id, task)), {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                    });
                }

                // Handle message/stream
                if (rpcRequest.method === 'message/stream') {
                    const { readable, writable } = new TransformStream();
                    const writer = writable.getWriter();
                    const encoder = new TextEncoder();

                    // Start streaming in background
                    ctx.waitUntil(
                        (async () => {
                            try {
                                await handleMessageStream(rpcRequest.params, writer, encoder);
                            } catch (error) {
                                console.error('Streaming error:', error);
                            } finally {
                                await writer.close();
                            }
                        })()
                    );

                    return new Response(readable, {
                        headers: {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive',
                            ...corsHeaders,
                        },
                    });
                }

                // Handle tasks/get
                if (rpcRequest.method === 'tasks/get') {
                    const task = await handleTasksGet(rpcRequest.params);
                    if (!task) {
                        return new Response(
                            JSON.stringify(createJsonRpcError(rpcRequest.id, -32001, 'Task not found')),
                            {
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...corsHeaders,
                                },
                                status: 404,
                            }
                        );
                    }
                    return new Response(JSON.stringify(createJsonRpcResponse(rpcRequest.id, task)), {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                    });
                }

                // Handle tasks/list
                if (rpcRequest.method === 'tasks/list') {
                    const result = await handleTasksList(rpcRequest.params || {});
                    return new Response(JSON.stringify(createJsonRpcResponse(rpcRequest.id, result)), {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                    });
                }

                // Handle tasks/cancel
                if (rpcRequest.method === 'tasks/cancel') {
                    const task = await handleTasksCancel(rpcRequest.params);
                    if (!task) {
                        return new Response(
                            JSON.stringify(createJsonRpcError(rpcRequest.id, -32001, 'Task not found')),
                            {
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...corsHeaders,
                                },
                                status: 404,
                            }
                        );
                    }
                    return new Response(JSON.stringify(createJsonRpcResponse(rpcRequest.id, task)), {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                    });
                }

                // Unknown method
                return new Response(
                    JSON.stringify(createJsonRpcError(rpcRequest.id, -32601, 'Method not found')),
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                        status: 404,
                    }
                );
            } catch (error) {
                return new Response(
                    JSON.stringify(
                        createJsonRpcError(0, -32700, `Parse error: ${(error as Error).message}`)
                    ),
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                        status: 400,
                    }
                );
            }
        }

        // 404 for all other routes
        return new Response('Not Found', {
            status: 404,
            headers: corsHeaders,
        });
    },
};
