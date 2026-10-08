import fs from 'node:fs';
const edit=(path,fn)=>fs.writeFileSync(path,fn(fs.readFileSync(path,'utf8')));
edit('src/main.ts',s=>{
 s=s.replace("  review.style.cssText = 'position:fixed;top:78px;left:12px;z-index:9999;background:#17222fe8;padding:9px;border-radius:8px;color:white;font:13px system-ui'\n  review.textContent = 'Blender v9.1 - floors and stairs | Seats: '",`  review.setAttribute('role', 'group')
  review.setAttribute('aria-label', 'Review controls')
  const reviewTitle = document.createElement('span')
  reviewTitle.className = 'bv-review-title'
  reviewTitle.textContent = 'Blender v9.2 - floors and stairs'
  review.append(reviewTitle)
  const appendReviewField = (name: string, control: HTMLSelectElement) => {
    const label = document.createElement('label')
    label.className = 'bv-review-field'
    label.append(name, control)
    review.append(label)
  }`);
 if(s.includes('review.style.cssText'))throw Error('Review style replacement failed');
 s=s.replace('  review.append(select)',"  appendReviewField('Seats:', select)");
 s=s.replace("  review.append(' | Feet: ', feet)","  appendReviewField('Feet:', feet)");
 s=s.replace("  review.append(' | Walk: ', pace); mountReviewLocations(engine, review); uiHost.append(review)","  appendReviewField('Walk:', pace)\n  mountReviewLocations(engine, review)");
 s=s.replace('  const stats = new StatsPanel(uiHost)',`  const stats = new StatsPanel(uiHost)
  // Keep menus in document flow: wrapped controls and location notes push panels down.
  const menuStack = document.createElement('div')
  menuStack.className = 'bv-menu-stack'
  const panels = document.createElement('div')
  panels.className = 'bv-menu-panels'
  for (const selector of ['.bv-layers-rail', '.bv-views-rail', '.bv-inspect-rail', '.bv-stats-cluster']) {
    const panel = uiHost.querySelector<HTMLElement>(selector)
    if (panel) panels.append(panel)
  }
  const top = uiHost.querySelector<HTMLElement>('.bv-top')!
  menuStack.append(top, review, panels)
  uiHost.append(menuStack)`);
 return s;
});
edit('src/ReviewLocations.ts',s=>s.replace("const note = document.createElement('div'); note.style.cssText='max-width:600px;margin-top:5px;font-size:12px'","const note = document.createElement('div'); note.className = 'bv-review-note'").replace("  host.append(' | Location: ',select,note)",`  const label = document.createElement('label')
  label.className = 'bv-review-field'
  label.append('Location:', select)
  host.append(label, note)`));
edit('src/ui/styles.css',s=>s+`
/* Review menus share a scrollable flow instead of competing absolute offsets. */
.bv-menu-stack {
  position: absolute;
  top: var(--bv-safe-top);
  left: var(--bv-safe-left);
  right: var(--bv-safe-right);
  max-height: calc(100% - var(--bv-safe-top) - var(--bv-safe-bottom) - 140px);
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
  overscroll-behavior: contain;
  pointer-events: none;
  z-index: 5;
}

.bv-menu-stack > * {
  flex-shrink: 0;
}

.bv-menu-stack .bv-top {
  position: static;
  flex-wrap: wrap;
}

.bv-menu-stack .bv-brand-block {
  max-width: 100%;
  width: fit-content;
}

.bv-menu-stack .bv-dock {
  flex: 1;
  min-width: 0;
  max-width: none;
}

.bv-menu-stack .bv-seg {
  flex-wrap: wrap;
}

.bv-review-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  width: fit-content;
  max-width: 100%;
  padding: 10px;
  border: 1px solid var(--bv-border);
  border-radius: var(--bv-radius);
  background: var(--bv-panel-strong);
  color: var(--bv-text);
  font: 12px/1.4 var(--bv-font);
}

.bv-review-title {
  font-weight: 600;
}

.bv-review-field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-width: 0;
}

.bv-review-field select {
  min-width: 0;
  max-width: 100%;
  min-height: 26px;
}

.bv-review-note {
  flex-basis: 100%;
  overflow-wrap: anywhere;
  color: var(--bv-muted);
}

.bv-review-note:empty {
  display: none;
}

.bv-menu-panels {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px;
}

.bv-menu-panels > .bv-layers-rail,
.bv-menu-panels > .bv-views-rail,
.bv-menu-panels > .bv-inspect-rail,
.bv-menu-panels > .bv-stats-cluster {
  position: static;
  inset: auto;
  max-width: 100%;
  flex-shrink: 0;
}

.bv-menu-panels > .bv-stats-cluster {
  margin-left: auto;
}
`);
