import { useEffect, useRef, useState } from 'react';
import { ObservatoryDialog } from '../ui/observatory/ObservatoryDialog';
import './sharing.css';

export interface ShareDialogProps {
  readonly url: string | null;
  readonly linkNote: string;
  readonly canExport: boolean;
  readonly onImage: () => Promise<Blob>;
  readonly onClose: () => void;
}
export function ShareDialog({ url, linkNote, canExport, onImage, onClose }: ShareDialogProps) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image); }, [image]);
  const copy = async () => {
    try {
      if (!url || !navigator.clipboard) throw new Error('manual');
      await navigator.clipboard.writeText(url); setMessage('Link copied.');
    } catch {
      input.current?.focus(); input.current?.select();
      setMessage('Select and copy the link below using your browser.');
    }
  };
  const save = async () => {
    if (busy) return;
    setBusy(true); setMessage('Preparing PNG…');
    try {
      const blob = await onImage();
      if (!mounted.current) return;
      setImage(URL.createObjectURL(blob));
      setMessage('PNG ready. Save it below; on a phone you can also open the image and save it from the browser.');
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : 'The image could not be exported.');
    } finally { if (mounted.current) setBusy(false); }
  };
  return <ObservatoryDialog open title="Share & save view" testId="share-dialog" onClose={onClose}>
    <h3>Share a view</h3>
    <p>{linkNote}</p>
    {url ? <>
      <label className="share-link-label" htmlFor="shared-view-link">View link</label>
      <input ref={input} id="shared-view-link" data-testid="shared-view-link" readOnly value={url} onFocus={event => event.currentTarget.select()} />
      <button type="button" className="button button-secondary" onClick={() => void copy()}>Copy link</button>
      {new URL(url).hostname === '127.0.0.1' || new URL(url).hostname === 'localhost' ? <p>This is a local preview link. It works only where this local server is reachable.</p> : null}
    </> : null}
    <h3>Save an image</h3>
    <p>Export the 3D scene with visible names, UTC date, scale and teaching or scenario context.</p>
    <button type="button" className="button button-secondary" data-testid="prepare-scene-image" disabled={!canExport || busy} onClick={() => void save()}>{busy ? 'Preparing…' : 'Prepare PNG'}</button>
    {!canExport ? <p>The image needs an available 3D renderer.</p> : null}
    <p role="status" aria-live="polite">{message}</p>
    {image ? <div className="share-image-result">
      <a className="button button-primary" data-testid="download-scene-image" href={image} download="solar-system-view.png">Save PNG</a>
      <a className="button button-secondary" href={image} target="_blank" rel="noreferrer">Open image</a>
      <img src={image} alt="Exported Solar System scene with date and scale caption" />
    </div> : null}
  </ObservatoryDialog>;
}
