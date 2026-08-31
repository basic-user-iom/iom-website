import {
  APP_PREFERENCES_STORAGE_KEY,
  APP_PREFERENCES_VERSION,
  DEFAULT_APP_PREFERENCES,
  createSafeAppPreferencesStorage,
  sanitizePersistedAppPreferences,
  type PreferenceStorageBackend,
} from '../../state/AppPreferences';
import {
  INITIAL_SIMULATION_SNAPSHOT,
  createAppStore,
} from '../../state/useAppStore';

describe('application preference persistence', () => {
  it('validates fields independently and discards unknown data', () => {
    const preferences = sanitizePersistedAppPreferences({
      selectedBodyId: 'saturn',
      cameraMode: 'not-a-camera',
      renderScaleMode: 'true',
      visualQuality: 'ultra',
      venusSurfaceMode: 'radar',
      orbitLinesVisible: false,
      bodyLabelsVisible: 'yes',
      selectedTrailInterval: 'next',
      motionPreference: 'reduce',
      reduceFlashes: false,
      snapshot: { currentJdTdb: 0 },
      webglMessage: 'must not hydrate',
    });

    expect(preferences).toMatchObject({
      selectedBodyId: 'saturn',
      cameraMode: DEFAULT_APP_PREFERENCES.cameraMode,
      renderScaleMode: 'true',
      visualQuality: 'ultra',
      venusSurfaceMode: 'radar',
      orbitLinesVisible: false,
      bodyLabelsVisible: DEFAULT_APP_PREFERENCES.bodyLabelsVisible,
      selectedTrailInterval: 'next',
      motionPreference: 'reduce',
      reduceFlashes: false,
    });
    expect(preferences).not.toHaveProperty('snapshot');
    expect(preferences).not.toHaveProperty('webglMessage');
  });

  it('hydrates a valid versioned preference payload', () => {
    const backend = new MemoryPreferenceBackend();
    backend.seed({
      version: APP_PREFERENCES_VERSION,
      state: {
        ...DEFAULT_APP_PREFERENCES,
        selectedBodyId: 'neptune',
        cameraMode: 'body-follow',
        visualQuality: 'low',
        kuiperBeltVisible: true,
        motionPreference: 'full',
        reduceFlashes: false,
      },
    });

    const store = createAppStore(createSafeAppPreferencesStorage(backend));

    expect(store.getState()).toMatchObject({
      selectedBodyId: 'neptune',
      cameraMode: 'body-follow',
      visualQuality: 'low',
      kuiperBeltVisible: true,
      motionPreference: 'full',
      reduceFlashes: false,
      preferencesHydrated: true,
    });
  });

  it('persists only the explicit preference whitelist', () => {
    const backend = new MemoryPreferenceBackend();
    const store = createAppStore(createSafeAppPreferencesStorage(backend));
    const writesAfterHydration = backend.writeCount;
    store.getState().setSnapshot({
      ...INITIAL_SIMULATION_SNAPSHOT,
      sequence: 42,
      currentJdTdb: 9_999_999,
      currentUtcIso: '2099-12-31T00:00:00.000Z',
    });
    store.getState().setWebGLStatus('error', 'runtime-only error');
    store.getState().setReducedMotion(true);
    expect(backend.writeCount).toBe(writesAfterHydration);
    store.getState().setVisualQuality('medium');
    expect(backend.writeCount).toBe(writesAfterHydration + 1);

    const stored = backend.readEnvelope();
    expect(stored.version).toBe(APP_PREFERENCES_VERSION);
    expect(stored.state).toEqual({
      ...DEFAULT_APP_PREFERENCES,
      visualQuality: 'medium',
    });
    expect(stored.state).not.toHaveProperty('snapshot');
    expect(stored.state).not.toHaveProperty('webglStatus');
    expect(stored.state).not.toHaveProperty('webglMessage');
    expect(stored.state).not.toHaveProperty('reducedMotion');
    expect(stored.state).not.toHaveProperty('preferencesHydrated');
    expect(stored.state).not.toHaveProperty('preferencesPersistenceSuspended');
  });

  it('keeps automated tour view changes out of durable preferences', () => {
    const backend = new MemoryPreferenceBackend();
    const store = createAppStore(createSafeAppPreferencesStorage(backend));
    store.getState().setSelectedBodyId('saturn');
    store.getState().setCameraMode('chase');

    store.getState().setPreferencesPersistenceSuspended(true);
    store.getState().setSelectedBodyId('neptune');
    store.getState().setCameraMode('body-follow');
    store.getState().setVisualQuality('ultra');

    expect(store.getState()).toMatchObject({
      selectedBodyId: 'neptune',
      cameraMode: 'body-follow',
      visualQuality: 'ultra',
      preferencesPersistenceSuspended: true,
    });
    expect(backend.readEnvelope().state).toMatchObject({
      selectedBodyId: 'saturn',
      cameraMode: 'chase',
      visualQuality: 'ultra',
    });
    expect(backend.readEnvelope().state).not.toHaveProperty(
      'preferencesPersistenceSuspended',
    );

    const reloadedStore = createAppStore(createSafeAppPreferencesStorage(backend));
    expect(reloadedStore.getState()).toMatchObject({
      selectedBodyId: 'saturn',
      cameraMode: 'chase',
      visualQuality: 'ultra',
      preferencesPersistenceSuspended: false,
    });
  });

  it('migrates an older whitelist and rejects a future schema', () => {
    const oldBackend = new MemoryPreferenceBackend();
    oldBackend.seed({
      version: 0,
      state: {
        ...DEFAULT_APP_PREFERENCES,
        selectedBodyId: 'mars',
        visualQuality: 'ultra',
      },
    });
    const oldStore = createAppStore(createSafeAppPreferencesStorage(oldBackend));
    expect(oldStore.getState()).toMatchObject({
      selectedBodyId: 'mars',
      visualQuality: 'ultra',
      preferencesHydrated: true,
    });
    expect(oldBackend.readEnvelope().version).toBe(APP_PREFERENCES_VERSION);

    const futureBackend = new MemoryPreferenceBackend();
    futureBackend.seed({
      version: APP_PREFERENCES_VERSION + 10,
      state: {
        ...DEFAULT_APP_PREFERENCES,
        selectedBodyId: 'jupiter',
      },
    });
    const futureStore = createAppStore(createSafeAppPreferencesStorage(futureBackend));
    expect(futureStore.getState().selectedBodyId).toBe(
      DEFAULT_APP_PREFERENCES.selectedBodyId,
    );
  });

  it.each([
    ['missing', undefined],
    ['string', '1'],
    ['negative', -1],
    ['non-integer', 1.25],
  ])('rejects a %s envelope version and rewrites defaults', (_label, version) => {
    const backend = new MemoryPreferenceBackend();
    backend.seed({
      ...(version === undefined ? {} : { version }),
      state: {
        ...DEFAULT_APP_PREFERENCES,
        selectedBodyId: 'mars',
        visualQuality: 'ultra',
      },
    });

    const store = createAppStore(createSafeAppPreferencesStorage(backend));

    expect(store.getState()).toMatchObject({
      selectedBodyId: DEFAULT_APP_PREFERENCES.selectedBodyId,
      visualQuality: DEFAULT_APP_PREFERENCES.visualQuality,
      preferencesHydrated: true,
    });
    expect(backend.readEnvelope()).toEqual({
      state: DEFAULT_APP_PREFERENCES,
      version: APP_PREFERENCES_VERSION,
    });
  });

  it('persists a complete preference reset across a fresh store hydration', () => {
    const backend = new MemoryPreferenceBackend();
    const storage = createSafeAppPreferencesStorage(backend);
    const store = createAppStore(storage);
    store.getState().setSelectedBodyId('neptune');
    store.getState().setCameraMode('chase');
    store.getState().setRenderScaleMode('true');
    store.getState().setVisualQuality('ultra');
    store.getState().setVenusSurfaceMode('radar');
    store.getState().setOrbitLinesVisible(false);
    store.getState().setBodyLabelsVisible(false);
    store.getState().setSkyBackgroundVisible(false);
    store.getState().setBrightStarsVisible(false);
    store.getState().setCometsVisible(false);
    store.getState().setAsteroidBeltVisible(false);
    store.getState().setKuiperBeltVisible(true);
    store.getState().setSelectedTrailInterval('next');
    store.getState().setMotionPreference('full');
    store.getState().setReduceFlashes(false);

    const defaults = DEFAULT_APP_PREFERENCES;
    store.getState().setSelectedBodyId(defaults.selectedBodyId);
    store.getState().setCameraMode(defaults.cameraMode);
    store.getState().setRenderScaleMode(defaults.renderScaleMode);
    store.getState().setVisualQuality(defaults.visualQuality);
    store.getState().setVenusSurfaceMode(defaults.venusSurfaceMode);
    store.getState().setOrbitLinesVisible(defaults.orbitLinesVisible);
    store.getState().setBodyLabelsVisible(defaults.bodyLabelsVisible);
    store.getState().setSkyBackgroundVisible(defaults.skyBackgroundVisible);
    store.getState().setBrightStarsVisible(defaults.brightStarsVisible);
    store.getState().setCometsVisible(defaults.cometsVisible);
    store.getState().setAsteroidBeltVisible(defaults.asteroidBeltVisible);
    store.getState().setKuiperBeltVisible(defaults.kuiperBeltVisible);
    store.getState().setSelectedTrailInterval(defaults.selectedTrailInterval);
    store.getState().setMotionPreference(defaults.motionPreference);
    store.getState().setReduceFlashes(defaults.reduceFlashes);

    const reloadedStore = createAppStore(createSafeAppPreferencesStorage(backend));
    expect(reloadedStore.getState()).toMatchObject({
      ...DEFAULT_APP_PREFERENCES,
      preferencesHydrated: true,
    });
  });

  it('survives malformed JSON and unavailable browser storage', () => {
    const malformedBackend = new MemoryPreferenceBackend();
    malformedBackend.setItem(APP_PREFERENCES_STORAGE_KEY, '{not json');
    const malformedStore = createAppStore(
      createSafeAppPreferencesStorage(malformedBackend),
    );
    expect(malformedStore.getState()).toMatchObject({
      selectedBodyId: DEFAULT_APP_PREFERENCES.selectedBodyId,
      preferencesHydrated: true,
    });

    const throwingBackend: PreferenceStorageBackend = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      removeItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    };
    const fallbackStore = createAppStore(
      createSafeAppPreferencesStorage(throwingBackend),
    );
    expect(() => fallbackStore.getState().setReduceFlashes(false)).not.toThrow();
    expect(fallbackStore.getState()).toMatchObject({
      reduceFlashes: false,
      preferencesHydrated: true,
    });
  });
});

class MemoryPreferenceBackend implements PreferenceStorageBackend {
  private readonly values = new Map<string, string>();
  public writeCount = 0;

  public getItem(name: string): string | null {
    return this.values.get(name) ?? null;
  }

  public setItem(name: string, value: string): void {
    this.values.set(name, value);
    this.writeCount += 1;
  }

  public removeItem(name: string): void {
    this.values.delete(name);
  }

  public seed(value: unknown): void {
    this.setItem(APP_PREFERENCES_STORAGE_KEY, JSON.stringify(value));
  }

  public readEnvelope(): { version: number; state: Record<string, unknown> } {
    const raw = this.getItem(APP_PREFERENCES_STORAGE_KEY);
    if (raw === null) throw new Error('Expected a stored preference envelope.');
    return JSON.parse(raw) as { version: number; state: Record<string, unknown> };
  }
}
