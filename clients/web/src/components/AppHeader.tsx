// React import not required in modern JSX runtimes (kept intentionally empty)
import type { Session } from '../types';

export default function AppHeader({
  session,
  wsStatus,
  onLogout,
}: {
  session: Session | null;
  wsStatus: 'disconnected' | 'connecting' | 'connected';
  onLogout: () => void;
}) {
  const connectionChip =
    wsStatus === 'connected' ? 'chip chip-online' : wsStatus === 'connecting' ? 'chip chip-waiting' : 'chip chip-offline';

  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Word Morph Duel</p>
        <h1>Transform words. Outsprint your rival.</h1>
        <p className="subtitle">Real-time Wordle-style duels powered by the Scrabble-lite microservices you built.</p>
      </div>
      {session && (
        <div className="session-card">
          <div>
            <small>Logged in as</small>
            <strong> {session.username} </strong>
          </div>
          <span className={connectionChip}>{wsStatus}</span>
          <button className="btn btn-ghost text-white" onClick={onLogout}>
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
