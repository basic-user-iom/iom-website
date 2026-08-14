import { useState } from 'react'

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

export function HowItWorksSchematic() {
  const [selected, setSelected] = useState<StepId | null>(null)
  const [hovered, setHovered] = useState<StepId | null>(null)
  const focus = hovered ?? selected

  return (
    <div className={focus ? `kk-how-board is-${focus}` : 'kk-how-board'}>
      <div className="kk-schematic-col">
        <svg
          className="kk-schematic"
          viewBox="0 0 400 640"
          role="img"
          aria-labelledby="kk-schematic-title kk-schematic-desc"
        >
          <title id="kk-schematic-title">How the Kelly Kettle works</title>
          <desc id="kk-schematic-desc">
            Cutaway of a Kelly Kettle. Cool air enters a single circular opening in the separate fire
            base. A small fire burns beneath the open central chimney. Heat rises through that
            chimney. Water fills the double-wall jacket around it. A green whistle sits on the angled
            spout.
          </desc>

          <defs>
            <linearGradient id="kk-hw-steel" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8e969e" />
              <stop offset="42%" stopColor="#d5dbe0" />
              <stop offset="100%" stopColor="#9aa3ab" />
            </linearGradient>
            <linearGradient id="kk-hw-steel-v" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cfd6dc" />
              <stop offset="55%" stopColor="#b4bcc3" />
              <stop offset="100%" stopColor="#8f979e" />
            </linearGradient>
            <linearGradient id="kk-hw-water" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(130, 176, 196, 0.34)" />
              <stop offset="48%" stopColor="rgba(168, 208, 222, 0.55)" />
              <stop offset="100%" stopColor="rgba(130, 176, 196, 0.34)" />
            </linearGradient>
            <linearGradient id="kk-hw-heat" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#c45a28" stopOpacity="0.92" />
              <stop offset="38%" stopColor="#e3943a" stopOpacity="0.58" />
              <stop offset="72%" stopColor="#f3d48a" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#f3efe6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="kk-hw-base" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c5ccd2" />
              <stop offset="100%" stopColor="#8a9299" />
            </linearGradient>
            <clipPath id="kk-hw-chimney">
              <path d="M176 72 C176 64 192 60 200 60 C208 60 224 64 224 72 L238 502 C238 508 208 512 200 512 C192 512 162 508 162 502 Z" />
            </clipPath>
            <clipPath id="kk-hw-water">
              <path d="M148 132 C136 168 120 208 112 248 C106 320 106 390 110 444 L160 444 L164 148 L168 132 Z" />
              <path d="M252 132 L232 132 L236 148 L240 444 L290 444 C294 390 294 320 288 248 C280 208 264 168 252 132 Z" />
            </clipPath>
            <marker id="kk-hw-air-head" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0 0 L7 3.5 L0 7 Z" fill="#6d8aa8" />
            </marker>
            <marker id="kk-hw-heat-head" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0 0 L6 3 L0 6 Z" fill="#c45a28" />
            </marker>
          </defs>

          <ellipse cx="200" cy="618" rx="108" ry="10" fill="rgba(44,42,38,0.08)" />

          {/* Fire base — cylindrical cup with flared rim */}
          <g className="kk-hw-base">
            <path
              d="M86 478
                 C84 470 316 470 314 478
                 L304 498
                 C302 506 300 560 300 568
                 C300 586 250 598 200 598
                 C150 598 100 586 100 568
                 C100 560 98 506 96 498 Z"
              fill="url(#kk-hw-base)"
              stroke="#4a4f54"
              strokeWidth="1.6"
            />
            <path
              d="M96 498 C110 490 290 490 304 498 L314 478 C300 472 100 472 86 478 Z"
              fill="#d8dde2"
              stroke="#4a4f54"
              strokeWidth="1.3"
            />
            <ellipse cx="200" cy="478" rx="108" ry="9" fill="none" stroke="#4a4f54" strokeWidth="1.4" />
            <ellipse cx="200" cy="478" rx="96" ry="7" fill="#b7bec4" opacity="0.55" />
          </g>

          {/* Kettle sits in the flared rim — thin uniform seam */}
          <path
            d="M104 458 C108 450 292 450 296 458 L292 468 C288 474 112 474 108 468 Z"
            fill="url(#kk-hw-steel-v)"
            stroke="#4a4f54"
            strokeWidth="1.5"
          />
          <path d="M110 462 C140 456 260 456 290 462" fill="none" stroke="#3f454a" strokeWidth="1.2" />

          {/* Outer kettle silhouette */}
          <path
            d="M164 68
               C174 52 226 52 236 68
               C244 86 250 108 272 150
               C294 178 318 198 320 226
               L314 428
               C312 446 302 456 288 458
               L128 458
               C114 456 104 446 102 428
               L96 226
               C98 198 122 178 144 150
               C166 108 156 86 164 68 Z"
            fill="url(#kk-hw-steel)"
            stroke="#4a4f54"
            strokeWidth="1.65"
          />

          {/* Water jacket — both sides, following the shoulder */}
          <g className="kk-hl kk-hl-water">
            <path
              d="M148 132
                 C136 168 120 208 112 248
                 C106 320 106 390 110 444
                 L160 444
                 L164 148
                 L168 132 Z"
              fill="url(#kk-hw-water)"
              stroke="#6a8a9a"
              strokeWidth="1.05"
            />
            <path
              d="M252 132
                 L232 132
                 L236 148
                 L240 444
                 L290 444
                 C294 390 294 320 288 248
                 C280 208 264 168 252 132 Z"
              fill="url(#kk-hw-water)"
              stroke="#6a8a9a"
              strokeWidth="1.05"
            />
            <path d="M148 132 L168 132" fill="none" stroke="#7a9bb0" strokeWidth="1.5" opacity="0.75" />
            <path d="M232 132 L252 132" fill="none" stroke="#7a9bb0" strokeWidth="1.5" opacity="0.75" />
            <g clipPath="url(#kk-hw-water)">
              <circle className="water-bubble kk-bubble kk-bubble--a" cx="136" cy="320" r="3.1" fill="rgba(255,255,255,0.55)" />
              <circle className="water-bubble kk-bubble kk-bubble--b" cx="264" cy="280" r="2.4" fill="rgba(255,255,255,0.48)" />
              <circle className="water-bubble kk-bubble kk-bubble--c" cx="142" cy="390" r="2.7" fill="rgba(255,255,255,0.5)" />
            </g>
          </g>

          {/* Inner heat-transfer walls */}
          <g className="kk-hw-chimney-walls">
            <path
              d="M168 68 C168 62 176 60 180 66 L166 448 C162 454 154 452 154 444 L168 68 Z"
              fill="url(#kk-hw-steel)"
              stroke="#4a4f54"
              strokeWidth="1.2"
            />
            <path
              d="M232 68 C232 62 224 60 220 66 L234 448 C238 454 246 452 246 444 L232 68 Z"
              fill="url(#kk-hw-steel)"
              stroke="#4a4f54"
              strokeWidth="1.2"
            />
          </g>

          {/* Hollow chimney — charcoal passage always visible */}
          <path
            d="M176 72 C176 64 192 60 200 60 C208 60 224 64 224 72 L238 502 C238 508 208 512 200 512 C192 512 162 508 162 502 Z"
            fill="#2a2622"
          />
          <g className="kk-hl kk-hl-heat">
            <g clipPath="url(#kk-hw-chimney)">
              <rect className="heat-flow" x="160" y="40" width="80" height="490" fill="url(#kk-hw-heat)" />
            </g>
            <g
              className="kk-hw-heat-arrows"
              fill="none"
              stroke="#c45a28"
              strokeWidth="1.7"
              strokeLinecap="round"
              opacity="0.85"
            >
              <path d="M200 430 L200 250" markerEnd="url(#kk-hw-heat-head)" />
              <path d="M188 400 L188 290" markerEnd="url(#kk-hw-heat-head)" />
              <path d="M212 400 L212 290" markerEnd="url(#kk-hw-heat-head)" />
            </g>
          </g>

          {/* Top opening + rolled lip */}
          <g>
            <ellipse cx="200" cy="64" rx="36" ry="11" fill="#1a1614" stroke="#4a4f54" strokeWidth="2.1" />
            <ellipse cx="200" cy="62" rx="28" ry="7" fill="#2c2723" />
            <ellipse cx="200" cy="61" rx="36" ry="11" fill="none" stroke="#c5ccd2" strokeWidth="1.1" opacity="0.7" />
          </g>

          {/* Spout + whistle */}
          <path
            d="M300 176 C328 160 352 150 372 146 L376 164 C356 168 332 180 308 196 Z"
            fill="url(#kk-hw-steel)"
            stroke="#4a4f54"
            strokeWidth="1.5"
          />
          <g className="kk-hw-whistle">
            <ellipse cx="384" cy="152" rx="16" ry="12" fill="#3d6b45" stroke="#2f4a36" strokeWidth="1.2" />
            <ellipse cx="384" cy="148" rx="10" ry="5.5" fill="#4a7d52" />
            <circle cx="384" cy="147" r="2.2" fill="#1e2e22" />
          </g>

          {/* Fire, wood, embers — inside the base, under the chimney */}
          <g className="kk-hl kk-hl-fire">
            <ellipse cx="200" cy="528" rx="42" ry="10" fill="#c45a28" opacity="0.28" />
            <g className="ember">
              <ellipse cx="188" cy="536" rx="10" ry="5" fill="#c45a28" />
              <ellipse cx="208" cy="538" rx="9" ry="4.5" fill="#e07a32" />
              <ellipse cx="198" cy="532" rx="7" ry="4" fill="#f0b35a" />
              <rect x="176" y="522" width="5" height="22" rx="1.4" fill="#4a3424" transform="rotate(-22 178 533)" />
              <rect x="206" y="520" width="4.4" height="20" rx="1.3" fill="#3a2a1c" transform="rotate(16 208 530)" />
              <rect x="192" y="518" width="4" height="18" rx="1.2" fill="#5a4030" transform="rotate(8 194 527)" />
            </g>
          </g>

          {/* Single front air opening */}
          <g>
            <circle cx="200" cy="548" r="30" fill="#1c1916" stroke="#3f454a" strokeWidth="1.7" />
            <circle className="kk-focus-ring kk-focus-ring-air" cx="200" cy="548" r="30" fill="none" stroke="#6d8aa8" strokeWidth="2.2" />
            <circle cx="200" cy="548" r="24" fill="#2a2018" />
            <g className="ember kk-hl kk-hl-fire">
              <ellipse cx="192" cy="554" rx="8" ry="4.2" fill="#c45a28" />
              <ellipse cx="206" cy="556" rx="7" ry="3.8" fill="#e3943a" />
              <ellipse cx="198" cy="550" rx="5.5" ry="3" fill="#f0b35a" />
              <rect x="186" y="544" width="3.4" height="16" rx="1" fill="#4a3424" transform="rotate(-16 188 552)" />
              <rect x="204" y="542" width="3" height="15" rx="1" fill="#3a2a1c" transform="rotate(12 205 550)" />
            </g>
          </g>

          {/* Cool-air arrows into the single opening */}
          <g
            className="airflow kk-hl kk-hl-air"
            fill="none"
            stroke="#6d8aa8"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeDasharray="6 7"
            markerEnd="url(#kk-hw-air-head)"
          >
            <path d="M18 548 C70 550 120 550 168 548" />
            <path d="M28 568 C78 562 124 556 170 552" />
            <path d="M32 528 C80 538 126 544 170 546" />
          </g>

          {/* Short leaders — shown only for the active step, never across the card */}
          <g className="kk-leaders" fill="none" stroke="#3f454a" strokeWidth="1.2">
            <g className="kk-leader kk-leader-air">
              <path d="M154 548 L128 548" />
              <circle cx="154" cy="548" r="3.2" fill="#f3efe6" stroke="#3f454a" strokeWidth="1.3" />
            </g>
            <g className="kk-leader kk-leader-fire">
              <path d="M232 538 L258 538" />
              <circle cx="232" cy="538" r="3.2" fill="#f3efe6" stroke="#3f454a" strokeWidth="1.3" />
            </g>
            <g className="kk-leader kk-leader-heat">
              <path d="M238 64 L264 64" />
              <circle cx="238" cy="64" r="3.2" fill="#f3efe6" stroke="#3f454a" strokeWidth="1.3" />
            </g>
            <g className="kk-leader kk-leader-water">
              <path d="M118 250 L92 250" />
              <circle cx="118" cy="250" r="3.2" fill="#f3efe6" stroke="#3f454a" strokeWidth="1.3" />
            </g>
          </g>
        </svg>
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
                onClick={() => setSelected((cur) => (cur === step.id ? null : step.id))}
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
