// A2A Protocol Type Definitions

export interface AgentSkill {
    id: string;
    name: string;
    description: string;
    tags?: string[];
    examples?: string[];
}

export interface AgentCapabilities {
    streaming?: boolean;
    pushNotifications?: boolean;
}

export interface AgentCard {
    name: string;
    description: string;
    url: string;
    version: string;
    protocolVersion?: string;
    defaultInputModes: string[];
    defaultOutputModes: string[];
    capabilities?: AgentCapabilities;
    skills: AgentSkill[];
    supportsAuthenticatedExtendedCard?: boolean;
}

export interface MessagePart {
    kind: 'text' | 'data' | 'file';
    text?: string;
    data?: any;
    mimeType?: string;
    url?: string;
}

export interface Message {
    kind: 'message';
    messageId: string;
    role: 'user' | 'agent';
    parts: MessagePart[];
    contextId?: string;
}

export interface TaskStatus {
    state: 'submitted' | 'working' | 'input-required' | 'completed' | 'canceled' | 'failed';
    timestamp: string;
    reason?: string;
}

export interface Task {
    kind: 'task';
    id: string;
    contextId?: string;
    status: TaskStatus;
    history?: Message[];
    artifacts?: Artifact[];
}

export interface Artifact {
    artifactId: string;
    parts: MessagePart[];
}

export interface StatusUpdate {
    kind: 'status-update';
    taskId: string;
    contextId?: string;
    status: TaskStatus;
    final: boolean;
}

export interface ArtifactUpdate {
    kind: 'artifact-update';
    taskId: string;
    contextId?: string;
    artifact: Artifact;
}

export type Event = Task | StatusUpdate | ArtifactUpdate | Message;

// JSON-RPC Types
export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: any;
}

export interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: string | number;
    result?: any;
    error?: JsonRpcError;
}

export interface JsonRpcError {
    code: number;
    message: string;
    data?: any;
}

// Request Parameters
export interface MessageSendParams {
    message: Message;
    taskId?: string;
}

export interface TaskGetParams {
    taskId: string;
}

export interface TaskListParams {
    limit?: number;
    offset?: number;
}

export interface TaskCancelParams {
    taskId: string;
}
