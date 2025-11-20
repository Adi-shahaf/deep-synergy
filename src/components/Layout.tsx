import React from 'react';

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
                <header className="mb-12 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 shadow-lg shadow-blue-500/20" />
                        <h1 className="text-2xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                            DeepSynergy
                        </h1>
                    </div>
                    <nav className="flex space-x-6 text-sm font-medium text-muted-foreground">
                        <a href="#" className="hover:text-foreground transition-colors">Research</a>
                        <a href="#" className="hover:text-foreground transition-colors">Templates</a>
                        <a href="#" className="hover:text-foreground transition-colors">History</a>
                    </nav>
                </header>

                <main>
                    {children}
                </main>
            </div>
        </div>
    );
};
