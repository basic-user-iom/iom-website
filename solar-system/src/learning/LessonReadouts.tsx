import { useId } from 'react';
import { moonPhaseOutline, type LessonMeasurements } from './LessonMeasurements';

export function SeasonReadout({ measurements, distanceAu }: {
  readonly measurements: LessonMeasurements | null;
  readonly distanceAu: number | null;
}) {
  const clipId = useId();
  if (!measurements) return <p role="status">Sunlight measurements are unavailable without orbital data. In June, days at 45°N are longer than at 45°S; in December this reverses. Near an equinox they are similar.</p>;
  const tilt = measurements.solarDeclinationDeg;
  return <section className="lesson-readout" aria-label="Hemispheric sunlight" data-testid="season-readout">
    <svg className="lesson-diagram" viewBox="0 0 280 160" role="img" aria-label={`Sun–Earth-axis cross-section. Solar declination ${tilt.toFixed(1)} degrees; sunlight comes from the right.`}>
      <defs><clipPath id={clipId}><circle cx="108" cy="80" r="47" /></clipPath></defs>
      <circle cx="108" cy="80" r="47" fill="#132f4c" stroke="#7dbad2" />
      <rect x="108" y="33" width="47" height="94" fill="#75adca" clipPath={`url(#${clipId})`} />
      <g transform={`rotate(${tilt.toFixed(2)} 108 80)`}>
        <path d="M108 17 V143" stroke="#f3dc9a" strokeWidth="2" />
        <path d="M61 80 H155" stroke="#9ed7e5" strokeDasharray="4 3" />
        <text x="102" y="12">N</text><text x="102" y="157">S</text>
      </g>
      <path d="M243 58 H177 M243 80 H177 M243 102 H177 M184 53 L177 58 L184 63 M184 75 L177 80 L184 85 M184 97 L177 102 L184 107" stroke="#f2ce7c" fill="none" />
      <text x="174" y="40">Sunlight</text>
    </svg>
    <p className="lesson-caption">Illustrative Sun–Earth-axis cross-section, not to scale. Its projection changes through the year; Earth’s axial tilt is not being changed.</p>
    <dl className="lesson-measurements">
      <div><dt>Sun directly overhead at</dt><dd data-testid="solar-declination">{Math.abs(tilt).toFixed(1)}° {tilt >= 0 ? 'N' : 'S'}</dd></div>
      <div><dt>Sun–Earth distance</dt><dd>{distanceAu?.toFixed(3) ?? 'Unavailable'} AU</dd></div>
    </dl>
    {([['45° north', measurements.northDaylightHours], ['45° south', measurements.southDaylightHours]] as const).map(([label, hours]) => <div className="daylight-row" key={label}>
      <span>{label}: <strong>{hours.toFixed(1)} h daylight</strong></span>
      <meter min="0" max="24" value={hours} aria-label={`Geometric daylight at ${label}`} />
    </div>)}
    <p className="lesson-caption">Calculated from the existing Earth orientation and JPL vectors. Geometric horizon only; no refraction, terrain or solar-disc correction.</p>
  </section>;
}

export function MoonReadout({ measurements }: { readonly measurements: LessonMeasurements | null }) {
  if (!measurements) return <p role="status">Phase measurements are unavailable without orbital data. Near new Moon we see little of its sunlit half; near full Moon we see nearly all of it. At either quarter we see about half the disc lit.</p>;
  const percent = (measurements.moonIlluminatedFraction * 100).toFixed(1);
  return <section className="lesson-readout" aria-label="Moon from Earth" data-testid="moon-readout">
    <svg className="lesson-diagram moon-phase-disc" viewBox="0 0 140 112" role="img" aria-label={`Geocentric Moon illustration, ${percent} percent illuminated, ${measurements.waxing ? 'waxing' : 'waning'}.`}>
      <g transform="translate(70 54)">
        <circle r="42" fill="#182b3e" stroke="#7899ad" />
        <path d={moonPhaseOutline(measurements.moonIlluminatedFraction, measurements.waxing)} fill="#d8e4ea" />
      </g>
    </svg>
    <dl className="lesson-measurements">
      <div><dt>Disc facing Earth’s centre</dt><dd data-testid="moon-illuminated">{percent}% lit · {measurements.waxing ? 'waxing' : 'waning'}</dd></div>
      <div><dt>Moon–Sun angle in Earth’s sky</dt><dd>{measurements.moonElongationDeg.toFixed(1)}°</dd></div>
      <div><dt>Moon’s J2000 ecliptic latitude</dt><dd>{measurements.moonEclipticLatitudeDeg.toFixed(1)}°</dd></div>
    </dl>
    <p className="lesson-caption">Calculated geocentric lit fraction; a schematic disc with waxing on the right and waning on the left. Not the orientation above your local horizon. No eclipse shadow, terrain, libration or light-time correction.</p>
  </section>;
}

export function EclipseGeometry() {
  return <figure className="lesson-readout eclipse-diagram">
    <svg className="lesson-diagram" viewBox="0 0 300 190" role="img" aria-label="Illustrative alignments: solar eclipse, Sun then Moon then Earth; lunar eclipse, Sun then Earth then Moon. Not to scale or tied to a date.">
      <text x="12" y="16">Solar eclipse alignment</text>
      <circle cx="33" cy="55" r="17" fill="#f1ca6b" /><circle cx="143" cy="55" r="8" fill="#ced8de" /><circle cx="257" cy="55" r="16" fill="#70aaca" />
      <path d="M151 49 L257 55 L151 61 Z" fill="#425b73" /><path d="M50 55 H133" stroke="#f1ca6b" />
      <text x="20" y="89">Sun</text><text x="124" y="89">Moon</text><text x="241" y="89">Earth</text>
      <text x="12" y="113">Lunar eclipse alignment</text>
      <circle cx="33" cy="146" r="17" fill="#f1ca6b" /><circle cx="143" cy="146" r="16" fill="#70aaca" />
      <path d="M159 131 L283 140 L283 152 L159 161 Z" fill="#425b73" /><circle cx="257" cy="146" r="8" fill="#b2958e" />
      <path d="M50 146 H127" stroke="#f1ca6b" />
      <text x="20" y="183">Sun</text><text x="127" y="183">Earth</text><text x="238" y="183">Moon</text>
    </svg>
    <figcaption>Illustrative alignment only. Sizes, gaps and shadow shapes are exaggerated. No prediction for the displayed date: the real Moon usually misses this line because its orbit is inclined.</figcaption>
  </figure>;
}
