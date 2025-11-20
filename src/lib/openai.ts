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

export interface VectorStoreFile {
    fileId: string;
    fileName: string;
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

/**
 * Creates a vector store for file search
 */
export async function createVectorStore(apiKey: string): Promise<string> {
    try {
        const response = await fetch('https://api.openai.com/v1/vector_stores', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: 'deep-research-context'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to create vector store');
        }

        const data = await response.json();
        return data.id;
    } catch (error: any) {
        console.error('Vector Store Creation Error:', error);
        throw error;
    }
}

/**
 * Uploads a file to OpenAI and returns the file ID
 */
export async function uploadFile(apiKey: string, file: File): Promise<string> {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', 'assistants');

        const response = await fetch('https://api.openai.com/v1/files', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to upload file');
        }

        const data = await response.json();
        return data.id;
    } catch (error: any) {
        console.error('File Upload Error:', error);
        throw error;
    }
}

/**
 * Waits for vector store files to be processed
 */
async function waitForVectorStoreReady(
    apiKey: string,
    vectorStoreId: string,
    expectedFileCount: number,
    maxWaitTime: number = 30000
): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 3000; // Check every 3 seconds
    
    console.log(`Waiting for vector store ${vectorStoreId} to process ${expectedFileCount} file(s)...`);
    
    while (Date.now() - startTime < maxWaitTime) {
        try {
            const response = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const inProgress = data.file_counts?.in_progress || 0;
                const completed = data.file_counts?.completed || 0;
                
                console.log(`Vector store status: ${completed} completed, ${inProgress} in progress`);
                
                // If no files are in progress and we have completed files, they're ready
                if (inProgress === 0 && completed > 0) {
                    console.log('✓ Vector store files are ready');
                    // Give it a bit more time to ensure indexing is complete
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    return;
                }
            } else {
                console.warn('Vector store status check failed, will wait and proceed');
            }
        } catch (error) {
            console.warn('Error checking vector store status:', error);
            // Continue polling
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    // If we timeout, still proceed - files might be ready
    console.warn('Vector store readiness check timed out, proceeding anyway (files may still be processing)');
}

/**
 * Adds files to a vector store (one at a time)
 */
export async function addFilesToVectorStore(
    apiKey: string,
    vectorStoreId: string,
    fileIds: string[]
): Promise<void> {
    try {
        // Add files one at a time (API requires file_id singular)
        for (const fileId of fileIds) {
            const response = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    file_id: fileId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Failed to add file ${fileId} to vector store`);
            }
        }

        // Wait for files to be processed (vector stores need time to index files)
        // Poll vector store status to ensure files are ready
        await waitForVectorStoreReady(apiKey, vectorStoreId, fileIds.length);
    } catch (error: any) {
        console.error('Add Files to Vector Store Error:', error);
        throw error;
    }
}

/**
 * Processes files and creates a vector store for deep research
 */
export async function processFilesForResearch(
    apiKey: string,
    files: File[]
): Promise<string | null> {
    if (files.length === 0) {
        return null;
    }

    try {
        // Create vector store
        const vectorStoreId = await createVectorStore(apiKey);

        // Upload all files
        const uploadPromises = files.map(file => uploadFile(apiKey, file));
        const fileIds = await Promise.all(uploadPromises);

        // Add files to vector store
        await addFilesToVectorStore(apiKey, vectorStoreId, fileIds);

        return vectorStoreId;
    } catch (error: any) {
        console.error('Process Files Error:', error);
        throw error;
    }
}

/**
 * Polls for the result of a background deep research request
 */
async function pollForResult(apiKey: string, responseId: string, maxWaitTime: number = 600000): Promise<any> {
    const startTime = Date.now();
    const pollInterval = 3000; // Check every 3 seconds
    
    while (Date.now() - startTime < maxWaitTime) {
        try {
            const response = await fetch(`https://api.openai.com/v1/responses/${responseId}`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to poll response: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`Polling attempt - Status: ${data.status}, Has output: ${!!data.output}, Has output_text: ${!!data.output_text}`);
            
            // Check if the response is complete - check for output first
            if (data.output && Array.isArray(data.output) && data.output.length > 0) {
                console.log('Found output array with', data.output.length, 'items');
                return data;
            }
            
            if (data.output_text) {
                console.log('Found output_text');
                return data;
            }
            
            // Check status
            if (data.status === 'completed') {
                console.log('Status is completed');
                // Even if status is completed, check if we have output
                if (!data.output && !data.output_text) {
                    // Wait a bit more in case output is still being generated
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }
                return data;
            }
            
            // If it's still processing, wait and try again
            if (data.status === 'processing' || data.status === 'pending' || !data.status) {
                console.log('Still processing, waiting...');
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                continue;
            }
            
            // If there's an error status
            if (data.status === 'failed' || data.error) {
                throw new Error(data.error?.message || 'Deep research failed');
            }
            
            // Default: wait and try again
            console.log('Unknown status, waiting and retrying...');
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
            
        } catch (error: any) {
            // If it's a 404, the response might not be ready yet
            if (error.message?.includes('404') || error.message?.includes('Failed to poll')) {
                console.log('404 or fetch error, response not ready yet, waiting...');
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                continue;
            }
            console.error('Polling error:', error);
            throw error;
        }
    }
    
    throw new Error('Deep research timed out after 10 minutes');
}

export async function runDeepResearch(params: { 
    apiKey: string, 
    prompt: string,
    vectorStoreIds?: string[]
}) {
    try {
        const tools: any[] = [
            { type: "web_search_preview" }
        ];

        // Add file_search tool if vector stores are provided
        let finalPrompt = params.prompt;
        if (params.vectorStoreIds && params.vectorStoreIds.length > 0) {
            console.log('Adding file_search tool with vector stores:', params.vectorStoreIds);
            tools.push({
                type: "file_search",
                vector_store_ids: params.vectorStoreIds
            });
            
            // Explicitly mention files in the prompt to guide the model
            finalPrompt = params.prompt + `\n\nIMPORTANT: You have access to uploaded files via the file_search tool. You MUST search through these files using the file_search tool and incorporate information from them in your research. Do not rely solely on web search - the uploaded files contain important context that should be included in your analysis.`;
        } else {
            console.log('No vector stores provided, skipping file_search tool');
        }
        
        console.log('Deep research tools:', tools);
        console.log('Final prompt length:', finalPrompt.length);

        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${params.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'o3-deep-research',
                input: finalPrompt,
                background: true,
                tools
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to run deep research');
        }

        const data = await response.json();
        console.log('Initial deep research response:', data);

        // If background mode, poll for the result
        if (data.id) {
            console.log('Polling for result with ID:', data.id);
            return await pollForResult(params.apiKey, data.id);
        }

        // If we already have output, return it
        if (data.output || data.output_text) {
            console.log('Response already contains output');
            return data;
        }

        // If no ID and no output, this might be an error or unexpected response
        console.warn('Unexpected response structure:', data);
        return data;

    } catch (error: any) {
        console.error('Deep Research API Error:', error);
        throw error;
    }
}
