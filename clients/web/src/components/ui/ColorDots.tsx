import type { ColorFeedback } from '../../types';

export default function ColorDots({ feedback }: { feedback: ColorFeedback[] }) {
  return (
    <div className="dots">
      {feedback.map((color, index) => (
        <span key={`${color}-${index}`} className={`dot dot-${color}`} />
      ))}
    </div>
  );
}
