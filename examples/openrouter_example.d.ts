#!/usr/bin/env node
/**
 * OpenRouter Integration Example
 * This demonstrates direct integration with OpenRouter API
 * for testing and development purposes
 */
interface OpenRouterConfig {
    apiKey: string;
    baseURL?: string;
    timeout?: number;
}
interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | Array<{
        type: 'text' | 'image_url';
        text?: string;
        image_url?: {
            url: string;
        };
    }>;
}
interface ChatCompletionRequest {
    model: string;
    messages: ChatMessage[];
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
}
interface ChatCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: ChatMessage;
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
declare class OpenRouterClient {
    private client;
    private config;
    constructor(config: OpenRouterConfig);
    listModels(): Promise<any>;
    getModelInfo(modelId: string): Promise<any>;
    createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    streamChatCompletion(request: ChatCompletionRequest): AsyncGenerator<any, void, unknown>;
    testVisionCapabilities(): Promise<void>;
    testBase64Image(): Promise<void>;
    testErrorHandling(): Promise<void>;
    performanceTest(): Promise<void>;
    interactiveChat(): Promise<void>;
}
export { OpenRouterClient };
//# sourceMappingURL=openrouter_example.d.ts.map