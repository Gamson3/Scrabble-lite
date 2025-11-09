import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { ChatBroadcast, RoomSummary, Session } from '../types';

export default function ChatPanel({
  room,
  chatMessages,
  chatInput,
  onChatInputChange,
  onSendChat,
  session,
}: {
  room: RoomSummary | null;
  chatMessages: ChatBroadcast[];
  chatInput: string;
  onChatInputChange: (s: string) => void;
  onSendChat: (e: FormEvent) => void;
  session: Session | null;
}) {
  const logRef = useRef<HTMLDivElement | null>(null);
  const [latestKey, setLatestKey] = useState<string | null>(null);

  useEffect(() => {
    if (!logRef.current) return;
    // Scroll to bottom when messages change
    logRef.current.scrollTop = logRef.current.scrollHeight;

    // Compute key of latest message for highlight
    const last = chatMessages[chatMessages.length - 1];
    if (last) {
      const key = `${last.timestamp}-${last.userId}-${last.message}`;
      setLatestKey(key);
      // clear highlight after a short delay
      const t = setTimeout(() => setLatestKey(null), 1400);
      return () => clearTimeout(t);
    }
  }, [chatMessages]);

  return (
    <article className="card chat-card">
      <div className="card-header">
        <div>
          <p className="eyebrow">Team radio</p>
          <h2>Room chat</h2>
        </div>
      </div>
      <div className="chat-log" ref={logRef} aria-live="polite">
        {chatMessages.length === 0 && <p className="muted">No messages yet.</p>}
        {chatMessages.map(message => {
          const key = `${message.timestamp}-${message.userId}-${message.message}`;
          const isMe = message.userId === session?.userId;
          const highlight = key === latestKey;
          return (
            <div
              key={key}
              className={`chat-line ${isMe ? 'me' : ''} ${highlight ? 'new' : ''}`}
            >
              <strong>{isMe ? 'You' : message.username}</strong>
              <span>{message.message}</span>
            </div>
          );
        })}
      </div>
      <form className="chat-input" onSubmit={onSendChat}>
        <input
          value={chatInput}
          onChange={event => onChatInputChange((event.target as HTMLInputElement).value)}
          placeholder="Send a supportive ping"
          disabled={!room}
        />
        <button className="btn" type="submit" disabled={!room || !chatInput.trim()}>
          Send
        </button>
      </form>
    </article>
  );
}
