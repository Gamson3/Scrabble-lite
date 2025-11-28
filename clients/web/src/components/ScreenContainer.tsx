import React from 'react';
import './ScreenContainer.css';

interface ScreenContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Unified screen container for consistent layout across all game screens.
 * - Centers content on screen
 * - Provides consistent max-width and padding
 * - Works for Auth, Lobby, Waiting, and Game screens
 */
const ScreenContainer: React.FC<ScreenContainerProps> = ({ children, className = '' }) => {
  return (
    <div className={`screen-container ${className}`}>
      {children}
    </div>
  );
};

export default ScreenContainer;
