import { EPHEMERIS_BODY_DEFINITIONS } from '../simulation/bodies/EphemerisBodyCatalog';

import type { LessonStep } from './LessonTypes';
export const SIZE_LESSON_STEPS: readonly LessonStep[] = [
  { title: 'One system, two kinds of scale', action: 'Look at the system in true scale.', explanation: 'The same linear scale is used for physical body radii and positions. Planets are tiny beside the space between their orbits. The small location dots help you find them; dot sizes are not physical sizes.', scale: 'true', body: null, framing: { kind: 'orbits', extentAu: 2 }, framingCaption: 'Inner planets · viewed from above the orbital plane · distances remain linear' },
  { title: 'Start with Earth', action: 'Inspect Earth and read its mean diameter below.', explanation: 'Use Earth as your reference: one Earth diameter. This close-up moves the camera closer. A large image on your screen does not mean that Earth is large compared with the Sun.', scale: 'true', body: 'earth', framing: { kind: 'body', bodyId: 'earth' }, framingCaption: 'Separate close-up · compare the diameter table, not screen sizes' },
  { title: 'Compare Jupiter', action: 'Compare Jupiter’s diameter with Earth’s in the table.', explanation: 'Jupiter is about 11 Earth diameters across, using mean radii. Each close-up is framed separately: compare the numbers, not the width of the two images on your screen. Diameter is not volume.', scale: 'true', body: 'jupiter', framing: { kind: 'body', bodyId: 'jupiter' }, framingCaption: 'Separate close-up · compare the diameter table, not screen sizes' },
  { title: 'Now compare the Sun', action: 'Compare the Sun’s diameter with Earth’s.', explanation: 'The Sun is about 109 Earth diameters across in this catalog. Its image is reframed for inspection, just like the planets. The table uses the same units for all three bodies.', scale: 'true', body: 'sun', framing: { kind: 'body', bodyId: 'sun' }, framingCaption: 'Separate close-up · compare the diameter table, not screen sizes' },
  { title: 'Make distant planets easier to find', action: 'Inspect the enlarged presentation view.', explanation: 'Presentation mode enlarges body sizes for visibility. The enlargements are not a common physical scale: do not infer size ratios or gaps from the discs. Orbital positions remain on the same linear distance scale.', scale: 'presentation', body: null, framing: { kind: 'orbits', extentAu: 2 }, framingCaption: 'Same inner-planet frame · only body sizes are enlarged' },
  { title: 'Read the distances', action: 'Return to true scale and compare Earth’s and Jupiter’s distances.', explanation: 'One astronomical unit (AU) is about 150 million km, close to Earth’s average distance from the Sun. Jupiter’s average distance is about 5.2 AU. The values below are distances from the Sun at the displayed lesson date, not the distance between the planets; they change along the orbits.', scale: 'true', body: null, framing: { kind: 'orbits', extentAu: 6 }, framingCaption: 'Sun to Jupiter · viewed from above · distances remain linear' },
  { title: 'Check your understanding', action: 'Answer two short questions, then exit or restart.', explanation: 'A useful model must tell you which quantities share a scale. Changing camera distance, enlarging a body and changing orbital positions are three different things.', scale: 'true', body: null, framing: { kind: 'orbits', extentAu: 2 }, framingCaption: 'Inner planets · viewed from above the orbital plane · distances remain linear' },
];
export const SIZE_COMPARISON = ['earth', 'jupiter', 'sun'].map(id => {
  const body = EPHEMERIS_BODY_DEFINITIONS.find(item => item.id === id)!;
  const earth = EPHEMERIS_BODY_DEFINITIONS.find(item => item.id === 'earth')!;
  return { id, name: body.displayName, diameterKm: body.meanRadiusM * 2 / 1000, earthDiameters: body.meanRadiusM / earth.meanRadiusM };
});
export const SIZE_LESSON_QUESTIONS = [
  { prompt: 'In presentation mode, can the visible discs tell you the real size ratios?', choices: ['Yes, all bodies have the same enlargement.', 'No, body sizes are enlarged for visibility.'], correct: 1, feedback: 'Body enlargements are not uniform. Use physical diameters to compare real sizes; orbital positions still use a linear distance scale.' },
  { prompt: 'If Earth is 1 cm across in a physical scale model, how wide is Jupiter?', choices: ['About 11 cm.', 'About 5.2 cm.', 'About 109 cm.'], correct: 0, feedback: 'Jupiter is about 11 Earth diameters across. 5.2 refers to its average solar distance in AU; about 109 Earth diameters describes the Sun.' },
] as const;
export const LESSON_SOURCES = [
  { title: 'NASA/JPL — Make a Scale Solar System', url: 'https://www.jpl.nasa.gov/edu/resources/project/make-a-scale-solar-system/' },
  { title: 'NASA — Solar System Sizes', url: 'https://science.nasa.gov/resource/solar-system-sizes/' },
  { title: 'NASA — Jupiter Facts', url: 'https://science.nasa.gov/jupiter/jupiter-facts/' },
];
