import { useEffect, useState } from 'react';
import type { StartupProgress } from '../../app/StartupProgress';

export function StartupScreen({ progress, ready, error }: {
  readonly progress: StartupProgress;
  readonly ready: boolean;
  readonly error: string | null;
}) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!ready || error !== null) return;
    // Allow the completed first frame and 100% state to paint before revealing the scene.
    const timer = window.setTimeout(() => setDismissed(true), 200);
    return () => window.clearTimeout(timer);
  }, [ready, error]);
  if (dismissed) return null;
  const percent = ready && error === null ? 100 : progress.percent;
  const stage = error !== null ? 'Unable to start the observatory'
    : ready ? 'Observatory ready' : progress.percent >= 95 ? 'Preparing the first 3D view' : progress.stage;
  return <div className="startup-screen" data-testid="startup-screen" aria-busy={!ready && error === null}>
    <div className="startup-card">
      <span className="eyebrow">Solar System</span>
      <h1>Living Observatory</h1>
      <p className="startup-percent" aria-hidden="true">{percent}%</p>
      <progress max={100} value={percent} aria-label="Observatory loading progress" />
      <p role="status" aria-live="polite">{stage}</p>
      {error !== null ? <><p role="alert">{error}</p><button type="button" onClick={() => window.location.reload()}>Try again</button></>
        : <p className="startup-detail">{(progress.loadedBytes / 1_000_000).toFixed(1)} MB orbital data received · checking data and preparing graphics</p>}
    </div>
  </div>;
}
