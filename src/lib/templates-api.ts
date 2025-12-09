import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Template } from '../types/template';

const TEMPLATES_COLLECTION = 'templates';

export const fetchTemplates = async (): Promise<Template[]> => {
    const snapshot = await getDocs(collection(db, TEMPLATES_COLLECTION));
    return snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data() as Partial<Template>;
        return {
            id: docSnapshot.id,
            name: data.name ?? '',
            systemPrompt: data.systemPrompt,
            prompt: data.prompt ?? '',
            model: data.model ?? '',
            temperature: data.temperature ?? 1,
            topP: data.topP ?? 1,
        };
    });
};

export const saveTemplate = async (template: Template) => {
    const ref = doc(db, TEMPLATES_COLLECTION, template.id);
    await setDoc(ref, template);
};

export const deleteTemplate = async (id: string) => {
    const ref = doc(db, TEMPLATES_COLLECTION, id);
    await deleteDoc(ref);
};

