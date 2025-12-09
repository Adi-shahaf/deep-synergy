import { getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: 'AIzaSyDT_7Pnffx9L27iTupD7cU4mEon5fKqbaM',
    authDomain: 'deep-synergy.firebaseapp.com',
    projectId: 'deep-synergy',
    storageBucket: 'deep-synergy.firebasestorage.app',
    messagingSenderId: '922493115562',
    appId: '1:922493115562:web:93745ed03a825cf6ca84d3',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(app);

