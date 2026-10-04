import { ObservatoryDialog } from '../ui/observatory/ObservatoryDialog';
import { LESSONS } from './LessonCatalog';
import type { LessonId } from './LessonTypes';

export function LessonPicker({ open, onClose, onSelect }: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSelect: (id: LessonId) => void;
}) {
  return <ObservatoryDialog open={open} title="Learn the Solar System" onClose={onClose} testId="lesson-picker" className="lesson-picker" description="Short guided lessons for curious visitors, classrooms and museums. No account needed. Your previous view and time are restored when you exit a lesson.">
    <div className="lesson-choices">
      {Object.values(LESSONS).map(lesson => <button type="button" key={lesson.id} data-testid={`learn-${lesson.id}`} onClick={() => onSelect(lesson.id)}>
        <strong>{lesson.title}</strong><span>{lesson.description}</span><small>{lesson.steps.length} steps · 2 questions · text alternative available</small>
      </button>)}
    </div>
    <p>Teaching content is a review draft with sources and stated model limits, awaiting independent educational review.</p>
  </ObservatoryDialog>;
}
