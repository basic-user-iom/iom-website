/**
 * Per-experiment editorial overrides for demo blog posts.
 * Shared structure comes from projects.ts via generate-demo-blog-posts.mjs
 */
export const DEMO_BLOG_OVERRIDES_EXPERIMENTS = {
  'css3d-sprites': {
    pageTitle: 'CSS3D Sprites — HTML in 3D space',
    demoLabel: 'CSS3D Sprites',
    hook: 'Five hundred and twelve HTML elements floating as sprites — then morphing between a plane, cube, cloud, and sphere. It is Three.js CSS3DRenderer: real DOM nodes in camera space, not just textured quads.',
    coverNote: 'The cover shows the sprite cloud mid-morph — HTML tiles reading as a 3D formation.',
    whyBullets: [
      '- **DOM meets depth** — real HTML/CSS content that still orbits in 3D',
      '- **Morph storytelling** — plane → cube → cloud → sphere sells “data becoming form”',
      '- **Motion without a game engine** — pulsing scale and transitions in the browser',
      '- **Prototype UI in space** — cards, labels, or photos as spatial layouts',
    ],
    whyUses: 'spatial UI sketches, portfolio “particle of cards” moments, and client demos where content must stay readable HTML.',
    beginner:
      'Imagine photo thumbnails or colored tiles arranged in a room you can spin. Each tile is still a normal webpage element — just positioned in 3D. When the shape changes, the tiles fly to new places like a choreographed flock.',
    glossary: [
      { term: 'CSS3DRenderer', def: 'Three.js path that positions HTML elements with CSS 3D transforms' },
      { term: 'Sprite', def: 'a flat element that faces or sits in the scene as a billboard-like unit' },
      { term: 'Morph', def: 'animated transition of positions from one formation to another' },
      { term: 'WebGL camera', def: 'the same 3D camera math as WebGL scenes, driving CSS transforms' },
    ],
    trySteps: [
      'Open the [CSS3D Sprites demo](/demos/css3d-sprites/)',
      'Drag to orbit; watch the formation pulse',
      'Trigger shape changes (plane, cube, random, sphere) if buttons or UI are present',
      'Zoom in until individual HTML sprites stay sharp — that is the DOM advantage',
    ],
    requirements: [
      '**Browser:** modern Chrome, Edge, Firefox, or Safari with CSS 3D transforms',
      '**GPU:** light load compared with heavy WebGPU compute — fine on most laptops',
      '**Note:** this is CSS3D + Three.js camera math, not a WebGPU compute demo',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Sphere or cube formation — sprites reading as a solid volume' },
    viewB: { file: 'view-b.jpg', caption: 'Cloud / random scatter — depth and parallax of HTML tiles' },
    alsoCan: [
      'Swap sprite content for images, labels, or brand colors',
      'Use morphs as section transitions in a pitch site',
      'Compare with the upstream [three.js css3d_sprites](https://threejs.org/examples/#css3d_sprites) example',
    ],
    howWorks:
      'Three.js drives a shared camera; [CSS3DRenderer](https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer) maps object matrices to CSS `transform` on DOM nodes. Formations are target positions; animation interpolates each sprite toward the next layout. Upstream reference: [css3d_sprites](https://threejs.org/examples/#css3d_sprites) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/css3d_sprites.html)). Unlike WebGPU particle systems, work here is layout + CSS compositing rather than compute shaders.',
    faq: [
      {
        q: 'Is this WebGL or WebGPU?',
        a: 'Neither as the main path — sprites are HTML via CSS3D. Three.js still uses 3D camera math familiar from WebGL scenes.',
      },
      {
        q: 'Can we put real product cards in the cloud?',
        a: 'Yes in principle — each sprite can hold richer HTML. We scope performance and readability for client builds.',
      },
    ],
    reading: [
      { label: 'three.js — css3d_sprites', url: 'https://threejs.org/examples/#css3d_sprites' },
      { label: 'CSS3DRenderer docs', url: 'https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer' },
      { label: 'Three.js', url: 'https://threejs.org/' },
    ],
    related: [
      { label: 'BufferGeometry Draw Range', url: '/blog/buffergeometry-drawrange' },
      { label: 'WebGPU TSL Linked Particles', url: '/blog/webgpu-tsl-linked-particles' },
    ],
  },

  'compute-particles': {
    pageTitle: 'Shape Particles — WebGPU compute physics',
    demoLabel: 'Shape Particles',
    hook: 'Thousands of particles snap into a cube, sphere, torus, heart — then Release drops them under GPU gravity with floor bounce. WebGPU compute keeps the simulation on the graphics card.',
    coverNote: 'The cover shows a shape preset held in formation before the drop.',
    whyBullets: [
      '- **Formation → chaos → reform** — a clear story for product or brand motion',
      '- **Compute on the GPU** — physics steps without blocking the main thread',
      '- **Shape presets** — cube, sphere, torus, cone, pyramid, ring, heart',
      '- **Interactive proof** — Release and Reset sell the idea in one click',
    ],
    whyUses: 'launch teasers, booth loops, and “our data becomes this shape” pitch moments.',
    beginner:
      'Think of magnetic sand that can hold a logo-like shape, then fall when you let go — and jump back into the shape when you reset. The difference is speed: the GPU updates every particle so it stays smooth.',
    glossary: [
      { term: 'WebGPU', def: 'modern browser GPU API (newer than WebGL) for compute and rendering' },
      { term: 'Compute shader', def: 'GPU program that updates data (positions, velocities) without drawing triangles' },
      { term: 'TSL', def: 'Three.js Shading Language — node-based GPU logic in JS' },
      { term: 'Formation', def: 'target positions that make particles read as a solid shape' },
    ],
    trySteps: [
      'Open the [Shape Particles demo](/demos/compute-particles/)',
      'Pick a shape preset and orbit the formation',
      'Press Release — watch gravity and floor bounce',
      'Press Reset to reform; try another shape',
    ],
    requirements: [
      '**Browser:** Chrome or Edge with WebGPU enabled (recent versions)',
      '**GPU:** discrete or recent integrated GPU recommended for dense counts',
      '**Fallback:** without WebGPU you will see a capability message — this is not a WebGL port',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Held formation — particles reading as a solid preset shape' },
    viewB: { file: 'view-b.jpg', caption: 'After Release — spray and bounce on the ground plane' },
    alsoCan: [
      'Cycle presets for a short brand loop',
      'Tune count / look for booth vs laptop performance',
      'Compare with [three.js webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles)',
    ],
    howWorks:
      'A [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) compute pass updates particle state each frame; the renderer draws the result. Three.js exposes this through its WebGPU renderer and TSL compute nodes. Upstream: [webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_particles.html)). WebGL can draw particles too, but this demo’s gravity and reform loop are built for WebGPU compute.',
    faq: [
      {
        q: 'Why does my browser say WebGPU is missing?',
        a: 'This experiment needs WebGPU. Use an updated Chrome or Edge; Safari/Firefox support varies by version.',
      },
      {
        q: 'Can the particles form our logo?',
        a: 'Custom target meshes or point clouds are a natural next step — ask us for a scoped build.',
      },
    ],
    reading: [
      { label: 'three.js — compute particles', url: 'https://threejs.org/examples/#webgpu_compute_particles' },
      { label: 'WebGPU API — MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API' },
      { label: 'Three.js', url: 'https://threejs.org/' },
    ],
    related: [
      { label: 'WebGPU Particles', url: '/blog/webgpu-particles' },
      { label: 'WebGPU Compute Birds', url: '/blog/webgpu-compute-birds' },
    ],
  },

  'webgpu-spotlight': {
    pageTitle: 'WebGPU Spotlight — textured beams and shadows',
    demoLabel: 'WebGPU Spotlight',
    hook: 'A spot light that behaves like a theatrical fixture — texture projected into the cone, soft penumbra, decay, and focused shadows — running on Three.js WebGPU with the classic Lucy scan as the subject.',
    coverNote: 'The cover shows Lucy under the moving spotlight on a shadow-receiving ground.',
    whyBullets: [
      '- **Showroom lighting language** — cone, falloff, and gobo-like texture maps',
      '- **Real shadows** — contact on the ground sells depth for product and sculpture',
      '- **WebGPU materials path** — modern Three.js lighting, not a baked GIF',
      '- **Helpers on demand** — visualize the light when you are tuning',
    ],
    whyUses: 'product turntables, gallery studies, and lighting pitches before a full production scene.',
    beginner:
      'A spotlight is a cone of light, like a stage lamp. Here you can see the soft edge of the cone, how brightness falls off with distance, and how the shadow of the sculpture sits on the floor — all live in the browser.',
    glossary: [
      { term: 'Spotlight', def: 'a light with a cone angle, aim direction, and optional texture in the beam' },
      { term: 'Penumbra', def: 'the soft edge of the light cone' },
      { term: 'Decay', def: 'how quickly intensity falls with distance' },
      { term: 'WebGPU', def: 'the newer browser GPU API used by this Three.js renderer path' },
    ],
    trySteps: [
      'Open the [WebGPU Spotlight demo](/demos/webgpu-spotlight/)',
      'Orbit around Lucy; watch the moving spot and ground shadow',
      'Toggle light helpers if available to see the cone',
      'Note penumbra and focus — soft edge vs sharp shadow trade-offs',
    ],
    requirements: [
      '**Browser:** Chrome or Edge with WebGPU (this is not the older WebGL lights example)',
      '**GPU:** any recent laptop GPU is usually enough for this scene',
      '**Model:** Lucy PLY is included — heavy custom meshes may need optimization',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Three-quarter — cone light reading on Lucy and floor' },
    viewB: { file: 'view-b.jpg', caption: 'Shadow focus — contact shadow and penumbra on the ground' },
    alsoCan: [
      'Swap gobo / projection textures for brand patterns',
      'Pair with volumetric demos for “beam in the air” mood',
      'Study the upstream [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight) example',
    ],
    howWorks:
      'Three.js `WebGPURenderer` evaluates spot lights with maps, penumbra, decay, and shadow maps in the WebGPU pipeline. The scene orbits an animated spot over the Lucy PLY on a receiving plane. Official example: [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_lights_spotlight.html)). WebGL has classic spotlight examples too; this page specifically tracks the WebGPU lights path.',
    faq: [
      {
        q: 'Is this the same as volumetric god rays?',
        a: 'No — this is surface lighting and shadows. For beams in the air, see our volumetric lighting work.',
      },
      {
        q: 'Can we light our own product?',
        a: 'Yes. Replacing Lucy with a GLB and matching exposure is a typical client next step.',
      },
    ],
    reading: [
      { label: 'three.js — WebGPU spotlight', url: 'https://threejs.org/examples/#webgpu_lights_spotlight' },
      { label: 'WebGPU — MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API' },
      { label: 'Three.js', url: 'https://threejs.org/' },
    ],
    related: [
      { label: 'Volumetric Lighting', url: '/blog/volume-lighting' },
      { label: 'WebGPU Custom Fog Scattering', url: '/blog/webgpu-custom-fog-scattering' },
    ],
  },

  'webgpu-compute-birds': {
    pageTitle: 'WebGPU Compute Birds — GPU flocking',
    demoLabel: 'WebGPU Compute Birds',
    hook: 'Eight thousand birds flocking in the browser — separation, alignment, and cohesion computed on the GPU. Move the mouse to disturb the flock; tune behavior live.',
    coverNote: 'The cover shows the instanced flock as a coherent murmuration.',
    whyBullets: [
      '- **Classic boids, modern GPU** — Reynolds-style rules at interactive scale',
      '- **Instancing** — one mesh, thousands of birds',
      '- **Pointer disturbance** — stakeholders feel agency in seconds',
      '- **WebGPU compute** — simulation stays off the CPU main thread',
    ],
    whyUses: 'nature-inspired brand moments, science explainer UIs, and stress tests for GPU compute pipelines.',
    beginner:
      'Birds in a flock follow simple rules: don’t crash, match neighbors, stay with the group. Multiply that by thousands and you get a murmuration. Here those rules run on the graphics card so the motion stays fluid.',
    glossary: [
      { term: 'Boids', def: 'classic flocking model: separation, alignment, cohesion' },
      { term: 'Instancing', def: 'drawing many copies of one mesh efficiently' },
      { term: 'Compute', def: 'GPU work that updates bird positions/velocities each frame' },
      { term: 'WebGPU', def: 'API used here instead of older WebGL-only GPGPU tricks' },
    ],
    trySteps: [
      'Open the [WebGPU Compute Birds demo](/demos/webgpu-compute-birds/)',
      'Watch the flock settle into coherent motion',
      'Move the mouse through the flock to disturb it',
      'Open Birds settings and tweak separation / alignment / cohesion',
    ],
    requirements: [
      '**Browser:** WebGPU-capable Chrome or Edge recommended',
      '**GPU:** mid-range or better for 8k instances at smooth frame rates',
      '**Not WebGL:** the compute flocking path targets WebGPU',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Wide murmuration — flock reading as one volume' },
    viewB: { file: 'view-b.jpg', caption: 'Closer pass — instanced birds and direction of flight' },
    alsoCan: [
      'Retune forces for calmer vs chaotic brand moods',
      'Use as a background layer behind UI (with care for contrast)',
      'Layer the flock into a [360° guided tour](/demos/panorama-360/) sky beat (Step 4)',
      'Compare [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) on threejs.org',
    ],
    howWorks:
      'Each frame a WebGPU compute pass applies flocking forces and writes new transforms; instanced drawing renders the birds. Upstream: [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_birds.html)). Older WebGL “GPGPU birds” examples exist in three.js history; this IOM page follows the WebGPU compute edition.',
    tourBridge: {
      step: 4,
      stepLabel: 'Guided tour Step 4 — birds layer + hotspot popup on The Black Witness',
      body: `In the [360° Panorama Tour](/demos/panorama-360/), **Step 4** is authored as \`cam · +birds · hotspot+popup\`: the camera tips toward the sky, the WebGPU birds layer brings the atmosphere to life, and a hotspot/popup keeps the story clickable.

Standalone flocking proves the tech; the tour proves the **product pattern** — living GPU layers timed to a guided stop so guests feel motion *and* can still drag to look and tap to learn. Earlier beats use [WebGPU Particles](/blog/webgpu-particles) (Step 2) and [Spout](/blog/spout) (Step 3) the same way.`,
    },
    faq: [
      {
        q: 'Why so many birds?',
        a: 'Scale is the point — compute + instancing show what WebGPU can sustain interactively.',
      },
      {
        q: 'Can birds follow a path or logo?',
        a: 'Guiding fields and attractors are common extensions for client stories.',
      },
      {
        q: 'Where do the birds appear in the 360 tour?',
        a: 'Guided-tour Step 4 on The Black Witness — birds layer with a hotspot popup. Open /demos/panorama-360/ and Play guided tour.',
      },
    ],
    reading: [
      { label: 'three.js — compute birds', url: 'https://threejs.org/examples/#webgpu_compute_birds' },
      { label: '360° Panorama Tour Editor', url: '/demos/panorama-360/' },
      { label: 'Boids — Wikipedia', url: 'https://en.wikipedia.org/wiki/Boids' },
      { label: 'WebGPU — MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API' },
    ],
    related: [
      { label: '360° Panorama Tour Editor', url: '/blog/panorama-360-tour' },
      { label: 'WebGPU Particles', url: '/blog/webgpu-particles' },
      { label: 'Spout', url: '/blog/spout' },
    ],
  },

  'webgpu-parallax-uv': {
    pageTitle: 'WebGPU Parallax UV — depth in a flat texture',
    demoLabel: 'WebGPU Parallax UV',
    hook: 'Ice that feels thicker than a flat plane — TSL parallax UV offsets layered ambientCG maps with displacement, normals, and roughness under HDR light.',
    coverNote: 'The cover shows the ice ground with parallax depth as the camera grazes the surface.',
    whyBullets: [
      '- **Fake thickness, real savings** — depth cue without a heavy sculpted mesh',
      '- **TSL materials** — modern Three.js node materials on WebGPU',
      '- **PBR stack** — albedo, normal, roughness, displacement working together',
      '- **HDR environment** — reflections that sell frozen material',
    ],
    whyUses: 'material studies, ground planes for product shots, and “does this shader read?” reviews.',
    beginner:
      'A normal photo of ice is flat. Parallax UV tricks the eye: as you move the camera, the texture shifts a little as if there were depth under the surface — like looking into clear ice without modeling every crack.',
    glossary: [
      { term: 'Parallax mapping', def: 'UV offset based on view angle and a height/displacement map' },
      { term: 'TSL', def: 'Three.js Shading Language for node-based GPU materials' },
      { term: 'PBR', def: 'physically based rendering — roughness/metalness-style material model' },
      { term: 'HDR environment', def: 'high-dynamic-range image lighting the scene reflections' },
    ],
    trySteps: [
      'Open the [WebGPU Parallax UV demo](/demos/webgpu-parallax-uv/)',
      'Orbit low across the ice — watch depth shift with angle',
      'Compare grazing vs top-down views',
      'Note how normals and roughness change the freeze look under HDR',
    ],
    requirements: [
      '**Browser:** WebGPU (Chrome/Edge recommended)',
      '**Textures:** ambientCG-style maps are bundled; network helps first load',
      '**GPU:** light-to-moderate — heavier than a flat unlit plane, lighter than full compute flocks',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Grazing angle — parallax depth in the ice plane' },
    viewB: { file: 'view-b.jpg', caption: 'Higher view — layered maps and HDR reflection read' },
    alsoCan: [
      'Retarget maps to stone, wood, or branded materials',
      'Use as a ground under a product GLB',
      'Study [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv)',
    ],
    howWorks:
      'A TSL material samples height/displacement to offset UVs by view direction (parallax), then layers color, normal, and roughness. WebGPURenderer runs the node graph. Upstream: [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_parallax_uv.html)). Classic WebGL parallax shaders exist; this demo is on the WebGPU + TSL path.',
    faq: [
      {
        q: 'Is the ice a real 3D volume?',
        a: 'No — it is a shaded plane. Parallax fakes depth in the material.',
      },
      {
        q: 'Can we use our own texture set?',
        a: 'Yes. Matching map naming and strength is a standard material swap.',
      },
    ],
    reading: [
      { label: 'three.js — parallax UV', url: 'https://threejs.org/examples/#webgpu_parallax_uv' },
      { label: 'ambientCG', url: 'https://ambientcg.com/' },
      { label: 'Three.js', url: 'https://threejs.org/' },
    ],
    related: [
      { label: 'WebGPU TSL Raging Sea', url: '/blog/webgpu-tsl-raging-sea' },
      { label: 'WebGPU Custom Fog Scattering', url: '/blog/webgpu-custom-fog-scattering' },
    ],
  },

  'webgpu-tsl-raging-sea': {
    pageTitle: 'WebGPU TSL Raging Sea — procedural waves',
    demoLabel: 'TSL Raging Sea',
    hook: 'A stormy ocean without an ocean simulator — layered sine waves and fractal noise displace a dense plane, with computed normals and emissive crests, all in TSL on WebGPU.',
    coverNote: 'The cover shows high seas with bright crest highlights.',
    whyBullets: [
      '- **Procedural water** — no baked flipbook; parameters drive the mood',
      '- **TSL displacement** — wave math lives in the material graph',
      '- **Crest energy** — emissive highlights sell foam and spray without particles',
      '- **WebGPU path** — modern Three.js ocean sketch for pitches and R&D',
    ],
    whyUses: 'environment backdrops, marine product context, and shader R&D before FFT ocean systems.',
    beginner:
      'The “sea” is a flat grid that the GPU pushes up and down every frame using math — big rolling waves plus smaller chop. Lighting on the slopes makes it look like water instead of a wrinkled sheet.',
    glossary: [
      { term: 'Displacement', def: 'moving mesh vertices (or shading) with a height function' },
      { term: 'Fractal noise', def: 'layered noise for natural-looking detail' },
      { term: 'TSL', def: 'Three.js Shading Language used to author the wave graph' },
      { term: 'Normals', def: 'surface directions used for lighting; recomputed from the waves' },
    ],
    trySteps: [
      'Open the [TSL Raging Sea demo](/demos/webgpu-tsl-raging-sea/)',
      'Orbit and watch large swells versus small chop',
      'Look for emissive crests on wave peaks',
      'Compare mood with our other ocean experiments on the site',
    ],
    requirements: [
      '**Browser:** WebGPU required for this TSL WebGPU example',
      '**GPU:** denser planes cost more — lower pixel ratio if it stutters',
      '**Not WebGL ocean:** distinct from the classic WebGL water / FFT demos',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Wide storm sea — layered swells reading at distance' },
    viewB: { file: 'view-b.jpg', caption: 'Crest detail — normals and emissive highlights' },
    alsoCan: [
      'Retune amplitude and noise for calm harbor vs storm',
      'Use as a skybox-adjacent backdrop under a product',
      'Open [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) upstream',
    ],
    howWorks:
      'Vertex (or equivalent TSL) displacement sums large sines with fractal noise; normals are derived so lighting reacts to slopes; crests get emissive lift. Runs on Three.js WebGPU + TSL. Upstream: [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_raging_sea.html)). For spectrum-based seas, see dedicated FFT ocean work elsewhere on IOM — different technique, often WebGL or hybrid.',
    faq: [
      {
        q: 'Is this a full ocean simulation?',
        a: 'No — it is procedural displacement. Great for look development; not CFD.',
      },
      {
        q: 'WebGL or WebGPU?',
        a: 'WebGPU via Three.js TSL. Broader device coverage may still prefer WebGL oceans.',
      },
    ],
    reading: [
      { label: 'three.js — TSL raging sea', url: 'https://threejs.org/examples/#webgpu_tsl_raging_sea' },
      { label: 'Three.js', url: 'https://threejs.org/' },
      { label: 'WebGPU — MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API' },
    ],
    related: [
      { label: 'WebGPU Parallax UV', url: '/blog/webgpu-parallax-uv' },
      { label: 'Terrain Sandbox', url: '/blog/terrain-sandbox' },
    ],
  },

  'webgpu-tsl-linked-particles': {
    pageTitle: 'WebGPU TSL Linked Particles — drawn VFX trails',
    demoLabel: 'TSL Linked Particles',
    hook: 'Move the pointer to spawn a glowing particle trail — GPU compute, turbulence, nearest-neighbor link ribbons, hue rotation, and bloom. A TSL VFX sketch you can feel.',
    coverNote: 'The cover shows linked particle ribbons with bloom.',
    whyBullets: [
      '- **Pointer as brush** — instant “try it” for clients on a call',
      '- **Links between neighbors** — network / synapse / constellation language',
      '- **Compute + TSL** — spawn, turbulence, and life on the GPU',
      '- **Bloom finish** — soft glow that reads premium on dark UIs',
    ],
    whyUses: 'hero backgrounds, interactive booth moments, and tech-brand visual systems.',
    beginner:
      'You draw with light: particles appear under the cursor, drift with turbulence, and thin lines connect nearby points — like a constellation that remembers your gesture for a moment.',
    glossary: [
      { term: 'Nearest-neighbor links', def: 'lines drawn between particles that are close in space' },
      { term: 'Turbulence', def: 'noisy force field that curls particle motion' },
      { term: 'Bloom', def: 'post-process glow around bright pixels' },
      { term: 'TSL VFX', def: 'effects authored with Three.js Shading Language nodes' },
    ],
    trySteps: [
      'Open the [TSL Linked Particles demo](/demos/webgpu-tsl-linked-particles/)',
      'Move the pointer across the canvas to draw trails',
      'Pause and watch links and hue shift as particles live out',
      'Orbit if enabled; note bloom on bright clusters',
    ],
    requirements: [
      '**Browser:** WebGPU (Chrome/Edge recommended)',
      '**GPU:** bloom + compute want a bit of headroom — close other heavy tabs if needed',
      '**Input:** mouse or trackpad; touch may vary by device',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Dense left cluster — magenta links with cyan accents' },
    viewB: { file: 'view-b.jpg', caption: 'Closer mesh — bloomed nodes and neighbor ribbons' },
    alsoCan: [
      'Map pointer to touch / wand for installations',
      'Recolor hue cycle to brand palette',
      'Compare [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles)',
    ],
    howWorks:
      'WebGPU compute spawns and advects particles; TSL materials render sprites/ribbons; a link pass connects nearby particles; bloom post-processes the frame. Upstream: [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_vfx_linkedparticles.html)). WebGL line networks (see draw-range) are a related visual idea with a different, more widely supported pipeline.',
    faq: [
      {
        q: 'Is this the same as the shape particles demo?',
        a: 'No — that one forms solid presets and gravity. This one is pointer-drawn VFX with links and bloom.',
      },
      {
        q: 'Can we slow it down for a calm brand film?',
        a: 'Yes — spawn rate, turbulence, and bloom thresholds are typical knobs.',
      },
    ],
    reading: [
      {
        label: 'three.js — TSL linked particles',
        url: 'https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles',
      },
      { label: 'WebGPU — MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API' },
      { label: 'Three.js', url: 'https://threejs.org/' },
    ],
    related: [
      { label: 'WebGPU Particles', url: '/blog/webgpu-particles' },
      { label: 'BufferGeometry Draw Range', url: '/blog/buffergeometry-drawrange' },
    ],
  },

  'webgpu-custom-fog-scattering': {
    pageTitle: 'WebGPU Custom Fog Scattering — walk the haze',
    demoLabel: 'Custom Fog Scattering',
    hook: 'A first-person stroll through procedural pine silhouettes in cool exponential fog — TSL density-based scattering blur that softens the distance like moist air.',
    coverNote: 'The cover shows pine shapes dissolving into scattered fog.',
    whyBullets: [
      '- **Atmosphere as the subject** — mood first, geometry second',
      '- **Scattering blur** — distance softens the way humid air does',
      '- **Tunable density** — fog and scatter as design dials',
      '- **WebGPU + TSL** — custom fog beyond a single scene.fog color',
    ],
    whyUses: 'environment pitches, game-like walkthroughs, and “weather as brand” studies.',
    beginner:
      'Fog is not only a grey tint. In moist air, far trees look softer and milkier. This demo walks you through that feeling — silhouettes of pines fading into a cool haze you can thicken or thin.',
    glossary: [
      { term: 'Exponential fog', def: 'fog that thickens smoothly with distance' },
      { term: 'Scattering', def: 'light bouncing in the medium — here approximated as a blur/softening' },
      { term: 'First-person', def: 'camera moves as if you are walking the scene' },
      { term: 'TSL', def: 'node shading used to customize fog behavior on WebGPU' },
    ],
    trySteps: [
      'Open the [Custom Fog Scattering demo](/demos/webgpu-custom-fog-scattering/)',
      'Walk or look around the pine field',
      'Raise fog density — watch distance collapse into haze',
      'Tune scattering factor and compare crisp vs soft far trees',
    ],
    requirements: [
      '**Browser:** WebGPU-capable Chrome or Edge',
      '**Controls:** keyboard / pointer as implemented in the demo UI',
      '**GPU:** comfortable on modern laptops; lower resolution if motion blurs',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Walk deeper — denser trunks as the haze closes in' },
    viewB: { file: 'view-b.jpg', caption: 'Close trunk — scattering softens the forest behind' },
    alsoCan: [
      'Retint fog for dawn / night brand moods',
      'Swap silhouettes for architecture masses',
      'Read [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering)',
    ],
    howWorks:
      'Procedural tree-like silhouettes sit in a WebGPU scene; TSL implements density-aware fog and a scattering blur so distant structure softens. Upstream: [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_custom_fog_scattering.html)). Standard WebGL `FogExp2` is simpler; this experiment shows a custom scattering treatment on the WebGPU stack.',
    faq: [
      {
        q: 'Is this volumetric lighting?',
        a: 'Related mood, different technique — here the focus is fog/scattering through a walkable forest, not rect-area god rays.',
      },
      {
        q: 'Can we use a real site model?',
        a: 'Yes as a scoped integration — replace silhouettes with simplified architecture LODs.',
      },
    ],
    reading: [
      {
        label: 'three.js — custom fog scattering',
        url: 'https://threejs.org/examples/#webgpu_custom_fog_scattering',
      },
      { label: 'WebGPU — MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API' },
      { label: 'Three.js', url: 'https://threejs.org/' },
    ],
    related: [
      { label: 'WebGPU Spotlight', url: '/blog/webgpu-spotlight' },
      { label: 'Volumetric Lighting', url: '/blog/volume-lighting' },
    ],
  },

  'webgpu-modifier-curve': {
    pageTitle: 'WebGPU Curve Modifier — text along a spline',
    demoLabel: 'WebGPU Curve Modifier',
    hook: 'Extruded text that flows along a closed Catmull-Rom spline — drag control handles and the mesh deforms with the path. A WebGPU take on curve modifiers for logos and type.',
    coverNote: 'The cover shows letterforms bent along the editable curve.',
    whyBullets: [
      '- **Type as geometry** — logos and headlines that live on a path',
      '- **Live handles** — reshape the story in front of a client',
      '- **Closed spline** — loops for endless booth motion',
      '- **Pairs with path tools** — same family as spline editors and camera rails',
    ],
    whyUses: 'animated logos, exhibition titles, and path-driven product callouts.',
    beginner:
      'Imagine flexible fridge-magnet letters stuck along a bent wire. Move the wire’s control points and the letters slide and bend to match. That is a curve modifier — here running in the browser on WebGPU.',
    glossary: [
      { term: 'Catmull-Rom spline', def: 'a smooth curve that passes through control points' },
      { term: 'Curve modifier', def: 'deforms a mesh so it follows a path' },
      { term: 'Extruded text', def: '3D letter geometry built from a font outline' },
      { term: 'Control handle', def: 'draggable point that reshapes the spline' },
    ],
    trySteps: [
      'Open the [WebGPU Curve Modifier demo](/demos/webgpu-modifier-curve/)',
      'Click a control handle to select it',
      'Drag to reshape the closed path — watch the text flow',
      'Orbit to check letter thickness and silhouette',
    ],
    requirements: [
      '**Browser:** WebGPU (Chrome/Edge recommended)',
      '**Input:** mouse for handle picking and dragging',
      '**GPU:** modest — heavier fonts / finer extrusion raise cost',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Full loop — extruded text following the closed spline' },
    viewB: { file: 'view-b.jpg', caption: 'Handle edit — local bend of letterforms on the path' },
    alsoCan: [
      'Swap the string for a brand wordmark',
      'Export path ideas into camera-rail workflows',
      'Compare [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve)',
    ],
    howWorks:
      'A closed Catmull-Rom curve defines the path; a modifier samples the curve to transform extruded text geometry each update. WebGPURenderer draws the result. Upstream: [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_modifier_curve.html)). For pure path editing without the modifier, see the WebGL [spline editor](https://threejs.org/examples/#webgl_geometry_spline_editor) — complementary tools.',
    faq: [
      {
        q: 'Can we use our font?',
        a: 'Usually yes with a licensed font that can be meshed for the web — we handle conversion in production builds.',
      },
      {
        q: 'WebGPU required?',
        a: 'For this demo page, yes. Curve ideas can also ship on WebGL depending on the project.',
      },
    ],
    reading: [
      { label: 'three.js — curve modifier', url: 'https://threejs.org/examples/#webgpu_modifier_curve' },
      { label: 'three.js — spline editor', url: 'https://threejs.org/examples/#webgl_geometry_spline_editor' },
      { label: 'Three.js', url: 'https://threejs.org/' },
    ],
    related: [
      { label: 'Catmull Spline Editor', url: '/blog/spline-editor' },
      { label: 'Shape Particles', url: '/blog/compute-particles' },
    ],
  },

  'webgpu-particles': {
    pageTitle: 'WebGPU Particles — fire and smoke sprites',
    demoLabel: 'WebGPU Particles',
    hook: 'Instanced fire and smoke sprites with TSL life cycles — rotating smoke UVs, additive fire, and a simple ground grid. Compact WebGPU VFX for mood and product heat.',
    coverNote:
      'The cover shows the same fire/smoke particle language as Guided Tour Step 2 on The Black Witness — rooftop heat with an “Animated fire” hotspot popup inside https://iobjectm.com/demos/panorama-360/.',
    whyBullets: [
      '- **Readable elemental VFX** — fire + smoke without a full FX package',
      '- **Instanced sprites** — many particles, one draw strategy',
      '- **TSL life cycles** — spawn, age, and fade on the GPU path',
      '- **Additive fire** — glow that composites cleanly on dark scenes',
      '- **Wired into 360 tours** — Step 2 on [Panorama 360](https://iobjectm.com/demos/panorama-360/) pairs particles with a hotspot popup',
    ],
    whyUses: 'forge / launch moods, camp and industrial sketches, lightweight hero loops, and heat beats inside interactive 360° guided tours.',
    beginner:
      'Fire and smoke here are many small images (sprites) that fade and swirl over time. Additive blending makes flames feel bright; smoke uses softer textures. Together they sell heat without simulating real combustion. In our [360° tour](https://iobjectm.com/demos/panorama-360/), that same particle language becomes Guided Tour Step 2 — a stop guests can look around and click.',
    glossary: [
      { term: 'Sprite particle', def: 'a textured quad, often camera-facing, used for smoke/fire' },
      { term: 'Additive blending', def: 'colors add up — bright for fire, easy to overblow if unchecked' },
      { term: 'Life cycle', def: 'birth, aging, and death of each particle' },
      { term: 'Instancing', def: 'efficiently drawing many particles from one template' },
      { term: 'Guided tour Step 2', def: 'on /demos/panorama-360/ — cam · +particles · hotspot+popup' },
    ],
    trySteps: [
      'Open the [WebGPU Particles demo](/demos/webgpu-particles/)',
      'Orbit the column — separate fire core from smoke body',
      'Watch sprite rotation / UV motion in the smoke',
      'Open [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, and watch Step 2 (particles + hotspot)',
    ],
    requirements: [
      '**Browser:** WebGPU via Three.js (not the older WebGL particle examples alone)',
      '**GPU:** fine on most modern laptops at default counts',
      '**Display:** darker UI backgrounds showcase additive fire best',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Rooftop fire walkthrough — animated plume over the city' },
    viewB: { file: 'view-b.jpg', caption: 'Closer heat — particle plume over the city skyline' },
    alsoCan: [
      'Recolor flames for brand-safe heat',
      'Layer under a product silhouette for launch films',
      'Drop the same particle language into a [360° guided tour](/demos/panorama-360/) beat (Step 2)',
      'Open [webgpu_particles](https://threejs.org/examples/#webgpu_particles)',
    ],
    howWorks:
      'Instanced sprites sample fire/smoke textures; TSL node materials animate life, rotation, and blending; WebGPURenderer composites the frame. Upstream: [webgpu_particles](https://threejs.org/examples/#webgpu_particles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_particles.html)). WebGL particle systems remain widely used for broader support — pick the API to match the audience devices.',
    tourBridge: {
      step: 2,
      stepLabel: 'Guided tour Step 2 — particles + hotspot popup on The Black Witness',
      body: `Standalone fire/smoke is only half the story. In the [360° Panorama Tour](/demos/panorama-360/), **Step 2** is authored as \`cam · +particles · hotspot+popup\`: the camera lands on a rooftop beat, a particle layer sells heat/atmosphere, and a hotspot opens a popup so guests get story + agency in one stop.

That connection is the interactivity benefit — particles are not a background wallpaper; they mark a **moment you can stop on, look around, and click**. The same VFX craft you explore in this demo becomes a guided beat inside a shareable tour. See also [Spout](/blog/spout) (Step 3) and [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4).`,
    },
    faq: [
      {
        q: 'Is this real fluid simulation?',
        a: 'No — sprite VFX with authored motion. Cheap, controllable, pitch-friendly.',
      },
      {
        q: 'How is this different from linked particles?',
        a: 'This is fire/smoke sprites. Linked particles emphasize pointer trails and neighbor ribbons.',
      },
      {
        q: 'Where do these particles appear in the 360 tour?',
        a: 'Guided-tour Step 2 on The Black Witness — particles layered with a hotspot popup. Open /demos/panorama-360/ and Play guided tour.',
      },
    ],
    reading: [
      { label: 'three.js — WebGPU particles', url: 'https://threejs.org/examples/#webgpu_particles' },
      { label: '360° Panorama Tour Editor', url: '/demos/panorama-360/' },
      { label: 'Three.js', url: 'https://threejs.org/' },
      { label: 'WebGPU — MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API' },
    ],
    related: [
      { label: '360° Panorama Tour Editor', url: '/blog/panorama-360-tour' },
      { label: 'Spout', url: '/blog/spout' },
      { label: 'WebGPU Compute Birds', url: '/blog/webgpu-compute-birds' },
    ],
  },

  'buffergeometry-drawrange': {
    pageTitle: 'BufferGeometry Draw Range — particle networks on WebGL',
    demoLabel: 'BufferGeometry Draw Range',
    hook: 'A living particle network with proximity lines — `BufferGeometry.setDrawRange()` draws only the active points and segments. Classic Three.js WebGL, still a workhorse for data-look visuals.',
    coverNote: 'The cover shows the node-link particle cloud with active connections.',
    whyBullets: [
      '- **Network aesthetic** — nodes and edges that feel like data',
      '- **Draw range control** — render only what is alive this frame',
      '- **Tunable graph** — count, distance, and max connections',
      '- **Wide device reach** — WebGL, not WebGPU-only',
    ],
    whyUses: 'tech brand backgrounds, “connected system” metaphors, and lightweight WebGL embeds.',
    beginner:
      'Dots float in space; when two get close, a thin line appears — like people becoming a network. The clever bit is efficiency: the engine only draws the currently active dots and lines instead of everything all the time.',
    glossary: [
      { term: 'BufferGeometry', def: 'Three.js mesh data stored in GPU buffers' },
      { term: 'Draw range', def: 'limit which slice of a buffer gets drawn this frame' },
      { term: 'Proximity link', def: 'a line spawned when particles are within a distance' },
      { term: 'WebGL', def: 'the widely supported browser 3D API used by this demo' },
    ],
    trySteps: [
      'Open the [BufferGeometry Draw Range demo](/demos/buffergeometry-drawrange/)',
      'Orbit the particle cloud',
      'Raise or lower particle count and link distance in the UI',
      'Watch lines appear/disappear as neighbors change',
    ],
    requirements: [
      '**Browser:** any modern browser with WebGL',
      '**GPU:** scales with particle and connection counts — dial down on weak devices',
      '**API note:** WebGL path — useful when WebGPU is unavailable',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Full network — particles with proximity segments' },
    viewB: { file: 'view-b.jpg', caption: 'Closer graph — draw-range active links reading clearly' },
    alsoCan: [
      'Map colors to categories or signal strength',
      'Use as a muted background under UI copy',
      'Study [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange)',
    ],
    howWorks:
      'Particles update in JS (or simple GPU-friendly buffers); line segments are rebuilt or ranged for near pairs; `setDrawRange` limits draws to the active subset. Upstream: [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_buffergeometry_drawrange.html)). For WebGPU compute flocks and TSL link ribbons, see the newer experiments — same visual family, different API.',
    faq: [
      {
        q: 'Why not WebGPU here?',
        a: 'WebGL still wins for maximum device coverage. We pick WebGPU when compute or TSL materials need it.',
      },
      {
        q: 'Can links represent real data?',
        a: 'Yes — replace random proximity with your graph edges in a production build.',
      },
    ],
    reading: [
      {
        label: 'three.js — buffergeometry drawrange',
        url: 'https://threejs.org/examples/#webgl_buffergeometry_drawrange',
      },
      { label: 'Three.js BufferGeometry', url: 'https://threejs.org/docs/#api/en/core/BufferGeometry' },
      { label: 'WebGL — MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API' },
    ],
    related: [
      { label: 'CSS3D Sprites', url: '/blog/css3d-sprites' },
      { label: 'WebGPU TSL Linked Particles', url: '/blog/webgpu-tsl-linked-particles' },
    ],
  },

  'spline-editor': {
    pageTitle: 'Catmull Spline Editor — paths you can drag',
    demoLabel: 'Catmull Spline Editor',
    hook: 'Interactive Catmull-Rom paths with transform gizmos — compare uniform, centripetal, and chordal types, tune tension, and export `Vector3` arrays for camera rails and object paths.',
    coverNote: 'The cover shows the editable spline with control points and curve type contrast.',
    whyBullets: [
      '- **Author paths visually** — no hand-typing coordinate lists first',
      '- **Curve type comparison** — uniform vs centripetal vs chordal in one place',
      '- **Export-ready** — Vector3 arrays for rails, fly-throughs, and modifiers',
      '- **WebGL reliability** — works where WebGPU is not available yet',
    ],
    whyUses: 'camera path planning, product turntable rails, and briefing tools for motion.',
    beginner:
      'A spline is a smooth curve guided by a few control points — like a flexible ruler. Drag the points, and the path updates. Filmmakers and games use the same idea for camera moves; here you edit it in the browser.',
    glossary: [
      { term: 'Catmull-Rom', def: 'spline family that interpolates through control points' },
      { term: 'Centripetal', def: 'parameterization that usually avoids loops/cusps better than uniform' },
      { term: 'Tension', def: 'how tightly the curve bends toward the controls' },
      { term: 'Gizmo', def: 'on-screen translate/rotate/scale handle for a point' },
    ],
    trySteps: [
      'Open the [Spline Editor demo](/demos/spline-editor/)',
      'Drag control points with the gizmo',
      'Switch uniform / centripetal / chordal and compare the bend',
      'Export or copy Vector3 data if the UI offers it — use it as a camera rail',
    ],
    requirements: [
      '**Browser:** modern WebGL browser (Chrome, Edge, Firefox, Safari)',
      '**Input:** mouse for gizmo drags; desktop is easiest',
      '**API:** WebGL Three.js example family — not WebGPU',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Full path — control points and smooth Catmull-Rom curve' },
    viewB: { file: 'view-b.jpg', caption: 'Gizmo edit — local reshape of the rail' },
    alsoCan: [
      'Feed exports into fly-through cameras',
      'Pair with the WebGPU curve modifier for type-on-path',
      'Use upstream [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor)',
    ],
    howWorks:
      'Control points define a `CatmullRomCurve3`; the editor visualizes the polyline/curve and lets you transform points. Curve type and tension change parameterization. Upstream: [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_geometry_spline_editor.html)). Exporting points connects to IOM path tools and the [WebGPU curve modifier](/demos/webgpu-modifier-curve/).',
    faq: [
      {
        q: 'Which curve type should I pick?',
        a: 'Centripetal is a safe default for avoiding sharp cusps; compare in the UI for your path.',
      },
      {
        q: 'Can this drive a real camera on a client site?',
        a: 'Yes — we wire exported points into a production camera controller.',
      },
    ],
    reading: [
      {
        label: 'three.js — spline editor',
        url: 'https://threejs.org/examples/#webgl_geometry_spline_editor',
      },
      { label: 'Catmull–Rom spline — Wikipedia', url: 'https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline' },
      { label: 'Three.js', url: 'https://threejs.org/' },
    ],
    related: [
      { label: 'WebGPU Curve Modifier', url: '/blog/webgpu-modifier-curve' },
      { label: 'Terrain Sandbox', url: '/blog/terrain-sandbox' },
    ],
  },

  'terrain-sandbox': {
    pageTitle: 'Terrain Sandbox — paint a world from noise',
    demoLabel: 'Terrain Sandbox',
    hook: 'Layered noise becomes hills you can orbit — drop trees, rocks, and markers, regenerate seeds, tune height and roughness. An IOM WebGL sandbox MVP toward brushes, GLTF, and real DEM data.',
    coverNote: 'The cover shows a seeded terrain patch with scattered props.',
    whyBullets: [
      '- **Playable landscape** — stakeholders understand site mood fast',
      '- **Seed + knobs** — reproducible variants for art direction',
      '- **Props on the surface** — trees/rocks/markers for scale stories',
      '- **Roadmap-friendly** — MVP toward sculpt, GLTF, MapTiler DEM',
    ],
    whyUses: 'early environment pitches, game-like previews, and workshop tools for layout talks.',
    beginner:
      'The ground is not sculpted by hand yet — math (noise) invents hills. You change how tall and rough they are, plant a few objects so the scale feels real, and spin around as if scouting a location.',
    glossary: [
      { term: 'Procedural terrain', def: 'landscape generated from algorithms instead of a scanned mesh' },
      { term: 'Seed', def: 'number that makes the same random landscape reproducible' },
      { term: 'DEM', def: 'digital elevation model — real-world height data (future path)' },
      { term: 'WebGL', def: 'browser 3D API used by this sandbox' },
    ],
    trySteps: [
      'Open the [Terrain Sandbox demo](/demos/terrain-sandbox/)',
      'Orbit the terrain; regenerate seed for a new landform',
      'Tune height and roughness',
      'Place trees, rocks, or markers and re-check silhouette',
    ],
    requirements: [
      '**Browser:** modern WebGL browser',
      '**GPU:** larger grids cost more — reduce resolution on light devices',
      '**Network:** none required for core noise terrain (props are local to the demo)',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Wide landform — noise hills with readable ridgelines' },
    viewB: { file: 'view-b.jpg', caption: 'Prop pass — trees/rocks giving human scale' },
    alsoCan: [
      'Save favorite seeds as art-direction references',
      'Plan a follow-up with sculpt brushes or GLTF props',
      'Compare with real-world tiles in Procedural GL',
    ],
    howWorks:
      'Layered noise samples build a heightmap; a mesh is displaced and shaded; props raycast or height-sample onto the surface. The stack is Three.js on **WebGL** for broad support. This is an IOM sandbox MVP — not a three.js stock example — with a path toward brushes, asset import, and optional MapTiler DEM for real sites.',
    faq: [
      {
        q: 'Is this real geography?',
        a: 'Not yet — procedural noise. Real DEM / MapTiler is on the roadmap for site-true work.',
      },
      {
        q: 'WebGL or WebGPU?',
        a: 'WebGL for this sandbox so more devices can open the link.',
      },
    ],
    reading: [
      { label: 'Three.js', url: 'https://threejs.org/' },
      { label: 'MapTiler', url: 'https://www.maptiler.com/' },
      {
        label: 'Procedural noise (intro)',
        url: 'https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web/Building_up_a_basic_demo_with_Three.js',
      },
    ],
    related: [
      { label: 'Procedural GL Terrain', url: '/blog/procedural-gl' },
      { label: 'WebGPU TSL Raging Sea', url: '/blog/webgpu-tsl-raging-sea' },
    ],
  },

  'procedural-gl': {
    pageTitle: 'Procedural GL Terrain — real-world tiles in 3D',
    demoLabel: 'Procedural GL Terrain',
    hook: 'Real landscapes streamed as GPU LOD terrain — our page embeds the official [procedural.eu](https://www.procedural.eu/map/) map powered by procedural-gl.js (MPL-2.0). First step: the live upstream demo; a self-hosted MapTiler build can follow.',
    coverNote:
      'The cover is a live still from the procedural.eu map embed — real MapTiler elevation/imagery tiles in 3D, not a noise sandbox.',
    whyBullets: [
      '- **Real places** — elevation from map tiles, not only noise',
      '- **GPU LOD** — detail where you look, lighter meshes farther out',
      '- **Open-source core** — procedural-gl.js under MPL-2.0',
      '- **Bridge to production** — embed now; self-host later with your key',
    ],
    whyUses: 'site context for architecture, location pitches, and geo storytelling on the web.',
    beginner:
      'Instead of inventing hills, this viewer loads real terrain tiles so you can fly over actual geography in 3D — closer to a lightweight Earth view than a game level made of noise.',
    glossary: [
      { term: 'LOD', def: 'level of detail — more mesh detail near the camera' },
      { term: 'Map tiles', def: 'image/elevation pieces streamed for the current view' },
      { term: 'procedural-gl.js', def: 'open-source library for GPU terrain from map data' },
      { term: 'MapTiler', def: 'tile provider often used for production keys (kept out of the repo)' },
    ],
    trySteps: [
      'Open the [Procedural GL demo](/demos/procedural-gl/)',
      'Wait for the embedded [procedural.eu map](https://www.procedural.eu/map/) to load',
      'Pan and zoom across real terrain',
      'Imagine dropping a client building or path on a known ridge',
    ],
    requirements: [
      '**Network:** required — tiles and the procedural.eu embed need connectivity',
      '**Browser:** modern Chromium recommended for WebGL terrain',
      '**Keys:** production MapTiler keys stay server-side / env — never committed',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Regional view — LOD terrain from streamed tiles' },
    viewB: { file: 'view-b.jpg', caption: 'Closer relief — ridges and valleys reading in 3D' },
    alsoCan: [
      'Use as context beside a geolocated GLB',
      'Plan a self-hosted MapTiler-backed fork',
      'Read docs at [procedural.eu](https://www.procedural.eu/)',
    ],
    howWorks:
      'Our `/demos/procedural-gl/` page embeds the official map experience at [procedural.eu/map](https://www.procedural.eu/map/). Under the hood, [procedural-gl-js](https://github.com/felixpalmer/procedural-gl-js) builds GPU LOD meshes from elevation/imagery tiles (WebGL). IOM’s next step can be a self-hosted build with MapTiler — API keys stay out of the git repo. This is geographic terrain, complementary to the procedural noise [Terrain Sandbox](/demos/terrain-sandbox/).',
    faq: [
      {
        q: 'Is the map hosted by IOM?',
        a: 'This first step embeds procedural.eu. A self-hosted variant is a separate production task.',
      },
      {
        q: 'WebGL or WebGPU?',
        a: 'WebGL terrain streaming via procedural-gl.js — chosen for the library’s stack and tile ecosystem.',
      },
    ],
    reading: [
      { label: 'procedural.eu map', url: 'https://www.procedural.eu/map/' },
      { label: 'procedural.eu docs', url: 'https://www.procedural.eu/' },
      { label: 'procedural-gl-js on GitHub', url: 'https://github.com/felixpalmer/procedural-gl-js' },
    ],
    related: [
      { label: 'Terrain Sandbox', url: '/blog/terrain-sandbox' },
      { label: 'Streets GL Bridge', url: '/blog/streets-gl-bridge' },
    ],
  },

  spout: {
    pageTitle: 'Spout — raymarched pipe water',
    demoLabel: 'Spout',
    hook: 'A chrome pipe pouring raymarched water — refraction, transparency, and reflections in a self-hosted WebGL2 port of P_Malin’s classic Shadertoy. Drag to orbit the sculpture of fluid — then see the same water beat layered into our [360° Panorama Tour](https://iobjectm.com/demos/panorama-360/) (guided Step 3).',
    coverNote:
      'The cover shows the pipe spout with refractive water catching the environment. The same effect language appears as Step 3 (`+particles/spout`) inside https://iobjectm.com/demos/panorama-360/.',
    whyBullets: [
      '- **Shadertoy pedigree** — a known study piece, now on iobjectm.com',
      '- **Raymarched water** — no particle splash mesh; distance fields do the work',
      '- **Refraction & reflection** — material language clients recognize from ads',
      '- **WebGL2 port** — broad real-time reach without WebGPU',
      '- **Wired into 360 tours** — Step 3 on [Panorama 360](https://iobjectm.com/demos/panorama-360/) pairs spout/water with a hotspot popup',
    ],
    whyUses:
      'shader craft demos, liquid branding mood boards, teaching raymarching look-dev, and water beats inside interactive 360° guided tours.',
    beginner:
      'The water is not a filmed splash. The GPU walks rays through a mathematical shape until it hits “water” or “metal,” then bends the view like a lens. That is why the pipe and fluid can look so clean from every angle. In our [360° tour](https://iobjectm.com/demos/panorama-360/), that same liquid language becomes a guided stop guests can look around and click.',
    glossary: [
      { term: 'Raymarching', def: 'stepping along a ray through a distance field until a surface is found' },
      { term: 'SDF', def: 'signed distance function — math that describes shapes for raymarchers' },
      { term: 'Refraction', def: 'bending of the view through transparent water' },
      { term: 'Shadertoy', def: 'online playground for pixel/raymarch shaders (original by P_Malin)' },
      {
        term: 'Guided tour Step 3',
        def: 'on /demos/panorama-360/ — cam · +particles/spout · hotspot+popup',
      },
    ],
    trySteps: [
      'Open the [Spout demo](/demos/spout/)',
      'Drag to orbit the pipe and water',
      'Watch refraction shift the background through the fluid',
      'Open [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, and watch Step 3 (spout / water + hotspot)',
      'Compare with the original [Shadertoy view](https://www.shadertoy.com/view/lsXGzH)',
    ],
    requirements: [
      '**Browser:** WebGL2-capable Chrome, Edge, Firefox, or Safari',
      '**GPU:** light-to-moderate raymarch cost — reduce resolution if needed',
      '**API:** WebGL2 shader port — not WebGPU compute',
    ],
    viewA: { file: 'view-a.jpg', caption: 'Hero spout — pipe metal and refractive water column' },
    viewB: { file: 'view-b.jpg', caption: 'Orbit detail — reflections and transparency in the fluid' },
    alsoCan: [
      'Retune palette for brand metals and fluid tint',
      'Use stills as look-dev references for product liquids',
      'Drop the water beat into a [360° guided tour](/demos/panorama-360/) stop (Step 3)',
      'Credit and study P_Malin’s [Shadertoy](https://www.shadertoy.com/view/lsXGzH)',
    ],
    howWorks:
      'A full-screen (or mesh-bound) WebGL2 fragment shader raymarches SDFs for the pipe and water, applying refraction, transparency, and reflections. IOM hosts a port of P_Malin’s Shadertoy experiment [lsXGzH](https://www.shadertoy.com/view/lsXGzH) under `/demos/spout/`. This is classic shader art on **WebGL2**, complementary to Three.js scene demos and distinct from WebGPU TSL water.',
    tourBridge: {
      step: 3,
      stepLabel: 'Guided tour Step 3 — spout / water particles + hotspot popup on The Black Witness',
      body: `Spout is not only a standalone experiment. On [https://iobjectm.com/demos/panorama-360/](https://iobjectm.com/demos/panorama-360/), **Step 3** of The Black Witness guided tour is authored as \`cam · +particles/spout · hotspot+popup\`: the camera lands on the rooftop water beat, the spout/water layer sells liquid motion in place, and a hotspot popup keeps the narrative interactive.

That is the interactivity benefit — guests do not only watch refraction; they arrive at a **timed stop**, can still drag to look around, and can click the hotspot for meaning. Open the editor or [visitor preview](https://iobjectm.com/demos/panorama-360/?mode=preview), hit **Play guided tour**, and step to Step 3. Pair with [WebGPU Particles](/blog/webgpu-particles) (Step 2) and [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4) for the full effects stack.`,
    },
    faq: [
      {
        q: 'Is the water simulated with physics?',
        a: 'No — it is raymarched shader geometry/animation, not a fluid particle sim.',
      },
      {
        q: 'Can this run inside a Three.js product scene?',
        a: 'Often as a screen pass or localized effect — we scope integration per project. The panorama tour at https://iobjectm.com/demos/panorama-360/ is one production example.',
      },
      {
        q: 'Where does Spout show up in the 360 tour?',
        a: 'Guided-tour Step 3 on The Black Witness — spout/water with a hotspot popup. Open https://iobjectm.com/demos/panorama-360/ and Play guided tour.',
      },
    ],
    reading: [
      { label: 'Panorama 360 (live)', url: 'https://iobjectm.com/demos/panorama-360/' },
      { label: 'Panorama 360 — visitor preview', url: 'https://iobjectm.com/demos/panorama-360/?mode=preview' },
      { label: 'Shadertoy — Spout (P_Malin)', url: 'https://www.shadertoy.com/view/lsXGzH' },
      { label: 'Ray marching — Wikipedia', url: 'https://en.wikipedia.org/wiki/Ray_marching' },
      { label: 'WebGL2 — MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext' },
    ],
    related: [
      { label: '360° Panorama Tour Editor', url: '/blog/panorama-360-tour' },
      { label: 'The Black Witness — 360° Tour', url: '/blog/panorama-suite' },
      { label: 'WebGPU Particles', url: '/blog/webgpu-particles' },
      { label: 'WebGPU Compute Birds', url: '/blog/webgpu-compute-birds' },
    ],
  },
}
