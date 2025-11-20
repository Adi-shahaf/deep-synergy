import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { ArrowLeft, ArrowRight, Upload, FileText } from 'lucide-react';
import { extractTextFromPDF } from '../../lib/file-processing';
import { ResearchForm } from './ResearchForm';

export const ResearchWizard: React.FC = () => {
    const { templateId } = useParams();
    const { templates } = useAppStore();
    const navigate = useNavigate();

    const [step, setStep] = useState<1 | 2>(1);
    const [prompt, setPrompt] = useState('');
    const [contextFiles, setContextFiles] = useState<File[]>([]);
    const [contextText, setContextText] = useState('');

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
            const files = Array.from(e.target.files);
            setContextFiles(prev => [...prev, ...files]);

            for (const file of files) {
                if (file.type === 'application/pdf') {
                    try {
                        const text = await extractTextFromPDF(file);
                        setContextText(prev => prev + `\n\n--- File: ${file.name} ---\n${text}`);
                    } catch (error) {
                        console.error(`Failed to parse ${file.name}`, error);
                    }
                }
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
                <ResearchForm initialPrompt={prompt} initialContext={contextText} />
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {contextFiles.map((file, i) => (
                            <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-white/5">
                                <FileText className="w-4 h-4 text-primary" />
                                <span className="text-sm truncate flex-1">{file.name}</span>
                            </div>
                        ))}
                        <label className="cursor-pointer flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-white/20 hover:border-primary/50 hover:bg-white/5 transition-colors">
                            <Upload className="w-4 h-4" />
                            <span className="text-sm">Add PDF</span>
                            <input type="file" className="hidden" multiple accept=".pdf" onChange={handleFileUpload} />
                        </label>
                    </div>
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
