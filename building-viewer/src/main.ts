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

  const engine = new ViewerEngine({ canvas, debug })
  const toolbar = new ViewerToolbar(uiHost, engine)
  const stats = new StatsPanel(uiHost)
  const loading = new LoadingScreen(uiHost)
  const pegmanUi = new PegmanControl(uiHost, (e) => engine.beginPegmanDrag(e))
  engine.setPegmanStatusElement(pegmanUi.status)

  mountDropTarget(uiHost, (file) => {
    void engine.loadLocalGlb(file)
  })

  engine.setEvents({
    onLoading: (p) => {
      if (p.stage === 'ready') loading.hide()
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
