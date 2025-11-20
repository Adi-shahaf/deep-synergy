import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Template {
    id: string;
    name: string;
    prompt: string;
    model: string;
    temperature: number;
    topP: number;
}

interface AppState {
    apiKey: string;
    setApiKey: (key: string) => void;
    templates: Template[];
    addTemplate: (template: Template) => void;
    removeTemplate: (id: string) => void;
    history: any[]; // TODO: Define history type
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            apiKey: '',
            setApiKey: (key) => set({ apiKey: key }),
            templates: [],
            addTemplate: (template) =>
                set((state) => ({ templates: [...state.templates, template] })),
            removeTemplate: (id) =>
                set((state) => ({ templates: state.templates.filter((t) => t.id !== id) })),
            history: [],
        }),
        {
            name: 'deep-research-storage',
        }
    )
);
