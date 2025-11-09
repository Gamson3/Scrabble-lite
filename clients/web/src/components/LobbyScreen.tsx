import type { RoomsListItem } from '../types';

export default function LobbyScreen({
  rooms,
  roomName,
  onRoomNameChange,
  onCreateRoom,
  joinInput,
  onJoinInputChange,
  onJoinRoom,
  onRefreshRooms,
  wsStatus,
}: {
  rooms: RoomsListItem[];
  roomName: string;
  onRoomNameChange: (s: string) => void;
  onCreateRoom: () => void;
  joinInput: string;
  onJoinInputChange: (s: string) => void;
  onJoinRoom: (roomId?: string) => void;
  onRefreshRooms: () => void;
  wsStatus: 'disconnected' | 'connecting' | 'connected';
}) {
  const sorted = rooms ?? [];

  return (
    <article className="card">
      <div className="card-header">
        <div>
          <p className="eyebrow">Lobby</p>
          <h2>Find or create a duel</h2>
        </div>
        <button className="btn btn-ghost" onClick={onRefreshRooms}>
          Refresh rooms
        </button>
      </div>
      <div className="lobby-actions">
        <div>
          <label>Room name</label>
          <input value={roomName} onChange={e => onRoomNameChange((e.target as HTMLInputElement).value)} maxLength={40} />
          <button className="btn btn-primary" onClick={onCreateRoom} disabled={wsStatus !== 'connected'}>
            Create morph room
          </button>
        </div>
        <div>
          <label>Join by ID</label>
          <input value={joinInput} onChange={e => onJoinInputChange((e.target as HTMLInputElement).value)} placeholder="room_xxx" />
          <button className="btn" onClick={() => onJoinRoom()} disabled={wsStatus !== 'connected'}>
            Join room
          </button>
        </div>
      </div>
      <div className="room-list">
        {sorted.length === 0 && <p className="muted">No open rooms yet. Create one!</p>}
        {sorted.map(item => (
          <div key={item.roomId} className="room-pill">
            <div>
              <strong>{item.roomName}</strong>
              <p className="muted">{item.roomId}</p>
            </div>
            <div className="room-pill-meta">
              <span className={`chip ${item.status === 'playing' ? 'chip-warning' : 'chip-online'}`}>
                {item.playerCount}/2
              </span>
              <button className="btn btn-ghost" onClick={() => onJoinRoom(item.roomId)}>
                Join
              </button>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
