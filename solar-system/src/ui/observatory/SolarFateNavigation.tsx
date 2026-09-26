import { useId } from 'react';
import type { SolarFateCameraView } from '../../rendering/solar-fate/SolarFateCamera';

const EVOLUTION_STAGES = [
  ['present', 'Today', 'The present-day Sun, before its late evolution.'],
  ['red-giant', 'Red giant', 'The envelope expands as the surface cools.'],
  ['inner-system-heating', 'Inner planets', 'The enlarged Sun heats the inner system; Earth\u2019s fate is uncertain.'],
  ['mass-loss-nebular', 'Ejected layers', 'Outer layers drift outward and reveal the hot core.'],
  ['white-dwarf', 'White dwarf', 'The view moves from the nebula toward the small exposed core.'],
  ['cooling-remnant', 'Cooling', 'The compact remnant gradually cools.'],
] as const;
const FICTIONAL_STAGES = [
  ['surface-pulse', 'Build-up', 'A fictional surface pulse precedes the flash.'],
  ['core-flash', 'Flash', 'Reduced flashes remains available throughout playback.'],
  ['shock-breakout', 'Shock', 'An expanding cinematic shock shell.'],
  ['radiation-front', 'Radiation', 'A visually compressed radiation front.'],
  ['debris-nebula', 'Debris', 'The camera pulls back to show the expanding debris.'],
  ['fictional-remnant', 'Remnant', 'An invented compact remnant; this cannot happen to the Sun.'],
] as const;

interface Props {
  readonly fictional: boolean;
  readonly stageId: string;
  readonly disabled: boolean;
  readonly cameraView: SolarFateCameraView;
  readonly onSelectStage: (stage: string) => void;
  readonly onCameraViewChange: (view: SolarFateCameraView) => void;
}

export function SolarFateNavigation({ fictional, stageId, disabled, cameraView, onSelectStage, onCameraViewChange }: Props) {
  const id = useId();
  const stages = fictional ? FICTIONAL_STAGES : EVOLUTION_STAGES;
  const current = stages.find(([stage]) => stage === stageId);
  return (
    <div className="solar-fate-navigation">
      <p className="eyebrow">Explore the sequence</p>
      <nav className="solar-fate-stages" aria-label="Solar Fate phases">
        {stages.map(([stage, label], index) => (
          <button type="button" key={stage} disabled={disabled}
            aria-current={stage === stageId ? 'step' : undefined}
            data-testid={'solar-fate-stage-' + stage}
            onClick={() => onSelectStage(stage)}>
            <span aria-hidden="true">{index + 1}</span>{label}
          </button>
        ))}
      </nav>
      <p className="solar-fate-stage-description">{current?.[2]}</p>
      <label htmlFor={id}>Event camera</label>
      <select id={id} data-testid="solar-fate-camera" value={cameraView} disabled={disabled}
        onChange={(event) => onCameraViewChange(event.currentTarget.value as SolarFateCameraView)}>
        <option value="auto">Automatic framing</option>
        <option value="wide">Entire nebula / expanding shells</option>
        <option value="star">Star close-up</option>
      </select>
      <p className="control-hint">Camera distance changes; physical sizes stay unchanged.</p>
    </div>
  );
}
