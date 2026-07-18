/**
 * Per-project editorial overrides for demo blog posts.
 * Shared structure comes from projects.ts via generate-demo-blog-posts.mjs
 */
export const DEMO_BLOG_OVERRIDES = {
  '3d-viewer': {
    pageTitle: '3D Viewer — product models in the browser',
    demoLabel: '3D Viewer',
    hook: 'Clients should not need a CAD seat to review a model. Our 3D Viewer puts GLTF, FBX, OBJ, and IFC in a shareable browser (and desktop) window — orbit, inspect materials, path-trace when you need the look, and hotspot the story.',
    coverNote: 'The cover shows a typical product-review framing from the viewer.',
    whyBullets: [
      '- **Share a link, not a ZIP** — stakeholders open the model on a laptop during a call',
      '- **One viewer for many formats** — fewer “which app opens this?” emails',
      '- **Pitch-ready lighting** — path tracing and HDR when the still has to sell',
      '- **Hotspots for narrative** — call out parts, options, or next steps on the mesh',
    ],
    whyUses:
      'product configurators, architecture reviews, trade-show tablets, async client approvals, and standalone web presentations exported from the same pipeline.',
    beginner:
      'A 3D viewer is like a photo of your product that you can spin. Instead of flat images, the real model sits in the page — drag to turn it, zoom into details, and (when enabled) see richer lighting. No install for the web build; a Windows desktop build covers offline or heavier assets.',
    glossary: [
      { term: 'GLTF / GLB', def: 'common web-friendly 3D file formats ([Khronos glTF](https://www.khronos.org/gltf/))' },
      { term: 'Orbit', def: 'drag to rotate the camera around the model' },
      { term: 'Path tracing', def: 'slower, more realistic lighting for hero stills' },
      { term: 'Hotspot', def: 'a clickable marker on the model with info or a link' },
      { term: 'HDR environment', def: 'a high-dynamic-range sky/lighting map that wraps the scene' },
    ],
    trySteps: [
      'Open the [3D Viewer](https://3dbviewer.com/)',
      'Load a sample or your own GLTF/GLB if the build allows import',
      'Drag to orbit; scroll to zoom; try lighting / environment presets',
      'If hotspots are present, click one to see how narrative layers work',
    ],
    requirements: [
      '**Browser:** modern Chrome, Edge, or Firefox for the web build',
      '**Files:** prefer GLB/GLTF for web; heavy CAD may need conversion first',
      '**GPU:** path tracing wants a decent GPU — fall back to raster for light devices',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Orbit framing — product readable against a clean ground' },
    viewB: { file: 'view-b.jpg', caption: 'Closer detail pass — materials, silhouette, and lighting' },
    alsoCan: [
      'Switch environments / HDR for different moods',
      'Use path tracing for stills when quality beats real-time speed',
      'Export a standalone web presentation for client handoff',
    ],
    howWorks:
      'The viewer is built on the [Three.js](https://threejs.org/) family with a focus on practical review: load meshes, frame them, and present lighting that sells the object. Desktop builds extend the same idea when offline or large assets matter. Format support follows real client pipelines — the goal is always “open, understand, decide.” Live product: [3dbviewer.com](https://3dbviewer.com/).',
    faq: [
      {
        q: 'Do clients need CAD software?',
        a: 'No for review — a browser link is enough for most stakeholders.',
      },
      {
        q: 'Can we brand it?',
        a: 'Yes. Viewer chrome, environments, and hotspot content can follow your brand.',
      },
    ],
    reading: [
      { label: '3D Viewer live', url: 'https://3dbviewer.com/' },
      { label: 'glTF overview — Khronos', url: 'https://www.khronos.org/gltf/' },
      { label: 'Three.js', url: 'https://threejs.org/' },
      { label: 'WebGL — MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API' },
    ],
    related: [
      { label: 'Image Prep', url: '/blog/image-prep' },
      { label: 'Volumetric Lighting', url: '/blog/volume-lighting' },
    ],
  },

  'streets-gl-bridge': {
    pageTitle: 'Streets GL Bridge — OSM city context for 3D models',
    demoLabel: 'Streets GL Bridge',
    hook: 'A beautiful model still needs a place to stand. Streets GL Bridge explores OpenStreetMap 3D city context as a ground layer — so geolocated assets can sit in a recognizable streetscape instead of an empty void.',
    coverNote: 'The cover shows the map/bridge framing used on the portfolio card.',
    whyBullets: [
      '- **Location sells the story** — clients recognize the block, not just the mesh',
      '- **Open map data** — OSM as a living city layer under your asset',
      '- **Bridge mindset** — connect your model pipeline to a navigable ground',
      '- **Open-source DNA** — built around the Streets GL ecosystem',
    ],
    whyUses:
      'urban proposals, site-context slides, geolocated product or architecture previews, and “where does this sit on the street?” conversations before a full GIS build.',
    beginner:
      'Think of Google Earth vibes, but aimed at putting your 3D object into a real street grid. The map is the stage; the model is the actor. You orbit and explore instead of staring at a grey infinite floor.',
    glossary: [
      { term: 'OSM', def: 'OpenStreetMap — community-built map data ([openstreetmap.org](https://www.openstreetmap.org/))' },
      { term: 'Ground layer', def: 'the city, roads, and terrain under your model' },
      { term: 'Geolocated', def: 'placed at a real latitude/longitude on Earth' },
      { term: 'WebGL', def: 'the browser GPU API that draws the 3D map ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API))' },
    ],
    trySteps: [
      'Open the [Streets GL Bridge demo](/demos/streets-gl/)',
      'Wait for the map embed to settle',
      'Pan and zoom the city context (or compare with the [live Streets GL map](https://streets.gl/))',
      'Imagine dropping a client building or kiosk on a known corner',
    ],
    requirements: [
      '**Network:** map tiles and the embed need a connection',
      '**Browser:** modern Chromium recommended for WebGL map views',
      '**Performance:** dense cities are heavier — zoom in for smoother exploration',
    ],
    viewA: { file: 'view-a.jpg', caption: 'City fabric — streets and massing as context' },
    viewB: { file: 'view-b.jpg', caption: 'Closer urban reading — where a model would sit' },
    alsoCan: [
      'Use as a reference layer while placing geolocated GLBs',
      'Point stakeholders at the live [streets.gl](https://streets.gl/) map',
      'Pair with Simple 3D Buildings concepts from OSM',
    ],
    howWorks:
      'Streets GL renders OSM-derived 3D city structure in the browser. Our bridge page hosts that context for IOM workflows — a practical “where does this sit?” layer rather than a full GIS suite. Upstream project: [StrandedKitty/streets-gl](https://github.com/StrandedKitty/streets-gl); live map at [streets.gl](https://streets.gl/).',
    faq: [
      {
        q: 'Is this Google Maps?',
        a: 'No — it builds on OpenStreetMap and the open Streets GL tooling.',
      },
      {
        q: 'Can we drop our building in?',
        a: 'That is the intent of the bridge: geolocated models over city context. Ask us for a scoped integration.',
      },
    ],
    reading: [
      { label: 'Streets GL live map', url: 'https://streets.gl/' },
      { label: 'streets-gl on GitHub', url: 'https://github.com/StrandedKitty/streets-gl' },
      {
        label: 'OSM Simple 3D Buildings',
        url: 'https://wiki.openstreetmap.org/wiki/Simple_3D_Buildings',
      },
      { label: 'WebGL — Wikipedia', url: 'https://en.wikipedia.org/wiki/WebGL' },
    ],
    related: [
      { label: 'Artist Globe', url: '/blog/artist-globe' },
      { label: '3D Viewer', url: '/blog/3d-viewer' },
    ],
  },

  'panorama-360-tour': {
    pageTitle: '360° Panorama Tour Editor — build guided walks in the browser',
    demoLabel: '360° Panorama Tour Editor',
    hook: 'Trade visitors remember experiences. This editor lets you load equirectangular panoramas, place hotspots, chain multi-scene tours, and save a `.360project` — all in the browser, opening on The Black Witness by default.',
    coverNote: 'The cover is guided-tour step 1 on The Black Witness — raven hotspot + popup.',
    whyBullets: [
      '- **Editor + visitor in one stack** — build the tour, then share a preview link',
      '- **Hotspots that explain** — info, scene links, and optional iframe popups',
      '- **Multi-scene tours** — move guests from booth to product line to venue',
      '- **Project files you keep** — save and reload `.360project` between sessions',
    ],
    whyUses:
      'trade-show companions, venue walkthroughs, product-line stories, museum soft launches, and client approvals before a full production tour build.',
    beginner:
      'A 360° panorama is a photo that wraps all the way around you — like standing in the middle of a room. The editor is the tool that turns those photos into a tour: clickable markers (hotspots), links between rooms, and a path guests can follow without downloading an app.',
    glossary: [
      { term: 'Equirectangular', def: 'a common 360° image layout (full sphere flattened to a rectangle)' },
      { term: 'Hotspot', def: 'a clickable marker — info, a scene jump, or a URL/iframe' },
      { term: 'Guided tour', def: 'a scripted sequence of camera stops, popups, and optional effects' },
      { term: '.360project', def: 'IOM’s save file for panoramas, hotspots, and tour settings' },
      { term: 'WebGPU birds', def: 'optional flock effect layered on the tour (GPU-backed)' },
    ],
    trySteps: [
      'Open the [360° Panorama Tour Editor](/demos/panorama-360/) (or [visitor preview](/demos/panorama-360/?mode=preview))',
      'Click **Play guided tour** and watch the four Black Witness steps',
      'Stop the tour and click hotspots yourself — raven, fire, water, birds',
      'In the editor, select each STEPS row to jump the camera and edit that beat',
    ],
    requirements: [
      '**Browser:** modern Chrome or Edge recommended; WebGPU features need a capable GPU',
      '**Images:** equirectangular JPG, PNG, WebP; HDR/EXR/KTX2 when the pipeline supports them',
      '**Mobile:** viewing works; editing is more comfortable on desktop',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Step 2 — animated fire hotspot and particle popup' },
    viewB: { file: 'view-b.jpg', caption: 'Step 3 — water / spout beat on the rooftop' },
    viewC: { file: 'view-c.jpg', caption: 'Step 4 — sky look for the interactive birds layer' },
    alsoCan: [
      'Chain multiple panoramas into a guided multi-scene tour',
      'Add URL or iframe popups on hotspots for product pages or embeds',
      'Toggle WebGPU birds as a living atmospheric layer',
    ],
    howWorks:
      'Panoramas are mapped onto a sphere (or cube pipeline) so the camera sits at the center — the classic web 360 approach powered by [Three.js](https://threejs.org/) and modern browser APIs ([WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) / optional [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)). Hotspots are scene metadata: position, type, and target. Visitor preview is the same engine without editor chrome — see [The Black Witness tour](/blog/panorama-suite).',
    faq: [
      {
        q: 'Do guests need an app?',
        a: 'No. Share a browser link. Preview mode hides the editor so visitors only see the tour.',
      },
      {
        q: 'Can we use our own panoramas?',
        a: 'Yes — load equirectangular stills into the editor and build hotspots around your venue or product.',
      },
    ],
    reading: [
      { label: 'Live tour editor', url: '/demos/panorama-360/' },
      { label: 'Three.js', url: 'https://threejs.org/' },
      { label: 'WebGPU — MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API' },
      {
        label: 'Equirectangular projection — Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Equirectangular_projection',
      },
    ],
    related: [
      { label: 'The Black Witness — 360° Tour', url: '/blog/panorama-suite' },
      { label: 'Raven Path Animation', url: '/blog/raven-path' },
    ],
  },

  'crm-demo': {
    pageTitle: 'CRM Demo — try the IOM client sandbox',
    demoLabel: 'CRM Demo',
    hook: 'Want to see how IOM runs leads, projects, and time without touching live client data? The CRM demo is an interactive sandbox with fictional companies — pipeline, boards, ideas, and blog drafts that stay in this browser tab.',
    coverNote: 'The cover shows the CRM sandbox UI from the portfolio card.',
    whyBullets: [
      '- **Safe to click everything** — edits never hit production databases',
      '- **Full workspace feel** — leads, projects, time, ideas, and sample blog posts',
      '- **Pitch in a meeting** — open `/crm-demo` and walk the flow live',
      '- **Same product family** — mirrors the real client CRM at `/client-login`',
    ],
    whyUses:
      'sales demos, onboarding walkthroughs, stakeholder training, and “what would our pipeline look like?” conversations before a real workspace is provisioned.',
    beginner:
      'A CRM (customer relationship management) tool is where a studio tracks who inquired, which projects are active, and how time is spent. This demo is a practice kitchen: the recipes are real, the ingredients are fictional, and nothing you type leaves your tab unless you export it yourself.',
    glossary: [
      { term: 'Sandbox', def: 'a practice copy of the app with fake data that resets safely' },
      { term: 'Pipeline', def: 'stages a lead moves through before it becomes a project' },
      { term: 'In-memory', def: 'data lives in this browser session, not on the live server' },
      { term: 'Client login', def: 'the real CRM at `/client-login` with Supabase-backed data' },
    ],
    trySteps: [
      'Open the [CRM Demo](/crm-demo)',
      'Browse Leads or Projects — open a fictional company card',
      'Make a small edit (status, note, or board card) to feel the sandbox',
      'Optional: open Blog in the demo CRM and Preview a sample post',
    ],
    requirements: [
      '**Browser:** any modern desktop browser; a wide window helps for boards',
      '**Privacy:** sandbox data stays local to the tab — refresh may reset the store',
      '**Not production:** never enter real client secrets here; use `/client-login` for live work',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Pipeline view — fictional leads in stage columns' },
    viewB: { file: 'view-b.jpg', caption: 'Project board — tasks and context for a demo company' },
    alsoCan: [
      'Explore time tracking and idea maps with sample entries',
      'Reset the demo workspace when you want a clean slate',
      'Compare the sandbox feel with the real CRM after login',
    ],
    howWorks:
      'The public [CRM demo](/crm-demo) uses an in-memory store so every click is disposable. The production CRM at `/client-login` talks to Supabase for real staff and client data. Same UI language, different backend — so a pitch never risks a live record.',
    faq: [
      {
        q: 'Will my edits show up for other visitors?',
        a: 'No. The sandbox is per browser tab / session. Other people see their own copy of the fictional data.',
      },
      {
        q: 'Is this the same as client login?',
        a: 'Same product family and screens, but `/crm-demo` never touches live databases. Real work happens at `/client-login`.',
      },
    ],
    reading: [
      { label: 'CRM Demo', url: '/crm-demo' },
      { label: 'Client login', url: '/client-login' },
      { label: 'IOM home', url: '/' },
    ],
    related: [
      { label: '360° Panorama Tour Editor', url: '/blog/panorama-360-tour' },
      { label: 'Image Prep', url: '/blog/image-prep' },
    ],
  },

  'image-prep': {
    pageTitle: 'Image Prep — resize, compress, and strip EXIF in the browser',
    demoLabel: 'Image Prep',
    hook: 'Portfolio and web images should be sharp, light, and private. Image Prep resizes to common presets, compresses JPEG/WebP/PNG, and strips camera/GPS EXIF — files stay on your device until you download the result.',
    coverNote: 'The cover shows the Image Prep tool UI from the software card.',
    whyBullets: [
      '- **Stay on-device** — no upload to a mystery server for a quick resize',
      '- **Web-ready presets** — portfolio and site sizes without Photoshop gymnastics',
      '- **Privacy by default** — strip EXIF so GPS and camera metadata do not leak',
      '- **Less weight, same story** — compress for faster pages and quieter CDN bills',
    ],
    whyUses:
      'prepping hero stills, gallery uploads, CRM/blog covers, and client handoff packs before they hit a CMS or demo page.',
    beginner:
      'Before a photo goes on a website, it usually needs three favors: the right pixel size, a smaller file, and less personal data in the file header. Image Prep does those favors in the browser — drag in a picture, pick a preset, download a cleaner version.',
    glossary: [
      { term: 'EXIF', def: 'metadata cameras embed (settings, timestamps, sometimes GPS)' },
      { term: 'Compress', def: 'reduce file size, often with a quality slider' },
      { term: 'WebP', def: 'a modern image format that is often smaller than JPEG at similar quality' },
      { term: 'On-device', def: 'processing happens in your browser; you choose when to download' },
    ],
    trySteps: [
      'Open [Image Prep](/tools/image-prep)',
      'Drop in a JPG or PNG from your machine',
      'Pick a resize preset and a format (JPEG / WebP / PNG)',
      'Enable EXIF strip if needed, then download the result',
    ],
    requirements: [
      '**Browser:** modern Chrome, Edge, or Firefox with canvas support',
      '**Privacy:** processing is local — still avoid pasting secrets into unrelated fields',
      '**Limits:** extremely large raws may need a first pass in a desktop editor',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Tool layout — source image and prep controls' },
    viewB: { file: 'view-b.jpg', caption: 'After prep — web-sized output ready to download' },
    alsoCan: [
      'Batch a few portfolio stills to the same preset',
      'Export WebP when the destination site supports it',
      'Use before uploading covers for blog or CRM demo posts',
    ],
    howWorks:
      'The tool uses browser APIs (canvas / image decoding) to resize and re-encode on your machine. EXIF stripping removes embedded metadata so published files do not carry GPS or camera serials by accident. For format background see [MDN — Using files from web applications](https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications) and [EXIF — Wikipedia](https://en.wikipedia.org/wiki/Exif).',
    faq: [
      {
        q: 'Do my photos upload to IOM servers?',
        a: 'No for normal prep — work stays in the browser until you download. Use that download as the file you publish elsewhere.',
      },
      {
        q: 'Will quality look worse?',
        a: 'Compression always trades size for fidelity. Start with a high-quality preset; nudge down only if the file is still heavy.',
      },
    ],
    reading: [
      { label: 'Image Prep tool', url: '/tools/image-prep' },
      { label: 'EXIF — Wikipedia', url: 'https://en.wikipedia.org/wiki/Exif' },
      {
        label: 'WebP — Google developers',
        url: 'https://developers.google.com/speed/webp',
      },
      {
        label: 'File API — MDN',
        url: 'https://developer.mozilla.org/en-US/docs/Web/API/File_API',
      },
    ],
    related: [
      { label: '3D Viewer', url: '/blog/3d-viewer' },
      { label: '360° Panorama Tour Editor', url: '/blog/panorama-360-tour' },
    ],
  },

  'raven-path': {
    pageTitle: 'Raven Path Animation — spline flight in the browser',
    demoLabel: 'Raven Path Animation',
    hook: 'Sometimes the story is the motion, not the still. Raven Path puts a winged GLB on a Catmull-Rom spline — drag control points, tune speed and easing, reverse the route, and keep wing-flap animation playing while the bird follows the path.',
    coverNote: 'The cover shows the raven on its editable flight path.',
    whyBullets: [
      '- **Path as a design tool** — reshape the flight with visible control points',
      '- **Timing you can feel** — speed, ease-in/out, and reverse without re-exporting DCC',
      '- **Orientation choices** — tangent-aligned flight or a fixed heading',
      '- **Skeleton still alive** — wing-flap animation plays while the root follows the curve',
    ],
    whyUses:
      'hero loops for brand films, booth attract loops, narrative web chapters, and prototyping creature or product “travel” paths before a full animation pass.',
    beginner:
      'A spline is a smooth curve defined by a few handles — like a flexible wire in space. Here a raven model rides that wire. You pull the handles, and the flight updates live. No video edit; the path is the edit.',
    glossary: [
      { term: 'Catmull-Rom spline', def: 'a smooth curve that passes through control points' },
      { term: 'GLB', def: 'a packed 3D model file (meshes + animations) for the web' },
      { term: 'Tangent-aligned', def: 'the bird turns to face along the path direction' },
      { term: 'Skeletal animation', def: 'bones drive wing flaps while the whole bird moves' },
    ],
    trySteps: [
      'Open the [Raven Path demo](/demos/raven-path/)',
      'Watch the raven follow the default path once',
      'Drag a spline control point and see the route reshape',
      'Toggle speed, ease, reverse, or tangent vs fixed orientation',
    ],
    requirements: [
      '**Browser:** modern Chrome/Edge/Firefox with WebGL',
      '**GPU:** integrated graphics are usually enough for this scene',
      '**Input:** mouse or trackpad makes point editing easier than a phone',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Wide path view — curve and raven in one frame' },
    viewB: { file: 'view-b.jpg', caption: 'Closer flight — wing pose along the spline' },
    alsoCan: [
      'Compare with the related [spline editor](/demos/spline-editor/) experiment',
      'Study curve modifiers in the [WebGPU curve demo](/demos/webgpu-modifier-curve/)',
      'Reuse the path idea for product “tour” or camera fly-throughs',
    ],
    howWorks:
      'The demo uses [Three.js](https://threejs.org/) to sample a Catmull-Rom curve each frame, place the raven root on that sample, and optionally align its forward axis to the curve tangent while a GLB skeletal clip drives the wings. Same family of ideas as three.js curve and animation examples — tuned here for a readable creature loop.',
    faq: [
      {
        q: 'Can we swap the raven for our mascot?',
        a: 'Yes in a scoped build — replace the GLB and keep the path/timing UI. Ask us for a branded version.',
      },
      {
        q: 'Is this video or realtime?',
        a: 'Realtime WebGL. You can screen-record or export elsewhere, but the demo itself is a live scene.',
      },
    ],
    reading: [
      { label: 'Raven Path demo', url: '/demos/raven-path/' },
      { label: 'Three.js', url: 'https://threejs.org/' },
      {
        label: 'Catmull–Rom spline — Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline',
      },
      { label: 'Spline editor (related)', url: '/demos/spline-editor/' },
    ],
    related: [
      { label: 'The Black Witness — 360° Tour', url: '/blog/panorama-suite' },
      { label: 'Dream — Ocean scroll', url: '/blog/iom-three' },
    ],
  },

  'artist-globe': {
    pageTitle: 'Artist Globe — a living map of creative practice',
    demoLabel: 'Artist Globe',
    hook: 'Portfolios scatter across the web; geography still matters. Artist Globe is an interactive WebGL earth of photographers, painters, sculptors, sound artists, and more — filter by practice, open profiles, highlight countries, and submit a listing for review.',
    coverNote: 'The cover shows the globe with artist markers from the 3D card.',
    whyBullets: [
      '- **Discover by place** — spin the world instead of scrolling endless grids',
      '- **Filter by practice** — photographers, painters, sculptors, sound, and more',
      '- **Open real portfolios** — jump from a marker into an artist’s links',
      '- **Community loop** — submit a profile for review when you want to appear',
    ],
    whyUses:
      'cultural discovery, residency and festival scouting, studio networking, and portfolio features that need a spatial “who is where?” layer.',
    beginner:
      'Think of a desktop globe with pins for artists. You rotate it, filter who shows up, and click a pin to learn more. It is a map of people and practices, not a storefront checkout.',
    glossary: [
      { term: 'WebGL globe', def: 'a 3D Earth drawn in the browser with [Three.js](https://threejs.org/)-style graphics' },
      { term: 'Practice filter', def: 'show only certain disciplines (e.g. photography)' },
      { term: 'Profile', def: 'an artist card with links and country highlight' },
      { term: 'Submit for review', def: 'request to be added; editors approve before publish' },
    ],
    trySteps: [
      'Open [Artist Globe](/artist-globe)',
      'Drag to spin; scroll or pinch to zoom toward a region',
      'Use practice filters to narrow who appears',
      'Click a marker to open a profile, or follow the submit flow if you want to apply',
    ],
    requirements: [
      '**Browser:** modern desktop or mobile browser with WebGL',
      '**Network:** profiles and map assets need a connection',
      '**Performance:** reduce other GPU tabs if the globe feels heavy on older laptops',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Full globe — markers across continents' },
    viewB: { file: 'view-b.jpg', caption: 'Regional focus — country highlight and selected practice' },
    alsoCan: [
      'Highlight a country while pitching a regional cohort',
      'Share `/artist-globe` as a discovery landing page',
      'Embed-friendly mode exists for tighter portfolio frames (`?embed=1`)',
    ],
    howWorks:
      'The globe is a [Three.js](https://threejs.org/) / [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) scene: a textured sphere, camera controls, and marker sprites or meshes bound to lat/lon. Profile data and submissions are wired through the IOM web stack so the map stays curated rather than an unmoderated free-for-all.',
    faq: [
      {
        q: 'Can anyone appear on the globe?',
        a: 'Listings go through a submit-and-review path so the map stays useful and trustworthy.',
      },
      {
        q: 'Is this a social network?',
        a: 'No — it is a discovery map of creative practices with links out to portfolios.',
      },
    ],
    reading: [
      { label: 'Artist Globe', url: '/artist-globe' },
      { label: 'Three.js', url: 'https://threejs.org/' },
      { label: 'WebGL — MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API' },
      { label: 'IOM 3D section', url: '/#3d' },
    ],
    related: [
      { label: 'Streets GL Bridge', url: '/blog/streets-gl-bridge' },
      { label: 'Art Gallery — SSR + Denoise', url: '/blog/ssr-denoise' },
    ],
  },

  'ssr-denoise': {
    pageTitle: 'Art Gallery — WebGPU SSR + Denoise',
    demoLabel: 'Art Gallery — WebGPU SSR + Denoise',
    hook: 'Shiny floors and glass only feel real when reflections hold up. This gallery demo runs WebGPU screen-space reflections with spatiotemporal denoising — import GLTF/FBX, swap HDR/EXR skies, walk in third person, and compare raw vs cleaned reflections.',
    coverNote: 'The cover shows the gallery space with denoised reflections.',
    whyBullets: [
      '- **Reflections that hold** — SSR with denoise instead of a blurry smear',
      '- **Bring your own model** — load GLTF/FBX into the gallery shell',
      '- **Swap the sky** — HDR/EXR panoramas change mood in seconds',
      '- **Walk the space** — third-person explore for client-scale reading',
    ],
    whyUses:
      'interior product viz, gallery and showroom pitches, material reviews, and WebGPU R&D conversations about reflection quality vs frame rate.',
    beginner:
      'Screen-space reflections (SSR) fake mirrors and glossy floors by reusing what the camera already sees, instead of rendering a full second world. That can look noisy. Denoise is the cleanup pass that turns sparkly noise into a stable reflection — closer to what you expect from film lighting, still running live.',
    glossary: [
      { term: 'WebGPU', def: 'modern browser GPU API ([Wikipedia](https://en.wikipedia.org/wiki/WebGPU), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API))' },
      { term: 'SSR', def: 'screen-space reflections — glossy mirrors from what is on screen' },
      { term: 'Denoise', def: 'a filter that smooths noisy reflection samples over space/time' },
      { term: 'HDR / EXR', def: 'high-dynamic-range environment maps for lighting and sky' },
      { term: 'Third-person walk', def: 'move a character through the gallery instead of free-fly only' },
    ],
    trySteps: [
      'Open the [SSR + Denoise demo](/demos/ssr-denoise/) in Chrome or Edge',
      'Orbit or walk until you see a glossy floor reflection',
      'Toggle or compare raw vs denoised reflections if the UI exposes the switch',
      'Optional: import a small GLTF/FBX or swap an HDR to re-light the room',
    ],
    requirements: [
      '**Browser:** Chrome or Edge with WebGPU enabled (113+ recommended)',
      '**Hardware:** a discrete or recent integrated GPU; lower quality if it stutters',
      '**Mobile:** limited — treat desktop as the first experience',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Gallery wide — art walls and reflective floor' },
    viewB: { file: 'view-b.jpg', caption: 'Reflection detail — denoised gloss under the lights' },
    alsoCan: [
      'Load custom models to see how a client piece reads in the room',
      'Compare reflection quality while moving — denoise shows its value in motion',
      'Pair with other WebGPU studies like volumetric lighting on the same site',
    ],
    howWorks:
      'The starting point is the official three.js [WebGPU SSR + denoise example](https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise) ([source on GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html)). IOM wraps that pipeline in a gallery shell with model import, HDR/EXR swap, and walk mode so the effect is client-readable, not only a tech sample.',
    faq: [
      {
        q: 'Why is the page blank or warning me?',
        a: 'This demo needs WebGPU. Use a recent Chrome or Edge build; Safari and older Firefox may not expose the API yet.',
      },
      {
        q: 'Is SSR the same as ray tracing?',
        a: 'No. SSR reuses the screen image; path-traced or hardware ray-traced reflections are a heavier path. Denoise makes SSR more presentable in realtime.',
      },
    ],
    reading: [
      { label: 'Live SSR + Denoise demo', url: '/demos/ssr-denoise/' },
      {
        label: 'three.js SSR denoise example',
        url: 'https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise',
      },
      {
        label: 'Example source on GitHub',
        url: 'https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html',
      },
      { label: 'WebGPU — MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API' },
    ],
    related: [
      { label: 'Volumetric Lighting', url: '/blog/volume-lighting' },
      { label: 'Three.js Ocean', url: '/blog/threejs-ocean' },
    ],
  },

  'iom-three': {
    pageTitle: 'Dream — Ocean scroll narrative',
    demoLabel: 'Dream — Ocean scroll',
    hook: 'Not every 3D piece should be an orbit cube. Dream is a scroll narrative through still dark water, rain, distant land, and shore — procedural distortion, optional ambient audio, and a weather runtime with sky, clouds, and day/night sync. Chapter 1 of 9; work in progress.',
    coverNote: 'The cover shows a still from the Dream ocean scroll chapter.',
    whyBullets: [
      '- **Scroll as camera** — the page motion tells the chapter, not only a drag orbit',
      '- **Atmosphere first** — water, rain, and weather set the emotional beat',
      '- **Audio that follows** — optional ambient crossfade with the visual chapters',
      '- **Series mindset** — chapter 1 of 9 signals a longer narrative arc',
    ],
    whyUses:
      'brand story landings, exhibition web companions, folio openers, and experiments where mood and pacing matter as much as model fidelity.',
    beginner:
      'Instead of a free camera you fly yourself, you scroll — and the scene advances like pages in a picture book. Water and weather shaders do the heavy visual lifting; you read with your thumb or mouse wheel.',
    glossary: [
      { term: 'Scroll narrative', def: 'story beats tied to page scroll position' },
      { term: 'Procedural distortion', def: 'shader motion that warps the surface without a video file' },
      { term: 'Weather runtime', def: 'sky, clouds, and day/night driven by parameters' },
      { term: 'Crossfade audio', def: 'ambient layers blend as chapters change' },
    ],
    trySteps: [
      'Open the [Dream — Ocean scroll demo](/demos/dreams-iom/)',
      'Scroll slowly through the first beats — water, rain, distant land',
      'Pause where the shore reads clearest; notice sky / weather shifts',
      'If audio is enabled in your build, unmute and scroll again for the crossfade',
    ],
    requirements: [
      '**Browser:** modern Chrome/Edge/Firefox with WebGL',
      '**Motion:** desktop scroll or trackpad gives the intended pacing',
      '**Audio:** optional — some browsers require a click before sound starts',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Dark water chapter — still surface and weather cue' },
    viewB: { file: 'view-b.jpg', caption: 'Shore approach — land mass and sky transition' },
    alsoCan: [
      'Treat it as a mood board for a longer multi-chapter launch',
      'Pair with the [Three.js Ocean](/blog/threejs-ocean) study for surface technique contrast',
      'Scope a branded chapter with custom copy and audio bed',
    ],
    howWorks:
      'The experience is a [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) canvas driven by scroll position: shader-based water and atmospheric passes update as the narrative progress value changes. Weather (sky, clouds, day/night) is a parameter runtime rather than a baked video. Live at [/demos/dreams-iom/](/demos/dreams-iom/).',
    faq: [
      {
        q: 'Is this finished?',
        a: 'Chapter 1 of 9 is the public beat — a work-in-progress narrative, not a closed film.',
      },
      {
        q: 'Can we put our brand story here?',
        a: 'Yes as a scoped adaptation: copy, pacing, audio, and visual grade. Contact us with the chapter outline.',
      },
    ],
    reading: [
      { label: 'Dream — Ocean scroll', url: '/demos/dreams-iom/' },
      { label: 'Three.js', url: 'https://threejs.org/' },
      { label: 'WebGL — Wikipedia', url: 'https://en.wikipedia.org/wiki/WebGL' },
      { label: 'IOM 3D section', url: '/#3d' },
    ],
    related: [
      { label: 'Three.js Ocean', url: '/blog/threejs-ocean' },
      { label: 'Raven Path Animation', url: '/blog/raven-path' },
    ],
  },

  'threejs-ocean': {
    pageTitle: 'Three.js Ocean — Gerstner waves, sky, and export',
    demoLabel: 'Three.js Ocean',
    hook: 'Need a hero water plate you can brand in minutes? This ocean demo runs Gerstner-wave water with a procedural sky and sunset preset — drop glass 3D text (Google Fonts), decorative icons, grab wallpaper screenshots, or export up to 30 seconds of WebGL video.',
    coverNote: 'The cover shows the sunset ocean framing from the 3D card.',
    whyBullets: [
      '- **Readable water fast** — Gerstner waves and sky without a film render farm',
      '- **Type on the water** — glass 3D text with Google Fonts for titles',
      '- **Sunset preset** — a one-click mood for pitches and lockups',
      '- **Takeaways** — wallpaper stills or a short WebGL video export',
    ],
    whyUses:
      'landing heroes, event key art plates, social wallpapers, and quick “ocean brand moment” comps before a custom water R&D pass.',
    beginner:
      'Gerstner waves are a classic way to fake ocean swells in real time — peaks and troughs that look more like water than a flat ripple texture. Here they sit under a procedural sky so you can compose a title or icon and capture it.',
    glossary: [
      { term: 'Gerstner wave', def: 'a mathematical swell model used in realtime oceans' },
      { term: 'Procedural sky', def: 'sky color and sun computed in a shader, not a photo dome only' },
      { term: 'Glass 3D text', def: 'extruded type with refractive/transparent shading' },
      { term: 'WebGL video export', def: 'recording frames from the canvas into a short clip' },
    ],
    trySteps: [
      'Open the [Three.js Ocean demo](/demos/ocean/)',
      'Orbit until the horizon and sun read clearly (try the sunset preset)',
      'Add or edit glass 3D text / icons if the UI offers them',
      'Capture a wallpaper screenshot or start a short video export (≤30s)',
    ],
    requirements: [
      '**Browser:** modern Chrome/Edge recommended for capture and export',
      '**GPU:** integrated graphics usually fine; lower quality if fans spin up',
      '**Export:** video capture is heavier — close other tabs for a clean take',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Sunset ocean — horizon and swell' },
    viewB: { file: 'view-b.jpg', caption: 'Title lockup — glass text over water' },
    alsoCan: [
      'Generate social/wallpaper stills without leaving the browser',
      'Prototype event titles before handing off to motion design',
      'Compare technique with the scroll narrative in [Dream](/blog/iom-three)',
    ],
    howWorks:
      'Built on the three.js ocean/water lineage ([webgl_shaders_ocean example source](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html)) with IOM UI for text, presets, screenshots, and short canvas recording. [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) drives the water and sky each frame; export is a timed capture of that same canvas.',
    faq: [
      {
        q: 'Can we use the clip commercially?',
        a: 'Treat the public demo as a preview. Ask us for a licensed or branded export package for campaigns.',
      },
      {
        q: 'Is this the same as Dream — Ocean scroll?',
        a: 'No. This is an orbitable ocean plate with export tools; Dream is a scroll narrative chapter at [/demos/dreams-iom/](/demos/dreams-iom/).',
      },
    ],
    reading: [
      { label: 'Ocean demo', url: '/demos/ocean/' },
      {
        label: 'three.js ocean example source',
        url: 'https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html',
      },
      { label: 'Three.js', url: 'https://threejs.org/' },
      {
        label: 'Gerstner wave — Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Trochoidal_wave',
      },
    ],
    related: [
      { label: 'Dream — Ocean scroll', url: '/blog/iom-three' },
      { label: 'Art Gallery — SSR + Denoise', url: '/blog/ssr-denoise' },
    ],
  },

  'panorama-suite': {
    pageTitle: 'The Black Witness — 360° visitor tour',
    demoLabel: 'The Black Witness — 360° Tour',
    hook: 'Same raven, many worlds — city, forest, mountain, mist. This visitor preview opens The Black Witness tour without editor chrome, framed at yaw −84.7° and pitch −6°, with hotspots, guided steps, and optional WebGPU atmosphere.',
    coverNote: 'The cover is guided-tour step 1 — The Black Witness raven hotspot with popup open.',
    whyBullets: [
      '- **Visitor-first link** — no editor UI; guests only see the tour',
      '- **Guided steps** — a path through the story, not only free look',
      '- **Hotspots with meaning** — info and jumps that teach as you explore',
      '- **Shareable framing** — deep-link yaw/pitch so the first view is intentional',
    ],
    whyUses:
      'exhibition companions, photography series launches, booth attract loops, and client proofs of how a finished 360 story feels on a phone or laptop.',
    beginner:
      'You are standing inside a 360° photograph. Drag to look around; tap markers to learn or move to the next place. Preview mode is the “guest ticket” — the editor is how we build it; this link is how audiences experience it.',
    glossary: [
      { term: 'Visitor preview', def: 'tour mode without editing tools (`mode=preview`)' },
      { term: 'Yaw / pitch', def: 'horizontal and vertical look angles for the starting view' },
      { term: 'Guided tour', def: 'ordered stops the experience can advance through' },
      { term: 'Hotspot', def: 'a tappable marker for info or the next scene' },
    ],
    trySteps: [
      'Open the [Black Witness visitor tour](/demos/panorama-360/?mode=preview)',
      'Click **Play guided tour** — four camera stops with popups and effects',
      'Open a hotspot yourself after stopping the tour',
      'Share the preview URL so colleagues land in the same experience',
    ],
    requirements: [
      '**Browser:** modern mobile or desktop browser; WebGPU effects need a capable device',
      '**Network:** panoramas are image-heavy — prefer Wi‑Fi for first load',
      '**Input:** touch drag or mouse; headset not required',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Step 2 — animated fire hotspot and particle popup' },
    viewB: { file: 'view-b.jpg', caption: 'Step 3 — water / spout beat on the rooftop' },
    viewC: { file: 'view-c.jpg', caption: 'Step 4 — sky look for the interactive birds layer' },
    alsoCan: [
      'Jump to the [editor](/demos/panorama-360/) when you need to author hotspots',
      'Reuse the deep-link pattern for branded first views on other projects',
      'Pair with the photographic series narrative behind The Black Witness',
    ],
    howWorks:
      'Preview reuses the same panorama engine as the [360° Tour Editor](/blog/panorama-360-tour), but URL flags hide authoring chrome and set the initial camera (`yaw`, `pitch`). Hotspots and guided steps are project data over equirectangular scenes — [Three.js](https://threejs.org/) for the sphere camera, optional [WebGPU](https://en.wikipedia.org/wiki/WebGPU) layers for atmosphere.',
    faq: [
      {
        q: 'Why does my view start in a specific direction?',
        a: 'The link sets yaw −84.7° and pitch −6° so everyone shares the same opening composition.',
      },
      {
        q: 'Can I edit hotspots from this URL?',
        a: 'Not in preview. Use the [tour editor](/demos/panorama-360/) (or ask us for a production authoring build).',
      },
    ],
    reading: [
      {
        label: 'Visitor tour link',
        url: '/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6',
      },
      { label: 'Tour editor', url: '/demos/panorama-360/' },
      { label: 'Three.js', url: 'https://threejs.org/' },
      { label: 'WebGPU — Wikipedia', url: 'https://en.wikipedia.org/wiki/WebGPU' },
    ],
    related: [
      { label: '360° Panorama Tour Editor', url: '/blog/panorama-360-tour' },
      { label: 'Raven Path Animation', url: '/blog/raven-path' },
    ],
  },
}
