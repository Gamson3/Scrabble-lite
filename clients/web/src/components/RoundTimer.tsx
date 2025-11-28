import React, { useEffect, useState } from 'react';

interface RoundTimerProps {
  initialSeconds: number; // Usually 60
  isActive: boolean;
  onTimeUp: () => void;
}

export const RoundTimer: React.FC<RoundTimerProps> = ({
  initialSeconds,
  isActive,
  onTimeUp,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, onTimeUp]);

  // Reset when initialSeconds changes (new round)
  useEffect(() => {
    setSecondsRemaining(initialSeconds);
  }, [initialSeconds]);

  const isLowTime = secondsRemaining < 10;
  const isWarningTime = secondsRemaining < 5;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const displayTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div
      className={`round-timer ${isLowTime ? 'low-time' : ''} ${
        isWarningTime ? 'warning-time' : ''
      }`}
    >
      <div className="timer-display">{displayTime}</div>
      <div className="timer-bar">
        <div
          className="timer-progress"
          style={{
            width: `${(secondsRemaining / initialSeconds) * 100}%`,
          }}
        />
      </div>
    </div>
  );
};

export default RoundTimer;
