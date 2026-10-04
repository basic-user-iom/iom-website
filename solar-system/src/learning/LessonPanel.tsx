import { useEffect, useRef, useState } from 'react';
import { SIZE_COMPARISON } from './SizeLesson';
import type { LessonDefinition } from './LessonTypes';
import type { LessonMeasurements } from './LessonMeasurements';
import { EclipseGeometry, MoonReadout, SeasonReadout } from './LessonReadouts';

export function LessonPanel({ lesson, stepIndex, textOnly, dataAvailable, utc, distances, measurements, motionPaused, onMotionToggle, onStep, onRestart, onExit }: {
  readonly lesson: LessonDefinition;
  readonly stepIndex: number;
  readonly textOnly: boolean;
  readonly dataAvailable: boolean;
  readonly utc: string;
  readonly distances: Readonly<Record<string, number | null>>;
  readonly measurements: LessonMeasurements | null;
  readonly motionPaused: boolean;
  readonly onMotionToggle: () => void;
  readonly onStep: (index: number) => void;
  readonly onRestart: () => void;
  readonly onExit: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    content.current?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [stepIndex]);
  const step = lesson.steps[stepIndex]!;
  const last = stepIndex === lesson.steps.length - 1;
  const exampleUtc = !dataAvailable && step.utc ? step.utc : utc;
  const displayUtc = exampleUtc.replace('T', ' ').replace(/(?:\.\d+)?Z$/, ' UTC');
  return <section className="lesson-panel" data-testid="lesson-panel" data-lesson-id={lesson.id} aria-label={`${lesson.title} lesson`}>
    <div className="lesson-panel-heading">
      <span className="eyebrow">Learn · {lesson.title}</span><span>{stepIndex + 1} / {lesson.steps.length}</span>
      {step.utc ? <p className="lesson-date-notice">Teaching example · {displayUtc}{!dataAvailable ? ' · data unavailable' : ''}</p> : null}
    </div>
    <div className="lesson-scroll" ref={content}>
      <h2 ref={heading} tabIndex={-1} data-testid="lesson-step-title">{step.title}</h2>
      <p><strong>{textOnly ? 'Read and compare:' : 'Observe:'}</strong> {textOnly ? 'Use the explanation and measurements below for this step.' : step.action}</p>
      <p>{step.explanation}</p>
      {!textOnly && step.framingCaption ? <p className="lesson-framing-caption" data-testid="lesson-framing-caption">View: {step.framingCaption}.</p> : null}
      {step.detail === 'seasons' ? <SeasonReadout measurements={measurements} distanceAu={distances.earth ?? null} /> : null}
      {step.detail === 'moon-phase' ? <MoonReadout measurements={measurements} /> : null}
      {step.detail === 'eclipses' ? <EclipseGeometry /> : null}
      <p className="lesson-objective"><strong>Goal:</strong> {lesson.goal}</p>
      <p className="lesson-context">
        {textOnly ? 'Text alternative · 3D unavailable' : step.scale === 'true' ? 'True physical scale · location dots are not to scale' : 'Enlarged bodies · size ratios are not physical'}<br />
        {motionPaused ? 'Lesson time paused:' : 'Teaching playback · 1 day per second:'} {displayUtc}. {step.utc ? 'Date intentionally set for this teaching step.' : 'Starts from your date.'} {textOnly ? 'Previous and Next select the teaching examples.' : 'Play time advances the example.'} Exit restores your original date.
      </p>
      {lesson.id === 'sizes' && stepIndex >= 1 && stepIndex <= 3 ? <table>
        <caption>Physical mean diameters — shared units, separate camera framing</caption>
        <thead><tr><th>Body</th><th>Diameter (km)</th><th>Earth = 1</th></tr></thead>
        <tbody>{SIZE_COMPARISON.map(row => <tr key={row.id}><th>{row.name}</th><td>{Math.round(row.diameterKm).toLocaleString('en-US')}</td><td>{row.earthDiameters.toFixed(1)}</td></tr>)}</tbody>
      </table> : null}
      {lesson.id === 'sizes' && stepIndex === 5 ? <table>
        <caption>Calculated Sun–body distance at the lesson date</caption>
        <thead><tr><th>Body</th><th>Distance (AU)</th></tr></thead>
        <tbody>{['earth', 'jupiter'].map(id => <tr key={id}><th>{id === 'earth' ? 'Earth' : 'Jupiter'}</th><td>{distances[id]?.toFixed(3) ?? 'Data unavailable'}</td></tr>)}</tbody>
      </table> : null}
      {last ? lesson.questions.map((question, index) => <fieldset key={question.prompt} className="lesson-question">
        <legend>{question.prompt}</legend>
        {question.choices.map((choice, option) => <button type="button" key={choice} aria-pressed={answers[index] === option} data-testid={`lesson-answer-${index}-${option}`} onClick={() => setAnswers(current => ({ ...current, [index]: option }))}>{choice}</button>)}
        {answers[index] !== undefined ? <p role="status">{answers[index] === question.correct ? 'Correct. ' : 'Not quite. '}{question.feedback}</p> : null}
      </fieldset>) : null}
      <details className="lesson-sources">
        <summary>Sources and model limits</summary>
        <p>Review draft for astronomy educators. This lesson has not yet received independent educational validation.</p>
        <p>{lesson.limits}</p>
        <ul>{lesson.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul>
      </details>
    </div>
    <nav className="lesson-navigation" aria-label="Lesson controls">
      <button type="button" disabled={stepIndex === 0} onClick={() => onStep(stepIndex - 1)}>Previous</button>
      <button type="button" disabled={last} onClick={() => onStep(stepIndex + 1)}>Next</button>
      <button type="button" onClick={() => { setAnswers({}); onRestart(); }}>Restart</button>
      <button type="button" className="lesson-navigation-exit" onClick={onExit}>Exit lesson</button>
      {!textOnly ? <button type="button" className="lesson-motion" aria-pressed={motionPaused} onClick={onMotionToggle}>{motionPaused ? 'Play time · 1 day/s' : 'Pause time'}</button> : null}
    </nav>
  </section>;
}
