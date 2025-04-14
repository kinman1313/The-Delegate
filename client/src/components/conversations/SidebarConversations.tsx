// SidebarConversations.tsx
import React from 'react';

interface Conversation {
    _id: string;
    title: string;
    updatedAt: string;
    summary?: string;
}

interface SidebarConversationsProps {
    conversations: Conversation[];
    currentConversationId: string | null;
    onSelectConversation: (conversationId: string) => void;
}

const SidebarConversations: React.FC<SidebarConversationsProps> = ({
    conversations,
    currentConversationId,
    onSelectConversation
}) => {
    // Format conversation date
    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();

        // If today, show time
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        // If this year, show month and day
        if (date.getFullYear() === now.getFullYear()) {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }

        // Otherwise show full date
        return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    };

    // Truncate conversation title if too long
    const truncateTitle = (title: string, maxLength: number = 30): string => {
        if (title.length <= maxLength) return title;
        return title.substring(0, maxLength - 3) + '...';
    };

    return (
        <div className="sidebar-conversations">
            <h2>Conversations</h2>

            {conversations.length === 0 ? (
                <div className="empty-conversations">
                    <p>No conversations yet</p>
                </div>
            ) : (
                <div className="conversation-list">
                    {conversations.map(conversation => (
                        <div
                            key={conversation._id}
                            className={`conversation-item ${currentConversationId === conversation._id ? 'selected' : ''}`}
                            onClick={() => onSelectConversation(conversation._id)}
                        >
                            <div className="conversation-title">
                                {truncateTitle(conversation.title)}
                            </div>
                            <div className="conversation-meta">
                                <span className="conversation-date">
                                    {formatDate(conversation.updatedAt)}
                                </span>
                            </div>

                            {conversation.summary && (
                                <div className="conversation-summary">
                                    {truncateTitle(conversation.summary, 60)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SidebarConversations;
