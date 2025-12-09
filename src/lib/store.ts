import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchTemplates, saveTemplate, deleteTemplate } from './templates-api';
import type { Template } from '../types/template';

interface AppState {
    apiKey: string;
    setApiKey: (key: string) => void;
    templates: Template[];
    loadTemplates: () => Promise<void>;
    addTemplate: (template: Template) => Promise<void>;
    removeTemplate: (id: string) => Promise<void>;
    history: any[]; // TODO: Define history type
}

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            apiKey: '',
            setApiKey: (key) => set({ apiKey: key }),
            templates: [],
            loadTemplates: async () => {
                try {
                    const remoteTemplates = await fetchTemplates();
                    set({ templates: remoteTemplates });
                } catch (error) {
                    console.error('Failed to load templates from Firebase', error);
                }
            },
            addTemplate: async (template) => {
                set((state) => ({ templates: [...state.templates, template] }));
                try {
                    await saveTemplate(template);
                } catch (error) {
                    console.error('Failed to save template to Firebase', error);
                    set((state) => ({
                        templates: state.templates.filter((t) => t.id !== template.id),
                    }));
                    throw error;
                }
            },
            removeTemplate: async (id) => {
                set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }));
                try {
                    await deleteTemplate(id);
                } catch (error) {
                    console.error('Failed to delete template from Firebase', error);
                    await get().loadTemplates();
                    throw error;
                }
            },
            history: [],
        }),
        {
            name: 'deep-research-storage',
            partialize: (state) => ({
                apiKey: state.apiKey,
                templates: state.templates,
                history: state.history,
            }),
        }
    )
);
