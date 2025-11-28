import React from 'react';
import { LogOut, Loader, User } from 'lucide-react';
import type { Session } from '../types';
import './AppHeader.css';

interface AppHeaderProps {
  session: Session | null;
  wsStatus: 'disconnected' | 'connecting' | 'connected';
  onLogout: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  session,
  wsStatus,
  onLogout,
}) => {
  return (
    <header className="app-header">
      {/* Logo and title section */}
      <div className="header-brand">
        <div className="brand-logo-group">
          <div className="brand-logo-wrapper">
            <div className="brand-logo-bg"></div>
            <User className="brand-logo-icon" />
          </div>
          <div>
            <h1 className="brand-title">Word Rush ⚡</h1>
            <p className="brand-subtitle">Fast Words. Faster Wins. • Race against time</p>
          </div>
        </div>
        <p className="brand-description">Real-time 2-player word duels powered by distributed microservices</p>
      </div>

      {/* User Session Card */}
      {session && (
        <div className="session-card-wrapper">
          <div className="session-card">
            <div className="session-content">
              {/* User Avatar */}
              <div className="user-avatar-container">
                <div className="user-avatar">
                  <User className="avatar-icon" />
                </div>
                <div className={`status-indicator status-${wsStatus}`}>
                  <span className="status-pulse"></span>
                </div>
              </div>

              {/* User Info */}
              <div className="user-details">
                <p className="user-label">Logged in as</p>
                <p className="user-name">{session.username}</p>
              </div>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="logout-btn"
                title="Logout"
              >
                <LogOut className="logout-icon" />
              </button>
            </div>

            {/* Connection Status */}
            <div className="connection-status-bar">
              <div className={`status-badge status-${wsStatus}`}>
                {wsStatus === 'connected' ? (
                  <>
                    <div className="status-dot"></div>
                    <span className="status-label">Connected</span>
                  </>
                ) : wsStatus === 'connecting' ? (
                  <>
                    <Loader className="status-icon spinning" />
                    <span className="status-label">Connecting</span>
                  </>
                ) : (
                  <>
                    <div className="status-dot"></div>
                    <span className="status-label">Disconnected</span>
                  </>
                )}
              </div>
            </div>

            {/* Bottom accent */}
            <div className={`accent-bar accent-${wsStatus}`}></div>
          </div>
        </div>
      )}
    </header>
  );
};

export default AppHeader;
