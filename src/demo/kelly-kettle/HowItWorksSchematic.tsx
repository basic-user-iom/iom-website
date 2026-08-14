import { useState } from 'react'
import { IntroPicture } from './IntroPicture'

type StepId = 'air' | 'fire' | 'heat' | 'water'

const STEPS: { id: StepId; num: string; title: string; body: string }[] = [
  {
    id: 'air',
    num: '01',
    title: 'Cool air enters',
    body: 'Fresh air is drawn through the single circular opening in the fire base.',
  },
  {
    id: 'fire',
    num: '02',
    title: 'Fire heats the chimney',
    body: 'A small fire burns directly beneath the open central chimney.',
  },
  {
    id: 'heat',
    num: '03',
    title: 'Hot air rises',
    body: 'The open chimney creates a strong upward draw that carries heat through the kettle.',
  },
  {
    id: 'water',
    num: '04',
    title: 'Water surrounds the chimney',
    body: 'Water in the double-wall jacket absorbs heat along the chimney’s large surface.',
  },
]

const SHOTS: Record<StepId, 'kettle-how-air' | 'kettle-how-fire' | 'kettle-how-heat' | 'kettle-how-water'> = {
  air: 'kettle-how-air',
  fire: 'kettle-how-fire',
  heat: 'kettle-how-heat',
  water: 'kettle-how-water',
}

export function HowItWorksSchematic() {
  const [selected, setSelected] = useState<StepId | null>('air')
  const [hovered, setHovered] = useState<StepId | null>(null)
  const focus = hovered ?? selected

  return (
    <div className={focus ? `kk-how-board is-${focus}` : 'kk-how-board'}>
      <div className="kk-schematic-col">
        <figure className="kk-how-stage">
          <figcaption className="kk-sr-only">
            Cutaway of a Kelly Kettle. Cool air enters the fire-base opening, a fire heats the
            chimney, hot air rises through it, and water surrounds the chimney in the double wall.
          </figcaption>
          {STEPS.map((step) => (
            <div
              key={step.id}
              className={focus === step.id ? 'kk-how-shot is-on' : 'kk-how-shot'}
            >
              <IntroPicture
                name={SHOTS[step.id]}
                alt=""
                width={819}
                height={1024}
                sizes="(max-width: 767px) 90vw, 28rem"
                priority={step.id === 'air'}
              />
            </div>
          ))}
          <svg className="kk-how-fx" viewBox="0 0 819 1024" aria-hidden="true">
            <defs>
              <clipPath id="kk-water-clip">
                <path d="M304 318 L348 318 L346 420 L344 560 L340 710 L290 710 L292 560 L297 400 Z" />
                <path d="M468 318 L512 318 L518 500 L522 620 L523 710 L470 710 L469 620 L467 500 Z" />
              </clipPath>
              <clipPath id="kk-chimney-clip">
                <path d="M352 140 L456 140 L456 545 L454 728 L351 728 L351 545 Z" />
              </clipPath>
              <clipPath id="kk-hole-clip">
                <circle cx="402" cy="859" r="56" />
              </clipPath>
              <clipPath id="kk-air-clip">
                <rect x="130" y="790" width="230" height="140" />
              </clipPath>
              <radialGradient id="kk-ember-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffd77b" stopOpacity="0.9" />
                <stop offset="55%" stopColor="#d8662d" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#a84225" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="kk-flame-fill" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#ffb24a" stopOpacity="0.85" />
                <stop offset="55%" stopColor="#e25a22" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#e25a22" stopOpacity="0" />
              </linearGradient>
            </defs>

            <g className="kk-hl kk-hl-air" clipPath="url(#kk-air-clip)" fill="#9ec4dc">
              <circle className="kk-air-dot kk-air-dot--a" r="4.1" cx="0" cy="0" />
              <circle className="kk-air-dot kk-air-dot--b" r="3.3" cx="0" cy="0" />
              <circle className="kk-air-dot kk-air-dot--c" r="3.5" cx="0" cy="0" />
            </g>

            <g className="kk-hl kk-hl-fire" clipPath="url(#kk-hole-clip)">
              <ellipse className="ember" cx="402" cy="868" rx="40" ry="16" fill="url(#kk-ember-glow)" />
            </g>
            <g className="kk-hl kk-hl-fire" clipPath="url(#kk-chimney-clip)">
              <path
                className="kk-flame kk-flame--a"
                d="M409 728 C372 690 388 640 404 598 C396 638 424 642 426 600 C444 648 458 690 434 728 Z"
                fill="url(#kk-flame-fill)"
              />
              <path
                className="kk-flame kk-flame--b"
                d="M410 728 C392 690 408 650 418 622 C414 656 434 660 436 634 C448 668 444 702 426 728 Z"
                fill="#ffd27a"
                opacity="0.7"
              />
            </g>

            <g className="kk-hl kk-hl-heat" clipPath="url(#kk-chimney-clip)" fill="#f0b45b">
              <circle className="kk-spark kk-spark--a" r="2.5" cx="409" cy="620" />
              <circle className="kk-spark kk-spark--b" r="2.1" cx="392" cy="580" />
              <circle className="kk-spark kk-spark--c" r="2.2" cx="424" cy="560" />
            </g>

            <g className="kk-hl kk-hl-water" clipPath="url(#kk-water-clip)">
              <circle className="water-bubble kk-bubble kk-bubble--a" cx="316" cy="640" r="3.6" />
              <circle className="water-bubble kk-bubble kk-bubble--b" cx="324" cy="540" r="3" />
              <circle className="water-bubble kk-bubble kk-bubble--c" cx="310" cy="450" r="3.2" />
              <circle className="water-bubble kk-bubble kk-bubble--d" cx="322" cy="380" r="2.5" />
              <circle className="water-bubble kk-bubble kk-bubble--a" cx="494" cy="650" r="3.6" />
              <circle className="water-bubble kk-bubble kk-bubble--b" cx="504" cy="530" r="3" />
              <circle className="water-bubble kk-bubble kk-bubble--c" cx="488" cy="440" r="3.1" />
              <circle className="water-bubble kk-bubble kk-bubble--d" cx="498" cy="360" r="2.5" />
            </g>
          </svg>
        </figure>
      </div>

      <ol className="kk-how-steps" aria-label="How the kettle heats water">
        {STEPS.map((step) => {
          const on = focus === step.id
          return (
            <li key={step.id}>
              <button
                type="button"
                className={on ? 'kk-how-step is-on' : 'kk-how-step'}
                aria-pressed={selected === step.id}
                onMouseEnter={() => setHovered(step.id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(step.id)}
                onBlur={() => setHovered(null)}
                onClick={() => setSelected((current) => (current === step.id ? null : step.id))}
              >
                <span className="kk-how-step__num">{step.num}</span>
                <span className="kk-how-step__copy">
                  <span className="kk-how-step__title">{step.title}</span>
                  <span className="kk-how-step__body">{step.body}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
