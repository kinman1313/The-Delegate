// src/components/layout/Sidebar.tsx
import React from 'react';
import ModelSelector from '../models/ModelSelector';
import SidebarConversations from '../conversations/SidebarConversations';
import SettingsPanel from '../settings/SettingsPanel';

interface Conversation {
    _id: string;
    title: string;
    updatedAt: string;
    summary?: string;
}

interface ModelSettings {
    apiKey?: string;
    model?: string;
    temperature: number;
    maxTokens: number;
}

interface Settings {
    [model: string]: ModelSettings;
}

interface SidebarProps {
    selectedModel: string;
    onModelChange: (modelId: string) => void;
    conversations: Conversation[];
    currentConversationId: string | null;
    onSelectConversation: (conversationId: string) => void;
    settings: Settings;
    onSettingsChange: (provider: string, key: string, value: any) => void;
    showSettings: boolean;
    token: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({
    selectedModel,
    onModelChange,
    conversations,
    currentConversationId,
    onSelectConversation,
    settings,
    onSettingsChange,
    showSettings,
    token
}) => {
    return (
        <div className= "sidebar" >
            <ModelSelector 
            selectedModel={ selectedModel }
    onModelChange = { onModelChange }
        />

        <SidebarConversations
        conversations={ conversations }
    currentConversationId = { currentConversationId }
    onSelectConversation = { onSelectConversation }
        />

        { showSettings && (
            <SettingsPanel 
            settings={ settings }
    selectedModel = { selectedModel }
    onSettingsChange = { onSettingsChange }
    token = { token }
        />
)}
</div>
);
};

export default Sidebar;