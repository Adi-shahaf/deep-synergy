import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Plus, Play, Trash2, Edit2, X, Check } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { useNavigate } from 'react-router-dom';
import type { Template } from '../../types/template';

export const TemplatesPage: React.FC = () => {
    const { templates, addTemplate, removeTemplate, loadTemplates } = useAppStore();
    const navigate = useNavigate();
    const [isAdding, setIsAdding] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateSystemPrompt, setNewTemplateSystemPrompt] = useState('');
    const [newTemplatePrompt, setNewTemplatePrompt] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTemplateName, setEditTemplateName] = useState('');
    const [editTemplateSystemPrompt, setEditTemplateSystemPrompt] = useState('');
    const [editTemplatePrompt, setEditTemplatePrompt] = useState('');

    useEffect(() => {
        void loadTemplates();
    }, [loadTemplates]);

    const handleAddTemplate = async () => {
        if (!newTemplateName || !newTemplatePrompt) return;
        setIsSaving(true);
        setError(null);
        try {
            await addTemplate({
                id: Date.now().toString(),
                name: newTemplateName,
                systemPrompt: newTemplateSystemPrompt || undefined,
                prompt: newTemplatePrompt,
                model: 'o4-mini-deep-research',
                temperature: 1,
                topP: 1
            });
            setNewTemplateName('');
            setNewTemplateSystemPrompt('');
            setNewTemplatePrompt('');
            setIsAdding(false);
        } catch (e) {
            console.error(e);
            setError('Failed to save template. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleStartEdit = (template: Template) => {
        setEditingId(template.id);
        setEditTemplateName(template.name);
        setEditTemplateSystemPrompt(template.systemPrompt || '');
        setEditTemplatePrompt(template.prompt);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditTemplateName('');
        setEditTemplateSystemPrompt('');
        setEditTemplatePrompt('');
    };

    const handleSaveEdit = async () => {
        if (!editingId || !editTemplateName || !editTemplatePrompt) return;
        setIsSaving(true);
        setError(null);
        try {
            const template = templates.find(t => t.id === editingId);
            if (template) {
                await addTemplate({
                    ...template,
                    name: editTemplateName,
                    systemPrompt: editTemplateSystemPrompt || undefined,
                    prompt: editTemplatePrompt
                });
                handleCancelEdit();
            }
        } catch (e) {
            console.error(e);
            setError('Failed to update template. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveTemplate = async (id: string) => {
        setError(null);
        try {
            await removeTemplate(id);
        } catch (e) {
            console.error(e);
            setError('Failed to remove template. Please try again.');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 p-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Research Templates</h1>
                <Button onClick={() => setIsAdding(!isAdding)} className="gap-2">
                    <Plus className="w-4 h-4" /> New Template
                </Button>
            </div>

            {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
                    {error}
                </div>
            )}

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
                            <label className="text-sm font-medium">
                                System Prompt <span className="text-muted-foreground text-xs">(Optional - defines AI behavior)</span>
                            </label>
                            <Textarea
                                placeholder="You are a Deep Research AI assistant. Your goal is to provide comprehensive, detailed, and accurate answers..."
                                className="min-h-[120px] font-mono text-sm"
                                value={newTemplateSystemPrompt}
                                onChange={(e) => setNewTemplateSystemPrompt(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                User Prompt <span className="text-muted-foreground text-xs">(The research question/topic)</span>
                            </label>
                            <Textarea
                                placeholder="Enter the detailed research prompt..."
                                className="min-h-[100px]"
                                value={newTemplatePrompt}
                                onChange={(e) => setNewTemplatePrompt(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => {
                                setIsAdding(false);
                                setNewTemplateName('');
                                setNewTemplateSystemPrompt('');
                                setNewTemplatePrompt('');
                            }}>Cancel</Button>
                            <Button onClick={handleAddTemplate} disabled={isSaving || !newTemplateName || !newTemplatePrompt}>
                                {isSaving ? 'Saving...' : 'Save Template'}
                            </Button>
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
                                <span>{editingId === template.id ? (
                                    <Input
                                        value={editTemplateName}
                                        onChange={(e) => setEditTemplateName(e.target.value)}
                                        className="h-8"
                                    />
                                ) : (
                                    <span>{template.name}</span>
                                )}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {editingId === template.id ? (
                                        <>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-primary hover:text-primary hover:bg-primary/10"
                                                onClick={handleSaveEdit}
                                                disabled={isSaving || !editTemplateName || !editTemplatePrompt}
                                            >
                                                <Check className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={handleCancelEdit}
                                                disabled={isSaving}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-primary hover:text-primary hover:bg-primary/10"
                                                onClick={() => handleStartEdit(template)}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleRemoveTemplate(template.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {editingId === template.id ? (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground">System Prompt</label>
                                        <Textarea
                                            placeholder="System prompt (optional)..."
                                            className="min-h-[100px] font-mono text-sm"
                                            value={editTemplateSystemPrompt}
                                            onChange={(e) => setEditTemplateSystemPrompt(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground">User Prompt</label>
                                        <Textarea
                                            placeholder="User prompt..."
                                            className="min-h-[100px]"
                                            value={editTemplatePrompt}
                                            onChange={(e) => setEditTemplatePrompt(e.target.value)}
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    {template.systemPrompt && (
                                        <div className="space-y-1">
                                            <p className="text-xs font-medium text-muted-foreground">System Prompt:</p>
                                            <p className="text-xs text-muted-foreground line-clamp-2 font-mono bg-secondary/50 p-2 rounded">
                                                {template.systemPrompt}
                                            </p>
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground">User Prompt:</p>
                                        <p className="text-sm text-muted-foreground line-clamp-3">
                                            {template.prompt}
                                        </p>
                                    </div>
                                    <Button
                                        className="w-full gap-2"
                                        onClick={() => navigate(`/research/${template.id}`)}
                                    >
                                        <Play className="w-4 h-4" /> Start Research
                                    </Button>
                                </>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};
