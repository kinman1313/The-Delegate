// src/components/layout/Header.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
    onNewChat: () => void;
    onToggleFileUpload: () => void;
    onToggleSettings: () => void;
    onLogout: () => void;
    showSettings: boolean;
}

const Header: React.FC<HeaderProps> = ({
    onNewChat,
    onToggleFileUpload,
    onToggleSettings,
    onLogout,
    showSettings
}) => {
    const navigate = useNavigate();

return (
    <header className="app-header">
        <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            Multi - LLM Interface
        </h1>

        <div className="header-controls">
            <button 
                onClick={onNewChat}
                className="new-chat-btn"
                aria-label="New Chat"
            >
                New Chat
            </button>

            <button
                onClick={onToggleFileUpload}
                className="upload-btn"
                aria-label="Upload File"
            >
                Upload File
            </button>

            <button
                onClick={onToggleSettings}
                aria-label={showSettings ? "Close Settings" : "Open Settings"}
            >
                {showSettings ? 'Close Settings' : 'Settings'}
            </button>

            <button
                onClick={onLogout}
                className="logout-btn"
                aria-label="Logout"
            >
                Logout
            </button>
        </div>
    </header>
);
};

export default Header;