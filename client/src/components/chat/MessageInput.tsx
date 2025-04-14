// src/components/chat/MessageInput.tsx
import React from 'react';
import { Box, TextField, IconButton, Paper } from '@mui/material';
import { Send as SendIcon, Gif as GifIcon, Mic as MicIcon, Schedule as ScheduleIcon, EmojiEmotions as EmojiIcon } from '@mui/icons-material';
import TypingIndicator from './TypingIndicator';
import GifPicker from './GifPicker';
import VoiceMessage from './VoiceMessage';
import MessageScheduler from './MessageScheduler';

// Define types for scheduled messages and typing users
interface ScheduledMessage {
    id: string;
    content: string;
    scheduledTime: Date;
}

interface TypingUser {
    id: string;
    name: string;
}

// Define props interface
interface MessageInputProps {
    messageInput: string;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSendMessage: (e: React.MouseEvent<HTMLButtonElement>) => void;
    showGifPicker: boolean;
    setShowGifPicker: (show: boolean) => void;
    showVoiceMessage: boolean;
    setShowVoiceMessage: (show: boolean) => void;
    showScheduler: boolean;
    setShowScheduler: (show: boolean) => void;
    showEmojiPicker: boolean;
    setShowEmojiPicker: (show: boolean) => void;
    handleGifSelect: (gif: any) => void;
    handleVoiceMessage: (audioData: Blob) => void;
    handleScheduleMessage: (message: string, time: Date) => void;
    scheduledMessages: ScheduledMessage[];
    typingUsers: TypingUser[];
}

const MessageInput: React.FC<MessageInputProps> = ({
    messageInput,
    handleInputChange,
    handleSendMessage,
    showGifPicker,
    setShowGifPicker,
    showVoiceMessage,
    setShowVoiceMessage,
    showScheduler,
    setShowScheduler,
    showEmojiPicker,
    setShowEmojiPicker,
    handleGifSelect,
    handleVoiceMessage,
    handleScheduleMessage,
    scheduledMessages,
    typingUsers
}) => (
    <Box sx={{ position: 'fixed', bottom: 0, right: 0, left: 0, p: 2, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
        {typingUsers.length > 0 && (
            <Box sx={{ mb: 1 }}>
                <TypingIndicator users={typingUsers} />
            </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <IconButton onClick={() => setShowGifPicker(!showGifPicker)} title="Send GIF" aria-label="send gif">
                <GifIcon />
            </IconButton>
            <IconButton onClick={() => setShowVoiceMessage(!showVoiceMessage)} title="Voice Message" aria-label="voice message">
                <MicIcon />
            </IconButton>
            <IconButton onClick={() => setShowScheduler(!showScheduler)} title="Schedule Message" aria-label="schedule message">
                <ScheduleIcon />
            </IconButton>
            <IconButton onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Add Emoji" aria-label="add emoji">
                <EmojiIcon />
            </IconButton>
        </Box>

        {showGifPicker && (
            <Box sx={{ position: 'absolute', bottom: '100%', left: 0, right: 0, mb: 1 }}>
                <Paper elevation={3} sx={{ p: 2 }}>
                    <GifPicker onSelect={handleGifSelect} onClose={() => setShowGifPicker(false)} />
                </Paper>
            </Box>
        )}

        {showVoiceMessage && (
            <Box sx={{ position: 'absolute', bottom: '100%', left: 0, right: 0, mb: 1 }}>
                <Paper elevation={3} sx={{ p: 2 }}>
                    <VoiceMessage onSend={handleVoiceMessage} onClose={() => setShowVoiceMessage(false)} />
                </Paper>
            </Box>
        )}

        {showScheduler && (
            <Box sx={{ position: 'absolute', bottom: '100%', left: 0, right: 0, mb: 1 }}>
                <Paper elevation={3} sx={{ p: 2 }}>
                    <MessageScheduler scheduledMessages={scheduledMessages} onSchedule={handleScheduleMessage} onClose={() => setShowScheduler(false)} />
                </Paper>
            </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
                fullWidth
                value={messageInput}
                onChange={handleInputChange as any}
                placeholder="Type a message..."
                variant="outlined"
                size="small"
                aria-label="message input"
            />
            <IconButton
                color="primary"
                onClick={handleSendMessage}
                disabled={!messageInput.trim()}
                aria-label="send message"
            >
                <SendIcon />
            </IconButton>
        </Box>
    </Box>
);

export default MessageInput;
