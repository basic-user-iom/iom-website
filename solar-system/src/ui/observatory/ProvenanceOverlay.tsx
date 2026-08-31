import type { RenderScaleMode } from '../../rendering/RenderScaleModel';
import type {
  ObservatoryCameraMode,
  SimulationUiSnapshot,
} from '../../state/useAppStore';
import { ObservatoryDialog } from './ObservatoryDialog';

export interface ProvenanceOverlayProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly selectedBodyId: string;
  readonly selectedBodyName: string;
  readonly providerLabel: string;
  readonly providerStatus: string;
  readonly providerCoverage: string;
  readonly providerMessage: string | null;
  readonly snapshot: Readonly<SimulationUiSnapshot>;
  readonly cameraMode: ObservatoryCameraMode;
  readonly renderScaleMode: RenderScaleMode;
  readonly presentationWarningRequired: boolean;
  readonly ephemerisValidationUrl: string;
  readonly smallBodyValidationUrl: string;
  readonly surfaceAssetManifestUrl: string;
}

export function ProvenanceOverlay({
  open,
  onClose,
  selectedBodyId,
  selectedBodyName,
  providerLabel,
  providerStatus,
  providerCoverage,
  providerMessage,
  snapshot,
  cameraMode,
  renderScaleMode,
  presentationWarningRequired,
  ephemerisValidationUrl,
  smallBodyValidationUrl,
  surfaceAssetManifestUrl,
}: ProvenanceOverlayProps) {
  return (
    <ObservatoryDialog
      open={open}
      title="Data providers and provenance"
      description="Authoritative source identity is kept separate from interpolation, rendering, and statistical context."
      onClose={onClose}
      className="provenance-overlay"
      testId="provenance-overlay"
    >
      <section aria-labelledby="runtime-provenance-heading">
        <h3 id="runtime-provenance-heading">Current runtime state</h3>
        <dl className="provenance-facts">
          <ProvenanceFact label="Selected object" value={`${selectedBodyName} · ${selectedBodyId}`} />
          <ProvenanceFact label="Provider" value={providerLabel} />
          <ProvenanceFact label="Provider status" value={providerStatus} />
          <ProvenanceFact label="Coverage" value={providerCoverage} />
          <ProvenanceFact label="Provider message" value={providerMessage ?? 'No active warning'} />
          <ProvenanceFact label="UTC display" value={snapshot.currentUtcIso} />
          <ProvenanceFact label="Julian date · TDB field" value={snapshot.currentJdTdb.toFixed(6)} />
          <ProvenanceFact label="Camera" value={cameraMode} />
          <ProvenanceFact label="Render scale" value={renderScaleMode} />
          <ProvenanceFact
            label="Scale disclosure"
            value={
              presentationWarningRequired
                ? 'Presentation geometry contributes; body sizes are exaggerated.'
                : 'Physical radius-to-distance ratios are preserved.'
            }
          />
        </dl>
      </section>
      <section aria-labelledby="source-records-heading">
        <h3 id="source-records-heading">Pinned source records</h3>
        <ul className="provenance-links">
          <ProvenanceLink href={ephemerisValidationUrl} label="Planetary ephemeris validation" />
          <ProvenanceLink href={smallBodyValidationUrl} label="Small-body ephemeris validation" />
          <ProvenanceLink href={surfaceAssetManifestUrl} label="Surface asset source manifest" />
        </ul>
        <p>
          Runtime translations use generated JPL Horizons vectors. Surface maps and sky assets
          retain their pinned source manifests; comet appearance and belt particles are labeled
          educational or statistical visualizations where appropriate.
        </p>
      </section>
    </ObservatoryDialog>
  );
}

function ProvenanceFact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ProvenanceLink({ href, label }: { readonly href: string; readonly label: string }) {
  return (
    <li>
      <a href={href} target="_blank" rel="noreferrer">
        {label} <span className="sr-only">(opens in a new tab)</span>
      </a>
    </li>
  );
}
