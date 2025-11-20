import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { ArrowLeft, ArrowRight, Upload, FileText } from 'lucide-react';
import { extractTextFromPDF } from '../../lib/file-processing';
import { processFilesForResearch } from '../../lib/openai';
import { cn } from '../../lib/utils';
import { ResearchForm } from './ResearchForm';

export const ResearchWizard: React.FC = () => {
    const { templateId } = useParams();
    const { templates, apiKey } = useAppStore();
    const navigate = useNavigate();

    const [step, setStep] = useState<1 | 2>(1);
    const [prompt, setPrompt] = useState('');
    const [contextFiles, setContextFiles] = useState<File[]>([]);
    const [contextText, setContextText] = useState('');
    const [vectorStoreId, setVectorStoreId] = useState<string | null>(null);
    const [isProcessingFiles, setIsProcessingFiles] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (templateId) {
            const template = templates.find(t => t.id === templateId);
            if (template) {
                setPrompt(template.prompt);
            }
        }
    }, [templateId, templates]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            if (!apiKey) {
                setError('Please set your OpenAI API Key in settings first.');
                return;
            }

            const files = Array.from(e.target.files);
            setContextFiles(prev => [...prev, ...files]);
            setIsProcessingFiles(true);
            setError(null);

            try {
                // Process files and create vector store
                const vsId = await processFilesForResearch(apiKey, files);
                if (vsId) {
                    setVectorStoreId(vsId);
                }

                // Also extract text for display
                for (const file of files) {
                    if (file.type === 'application/pdf') {
                        try {
                            const text = await extractTextFromPDF(file);
                            setContextText(prev => prev + `\n\n--- File: ${file.name} ---\n${text}`);
                        } catch (error) {
                            console.error(`Failed to parse ${file.name}`, error);
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

    if (step === 2) {
        return (
            <div className="h-full flex flex-col">
                <div className="mb-4 flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Setup
                    </Button>
                    <h2 className="text-lg font-semibold">Step 2: Clarification & Research</h2>
                </div>
                <ResearchForm 
                    initialPrompt={prompt} 
                    initialContext={contextText}
                    initialVectorStoreId={vectorStoreId}
                />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-8">
            <div className="flex items-center gap-4 mb-8">
                <Button variant="ghost" size="icon" onClick={() => navigate('/templates')}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Research Setup</h1>
                    <p className="text-muted-foreground">Step 1: Review prompt and add context</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Research Prompt</CardTitle>
                </CardHeader>
                <CardContent>
                    <Textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="min-h-[200px] font-mono text-sm"
                    />
                </CardContent>
            </Card>

                    <Card>
                <CardHeader>
                    <CardTitle>Reference Files</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error && (
                        <div className="bg-destructive/20 text-destructive px-4 py-2 text-sm rounded-lg">
                            {error}
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {contextFiles.map((file, i) => (
                            <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-white/5">
                                <FileText className="w-4 h-4 text-primary" />
                                <span className="text-sm truncate flex-1">{file.name}</span>
                            </div>
                        ))}
                        <label className={cn(
                            "cursor-pointer flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed transition-colors",
                            isProcessingFiles 
                                ? "border-primary/50 bg-primary/10 cursor-wait" 
                                : "border-white/20 hover:border-primary/50 hover:bg-white/5"
                        )}>
                            <Upload className="w-4 h-4" />
                            <span className="text-sm">{isProcessingFiles ? 'Uploading...' : 'Add PDF'}</span>
                            <input 
                                type="file" 
                                className="hidden" 
                                multiple 
                                accept=".pdf" 
                                onChange={handleFileUpload}
                                disabled={isProcessingFiles}
                            />
                        </label>
                    </div>
                    {vectorStoreId && (
                        <p className="text-xs text-muted-foreground">
                            ✓ Files uploaded to vector store (ready for deep research)
                        </p>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button size="lg" onClick={() => setStep(2)} className="gap-2">
                    Next: Start Clarification <ArrowRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};
