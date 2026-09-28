export function LinarLoading({
  viewport = false,
  error = false,
}: {
  viewport?: boolean
  error?: boolean
}) {
  return (
    <div className={viewport ? 'linar-loading linar-loading--viewport' : 'linar-page linar-page--gate'}>
      <div className={viewport ? 'linar-loading__content' : 'linar-gate'}>
        <div className="linar-gate__panel" role={error ? 'alert' : 'status'} aria-live="polite">
          <p className="linar-gate__brand">dukta · LINAR concept</p>
          <p className="linar-gate__hint">
            {error
              ? 'LINAR could not finish loading. Please try again.'
              : viewport
                ? 'Preparing the 3D view…'
                : 'Loading the configurator…'}
          </p>
          {error ? (
            <button className="linar-gate__submit" type="button" onClick={() => window.location.reload()}>
              Reload LINAR
            </button>
          ) : (
            <span className="linar-loading__line" aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  )
}
