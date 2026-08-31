import { OBSERVATORY_SHORTCUT_DEFINITIONS } from '../../input/ObservatoryShortcuts';
import type { MotionPreference } from '../../state/AppPreferences';
import { ObservatoryDialog } from './ObservatoryDialog';

export interface HelpOverlayProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly motionPreference: MotionPreference;
  readonly onMotionPreferenceChange: (preference: MotionPreference) => void;
  readonly reduceFlashes: boolean;
  readonly onReduceFlashesChange: (reduce: boolean) => void;
  readonly onResetPreferences: () => void;
  readonly resetPreferencesDisabled: boolean;
}

export function HelpOverlay({
  open,
  onClose,
  motionPreference,
  onMotionPreferenceChange,
  reduceFlashes,
  onReduceFlashesChange,
  onResetPreferences,
  resetPreferencesDisabled,
}: HelpOverlayProps) {
  return (
    <ObservatoryDialog
      open={open}
      title="Observatory controls"
      description="Keyboard commands work outside form fields and modal overlays."
      onClose={onClose}
      className="help-overlay"
      testId="help-overlay"
    >
      <section aria-labelledby="keyboard-shortcuts-heading">
        <h3 id="keyboard-shortcuts-heading">Keyboard shortcuts</h3>
        <ul className="shortcut-list">
          {OBSERVATORY_SHORTCUT_DEFINITIONS.map((shortcut) => (
            <li key={shortcut.label}>
              <span className="shortcut-keys" aria-label={shortcut.keys.join(' or ')}>
                {shortcut.keys.map((key) => (
                  <kbd key={key} aria-hidden="true">
                    {key}
                  </kbd>
                ))}
              </span>
              <span>
                <strong>{shortcut.label}</strong>
                <small>{shortcut.description}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="pointer-controls-heading">
        <h3 id="pointer-controls-heading">Pointer controls</h3>
        <p>In free-orbit mode, drag to rotate, use the wheel to dolly, and right-drag to pan.</p>
      </section>
      <section aria-labelledby="scientific-terms-heading">
        <h3 id="scientific-terms-heading">Scientific terms</h3>
        <dl className="science-glossary">
          <div>
            <dt><abbr title="Barycentric Dynamical Time">TDB</abbr></dt>
            <dd>The uniform time field used by the bundled Horizons ephemeris samples.</dd>
          </div>
          <div>
            <dt><abbr title="International Celestial Reference Frame">ICRF</abbr> / ECLIPJ2000</dt>
            <dd>The declared inertial reference system and ecliptic plane for stored vectors.</dd>
          </div>
          <div>
            <dt>Hermite interpolation</dt>
            <dd>A curve reconstructed from adjacent authoritative positions and velocities.</dd>
          </div>
          <div>
            <dt>Presentation scale</dt>
            <dd>Orbital positions stay linear while body radii are deliberately exaggerated.</dd>
          </div>
          <div>
            <dt>Statistical visualization</dt>
            <dd>Context particles represent a population, not one-to-one cataloged objects.</dd>
          </div>
        </dl>
      </section>
      <section aria-labelledby="accessibility-preferences-heading">
        <h3 id="accessibility-preferences-heading">Accessibility preferences</h3>
        <fieldset className="motion-preference-controls">
          <legend>Motion</legend>
          <label>
            <input
              type="radio"
              name="motion-preference"
              value="system"
              checked={motionPreference === 'system'}
              onChange={() => onMotionPreferenceChange('system')}
            />
            Follow system preference
          </label>
          <label>
            <input
              type="radio"
              name="motion-preference"
              value="reduce"
              checked={motionPreference === 'reduce'}
              onChange={() => onMotionPreferenceChange('reduce')}
            />
            Reduce motion
          </label>
          <label>
            <input
              type="radio"
              name="motion-preference"
              value="full"
              checked={motionPreference === 'full'}
              onChange={() => onMotionPreferenceChange('full')}
            />
            Allow full motion
          </label>
        </fieldset>
        <label className="reduce-flashes-control">
          <input
            type="checkbox"
            checked={reduceFlashes}
            onChange={(event) => onReduceFlashesChange(event.currentTarget.checked)}
          />
          Reduce flashes and abrupt exposure changes
        </label>
        <button
          className="button button-secondary"
          type="button"
          onClick={onResetPreferences}
          disabled={resetPreferencesDisabled}
        >
          Reset saved preferences
        </button>
        {resetPreferencesDisabled ? (
          <small>Preference reset is unavailable until the active scenario is reset.</small>
        ) : null}
      </section>
    </ObservatoryDialog>
  );
}
