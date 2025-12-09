export interface Template {
    id: string;
    name: string;
    systemPrompt?: string;
    prompt: string;
    model: string;
    temperature: number;
    topP: number;
}

