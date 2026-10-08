import { mountReviewLocations } from './ReviewLocations'
import './ui/styles.css'
import { ensureBuildingViewerAccess } from './auth'
import { ViewerEngine } from './ViewerEngine'
import {
  ViewerToolbar,
  StatsPanel,
  LoadingScreen,
  PegmanControl,
  mountDropTarget,
  showToast,
} from './ui/ViewerUI'

async function boot() {
  const params = new URLSearchParams(location.search)
  const debug = params.get('debug') === '1' || params.get('collisionDebug') === '1'

  const canvas = document.querySelector<HTMLCanvasElement>('#viewer-canvas')
  const uiHost = document.querySelector<HTMLElement>('#viewer-ui')
  if (!canvas || !uiHost) {
    throw new Error('Viewer DOM not found')
  }

  await ensureBuildingViewerAccess(uiHost)

  const engine = new ViewerEngine({ canvas, debug, manifestUrl: '/models/manifest-review-v6.json', characterUrl: '/models/review-v4/Xbot-stairs-v4.glb' })
  const review = document.createElement('div')
  review.className = 'bv-review-toolbar'
  review.setAttribute('role', 'group')
  review.setAttribute('aria-label', 'Review controls')
  const reviewTitle = document.createElement('span')
  reviewTitle.className = 'bv-review-title'
  reviewTitle.textContent = 'Blender v11.2 - stair teleports'
  review.append(reviewTitle)
  const appendReviewField = (name: string, control: HTMLSelectElement) => {
    const label = document.createElement('label')
    label.className = 'bv-review-field'
    label.append(name, control)
    review.append(label)
  }
  const select = document.createElement('select')
  for (const [value, label] of [['auto', 'Automatic'], ['lod0', 'LOD0 original'], ['lod1', 'LOD1 candidate']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option)
  }
  select.onchange = () => engine.reviewSeats.setMode(select.value as 'auto' | 'lod0' | 'lod1')
  appendReviewField('Seats:', select)
  const pace = document.createElement('select')
  for (const [value, label] of [['1.6', 'Normal'], ['0.35', 'Slow (stairs)']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = label; pace.append(option)
  }
  pace.setAttribute('aria-label', 'Walking speed')
  select.setAttribute('aria-label', 'Seat LOD')
  engine.controller.params.walkSpeed = 1.6
  pace.onchange = () => { engine.controller.params.walkSpeed = Number(pace.value) }
  const feet = document.createElement('select')
  feet.setAttribute('aria-label', 'Foot placement')
  for (const [value, label] of [['on', 'Fit to steps'], ['off', 'Original animation']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = label; feet.append(option)
  }
  feet.onchange = () => engine.character.setFootIKEnabled(feet.value === 'on')
  appendReviewField('Feet:', feet)
  appendReviewField('Walk:', pace)
  mountReviewLocations(engine, review)
  const toolbar = new ViewerToolbar(uiHost, engine)
  const stats = new StatsPanel(uiHost)
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
  uiHost.append(menuStack)
  const loading = new LoadingScreen(uiHost)
  const pegmanUi = new PegmanControl(uiHost, (e) => engine.beginPegmanDrag(e))
  engine.setPegmanStatusElement(pegmanUi.status)

  mountDropTarget(uiHost, (file) => {
    void engine.loadLocalGlb(file)
  })

  engine.setEvents({
    onLoading: (p) => {
      if (p.stage === 'ready') {
        // Model loads reset controller defaults; keep the selected pace in sync.
        engine.controller.params.walkSpeed = Number(pace.value)
        loading.hide()
      }
      else loading.set(p.message, p.ratio)
    },
    onStats: (s) => stats.renderStatic(s),
    onLiveStats: (s) => stats.renderLive(s),
    onMode: (m) => toolbar.setMode(m),
    onWalkLock: (locked) => toolbar.setWalkLock(locked),
    onDaylight: (id) => toolbar.setDaylight(id),
    onQuality: (id) => toolbar.setQuality(id),
    onError: (msg) => showToast(uiHost, msg),
    onModels: (models, visibleIds) => toolbar.setModels(models, visibleIds),
    onAnimation: (state) => toolbar.setAnimation(state),
    onCameraViews: (views, activeId) => toolbar.setCameraViews(views, activeId),
    onXrSupport: (supported) => toolbar.setXrSupported(supported),
    onInspect: (info) => toolbar.setInspectPick(info),
  })

  ;(window as unknown as { __iomBuildingViewer?: ViewerEngine }).__iomBuildingViewer = engine
  ;(window as unknown as { __iomQuestTest?: typeof engine.questTest }).__iomQuestTest = engine.questTest
}

void boot()
