import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Input } from '../ui/Input';
import { Upload, Play, Copy, Check, Settings, Send, Loader2 } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { sendChat, runDeepResearch, processFilesForResearch, type Message } from '../../lib/openai';
import { extractTextFromPDF } from '../../lib/file-processing';
import { cn } from '../../lib/utils';

const SYSTEM_PROMPT = `You are a Deep Research AI assistant.
Your goal is to provide comprehensive, detailed, and accurate answers based on the user's prompt and provided context.

PROTOCOL:
1. Analyze the user's request and any provided context.
2. If the request is vague, ambiguous, or lacks sufficient detail to perform DEEP research, ask clarifying questions.
3. If the request is clear and you have enough information, you MUST output the token "[READY]" (without quotes) followed immediately by a brief confirmation that you are starting the research.
4. Once you output [READY], the system will switch to "Research Mode".
5. In "Research Mode", you will generate a comprehensive, long-form report in Markdown format.

Do not output [READY] unless you are absolutely sure you have what you need.
`;

interface ResearchFormProps {
    initialPrompt?: string;
    initialContext?: string;
    initialVectorStoreId?: string | null;
    autoSend?: boolean;
}

export const ResearchForm: React.FC<ResearchFormProps> = ({ 
    initialPrompt = '', 
    initialContext = '',
    initialVectorStoreId = null,
    autoSend = false
}) => {
    const { apiKey, setApiKey } = useAppStore();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [researchResult, setResearchResult] = useState('');
    const [contextFiles, setContextFiles] = useState<File[]>([]);
    const [contextText, setContextText] = useState(initialContext);
    const [vectorStoreIds, setVectorStoreIds] = useState<string[]>(initialVectorStoreId ? [initialVectorStoreId] : []);
    const [isProcessingFiles, setIsProcessingFiles] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [copied, setCopied] = useState(false);
    const [mode, setMode] = useState<'chat' | 'research'>('chat');
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Define startDeepResearch first so it can be used in sendMessage
    const startDeepResearch = useCallback(async (history: Message[]) => {
        setIsProcessing(true);
        try {
            // Consolidate history into a single prompt
            const researchPrompt = history
                .filter(m => m.role !== 'system')
                .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
                .join('\n\n');

            console.log('Starting deep research with vector stores:', vectorStoreIds);
            console.log('Research prompt:', researchPrompt.substring(0, 200) + '...');

            const data = await runDeepResearch({
                apiKey,
                prompt: researchPrompt,
                vectorStoreIds: vectorStoreIds.length > 0 ? vectorStoreIds : undefined
            });

            console.log('Deep research completed, parsing response:', data);

            // Surface backend failure status explicitly
            if (data.status === 'failed') {
                const message = data.error?.message || 'Deep research failed';
                throw new Error(message);
            }

            // Parse the response to find the final message
            let finalText = '';
            if (data.output && Array.isArray(data.output)) {
                const messageItem = data.output.find((item: any) => item.type === 'message');
                if (messageItem && messageItem.content) {
                    if (Array.isArray(messageItem.content)) {
                        finalText = messageItem.content
                            .map((part: any) => part.text || part.output_text || '')
                            .join('');
                    } else if (typeof messageItem.content === 'string') {
                        finalText = messageItem.content;
                    }
                }
                
                // If no message item found, try to get text from any output item
                if (!finalText) {
                    for (const item of data.output) {
                            if (item.text) {
                            finalText += item.text + '\n\n';
                            } else if (item.output_text) {
                                finalText += item.output_text + '\n\n';
                        } else if (item.content && typeof item.content === 'string') {
                            finalText += item.content + '\n\n';
                        }
                    }
                }
            } else if (data.output_text) {
                finalText = data.output_text;
            } else if (data.text) {
                finalText = data.text;
            } else {
                console.warn('Unexpected response structure, showing raw data:', data);
                finalText = JSON.stringify(data, null, 2);
            }

            if (!finalText || finalText.trim() === '') {
                throw new Error('Research completed but no output was generated. Please try again.');
            }

            setResearchResult(finalText);
        } catch (err: any) {
            console.error('Deep research error:', err);
            setError(err.message || 'Failed to generate research report. Please try again.');
            setResearchResult(''); // Clear any partial results
        } finally {
            setIsProcessing(false);
        }
    }, [apiKey, vectorStoreIds]);

    // Extract send logic to a reusable function
    const sendMessage = useCallback(async (messageContent: string, isFirstMessage: boolean = false) => {
        if (!apiKey) {
            setError('Please set your OpenAI API Key in settings first.');
            setShowSettings(true);
            return;
        }
        if (!messageContent.trim()) return;

        const userMsg: Message = { role: 'user', content: messageContent };

        // If it's the first message, append context
        if (isFirstMessage && contextText) {
            userMsg.content += `\n\n[CONTEXT FILES ATTACHED]:\n${contextText}`;
        }

        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput(''); // Always clear input after sending
        setIsProcessing(true);
        setError(null);

        try {
            const fullHistory: Message[] = [
                { role: 'system', content: SYSTEM_PROMPT },
                ...newMessages
            ];

            const response = await sendChat({
                apiKey,
                messages: fullHistory,
            });

            if (response.includes('[READY]')) {
                setMode('research');
                const cleanResponse = response.replace('[READY]', '').trim();
                setMessages(prev => [...prev, { role: 'assistant', content: cleanResponse }]);
                await startDeepResearch(fullHistory);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: response }]);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'An error occurred.');
        } finally {
            setIsProcessing(false);
        }
    }, [apiKey, messages, contextText, autoSend, startDeepResearch]);

    // Auto-send initial prompt if autoSend is true
    const hasAutoSent = useRef(false);
    useEffect(() => {
        if (autoSend && initialPrompt && !isProcessing && messages.length === 0 && apiKey && !hasAutoSent.current) {
            // Small delay to ensure component is fully mounted and vector stores are ready
            const timer = setTimeout(() => {
                if (initialPrompt.trim() && !hasAutoSent.current) {
                    hasAutoSent.current = true;
                    sendMessage(initialPrompt, true);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [autoSend, initialPrompt, apiKey, isProcessing, messages.length, sendMessage]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, researchResult, mode]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            if (!apiKey) {
                setError('Please set your OpenAI API Key in settings first.');
                setShowSettings(true);
                return;
            }

            const files = Array.from(e.target.files);
            setContextFiles(prev => [...prev, ...files]);
            setIsProcessingFiles(true);
            setError(null);

            try {
                // Process files and create vector store
                console.log('Starting file upload to vector store...');
                const vsId = await processFilesForResearch(apiKey, files);
                if (vsId) {
                    console.log('✓ Vector store created:', vsId);
                    setVectorStoreIds(prev => {
                        // Keep max 2 vector stores (API limit)
                        const updated = [...prev, vsId];
                        return updated.slice(-2);
                    });
                    // Show success message
                    setError(null);
                } else {
                    throw new Error('Failed to create vector store');
                }

                // Also extract text for display/fallback (optional, doesn't block upload)
                for (const file of files) {
                    if (file.type === 'application/pdf') {
                        try {
                            const text = await extractTextFromPDF(file);
                            setContextText(prev => prev + `\n\n--- File: ${file.name} ---\n${text}`);
                            console.log(`✓ Extracted text from ${file.name}`);
                        } catch (error) {
                            console.warn(`⚠ Failed to extract text from ${file.name} (file still uploaded to vector store):`, error);
                            // Don't set error here, vector store upload succeeded
                        }
                    }
                }
            } catch (error: any) {
                console.error('File upload error:', error);
                setError(`Failed to upload files: ${error.message}`);
            } finally {
                setIsProcessingFiles(false);
            }
        }
    };

    const handleSendMessage = async () => {
        await sendMessage(input, messages.length === 0);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(researchResult);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="h-[calc(100vh-140px)]">
            <Card className="h-full flex flex-col relative overflow-hidden border-white/10">
                {/* Settings Overlay */}
                {showSettings && (
                    <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm p-6 flex flex-col items-center justify-center">
                        <div className="w-full max-w-md space-y-4">
                            <h3 className="text-xl font-bold">Settings</h3>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">OpenAI API Key</label>
                                <Input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="sk-..."
                                />
                            </div>
                            <Button onClick={() => setShowSettings(false)} className="w-full">Save & Close</Button>
                        </div>
                    </div>
                )}

                <CardContent className="flex-1 p-0 flex flex-col h-full">
                    {/* Header */}
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
                        <div className="flex items-center gap-2">
                            {isProcessing && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                        </div>
                    </div>

                    {/* Error Banner */}
                    {error && (
                        <div className="bg-destructive/20 text-destructive px-4 py-2 text-sm border-b border-destructive/20">
                            {error}
                        </div>
                    )}

                    {/* Main Content Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {mode === 'chat' ? (
                            <>
                                {messages.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                                        <Play className="w-12 h-12 mb-4" />
                                        <p>Enter your research topic to begin.</p>
                                    </div>
                                )}
                                {messages.map((msg, i) => (
                                    <div key={i} className={cn("flex flex-col max-w-[85%]", msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start")}>
                                        <div className={cn("px-4 py-3 rounded-2xl text-sm",
                                            msg.role === 'user'
                                                ? "bg-primary text-primary-foreground rounded-br-none"
                                                : "bg-secondary text-secondary-foreground rounded-bl-none"
                                        )}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                                <div ref={chatEndRef} />
                            </>
                        ) : (
                            <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap font-mono text-sm">
                                {isProcessing ? (
                                    <div className="flex flex-col items-center justify-center h-full py-12">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                                        <p className="text-muted-foreground">Deep Research in progress...</p>
                                        <p className="text-xs text-muted-foreground mt-2">This may take several minutes</p>
                                    </div>
                                ) : researchResult ? (
                                    <>
                                        {researchResult}
                                        <div ref={chatEndRef} />
                                    </>
                                ) : (
                                    <div className="text-muted-foreground">No research result available.</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t border-white/5 bg-black/20">
                        {mode === 'research' ? (
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    {isProcessing && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                                    <span className="text-xs text-muted-foreground">
                                        {isProcessing ? 'Deep Research in progress (this may take several minutes)...' : 'Deep Research Report complete.'}
                                    </span>
                                </div>
                                {!isProcessing && researchResult && (
                                    <Button variant="secondary" size="sm" onClick={copyToClipboard}>
                                        {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                                        Copy Report
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <Textarea
                                    placeholder="Type your message..."
                                    className="min-h-[50px] max-h-[150px] resize-none"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                />
                                <Button
                                    size="icon"
                                    className="h-[50px] w-[50px] shrink-0"
                                    onClick={handleSendMessage}
                                    disabled={isProcessing || !input.trim()}
                                >
                                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
