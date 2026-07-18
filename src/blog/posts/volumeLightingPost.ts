import type { BlogPost } from '../types'

/** Canonical volume-lighting demo post — used in samplePosts for local review. */
export const VOLUME_LIGHTING_BLOG_POST: BlogPost = {
  id: 'sample-blog-volume-lighting',
  slug: 'volume-lighting',
  title: 'Volumetric Lighting — Rect Area lights in the browser',
  excerpt:
    'See god rays live in the browser: WebGPU volumetric lights, a Pagani turntable, camera paths, and your own GLB — for product viz, pitches, and anyone curious how the effect works.',
  body: `God rays in a product shot used to mean offline renders or heavy game engines. This demo brings that “light you can see in the air” look to a Chrome/Edge tab — colored panel lights, soft haze, a car on a turntable, and camera views you can record.

It lives in our [3D section](/#3d) as **Volumetric Lighting — Rect Area**. The cover above is the hero three-quarter view (Pagani silhouetted against the RGB beams).

## Open the live demo

**[→ Launch Volumetric Lighting](/demos/volume-lighting/)**

Drag to orbit, scroll to zoom. No install. If your browser does not support WebGPU, you will see a clear message instead of a blank page.

## Why this matters (even if you are not a developer)

Visible light beams make a product feel premium and cinematic — the same language as car ads, museum lighting, and brand films. The difference here is **speed and access**:

- **Pitch a look in minutes** — open a link, orbit the car, tweak fog, record a camera path
- **Test your own model** — drop in a GLB / GLTF / FBX and see how it reads under volumetric light
- **No render farm wait** — clients and stakeholders can try it on a laptop during a call
- **Showroom / booth ready** — same tech family we use for immersive web experiences on [iobjectm.com](/)

Typical uses: automotive and product configurators, launch pages, trade-booth previews, gallery lighting studies, and “what if we lit it like this?” conversations before a full production build.

## For beginners — what is this, in plain words?

Think of a dusty warehouse with sunlight pouring through a high window. You do not only see the bright window — you see the **beam** in the air, because dust makes the light path visible. That look is often called **god rays** or **volumetric lighting**.

In film and games, those beams usually take a long time to render, or need a heavy desktop app. Here the same idea runs **live in your browser**.

**Quick glossary**

- **Browser demo** — a webpage that draws 3D graphics, not a downloadable app
- **WebGPU** — a newer way browsers talk to your graphics card ([Wikipedia](https://en.wikipedia.org/wiki/WebGPU), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API))
- **Three.js** — a popular toolkit for 3D on the web ([threejs.org](https://threejs.org/))
- **Rect area light** — a light shaped like a glowing panel or softbox, not a tiny point bulb
- **Camera view** — a saved angle you can jump back to or play as a short path

## Try this in about 60 seconds

1. Open the [live demo](/demos/volume-lighting/)
2. **Drag** on the scene to orbit; **scroll** to zoom
3. Top-left: open **Camera views** → click **Record** (or press **Ctrl+Shift+S**) to save the current angle
4. Top-right: open **Volumetric Lighting** → try **fog intensity** and **smoke amount**
5. Optional: open **Objects** → import a small GLB to replace or sit beside the stock car
6. Hit **Play** in Camera views to step between any views you recorded

![Where to click — Camera views (left), Volumetric Lighting and Objects (right)](/assets/blog/volume-lighting/ui.jpg?v=20260718d)

## Requirements and performance

- **Browser:** Chrome or Edge 113+ recommended; Firefox Nightly may work as WebGPU matures. Safari support is improving but can lag.
- **Hardware:** A laptop with a discrete or recent integrated GPU is ideal. On weaker machines, lower **resolution** and **step count** under Volumetric Lighting → Ray Marching.
- **Mobile:** The demo runs, but controls and GPU cost are heavier — desktop is the best first experience.
- **If it stutters:** reduce fog intensity, smoke amount, or ray-march resolution; close other GPU-heavy tabs.

## What you see

Two more angles from the same scene (stock Pagani Utopia under rotating RGB rect lights). The cover image is the first camera; these continue the walkthrough:

![Through the beams — looking past the rect-area panels into the fog volume](/assets/blog/volume-lighting/beams.jpg?v=20260718d)

![Low side profile — metallic body, floor shadows, and volumetric haze](/assets/blog/volume-lighting/profile.jpg?v=20260718d)

Also in the demo:

- Orbit, zoom, and record **camera keyframes**, then play a path between views
- Import your own **GLB / GLTF / FBX** and re-light it in the same fog volume
- Tweak ray-march resolution, step count, denoise, fog intensity, and smoke amount
- Save / load a \`.vlproject.json\` project file

## How it works

The scene is not fake bloom over a flat plate. A volume box is ray-marched each frame through a 3D noise field so light shafts pick up density as they travel.

### WebGPU

[WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) is the modern GPU API for the web — closer to Vulkan/Metal/D3D12 than older WebGL. It unlocks newer shading pipelines that three.js exposes through its WebGPU renderer.

### Three.js + TSL

We use [Three.js](https://threejs.org/) (r185 in this demo) with \`WebGPURenderer\`, TSL nodes, and \`VolumeNodeMaterial\`. Rect-area lights feed the volumetric pass; separate spotlight proxies handle surface lighting and shadows (rect-area lights do not cast classic shadow maps).

Defaults keep the effect interactive: quarter-resolution ray march, modest step counts, and optional Gaussian denoise so mid-range GPUs stay smooth.

### Beyond the upstream example

The starting point is the official three.js [volumetric lighting rect-area](https://threejs.org/examples/#webgpu_volume_lighting_rectarea) example ([source on GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_volume_lighting_rectarea.html)). IOM adds the Pagani scene, model import, transform gizmo, camera keyframes, and project save/load.

Stock car: [Pagani Utopia 2023 on Sketchfab](https://sketchfab.com/3d-models/pagani-utopia-2023-4787fa901db1454bb971ba83739d1de6) ([zirodesign](https://sketchfab.com/zirodesign)) — credit retained in the demo attribution.

## FAQ

**Do I need to install an app?**  
No. It is a webpage. You only need a WebGPU-capable browser.

**Can I use my own 3D model?**  
Yes. Use the Objects panel to import GLB, GLTF, or FBX and re-light it in the same volume.

**Is this WebGL or WebGPU?**  
This demo targets **WebGPU** via Three.js. Older WebGL demos elsewhere on the site are a different, more widely supported path — useful when you need broader device coverage.

**Can clients try this on a call?**  
Yes — share the [demo link](/demos/volume-lighting/). For a polished pitch, we can lock camera paths, branding, and a custom model.

## Tech stack and further reading

- [WebGPU — Wikipedia](https://en.wikipedia.org/wiki/WebGPU)
- [WebGPU API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/) and the [rect-area volumetric example](https://threejs.org/examples/#webgpu_volume_lighting_rectarea)
- Related IOM builds: [Art Gallery — WebGPU SSR + Denoise](/demos/ssr-denoise/), [WebGPU Spotlight](/demos/webgpu-spotlight/)

## Related on IOM

Browse more realtime work in [3D](/#3d) and [Experiments](/#experiments), or [contact us](/#contact) if you want volumetric lighting or WebGPU product viz scoped for a client pitch.`,
  cover_image_url: '/assets/blog/volume-lighting/cover.jpg?v=20260718d',
  status: 'published',
  published_at: '2026-07-18T12:00:00.000Z',
  seo_title: 'Volumetric Lighting with WebGPU Rect Area Lights — IOM',
  seo_description:
    'Try IOM’s WebGPU volumetric lighting demo: god rays, Pagani turntable, camera paths, and GLB import — plus a beginner guide, try-this walkthrough, and when to use it for product viz.',
  author_name: 'IOM',
  tags: ['3d', 'webgpu', 'three.js', 'lighting', 'volumetric'],
  owner_id: null,
  created_at: '2026-07-18T10:00:00.000Z',
  updated_at: '2026-07-18T19:05:00.000Z',
}
