import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, User } from 'lucide-react';
import './ChatPanel.css';

interface Message {
  id: string;
  sender: string;
  senderUsername: string;
  content: string;
  timestamp: number;
}

interface ChatPanelProps {
  messages: Message[];
  currentUserId: string;
  opponentUsername?: string;
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentUserId,
  opponentUsername = 'Opponent',
  onSendMessage,
  isLoading = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputValue.trim() || isLoading) return;
    onSendMessage(inputValue);
    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <MessageCircle className="chat-icon" />
        <div className="chat-header-info">
          <h3 className="chat-title">Game Chat</h3>
          <p className="chat-opponent">vs {opponentUsername}</p>
        </div>
      </div>

      {/* Messages container */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <MessageCircle className="empty-icon" />
            <p className="empty-text">No messages yet. Be the first to chat!</p>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((message, index) => {
              const isOwn = message.sender === currentUserId;
              const previousMessage = index > 0 ? messages[index - 1] : null;
              const showAvatar = !previousMessage || previousMessage.sender !== message.sender;

              return (
                <div
                  key={message.id}
                  className={`message-group ${isOwn ? 'own' : 'other'}`}
                >
                  {showAvatar && (
                    <div className="message-avatar">
                      <User className="avatar-icon" />
                    </div>
                  )}
                  <div className={`message ${isOwn ? 'own-message' : 'other-message'}`}>
                    {showAvatar && (
                      <p className="message-sender">{message.senderUsername}</p>
                    )}
                    <div className="message-content">{message.content}</div>
                    <p className="message-time">{formatTime(message.timestamp)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="chat-input-area">
        <div className="input-wrapper">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={isLoading}
            className="chat-input"
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="send-btn"
            title="Send message (Enter)"
          >
            {isLoading ? (
              <div className="spinner-tiny"></div>
            ) : (
              <Send className="icon-xs" />
            )}
          </button>
        </div>
        <p className="input-hint">Press Enter to send, Shift+Enter for new line</p>
      </div>
    </div>
  );
};

export default ChatPanel;
