import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Plus, Play, Trash2 } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { useNavigate } from 'react-router-dom';

export const TemplatesPage: React.FC = () => {
    const { templates, addTemplate, removeTemplate } = useAppStore();
    const navigate = useNavigate();
    const [isAdding, setIsAdding] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplatePrompt, setNewTemplatePrompt] = useState('');

    const handleAddTemplate = () => {
        if (!newTemplateName || !newTemplatePrompt) return;
        addTemplate({
            id: Date.now().toString(),
            name: newTemplateName,
            prompt: newTemplatePrompt,
            model: 'o3-deep-research',
            temperature: 1,
            topP: 1
        });
        setNewTemplateName('');
        setNewTemplatePrompt('');
        setIsAdding(false);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 p-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Research Templates</h1>
                <Button onClick={() => setIsAdding(!isAdding)} className="gap-2">
                    <Plus className="w-4 h-4" /> New Template
                </Button>
            </div>

            {isAdding && (
                <Card className="border-primary/50 animate-in fade-in slide-in-from-top-4">
                    <CardHeader>
                        <CardTitle>Create New Template</CardTitle>
                        <CardDescription>Define a reusable research prompt.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Template Name</label>
                            <Input
                                placeholder="e.g., Market Analysis"
                                value={newTemplateName}
                                onChange={(e) => setNewTemplateName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Prompt</label>
                            <Textarea
                                placeholder="Enter the detailed research prompt..."
                                className="min-h-[100px]"
                                value={newTemplatePrompt}
                                onChange={(e) => setNewTemplatePrompt(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
                            <Button onClick={handleAddTemplate}>Save Template</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.length === 0 && !isAdding && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                        No templates found. Create one to get started.
                    </div>
                )}
                {templates.map((template) => (
                    <Card key={template.id} className="group hover:border-primary/50 transition-colors">
                        <CardHeader>
                            <CardTitle className="flex justify-between items-start">
                                <span>{template.name}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => removeTemplate(template.id)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground line-clamp-3">
                                {template.prompt}
                            </p>
                            <Button
                                className="w-full gap-2"
                                onClick={() => navigate(`/research/${template.id}`)}
                            >
                                <Play className="w-4 h-4" /> Start Research
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};
