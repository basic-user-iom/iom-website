import { LESSON_SOURCES, SIZE_LESSON_QUESTIONS, SIZE_LESSON_STEPS } from './SizeLesson';
import type { LessonDefinition, LessonId } from './LessonTypes';

const seasons: LessonDefinition = {
  id: 'seasons', title: 'Why we have seasons',
  goal: 'Explain how axial tilt changes sunlight in opposite hemispheres during the year.',
  description: 'Compare June, December and March sunlight, then test the distance explanation.',
  steps: [
    { title: 'A tilted axis', body: 'earth', scale: 'true', framing: { kind: 'seasons' }, framingCaption: 'Earth from the side of the Sun–Earth line · both day and night visible', utc: '2026-06-21T12:00:00Z', detail: 'seasons',
      action: 'Compare the daylight hours at 45° north and 45° south.',
      explanation: 'Earth’s axis is tilted about 23.4° from the perpendicular to its orbital plane. In this June example the north leans toward the Sun: sunlight is more direct and days are longer there. The south has shorter days. The diagram separates this seasonal effect from Earth’s daily rotation.' },
    { title: 'Six months later', body: 'earth', scale: 'true', framing: { kind: 'seasons' }, framingCaption: 'Earth from the side of the Sun–Earth line · both day and night visible', utc: '2026-12-21T12:00:00Z', detail: 'seasons',
      action: 'Check which hemisphere now has the longer day.',
      explanation: 'The axial tilt has not been changed. Earth has moved around the Sun, so the south now receives more direct sunlight and longer days. Northern winter and southern summer happen together. We use the same two latitudes to make the comparison fair.' },
    { title: 'Near an equinox', body: 'earth', scale: 'true', framing: { kind: 'seasons' }, framingCaption: 'Earth from the side of the Sun–Earth line · both day and night visible', utc: '2026-03-20T12:00:00Z', detail: 'seasons',
      action: 'Compare the two daylight bars near the March equinox.',
      explanation: 'Neither hemisphere leans strongly toward the Sun. Geometric daylight is close to 12 hours in both. Real sunrise-to-sunset intervals differ because of atmospheric refraction and the Sun’s apparent size. This is an example near an equinox, not a calculation of its exact instant.' },
    { title: 'Test the distance explanation', body: 'earth', scale: 'true', framing: { kind: 'seasons' }, framingCaption: 'Earth from the side of the Sun–Earth line · both day and night visible', utc: '2026-01-03T12:00:00Z', detail: 'seasons',
      action: 'Read the Sun–Earth distance and northern daylight together.',
      explanation: 'Earth is near its closest annual approach to the Sun in early January, yet it is northern winter. Both hemispheres share the same solar distance but have opposite seasons. Axial tilt, daylight duration and sunlight angle explain that contrast; distance alone does not.' },
    { title: 'Check your understanding', body: 'earth', scale: 'true', framing: { kind: 'seasons' }, framingCaption: 'Earth from the side of the Sun–Earth line · both day and night visible', utc: '2026-06-21T12:00:00Z',
      action: 'Answer two questions about the hemispheres.',
      explanation: 'Keep Earth’s fixed axial tilt, its changing orbital position and its daily rotation separate in your explanation.' },
  ],
  questions: [
    { prompt: 'When the north has longer days in June, what happens in the south?', choices: ['It also has longer days because Earth is closer to the Sun.', 'It has shorter days because it tilts away from the Sun.'], correct: 1, feedback: 'The hemispheres tilt in opposite directions relative to the sunlight. They share the same Earth–Sun distance.' },
    { prompt: 'What best explains northern summer and southern winter at the same time?', choices: ['Earth’s axial tilt changes sunlight angle and day length.', 'Earth’s daily rotation stops in one hemisphere.'], correct: 0, feedback: 'Tilt and orbital position produce the seasonal contrast. Rotation continues and gives both hemispheres day and night.' },
  ],
  sources: [
    { title: 'NASA — What Causes the Seasons?', url: 'https://spaceplace.nasa.gov/seasons/en/' },
    { title: 'NASA — Earth Facts: orbit and rotation', url: 'https://science.nasa.gov/earth/facts/' },
    { title: 'USNO — Length of Day and Night at the Equinoxes', url: 'https://aa.usno.navy.mil/faq/equinoxes' },
  ],
  limits: 'Teaching dates are approximate seasonal examples in 2026. Solar declination uses the existing UTC-anchored Earth rotation and JPL vectors. Daylight at ±45° uses a spherical Earth, a point Sun on the geometric horizon and fixed declination during a day; terrain, refraction, solar radius and weather are omitted. The axis model is unchanged. The small diagram is a Sun–Earth-axis cross-section, not an orbit map.',
};

const moon: LessonDefinition = {
  id: 'moon', title: 'Earth, Moon and Sun',
  goal: 'Connect lunar phases to the viewing geometry and explain why eclipses do not happen every month.',
  description: 'Compare the view from space with the Moon’s lit fraction seen from Earth.',
  steps: [
    { title: 'Two different viewpoints', body: 'earth', camera: 'earth-moon-system', scale: 'true', framing: { kind: 'moon-system' }, framingCaption: 'Earth–Moon from above · sunlight from the right · physical sizes and distance', utc: '2026-01-26T12:00:00Z', detail: 'moon-phase',
      action: 'Compare the space view with the small Moon disc below.',
      explanation: 'The main view frames Earth and the Moon from space. The small disc illustrates the lit fraction facing Earth’s centre, around first quarter in this example. A changing phase means we see different amounts of the Moon’s sunlit half; it is not Earth’s shadow moving across the Moon.' },
    { title: 'Near new Moon', body: 'earth', camera: 'earth-moon-system', scale: 'true', framing: { kind: 'moon-system' }, framingCaption: 'Earth–Moon from above · sunlight from the right · physical sizes and distance', utc: '2026-01-18T12:00:00Z', detail: 'moon-phase',
      action: 'Read the lit fraction and the Moon–Sun angle seen from Earth.',
      explanation: 'The Moon lies in nearly the Sun’s direction. Most of its illuminated hemisphere faces away from Earth. New Moon does not normally cover the Sun: the Moon usually passes above or below it.' },
    { title: 'Near full Moon', body: 'earth', camera: 'earth-moon-system', scale: 'true', framing: { kind: 'moon-system' }, framingCaption: 'Earth–Moon from above · sunlight from the right · physical sizes and distance', utc: '2026-02-01T12:00:00Z', detail: 'moon-phase',
      action: 'Compare this lit fraction with the new-Moon step.',
      explanation: 'The Moon is now almost opposite the Sun in Earth’s sky, and we see nearly all its illuminated face. Its distance from Earth alone does not determine its phase.' },
    { title: 'The waning half', body: 'earth', camera: 'earth-moon-system', scale: 'true', framing: { kind: 'moon-system' }, framingCaption: 'Earth–Moon from above · sunlight from the right · physical sizes and distance', utc: '2026-02-09T12:00:00Z', detail: 'moon-phase',
      action: 'Compare the lit side with the first-quarter example.',
      explanation: 'Around last quarter the illuminated fraction is decreasing. The disc uses a fixed teaching convention: waxing light on the right, waning light on the left. Its rotation in a real sky depends on the observer and time; it is not a local horizon view.' },
    { title: 'Why not an eclipse every month?', body: 'earth', camera: 'earth-moon-system', scale: 'true', framing: { kind: 'moon-system' }, framingCaption: 'Earth–Moon from above · sunlight from the right · physical sizes and distance', utc: '2026-01-18T12:00:00Z', detail: 'eclipses',
      action: 'Compare the two alignments in the diagram.',
      explanation: 'A solar eclipse needs the Moon between Sun and Earth; a lunar eclipse needs Earth’s shadow to reach a full Moon. The Moon’s orbital plane is inclined by about 5° to Earth’s orbital plane. Most months the alignment misses above or below; an eclipse requires the right phase near a crossing of the planes, called a node. The diagram is illustrative, not an eclipse forecast for the displayed date.' },
    { title: 'Check your understanding', body: 'earth', camera: 'earth-moon-system', scale: 'true', framing: { kind: 'moon-system' }, framingCaption: 'Earth–Moon from above · sunlight from the right · physical sizes and distance', utc: '2026-01-26T12:00:00Z',
      action: 'Answer two questions about phases and eclipses.',
      explanation: 'Use the observer’s position to describe a phase, and require three-dimensional alignment to explain an eclipse.' },
  ],
  questions: [
    { prompt: 'What causes ordinary lunar phases?', choices: ['Earth’s shadow covers different parts of the Moon every week.', 'We see different portions of the Moon’s sunlit half.'], correct: 1, feedback: 'The Sun lights roughly half the Moon. Our viewing geometry changes; Earth’s shadow matters during a lunar eclipse.' },
    { prompt: 'Why is there no solar eclipse at every new Moon?', choices: ['The inclined lunar orbit usually carries the Moon above or below the Sun.', 'The Moon stops reflecting sunlight once a month.'], correct: 0, feedback: 'The phase must coincide with suitable alignment near an orbital node. Phase alone is insufficient.' },
  ],
  sources: [
    { title: 'NASA — Moon Phases', url: 'https://science.nasa.gov/moon/moon-phases/' },
    { title: 'NASA — Eclipses and the Moon', url: 'https://science.nasa.gov/moon/eclipses/' },
    { title: 'USNO — Phases and Percent Illuminated', url: 'https://aa.usno.navy.mil/faq/moon_phases' },
  ],
  limits: 'The main view uses the existing Earth–Moon camera and JPL positions at the marked teaching dates. Lit fraction and elongation are instantaneous geocentric geometry, without light-time, observer parallax, atmospheric refraction or eclipse shadows. The disc has no lunar terrain or libration and uses a fixed orientation. The eclipse diagram exaggerates sizes and gaps; it is not computed eclipse visibility, timing or a viewing map.',
};

export const LESSONS: Readonly<Record<LessonId, LessonDefinition>> = {
  sizes: { id: 'sizes', title: 'Sizes and distances', goal: 'Distinguish physical sizes and distances from changes made to help you see them.', description: 'Compare Earth, Jupiter and the Sun, then explore true and enlarged scale.', steps: SIZE_LESSON_STEPS, questions: SIZE_LESSON_QUESTIONS, sources: LESSON_SOURCES, limits: 'Physical sizes use the existing catalog’s mean radii; date-specific distances use the bundled JPL Horizons vectors. Location dots are not physical sizes, and camera close-ups are framed separately.' },
  seasons, moon,
};
