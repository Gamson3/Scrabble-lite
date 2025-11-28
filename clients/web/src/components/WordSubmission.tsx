import React, { useState } from 'react';

interface WordSubmissionProps {
  onSubmit: (word: string) => void;
  isDisabled: boolean;
  placeholderText?: string;
}

export const WordSubmission: React.FC<WordSubmissionProps> = ({
  onSubmit,
  isDisabled,
  placeholderText = 'Form words from the circle...',
}) => {
  const [word, setWord] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (word.trim().length === 0) {
      return;
    }

    onSubmit(word.trim().toUpperCase());
    setWord(''); // Clear input after submission
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isDisabled && word.trim().length > 0) {
      const submitEvent = new Event('submit', { bubbles: true }) as unknown as React.FormEvent;
      handleSubmit(submitEvent);
    }
  };

  return (
    <form className="word-submission" onSubmit={handleSubmit}>
      <div className="word-input-field">
        <input
          type="text"
          className="word-input"
          value={word}
          onChange={(e) => setWord(e.target.value.toUpperCase())}
          onKeyPress={handleKeyPress}
          placeholder={placeholderText}
          disabled={isDisabled}
          maxLength={15}
          autoFocus
        />
        <button
          type="submit"
          className="submit-btn"
          disabled={isDisabled || word.trim().length === 0}
          title={isDisabled ? 'Round has ended' : 'Submit word (Enter)'}
        >
          ✓ Submit
        </button>
      </div>
    </form>
  );
};

export default WordSubmission;
