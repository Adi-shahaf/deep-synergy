import OpenAI from 'openai';

export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ResearchParams {
    apiKey: string;
    messages: Message[];
    model?: string;
}

export async function sendChat(params: ResearchParams) {
    const openai = new OpenAI({
        apiKey: params.apiKey,
        dangerouslyAllowBrowser: true
    });

    try {
        const completion = await openai.chat.completions.create({
            model: params.model || 'gpt-4o',
            messages: params.messages,
            temperature: 0.7,
        });

        return completion.choices[0]?.message?.content || '';
    } catch (error: any) {
        console.error('OpenAI API Error:', error);
        throw new Error(error.message || 'Failed to communicate with OpenAI');
    }
}

export async function runDeepResearch(params: { apiKey: string, prompt: string }) {
    try {
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${params.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'o3-deep-research',
                input: params.prompt,
                tools: [
                    { type: "web_search_preview" }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to run deep research');
        }

        const data = await response.json();

        // The final answer is in the 'message' tool call or similar structure
        // Based on docs: "message": The model's final answer with inline citations.
        // Output structure example: { type: "message", content: [...] }
        // We need to find the item with type 'message' in the output array (if it exists there) 
        // OR the docs say "response.output_text" in the python example.
        // Let's check the Python example: print(response.output_text)
        // So the JSON response likely has an 'output_text' field or similar at the top level 
        // OR we parse the 'output' list.
        // The docs say: "The output from a deep research model is the same as any other via the Responses API... It will contain a listing of web search calls... Responses may include output items like... message"

        // Let's assume the standard Responses API format.
        // If 'output_text' is available (helper in SDK), we might need to extract it from the raw JSON.
        // Raw JSON likely has an 'output' array.

        // We will return the full data for now and let the component parse it, 
        // or try to extract the text here.

        return data;

    } catch (error: any) {
        console.error('Deep Research API Error:', error);
        throw error;
    }
}
