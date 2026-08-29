export function LoadingScreen({ progress, visible }) {
  return (
    <div className={`loading-screen ${visible ? '' : 'is-hidden'}`} aria-hidden={!visible}>
      <p className="kicker">Marini Made Harps</p>
      <p className="loading-title">Preparing the instrument</p>
      <div className="loading-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <span style={{ transform: `scaleX(${Math.max(0.04, progress)})` }} />
      </div>
    </div>
  )
}

export function ErrorScreen({ error }) {
  if (!error) return null
  return (
    <div className="error-screen">
      <p className="kicker">Unable to load</p>
      <h1>The instrument could not be presented.</h1>
      <p>Please refresh the page. If the problem continues, the model file may be missing from this host.</p>
    </div>
  )
}
