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
  const [selected, setSelected] = useState<StepId | null>('air')
  const [hovered, setHovered] = useState<StepId | null>(null)
  const focus = hovered ?? selected

  return (
    <div className={focus ? `kk-how-board is-${focus}` : 'kk-how-board'}>
      <div className="kk-schematic-col">
        <svg
          className="kk-schematic"
          viewBox="0 0 560 600"
          role="img"
          aria-labelledby="kk-schematic-title kk-schematic-desc"
        >
          <title id="kk-schematic-title">How the Kelly Kettle works</title>
          <desc id="kk-schematic-desc">
            Cutaway of a Kelly Kettle. Three cool-air arrows enter the single opening in its separate
            fire base. A small fire heats a hollow central chimney while water surrounds the chimney
            inside the kettle&apos;s double wall.
          </desc>

          <defs>
            <linearGradient id="kk-schematic-steel" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#899198" />
              <stop offset="24%" stopColor="#c4cbd0" />
              <stop offset="52%" stopColor="#edf0f2" />
              <stop offset="76%" stopColor="#b7bec4" />
              <stop offset="100%" stopColor="#858d94" />
            </linearGradient>
            <linearGradient id="kk-schematic-steel-v" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dce1e4" />
              <stop offset="45%" stopColor="#b7bec4" />
              <stop offset="100%" stopColor="#8c949a" />
            </linearGradient>
            <linearGradient id="kk-water-fill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#4f91ad" stopOpacity="0.48" />
              <stop offset="48%" stopColor="#8ccce0" stopOpacity="0.72" />
              <stop offset="100%" stopColor="#5b9db9" stopOpacity="0.54" />
            </linearGradient>
            <linearGradient id="kk-heat-fill" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#cf5d29" stopOpacity="0.82" />
              <stop offset="36%" stopColor="#e79037" stopOpacity="0.62" />
              <stop offset="70%" stopColor="#f0bd63" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f8e6b3" stopOpacity="0.06" />
            </linearGradient>
            <linearGradient id="kk-base-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cbd1d5" />
              <stop offset="100%" stopColor="#858d93" />
            </linearGradient>
            <radialGradient id="kk-ember-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffd77b" stopOpacity="0.95" />
              <stop offset="52%" stopColor="#d8662d" stopOpacity="0.78" />
              <stop offset="100%" stopColor="#a84225" stopOpacity="0" />
            </radialGradient>

            <clipPath id="kk-water-clip">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M178 132
                   C161 165 158 202 160 242
                   L164 405
                   C165 422 174 430 188 432
                   L372 432
                   C386 430 395 422 396 405
                   L400 242
                   C402 202 399 165 382 132
                   L340 103
                   L220 103 Z
                   M247 60
                   C257 53 303 53 311 60
                   L344 432
                   L216 432 Z"
              />
            </clipPath>
            <clipPath id="kk-body-clip">
              <path
                d="M228 44
                   C240 36 320 36 332 44
                   L336 101
                   C338 121 351 141 376 164
                   C393 180 400 201 398 228
                   L394 405
                   C393 423 386 434 374 438
                   L186 438
                   C174 434 167 423 166 405
                   L162 228
                   C160 201 167 180 184 164
                   C209 141 222 121 224 101 Z"
              />
            </clipPath>
            <clipPath id="kk-chimney-clip">
              <path d="M251 58 C258 52 302 52 309 58 L332 432 L228 432 Z" />
            </clipPath>
            <clipPath id="kk-base-opening-clip">
              <circle cx="280" cy="519" r="34" />
            </clipPath>

            <marker id="kk-air-arrowhead" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0 0 L7 3.5 L0 7 Z" fill="#6888a5" />
            </marker>
            <marker id="kk-heat-arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0 0 L6 3 L0 6 Z" fill="#ce642d" />
            </marker>
          </defs>

          <ellipse cx="280" cy="580" rx="152" ry="11" fill="rgba(44,42,38,0.08)" />

          {/* Separate short cylindrical fire base with one receiving rim. */}
          <g className="kk-hw-base">
            <path
              d="M138 455
                 C160 449 400 449 422 455
                 L414 548
                 Q414 559 402 561
                 L158 561
                 Q146 559 146 548 Z"
              fill="url(#kk-base-fill)"
              stroke="#4a4f54"
              strokeWidth="1.7"
            />
            <path
              d="M122 444
                 C145 436 415 436 438 444
                 L422 462
                 C399 469 161 469 138 462 Z"
              fill="url(#kk-schematic-steel-v)"
              stroke="#4a4f54"
              strokeWidth="1.6"
            />
          </g>

          {/* Tall steel kettle body, including its short top neck. */}
          <path
            className="kk-hw-outer-body"
            d="M228 44
               C240 36 320 36 332 44
               L336 101
               C338 121 351 141 376 164
               C393 180 400 201 398 228
               L394 405
               C393 423 386 434 374 438
               L186 438
               C174 434 167 423 166 405
               L162 228
               C160 201 167 180 184 164
               C209 141 222 121 224 101 Z"
            fill="url(#kk-schematic-steel)"
            stroke="#454b50"
            strokeWidth="1.8"
          />

          {/* One continuous water jacket clipped around, never inside, the chimney. */}
          <g className="kk-hl kk-hl-water" clipPath="url(#kk-body-clip)">
            <rect
              x="156"
              y="143"
              width="248"
              height="293"
              fill="url(#kk-water-fill)"
              clipPath="url(#kk-water-clip)"
            />
            <path
              d="M176 145 C200 141 218 141 238 143 M322 143 C342 141 360 141 384 145"
              fill="none"
              stroke="#6e96aa"
              strokeWidth="1.6"
              opacity="0.82"
            />
            <g clipPath="url(#kk-water-clip)">
              <circle className="water-bubble kk-bubble kk-bubble--a" cx="365" cy="340" r="3.2" />
              <circle className="water-bubble kk-bubble kk-bubble--b" cx="374" cy="275" r="2.5" />
              <circle className="water-bubble kk-bubble kk-bubble--c" cx="355" cy="392" r="2.7" />
            </g>
          </g>

          {/* The charcoal passage stays visible around a narrow clipped heat plume. */}
          <path
            d="M251 58 C258 52 302 52 309 58 L332 432 L228 432 Z"
            fill="#292522"
            stroke="#3f4448"
            strokeWidth="1.2"
          />
          <g className="kk-hl kk-hl-heat" clipPath="url(#kk-chimney-clip)">
            <path
              className="heat-flow"
              d="M260 426
                 C250 368 260 318 271 276
                 C279 233 271 193 278 151
                 C281 121 279 94 282 70
                 C291 103 292 134 302 164
                 C314 204 301 244 314 284
                 C328 330 328 376 317 426 Z"
              fill="url(#kk-heat-fill)"
            />
            <g
              className="kk-hw-heat-arrows"
              fill="none"
              stroke="#ce642d"
              strokeWidth="1.7"
              strokeLinecap="round"
              opacity="0.86"
            >
              <path d="M280 388 L280 238" markerEnd="url(#kk-heat-arrowhead)" />
              <path d="M263 354 L263 278" markerEnd="url(#kk-heat-arrowhead)" />
              <path d="M297 354 L297 278" markerEnd="url(#kk-heat-arrowhead)" />
            </g>
          </g>
          <g className="kk-hl kk-hl-fire kk-hl-heat" clipPath="url(#kk-chimney-clip)">
            <path
              d="M285 430
                 C265 398 277 360 294 336
                 C286 369 306 371 307 339
                 C306 319 317 299 324 286
                 C323 318 343 340 340 375
                 C345 398 336 418 316 430 Z"
              fill="#d9622c"
              opacity="0.9"
            />
            <path
              d="M294 430
                 C281 405 294 379 306 363
                 C301 388 317 390 318 367
                 C331 389 330 412 314 430 Z"
              fill="#f0b14f"
              opacity="0.94"
            />
          </g>

          {/* Two separate metal walls make the hollow chimney construction explicit. */}
          <g className="kk-hw-chimney-walls">
            <path
              d="M238 52 C241 46 249 47 252 55 L228 432 L214 432 Z"
              fill="url(#kk-schematic-steel)"
              stroke="#454b50"
              strokeWidth="1.25"
            />
            <path
              d="M322 52 C319 46 311 47 308 55 L332 432 L346 432 Z"
              fill="url(#kk-schematic-steel)"
              stroke="#454b50"
              strokeWidth="1.25"
            />
          </g>

          {/* Reference-style cutaway: the left half remains exterior steel while the right reveals the systems. */}
          <path
            className="kk-hw-exterior-half"
            d="M228 44
               C240 36 263 36 280 38
               L280 438
               L186 438
               C174 434 167 423 166 405
               L162 228
               C160 201 167 180 184 164
               C209 141 222 121 224 101 Z"
            fill="url(#kk-schematic-steel)"
            stroke="#454b50"
            strokeWidth="1.25"
          />
          <path d="M280 52 L280 438" fill="none" stroke="#3f4448" strokeWidth="1.35" />
          <path
            d="M228 44
               C240 36 320 36 332 44
               L336 101
               C338 121 351 141 376 164
               C393 180 400 201 398 228
               L394 405
               C393 423 386 434 374 438
               L186 438
               C174 434 167 423 166 405
               L162 228
               C160 201 167 180 184 164
               C209 141 222 121 224 101 Z"
            fill="none"
            stroke="#454b50"
            strokeWidth="1.8"
          />

          {/* Rolled top opening remains dark and visibly open. */}
          <g className="kk-hw-top-opening">
            <ellipse cx="280" cy="47" rx="56" ry="13" fill="#171412" stroke="#454b50" strokeWidth="2.2" />
            <ellipse cx="280" cy="45" rx="45" ry="8" fill="#2b2724" />
            <ellipse cx="280" cy="44" rx="56" ry="13" fill="none" stroke="#d7dcdf" strokeWidth="1.4" />
          </g>

          {/* Side-view cup whistle seated in the short angled spout, nested into the shoulder. */}
          <g className="kk-hw-spout-whistle" transform="translate(368 158) rotate(-46)">
            <path
              d="M-2 -5.2 L14 -5.2 L14 5.2 L-2 5.2 Z"
              fill="url(#kk-schematic-steel)"
              stroke="#454b50"
              strokeWidth="1.4"
            />
            <g className="kk-hw-whistle">
              <path
                d="M12 -8.5 L32 -10.4 C35.6 -10.4 38.2 -5.6 38.2 0 C38.2 5.6 35.6 10.4 32 10.4 L12 8.5 Z"
                fill="#67b84c"
                stroke="#2d6a30"
                strokeWidth="1.35"
              />
              <ellipse cx="32.4" cy="0" rx="5.4" ry="10.6" fill="#5aa642" stroke="#2d6a30" strokeWidth="1.35" />
              <ellipse cx="31.2" cy="0" rx="3.4" ry="8.2" fill="#1a3320" />
              <path
                d="M31.6 -10.7 C36.2 -10.7 39.4 -5.8 39.4 0 C39.4 5.8 36.2 10.7 31.6 10.7"
                fill="none"
                stroke="#2d6a30"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </g>
          </g>

          {/* One lower kettle roll seated inside the base receiver; one seam only. */}
          <path
            d="M160 433 C184 428 376 428 400 433 L397 443 C370 448 190 448 163 443 Z"
            fill="url(#kk-schematic-steel-v)"
            stroke="#454b50"
            strokeWidth="1.5"
          />
          <path
            d="M163 443 C192 447 368 447 397 443"
            fill="none"
            stroke="#393f43"
            strokeWidth="1.15"
          />

          {/* Exactly one front opening, with wood and embers clipped inside it. */}
          <g className="kk-hw-air-opening">
            <circle cx="280" cy="519" r="35" fill="#1b1816" stroke="#3e4448" strokeWidth="1.8" />
            <g className="kk-hl kk-hl-fire" clipPath="url(#kk-base-opening-clip)">
              <ellipse className="ember" cx="280" cy="532" rx="30" ry="13" fill="url(#kk-ember-glow)" />
              <rect x="257" y="510" width="7" height="38" rx="2" fill="#493224" transform="rotate(-24 260 529)" />
              <rect x="290" y="508" width="6.5" height="36" rx="2" fill="#35271d" transform="rotate(19 293 526)" />
              <rect x="273" y="512" width="6" height="32" rx="2" fill="#5b3e29" transform="rotate(5 276 528)" />
              <ellipse className="ember" cx="270" cy="536" rx="9" ry="4.5" fill="#cf5d29" />
              <ellipse className="ember" cx="289" cy="537" rx="8" ry="4" fill="#e88a39" />
              <ellipse className="ember" cx="280" cy="531" rx="6" ry="3.2" fill="#f1c063" />
              <path
                d="M280 528
                   C264 517 268 504 278 494
                   C277 505 287 508 286 497
                   C300 508 298 520 280 528 Z"
                fill="#d96a2f"
              />
              <path
                d="M280 524 C272 516 277 507 281 502 C280 511 289 513 286 520 Z"
                fill="#f0b45b"
              />
            </g>
            <circle
              className="kk-focus-ring kk-focus-ring-air"
              cx="280"
              cy="519"
              r="36"
              fill="none"
              stroke="#6888a5"
              strokeWidth="2.4"
            />
          </g>

          {/* Three cool-air paths terminate inside the single opening. */}
          <g
            className="airflow kk-hl kk-hl-air"
            fill="none"
            stroke="#6888a5"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="7 8"
            markerEnd="url(#kk-air-arrowhead)"
          >
            <path d="M24 516 C108 514 192 516 277 519" />
            <path d="M38 546 C116 538 196 528 275 522" />
            <path d="M42 486 C122 495 198 506 275 516" />
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
