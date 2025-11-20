import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Input } from '../ui/Input';
import { Upload, Play, Copy, Check, Settings, Send, Loader2 } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { sendChat, runDeepResearch, type Message } from '../../lib/openai';
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
}

export const ResearchForm: React.FC<ResearchFormProps> = ({ initialPrompt = '', initialContext = '' }) => {
    const { apiKey, setApiKey } = useAppStore();
    const [input, setInput] = useState(initialPrompt);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [researchResult, setResearchResult] = useState('');
    const [contextFiles, setContextFiles] = useState<File[]>([]);
    const [contextText, setContextText] = useState(initialContext);
    const [showSettings, setShowSettings] = useState(false);
    const [copied, setCopied] = useState(false);
    const [mode, setMode] = useState<'chat' | 'research'>('chat');
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Auto-send initial prompt if provided (optional, maybe just pre-fill)
    // For wizard flow, we might want to let user send it manually or auto-send.
    // Let's just pre-fill for now.

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, researchResult, mode]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            setContextFiles(prev => [...prev, ...files]);

            for (const file of files) {
                if (file.type === 'application/pdf') {
                    try {
                        const text = await extractTextFromPDF(file);
                        setContextText(prev => prev + `\n\n--- File: ${file.name} ---\n${text}`);
                    } catch (error) {
                        console.error(`Failed to parse ${file.name}`, error);
                        setError(`Failed to parse ${file.name}`);
                    }
                }
            }
        }
    };

    const handleSendMessage = async () => {
        if (!apiKey) {
            setError('Please set your OpenAI API Key in settings first.');
            setShowSettings(true);
            return;
        }
        if (!input.trim()) return;

        const userMsg: Message = { role: 'user', content: input };

        // If it's the first message, append context
        if (messages.length === 0 && contextText) {
            userMsg.content += `\n\n[CONTEXT FILES ATTACHED]:\n${contextText}`;
        }

        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput('');
        setIsProcessing(true);
        setError(null);

        try {
            // Include system prompt if it's the start
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

                // Trigger Deep Research Stream
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
    };

    const startDeepResearch = async (history: Message[]) => {
        setIsProcessing(true);
        try {
            // Consolidate history into a single prompt
            const researchPrompt = history
                .filter(m => m.role !== 'system')
                .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
                .join('\n\n');

            const data = await runDeepResearch({
                apiKey,
                prompt: researchPrompt
            });

            // Parse the response to find the final message
            // Assuming data.output is an array of items
            let finalText = '';
            if (data.output) {
                const messageItem = data.output.find((item: any) => item.type === 'message');
                if (messageItem && messageItem.content) {
                    // content is an array of parts
                    finalText = messageItem.content
                        .map((part: any) => part.text || '')
                        .join('');
                }
            } else if (data.output_text) {
                // Some API versions might return this directly
                finalText = data.output_text;
            } else {
                finalText = JSON.stringify(data, null, 2); // Fallback debug
            }

            setResearchResult(finalText);
        } catch (err: any) {
            setError(err.message || 'Failed to generate research report.');
        } finally {
            setIsProcessing(false);
        }
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
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            {mode === 'chat' ? 'Research Assistant' : 'Deep Research Report'}
                            {isProcessing && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                        </h2>
                        <div className="flex gap-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                multiple
                                accept=".pdf,.txt"
                                onChange={handleFileUpload}
                            />
                            <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                                <Upload className="w-4 h-4" />
                                Context ({contextFiles.length})
                            </Button>
                            <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowSettings(!showSettings)}>
                                <Settings className="w-4 h-4" />
                            </Button>
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
                                {researchResult}
                                <div ref={chatEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t border-white/5 bg-black/20">
                        {mode === 'research' ? (
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground animate-pulse">
                                    {isProcessing ? 'Deep Research in progress (this may take several minutes)...' : 'Deep Research Report complete.'}
                                </span>
                                <Button variant="secondary" size="sm" onClick={copyToClipboard}>
                                    {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                                    Copy Report
                                </Button>
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
