// Agent Implementation - Hello World Agent

import type { Message, Task, Event } from './types';

export class HelloWorldAgent {
    /**
     * Simple agent that returns "Hello World"
     */
    async invoke(): Promise<string> {
        return 'Hello World';
    }
}

export class AgentExecutor {
    private agent: HelloWorldAgent;

    constructor() {
        this.agent = new HelloWorldAgent();
    }

    /**
     * Execute the agent and generate events
     */
    async* execute(taskId: string, contextId: string, userMessage: Message): AsyncGenerator<Event> {
        // Create initial task
        const task: Task = {
            kind: 'task',
            id: taskId,
            contextId,
            status: {
                state: 'submitted',
                timestamp: new Date().toISOString(),
            },
            history: [userMessage],
        };
        yield task;

        // Update status to working
        yield {
            kind: 'status-update',
            taskId,
            contextId,
            status: {
                state: 'working',
                timestamp: new Date().toISOString(),
            },
            final: false,
        };

        // Execute agent logic
        const result = await this.agent.invoke();

        // Create response message
        const responseMessage: Message = {
            kind: 'message',
            messageId: `msg-${Date.now()}`,
            role: 'agent',
            parts: [{ kind: 'text', text: result }],
            contextId,
        };
        yield responseMessage;

        // Update status to completed
        yield {
            kind: 'status-update',
            taskId,
            contextId,
            status: {
                state: 'completed',
                timestamp: new Date().toISOString(),
            },
            final: true,
        };
    }

    /**
     * Execute and return the final task (for non-streaming)
     */
    async executeSend(taskId: string, contextId: string, userMessage: Message): Promise<Task> {
        const events: Event[] = [];

        for await (const event of this.execute(taskId, contextId, userMessage)) {
            events.push(event);
        }

        // Build final task from events
        const task = events.find(e => e.kind === 'task') as Task;
        const messages = events.filter(e => e.kind === 'message') as Message[];
        const lastStatus = [...events].reverse().find(e => e.kind === 'status-update');

        return {
            ...task,
            history: [...(task.history || []), ...messages],
            status: (lastStatus as any)?.status || task.status,
        };
    }
}
