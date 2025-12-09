import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Input } from '../ui/Input';
import { Play, Copy, Check, Send, Loader2 } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { sendChat, runDeepResearch, type Message } from '../../lib/openai';
import { cn } from '../../lib/utils';

const DEFAULT_SYSTEM_PROMPT = `You are a Deep Research AI assistant.
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
    initialSystemPrompt?: string;
    initialContext?: string;
    initialVectorStoreId?: string | null;
    autoSend?: boolean;
    skipChat?: boolean; // Skip chat phase and go directly to deep research
}

export const ResearchForm: React.FC<ResearchFormProps> = ({ 
    initialPrompt = '', 
    initialSystemPrompt,
    initialContext = '',
    initialVectorStoreId = null,
    autoSend = false,
    skipChat = false
}) => {
    const systemPrompt = useMemo(() => initialSystemPrompt || DEFAULT_SYSTEM_PROMPT, [initialSystemPrompt]);
    const { apiKey, setApiKey } = useAppStore();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [researchResult, setResearchResult] = useState('');
    const contextText = useMemo(() => initialContext, [initialContext]);
    const vectorStoreIds = useMemo(
        () => (initialVectorStoreId ? [initialVectorStoreId] : []),
        [initialVectorStoreId]
    );
    const [showSettings, setShowSettings] = useState(false);
    const [copied, setCopied] = useState(false);
    const [mode, setMode] = useState<'chat' | 'research'>('chat');
    const [error, setError] = useState<string | null>(null);
    const [researchStartTime, setResearchStartTime] = useState<number | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [waitingForResearchAnswer, setWaitingForResearchAnswer] = useState(false);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const hasAutoSent = useRef(false);

    const startDeepResearch = useCallback(async (history: Message[]) => {
        setIsProcessing(true);
        setResearchStartTime(Date.now());
        setElapsedTime(0);
        try {
            // Extract system prompt from history
            const systemMsg = history.find(m => m.role === 'system');
            const systemPromptText = systemMsg?.content || systemPrompt;
            
            // Build research prompt with system prompt included
            const conversationHistory = history
                .filter(m => m.role !== 'system')
                .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
                .join('\n\n');
            
            // Combine system prompt with conversation history
            const researchPrompt = systemPromptText 
                ? `[SYSTEM INSTRUCTIONS]:\n${systemPromptText}\n\n[CONVERSATION HISTORY]:\n${conversationHistory}`
                : conversationHistory;

            const data = await runDeepResearch({
                apiKey,
                prompt: researchPrompt,
                vectorStoreIds: vectorStoreIds.length > 0 ? vectorStoreIds : undefined
            });

            if (data.status === 'failed') {
                const message = data.error?.message || 'Deep research failed';
                throw new Error(message);
            }

            // Check if deep research is asking questions
            if (data.isQuestion) {
                let questionText = '';
                if (data.output && Array.isArray(data.output)) {
                    const messageItem = data.output.find((item: any) => item.type === 'message');
                    if (messageItem && messageItem.content) {
                        if (Array.isArray(messageItem.content)) {
                            questionText = messageItem.content
                                .map((part: any) => part.text || part.output_text || '')
                                .join('');
                        } else if (typeof messageItem.content === 'string') {
                            questionText = messageItem.content;
                        }
                    }

                    if (!questionText) {
                        for (const item of data.output) {
                            if (item.text) {
                                questionText += item.text + '\n\n';
                            } else if (item.output_text) {
                                questionText += item.output_text + '\n\n';
                            } else if (item.content && typeof item.content === 'string') {
                                questionText += item.content + '\n\n';
                            }
                        }
                    }
                } else if (data.output_text) {
                    questionText = data.output_text;
                } else if (data.text) {
                    questionText = data.text;
                }

                if (questionText && questionText.trim()) {
                    // Display questions in chat mode and wait for user response
                    setMode('chat');
                    setWaitingForResearchAnswer(true);
                    setMessages(prev => [...prev, { role: 'assistant', content: questionText }]);
                    setIsProcessing(false);
                    setResearchStartTime(null);
                    return; // Exit early, wait for user to respond
                }
            }

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
                finalText = JSON.stringify(data, null, 2);
            }

            if (!finalText || finalText.trim() === '') {
                throw new Error('Research completed but no output was generated. Please try again.');
            }

            setResearchResult(finalText);
        } catch (err: any) {
            console.error('Deep research error:', err);
            setError(err.message || 'Failed to generate research report. Please try again.');
            setResearchResult('');
        } finally {
            setIsProcessing(false);
            setResearchStartTime(null);
        }
    }, [apiKey, vectorStoreIds, systemPrompt]);

    const sendMessage = useCallback(async (messageContent: string, isFirstMessage: boolean = false) => {
        if (!apiKey) {
            setError('Please set your OpenAI API Key in settings first.');
            setShowSettings(true);
            return;
        }
        if (!messageContent.trim()) return;

        const userMsg: Message = { role: 'user', content: messageContent };

        if (isFirstMessage && contextText) {
            userMsg.content += `\n\n[CONTEXT FILES ATTACHED]:\n${contextText}`;
        }

        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput('');
        setIsProcessing(true);
        setError(null);

        try {
            const fullHistory: Message[] = [
                { role: 'system', content: systemPrompt },
                ...newMessages
            ];

            // If we're waiting for a deep research answer, continue deep research instead of using chat
            if (waitingForResearchAnswer) {
                setWaitingForResearchAnswer(false);
                setMode('research');
                await startDeepResearch(fullHistory);
                return;
            }

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
    }, [apiKey, messages, contextText, startDeepResearch, systemPrompt, waitingForResearchAnswer]);

    useEffect(() => {
        if (autoSend && initialPrompt && !isProcessing && messages.length === 0 && apiKey && !hasAutoSent.current) {
            const timer = setTimeout(() => {
                if (initialPrompt.trim() && !hasAutoSent.current) {
                    hasAutoSent.current = true;
                    
                    // If skipChat is true, go directly to deep research
                    if (skipChat) {
                        setMode('research');
                        const userMsg: Message = { role: 'user', content: initialPrompt };
                        if (contextText) {
                            userMsg.content += `\n\n[CONTEXT FILES ATTACHED]:\n${contextText}`;
                        }
                        const history: Message[] = [
                            { role: 'system', content: systemPrompt },
                            userMsg
                        ];
                        setMessages([userMsg]);
                        startDeepResearch(history).catch((err: any) => {
                            console.error('Deep research error:', err);
                            setError(err.message || 'Failed to generate research report. Please try again.');
                            setIsProcessing(false);
                        });
                    } else {
                        sendMessage(initialPrompt, true);
                    }
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [autoSend, initialPrompt, apiKey, isProcessing, messages.length, sendMessage, skipChat, contextText, systemPrompt, startDeepResearch]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, researchResult, mode]);

    // Timer effect for deep research
    useEffect(() => {
        if (!researchStartTime || !isProcessing) {
            return;
        }

        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - researchStartTime) / 1000);
            setElapsedTime(elapsed);
        }, 1000);

        return () => clearInterval(interval);
    }, [researchStartTime, isProcessing]);

    // Format elapsed time as MM:SS
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
                                        {researchStartTime && (
                                            <p className="text-xs text-muted-foreground/70 mt-1 font-mono">
                                                {formatTime(elapsedTime)}
                                            </p>
                                        )}
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
                                    {isProcessing && researchStartTime && (
                                        <span className="text-xs text-muted-foreground/70 font-mono ml-2">
                                            {formatTime(elapsedTime)}
                                        </span>
                                    )}
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
