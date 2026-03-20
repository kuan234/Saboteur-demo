import React from 'react';
import { SocketProvider, useSocket } from './contexts/SocketContext';
import AuthPage from './pages/AuthPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import HandCardPreviewPage from './pages/HandCardPreviewPage';

function AppContent() {
    const { isAuthenticated, gameActive, errorMsg } = useSocket();

    return (
        <>
            {!isAuthenticated && <AuthPage />}
            {isAuthenticated && !gameActive && <LobbyPage />}
            {isAuthenticated && gameActive && <GamePage />}

            {/* Global Error Toast */}
            {errorMsg && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-900/90 border border-red-500 text-white px-6 py-3 rounded-lg shadow-xl font-bold flex items-center gap-3 animate-fade-in">
                    <span>⚠️</span> {errorMsg}
                </div>
            )}
        </>
    );
}

function App() {
    const preview = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('preview')
        : null;

    if (preview === 'hand-cards') {
        return <HandCardPreviewPage />;
    }

    return (
        <SocketProvider>
            <AppContent />
        </SocketProvider>
    );
}

export default App;
