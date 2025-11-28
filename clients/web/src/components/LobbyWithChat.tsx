import React, { useState } from 'react';
import { Plus, RefreshCw, Users, Play, Search, Wifi, WifiOff, Loader } from 'lucide-react';
import ChatPanel from './ChatPanel';
import RoomWaitingScreen from './RoomWaitingScreen';
import ScreenContainer from './ScreenContainer';
import type { RoomSummary, ChatBroadcast } from '../types';
import './LobbyWithChat.css';

interface LobbyWithChatProps {
  // Room state
  room: RoomSummary | null;
  rooms: RoomSummary[];
  
  // User state
  currentUserId: string;
  
  // Chat state
  chatMessages: ChatBroadcast[];
  
  // Input values
  roomNameInput: string;
  joinInput: string;
  
  // WebSocket status
  wsStatus: 'connected' | 'connecting' | 'disconnected';
  
  // Callbacks
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
  onLeaveRoom: () => void;
  onRefreshRooms: () => void;
  onRoomNameChange: (value: string) => void;
  onJoinInputChange: (value: string) => void;
  onSendMessage: (message: string) => void;
  onStartGame?: () => void;
}

interface Message {
  id: string;
  sender: string;
  senderUsername: string;
  content: string;
  timestamp: number;
}

const LobbyWithChat: React.FC<LobbyWithChatProps> = ({
  room,
  rooms,
  currentUserId,
  chatMessages,
  roomNameInput,
  joinInput,
  wsStatus,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onRefreshRooms,
  onRoomNameChange,
  onJoinInputChange,
  onSendMessage,
  onStartGame,
}) => {
  // Derive activeView from room prop instead of using state to avoid setState-in-effect warning
  const activeView = room ? 'waiting' : 'lobby';
  const [copied, setCopied] = useState(false);

  // Convert ChatBroadcast to Message format for ChatPanel
  const formattedMessages: Message[] = chatMessages.map((msg, idx) => ({
    id: `${msg.timestamp}-${idx}`,
    sender: msg.userId,
    senderUsername: msg.username,
    content: msg.message,
    timestamp: parseInt(msg.timestamp),
  }));

  const handleCopyRoomCode = () => {
    if (room) {
      navigator.clipboard.writeText(room.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isHost = room?.host === currentUserId;
  const opponentUsername =
    room?.players.find(p => p.userId !== currentUserId)?.username || 'Opponent';

  return (
    <ScreenContainer className="lobby-content-wrapper">
      {/* Two-column layout: Lobby + Chat */}
      <div className="lobby-grid">
        {/* Main Lobby/Waiting View */}
        <div className="lobby-main-section">
          {activeView === 'lobby' ? (
            <LobbyContent
              rooms={rooms}
              roomName={roomNameInput}
              onRoomNameChange={onRoomNameChange}
              onCreateRoom={onCreateRoom}
              joinInput={joinInput}
              onJoinInputChange={onJoinInputChange}
              onJoinRoom={onJoinRoom}
              onRefreshRooms={onRefreshRooms}
              wsStatus={wsStatus}
            />
          ) : (
            <RoomWaitingScreen
              room={room!}
              currentUserId={currentUserId}
              isHost={isHost}
              onStartGame={onStartGame}
              onLeaveRoom={onLeaveRoom}
              onCopyRoomCode={handleCopyRoomCode}
              copied={copied}
            />
          )}
        </div>

        {/* Right Sidebar - Chat Panel */}
        <aside className="lobby-chat-sidebar">
          <ChatPanel
            messages={formattedMessages}
            currentUserId={currentUserId}
            opponentUsername={room ? opponentUsername : 'Player'}
            onSendMessage={onSendMessage}
          />
        </aside>
      </div>
    </ScreenContainer>
  );
};

// ============================================
// LOBBY CONTENT COMPONENT
// ============================================

interface LobbyContentProps {
  rooms: RoomSummary[];
  roomName: string;
  onRoomNameChange: (value: string) => void;
  onCreateRoom: () => void;
  joinInput: string;
  onJoinInputChange: (value: string) => void;
  onJoinRoom: (roomId: string) => void;
  onRefreshRooms: () => void;
  wsStatus: 'connected' | 'connecting' | 'disconnected';
}

const LobbyContent: React.FC<LobbyContentProps> = ({
  rooms = [],
  roomName,
  onRoomNameChange,
  onCreateRoom,
  joinInput,
  onJoinInputChange,
  onJoinRoom,
  onRefreshRooms,
  wsStatus,
}) => {
  const handleCreateRoomClick = () => {
    if (!roomName.trim()) return;
    onCreateRoom();
  };

  const handleJoinByIdClick = () => {
    if (!joinInput.trim()) return;
    onJoinRoom(joinInput);
  };

  const getStatusIcon = () => {
    if (wsStatus === 'connected') return <Wifi className="icon-sm" />;
    if (wsStatus === 'connecting') return <Loader className="icon-sm loader" />;
    return <WifiOff className="icon-sm" />;
  };

  const getStatusClass = () => {
    if (wsStatus === 'connected') return 'status-connected';
    if (wsStatus === 'connecting') return 'status-connecting';
    return 'status-disconnected';
  };

  return (
    <div className="lobby-container">
      <div className="lobby-header">
        <div className="lobby-title-wrap">
          <h1 className="lobby-title">Game Lobby</h1>
          <p className="lobby-subtitle">Create a room or join an existing game</p>
        </div>

        {/* Connection Status */}
        <div className={`connection-status ${getStatusClass()}`}>
          {getStatusIcon()}
          <span className="connection-text">{wsStatus}</span>
        </div>
      </div>

      {/* Create & Join Actions */}
      <div className="actions-grid">
        {/* Create Room */}
        <div className="card-wrapper">
          <div className="card-glow card-glow-blue" aria-hidden="true" />
          <div className="card card-create">
            <div className="card-head">
              <div className="icon-circle icon-circle-blue">
                <Plus className="icon-md" />
              </div>
              <div>
                <h3 className="card-title">Create Room</h3>
                <p className="card-sub">Start a new game</p>
              </div>
            </div>

            <div className="card-body">
              <label className="field-label">Room Name</label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => onRoomNameChange(e.target.value)}
                placeholder="e.g., Epic Word Battle"
                maxLength={40}
                className="input-field"
              />

              <button
                onClick={handleCreateRoomClick}
                disabled={wsStatus !== 'connected' || !roomName.trim()}
                className="btn btn-primary btn-primary-blue"
              >
                {wsStatus === 'connected' ? (
                  <span className="btn-content">
                    <Plus className="icon-sm-inline" />
                    Create Room
                  </span>
                ) : (
                  <span className="btn-content">
                    <Loader className="icon-sm-inline loader" />
                    Connecting...
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Join by ID */}
        <div className="card-wrapper">
          <div className="card-glow card-glow-purple" aria-hidden="true" />
          <div className="card card-join">
            <div className="card-head">
              <div className="icon-circle icon-circle-purple">
                <Search className="icon-md" />
              </div>
              <div>
                <h3 className="card-title">Join by ID</h3>
                <p className="card-sub">Enter room code</p>
              </div>
            </div>

            <div className="card-body">
              <label className="field-label">Room ID</label>
              <input
                type="text"
                value={joinInput}
                onChange={(e) => onJoinInputChange(e.target.value)}
                placeholder="room_xxxxx"
                className="input-field input-mono"
              />

              <button
                onClick={handleJoinByIdClick}
                disabled={wsStatus !== 'connected' || !joinInput.trim()}
                className="btn btn-primary btn-primary-purple"
              >
                <span className="btn-content">
                  <Play className="icon-sm-inline" />
                  Join Room
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Available Rooms */}
      <div className="rooms-wrapper">
        <div className="rooms-glow" aria-hidden="true" />
        <div className="rooms-card">
          {/* Header */}
          <div className="rooms-head">
            <div className="rooms-head-left">
              <div className="users-icon">
                <Users className="icon-md" />
              </div>
              <div>
                <h3 className="card-title">Available Rooms</h3>
                <p className="card-sub">{Array.isArray(rooms) ? rooms.length : 0} active rooms</p>
              </div>
            </div>

            <button onClick={onRefreshRooms} className="icon-btn group">
              <RefreshCw className="icon-md rotate-on-hover" />
            </button>
          </div>

          {/* Room List */}
          <div className="room-list custom-scrollbar">
            {!Array.isArray(rooms) || rooms.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Users className="icon-lg muted" />
                </div>
                <p className="empty-title">No rooms available</p>
                <p className="empty-sub">Be the first to create one!</p>
              </div>
            ) : (
              rooms.map((room) => (
                <div key={room.roomId} className="room-item">
                  <div className="room-main">
                    <div className="room-info">
                      <div className="room-name-row">
                        <h4 className="room-name">{room.roomName}</h4>
                        <span
                          className={`room-badge ${
                            room.status === 'playing' ? 'room-badge-playing' : 'room-badge-waiting'
                          }`}
                        >
                          {room.status === 'playing' ? '🎮 In Progress' : '⏳ Waiting'}
                        </span>
                      </div>
                      <p className="room-id">{room.roomId}</p>
                    </div>

                    <div className="room-actions">
                      <div className="players-count">
                        <Users className="icon-sm" />
                        <span className="players-text">{(room.players?.length ?? 0)}/2</span>
                        <p className="players-label">players</p>
                      </div>

                      <button
                        onClick={() => onJoinRoom(room.roomId)}
                        disabled={room.status === 'playing'}
                        className="btn btn-join"
                      >
                        <Play className="icon-sm-inline" />
                        Join
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LobbyWithChat;
