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
async function pollForResult(apiKey: string, responseId: string): Promise<any> {
    const pollInterval = 3000; // Check every 3 seconds
    
    while (true) {
        try {
            const response = await fetch(`https://api.openai.com/v1/responses/${responseId}`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                }
            });
            
            if (!response.ok) {
                // Handle rate limit errors during polling
                if (response.status === 429) {
                    const errorData = await response.json().catch(() => ({}));
                    const retryAfter = errorData.error?.retry_after || 5; // Default to 5 seconds
                    const waitSeconds = typeof retryAfter === 'string' ? parseFloat(retryAfter) : retryAfter;
                    console.log(`Rate limit during polling. Waiting ${waitSeconds} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
                    continue; // Retry the poll
                }
                throw new Error(`Failed to poll response: ${response.statusText}`);
            }
            
            const data = await response.json();
            const status = data.status;
            console.log(`Polling attempt - Status: ${status}, Has output: ${!!data.output}, Has output_text: ${!!data.output_text}`, data);

            // Surface failures immediately before returning any output
            if (status === 'failed' || data.error) {
                const message = data.error?.message || 'Deep research failed';
                throw new Error(message);
            }
            
            // Check if deep research is asking questions (needs user input)
            // Check this FIRST before checking for completion
            if (status === 'needs_input' || data.needs_input || data.status === 'needs_input') {
                console.log('Deep research needs input/questions (status check)');
                return { ...data, isQuestion: true };
            }
            
            // Helper function to check if text contains questions
            const containsQuestions = (text: string): boolean => {
                if (!text) return false;
                const trimmed = text.trim();
                // If response is very short (< 500 chars), it's likely a question, not a full research report
                if (trimmed.length < 500) {
                    // Look for question patterns: ends with ?, contains question words
                    const questionPatterns = /[?]|(what|how|when|where|why|which|who|can you|could you|would you|please)\s+/i;
                    if (questionPatterns.test(trimmed)) {
                        return true;
                    }
                }
                // For longer text, check if it ends with a question mark or contains multiple questions
                const questionCount = (trimmed.match(/\?/g) || []).length;
                if (questionCount > 0 && trimmed.length < 2000) {
                    return true; // Likely questions if it has ? and is relatively short
                }
                return false;
            };
            
            // Check for questions in output BEFORE checking completion status
            let questionText = '';
            
            if (data.output && Array.isArray(data.output)) {
                console.log('Found output array with', data.output.length, 'items');
                // Extract text from output to check for questions
                for (const item of data.output) {
                    if (item.type === 'message' && item.content) {
                        if (Array.isArray(item.content)) {
                            const text = item.content
                                .map((part: any) => part.text || part.output_text || '')
                                .join('');
                            if (containsQuestions(text)) {
                                questionText = text;
                                break;
                            }
                        } else if (typeof item.content === 'string' && containsQuestions(item.content)) {
                            questionText = item.content;
                            break;
                        }
                    } else if (item.text && containsQuestions(item.text)) {
                        questionText = item.text;
                        break;
                    }
                }
                
                // If we found questions, return as question (even if status says completed, 
                // it might be a quick completion with questions)
                if (questionText) {
                    // Double-check: if it's very short and contains questions, it's likely a question
                    // If it's long (> 2000 chars), it's probably a research report
                    if (questionText.length < 2000) {
                        console.log('Found questions in output array, returning for user input');
                        return { ...data, isQuestion: true, questionText };
                    }
                }
                
                // If status is completed and no questions found, return the final result
                if (status === 'completed') {
                    return data;
                }
            }
            
            if (data.output_text) {
                console.log('Found output_text:', data.output_text.substring(0, 200));
                // Check if output_text contains questions
                if (containsQuestions(data.output_text)) {
                    // If it's short and has questions, treat as question even if status is completed
                    if (data.output_text.length < 2000) {
                        console.log('Output text contains questions (short response), returning for user input');
                        return { ...data, isQuestion: true, questionText: data.output_text };
                    }
                }
                // If completed and long (research report), return final result
                if (status === 'completed' && data.output_text.length >= 2000) {
                    return data;
                }
            }
            
            // Check status
            if (status === 'completed') {
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
            if (status === 'processing' || status === 'pending' || status === 'queued' || status === 'in_progress' || !status) {
                console.log('Still processing, waiting...');
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                continue;
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
                model: 'o4-mini-deep-research',
                input: finalPrompt,
                background: true,
                tools
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error?.message || 'Failed to run deep research';
            
            // Handle rate limit errors with retry
            if (response.status === 429) {
                const retryAfter = errorData.error?.retry_after || errorMessage.match(/try again in ([\d.]+)s/)?.[1];
                if (retryAfter) {
                    const waitSeconds = parseFloat(retryAfter);
                    console.log(`Rate limit reached. Waiting ${waitSeconds} seconds before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
                    // Retry once after waiting
                    return runDeepResearch(params);
                }
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('Initial deep research response:', data);

        // Check if initial response contains questions (before polling)
        const containsQuestions = (text: string): boolean => {
            if (!text) return false;
            const trimmed = text.trim();
            if (trimmed.length < 500) {
                const questionPatterns = /[?]|(what|how|when|where|why|which|who|can you|could you|would you|please)\s+/i;
                if (questionPatterns.test(trimmed)) {
                    return true;
                }
            }
            const questionCount = (trimmed.match(/\?/g) || []).length;
            if (questionCount > 0 && trimmed.length < 2000) {
                return true;
            }
            return false;
        };

        // Check for questions in initial response
        if (data.output_text && containsQuestions(data.output_text) && data.output_text.length < 2000) {
            console.log('Initial response contains questions');
            return { ...data, isQuestion: true, questionText: data.output_text };
        }

        if (data.output && Array.isArray(data.output)) {
            for (const item of data.output) {
                let text = '';
                if (item.type === 'message' && item.content) {
                    if (Array.isArray(item.content)) {
                        text = item.content.map((part: any) => part.text || part.output_text || '').join('');
                    } else if (typeof item.content === 'string') {
                        text = item.content;
                    }
                } else if (item.text) {
                    text = item.text;
                }
                if (text && containsQuestions(text) && text.length < 2000) {
                    console.log('Initial response contains questions in output');
                    return { ...data, isQuestion: true, questionText: text };
                }
            }
        }

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
