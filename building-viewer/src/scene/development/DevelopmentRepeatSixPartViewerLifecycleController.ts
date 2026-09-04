/**
 * Standalone development lifecycle boundary for a possible repeat-six-part
 * viewer integration. Nothing imports this module from the production viewer.
 * In particular, this controller does not grant an activation capability.
 */

export const DEVELOPMENT_REPEAT_SIX_PART_LIFECYCLE_MUTATION_REASONS = Object.freeze([
  'model-load',
  'model-add',
  'model-remove',
  'quality-reload',
  'context-loss',
  'layer-visibility-change',
  'local-file-replacement',
  'stream-refresh',
] as const)

export type DevelopmentRepeatSixPartLifecycleMutationReason =
  (typeof DEVELOPMENT_REPEAT_SIX_PART_LIFECYCLE_MUTATION_REASONS)[number]

export type DevelopmentRepeatSixPartWorldPoint = Readonly<{
  space: 'world'
  point: readonly [number, number, number]
}>

export type DevelopmentRepeatSixPartOwnerLocalPoint = Readonly<{
  space: 'owner-local'
  point: readonly [number, number, number]
}>

export type DevelopmentRepeatSixPartQueuedWorldFocus = Readonly<{
  generation: number
  worldPoint: DevelopmentRepeatSixPartWorldPoint
  overview: boolean
}>

export type DevelopmentRepeatSixPartAdapterFocusRequest = Readonly<{
  generation: number
  sessionEpoch: number
  focus: DevelopmentRepeatSixPartOwnerLocalPoint
  overview: boolean
  signal: AbortSignal
  /** A renderer must consult this immediately before making a publication visible. */
  canPublish: () => boolean
}>

export interface DevelopmentRepeatSixPartLifecycleSessionPort {
  readonly generation: number
  /** Refreshes the animated owner's matrix before focus-space conversion. */
  updateOwnerWorldMatrix(): void
  worldToOwnerLocal(point: DevelopmentRepeatSixPartWorldPoint): DevelopmentRepeatSixPartOwnerLocalPoint
}

export interface DevelopmentRepeatSixPartLifecycleAdapterPort {
  updateFocus(request: DevelopmentRepeatSixPartAdapterFocusRequest): Promise<unknown>
  cancelPendingUpdate(): boolean | void
  dispose(): void | Promise<void>
}

export interface DevelopmentRepeatSixPartLifecycleInspectionPort {
  clearInspection(reason: 'before-repeat-six-part-publication'): void
}

export interface DevelopmentRepeatSixPartLifecycleBarrierPort {
  /** Must restore physical ownership before returning. It may not yield. */
  restoreOriginalOwnership(reason: DevelopmentRepeatSixPartLifecycleTeardownReason): void
  /** Keeps the last provably valid owner visible if exact restoration fails. */
  preserveKnownOwnership(
    reason: DevelopmentRepeatSixPartLifecycleTeardownReason,
    restorationError: unknown,
  ): void
}

export type DevelopmentRepeatSixPartLifecycleTeardownReason =
  | DevelopmentRepeatSixPartLifecycleMutationReason
  | 'focus-publication-failure'
  | 'controller-dispose'

export type DevelopmentRepeatSixPartLifecycleAttachment = Readonly<{
  generation: number
  session: DevelopmentRepeatSixPartLifecycleSessionPort
  adapter: DevelopmentRepeatSixPartLifecycleAdapterPort
  inspection: DevelopmentRepeatSixPartLifecycleInspectionPort
  barrier: DevelopmentRepeatSixPartLifecycleBarrierPort
}>

export type DevelopmentRepeatSixPartQueuedFocusResult = Readonly<{
  kind: 'published' | 'superseded' | 'cancelled'
  generation: number
  sessionEpoch: number
}>

export type DevelopmentRepeatSixPartViewerLifecycleState =
  | 'idle'
  | 'attached'
  | 'tearing-down'
  | 'failed-stopped'
  | 'disposed'

export type DevelopmentRepeatSixPartViewerLifecycleCounters = Readonly<{
  attachments: number
  focusRequests: number
  supersededFocusRequests: number
  cancelledFocusRequests: number
  adapterPublicationAttempts: number
  completedPublications: number
  failedPublications: number
  lifecycleTeardowns: number
  restorationAttempts: number
  adapterDisposals: number
}>

export type DevelopmentRepeatSixPartViewerLifecycleSnapshot = Readonly<{
  kind: 'development-repeat-six-part-viewer-lifecycle-controller-snapshot'
  developmentOnly: true
  activationAuthorized: false
  activationCapability: null
  state: DevelopmentRepeatSixPartViewerLifecycleState
  generation: number | null
  highestGeneration: number
  sessionEpoch: number
  focusInFlight: boolean
  focusPending: boolean
  knownOwnershipPreserved: boolean
  counters: DevelopmentRepeatSixPartViewerLifecycleCounters
}>

export type DevelopmentRepeatSixPartViewerLifecycleErrorCode =
  | 'INVALID_CONFIGURATION'
  | 'STALE_GENERATION'
  | 'INVALID_FOCUS'
  | 'SESSION_ACTIVE'
  | 'TEARDOWN_PENDING'
  | 'ASYNC_SYNCHRONOUS_PORT'
  | 'CANCELLATION_FAILED'
  | 'RESTORATION_FAILED'
  | 'TEARDOWN_FAILED'
  | 'PUBLICATION_FAILED'
  | 'FAIL_STOPPED'
  | 'DISPOSED'

export class DevelopmentRepeatSixPartViewerLifecycleError extends Error {
  readonly code: DevelopmentRepeatSixPartViewerLifecycleErrorCode
  readonly cause: unknown

  constructor(
    code: DevelopmentRepeatSixPartViewerLifecycleErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message)
    this.name = 'DevelopmentRepeatSixPartViewerLifecycleError'
    this.code = code
    this.cause = cause
  }
}

type MutableCounters = {
  -readonly [Key in keyof DevelopmentRepeatSixPartViewerLifecycleCounters]: number
}

type QueuedFocus = {
  readonly generation: number
  readonly sessionEpoch: number
  readonly worldPoint: DevelopmentRepeatSixPartWorldPoint
  readonly overview: boolean
  readonly promise: Promise<DevelopmentRepeatSixPartQueuedFocusResult>
  readonly resolve: (result: DevelopmentRepeatSixPartQueuedFocusResult) => void
  readonly reject: (error: unknown) => void
  readonly done: Promise<void>
  readonly resolveDone: () => void
}

type AttachedSession = {
  readonly generation: number
  readonly epoch: number
  readonly session: DevelopmentRepeatSixPartLifecycleSessionPort
  readonly adapter: DevelopmentRepeatSixPartLifecycleAdapterPort
  readonly inspection: DevelopmentRepeatSixPartLifecycleInspectionPort
  readonly barrier: DevelopmentRepeatSixPartLifecycleBarrierPort
  readonly abort: AbortController
  valid: boolean
  terminalAfterTeardown: boolean
  inFlight: QueuedFocus | null
  pending: QueuedFocus | null
  teardownPromise: Promise<void> | null
}

const MUTATION_REASON_SET = new Set<string>(DEVELOPMENT_REPEAT_SIX_PART_LIFECYCLE_MUTATION_REASONS)

function lifecycleError(
  code: DevelopmentRepeatSixPartViewerLifecycleErrorCode,
  message: string,
  cause?: unknown,
): DevelopmentRepeatSixPartViewerLifecycleError {
  return new DevelopmentRepeatSixPartViewerLifecycleError(code, message, cause)
}

function assertGeneration(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw lifecycleError('INVALID_CONFIGURATION', `${label} must be a non-negative safe integer`)
  }
}

function copyFinitePoint(
  value: unknown,
  expectedSpace: 'world',
): DevelopmentRepeatSixPartWorldPoint
function copyFinitePoint(
  value: unknown,
  expectedSpace: 'owner-local',
): DevelopmentRepeatSixPartOwnerLocalPoint
function copyFinitePoint(
  value: unknown,
  expectedSpace: 'world' | 'owner-local',
): DevelopmentRepeatSixPartWorldPoint | DevelopmentRepeatSixPartOwnerLocalPoint {
  const candidate = value as { space?: unknown; point?: unknown } | null
  if (!candidate || candidate.space !== expectedSpace || !Array.isArray(candidate.point)) {
    throw lifecycleError('INVALID_FOCUS', `Focus must be expressed in ${expectedSpace} space`)
  }
  if (
    candidate.point.length !== 3 ||
    !candidate.point.every((component) => typeof component === 'number' && Number.isFinite(component))
  ) {
    throw lifecycleError('INVALID_FOCUS', 'Focus point must contain exactly three finite numbers')
  }
  const point = Object.freeze([
    candidate.point[0] as number,
    candidate.point[1] as number,
    candidate.point[2] as number,
  ] as [number, number, number])
  return Object.freeze({ space: expectedSpace, point }) as
    | DevelopmentRepeatSixPartWorldPoint
    | DevelopmentRepeatSixPartOwnerLocalPoint
}

function assertFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw lifecycleError('INVALID_CONFIGURATION', `${label} must be a function`)
  }
}

function assertSynchronousPortResult(value: unknown, label: string): void {
  if ((typeof value !== 'object' || value === null) && typeof value !== 'function') return
  let then: unknown
  try {
    then = (value as { then?: unknown }).then
  } catch (error) {
    throw lifecycleError(
      'ASYNC_SYNCHRONOUS_PORT',
      `${label} returned an unreadable thenable from a synchronous lifecycle boundary`,
      error,
    )
  }
  if (typeof then !== 'function') return
  // Observe rejected native Promises and foreign thenables so detection does
  // not create an unhandled-rejection side channel while failing closed.
  void Promise.resolve(value).catch(() => undefined)
  throw lifecycleError(
    'ASYNC_SYNCHRONOUS_PORT',
    `${label} returned a thenable from a synchronous lifecycle boundary`,
  )
}

function result(
  kind: DevelopmentRepeatSixPartQueuedFocusResult['kind'],
  queued: QueuedFocus,
): DevelopmentRepeatSixPartQueuedFocusResult {
  return Object.freeze({ kind, generation: queued.generation, sessionEpoch: queued.sessionEpoch })
}

export class DevelopmentRepeatSixPartViewerLifecycleController {
  private controllerState: DevelopmentRepeatSixPartViewerLifecycleState = 'idle'
  private activeSession: AttachedSession | null = null
  private retiringSession: AttachedSession | null = null
  private lastTeardownPromise: Promise<void> | null = null
  private disposePromise: Promise<void> | null = null
  private disposeRequested = false
  private highestGeneration = -1
  private sessionEpoch = 0
  private knownOwnershipPreserved = true
  private readonly counters: MutableCounters = {
    attachments: 0,
    focusRequests: 0,
    supersededFocusRequests: 0,
    cancelledFocusRequests: 0,
    adapterPublicationAttempts: 0,
    completedPublications: 0,
    failedPublications: 0,
    lifecycleTeardowns: 0,
    restorationAttempts: 0,
    adapterDisposals: 0,
  }

  attachSession(attachment: DevelopmentRepeatSixPartLifecycleAttachment): void {
    this.assertControllerAcceptsWork()
    if (this.activeSession) {
      throw lifecycleError('SESSION_ACTIVE', 'A repeat-six-part lifecycle session is already active')
    }
    if (this.retiringSession) {
      throw lifecycleError('TEARDOWN_PENDING', 'The previous lifecycle session is still tearing down')
    }
    const candidate = attachment as DevelopmentRepeatSixPartLifecycleAttachment | null
    assertGeneration(candidate?.generation, 'attachment.generation')
    if (!candidate || candidate.session?.generation !== candidate.generation) {
      throw lifecycleError('INVALID_CONFIGURATION', 'Session and attachment generations must match')
    }
    if (candidate.generation <= this.highestGeneration) {
      throw lifecycleError(
        'STALE_GENERATION',
        `Generation ${candidate.generation} does not advance ${this.highestGeneration}`,
      )
    }
    assertFunction(candidate.session.updateOwnerWorldMatrix, 'session.updateOwnerWorldMatrix')
    assertFunction(candidate.session.worldToOwnerLocal, 'session.worldToOwnerLocal')
    assertFunction(candidate.adapter.updateFocus, 'adapter.updateFocus')
    assertFunction(candidate.adapter.cancelPendingUpdate, 'adapter.cancelPendingUpdate')
    assertFunction(candidate.adapter.dispose, 'adapter.dispose')
    assertFunction(candidate.inspection.clearInspection, 'inspection.clearInspection')
    assertFunction(candidate.barrier.restoreOriginalOwnership, 'barrier.restoreOriginalOwnership')
    assertFunction(candidate.barrier.preserveKnownOwnership, 'barrier.preserveKnownOwnership')

    this.sessionEpoch += 1
    this.highestGeneration = candidate.generation
    this.lastTeardownPromise = null
    this.activeSession = {
      generation: candidate.generation,
      epoch: this.sessionEpoch,
      session: candidate.session,
      adapter: candidate.adapter,
      inspection: candidate.inspection,
      barrier: candidate.barrier,
      abort: new AbortController(),
      valid: true,
      terminalAfterTeardown: false,
      inFlight: null,
      pending: null,
      teardownPromise: null,
    }
    this.controllerState = 'attached'
    this.knownOwnershipPreserved = true
    this.counters.attachments += 1
  }

  queueWorldFocus(
    input: DevelopmentRepeatSixPartQueuedWorldFocus,
  ): Promise<DevelopmentRepeatSixPartQueuedFocusResult> {
    this.assertControllerAcceptsWork()
    const session = this.activeSession
    if (!session || !session.valid) {
      throw lifecycleError('TEARDOWN_PENDING', 'No active lifecycle session can accept focus')
    }

    // Generation, space, finiteness, and overview validation deliberately occur
    // before any counter, queue, inspection, owner, or adapter mutation.
    assertGeneration(input?.generation, 'focus.generation')
    if (input.generation !== session.generation) {
      throw lifecycleError(
        'STALE_GENERATION',
        `Stale focus generation ${input.generation}; active generation is ${session.generation}`,
      )
    }
    if (typeof input.overview !== 'boolean') {
      throw lifecycleError('INVALID_FOCUS', 'Focus overview must be boolean')
    }
    const worldPoint = copyFinitePoint(input.worldPoint, 'world')
    const queued = this.createQueuedFocus(session, worldPoint, input.overview)
    this.counters.focusRequests += 1

    if (session.inFlight) {
      if (session.pending) {
        this.counters.supersededFocusRequests += 1
        session.pending.resolve(result('superseded', session.pending))
        session.pending.resolveDone()
      }
      session.pending = queued
    } else {
      this.startQueuedFocus(session, queued)
    }
    return queued.promise
  }

  /**
   * Executes a destructive viewer continuation only after this session has
   * synchronously cancelled publications/restored ownership and then finished
   * asynchronous adapter disposal.
   */
  runLifecycleMutation<Result>(
    reason: DevelopmentRepeatSixPartLifecycleMutationReason,
    continuation: () => Result | Promise<Result>,
  ): Promise<Result> {
    this.assertControllerAcceptsWork()
    if (!MUTATION_REASON_SET.has(reason)) {
      throw lifecycleError('INVALID_CONFIGURATION', `Unknown lifecycle mutation reason: ${String(reason)}`)
    }
    assertFunction(continuation, 'continuation')
    const teardown = this.teardown(reason)
    return teardown.then(() => {
      // A joined teardown can become terminal while this caller is waiting.
      // Re-authorize at the destructive boundary instead of assuming that a
      // successful adapter disposal also means the controller stayed usable.
      this.assertControllerAcceptsWork()
      return continuation()
    })
  }

  /** Begins cancellation/restoration synchronously and returns the shared join. */
  teardown(reason: DevelopmentRepeatSixPartLifecycleMutationReason): Promise<void> {
    if (!MUTATION_REASON_SET.has(reason)) {
      throw lifecycleError('INVALID_CONFIGURATION', `Unknown public teardown reason: ${String(reason)}`)
    }
    if (this.disposeRequested) {
      throw lifecycleError('DISPOSED', 'Lifecycle controller disposal has begun')
    }
    if (this.controllerState === 'failed-stopped' && this.lastTeardownPromise) {
      return this.lastTeardownPromise
    }
    if (this.retiringSession?.teardownPromise) return this.retiringSession.teardownPromise
    if (!this.activeSession) {
      if (this.lastTeardownPromise) return this.lastTeardownPromise
      const settled = Promise.resolve()
      this.lastTeardownPromise = settled
      return settled
    }
    return this.beginTeardown(this.activeSession, reason, false)
  }

  dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise
    this.disposeRequested = true
    let resolveDisposal: () => void = () => undefined
    let rejectDisposal: (error: unknown) => void = () => undefined
    const disposal = new Promise<void>((resolve, reject) => {
      resolveDisposal = resolve
      rejectDisposal = reject
    })
    // Publish before beginTeardown: abort/cancel/restore callbacks may
    // reentrantly call dispose and must observe this exact join handle.
    this.disposePromise = disposal
    let teardown: Promise<void>
    try {
      teardown = this.activeSession || this.retiringSession
        ? this.beginTeardown(
          this.activeSession ?? this.retiringSession as AttachedSession,
          'controller-dispose',
          false,
        )
        : Promise.resolve()
    } catch (error) {
      rejectDisposal(error)
      return disposal
    }
    void teardown.then(
      () => {
        this.controllerState = 'disposed'
        resolveDisposal()
      },
      (error) => { rejectDisposal(error) },
    )
    return disposal
  }

  getSnapshot(): DevelopmentRepeatSixPartViewerLifecycleSnapshot {
    const observed = this.activeSession ?? this.retiringSession
    return Object.freeze({
      kind: 'development-repeat-six-part-viewer-lifecycle-controller-snapshot' as const,
      developmentOnly: true as const,
      activationAuthorized: false as const,
      activationCapability: null,
      state: this.controllerState,
      generation: observed?.generation ?? null,
      highestGeneration: this.highestGeneration,
      sessionEpoch: this.sessionEpoch,
      focusInFlight: observed?.inFlight !== null && observed?.inFlight !== undefined,
      focusPending: observed?.pending !== null && observed?.pending !== undefined,
      knownOwnershipPreserved: this.knownOwnershipPreserved,
      counters: Object.freeze({ ...this.counters }),
    })
  }

  private assertControllerAcceptsWork(): void {
    if (this.disposeRequested || this.controllerState === 'disposed') {
      throw lifecycleError('DISPOSED', 'Lifecycle controller is disposed')
    }
    if (
      this.controllerState === 'failed-stopped' ||
      this.activeSession?.terminalAfterTeardown === true ||
      this.retiringSession?.terminalAfterTeardown === true
    ) {
      throw lifecycleError('FAIL_STOPPED', 'Lifecycle controller is fail-stopped')
    }
  }

  private createQueuedFocus(
    session: AttachedSession,
    worldPoint: DevelopmentRepeatSixPartWorldPoint,
    overview: boolean,
  ): QueuedFocus {
    let resolve: (value: DevelopmentRepeatSixPartQueuedFocusResult) => void = () => undefined
    let reject: (error: unknown) => void = () => undefined
    const promise = new Promise<DevelopmentRepeatSixPartQueuedFocusResult>((accept, decline) => {
      resolve = accept
      reject = decline
    })
    let resolveDone: () => void = () => undefined
    const done = new Promise<void>((accept) => { resolveDone = accept })
    return {
      generation: session.generation,
      sessionEpoch: session.epoch,
      worldPoint,
      overview,
      promise,
      resolve,
      reject,
      done,
      resolveDone,
    }
  }

  private startQueuedFocus(session: AttachedSession, queued: QueuedFocus): void {
    session.inFlight = queued
    void this.executeQueuedFocus(session, queued).then(
      (kind) => { queued.resolve(result(kind, queued)) },
      (error) => { queued.reject(error) },
    ).finally(() => {
      queued.resolveDone()
      if (session.inFlight === queued) session.inFlight = null
      if (this.activeSession !== session || !session.valid) return
      const pending = session.pending
      session.pending = null
      if (pending) this.startQueuedFocus(session, pending)
    })
  }

  private async executeQueuedFocus(
    session: AttachedSession,
    queued: QueuedFocus,
  ): Promise<'published' | 'cancelled'> {
    if (!this.isCurrent(session, queued.sessionEpoch)) {
      this.counters.cancelledFocusRequests += 1
      return 'cancelled'
    }

    try {
      assertSynchronousPortResult(
        session.session.updateOwnerWorldMatrix(),
        'session.updateOwnerWorldMatrix',
      )
      const rawOwnerLocal = session.session.worldToOwnerLocal(queued.worldPoint)
      assertSynchronousPortResult(
        rawOwnerLocal,
        'session.worldToOwnerLocal',
      )
      const ownerLocal = copyFinitePoint(rawOwnerLocal, 'owner-local')
      if (!this.isCurrent(session, queued.sessionEpoch)) {
        this.counters.cancelledFocusRequests += 1
        return 'cancelled'
      }

      assertSynchronousPortResult(
        session.inspection.clearInspection('before-repeat-six-part-publication'),
        'inspection.clearInspection',
      )
      if (!this.isCurrent(session, queued.sessionEpoch)) {
        this.counters.cancelledFocusRequests += 1
        return 'cancelled'
      }

      const request = Object.freeze({
        generation: queued.generation,
        sessionEpoch: queued.sessionEpoch,
        focus: ownerLocal,
        overview: queued.overview,
        signal: session.abort.signal,
        canPublish: () => this.isCurrent(session, queued.sessionEpoch),
      })
      this.counters.adapterPublicationAttempts += 1
      await session.adapter.updateFocus(request)
      if (!this.isCurrent(session, queued.sessionEpoch)) {
        this.counters.cancelledFocusRequests += 1
        return 'cancelled'
      }
      this.counters.completedPublications += 1
      return 'published'
    } catch (error) {
      if (!this.isCurrent(session, queued.sessionEpoch)) {
        this.counters.cancelledFocusRequests += 1
        return 'cancelled'
      }
      this.counters.failedPublications += 1
      const teardown = this.beginTeardown(session, 'focus-publication-failure', true)
      void teardown.catch(() => undefined)
      throw lifecycleError(
        'PUBLICATION_FAILED',
        'Repeat-six-part focus publication failed closed to original ownership',
        error,
      )
    }
  }

  private isCurrent(session: AttachedSession, epoch: number): boolean {
    return Boolean(
      session.valid &&
      !session.abort.signal.aborted &&
      this.activeSession === session &&
      this.sessionEpoch === epoch &&
      session.epoch === epoch &&
      this.controllerState === 'attached',
    )
  }

  private beginTeardown(
    session: AttachedSession,
    reason: DevelopmentRepeatSixPartLifecycleTeardownReason,
    terminal: boolean,
  ): Promise<void> {
    if (session.teardownPromise) {
      if (terminal) session.terminalAfterTeardown = true
      return session.teardownPromise
    }
    session.terminalAfterTeardown ||= terminal
    const inFlightDone = session.inFlight?.done ?? Promise.resolve()

    let resolveTeardown: () => void = () => undefined
    let rejectTeardown: (error: unknown) => void = () => undefined
    const teardown = new Promise<void>((resolve, reject) => {
      resolveTeardown = resolve
      rejectTeardown = reject
    })
    // This is the linearization point. Publish the one authentic join before
    // abort or any injected callback can reenter the controller.
    session.teardownPromise = teardown
    this.lastTeardownPromise = teardown

    // Everything through restoreOriginalOwnership is intentionally synchronous.
    session.valid = false
    this.sessionEpoch += 1
    this.activeSession = null
    this.retiringSession = session
    this.controllerState = 'tearing-down'
    session.abort.abort(reason)
    if (session.pending) {
      this.counters.cancelledFocusRequests += 1
      session.pending.resolve(result('cancelled', session.pending))
      session.pending.resolveDone()
      session.pending = null
    }
    let cancellationError: unknown = null
    try {
      assertSynchronousPortResult(
        session.adapter.cancelPendingUpdate(),
        'adapter.cancelPendingUpdate',
      )
    } catch (error) {
      cancellationError = error
    }
    this.counters.lifecycleTeardowns += 1
    this.counters.restorationAttempts += 1

    let restorationError: unknown = null
    try {
      assertSynchronousPortResult(
        session.barrier.restoreOriginalOwnership(reason),
        'barrier.restoreOriginalOwnership',
      )
      this.knownOwnershipPreserved = true
    } catch (error) {
      restorationError = error
      let preservationError: unknown = null
      try {
        assertSynchronousPortResult(
          session.barrier.preserveKnownOwnership(reason, error),
          'barrier.preserveKnownOwnership',
        )
        this.knownOwnershipPreserved = true
      } catch (preserveError) {
        preservationError = preserveError
        this.knownOwnershipPreserved = false
      }
      if (preservationError) {
        restorationError = new AggregateError(
          [error, preservationError],
          'Restoration and known-owner preservation both failed',
        )
      }
    }

    if (cancellationError || restorationError) {
      this.controllerState = 'failed-stopped'
      const bothFailed = cancellationError && restorationError
      const code: DevelopmentRepeatSixPartViewerLifecycleErrorCode = restorationError
        ? 'RESTORATION_FAILED'
        : 'CANCELLATION_FAILED'
      const cause = bothFailed
        ? new AggregateError(
          [cancellationError, restorationError],
          'Adapter cancellation and ownership restoration containment failed',
        )
        : restorationError ?? cancellationError
      const message = restorationError
        ? 'Original ownership could not be restored; lifecycle continuation is blocked'
        : 'Adapter cancellation failed; original ownership was restored but lifecycle continuation is blocked'
      rejectTeardown(lifecycleError(code, message, cause))
      return teardown
    }

    void (async () => {
      await inFlightDone
      this.counters.adapterDisposals += 1
      await session.adapter.dispose()
      if (this.retiringSession === session) this.retiringSession = null
      this.controllerState = session.terminalAfterTeardown ? 'failed-stopped' : 'idle'
    })().then(
      () => { resolveTeardown() },
      (error) => {
        this.controllerState = 'failed-stopped'
        rejectTeardown(lifecycleError(
          'TEARDOWN_FAILED',
          'Adapter disposal failed; lifecycle continuation is blocked',
          error,
        ))
      },
    )
    return teardown
  }
}
