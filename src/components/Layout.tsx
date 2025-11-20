import React from 'react';
import { cn } from '../lib/utils';
import { NavLink } from 'react-router-dom';
import logoImage from '../assets/logo.png';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen bg-background text-foreground relative overflow-hidden font-sans selection:bg-primary selection:text-primary-foreground">
            {/* Futuristic Background Elements */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[120px]" />
                <div className="absolute top-[40%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rounded-full bg-cyan-500/5 blur-[150px]" />
            </div>

            {/* Content Container */}
            <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
                <header className="mb-12 flex items-center">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2">
                            <img 
                                src={logoImage} 
                                alt="DeepSynergy Logo" 
                                className="w-8 h-8"
                            />
                            <h1 className="text-xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                                DeepSynergy
                            </h1>
                        </div>

                        <nav className="flex gap-4">
                            <NavLink to="/templates" className={({ isActive }) => cn("text-sm font-medium transition-colors hover:text-primary", isActive ? "text-primary" : "text-muted-foreground")}>
                                Templates
                            </NavLink>
                            <NavLink to="/" className={({ isActive }) => cn("text-sm font-medium transition-colors hover:text-primary", isActive ? "text-primary" : "text-muted-foreground")}>
                                Chat
                            </NavLink>
                        </nav>
                    </div>
                </header>

                <main>
                    {children}
                </main>
            </div>
        </div>
    );
};
