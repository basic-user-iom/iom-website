-- Upsert demo-catalog translations into blog_post_translations by slug.
-- Run AFTER blog_post_translations.sql (and after posts exist in blog_posts).
-- Safe to re-run.

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$3D Viewer — product models in the browser$iom$,
  $iom$v3.19.2 desktop release: Streets GL reliability and texture quality, Product-mode texture restore after City teardown, unified panel headers — plus GLTF/FBX/OBJ/IFC review with HDR ground projection and Streets GL.$iom$,
  $iom$![Product walkthrough — orbit, HDR lighting, and viewer chrome](/assets/blog/3d-viewer/walkthrough.webm?v=20260722a)

Clients should not need a CAD seat to review a model. Our 3D Viewer puts GLTF, FBX, OBJ, and IFC in a shareable browser (and desktop) window — orbit, inspect materials, light with 360° HDR and ground projection, or drop the mesh into OSM / Streets GL city context when location is the story.

It lives in our [Software section](/#software) as **3D Viewer**. A short walkthrough leads the post; the stills below show 360° HDR ground projection and OSM 3D / Streets GL city context inside the same viewer.

## Open the live demo

**[→ Launch 3D Viewer](https://3dbviewer.com/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Share a link, not a ZIP** — stakeholders open the model on a laptop during a call
- **One viewer for many formats** — fewer “which app opens this?” emails
- **360° HDR + ground projection** — real lighting and contact shadows so the product sits in the plate
- **OSM 3D / Streets GL inside the viewer** — combine city context with your own models when the street sells the pitch

Typical uses: product configurators, architecture and outdoor placements, trade-show tablets, async client approvals, and standalone web presentations exported from the same pipeline.

## For beginners — what is this, in plain words?

A 3D viewer is like a photo of your product that you can spin. Instead of flat images, the real model sits in the page — drag to turn it, zoom into details, wrap it in HDR light, or place it on a real OpenStreetMap city when you need “where does this sit?” No install for the web build; a Windows desktop build covers offline or heavier assets.

**Quick glossary**

- **GLTF / GLB** — common web-friendly 3D file formats ([Khronos glTF](https://www.khronos.org/gltf/))
- **Orbit** — drag to rotate the camera around the model
- **360° HDR environment** — a high-dynamic-range wrap that lights the model from a real sky/scene
- **Ground projection** — projecting the HDR onto the floor plane so shadows and reflections match the environment
- **OSM 3D / Streets GL** — OpenStreetMap-derived 3D city context you can combine with your models inside the viewer ([streets.gl](https://streets.gl/))
- **Hotspot** — a clickable marker on the model with info or a link

## Try this in about 60 seconds

1. Open the [3D Viewer site](https://3dbviewer.com/) or grab Windows Setup / Portable from the [v3.19.2 release](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)
2. Load a sample or your own GLTF/GLB if the build allows import
3. Try a 360° HDR environment with ground projection — watch contact shadows lock the product to the plate
4. Open OSM 3D / Streets GL and imagine (or place) your model in real city fabric

## Requirements and performance

- **Browser:** modern Chrome, Edge, or Firefox for the web build
- **Windows desktop:** Setup or Portable from [GitHub Releases v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2) (Electron 41)
- **Files:** prefer GLB/GLTF for web; heavy CAD may need conversion first
- **GPU:** path tracing and dense city layers want a decent GPU — fall back to lighter modes on soft devices

## What you see

Two capabilities that sell the model beyond a grey void — cinematic HDR lighting, then real city fabric:

![360° HDR with ground projection — product lit by the plate, shadows reading on asphalt](/assets/blog/3d-viewer/view-a.jpg?v=20260722a)

![OSM 3D / Streets GL inside the viewer — city context you can combine with your models](/assets/blog/3d-viewer/view-b.jpg?v=20260722a)

Also in this build:

- Switch HDR environments and time-of-day for different moods
- Use path tracing for stills when quality beats real-time speed
- Blend Product / City / Hybrid modes when reviewing outdoor or urban placements
- Export a standalone web presentation for client handoff

## How it works

The viewer is built on the [Three.js](https://threejs.org/) family with a focus on practical review: load meshes, frame them, light them with HDR + ground projection, and — when the brief needs a street — open OSM 3D / Streets GL city context in the same chrome. Desktop builds extend the same idea when offline or large assets matter. Format support follows real client pipelines — the goal is always “open, understand, decide.” Live product: [3dbviewer.com](https://3dbviewer.com/).

## What’s new in v3.19.2

Streets GL bridge reliability and texture quality, plus Product-mode polish:

- **Streets GL sync** — vertex-budget simplify that preserves UVs so cars and large meshes land reliably in city context
- **Better textures in City** — up to 4k binary texture transfer with automatic payload fit for large Meshy maps
- **Product-mode restore** — textures no longer disappear after leaving Streets GL / City teardown
- **Unified panel headers** — shared FloatingPanelHeader chrome across editor panels

**Download (Windows x64):** [Setup](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Setup-3.19.2-x64.exe) | [Portable](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Portable-3.19.2-x64.exe) | [Release notes](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)

## FAQ

**Do clients need CAD software?**  
No for review — a browser link is enough for most stakeholders.

**Can we show the model on a real street?**  
Yes — OSM 3D / Streets GL runs inside the viewer so you can combine city context with your GLB/GLTF.

**Where do I get the Windows desktop build?**  
Setup and Portable installers are on the [v3.19.2 GitHub release](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2), also linked from [3dbviewer.com](https://3dbviewer.com/).

**Can we brand it?**  
Yes. Viewer chrome, environments, and hotspot content can follow your brand.

## Tech stack and further reading

- [3D Viewer live](https://3dbviewer.com/)
- [v3.19.2 Windows downloads](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)
- [glTF overview — Khronos](https://www.khronos.org/gltf/)
- [Streets GL live map](https://streets.gl/)
- [Three.js](https://threejs.org/)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

## Related on IOM

Browse more in [Software](/#software), plus [Streets GL Bridge](/blog/streets-gl-bridge), [Volumetric Lighting](/blog/volume-lighting), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$3D Viewer v3.19.2 — Streets GL textures & reliability — IOM$iom$,
  $iom$3D Viewer v3.19.2 for Windows (Setup + Portable): Streets GL vertex-budget/simplify fixes, UV-preserving 4k textures, Product-mode texture restore, and unified floating panel headers. Browser review for GLTF/FBX/OBJ/IFC with HDR and Streets GL.$iom$
from public.blog_posts p
where p.slug = $iom$3d-viewer$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$3D Viewer — Produktmodelle im Browser$iom$,
  $iom$v3.19.2 Desktop-Release: Streets GL Zuverlässigkeit und Texturqualität, Product-Mode-Texturwiederherstellung nach City-Teardown, einheitliche Panel-Header — plus GLTF/FBX/OBJ/IFC-Review mit HDR-Bodenprojektion und Streets GL.$iom$,
  $iom$![Produkt-Walkthrough — Orbit, HDR-Beleuchtung und Viewer-Chrome](/assets/blog/3d-viewer/walkthrough.webm?v=20260722a)

Kunden sollten keinen CAD-Platz brauchen, um ein Modell zu prüfen. Unser 3D Viewer stellt GLTF, FBX, OBJ und IFC in einem teilbaren Browser- (und Desktop-)Fenster bereit — Orbit, Materialien inspizieren, mit 360° HDR und Bodenprojektion beleuchten oder das Mesh in OSM / Streets GL-Stadtkontext platzieren, wenn der Standort die Geschichte erzählt.

Es liegt in unserem [Software-Bereich](/#software) als **3D Viewer**. Ein kurzer Walkthrough leitet den Beitrag; die Stills unten zeigen 360° HDR-Bodenprojektion und OSM 3D / Streets GL-Stadtkontext im selben Viewer.

## Live-Demo öffnen

**[→ 3D Viewer starten](https://3dbviewer.com/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Link teilen, nicht ZIP** — Stakeholder öffnen das Modell während eines Calls auf dem Laptop
- **Ein Viewer für viele Formate** — weniger E-Mails mit „Welche App öffnet das?“
- **360° HDR + Bodenprojektion** — echte Beleuchtung und Kontaktschatten, damit das Produkt auf der Platte sitzt
- **OSM 3D / Streets GL im Viewer** — Stadtkontext mit eigenen Modellen kombinieren, wenn die Straße den Pitch verkauft

Typische Einsätze: Produktkonfiguratoren, Architektur- und Außenplatzierungen, Messe-Tablets, asynchrone Kundenfreigaben und eigenständige Web-Präsentationen aus derselben Pipeline.

## Für Einsteiger — was ist das, in einfachen Worten?

Ein 3D-Viewer ist wie ein Foto Ihres Produkts, das Sie drehen können. Statt flacher Bilder sitzt das echte Modell auf der Seite — ziehen zum Drehen, zoomen für Details, in HDR-Licht hüllen oder auf einer echten OpenStreetMap-Stadt platzieren, wenn Sie „Wo sitzt das?“ brauchen. Keine Installation für die Web-Version; ein Windows-Desktop-Build deckt Offline oder schwere Assets ab.

**Kurzes Glossar**

- **GLTF / GLB** — gängige webfreundliche 3D-Dateiformate ([Khronos glTF](https://www.khronos.org/gltf/))
- **Orbit** — ziehen, um die Kamera um das Modell zu drehen
- **360° HDR-Umgebung** — ein High-Dynamic-Range-Wrap, der das Modell von echtem Himmel/Szene aus beleuchtet
- **Bodenprojektion** — Projektion des HDR auf die Bodenebene, damit Schatten und Reflexionen zur Umgebung passen
- **OSM 3D / Streets GL** — OpenStreetMap-basierter 3D-Stadtkontext, den Sie mit Ihren Modellen im Viewer kombinieren können ([streets.gl](https://streets.gl/))
- **Hotspot** — ein klickbarer Marker auf dem Modell mit Info oder Link

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [3D Viewer Website](https://3dbviewer.com/) oder laden Sie Windows Setup / Portable vom [v3.19.2 Release](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)
2. Laden Sie ein Sample oder Ihr eigenes GLTF/GLB, wenn der Build Import erlaubt
3. Probieren Sie eine 360° HDR-Umgebung mit Bodenprojektion — beobachten Sie, wie Kontaktschatten das Produkt auf der Platte verankern
4. Öffnen Sie OSM 3D / Streets GL und stellen Sie sich (oder platzieren Sie) Ihr Modell im echten Stadtbild vor

## Anforderungen und Performance

- **Browser:** moderner Chrome, Edge oder Firefox für die Web-Version
- **Windows Desktop:** Setup oder Portable von [GitHub Releases v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2) (Electron 41)
- **Dateien:** GLB/GLTF für Web bevorzugen; schweres CAD ggf. zuerst konvertieren
- **GPU:** Path Tracing und dichte Stadtschichten wünschen eine solide GPU — auf leichten Geräten auf leichtere Modi zurückfallen

## Was Sie sehen

Zwei Fähigkeiten, die das Modell über eine graue Leere hinaus verkaufen — filmische HDR-Beleuchtung, dann echtes Stadtbild:

![360° HDR mit Bodenprojektion — Produkt von der Platte beleuchtet, Schatten auf Asphalt lesbar](/assets/blog/3d-viewer/view-a.jpg?v=20260722a)

![OSM 3D / Streets GL im Viewer — Stadtkontext, den Sie mit Ihren Modellen kombinieren können](/assets/blog/3d-viewer/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- HDR-Umgebungen und Tageszeit für verschiedene Stimmungen wechseln
- Path Tracing für Stills nutzen, wenn Qualität Echtzeitgeschwindigkeit schlägt
- Product / City / Hybrid-Modi beim Review von Außen- oder Stadtplatzierungen mischen
- Eigenständige Web-Präsentation für Kundenübergabe exportieren

## So funktioniert es

Der Viewer basiert auf der [Three.js](https://threejs.org/)-Familie mit Fokus auf praktisches Review: Meshes laden, einrahmen, mit HDR + Bodenprojektion beleuchten und — wenn das Briefing eine Straße braucht — OSM 3D / Streets GL-Stadtkontext im selben Chrome öffnen. Desktop-Builds erweitern dieselbe Idee bei Offline oder großen Assets. Formatunterstützung folgt echten Kundenpipelines — das Ziel ist immer „öffnen, verstehen, entscheiden.“ Live-Produkt: [3dbviewer.com](https://3dbviewer.com/).

## Neu in v3.19.2

Streets GL Bridge-Zuverlässigkeit und Texturqualität, plus Product-Mode-Feinschliff:

- **Streets GL Sync** — Vertex-Budget-Simplify mit UV-Erhalt, damit Autos und große Meshes zuverlässig im Stadtkontext landen
- **Bessere Texturen in City** — bis 4k binärer Texturtransfer mit automatischer Payload-Anpassung für große Meshy-Maps
- **Product-Mode Restore** — Texturen verschwinden nicht mehr nach Verlassen von Streets GL / City-Teardown
- **Einheitliche Panel-Header** — gemeinsames FloatingPanelHeader-Chrome über Editor-Panels

**Download (Windows x64):** [Setup](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Setup-3.19.2-x64.exe) | [Portable](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Portable-3.19.2-x64.exe) | [Release Notes](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)

## FAQ

**Brauchen Kunden CAD-Software?**  
Nein für Review — ein Browser-Link reicht den meisten Stakeholdern.

**Können wir das Modell auf einer echten Straße zeigen?**  
Ja — OSM 3D / Streets GL läuft im Viewer, damit Sie Stadtkontext mit Ihrem GLB/GLTF kombinieren können.

**Wo bekomme ich den Windows-Desktop-Build?**  
Setup- und Portable-Installer stehen auf dem [v3.19.2 GitHub Release](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2), auch verlinkt von [3dbviewer.com](https://3dbviewer.com/).

**Können wir es branden?**  
Ja. Viewer-Chrome, Umgebungen und Hotspot-Inhalte können Ihrer Marke folgen.

## Tech-Stack und weiterführende Links

- [3D Viewer live](https://3dbviewer.com/)
- [v3.19.2 Windows-Downloads](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)
- [glTF Übersicht — Khronos](https://www.khronos.org/gltf/)
- [Streets GL Live-Karte](https://streets.gl/)
- [Three.js](https://threejs.org/)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

## Verwandt bei IOM

Mehr in [Software](/#software), plus [Streets GL Bridge](/blog/streets-gl-bridge), [Volumetrische Beleuchtung](/blog/volume-lighting), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$3D Viewer v3.19.2 — Streets GL Texturen & Zuverlässigkeit — IOM$iom$,
  $iom$3D Viewer v3.19.2 für Windows (Setup + Portable): Streets GL Vertex-Budget/Simplify-Fixes, UV-erhaltende 4k-Texturen, Product-Mode-Texturwiederherstellung und einheitliche Floating-Panel-Header. Browser-Review für GLTF/FBX/OBJ/IFC mit HDR und Streets GL.$iom$
from public.blog_posts p
where p.slug = $iom$3d-viewer$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$3D Viewer — modèles produit dans le navigateur$iom$,
  $iom$Version desktop v3.19.2 : fiabilité et qualité texture Streets GL, restauration texture mode Product après teardown City, en-têtes de panneau unifiés — plus revue GLTF/FBX/OBJ/IFC avec projection sol HDR et Streets GL.$iom$,
  $iom$![Visite produit — orbite, éclairage HDR et chrome du viewer](/assets/blog/3d-viewer/walkthrough.webm?v=20260722a)

Les clients ne devraient pas avoir besoin d’un poste CAD pour revoir un modèle. Notre 3D Viewer place GLTF, FBX, OBJ et IFC dans une fenêtre navigateur (et desktop) partageable — orbite, inspection des matériaux, éclairage 360° HDR et projection sol, ou dépose du mesh dans le contexte ville OSM / Streets GL quand le lieu raconte l’histoire.

Il se trouve dans notre [section Logiciel](/#software) sous **3D Viewer**. Une courte visite ouvre l’article ; les stills ci-dessous montrent la projection sol HDR 360° et le contexte ville OSM 3D / Streets GL dans le même viewer.

## Ouvrir la démo en direct

**[→ Lancer 3D Viewer](https://3dbviewer.com/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Partager un lien, pas un ZIP** — les parties prenantes ouvrent le modèle sur un laptop pendant un appel
- **Un viewer pour plusieurs formats** — moins d’e-mails « quelle app ouvre ça ? »
- **360° HDR + projection sol** — éclairage réel et ombres de contact pour ancrer le produit sur la plate
- **OSM 3D / Streets GL dans le viewer** — combiner contexte ville et vos modèles quand la rue vend le pitch

Usages typiques : configurateurs produit, placements architecture et extérieur, tablettes salon, validations client asynchrones et présentations web autonomes exportées depuis la même pipeline.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Un viewer 3D, c’est comme une photo de votre produit que l’on peut faire tourner. Au lieu d’images plates, le vrai modèle est dans la page — glisser pour tourner, zoomer les détails, l’envelopper de lumière HDR, ou le placer sur une vraie ville OpenStreetMap quand vous avez besoin de « où ça se situe ? ». Pas d’installation pour la version web ; un build desktop Windows couvre offline ou assets lourds.

**Glossaire rapide**

- **GLTF / GLB** — formats 3D web courants ([Khronos glTF](https://www.khronos.org/gltf/))
- **Orbit** — glisser pour faire tourner la caméra autour du modèle
- **Environnement HDR 360°** — enveloppe haute dynamique qui éclaire le modèle depuis un vrai ciel/scène
- **Projection sol** — projection du HDR sur le plan du sol pour ombres et reflets cohérents
- **OSM 3D / Streets GL** — contexte ville 3D dérivé d’OpenStreetMap combinable avec vos modèles dans le viewer ([streets.gl](https://streets.gl/))
- **Hotspot** — marqueur cliquable sur le modèle avec info ou lien

## Essayez en environ 60 secondes

1. Ouvrir le [site 3D Viewer](https://3dbviewer.com/) ou récupérer Setup / Portable Windows depuis la [release v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)
2. Charger un échantillon ou votre propre GLTF/GLB si le build autorise l’import
3. Essayer un environnement HDR 360° avec projection sol — voir les ombres de contact ancrer le produit
4. Ouvrir OSM 3D / Streets GL et imaginer (ou placer) votre modèle dans le tissu urbain réel

## Prérequis et performances

- **Navigateur :** Chrome, Edge ou Firefox moderne pour la version web
- **Desktop Windows :** Setup ou Portable depuis [GitHub Releases v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2) (Electron 41)
- **Fichiers :** privilégier GLB/GLTF pour le web ; CAD lourd peut nécessiter conversion
- **GPU :** path tracing et couches ville denses veulent un GPU correct — modes légers sur appareils modestes

## Ce que vous voyez

Deux capacités qui vendent le modèle au-delà du vide gris — éclairage HDR cinématique, puis tissu urbain réel :

![HDR 360° avec projection sol — produit éclairé par la plate, ombres lisibles sur l’asphalte](/assets/blog/3d-viewer/view-a.jpg?v=20260722a)

![OSM 3D / Streets GL dans le viewer — contexte ville combinable avec vos modèles](/assets/blog/3d-viewer/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Changer environnements HDR et heure du jour pour différentes ambiances
- Utiliser le path tracing pour des stills quand la qualité prime sur la vitesse
- Mélanger modes Product / City / Hybrid pour revues extérieur ou urbain
- Exporter une présentation web autonome pour remise client

## Comment ça marche

Le viewer repose sur la famille [Three.js](https://threejs.org/) avec un focus revue pratique : charger meshes, cadrer, éclairer HDR + projection sol, et — quand le brief demande une rue — ouvrir le contexte ville OSM 3D / Streets GL dans le même chrome. Les builds desktop étendent la même idée offline ou pour gros assets. Le support format suit les pipelines client réels — le but reste « ouvrir, comprendre, décider ». Produit live : [3dbviewer.com](https://3dbviewer.com/).

## Nouveautés v3.19.2

Fiabilité bridge Streets GL et qualité texture, plus polish mode Product :

- **Sync Streets GL** — simplify vertex-budget préservant les UV pour voitures et gros meshes fiables en contexte ville
- **Meilleures textures en City** — transfert texture binaire jusqu’à 4k avec ajustement payload pour grandes maps Meshy
- **Restore mode Product** — les textures ne disparaissent plus après teardown Streets GL / City
- **En-têtes panneau unifiés** — chrome FloatingPanelHeader partagé sur les panneaux éditeur

**Téléchargement (Windows x64) :** [Setup](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Setup-3.19.2-x64.exe) | [Portable](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Portable-3.19.2-x64.exe) | [Notes de release](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)

## FAQ

**Les clients ont-ils besoin de logiciel CAD ?**  
Non pour la revue — un lien navigateur suffit à la plupart des parties prenantes.

**Peut-on montrer le modèle sur une vraie rue ?**  
Oui — OSM 3D / Streets GL tourne dans le viewer pour combiner contexte ville et votre GLB/GLTF.

**Où obtenir le build desktop Windows ?**  
Installateurs Setup et Portable sur la [release GitHub v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2), aussi liée depuis [3dbviewer.com](https://3dbviewer.com/).

**Peut-on le brander ?**  
Oui. Chrome viewer, environnements et contenu hotspot peuvent suivre votre marque.

## Stack technique et lectures

- [3D Viewer live](https://3dbviewer.com/)
- [Téléchargements Windows v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)
- [Aperçu glTF — Khronos](https://www.khronos.org/gltf/)
- [Carte live Streets GL](https://streets.gl/)
- [Three.js](https://threejs.org/)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

## Sur IOM

Parcourez [Logiciel](/#software), plus [Streets GL Bridge](/blog/streets-gl-bridge), [Éclairage volumétrique](/blog/volume-lighting), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$3D Viewer v3.19.2 — textures & fiabilité Streets GL — IOM$iom$,
  $iom$3D Viewer v3.19.2 pour Windows (Setup + Portable) : correctifs vertex-budget/simplify Streets GL, textures 4k préservant les UV, restauration texture mode Product, en-têtes FloatingPanelHeader unifiés. Revue navigateur GLTF/FBX/OBJ/IFC avec HDR et Streets GL.$iom$
from public.blog_posts p
where p.slug = $iom$3d-viewer$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$3D Viewer — productmodellen in de browser$iom$,
  $iom$v3.19.2 desktop-release: Streets GL-betrouwbaarheid en textuurkwaliteit, Product-mode textuurherstel na City-teardown, uniforme paneelheaders — plus GLTF/FBX/OBJ/IFC-review met HDR-grondprojectie en Streets GL.$iom$,
  $iom$![Productwalkthrough — orbit, HDR-belichting en viewer-chrome](/assets/blog/3d-viewer/walkthrough.webm?v=20260722a)

Klanten zouden geen CAD-licentie nodig moeten hebben om een model te beoordelen. Onze 3D Viewer zet GLTF, FBX, OBJ en IFC in een deelbaar browser- (en desktop-)venster — orbit, materialen inspecteren, belichten met 360° HDR en grondprojectie, of het mesh in OSM / Streets GL-stadscontext plaatsen wanneer de locatie het verhaal vertelt.

Het staat in onze [Software-sectie](/#software) als **3D Viewer**. Een korte walkthrough opent het artikel; de stills hieronder tonen 360° HDR-grondprojectie en OSM 3D / Streets GL-stadscontext in dezelfde viewer.

## Open de live demo

**[→ Start 3D Viewer](https://3dbviewer.com/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Deel een link, geen ZIP** — stakeholders openen het model op een laptop tijdens een call
- **Eén viewer voor veel formaten** — minder e-mails met „welke app opent dit?”
- **360° HDR + grondprojectie** — echte belichting en contactschaduwen zodat het product op de plate staat
- **OSM 3D / Streets GL in de viewer** — stadscontext combineren met uw eigen modellen wanneer de straat de pitch verkoopt

Typische toepassingen: productconfigurators, architectuur- en buitenplaatsingen, beurs-tablets, asynchrone klantgoedkeuringen en standalone webpresentaties geëxporteerd uit dezelfde pipeline.

## Voor beginners — wat is dit, in gewone taal?

Een 3D-viewer is als een foto van uw product die u kunt draaien. In plaats van platte beelden staat het echte model op de pagina — slepen om te draaien, inzoomen op details, in HDR-licht wikkelen of op een echte OpenStreetMap-stad plaatsen wanneer u „waar staat dit?” nodig hebt. Geen installatie voor de webversie; een Windows-desktopbuild dekt offline of zware assets.

**Korte glossary**

- **GLTF / GLB** — gangbare webvriendelijke 3D-bestandsformaten ([Khronos glTF](https://www.khronos.org/gltf/))
- **Orbit** — slepen om de camera rond het model te draaien
- **360° HDR-omgeving** — een high-dynamic-range wrap die het model belicht vanuit een echte lucht/scène
- **Grondprojectie** — projectie van de HDR op het vloervlak zodat schaduwen en reflecties bij de omgeving passen
- **OSM 3D / Streets GL** — OpenStreetMap-afgeleide 3D-stadscontext die u met uw modellen in de viewer kunt combineren ([streets.gl](https://streets.gl/))
- **Hotspot** — een klikbare marker op het model met info of een link

## Probeer dit in ongeveer 60 seconden

1. Open de [3D Viewer-site](https://3dbviewer.com/) of download Windows Setup / Portable van de [v3.19.2-release](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)
2. Laad een sample of uw eigen GLTF/GLB als de build import toestaat
3. Probeer een 360° HDR-omgeving met grondprojectie — zie contactschaduwen het product op de plate verankeren
4. Open OSM 3D / Streets GL en stel u voor (of plaats) uw model in echt stadsbeeld

## Vereisten en performance

- **Browser:** moderne Chrome, Edge of Firefox voor de webversie
- **Windows desktop:** Setup of Portable van [GitHub Releases v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2) (Electron 41)
- **Bestanden:** geef de voorkeur aan GLB/GLTF voor web; zwaar CAD kan eerst conversie vereisen
- **GPU:** path tracing en dichte stadslagen vragen een degelijke GPU — val terug op lichtere modi op zwakkere apparaten

## Wat je ziet

Twee mogelijkheden die het model verder verkopen dan een grijs niets — filmische HDR-belichting, daarna echt stadsbeeld:

![360° HDR met grondprojectie — product belicht door de plate, schaduwen leesbaar op asfalt](/assets/blog/3d-viewer/view-a.jpg?v=20260722a)

![OSM 3D / Streets GL in de viewer — stadscontext die u met uw modellen kunt combineren](/assets/blog/3d-viewer/view-b.jpg?v=20260722a)

Ook in deze build:

- Wissel HDR-omgevingen en tijd van de dag voor verschillende sferen
- Gebruik path tracing voor stills wanneer kwaliteit belangrijker is dan realtime snelheid
- Mix Product / City / Hybrid-modi bij review van buiten- of stedelijke plaatsingen
- Exporteer een standalone webpresentatie voor klantoverdracht

## Hoe het werkt

De viewer is gebouwd op de [Three.js](https://threejs.org/)-familie met focus op praktische review: meshes laden, kadreren, belichten met HDR + grondprojectie, en — wanneer de briefing een straat nodig heeft — OSM 3D / Streets GL-stadscontext openen in dezelfde chrome. Desktopbuilds breiden hetzelfde idee uit voor offline of grote assets. Formaatondersteuning volgt echte klantpipelines — het doel is altijd „openen, begrijpen, beslissen.” Live product: [3dbviewer.com](https://3dbviewer.com/).

## Nieuw in v3.19.2

Streets GL Bridge-betrouwbaarheid en textuurkwaliteit, plus Product-mode-verfijning:

- **Streets GL sync** — vertex-budget simplify met UV-behoud zodat auto's en grote meshes betrouwbaar in stadscontext landen
- **Betere textures in City** — tot 4k binaire textuuroverdracht met automatische payload-fit voor grote Meshy-maps
- **Product-mode restore** — textures verdwijnen niet meer na verlaten van Streets GL / City-teardown
- **Uniforme paneelheaders** — gedeelde FloatingPanelHeader-chrome over editorpanelen

**Download (Windows x64):** [Setup](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Setup-3.19.2-x64.exe) | [Portable](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Portable-3.19.2-x64.exe) | [Release notes](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)

## FAQ

**Hebben klanten CAD-software nodig?**  
Nee voor review — een browserlink is genoeg voor de meeste stakeholders.

**Kunnen we het model op een echte straat tonen?**  
Ja — OSM 3D / Streets GL draait in de viewer zodat u stadscontext met uw GLB/GLTF kunt combineren.

**Waar krijg ik de Windows-desktopbuild?**  
Setup- en Portable-installers staan op de [v3.19.2 GitHub-release](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2), ook gelinkt vanaf [3dbviewer.com](https://3dbviewer.com/).

**Kunnen we het branden?**  
Ja. Viewer-chrome, omgevingen en hotspot-inhoud kunnen uw merk volgen.

## Tech stack en verder lezen

- [3D Viewer live](https://3dbviewer.com/)
- [v3.19.2 Windows-downloads](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)
- [glTF-overzicht — Khronos](https://www.khronos.org/gltf/)
- [Streets GL live-kaart](https://streets.gl/)
- [Three.js](https://threejs.org/)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

## Gerelateerd op IOM

Bekijk meer in [Software](/#software), plus [Streets GL Bridge](/blog/streets-gl-bridge), [Volumetrische belichting](/blog/volume-lighting), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$3D Viewer v3.19.2 — Streets GL-textures & betrouwbaarheid — IOM$iom$,
  $iom$3D Viewer v3.19.2 voor Windows (Setup + Portable): Streets GL vertex-budget/simplify-fixes, UV-behoudende 4k-textures, Product-mode textuurherstel en uniforme FloatingPanelHeader-paneelheaders. Browserreview voor GLTF/FBX/OBJ/IFC met HDR en Streets GL.$iom$
from public.blog_posts p
where p.slug = $iom$3d-viewer$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$3D Viewer — modelli prodotto nel browser$iom$,
  $iom$Release desktop v3.19.2: affidabilità e qualità texture Streets GL, ripristino texture Product-mode dopo teardown City, header pannello unificati — più revisione GLTF/FBX/OBJ/IFC con proiezione suolo HDR e Streets GL.$iom$,
  $iom$![Walkthrough prodotto — orbit, illuminazione HDR e chrome del viewer](/assets/blog/3d-viewer/walkthrough.webm?v=20260722a)

I clienti non dovrebbero aver bisogno di una postazione CAD per revisionare un modello. Il nostro 3D Viewer mette GLTF, FBX, OBJ e IFC in una finestra browser (e desktop) condivisibile — orbit, ispezione materiali, illuminazione 360° HDR e proiezione suolo, oppure inserimento del mesh nel contesto città OSM / Streets GL quando la location racconta la storia.

Si trova nella nostra [sezione Software](/#software) come **3D Viewer**. Un breve walkthrough apre l'articolo; gli still sotto mostrano proiezione suolo HDR 360° e contesto città OSM 3D / Streets GL nello stesso viewer.

## Apri la demo live

**[→ Avvia 3D Viewer](https://3dbviewer.com/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Condividi un link, non uno ZIP** — gli stakeholder aprono il modello su un laptop durante una call
- **Un viewer per molti formati** — meno email con «quale app apre questo?»
- **360° HDR + proiezione suolo** — illuminazione reale e ombre di contatto per ancorare il prodotto alla plate
- **OSM 3D / Streets GL nel viewer** — combinare contesto città con i propri modelli quando la strada vende il pitch

Usi tipici: configuratori prodotto, posizionamenti architettura ed esterno, tablet fiere, approvazioni client asincrone e presentazioni web standalone esportate dalla stessa pipeline.

## Per principianti — cos’è, in parole semplici?

Un viewer 3D è come una foto del prodotto che puoi ruotare. Invece di immagini piatte, il modello reale è nella pagina — trascina per girare, zoom sui dettagli, avvolgilo in luce HDR o posizionalo su una vera città OpenStreetMap quando serve «dove si colloca?». Nessuna installazione per la build web; una build desktop Windows copre offline o asset pesanti.

**Glossario rapido**

- **GLTF / GLB** — formati 3D web comuni ([Khronos glTF](https://www.khronos.org/gltf/))
- **Orbit** — trascinare per ruotare la camera intorno al modello
- **Ambiente HDR 360°** — wrap ad alta gamma dinamica che illumina il modello da cielo/scena reale
- **Proiezione suolo** — proiezione dell'HDR sul piano del pavimento per ombre e riflessi coerenti
- **OSM 3D / Streets GL** — contesto città 3D derivato da OpenStreetMap combinabile con i tuoi modelli nel viewer ([streets.gl](https://streets.gl/))
- **Hotspot** — marcatore cliccabile sul modello con info o link

## Provalo in circa 60 secondi

1. Apri il [sito 3D Viewer](https://3dbviewer.com/) o scarica Setup / Portable Windows dalla [release v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)
2. Carica un sample o il tuo GLTF/GLB se la build consente l'import
3. Prova un ambiente HDR 360° con proiezione suolo — osserva le ombre di contatto ancorare il prodotto alla plate
4. Apri OSM 3D / Streets GL e immagina (o posiziona) il modello nel tessuto urbano reale

## Requisiti e prestazioni

- **Browser:** Chrome, Edge o Firefox moderni per la build web
- **Desktop Windows:** Setup o Portable da [GitHub Releases v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2) (Electron 41)
- **File:** preferire GLB/GLTF per web; CAD pesante può richiedere conversione
- **GPU:** path tracing e layer città densi vogliono una GPU decente — modalità leggere su dispositivi modesti

## Cosa vedi

Due capacità che vendono il modello oltre il vuoto grigio — illuminazione HDR cinematografica, poi tessuto urbano reale:

![HDR 360° con proiezione suolo — prodotto illuminato dalla plate, ombre leggibili sull'asfalto](/assets/blog/3d-viewer/view-a.jpg?v=20260722a)

![OSM 3D / Streets GL nel viewer — contesto città combinabile con i tuoi modelli](/assets/blog/3d-viewer/view-b.jpg?v=20260722a)

Anche in questa build:

- Cambiare ambienti HDR e ora del giorno per mood diversi
- Usare path tracing per still quando la qualità batte la velocità realtime
- Mescolare modalità Product / City / Hybrid per revisioni esterno o urbano
- Esportare una presentazione web standalone per consegna client

## Come funziona

Il viewer è costruito sulla famiglia [Three.js](https://threejs.org/) con focus su revisione pratica: caricare mesh, inquadrarle, illuminarle con HDR + proiezione suolo e — quando il brief chiede una strada — aprire contesto città OSM 3D / Streets GL nello stesso chrome. Le build desktop estendono la stessa idea offline o con asset grandi. Il supporto formati segue pipeline client reali — l'obiettivo è sempre «apri, capisci, decidi.» Prodotto live: [3dbviewer.com](https://3dbviewer.com/).

## Novità in v3.19.2

Affidabilità bridge Streets GL e qualità texture, più rifinitura Product-mode:

- **Sync Streets GL** — simplify vertex-budget che preserva UV così auto e mesh grandi atterrano in modo affidabile nel contesto città
- **Texture migliori in City** — trasferimento texture binario fino a 4k con adattamento payload automatico per mappe Meshy grandi
- **Restore Product-mode** — le texture non scompaiono più dopo teardown Streets GL / City
- **Header pannello unificati** — chrome FloatingPanelHeader condiviso sui pannelli editor

**Download (Windows x64):** [Setup](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Setup-3.19.2-x64.exe) | [Portable](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Portable-3.19.2-x64.exe) | [Release notes](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)

## FAQ

**I clienti hanno bisogno di software CAD?**  
No per la revisione — un link browser basta alla maggior parte degli stakeholder.

**Possiamo mostrare il modello su una strada reale?**  
Sì — OSM 3D / Streets GL gira nel viewer così puoi combinare contesto città con il tuo GLB/GLTF.

**Dove scarico la build desktop Windows?**  
Installer Setup e Portable sono sulla [release GitHub v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2), anche linkata da [3dbviewer.com](https://3dbviewer.com/).

**Possiamo brandizzarlo?**  
Sì. Chrome viewer, ambienti e contenuto hotspot possono seguire il tuo brand.

## Stack tecnico e letture

- [3D Viewer live](https://3dbviewer.com/)
- [Download Windows v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)
- [Panoramica glTF — Khronos](https://www.khronos.org/gltf/)
- [Mappa live Streets GL](https://streets.gl/)
- [Three.js](https://threejs.org/)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

## Correlati su IOM

Esplora di più in [Software](/#software), più [Streets GL Bridge](/blog/streets-gl-bridge), [Illuminazione volumetrica](/blog/volume-lighting), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$3D Viewer v3.19.2 — texture e affidabilità Streets GL — IOM$iom$,
  $iom$3D Viewer v3.19.2 per Windows (Setup + Portable): fix vertex-budget/simplify Streets GL, texture 4k con UV preservati, ripristino texture Product-mode e header FloatingPanelHeader unificati. Revisione browser per GLTF/FBX/OBJ/IFC con HDR e Streets GL.$iom$
from public.blog_posts p
where p.slug = $iom$3d-viewer$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$3D Viewer — modelos de producto en el navegador$iom$,
  $iom$Lanzamiento desktop v3.19.2: fiabilidad y calidad de textura Streets GL, restauración de textura en modo Product tras teardown City, cabeceras de panel unificadas — más revisión GLTF/FBX/OBJ/IFC con proyección de suelo HDR y Streets GL.$iom$,
  $iom$![Recorrido del producto — órbita, iluminación HDR y chrome del visor](/assets/blog/3d-viewer/walkthrough.webm?v=20260722a)

Los clientes no deberían necesitar un puesto CAD para revisar un modelo. Nuestro 3D Viewer coloca GLTF, FBX, OBJ e IFC en una ventana de navegador (y escritorio) compartible — órbita, inspección de materiales, iluminación 360° HDR y proyección de suelo, o colocar el mesh en contexto urbano OSM / Streets GL cuando la ubicación cuenta la historia.

Está en nuestra [sección Software](/#software) como **3D Viewer**. Un breve recorrido abre el artículo; los stills siguientes muestran proyección de suelo HDR 360° y contexto urbano OSM 3D / Streets GL dentro del mismo visor.

## Abrir la demo en vivo

**[→ Lanzar 3D Viewer](https://3dbviewer.com/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Comparte un enlace, no un ZIP** — los stakeholders abren el modelo en un portátil durante una llamada
- **Un visor para muchos formatos** — menos correos de «¿qué app abre esto?»
- **360° HDR + proyección de suelo** — iluminación real y sombras de contacto para anclar el producto a la plate
- **OSM 3D / Streets GL dentro del visor** — combinar contexto urbano con tus modelos cuando la calle vende el pitch

Usos típicos: configuradores de producto, colocaciones de arquitectura y exteriores, tablets de feria, aprobaciones de cliente asíncronas y presentaciones web independientes exportadas desde la misma pipeline.

## Para principiantes — ¿qué es esto, en palabras simples?

Un visor 3D es como una foto de tu producto que puedes girar. En lugar de imágenes planas, el modelo real está en la página — arrastra para girar, zoom en detalles, envuélvelo en luz HDR o colócalo en una ciudad OpenStreetMap real cuando necesites «¿dónde encaja?». Sin instalación para la build web; una build desktop Windows cubre offline o assets pesados.

**Glosario rápido**

- **GLTF / GLB** — formatos 3D web habituales ([Khronos glTF](https://www.khronos.org/gltf/))
- **Orbit** — arrastrar para rotar la cámara alrededor del modelo
- **Entorno HDR 360°** — envoltura de alto rango dinámico que ilumina el modelo desde cielo/escena real
- **Proyección de suelo** — proyectar el HDR sobre el plano del suelo para sombras y reflejos coherentes
- **OSM 3D / Streets GL** — contexto urbano 3D derivado de OpenStreetMap combinable con tus modelos en el visor ([streets.gl](https://streets.gl/))
- **Hotspot** — marcador clicable en el modelo con info o enlace

## Pruébalo en unos 60 segundos

1. Abre el [sitio 3D Viewer](https://3dbviewer.com/) o descarga Setup / Portable Windows desde la [release v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)
2. Carga una muestra o tu propio GLTF/GLB si la build permite importación
3. Prueba un entorno HDR 360° con proyección de suelo — observa cómo las sombras de contacto anclan el producto a la plate
4. Abre OSM 3D / Streets GL e imagina (o coloca) tu modelo en tejido urbano real

## Requisitos y rendimiento

- **Navegador:** Chrome, Edge o Firefox modernos para la build web
- **Desktop Windows:** Setup o Portable desde [GitHub Releases v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2) (Electron 41)
- **Archivos:** preferir GLB/GLTF para web; CAD pesado puede requerir conversión previa
- **GPU:** path tracing y capas urbanas densas quieren una GPU decente — modos ligeros en dispositivos modestos

## Lo que ves

Dos capacidades que venden el modelo más allá del vacío gris — iluminación HDR cinematográfica, luego tejido urbano real:

![HDR 360° con proyección de suelo — producto iluminado por la plate, sombras legibles en asfalto](/assets/blog/3d-viewer/view-a.jpg?v=20260722a)

![OSM 3D / Streets GL dentro del visor — contexto urbano combinable con tus modelos](/assets/blog/3d-viewer/view-b.jpg?v=20260722a)

También en este build:

- Cambiar entornos HDR y hora del día para distintos ambientes
- Usar path tracing para stills cuando la calidad supera la velocidad en tiempo real
- Mezclar modos Product / City / Hybrid al revisar colocaciones exteriores o urbanas
- Exportar una presentación web independiente para entrega al cliente

## Cómo funciona

El visor está construido sobre la familia [Three.js](https://threejs.org/) con foco en revisión práctica: cargar meshes, encuadrarlas, iluminarlas con HDR + proyección de suelo y — cuando el brief necesita una calle — abrir contexto urbano OSM 3D / Streets GL en el mismo chrome. Las builds desktop extienden la misma idea offline o con assets grandes. El soporte de formatos sigue pipelines reales de clientes — el objetivo es siempre «abrir, entender, decidir.» Producto live: [3dbviewer.com](https://3dbviewer.com/).

## Novedades en v3.19.2

Fiabilidad del bridge Streets GL y calidad de textura, más pulido del modo Product:

- **Sync Streets GL** — simplify vertex-budget que preserva UV para que coches y meshes grandes aterricen con fiabilidad en contexto urbano
- **Mejores texturas en City** — transferencia binaria de textura hasta 4k con ajuste automático de payload para mapas Meshy grandes
- **Restore modo Product** — las texturas ya no desaparecen tras teardown Streets GL / City
- **Cabeceras de panel unificadas** — chrome FloatingPanelHeader compartido en paneles del editor

**Descarga (Windows x64):** [Setup](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Setup-3.19.2-x64.exe) | [Portable](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Portable-3.19.2-x64.exe) | [Notas de release](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)

## FAQ

**¿Los clientes necesitan software CAD?**  
No para revisión — un enlace de navegador basta a la mayoría de stakeholders.

**¿Podemos mostrar el modelo en una calle real?**  
Sí — OSM 3D / Streets GL corre dentro del visor para combinar contexto urbano con tu GLB/GLTF.

**¿Dónde obtengo la build desktop Windows?**  
Instaladores Setup y Portable están en la [release GitHub v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2), también enlazada desde [3dbviewer.com](https://3dbviewer.com/).

**¿Podemos brandearlo?**  
Sí. Chrome del visor, entornos y contenido hotspot pueden seguir tu marca.

## Stack técnico y lecturas

- [3D Viewer live](https://3dbviewer.com/)
- [Descargas Windows v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)
- [Resumen glTF — Khronos](https://www.khronos.org/gltf/)
- [Mapa live Streets GL](https://streets.gl/)
- [Three.js](https://threejs.org/)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

## Relacionado en IOM

Explora más en [Software](/#software), más [Streets GL Bridge](/blog/streets-gl-bridge), [Iluminación volumétrica](/blog/volume-lighting), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$3D Viewer v3.19.2 — texturas y fiabilidad Streets GL — IOM$iom$,
  $iom$3D Viewer v3.19.2 para Windows (Setup + Portable): correcciones vertex-budget/simplify Streets GL, texturas 4k preservando UV, restauración de textura modo Product y cabeceras FloatingPanelHeader unificadas. Revisión en navegador para GLTF/FBX/OBJ/IFC con HDR y Streets GL.$iom$
from public.blog_posts p
where p.slug = $iom$3d-viewer$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$Streets GL Bridge — OSM city context for 3D models$iom$,
  $iom$A beautiful model still needs a place to stand. Streets GL Bridge explores OpenStreetMap 3D city context as a ground layer — so geolocated assets can sit in a recognizable streetsc$iom$,
  $iom$A beautiful model still needs a place to stand. Streets GL Bridge explores OpenStreetMap 3D city context as a ground layer — so geolocated assets can sit in a recognizable streetscape instead of an empty void.

It lives in our [Software section](/#software) as **Streets GL Bridge**. The cover shows the map/bridge framing used on the portfolio card.

## Open the live demo

**[→ Launch Streets GL Bridge](/demos/streets-gl/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Location sells the story** — clients recognize the block, not just the mesh
- **Open map data** — OSM as a living city layer under your asset
- **Bridge mindset** — connect your model pipeline to a navigable ground
- **Open-source DNA** — built around the Streets GL ecosystem

Typical uses: urban proposals, site-context slides, geolocated product or architecture previews, and “where does this sit on the street?” conversations before a full GIS build.

## For beginners — what is this, in plain words?

Think of Google Earth vibes, but aimed at putting your 3D object into a real street grid. The map is the stage; the model is the actor. You orbit and explore instead of staring at a grey infinite floor.

**Quick glossary**

- **OSM** — OpenStreetMap — community-built map data ([openstreetmap.org](https://www.openstreetmap.org/))
- **Ground layer** — the city, roads, and terrain under your model
- **Geolocated** — placed at a real latitude/longitude on Earth
- **WebGL** — the browser GPU API that draws the 3D map ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API))

## Try this in about 60 seconds

1. Open the [Streets GL Bridge demo](/demos/streets-gl/)
2. Wait for the map embed to settle
3. Pan and zoom the city context (or compare with the [live Streets GL map](https://streets.gl/))
4. Imagine dropping a client building or kiosk on a known corner

## Requirements and performance

- **Network:** map tiles and the embed need a connection
- **Browser:** modern Chromium recommended for WebGL map views
- **Performance:** dense cities are heavier — zoom in for smoother exploration

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![City fabric — streets and massing as context](/assets/blog/streets-gl-bridge/view-a.jpg?v=20260722a)

![Closer urban reading — where a model would sit](/assets/blog/streets-gl-bridge/view-b.jpg?v=20260722a)

Also in this build:

- Use as a reference layer while placing geolocated GLBs
- Point stakeholders at the live [streets.gl](https://streets.gl/) map
- Pair with Simple 3D Buildings concepts from OSM

## How it works

Streets GL renders OSM-derived 3D city structure in the browser. Our bridge page hosts that context for IOM workflows — a practical “where does this sit?” layer rather than a full GIS suite. Upstream project: [StrandedKitty/streets-gl](https://github.com/StrandedKitty/streets-gl); live map at [streets.gl](https://streets.gl/).

## FAQ

**Is this Google Maps?**  
No — it builds on OpenStreetMap and the open Streets GL tooling.

**Can we drop our building in?**  
That is the intent of the bridge: geolocated models over city context. Ask us for a scoped integration.

## Tech stack and further reading

- [Streets GL live map](https://streets.gl/)
- [streets-gl on GitHub](https://github.com/StrandedKitty/streets-gl)
- [OSM Simple 3D Buildings](https://wiki.openstreetmap.org/wiki/Simple_3D_Buildings)
- [WebGL — Wikipedia](https://en.wikipedia.org/wiki/WebGL)

## Related on IOM

Browse more in [Software](/#software), plus [Artist Globe](/blog/artist-globe), [3D Viewer](/blog/3d-viewer), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$Streets GL Bridge — OSM city context for 3D models — IOM$iom$,
  $iom$A beautiful model still needs a place to stand. Streets GL Bridge explores OpenStreetMap 3D city context as a ground layer — so geolocated assets can sit in a recognizable streetsc$iom$
from public.blog_posts p
where p.slug = $iom$streets-gl-bridge$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$Streets GL Bridge — OSM-Stadtkontext für 3D-Modelle$iom$,
  $iom$Ein schönes Modell braucht trotzdem einen Ort zum Stehen. Streets GL Bridge erkundet OpenStreetMap-3D-Stadtkontext als Bodenschicht — damit geolokalisierte Assets in einer erkennba$iom$,
  $iom$Ein schönes Modell braucht trotzdem einen Ort zum Stehen. Streets GL Bridge erkundet OpenStreetMap-3D-Stadtkontext als Bodenschicht — damit geolokalisierte Assets in einer erkennbaren Straßenkulisse statt in einer leeren Leere sitzen.

Es liegt in unserem [Software-Bereich](/#software) als **Streets GL Bridge**. Das Cover zeigt die Karten-/Bridge-Framing der Portfolio-Karte.

## Live-Demo öffnen

**[→ Streets GL Bridge starten](/demos/streets-gl/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Ort erzählt die Geschichte** — Kunden erkennen den Block, nicht nur das Mesh
- **Offene Kartendaten** — OSM als lebende Stadtschicht unter Ihrem Asset
- **Bridge-Mindset** — Ihre Modellpipeline mit navigierbarem Boden verbinden
- **Open-Source-DNA** — gebaut um das Streets GL-Ökosystem

Typische Einsätze: Städtische Vorschläge, Site-Context-Slides, geolokalisierte Produkt- oder Architekturvorschauen und Gespräche über „Wo sitzt das auf der Straße?“ vor einem vollen GIS-Build.

## Für Einsteiger — was ist das, in einfachen Worten?

Denken Sie an Google-Earth-Vibes, aber darauf ausgelegt, Ihr 3D-Objekt in ein echtes Straßenraster zu setzen. Die Karte ist die Bühne; das Modell der Darsteller. Sie orbitieren und erkunden statt auf einen grauen unendlichen Boden zu starren.

**Kurzes Glossar**

- **OSM** — OpenStreetMap — community-basierte Kartendaten ([openstreetmap.org](https://www.openstreetmap.org/))
- **Bodenschicht** — Stadt, Straßen und Gelände unter Ihrem Modell
- **Geolokalisiert** — an echter Breite/Länge auf der Erde platziert
- **WebGL** — die Browser-GPU-API, die die 3D-Karte zeichnet ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API))

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [Streets GL Bridge Demo](/demos/streets-gl/)
2. Warten Sie, bis das Karten-Embed sich setzt
3. Schwenken und zoomen Sie den Stadtkontext (oder vergleichen Sie mit der [live Streets GL Karte](https://streets.gl/))
4. Stellen Sie sich vor, ein Kundengebäude oder Kiosk auf eine bekannte Ecke zu setzen

## Anforderungen und Performance

- **Netzwerk:** Kacheln und Embed brauchen Verbindung
- **Browser:** moderner Chromium empfohlen für WebGL-Kartenansichten
- **Performance:** dichte Städte sind schwerer — reinzoomen für flüssigere Erkundung

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Stadtbild — Straßen und Massierung als Kontext](/assets/blog/streets-gl-bridge/view-a.jpg?v=20260722a)

![Nähere städtische Lesart — wo ein Modell sitzen würde](/assets/blog/streets-gl-bridge/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Als Referenzschicht beim Platzieren geolokalisierter GLBs nutzen
- Stakeholder auf die live [streets.gl](https://streets.gl/) Karte verweisen
- Mit Simple 3D Buildings-Konzepten von OSM paaren

## So funktioniert es

Streets GL rendert OSM-basierte 3D-Stadtstruktur im Browser. Unsere Bridge-Seite hostet diesen Kontext für IOM-Workflows — eine praktische „Wo sitzt das?“-Schicht statt einer vollen GIS-Suite. Upstream-Projekt: [StrandedKitty/streets-gl](https://github.com/StrandedKitty/streets-gl); Live-Karte unter [streets.gl](https://streets.gl/).

## FAQ

**Ist das Google Maps?**  
Nein — es baut auf OpenStreetMap und den offenen Streets GL-Tools auf.

**Können wir unser Gebäude einsetzen?**  
Das ist die Absicht der Bridge: geolokalisierte Modelle über Stadtkontext. Fragen Sie uns nach einer scoped Integration.

## Tech-Stack und weiterführende Links

- [Streets GL Live-Karte](https://streets.gl/)
- [streets-gl auf GitHub](https://github.com/StrandedKitty/streets-gl)
- [OSM Simple 3D Buildings](https://wiki.openstreetmap.org/wiki/Simple_3D_Buildings)
- [WebGL — Wikipedia](https://en.wikipedia.org/wiki/WebGL)

## Verwandt bei IOM

Mehr in [Software](/#software), plus [Artist Globe](/blog/artist-globe), [3D Viewer](/blog/3d-viewer), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$Streets GL Bridge — OSM-Stadtkontext für 3D-Modelle — IOM$iom$,
  $iom$Ein schönes Modell braucht trotzdem einen Ort zum Stehen. Streets GL Bridge erkundet OpenStreetMap-3D-Stadtkontext als Bodenschicht — damit geolokalisierte Assets in einer erkennba$iom$
from public.blog_posts p
where p.slug = $iom$streets-gl-bridge$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$Streets GL Bridge — contexte ville OSM pour modèles 3D$iom$,
  $iom$Un beau modèle a quand même besoin d’un sol. Streets GL Bridge explore le contexte ville 3D OpenStreetMap comme couche de sol — pour que les assets géolocalisés se tiennent dans un$iom$,
  $iom$Un beau modèle a quand même besoin d’un sol. Streets GL Bridge explore le contexte ville 3D OpenStreetMap comme couche de sol — pour que les assets géolocalisés se tiennent dans une rue reconnaissable plutôt qu’un vide.

Il se trouve dans notre [section Logiciel](/#software) sous **Streets GL Bridge**. La couverture montre le cadrage carte/bridge de la carte portfolio.

## Ouvrir la démo en direct

**[→ Lancer Streets GL Bridge](/demos/streets-gl/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Le lieu vend l’histoire** — les clients reconnaissent le pâté de maisons, pas seulement le mesh
- **Données carto ouvertes** — OSM comme couche ville vivante sous votre asset
- **Esprit bridge** — relier votre pipeline modèle à un sol navigable
- **ADN open source** — construit autour de l’écosystème Streets GL

Usages typiques : propositions urbaines, slides contexte site, previews produit ou architecture géolocalisées, et conversations « où ça se situe dans la rue ? » avant un build GIS complet.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Pensez aux vibes Google Earth, mais pour mettre votre objet 3D dans une vraie grille de rues. La carte est la scène ; le modèle l’acteur. Vous orbitez et explorez au lieu de fixer un sol gris infini.

**Glossaire rapide**

- **OSM** — OpenStreetMap — données cartographiques communautaires ([openstreetmap.org](https://www.openstreetmap.org/))
- **Couche sol** — ville, routes et terrain sous votre modèle
- **Géolocalisé** — placé à une latitude/longitude réelle sur Terre
- **WebGL** — API GPU navigateur qui dessine la carte 3D ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API))

## Essayez en environ 60 secondes

1. Ouvrir la [démo Streets GL Bridge](/demos/streets-gl/)
2. Attendre que l’embed carte se stabilise
3. Pan/zoom le contexte ville (ou comparer avec la [carte live Streets GL](https://streets.gl/))
4. Imaginer déposer un bâtiment client ou un kiosque sur un coin connu

## Prérequis et performances

- **Réseau :** tuiles et embed nécessitent une connexion
- **Navigateur :** Chromium moderne recommandé pour vues carte WebGL
- **Performance :** villes denses plus lourdes — zoomer pour exploration plus fluide

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Tissu urbain — rues et volumétrie comme contexte](/assets/blog/streets-gl-bridge/view-a.jpg?v=20260722a)

![Lecture urbaine rapprochée — où un modèle se placerait](/assets/blog/streets-gl-bridge/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Utiliser comme couche référence en plaçant des GLB géolocalisés
- Diriger les parties prenantes vers la carte live [streets.gl](https://streets.gl/)
- Associer aux concepts Simple 3D Buildings d’OSM

## Comment ça marche

Streets GL rend la structure ville 3D dérivée d’OSM dans le navigateur. Notre page bridge héberge ce contexte pour les workflows IOM — une couche pratique « où ça se situe ? » plutôt qu’une suite GIS complète. Projet upstream : [StrandedKitty/streets-gl](https://github.com/StrandedKitty/streets-gl) ; carte live sur [streets.gl](https://streets.gl/).

## FAQ

**Est-ce Google Maps ?**  
Non — cela s’appuie sur OpenStreetMap et les outils ouverts Streets GL.

**Peut-on déposer notre bâtiment ?**  
C’est l’intention du bridge : modèles géolocalisés sur contexte ville. Demandez-nous une intégration cadrée.

## Stack technique et lectures

- [Carte live Streets GL](https://streets.gl/)
- [streets-gl sur GitHub](https://github.com/StrandedKitty/streets-gl)
- [OSM Simple 3D Buildings](https://wiki.openstreetmap.org/wiki/Simple_3D_Buildings)
- [WebGL — Wikipedia](https://en.wikipedia.org/wiki/WebGL)

## Sur IOM

Parcourez [Logiciel](/#software), plus [Artist Globe](/blog/artist-globe), [3D Viewer](/blog/3d-viewer), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$Streets GL Bridge — contexte ville OSM pour modèles 3D — IOM$iom$,
  $iom$Un beau modèle a quand même besoin d’un sol. Streets GL Bridge explore le contexte ville 3D OpenStreetMap comme couche de sol — pour que les assets géolocalisés se tiennent dans un$iom$
from public.blog_posts p
where p.slug = $iom$streets-gl-bridge$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$Streets GL Bridge — OSM-stadscontext voor 3D-modellen$iom$,
  $iom$Een mooi model heeft nog steeds een plek nodig om te staan. Streets GL Bridge verkent OpenStreetMap 3D-stadscontext als grondlaag — zodat geolokaliseerde assets in een herkenbaar s$iom$,
  $iom$Een mooi model heeft nog steeds een plek nodig om te staan. Streets GL Bridge verkent OpenStreetMap 3D-stadscontext als grondlaag — zodat geolokaliseerde assets in een herkenbaar straatbeeld staan in plaats van een lege leegte.

Het staat in onze [Software-sectie](/#software) als **Streets GL Bridge**. De cover toont de kaart-/bridge-framing van de portfoliokaart.

## Open de live demo

**[→ Start Streets GL Bridge](/demos/streets-gl/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Locatie verkoopt het verhaal** — klanten herkennen het blok, niet alleen het mesh
- **Open kaartdata** — OSM als levende stadslaag onder uw asset
- **Bridge-mindset** — verbind uw modelpipeline met een navigeerbare grond
- **Open-source-DNA** — gebouwd rond het Streets GL-ecosysteem

Typische toepassingen: stedelijke voorstellen, site-contextslides, geolokaliseerde product- of architectuurpreviews, en gesprekken over „waar staat dit op straat?” vóór een volledige GIS-build.

## Voor beginners — wat is dit, in gewone taal?

Denk aan Google Earth-vibes, maar gericht op het plaatsen van uw 3D-object in een echt stratenraster. De kaart is het podium; het model de acteur. U orbit en verkent in plaats van naar een grijze oneindige vloer te staren.

**Korte glossary**

- **OSM** — OpenStreetMap — community-gebouwde kaartdata ([openstreetmap.org](https://www.openstreetmap.org/))
- **Grondlaag** — de stad, wegen en terrein onder uw model
- **Geolokaliseerd** — geplaatst op echte breedte-/lengtegraad op aarde
- **WebGL** — de browser-GPU-API die de 3D-kaart tekent ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API))

## Probeer dit in ongeveer 60 seconden

1. Open de [Streets GL Bridge-demo](/demos/streets-gl/)
2. Wacht tot de kaart-embed stabiel is
3. Pan en zoom de stadscontext (of vergelijk met de [live Streets GL-kaart](https://streets.gl/))
4. Stel u voor een klantgebouw of kiosk op een bekende hoek te plaatsen

## Vereisten en performance

- **Netwerk:** kaarttegels en embed vereisen een verbinding
- **Browser:** moderne Chromium aanbevolen voor WebGL-kaartweergaven
- **Performance:** dichte steden zijn zwaarder — zoom in voor vloeiender verkenning

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Stadsbeeld — straten en massa als context](/assets/blog/streets-gl-bridge/view-a.jpg?v=20260722a)

![Nauwere stedelijke lezing — waar een model zou staan](/assets/blog/streets-gl-bridge/view-b.jpg?v=20260722a)

Ook in deze build:

- Gebruiken als referentielaag bij het plaatsen van geolokaliseerde GLB's
- Stakeholders verwijzen naar de live [streets.gl](https://streets.gl/)-kaart
- Koppelen aan Simple 3D Buildings-concepten van OSM

## Hoe het werkt

Streets GL rendert OSM-afgeleide 3D-stadsstructuur in de browser. Onze bridge-pagina host die context voor IOM-workflows — een praktische „waar staat dit?”-laag in plaats van een volledige GIS-suite. Upstream-project: [StrandedKitty/streets-gl](https://github.com/StrandedKitty/streets-gl); live-kaart op [streets.gl](https://streets.gl/).

## FAQ

**Is dit Google Maps?**  
Nee — het bouwt voort op OpenStreetMap en de open Streets GL-tooling.

**Kunnen we ons gebouw plaatsen?**  
Dat is de bedoeling van de bridge: geolokaliseerde modellen boven stadscontext. Vraag ons om een scoped integratie.

## Tech stack en verder lezen

- [Streets GL live-kaart](https://streets.gl/)
- [streets-gl op GitHub](https://github.com/StrandedKitty/streets-gl)
- [OSM Simple 3D Buildings](https://wiki.openstreetmap.org/wiki/Simple_3D_Buildings)
- [WebGL — Wikipedia](https://en.wikipedia.org/wiki/WebGL)

## Gerelateerd op IOM

Bekijk meer in [Software](/#software), plus [Artist Globe](/blog/artist-globe), [3D Viewer](/blog/3d-viewer), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$Streets GL Bridge — OSM-stadscontext voor 3D-modellen — IOM$iom$,
  $iom$Een mooi model heeft nog steeds een plek nodig om te staan. Streets GL Bridge verkent OpenStreetMap 3D-stadscontext als grondlaag — zodat geolokaliseerde assets in een herkenbaar s$iom$
from public.blog_posts p
where p.slug = $iom$streets-gl-bridge$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$Streets GL Bridge — contesto città OSM per modelli 3D$iom$,
  $iom$Un bel modello ha comunque bisogno di un posto dove stare. Streets GL Bridge esplora il contesto città 3D OpenStreetMap come strato di suolo — così asset geolocalizzati stanno in u$iom$,
  $iom$Un bel modello ha comunque bisogno di un posto dove stare. Streets GL Bridge esplora il contesto città 3D OpenStreetMap come strato di suolo — così asset geolocalizzati stanno in uno skyline riconoscibile invece che nel vuoto.

Si trova nella nostra [sezione Software](/#software) come **Streets GL Bridge**. La cover mostra il framing mappa/bridge usato sulla card portfolio.

## Apri la demo live

**[→ Avvia Streets GL Bridge](/demos/streets-gl/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **La location vende la storia** — i clienti riconoscono l'isolato, non solo il mesh
- **Dati mappa aperti** — OSM come layer città vivo sotto il tuo asset
- **Mentalità bridge** — collegare la pipeline modelli a un suolo navigabile
- **DNA open source** — costruito attorno all'ecosistema Streets GL

Usi tipici: proposte urbane, slide contesto sito, anteprime prodotto o architettura geolocalizzate e conversazioni «dove si colloca in strada?» prima di un build GIS completo.

## Per principianti — cos’è, in parole semplici?

Pensa alle vibes di Google Earth, ma per mettere il tuo oggetto 3D in una vera griglia stradale. La mappa è il palco; il modello l'attore. Orbiti ed esplori invece di fissare un pavimento grigio infinito.

**Glossario rapido**

- **OSM** — OpenStreetMap — dati mappa costruiti dalla community ([openstreetmap.org](https://www.openstreetmap.org/))
- **Strato suolo** — città, strade e terreno sotto il modello
- **Geolocalizzato** — posizionato a latitudine/longitudine reali sulla Terra
- **WebGL** — API GPU browser che disegna la mappa 3D ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API))

## Provalo in circa 60 secondi

1. Apri la [demo Streets GL Bridge](/demos/streets-gl/)
2. Attendi che l'embed mappa si stabilizzi
3. Pan e zoom sul contesto città (o confronta con la [mappa live Streets GL](https://streets.gl/))
4. Immagina di posizionare un edificio client o un chiosco su un angolo noto

## Requisiti e prestazioni

- **Rete:** tile mappa e embed richiedono connessione
- **Browser:** Chromium moderno consigliato per viste mappa WebGL
- **Performance:** città dense sono più pesanti — zoom per esplorazione più fluida

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Tessuto urbano — strade e volumetrie come contesto](/assets/blog/streets-gl-bridge/view-a.jpg?v=20260722a)

![Lettura urbana ravvicinata — dove starebbe un modello](/assets/blog/streets-gl-bridge/view-b.jpg?v=20260722a)

Anche in questa build:

- Usare come layer di riferimento posizionando GLB geolocalizzati
- Indirizzare stakeholder alla mappa live [streets.gl](https://streets.gl/)
- Abbinare ai concetti Simple 3D Buildings di OSM

## Come funziona

Streets GL renderizza struttura città 3D derivata da OSM nel browser. La nostra pagina bridge ospita quel contesto per workflow IOM — un layer pratico «dove si colloca?» invece di una suite GIS completa. Progetto upstream: [StrandedKitty/streets-gl](https://github.com/StrandedKitty/streets-gl); mappa live su [streets.gl](https://streets.gl/).

## FAQ

**È Google Maps?**  
No — si basa su OpenStreetMap e gli strumenti aperti Streets GL.

**Possiamo inserire il nostro edificio?**  
È l'intento del bridge: modelli geolocalizzati sopra contesto città. Chiedici un'integrazione scoped.

## Stack tecnico e letture

- [Mappa live Streets GL](https://streets.gl/)
- [streets-gl su GitHub](https://github.com/StrandedKitty/streets-gl)
- [OSM Simple 3D Buildings](https://wiki.openstreetmap.org/wiki/Simple_3D_Buildings)
- [WebGL — Wikipedia](https://en.wikipedia.org/wiki/WebGL)

## Correlati su IOM

Esplora di più in [Software](/#software), più [Artist Globe](/blog/artist-globe), [3D Viewer](/blog/3d-viewer), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$Streets GL Bridge — contesto città OSM per modelli 3D — IOM$iom$,
  $iom$Un bel modello ha comunque bisogno di un posto dove stare. Streets GL Bridge esplora il contesto città 3D OpenStreetMap come strato di suolo — così asset geolocalizzati stanno in u$iom$
from public.blog_posts p
where p.slug = $iom$streets-gl-bridge$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$Streets GL Bridge — contexto urbano OSM para modelos 3D$iom$,
  $iom$Un modelo bonito aún necesita un lugar donde apoyarse. Streets GL Bridge explora el contexto urbano 3D de OpenStreetMap como capa de suelo — para que assets geolocalizados queden e$iom$,
  $iom$Un modelo bonito aún necesita un lugar donde apoyarse. Streets GL Bridge explora el contexto urbano 3D de OpenStreetMap como capa de suelo — para que assets geolocalizados queden en un paisaje urbano reconocible en lugar de un vacío.

Está en nuestra [sección Software](/#software) como **Streets GL Bridge**. La portada muestra el encuadre mapa/bridge usado en la tarjeta del portfolio.

## Abrir la demo en vivo

**[→ Lanzar Streets GL Bridge](/demos/streets-gl/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **La ubicación vende la historia** — los clientes reconocen la manzana, no solo el mesh
- **Datos cartográficos abiertos** — OSM como capa urbana viva bajo tu asset
- **Mentalidad bridge** — conectar tu pipeline de modelos a un suelo navegable
- **ADN open source** — construido alrededor del ecosistema Streets GL

Usos típicos: propuestas urbanas, slides de contexto de sitio, previews de producto o arquitectura geolocalizadas y conversaciones de «¿dónde encaja en la calle?» antes de un build GIS completo.

## Para principiantes — ¿qué es esto, en palabras simples?

Piensa en vibes de Google Earth, pero orientado a colocar tu objeto 3D en una cuadrícula de calles real. El mapa es el escenario; el modelo el actor. Orbitas y exploras en lugar de mirar un suelo gris infinito.

**Glosario rápido**

- **OSM** — OpenStreetMap — datos cartográficos comunitarios ([openstreetmap.org](https://www.openstreetmap.org/))
- **Capa de suelo** — ciudad, carreteras y terreno bajo tu modelo
- **Geolocalizado** — colocado en latitud/longitud real en la Tierra
- **WebGL** — API GPU del navegador que dibuja el mapa 3D ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API))

## Pruébalo en unos 60 segundos

1. Abre la [demo Streets GL Bridge](/demos/streets-gl/)
2. Espera a que el embed del mapa se estabilice
3. Pan y zoom del contexto urbano (o compara con el [mapa live Streets GL](https://streets.gl/))
4. Imagina colocar un edificio de cliente o un quiosco en una esquina conocida

## Requisitos y rendimiento

- **Red:** tiles del mapa y el embed requieren conexión
- **Navegador:** Chromium moderno recomendado para vistas de mapa WebGL
- **Rendimiento:** ciudades densas son más pesadas — acerca zoom para exploración más fluida

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Tejido urbano — calles y volumetría como contexto](/assets/blog/streets-gl-bridge/view-a.jpg?v=20260722a)

![Lectura urbana más cercana — dónde quedaría un modelo](/assets/blog/streets-gl-bridge/view-b.jpg?v=20260722a)

También en este build:

- Usar como capa de referencia al colocar GLB geolocalizados
- Dirigir stakeholders al mapa live [streets.gl](https://streets.gl/)
- Emparejar con conceptos Simple 3D Buildings de OSM

## Cómo funciona

Streets GL renderiza estructura urbana 3D derivada de OSM en el navegador. Nuestra página bridge aloja ese contexto para workflows IOM — una capa práctica de «¿dónde encaja?» en lugar de una suite GIS completa. Proyecto upstream: [StrandedKitty/streets-gl](https://github.com/StrandedKitty/streets-gl); mapa live en [streets.gl](https://streets.gl/).

## FAQ

**¿Es Google Maps?**  
No — se basa en OpenStreetMap y las herramientas abiertas Streets GL.

**¿Podemos colocar nuestro edificio?**  
Esa es la intención del bridge: modelos geolocalizados sobre contexto urbano. Pídenos una integración acotada.

## Stack técnico y lecturas

- [Mapa live Streets GL](https://streets.gl/)
- [streets-gl en GitHub](https://github.com/StrandedKitty/streets-gl)
- [OSM Simple 3D Buildings](https://wiki.openstreetmap.org/wiki/Simple_3D_Buildings)
- [WebGL — Wikipedia](https://en.wikipedia.org/wiki/WebGL)

## Relacionado en IOM

Explora más en [Software](/#software), más [Artist Globe](/blog/artist-globe), [3D Viewer](/blog/3d-viewer), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$Streets GL Bridge — contexto urbano OSM para modelos 3D — IOM$iom$,
  $iom$Un modelo bonito aún necesita un lugar donde apoyarse. Streets GL Bridge explora el contexto urbano 3D de OpenStreetMap como capa de suelo — para que assets geolocalizados queden e$iom$
from public.blog_posts p
where p.slug = $iom$streets-gl-bridge$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$360° Panorama Tour Editor — build guided walks in the browser$iom$,
  $iom$Trade visitors remember experiences. This editor lets you load equirectangular panoramas, place hotspots, chain multi-scene tours, and save a `.360project` — all in the browser, op$iom$,
  $iom$Trade visitors remember experiences. This editor lets you load equirectangular panoramas, place hotspots, chain multi-scene tours, and save a `.360project` — all in the browser, opening on The Black Witness by default.

It lives in our [Software section](/#software) as **360° Panorama Tour Editor**. The cover is guided-tour step 1 on The Black Witness — raven hotspot + popup.

## Open the live demo

**[→ Launch 360° Panorama Tour Editor](/demos/panorama-360/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Editor + visitor in one stack** — build the tour, then share a preview link
- **Hotspots that explain** — info, scene links, and optional iframe popups
- **Multi-scene tours** — move guests from booth to product line to venue
- **Project files you keep** — save and reload `.360project` between sessions

Typical uses: trade-show companions, venue walkthroughs, product-line stories, museum soft launches, and client approvals before a full production tour build.

## For beginners — what is this, in plain words?

A 360° panorama is a photo that wraps all the way around you — like standing in the middle of a room. The editor is the tool that turns those photos into a tour: clickable markers (hotspots), links between rooms, and a path guests can follow without downloading an app.

**Quick glossary**

- **Equirectangular** — a common 360° image layout (full sphere flattened to a rectangle)
- **Hotspot** — a clickable marker — info, a scene jump, or a URL/iframe
- **Guided tour** — a scripted sequence of camera stops, popups, and optional effects
- **.360project** — IOM’s save file for panoramas, hotspots, and tour settings
- **WebGPU birds** — optional flock effect layered on the tour (GPU-backed)

## Try this in about 60 seconds

1. Open the [360° Panorama Tour Editor](/demos/panorama-360/) (or [visitor preview](/demos/panorama-360/?mode=preview))
2. Click **Play guided tour** and watch the four Black Witness steps
3. Stop the tour and click hotspots yourself — raven, fire, water, birds
4. In the editor, select each STEPS row to jump the camera and edit that beat

## Requirements and performance

- **Browser:** modern Chrome or Edge recommended; WebGPU features need a capable GPU
- **Images:** equirectangular JPG, PNG, WebP; HDR/EXR/KTX2 when the pipeline supports them
- **Mobile:** viewing works; editing is more comfortable on desktop

## What you see

The cover is guided-tour step 1; the stills below continue the same Black Witness walkthrough:

![Step 2 — animated fire hotspot and particle popup](/assets/blog/panorama-360-tour/view-a.jpg?v=20260722a)

![Step 3 — water / spout beat on the rooftop](/assets/blog/panorama-360-tour/view-b.jpg?v=20260722a)

![Step 4 — Animated birds popup with the flock against the storm sky](/assets/blog/panorama-360-tour/view-c.jpg?v=20260722a)

Also in this build:

- Chain multiple panoramas into a guided multi-scene tour
- Add URL or iframe popups on hotspots for product pages or embeds
- Layer [particles](/blog/webgpu-particles), [spout](/blog/spout), and [birds](/blog/webgpu-compute-birds) on guided steps 2–4

## How it works

Panoramas are mapped onto a sphere (or cube pipeline) so the camera sits at the center — the classic web 360 approach powered by [Three.js](https://threejs.org/) and modern browser APIs ([WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) / optional [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)). Hotspots are scene metadata: position, type, and target. Guided-tour steps on The Black Witness wire the same effect demos into interactive beats — Step 2 `+particles` ([WebGPU Particles](/blog/webgpu-particles)), Step 3 `+particles/spout` ([Spout](/blog/spout)), Step 4 `+birds` ([WebGPU Compute Birds](/blog/webgpu-compute-birds)) — each with `hotspot+popup` so motion and clickable story land together. Visitor preview is the same engine without editor chrome — see [The Black Witness tour](/blog/panorama-suite).

## FAQ

**Do guests need an app?**  
No. Share a browser link. Preview mode hides the editor so visitors only see the tour.

**Can we use our own panoramas?**  
Yes — load equirectangular stills into the editor and build hotspots around your venue or product.

**How do particles, spout, and birds connect to the tour?**  
They are optional effect layers on guided steps 2–4. Each step pairs a camera stop with an effect and a hotspot popup — explore the standalone demos, then Play guided tour in /demos/panorama-360/.

## Tech stack and further reading

- [Live tour editor](/demos/panorama-360/)
- [Three.js](https://threejs.org/)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Equirectangular projection — Wikipedia](https://en.wikipedia.org/wiki/Equirectangular_projection)

## Related on IOM

Browse more in [Software](/#software), plus [The Black Witness — 360° Tour](/blog/panorama-suite), [WebGPU Particles](/blog/webgpu-particles), [Spout](/blog/spout), [WebGPU Compute Birds](/blog/webgpu-compute-birds), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$360° Panorama Tour Editor — build guided walks in the browser — IOM$iom$,
  $iom$Trade visitors remember experiences. This editor lets you load equirectangular panoramas, place hotspots, chain multi-scene tours, and save a `.360project` — all in the browser, op$iom$
from public.blog_posts p
where p.slug = $iom$panorama-360-tour$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$360° Panorama Tour Editor — geführte Walks im Browser erstellen$iom$,
  $iom$Messebesucher erinnern sich an Erlebnisse. Dieser Editor lädt equirectangular Panoramen, platziert Hotspots, verknüpft Multi-Szenen-Touren und speichert eine `.360project` — alles $iom$,
  $iom$Messebesucher erinnern sich an Erlebnisse. Dieser Editor lädt equirectangular Panoramen, platziert Hotspots, verknüpft Multi-Szenen-Touren und speichert eine `.360project` — alles im Browser, standardmäßig mit The Black Witness.

Es liegt in unserem [Software-Bereich](/#software) als **360° Panorama Tour Editor**. Das Cover ist geführte Tour Schritt 1 auf The Black Witness — Rabe-Hotspot + Popup.

## Live-Demo öffnen

**[→ 360° Panorama Tour Editor starten](/demos/panorama-360/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Editor + Besucher in einem Stack** — Tour bauen, dann Preview-Link teilen
- **Hotspots, die erklären** — Info, Szenenlinks und optionale iframe-Popups
- **Multi-Szenen-Touren** — Gäste von Stand zu Produktlinie zu Venue führen
- **Projektdateien, die Sie behalten** — `.360project` zwischen Sessions speichern und neu laden

Typische Einsätze: Messe-Begleiter, Venue-Walkthroughs, Produktlinien-Geschichten, Museum-Soft-Launches und Kundenfreigaben vor einem vollen Produktionstour-Build.

## Für Einsteiger — was ist das, in einfachen Worten?

Ein 360°-Panorama ist ein Foto, das sich ganz um Sie legt — wie mitten in einem Raum stehen. Der Editor macht aus diesen Fotos eine Tour: klickbare Marker (Hotspots), Verbindungen zwischen Räumen und ein Pfad, den Gäste ohne App-Download folgen können.

**Kurzes Glossar**

- **Equirectangular** — gängiges 360°-Bildlayout (volle Kugel auf Rechteck abgeflacht)
- **Hotspot** — ein klickbarer Marker — Info, Szenensprung oder URL/iframe
- **Geführte Tour** — eine skriptierte Sequenz aus Kamerastops, Popups und optionalen Effekten
- **.360project** — IOMs Speicherdatei für Panoramen, Hotspots und Tour-Einstellungen
- **WebGPU birds** — optionaler Schwarm-Effekt auf der Tour (GPU-gestützt)

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie den [360° Panorama Tour Editor](/demos/panorama-360/) (oder [Besucher-Preview](/demos/panorama-360/?mode=preview))
2. Klicken Sie **Play guided tour** und sehen Sie die vier Black Witness Schritte
3. Stoppen Sie die Tour und klicken Sie Hotspots selbst — Rabe, Feuer, Wasser, Vögel
4. Im Editor wählen Sie jede STEPS-Zeile, um die Kamera zu springen und den Beat zu bearbeiten

## Anforderungen und Performance

- **Browser:** moderner Chrome oder Edge empfohlen; WebGPU-Features brauchen eine fähige GPU
- **Bilder:** equirectangular JPG, PNG, WebP; HDR/EXR/KTX2 wenn die Pipeline sie unterstützt
- **Mobil:** Ansehen funktioniert; Bearbeiten ist am Desktop angenehmer

## Was Sie sehen

Das Cover ist Guided-Tour-Schritt 1; die Stillbilder darunter setzen denselben Black-Witness-Rundgang fort:

![Schritt 2 — animierter Feuer-Hotspot und Partikel-Popup](/assets/blog/panorama-360-tour/view-a.jpg?v=20260722a)

![Schritt 3 — Wasser-/Spout-Beat auf dem Dach](/assets/blog/panorama-360-tour/view-b.jpg?v=20260722a)

![Schritt 4 — Animated birds Popup mit dem Schwarm gegen den Sturmhimmel](/assets/blog/panorama-360-tour/view-c.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Mehrere Panoramen zu einer geführten Multi-Szenen-Tour verknüpfen
- URL- oder iframe-Popups auf Hotspots für Produktseiten oder Embeds hinzufügen
- [Partikel](/blog/webgpu-particles), [Spout](/blog/spout) und [Vögel](/blog/webgpu-compute-birds) auf geführten Schritten 2–4 layern

## So funktioniert es

Panoramen werden auf eine Kugel (oder Cube-Pipeline) gemappt, damit die Kamera in der Mitte sitzt — der klassische Web-360-Ansatz mit [Three.js](https://threejs.org/) und modernen Browser-APIs ([WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) / optional [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)). Hotspots sind Szenen-Metadaten: Position, Typ und Ziel. Geführte Tour-Schritte auf The Black Witness verdrahten dieselben Effekt-Demos in interaktive Beats — Schritt 2 `+particles` ([WebGPU Particles](/blog/webgpu-particles)), Schritt 3 `+particles/spout` ([Spout](/blog/spout)), Schritt 4 `+birds` ([WebGPU Compute Birds](/blog/webgpu-compute-birds)) — jeweils mit `hotspot+popup`, damit Bewegung und klickbare Story zusammenkommen. Besucher-Preview ist dieselbe Engine ohne Editor-Chrome — siehe [The Black Witness Tour](/blog/panorama-suite).

## FAQ

**Brauchen Gäste eine App?**  
Nein. Teilen Sie einen Browser-Link. Preview-Modus verbirgt den Editor, Gäste sehen nur die Tour.

**Können wir eigene Panoramen nutzen?**  
Ja — laden Sie equirectangular Stills in den Editor und bauen Sie Hotspots um Ihr Venue oder Produkt.

**Wie hängen Partikel, Spout und Vögel mit der Tour zusammen?**  
Optionale Effektschichten auf geführten Schritten 2–4. Jeder Schritt paart einen Kamerastop mit Effekt und Hotspot-Popup — erkunden Sie die Standalone-Demos, dann Play guided tour in /demos/panorama-360/.

## Tech-Stack und weiterführende Links

- [Live Tour Editor](/demos/panorama-360/)
- [Three.js](https://threejs.org/)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Equirectangular projection — Wikipedia](https://en.wikipedia.org/wiki/Equirectangular_projection)

## Verwandt bei IOM

Mehr in [Software](/#software), plus [The Black Witness — 360° Tour](/blog/panorama-suite), [WebGPU Particles](/blog/webgpu-particles), [Spout](/blog/spout), [WebGPU Compute Birds](/blog/webgpu-compute-birds), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$360° Panorama Tour Editor — geführte Walks im Browser erstellen — IOM$iom$,
  $iom$Messebesucher erinnern sich an Erlebnisse. Dieser Editor lädt equirectangular Panoramen, platziert Hotspots, verknüpft Multi-Szenen-Touren und speichert eine `.360project` — alles $iom$
from public.blog_posts p
where p.slug = $iom$panorama-360-tour$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$360° Panorama Tour Editor — créer des parcours guidés dans le navigateur$iom$,
  $iom$Les visiteurs salon se souviennent des expériences. Cet éditeur charge des panoramas équirectangulaires, place des hotspots, enchaîne des tours multi-scènes et sauve une `.360proje$iom$,
  $iom$Les visiteurs salon se souviennent des expériences. Cet éditeur charge des panoramas équirectangulaires, place des hotspots, enchaîne des tours multi-scènes et sauve une `.360project` — tout dans le navigateur, ouvrant sur The Black Witness par défaut.

Il se trouve dans notre [section Logiciel](/#software) sous **360° Panorama Tour Editor**. La couverture est l’étape 1 de la visite guidée sur The Black Witness — hotspot corbeau + popup.

## Ouvrir la démo en direct

**[→ Lancer 360° Panorama Tour Editor](/demos/panorama-360/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Éditeur + visiteur dans une stack** — construire la tour, puis partager un lien preview
- **Hotspots explicatifs** — info, liens de scène et popups iframe optionnels
- **Tours multi-scènes** — mener les invités du stand à la gamme produit au lieu
- **Fichiers projet conservés** — sauver et recharger `.360project` entre sessions

Usages typiques : compagnons salon, walkthroughs de lieux, récits gamme produit, soft launches musée et validations client avant un build tour production.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Un panorama 360° est une photo qui vous entoure — comme au centre d’une pièce. L’éditeur transforme ces photos en tour : marqueurs cliquables (hotspots), liens entre pièces, et un parcours que les invités suivent sans télécharger d’app.

**Glossaire rapide**

- **Équirectangulaire** — disposition d’image 360° courante (sphère complète aplatie en rectangle)
- **Hotspot** — marqueur cliquable — info, saut de scène ou URL/iframe
- **Visite guidée** — séquence scriptée d’arrêts caméra, popups et effets optionnels
- **.360project** — fichier de sauvegarde IOM pour panoramas, hotspots et réglages tour
- **WebGPU birds** — effet vol optionnel sur la tour (GPU)

## Essayez en environ 60 secondes

1. Ouvrir le [360° Panorama Tour Editor](/demos/panorama-360/) (ou [preview visiteur](/demos/panorama-360/?mode=preview))
2. Cliquer **Play guided tour** et suivre les quatre étapes Black Witness
3. Arrêter la tour et cliquer les hotspots — corbeau, feu, eau, oiseaux
4. Dans l’éditeur, sélectionner chaque ligne STEPS pour sauter la caméra et éditer le beat

## Prérequis et performances

- **Navigateur :** Chrome ou Edge moderne recommandé ; WebGPU nécessite un GPU capable
- **Images :** JPG, PNG, WebP équirectangulaires ; HDR/EXR/KTX2 si la pipeline le supporte
- **Mobile :** consultation OK ; édition plus confortable sur desktop

## Ce que vous voyez

La couverture est l’étape 1 de la visite guidée ; les images ci-dessous poursuivent le même parcours Black Witness :

![Étape 2 — hotspot feu animé et popup particules](/assets/blog/panorama-360-tour/view-a.jpg?v=20260722a)

![Étape 3 — beat eau / spout sur le toit](/assets/blog/panorama-360-tour/view-b.jpg?v=20260722a)

![Étape 4 — popup Animated birds avec la volée contre le ciel d’orage](/assets/blog/panorama-360-tour/view-c.jpg?v=20260722a)

Aussi dans ce build :

- Enchaîner plusieurs panoramas en tour multi-scènes guidée
- Ajouter popups URL ou iframe sur hotspots pour pages produit ou embeds
- Superposer [particules](/blog/webgpu-particles), [spout](/blog/spout) et [oiseaux](/blog/webgpu-compute-birds) sur étapes guidées 2–4

## Comment ça marche

Les panoramas sont mappés sur une sphère (ou pipeline cube) pour centrer la caméra — l’approche web 360 classique avec [Three.js](https://threejs.org/) et APIs navigateur modernes ([WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) / [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) optionnel). Les hotspots sont métadonnées scène : position, type, cible. Les étapes guidées sur The Black Witness câblent les mêmes démos effet en beats interactifs — Étape 2 `+particles` ([WebGPU Particles](/blog/webgpu-particles)), Étape 3 `+particles/spout` ([Spout](/blog/spout)), Étape 4 `+birds` ([WebGPU Compute Birds](/blog/webgpu-compute-birds)) — chacune avec `hotspot+popup`. Preview visiteur = même moteur sans chrome éditeur — voir [tour The Black Witness](/blog/panorama-suite).

## FAQ

**Les invités ont-ils besoin d’une app ?**  
Non. Partagez un lien navigateur. Le mode preview masque l’éditeur.

**Peut-on utiliser nos panoramas ?**  
Oui — chargez des stills équirectangulaires et construisez hotspots autour de votre lieu ou produit.

**Comment particules, spout et oiseaux se connectent à la tour ?**  
Couches effet optionnelles sur étapes guidées 2–4. Chaque étape associe arrêt caméra, effet et popup hotspot — explorez les démos standalone, puis Play guided tour dans /demos/panorama-360/.

## Stack technique et lectures

- [Éditeur tour live](/demos/panorama-360/)
- [Three.js](https://threejs.org/)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Projection équirectangulaire — Wikipedia](https://en.wikipedia.org/wiki/Equirectangular_projection)

## Sur IOM

Parcourez [Logiciel](/#software), plus [The Black Witness — Tour 360°](/blog/panorama-suite), [WebGPU Particles](/blog/webgpu-particles), [Spout](/blog/spout), [WebGPU Compute Birds](/blog/webgpu-compute-birds), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$360° Panorama Tour Editor — créer des parcours guidés dans le navigateur — IOM$iom$,
  $iom$Les visiteurs salon se souviennent des expériences. Cet éditeur charge des panoramas équirectangulaires, place des hotspots, enchaîne des tours multi-scènes et sauve une `.360proje$iom$
from public.blog_posts p
where p.slug = $iom$panorama-360-tour$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$360° Panorama Tour Editor — begeleide walks in de browser bouwen$iom$,
  $iom$Beursbezoekers onthouden ervaringen. Deze editor laadt equirectangular panorama's, plaatst hotspots, koppelt multi-scène-tours en slaat een `.360project` op — alles in de browser, $iom$,
  $iom$Beursbezoekers onthouden ervaringen. Deze editor laadt equirectangular panorama's, plaatst hotspots, koppelt multi-scène-tours en slaat een `.360project` op — alles in de browser, standaard openend op The Black Witness.

Het staat in onze [Software-sectie](/#software) als **360° Panorama Tour Editor**. De cover is begeleide tour stap 1 op The Black Witness — raaf-hotspot + popup.

## Open de live demo

**[→ Start 360° Panorama Tour Editor](/demos/panorama-360/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Editor + bezoeker in één stack** — bouw de tour, deel daarna een preview-link
- **Hotspots die uitleggen** — info, scènelinks en optionele iframe-popups
- **Multi-scène-tours** — leid gasten van stand naar productlijn naar locatie
- **Projectbestanden die u houdt** — `.360project` opslaan en herladen tussen sessies

Typische toepassingen: beursbegeleiders, locatie-walkthroughs, productlijnverhalen, museum-soft-launches en klantgoedkeuringen vóór een volledige productietour-build.

## Voor beginners — wat is dit, in gewone taal?

Een 360°-panorama is een foto die helemaal om u heen wikkelt — alsof u midden in een ruimte staat. De editor maakt van die foto's een tour: klikbare markers (hotspots), links tussen kamers en een pad dat gasten kunnen volgen zonder een app te downloaden.

**Korte glossary**

- **Equirectangular** — een gangbare 360°-beeldlayout (volledige bol afgevlakt tot rechthoek)
- **Hotspot** — een klikbare marker — info, scènesprong of URL/iframe
- **Begeleide tour** — een gescripte reeks camerastops, popups en optionele effecten
- **.360project** — IOM's opslagbestand voor panorama's, hotspots en tourinstellingen
- **WebGPU birds** — optioneel zwermeffect op de tour (GPU-ondersteund)

## Probeer dit in ongeveer 60 seconden

1. Open de [360° Panorama Tour Editor](/demos/panorama-360/) (of [bezoekerspreview](/demos/panorama-360/?mode=preview))
2. Klik **Play guided tour** en bekijk de vier Black Witness-stappen
3. Stop de tour en klik zelf hotspots — raaf, vuur, water, vogels
4. Selecteer in de editor elke STEPS-rij om de camera te springen en die beat te bewerken

## Vereisten en performance

- **Browser:** moderne Chrome of Edge aanbevolen; WebGPU-functies vereisen een capabele GPU
- **Afbeeldingen:** equirectangular JPG, PNG, WebP; HDR/EXR/KTX2 wanneer de pipeline ze ondersteunt
- **Mobiel:** bekijken werkt; bewerken is comfortabeler op desktop

## Wat je ziet

De cover is guided-tour stap 1; de stills hieronder zetten dezelfde Black Witness-walkthrough voort:

![Stap 2 — geanimeerde vuur-hotspot en deeltjes-popup](/assets/blog/panorama-360-tour/view-a.jpg?v=20260722a)

![Stap 3 — water-/spout-beat op het dak](/assets/blog/panorama-360-tour/view-b.jpg?v=20260722a)

![Stap 4 — Animated birds-popup met de zwerm tegen de stormlucht](/assets/blog/panorama-360-tour/view-c.jpg?v=20260722a)

Ook in deze build:

- Meerdere panorama's koppelen tot een begeleide multi-scène-tour
- URL- of iframe-popups op hotspots toevoegen voor productpagina's of embeds
- [Deeltjes](/blog/webgpu-particles), [spout](/blog/spout) en [vogels](/blog/webgpu-compute-birds) layeren op begeleide stappen 2–4

## Hoe het werkt

Panorama's worden op een bol (of cube-pipeline) gemapt zodat de camera in het midden staat — de klassieke web-360-aanpak met [Three.js](https://threejs.org/) en moderne browser-API's ([WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) / optioneel [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)). Hotspots zijn scène-metadata: positie, type en doel. Begeleide tourstappen op The Black Witness koppelen dezelfde effectdemo's aan interactieve beats — Stap 2 `+particles` ([WebGPU Particles](/blog/webgpu-particles)), Stap 3 `+particles/spout` ([Spout](/blog/spout)), Stap 4 `+birds` ([WebGPU Compute Birds](/blog/webgpu-compute-birds)) — elk met `hotspot+popup` zodat beweging en klikbaar verhaal samenkomen. Bezoekerspreview is dezelfde engine zonder editor-chrome — zie [The Black Witness-tour](/blog/panorama-suite).

## FAQ

**Hebben gasten een app nodig?**  
Nee. Deel een browserlink. Preview-modus verbergt de editor zodat bezoekers alleen de tour zien.

**Kunnen we onze eigen panorama's gebruiken?**  
Ja — laad equirectangular stills in de editor en bouw hotspots rond uw locatie of product.

**Hoe verbinden deeltjes, spout en vogels met de tour?**  
Optionele effectlagen op begeleide stappen 2–4. Elke stap koppelt een camerastop met een effect en hotspot-popup — verken de standalone demo's, daarna Play guided tour in /demos/panorama-360/.

## Tech stack en verder lezen

- [Live tour-editor](/demos/panorama-360/)
- [Three.js](https://threejs.org/)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Equirectangular projection — Wikipedia](https://en.wikipedia.org/wiki/Equirectangular_projection)

## Gerelateerd op IOM

Bekijk meer in [Software](/#software), plus [The Black Witness — 360° Tour](/blog/panorama-suite), [WebGPU Particles](/blog/webgpu-particles), [Spout](/blog/spout), [WebGPU Compute Birds](/blog/webgpu-compute-birds), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$360° Panorama Tour Editor — begeleide walks in de browser bouwen — IOM$iom$,
  $iom$Beursbezoekers onthouden ervaringen. Deze editor laadt equirectangular panorama's, plaatst hotspots, koppelt multi-scène-tours en slaat een `.360project` op — alles in de browser, $iom$
from public.blog_posts p
where p.slug = $iom$panorama-360-tour$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$360° Panorama Tour Editor — creare walk guidati nel browser$iom$,
  $iom$I visitatori fiere ricordano le esperienze. Questo editor carica panorami equirettangolari, posiziona hotspot, collega tour multi-scena e salva un `.360project` — tutto nel browser$iom$,
  $iom$I visitatori fiere ricordano le esperienze. Questo editor carica panorami equirettangolari, posiziona hotspot, collega tour multi-scena e salva un `.360project` — tutto nel browser, aprendo su The Black Witness di default.

Si trova nella nostra [sezione Software](/#software) come **360° Panorama Tour Editor**. La cover è il passo 1 del tour guidato su The Black Witness — hotspot corvo + popup.

## Apri la demo live

**[→ Avvia 360° Panorama Tour Editor](/demos/panorama-360/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Editor + visitatore in uno stack** — costruisci il tour, poi condividi un link preview
- **Hotspot che spiegano** — info, link scena e popup iframe opzionali
- **Tour multi-scena** — guidare gli ospiti da stand a linea prodotto a venue
- **File progetto che tieni** — salvare e ricaricare `.360project` tra sessioni

Usi tipici: compagni fiere, walkthrough venue, storie linea prodotto, soft launch museo e approvazioni client prima di un build tour produzione completo.

## Per principianti — cos’è, in parole semplici?

Un panorama 360° è una foto che ti avvolge completamente — come stare al centro di una stanza. L'editor trasforma quelle foto in un tour: marcatori cliccabili (hotspot), collegamenti tra stanze e un percorso che gli ospiti seguono senza scaricare un'app.

**Glossario rapido**

- **Equirettangolare** — layout immagine 360° comune (sfera completa appiattita in rettangolo)
- **Hotspot** — marcatore cliccabile — info, salto scena o URL/iframe
- **Tour guidato** — sequenza scriptata di stop camera, popup ed effetti opzionali
- **.360project** — file di salvataggio IOM per panorami, hotspot e impostazioni tour
- **WebGPU birds** — effetto stormo opzionale sul tour (supportato GPU)

## Provalo in circa 60 secondi

1. Apri il [360° Panorama Tour Editor](/demos/panorama-360/) (o [preview visitatore](/demos/panorama-360/?mode=preview))
2. Clicca **Play guided tour** e segui i quattro passi Black Witness
3. Ferma il tour e clicca gli hotspot — corvo, fuoco, acqua, uccelli
4. Nell'editor, seleziona ogni riga STEPS per saltare la camera e modificare quel beat

## Requisiti e prestazioni

- **Browser:** Chrome o Edge moderni consigliati; funzioni WebGPU richiedono GPU capace
- **Immagini:** JPG, PNG, WebP equirettangolari; HDR/EXR/KTX2 quando la pipeline li supporta
- **Mobile:** la visualizzazione funziona; l'editing è più comodo su desktop

## Cosa vedi

La cover è lo step 1 del tour guidato; le immagini sotto continuano lo stesso percorso Black Witness:

![Passo 2 — hotspot fuoco animato e popup particelle](/assets/blog/panorama-360-tour/view-a.jpg?v=20260722a)

![Passo 3 — beat acqua / spout sul tetto](/assets/blog/panorama-360-tour/view-b.jpg?v=20260722a)

![Passo 4 — popup Animated birds con lo stormo contro il cielo tempestoso](/assets/blog/panorama-360-tour/view-c.jpg?v=20260722a)

Anche in questa build:

- Collegare più panorami in un tour multi-scena guidato
- Aggiungere popup URL o iframe su hotspot per pagine prodotto o embed
- Layer [particelle](/blog/webgpu-particles), [spout](/blog/spout) e [uccelli](/blog/webgpu-compute-birds) sui passi guidati 2–4

## Come funziona

I panorami sono mappati su una sfera (o pipeline cube) così la camera sta al centro — l'approccio web 360 classico con [Three.js](https://threejs.org/) e API browser moderne ([WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) / [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) opzionale). Gli hotspot sono metadati scena: posizione, tipo e target. I passi tour guidato su The Black Witness collegano le stesse demo effetto a beat interattivi — Passo 2 `+particles` ([WebGPU Particles](/blog/webgpu-particles)), Passo 3 `+particles/spout` ([Spout](/blog/spout)), Passo 4 `+birds` ([WebGPU Compute Birds](/blog/webgpu-compute-birds)) — ciascuno con `hotspot+popup` così movimento e storia cliccabile arrivano insieme. Preview visitatore è lo stesso motore senza chrome editor — vedi [tour The Black Witness](/blog/panorama-suite).

## FAQ

**Gli ospiti hanno bisogno di un'app?**  
No. Condividi un link browser. La modalità preview nasconde l'editor così i visitatori vedono solo il tour.

**Possiamo usare i nostri panorami?**  
Sì — carica still equirettangolari nell'editor e costruisci hotspot attorno al tuo venue o prodotto.

**Come si collegano particelle, spout e uccelli al tour?**  
Sono layer effetto opzionali sui passi guidati 2–4. Ogni passo abbina stop camera, effetto e popup hotspot — esplora le demo standalone, poi Play guided tour in /demos/panorama-360/.

## Stack tecnico e letture

- [Editor tour live](/demos/panorama-360/)
- [Three.js](https://threejs.org/)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Equirectangular projection — Wikipedia](https://en.wikipedia.org/wiki/Equirectangular_projection)

## Correlati su IOM

Esplora di più in [Software](/#software), più [The Black Witness — Tour 360°](/blog/panorama-suite), [WebGPU Particles](/blog/webgpu-particles), [Spout](/blog/spout), [WebGPU Compute Birds](/blog/webgpu-compute-birds), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$360° Panorama Tour Editor — creare walk guidati nel browser — IOM$iom$,
  $iom$I visitatori fiere ricordano le esperienze. Questo editor carica panorami equirettangolari, posiziona hotspot, collega tour multi-scena e salva un `.360project` — tutto nel browser$iom$
from public.blog_posts p
where p.slug = $iom$panorama-360-tour$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$360° Panorama Tour Editor — crear recorridos guiados en el navegador$iom$,
  $iom$Los visitantes de feria recuerdan experiencias. Este editor carga panoramas equirectangulares, coloca hotspots, encadena tours multi-escena y guarda un `.360project` — todo en el n$iom$,
  $iom$Los visitantes de feria recuerdan experiencias. Este editor carga panoramas equirectangulares, coloca hotspots, encadena tours multi-escena y guarda un `.360project` — todo en el navegador, abriendo en The Black Witness por defecto.

Está en nuestra [sección Software](/#software) como **360° Panorama Tour Editor**. La portada es el paso 1 del tour guiado en The Black Witness — hotspot cuervo + popup.

## Abrir la demo en vivo

**[→ Lanzar 360° Panorama Tour Editor](/demos/panorama-360/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Editor + visitante en un stack** — construye el tour, luego comparte un enlace preview
- **Hotspots que explican** — info, enlaces de escena y popups iframe opcionales
- **Tours multi-escena** — llevar invitados de stand a línea de producto a venue
- **Archivos de proyecto que conservas** — guardar y recargar `.360project` entre sesiones

Usos típicos: acompañantes de feria, walkthroughs de venue, historias de línea de producto, soft launches de museo y aprobaciones de cliente antes de un build de tour de producción.

## Para principiantes — ¿qué es esto, en palabras simples?

Un panorama 360° es una foto que te envuelve por completo — como estar en el centro de una habitación. El editor convierte esas fotos en un tour: marcadores clicables (hotspots), enlaces entre salas y un recorrido que los invitados siguen sin descargar una app.

**Glosario rápido**

- **Equirectangular** — disposición de imagen 360° habitual (esfera completa aplanada en rectángulo)
- **Hotspot** — marcador clicable — info, salto de escena o URL/iframe
- **Tour guiado** — secuencia scriptada de paradas de cámara, popups y efectos opcionales
- **.360project** — archivo de guardado IOM para panoramas, hotspots y ajustes de tour
- **WebGPU birds** — efecto de bandada opcional en el tour (respaldado por GPU)

## Pruébalo en unos 60 segundos

1. Abre el [360° Panorama Tour Editor](/demos/panorama-360/) (o [preview visitante](/demos/panorama-360/?mode=preview))
2. Haz clic en **Play guided tour** y sigue los cuatro pasos Black Witness
3. Detén el tour y haz clic en hotspots tú mismo — cuervo, fuego, agua, pájaros
4. En el editor, selecciona cada fila STEPS para saltar la cámara y editar ese beat

## Requisitos y rendimiento

- **Navegador:** Chrome o Edge modernos recomendados; funciones WebGPU requieren GPU capaz
- **Imágenes:** JPG, PNG, WebP equirectangulares; HDR/EXR/KTX2 cuando la pipeline los soporte
- **Móvil:** la visualización funciona; la edición es más cómoda en desktop

## Lo que ves

La portada es el paso 1 del tour guiado; las imágenes de abajo continúan el mismo recorrido Black Witness:

![Paso 2 — hotspot de fuego animado y popup de partículas](/assets/blog/panorama-360-tour/view-a.jpg?v=20260722a)

![Paso 3 — beat agua / spout en la azotea](/assets/blog/panorama-360-tour/view-b.jpg?v=20260722a)

![Paso 4 — popup Animated birds con la bandada contra el cielo tormentoso](/assets/blog/panorama-360-tour/view-c.jpg?v=20260722a)

También en este build:

- Encadenar varios panoramas en un tour multi-escena guiado
- Añadir popups URL o iframe en hotspots para páginas de producto o embeds
- Superponer [partículas](/blog/webgpu-particles), [spout](/blog/spout) y [pájaros](/blog/webgpu-compute-birds) en pasos guiados 2–4

## Cómo funciona

Los panoramas se mapean sobre una esfera (o pipeline cube) para que la cámara quede en el centro — el enfoque web 360 clásico con [Three.js](https://threejs.org/) y APIs modernas del navegador ([WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) / [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) opcional). Los hotspots son metadatos de escena: posición, tipo y destino. Los pasos de tour guiado en The Black Witness conectan las mismas demos de efecto en beats interactivos — Paso 2 `+particles` ([WebGPU Particles](/blog/webgpu-particles)), Paso 3 `+particles/spout` ([Spout](/blog/spout)), Paso 4 `+birds` ([WebGPU Compute Birds](/blog/webgpu-compute-birds)) — cada uno con `hotspot+popup` para que movimiento e historia clicable lleguen juntos. Preview visitante es el mismo motor sin chrome del editor — ver [tour The Black Witness](/blog/panorama-suite).

## FAQ

**¿Los invitados necesitan una app?**  
No. Comparte un enlace de navegador. El modo preview oculta el editor para que los visitantes solo vean el tour.

**¿Podemos usar nuestros propios panoramas?**  
Sí — carga stills equirectangulares en el editor y construye hotspots alrededor de tu venue o producto.

**¿Cómo conectan partículas, spout y pájaros con el tour?**  
Son capas de efecto opcionales en pasos guiados 2–4. Cada paso empareja parada de cámara, efecto y popup hotspot — explora las demos standalone, luego Play guided tour en /demos/panorama-360/.

## Stack técnico y lecturas

- [Editor de tour live](/demos/panorama-360/)
- [Three.js](https://threejs.org/)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Equirectangular projection — Wikipedia](https://en.wikipedia.org/wiki/Equirectangular_projection)

## Relacionado en IOM

Explora más en [Software](/#software), más [The Black Witness — Tour 360°](/blog/panorama-suite), [WebGPU Particles](/blog/webgpu-particles), [Spout](/blog/spout), [WebGPU Compute Birds](/blog/webgpu-compute-birds), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$360° Panorama Tour Editor — crear recorridos guiados en el navegador — IOM$iom$,
  $iom$Los visitantes de feria recuerdan experiencias. Este editor carga panoramas equirectangulares, coloca hotspots, encadena tours multi-escena y guarda un `.360project` — todo en el n$iom$
from public.blog_posts p
where p.slug = $iom$panorama-360-tour$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$CRM Demo — try the IOM client sandbox$iom$,
  $iom$Want to see how IOM runs leads, projects, and time without touching live client data? The CRM demo is an interactive sandbox with fictional companies — pipeline, boards, ideas, and$iom$,
  $iom$Want to see how IOM runs leads, projects, and time without touching live client data? The CRM demo is an interactive sandbox with fictional companies — pipeline, boards, ideas, and blog drafts that stay in this browser tab.

It lives in our [Software section](/#software) as **CRM Demo**. The cover shows the CRM sandbox UI from the portfolio card.

## Open the live demo

**[→ Launch CRM Demo](/crm-demo)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Safe to click everything** — edits never hit production databases
- **Full workspace feel** — leads, projects, time, ideas, and sample blog posts
- **Pitch in a meeting** — open `/crm-demo` and walk the flow live
- **Same product family** — mirrors the real client CRM at `/client-login`

Typical uses: sales demos, onboarding walkthroughs, stakeholder training, and “what would our pipeline look like?” conversations before a real workspace is provisioned.

## For beginners — what is this, in plain words?

A CRM (customer relationship management) tool is where a studio tracks who inquired, which projects are active, and how time is spent. This demo is a practice kitchen: the recipes are real, the ingredients are fictional, and nothing you type leaves your tab unless you export it yourself.

**Quick glossary**

- **Sandbox** — a practice copy of the app with fake data that resets safely
- **Pipeline** — stages a lead moves through before it becomes a project
- **In-memory** — data lives in this browser session, not on the live server
- **Client login** — the real CRM at `/client-login` with Supabase-backed data

## Try this in about 60 seconds

1. Open the [CRM Demo](/crm-demo)
2. Browse Leads or Projects — open a fictional company card
3. Make a small edit (status, note, or board card) to feel the sandbox
4. Optional: open Blog in the demo CRM and Preview a sample post

## Requirements and performance

- **Browser:** any modern desktop browser; a wide window helps for boards
- **Privacy:** sandbox data stays local to the tab — refresh may reset the store
- **Not production:** never enter real client secrets here; use `/client-login` for live work

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Pipeline view — fictional leads in stage columns](/assets/blog/crm-demo/view-a.jpg?v=20260722a)

![Project board — tasks and context for a demo company](/assets/blog/crm-demo/view-b.jpg?v=20260722a)

Also in this build:

- Explore time tracking and idea maps with sample entries
- Reset the demo workspace when you want a clean slate
- Compare the sandbox feel with the real CRM after login

## How it works

The public [CRM demo](/crm-demo) uses an in-memory store so every click is disposable. The production CRM at `/client-login` talks to Supabase for real staff and client data. Same UI language, different backend — so a pitch never risks a live record.

## FAQ

**Will my edits show up for other visitors?**  
No. The sandbox is per browser tab / session. Other people see their own copy of the fictional data.

**Is this the same as client login?**  
Same product family and screens, but `/crm-demo` never touches live databases. Real work happens at `/client-login`.

## Tech stack and further reading

- [CRM Demo](/crm-demo)
- [Client login](/client-login)
- [IOM home](/)

## Related on IOM

Browse more in [Software](/#software), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [Image Prep](/blog/image-prep), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$CRM Demo — try the IOM client sandbox — IOM$iom$,
  $iom$Want to see how IOM runs leads, projects, and time without touching live client data? The CRM demo is an interactive sandbox with fictional companies — pipeline, boards, ideas, and$iom$
from public.blog_posts p
where p.slug = $iom$crm-demo$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$CRM Demo — IOM Client-Sandbox ausprobieren$iom$,
  $iom$Möchten Sie sehen, wie IOM Leads, Projekte und Zeit verwaltet, ohne Live-Kundendaten anzufassen? Die CRM Demo ist eine interaktive Sandbox mit fiktiven Unternehmen — Pipeline, Boar$iom$,
  $iom$Möchten Sie sehen, wie IOM Leads, Projekte und Zeit verwaltet, ohne Live-Kundendaten anzufassen? Die CRM Demo ist eine interaktive Sandbox mit fiktiven Unternehmen — Pipeline, Boards, Ideen und Blog-Entwürfe bleiben in diesem Browser-Tab.

Es liegt in unserem [Software-Bereich](/#software) als **CRM Demo**. Das Cover zeigt die CRM-Sandbox-UI der Portfolio-Karte.

## Live-Demo öffnen

**[→ CRM Demo starten](/crm-demo)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Sicher alles anklicken** — Änderungen treffen nie Produktionsdatenbanken
- **Volles Workspace-Gefühl** — Leads, Projekte, Zeit, Ideen und Sample-Blogposts
- **Im Meeting pitchen** — `/crm-demo` öffnen und den Flow live durchgehen
- **Gleiche Produktfamilie** — spiegelt das echte Client-CRM unter `/client-login`

Typische Einsätze: Sales-Demos, Onboarding-Walkthroughs, Stakeholder-Training und Gespräche über „Wie würde unsere Pipeline aussehen?“ vor Bereitstellung eines echten Workspace.

## Für Einsteiger — was ist das, in einfachen Worten?

Ein CRM (Customer Relationship Management) ist, wo ein Studio trackt, wer angefragt hat, welche Projekte aktiv sind und wie Zeit verbracht wird. Diese Demo ist eine Übungsküche: die Rezepte sind echt, die Zutaten fiktiv, und nichts, was Sie tippen, verlässt Ihren Tab, außer Sie exportieren es selbst.

**Kurzes Glossar**

- **Sandbox** — eine Übungskopie der App mit Fake-Daten, die sicher zurücksetzt
- **Pipeline** — Stufen, die ein Lead durchläuft, bevor er Projekt wird
- **In-memory** — Daten leben in dieser Browser-Session, nicht auf dem Live-Server
- **Client login** — das echte CRM unter `/client-login` mit Supabase-Daten

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [CRM Demo](/crm-demo)
2. Durchsuchen Sie Leads oder Projects — öffnen Sie eine fiktive Firmenkarte
3. Machen Sie eine kleine Änderung (Status, Notiz oder Board-Karte), um die Sandbox zu spüren
4. Optional: Blog in der Demo-CRM öffnen und einen Sample-Post previewen

## Anforderungen und Performance

- **Browser:** jeder moderne Desktop-Browser; breites Fenster hilft bei Boards
- **Datenschutz:** Sandbox-Daten bleiben lokal im Tab — Refresh kann den Store zurücksetzen
- **Nicht Produktion:** nie echte Kundengeheimnisse hier eingeben; `/client-login` für Live-Arbeit

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Pipeline-Ansicht — fiktive Leads in Stagespalten](/assets/blog/crm-demo/view-a.jpg?v=20260722a)

![Projektboard — Tasks und Kontext für eine Demo-Firma](/assets/blog/crm-demo/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Zeiterfassung und Ideen-Maps mit Sample-Einträgen erkunden
- Demo-Workspace zurücksetzen für einen sauberen Start
- Sandbox-Gefühl mit echtem CRM nach Login vergleichen

## So funktioniert es

Die öffentliche [CRM Demo](/crm-demo) nutzt einen In-Memory-Store, damit jeder Klick wegwerfbar ist. Das Produktions-CRM unter `/client-login` spricht mit Supabase für echte Mitarbeiter- und Kundendaten. Gleiche UI-Sprache, anderes Backend — damit ein Pitch nie einen Live-Datensatz riskiert.

## FAQ

**Sehen andere Besucher meine Änderungen?**  
Nein. Die Sandbox ist pro Browser-Tab / Session. Andere sehen ihre eigene Kopie der fiktiven Daten.

**Ist das dasselbe wie Client Login?**  
Gleiche Produktfamilie und Screens, aber `/crm-demo` berührt nie Live-Datenbanken. Echte Arbeit passiert unter `/client-login`.

## Tech-Stack und weiterführende Links

- [CRM Demo](/crm-demo)
- [Client login](/client-login)
- [IOM Startseite](/)

## Verwandt bei IOM

Mehr in [Software](/#software), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [Image Prep](/blog/image-prep), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$CRM Demo — IOM Client-Sandbox ausprobieren — IOM$iom$,
  $iom$Möchten Sie sehen, wie IOM Leads, Projekte und Zeit verwaltet, ohne Live-Kundendaten anzufassen? Die CRM Demo ist eine interaktive Sandbox mit fiktiven Unternehmen — Pipeline, Boar$iom$
from public.blog_posts p
where p.slug = $iom$crm-demo$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$CRM Demo — essayer le bac à sable client IOM$iom$,
  $iom$Envie de voir comment IOM gère leads, projets et temps sans toucher aux données client live ? La CRM Demo est un bac à sable interactif avec des entreprises fictives — pipeline, bo$iom$,
  $iom$Envie de voir comment IOM gère leads, projets et temps sans toucher aux données client live ? La CRM Demo est un bac à sable interactif avec des entreprises fictives — pipeline, boards, idées et brouillons blog qui restent dans cet onglet.

Il se trouve dans notre [section Logiciel](/#software) sous **CRM Demo**. La couverture montre l’UI sandbox CRM de la carte portfolio.

## Ouvrir la démo en direct

**[→ Lancer CRM Demo](/crm-demo)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Cliquer partout sans risque** — les edits ne touchent jamais les bases production
- **Vraie sensation workspace** — leads, projets, temps, idées et posts blog exemple
- **Pitcher en réunion** — ouvrir `/crm-demo` et parcourir le flux live
- **Même famille produit** — reflète le vrai CRM client sur `/client-login`

Usages typiques : démos commerciales, walkthroughs onboarding, formation parties prenantes et conversations « à quoi ressemblerait notre pipeline ? » avant provisionnement d’un vrai workspace.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Un CRM (customer relationship management) est là où un studio suit qui a demandé, quels projets sont actifs et comment le temps est passé. Cette démo est une cuisine d’entraînement : recettes réelles, ingrédients fictifs, rien de ce que vous tapez ne quitte l’onglet sauf export volontaire.

**Glossaire rapide**

- **Sandbox** — copie d’entraînement de l’app avec fausses données qui reset en sécurité
- **Pipeline** — étapes qu’un lead traverse avant de devenir projet
- **In-memory** — données dans cette session navigateur, pas sur le serveur live
- **Client login** — le vrai CRM sur `/client-login` avec données Supabase

## Essayez en environ 60 secondes

1. Ouvrir la [CRM Demo](/crm-demo)
2. Parcourir Leads ou Projects — ouvrir une fiche entreprise fictive
3. Faire une petite modification (statut, note ou carte board) pour sentir le sandbox
4. Optionnel : ouvrir Blog dans la demo CRM et prévisualiser un post exemple

## Prérequis et performances

- **Navigateur :** tout navigateur desktop moderne ; fenêtre large utile pour les boards
- **Confidentialité :** données sandbox locales à l’onglet — refresh peut reset le store
- **Pas production :** ne jamais entrer de secrets client réels ; `/client-login` pour le travail live

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Vue pipeline — leads fictifs en colonnes d’étapes](/assets/blog/crm-demo/view-a.jpg?v=20260722a)

![Board projet — tâches et contexte pour une entreprise demo](/assets/blog/crm-demo/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Explorer suivi du temps et cartes d’idées avec entrées exemple
- Reset le workspace demo pour repartir propre
- Comparer le ressenti sandbox avec le vrai CRM après login

## Comment ça marche

La [CRM demo](/crm-demo) publique utilise un store in-memory pour que chaque clic soit jetable. Le CRM production sur `/client-login` parle à Supabase pour données staff et client réelles. Même langage UI, backend différent — un pitch ne risque jamais un enregistrement live.

## FAQ

**Mes modifications apparaissent-elles pour d’autres visiteurs ?**  
Non. Le sandbox est par onglet / session. Chacun voit sa copie des données fictives.

**Est-ce la même chose que client login ?**  
Même famille produit et écrans, mais `/crm-demo` ne touche jamais les bases live. Le vrai travail est sur `/client-login`.

## Stack technique et lectures

- [CRM Demo](/crm-demo)
- [Client login](/client-login)
- [Accueil IOM](/)

## Sur IOM

Parcourez [Logiciel](/#software), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [Image Prep](/blog/image-prep), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$CRM Demo — essayer le bac à sable client IOM — IOM$iom$,
  $iom$Envie de voir comment IOM gère leads, projets et temps sans toucher aux données client live ? La CRM Demo est un bac à sable interactif avec des entreprises fictives — pipeline, bo$iom$
from public.blog_posts p
where p.slug = $iom$crm-demo$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$CRM Demo — probeer de IOM-client-sandbox$iom$,
  $iom$Wilt u zien hoe IOM leads, projecten en tijd beheert zonder live klantdata aan te raken? De CRM Demo is een interactieve sandbox met fictieve bedrijven — pipeline, boards, ideeën e$iom$,
  $iom$Wilt u zien hoe IOM leads, projecten en tijd beheert zonder live klantdata aan te raken? De CRM Demo is een interactieve sandbox met fictieve bedrijven — pipeline, boards, ideeën en blogconcepten die in dit browsertabblad blijven.

Het staat in onze [Software-sectie](/#software) als **CRM Demo**. De cover toont de CRM-sandbox-UI van de portfoliokaart.

## Open de live demo

**[→ Start CRM Demo](/crm-demo)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Veilig alles aanklikken** — wijzigingen raken nooit productiedatabases
- **Volledig workspace-gevoel** — leads, projecten, tijd, ideeën en voorbeeldblogposts
- **Pitchen in een meeting** — open `/crm-demo` en loop live door de flow
- **Zelfde productfamilie** — spiegelt de echte klant-CRM op `/client-login`

Typische toepassingen: salesdemo's, onboarding-walkthroughs, stakeholdertraining en gesprekken over „hoe zou onze pipeline eruitzien?” vóór provisioning van een echte workspace.

## Voor beginners — wat is dit, in gewone taal?

Een CRM (customer relationship management) is waar een studio bijhoudt wie heeft geïnformeerd, welke projecten actief zijn en hoe tijd wordt besteed. Deze demo is een oefenkeuken: de recepten zijn echt, de ingrediënten fictief, en niets wat u typt verlaat uw tabblad tenzij u het zelf exporteert.

**Korte glossary**

- **Sandbox** — een oefenkopie van de app met nepgegevens die veilig reset
- **Pipeline** — fasen die een lead doorloopt voordat het een project wordt
- **In-memory** — data leeft in deze browsersessie, niet op de live server
- **Client login** — de echte CRM op `/client-login` met Supabase-ondersteunde data

## Probeer dit in ongeveer 60 seconden

1. Open de [CRM Demo](/crm-demo)
2. Blader door Leads of Projects — open een fictieve bedrijfskaart
3. Maak een kleine wijziging (status, notitie of boardkaart) om de sandbox te voelen
4. Optioneel: open Blog in de demo-CRM en bekijk een voorbeeldpost

## Vereisten en performance

- **Browser:** elke moderne desktopbrowser; een breed venster helpt voor boards
- **Privacy:** sandboxdata blijft lokaal in het tabblad — refresh kan de store resetten
- **Niet productie:** voer hier nooit echte klantgeheimen in; gebruik `/client-login` voor live werk

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Pipeline-weergave — fictieve leads in fasekolommen](/assets/blog/crm-demo/view-a.jpg?v=20260722a)

![Projectboard — taken en context voor een demobedrijf](/assets/blog/crm-demo/view-b.jpg?v=20260722a)

Ook in deze build:

- Tijdregistratie en ideeënkaarten verkennen met voorbeeldinvoer
- De demo-workspace resetten voor een schone start
- Het sandbox-gevoel vergelijken met de echte CRM na login

## Hoe het werkt

De publieke [CRM Demo](/crm-demo) gebruikt een in-memory store zodat elke klik wegwerpbaar is. De productie-CRM op `/client-login` praat met Supabase voor echte medewerker- en klantdata. Dezelfde UI-taal, ander backend — zodat een pitch nooit een live record riskeert.

## FAQ

**Zien andere bezoekers mijn wijzigingen?**  
Nee. De sandbox is per browsertabblad / sessie. Anderen zien hun eigen kopie van de fictieve data.

**Is dit hetzelfde als client login?**  
Zelfde productfamilie en schermen, maar `/crm-demo` raakt nooit live databases. Echt werk gebeurt op `/client-login`.

## Tech stack en verder lezen

- [CRM Demo](/crm-demo)
- [Client login](/client-login)
- [IOM home](/)

## Gerelateerd op IOM

Bekijk meer in [Software](/#software), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [Image Prep](/blog/image-prep), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$CRM Demo — probeer de IOM-client-sandbox — IOM$iom$,
  $iom$Wilt u zien hoe IOM leads, projecten en tijd beheert zonder live klantdata aan te raken? De CRM Demo is een interactieve sandbox met fictieve bedrijven — pipeline, boards, ideeën e$iom$
from public.blog_posts p
where p.slug = $iom$crm-demo$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$CRM Demo — prova la sandbox client IOM$iom$,
  $iom$Vuoi vedere come IOM gestisce lead, progetti e tempo senza toccare dati client live? La CRM Demo è una sandbox interattiva con aziende fittizie — pipeline, board, idee e bozze blog$iom$,
  $iom$Vuoi vedere come IOM gestisce lead, progetti e tempo senza toccare dati client live? La CRM Demo è una sandbox interattiva con aziende fittizie — pipeline, board, idee e bozze blog che restano in questa scheda browser.

Si trova nella nostra [sezione Software](/#software) come **CRM Demo**. La cover mostra l'UI sandbox CRM dalla card portfolio.

## Apri la demo live

**[→ Avvia CRM Demo](/crm-demo)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Sicuro cliccare tutto** — le modifiche non toccano mai database di produzione
- **Sensazione workspace completa** — lead, progetti, tempo, idee e post blog di esempio
- **Pitch in riunione** — apri `/crm-demo` e percorri il flusso live
- **Stessa famiglia prodotto** — rispecchia la CRM client reale su `/client-login`

Usi tipici: demo commerciali, walkthrough onboarding, formazione stakeholder e conversazioni «come sarebbe la nostra pipeline?» prima di provisionare un workspace reale.

## Per principianti — cos’è, in parole semplici?

Un CRM (customer relationship management) è dove uno studio traccia chi ha chiesto info, quali progetti sono attivi e come viene speso il tempo. Questa demo è una cucina di pratica: le ricette sono reali, gli ingredienti fittizi, e nulla di ciò che digiti lascia la scheda a meno che non esporti tu.

**Glossario rapido**

- **Sandbox** — copia di pratica dell'app con dati finti che reset in sicurezza
- **Pipeline** — fasi che un lead attraversa prima di diventare progetto
- **In-memory** — i dati vivono in questa sessione browser, non sul server live
- **Client login** — la CRM reale su `/client-login` con dati Supabase

## Provalo in circa 60 secondi

1. Apri la [CRM Demo](/crm-demo)
2. Sfoglia Leads o Projects — apri una scheda azienda fittizia
3. Fai una piccola modifica (stato, nota o card board) per sentire la sandbox
4. Opzionale: apri Blog nella demo CRM e anteprima un post di esempio

## Requisiti e prestazioni

- **Browser:** qualsiasi browser desktop moderno; finestra larga aiuta per le board
- **Privacy:** dati sandbox locali alla scheda — refresh può resettare lo store
- **Non produzione:** non inserire mai segreti client reali; usa `/client-login` per lavoro live

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Vista pipeline — lead fittizi in colonne di fase](/assets/blog/crm-demo/view-a.jpg?v=20260722a)

![Board progetto — task e contesto per un'azienda demo](/assets/blog/crm-demo/view-b.jpg?v=20260722a)

Anche in questa build:

- Esplorare time tracking e mappe idee con voci di esempio
- Resettare il workspace demo per ripartire puliti
- Confrontare la sensazione sandbox con la CRM reale dopo login

## Come funziona

La [CRM demo](/crm-demo) pubblica usa uno store in-memory così ogni click è disposable. La CRM produzione su `/client-login` parla con Supabase per dati staff e client reali. Stesso linguaggio UI, backend diverso — così un pitch non rischia mai un record live.

## FAQ

**Le mie modifiche appaiono ad altri visitatori?**  
No. La sandbox è per scheda browser / sessione. Gli altri vedono la propria copia dei dati fittizi.

**È la stessa cosa di client login?**  
Stessa famiglia prodotto e schermate, ma `/crm-demo` non tocca mai database live. Il lavoro reale avviene su `/client-login`.

## Stack tecnico e letture

- [CRM Demo](/crm-demo)
- [Client login](/client-login)
- [Home IOM](/)

## Correlati su IOM

Esplora di più in [Software](/#software), più [360° Panorama Tour Editor](/blog/panorama-360-tour), [Image Prep](/blog/image-prep), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$CRM Demo — prova la sandbox client IOM — IOM$iom$,
  $iom$Vuoi vedere come IOM gestisce lead, progetti e tempo senza toccare dati client live? La CRM Demo è una sandbox interattiva con aziende fittizie — pipeline, board, idee e bozze blog$iom$
from public.blog_posts p
where p.slug = $iom$crm-demo$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$CRM Demo — prueba el sandbox de cliente IOM$iom$,
  $iom$¿Quieres ver cómo IOM gestiona leads, proyectos y tiempo sin tocar datos de cliente live? La CRM Demo es un sandbox interactivo con empresas ficticias — pipeline, boards, ideas y b$iom$,
  $iom$¿Quieres ver cómo IOM gestiona leads, proyectos y tiempo sin tocar datos de cliente live? La CRM Demo es un sandbox interactivo con empresas ficticias — pipeline, boards, ideas y borradores de blog que permanecen en esta pestaña del navegador.

Está en nuestra [sección Software](/#software) como **CRM Demo**. La portada muestra la UI sandbox CRM de la tarjeta del portfolio.

## Abrir la demo en vivo

**[→ Lanzar CRM Demo](/crm-demo)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Seguro hacer clic en todo** — las ediciones nunca tocan bases de datos de producción
- **Sensación de workspace completo** — leads, proyectos, tiempo, ideas y posts de blog de ejemplo
- **Pitch en reunión** — abre `/crm-demo` y recorre el flujo en vivo
- **Misma familia de producto** — refleja la CRM real de cliente en `/client-login`

Usos típicos: demos comerciales, walkthroughs de onboarding, formación de stakeholders y conversaciones de «¿cómo se vería nuestro pipeline?» antes de provisionar un workspace real.

## Para principiantes — ¿qué es esto, en palabras simples?

Un CRM (customer relationship management) es donde un estudio rastrea quién consultó, qué proyectos están activos y cómo se gasta el tiempo. Esta demo es una cocina de práctica: las recetas son reales, los ingredientes ficticios, y nada de lo que escribes sale de tu pestaña salvo que lo exportes tú.

**Glosario rápido**

- **Sandbox** — copia de práctica de la app con datos falsos que resetea con seguridad
- **Pipeline** — etapas por las que pasa un lead antes de convertirse en proyecto
- **In-memory** — los datos viven en esta sesión del navegador, no en el servidor live
- **Client login** — la CRM real en `/client-login` con datos respaldados por Supabase

## Pruébalo en unos 60 segundos

1. Abre la [CRM Demo](/crm-demo)
2. Explora Leads o Projects — abre una ficha de empresa ficticia
3. Haz una pequeña edición (estado, nota o tarjeta de board) para sentir el sandbox
4. Opcional: abre Blog en la demo CRM y previsualiza un post de ejemplo

## Requisitos y rendimiento

- **Navegador:** cualquier navegador desktop moderno; ventana ancha ayuda para boards
- **Privacidad:** datos sandbox locales a la pestaña — refresh puede resetear el store
- **No producción:** nunca introduzcas secretos reales de cliente; usa `/client-login` para trabajo live

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Vista pipeline — leads ficticios en columnas de etapa](/assets/blog/crm-demo/view-a.jpg?v=20260722a)

![Board de proyecto — tareas y contexto para una empresa demo](/assets/blog/crm-demo/view-b.jpg?v=20260722a)

También en este build:

- Explorar seguimiento de tiempo y mapas de ideas con entradas de ejemplo
- Resetear el workspace demo para empezar limpio
- Comparar la sensación sandbox con la CRM real tras login

## Cómo funciona

La [CRM demo](/crm-demo) pública usa un store in-memory para que cada clic sea desechable. La CRM de producción en `/client-login` habla con Supabase para datos reales de staff y clientes. Mismo lenguaje UI, backend distinto — así un pitch nunca arriesga un registro live.

## FAQ

**¿Mis ediciones aparecen para otros visitantes?**  
No. El sandbox es por pestaña / sesión del navegador. Cada uno ve su propia copia de los datos ficticios.

**¿Es lo mismo que client login?**  
Misma familia de producto y pantallas, pero `/crm-demo` nunca toca bases live. El trabajo real ocurre en `/client-login`.

## Stack técnico y lecturas

- [CRM Demo](/crm-demo)
- [Client login](/client-login)
- [Inicio IOM](/)

## Relacionado en IOM

Explora más en [Software](/#software), más [360° Panorama Tour Editor](/blog/panorama-360-tour), [Image Prep](/blog/image-prep), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$CRM Demo — prueba el sandbox de cliente IOM — IOM$iom$,
  $iom$¿Quieres ver cómo IOM gestiona leads, proyectos y tiempo sin tocar datos de cliente live? La CRM Demo es un sandbox interactivo con empresas ficticias — pipeline, boards, ideas y b$iom$
from public.blog_posts p
where p.slug = $iom$crm-demo$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$Image Prep — resize, compress, and strip EXIF in the browser$iom$,
  $iom$Portfolio and web images should be sharp, light, and private. Image Prep resizes to common presets, compresses JPEG/WebP/PNG, and strips camera/GPS EXIF — files stay on your device$iom$,
  $iom$Portfolio and web images should be sharp, light, and private. Image Prep resizes to common presets, compresses JPEG/WebP/PNG, and strips camera/GPS EXIF — files stay on your device until you download the result.

It lives in our [Software section](/#software) as **Image Prep**. The cover shows the Image Prep tool UI from the software card.

## Open the live demo

**[→ Launch Image Prep](/tools/image-prep)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Stay on-device** — no upload to a mystery server for a quick resize
- **Web-ready presets** — portfolio and site sizes without Photoshop gymnastics
- **Privacy by default** — strip EXIF so GPS and camera metadata do not leak
- **Less weight, same story** — compress for faster pages and quieter CDN bills

Typical uses: prepping hero stills, gallery uploads, CRM/blog covers, and client handoff packs before they hit a CMS or demo page.

## For beginners — what is this, in plain words?

Before a photo goes on a website, it usually needs three favors: the right pixel size, a smaller file, and less personal data in the file header. Image Prep does those favors in the browser — drag in a picture, pick a preset, download a cleaner version.

**Quick glossary**

- **EXIF** — metadata cameras embed (settings, timestamps, sometimes GPS)
- **Compress** — reduce file size, often with a quality slider
- **WebP** — a modern image format that is often smaller than JPEG at similar quality
- **On-device** — processing happens in your browser; you choose when to download

## Try this in about 60 seconds

1. Open [Image Prep](/tools/image-prep)
2. Drop in a JPG or PNG from your machine
3. Pick a resize preset and a format (JPEG / WebP / PNG)
4. Enable EXIF strip if needed, then download the result

## Requirements and performance

- **Browser:** modern Chrome, Edge, or Firefox with canvas support
- **Privacy:** processing is local — still avoid pasting secrets into unrelated fields
- **Limits:** extremely large raws may need a first pass in a desktop editor

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Tool layout — source image and prep controls](/assets/blog/image-prep/view-a.jpg?v=20260722a)

![After prep — web-sized output ready to download](/assets/blog/image-prep/view-b.jpg?v=20260722a)

Also in this build:

- Batch a few portfolio stills to the same preset
- Export WebP when the destination site supports it
- Use before uploading covers for blog or CRM demo posts

## How it works

The tool uses browser APIs (canvas / image decoding) to resize and re-encode on your machine. EXIF stripping removes embedded metadata so published files do not carry GPS or camera serials by accident. For format background see [MDN — Using files from web applications](https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications) and [EXIF — Wikipedia](https://en.wikipedia.org/wiki/Exif).

## FAQ

**Do my photos upload to IOM servers?**  
No for normal prep — work stays in the browser until you download. Use that download as the file you publish elsewhere.

**Will quality look worse?**  
Compression always trades size for fidelity. Start with a high-quality preset; nudge down only if the file is still heavy.

## Tech stack and further reading

- [Image Prep tool](/tools/image-prep)
- [EXIF — Wikipedia](https://en.wikipedia.org/wiki/Exif)
- [WebP — Google developers](https://developers.google.com/speed/webp)
- [File API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/File_API)

## Related on IOM

Browse more in [Software](/#software), plus [3D Viewer](/blog/3d-viewer), [360° Panorama Tour Editor](/blog/panorama-360-tour), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$Image Prep — resize, compress, and strip EXIF in the browser — IOM$iom$,
  $iom$Portfolio and web images should be sharp, light, and private. Image Prep resizes to common presets, compresses JPEG/WebP/PNG, and strips camera/GPS EXIF — files stay on your device$iom$
from public.blog_posts p
where p.slug = $iom$image-prep$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$Image Prep — Größe ändern, komprimieren und EXIF im Browser entfernen$iom$,
  $iom$Portfolio- und Web-Bilder sollten scharf, leicht und privat sein. Image Prep skaliert auf gängige Presets, komprimiert JPEG/WebP/PNG und entfernt Kamera-/GPS-EXIF — Dateien bleiben$iom$,
  $iom$Portfolio- und Web-Bilder sollten scharf, leicht und privat sein. Image Prep skaliert auf gängige Presets, komprimiert JPEG/WebP/PNG und entfernt Kamera-/GPS-EXIF — Dateien bleiben auf Ihrem Gerät, bis Sie das Ergebnis herunterladen.

Es liegt in unserem [Software-Bereich](/#software) als **Image Prep**. Das Cover zeigt die Image Prep Tool-UI der Software-Karte.

## Live-Demo öffnen

**[→ Image Prep starten](/tools/image-prep)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Auf dem Gerät bleiben** — kein Upload auf einen unbekannten Server für schnelles Resize
- **Web-ready Presets** — Portfolio- und Site-Größen ohne Photoshop-Gymnastik
- **Datenschutz standardmäßig** — EXIF entfernen, damit GPS und Kamerametadaten nicht leaken
- **Weniger Gewicht, gleiche Story** — komprimieren für schnellere Seiten und leisere CDN-Rechnungen

Typische Einsätze: Hero-Stills vorbereiten, Galerie-Uploads, CRM/Blog-Covers und Kunden-Handoff-Pakete vor CMS oder Demo-Seite.

## Für Einsteiger — was ist das, in einfachen Worten?

Bevor ein Foto auf eine Website kommt, braucht es meist drei Gefallen: die richtige Pixelgröße, eine kleinere Datei und weniger persönliche Daten im Header. Image Prep erledigt das im Browser — Bild reinziehen, Preset wählen, saubere Version herunterladen.

**Kurzes Glossar**

- **EXIF** — Metadaten, die Kameras einbetten (Einstellungen, Zeitstempel, manchmal GPS)
- **Komprimieren** — Dateigröße reduzieren, oft mit Qualitätsregler
- **WebP** — modernes Bildformat, oft kleiner als JPEG bei ähnlicher Qualität
- **On-device** — Verarbeitung im Browser; Sie entscheiden, wann heruntergeladen wird

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie [Image Prep](/tools/image-prep)
2. Ziehen Sie ein JPG oder PNG von Ihrem Rechner rein
3. Wählen Sie ein Resize-Preset und Format (JPEG / WebP / PNG)
4. EXIF-Entfernung aktivieren falls nötig, dann Ergebnis herunterladen

## Anforderungen und Performance

- **Browser:** moderner Chrome, Edge oder Firefox mit Canvas-Unterstützung
- **Datenschutz:** Verarbeitung ist lokal — trotzdem keine Geheimnisse in unrelated Felder einfügen
- **Limits:** extrem große RAWs ggf. zuerst in Desktop-Editor

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Tool-Layout — Quellbild und Prep-Controls](/assets/blog/image-prep/view-a.jpg?v=20260722a)

![Nach Prep — webgerechte Ausgabe zum Download bereit](/assets/blog/image-prep/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Ein paar Portfolio-Stills im Batch auf dasselbe Preset
- WebP exportieren, wenn die Zielsite es unterstützt
- Vor Upload von Covers für Blog- oder CRM-Demo-Posts nutzen

## So funktioniert es

Das Tool nutzt Browser-APIs (Canvas / Bilddekodierung) zum Resize und Re-Encode auf Ihrer Maschine. EXIF-Stripping entfernt eingebettete Metadaten, damit veröffentlichte Dateien nicht versehentlich GPS oder Seriennummern tragen. Formathintergrund: [MDN — Using files from web applications](https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications) und [EXIF — Wikipedia](https://en.wikipedia.org/wiki/Exif).

## FAQ

**Laden meine Fotos auf IOM-Server hoch?**  
Nein bei normaler Prep — Arbeit bleibt im Browser bis zum Download. Nutzen Sie diesen Download als Datei zum Veröffentlichen.

**Sieht die Qualität schlechter aus?**  
Kompression tauscht immer Größe gegen Treue. Starten Sie mit hohem Qualitäts-Preset; nur runterdrehen, wenn die Datei noch schwer ist.

## Tech-Stack und weiterführende Links

- [Image Prep Tool](/tools/image-prep)
- [EXIF — Wikipedia](https://en.wikipedia.org/wiki/Exif)
- [WebP — Google developers](https://developers.google.com/speed/webp)
- [File API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/File_API)

## Verwandt bei IOM

Mehr in [Software](/#software), plus [3D Viewer](/blog/3d-viewer), [360° Panorama Tour Editor](/blog/panorama-360-tour), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$Image Prep — Größe ändern, komprimieren und EXIF im Browser entfernen — IOM$iom$,
  $iom$Portfolio- und Web-Bilder sollten scharf, leicht und privat sein. Image Prep skaliert auf gängige Presets, komprimiert JPEG/WebP/PNG und entfernt Kamera-/GPS-EXIF — Dateien bleiben$iom$
from public.blog_posts p
where p.slug = $iom$image-prep$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$Image Prep — redimensionner, compresser et retirer EXIF dans le navigateur$iom$,
  $iom$Les images portfolio et web doivent être nettes, légères et privées. Image Prep redimensionne aux presets courants, compresse JPEG/WebP/PNG et retire EXIF caméra/GPS — les fichiers$iom$,
  $iom$Les images portfolio et web doivent être nettes, légères et privées. Image Prep redimensionne aux presets courants, compresse JPEG/WebP/PNG et retire EXIF caméra/GPS — les fichiers restent sur votre appareil jusqu’au téléchargement.

Il se trouve dans notre [section Logiciel](/#software) sous **Image Prep**. La couverture montre l’UI outil Image Prep de la carte logiciel.

## Ouvrir la démo en direct

**[→ Lancer Image Prep](/tools/image-prep)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Rester on-device** — pas d’upload sur un serveur inconnu pour un resize rapide
- **Presets web-ready** — tailles portfolio et site sans acrobaties Photoshop
- **Confidentialité par défaut** — retirer EXIF pour ne pas fuiter GPS et métadonnées caméra
- **Moins de poids, même histoire** — compresser pour pages plus rapides et factures CDN plus légères

Usages typiques : préparer stills hero, uploads galerie, couvertures CRM/blog et packs remise client avant CMS ou page demo.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Avant qu’une photo aille sur un site, elle a souvent besoin de trois services : la bonne taille en pixels, un fichier plus petit, moins de données personnelles dans l’en-tête. Image Prep le fait dans le navigateur — glisser une image, choisir un preset, télécharger une version plus propre.

**Glossaire rapide**

- **EXIF** — métadonnées embarquées par les appareils (réglages, horodatage, parfois GPS)
- **Compresser** — réduire la taille fichier, souvent avec curseur qualité
- **WebP** — format image moderne souvent plus petit que JPEG à qualité similaire
- **On-device** — traitement dans le navigateur ; vous choisissez quand télécharger

## Essayez en environ 60 secondes

1. Ouvrir [Image Prep](/tools/image-prep)
2. Déposer un JPG ou PNG depuis votre machine
3. Choisir preset resize et format (JPEG / WebP / PNG)
4. Activer retrait EXIF si besoin, puis télécharger le résultat

## Prérequis et performances

- **Navigateur :** Chrome, Edge ou Firefox moderne avec support canvas
- **Confidentialité :** traitement local — éviter de coller des secrets ailleurs
- **Limites :** très gros RAW peuvent nécessiter un premier passage éditeur desktop

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Disposition outil — image source et contrôles prep](/assets/blog/image-prep/view-a.jpg?v=20260722a)

![Après prep — sortie taille web prête à télécharger](/assets/blog/image-prep/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Traiter en lot quelques stills portfolio au même preset
- Exporter WebP si le site destination le supporte
- Utiliser avant upload de couvertures pour posts blog ou demo CRM

## Comment ça marche

L’outil utilise les APIs navigateur (canvas / décodage image) pour resize et ré-encoder sur votre machine. Le retrait EXIF supprime les métadonnées embarquées pour que les fichiers publiés ne portent pas GPS ou numéros de série par accident. Contexte format : [MDN — Using files from web applications](https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications) et [EXIF — Wikipedia](https://en.wikipedia.org/wiki/Exif).

## FAQ

**Mes photos sont-elles uploadées sur les serveurs IOM ?**  
Non en prep normale — le travail reste dans le navigateur jusqu’au téléchargement.

**La qualité sera-t-elle dégradée ?**  
La compression échange toujours taille et fidélité. Commencez haute qualité ; baissez seulement si le fichier reste lourd.

## Stack technique et lectures

- [Outil Image Prep](/tools/image-prep)
- [EXIF — Wikipedia](https://en.wikipedia.org/wiki/Exif)
- [WebP — Google developers](https://developers.google.com/speed/webp)
- [File API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/File_API)

## Sur IOM

Parcourez [Logiciel](/#software), plus [3D Viewer](/blog/3d-viewer), [360° Panorama Tour Editor](/blog/panorama-360-tour), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$Image Prep — redimensionner, compresser et retirer EXIF dans le navigateur — IOM$iom$,
  $iom$Les images portfolio et web doivent être nettes, légères et privées. Image Prep redimensionne aux presets courants, compresse JPEG/WebP/PNG et retire EXIF caméra/GPS — les fichiers$iom$
from public.blog_posts p
where p.slug = $iom$image-prep$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$Image Prep — formaat wijzigen, comprimeren en EXIF verwijderen in de browser$iom$,
  $iom$Portfolio- en webafbeeldingen moeten scherp, licht en privé zijn. Image Prep schaalt naar gangbare presets, comprimeert JPEG/WebP/PNG en verwijdert camera-/GPS-EXIF — bestanden bli$iom$,
  $iom$Portfolio- en webafbeeldingen moeten scherp, licht en privé zijn. Image Prep schaalt naar gangbare presets, comprimeert JPEG/WebP/PNG en verwijdert camera-/GPS-EXIF — bestanden blijven op uw apparaat tot u het resultaat downloadt.

Het staat in onze [Software-sectie](/#software) als **Image Prep**. De cover toont de Image Prep-tool-UI van de softwarekaart.

## Open de live demo

**[→ Start Image Prep](/tools/image-prep)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Op apparaat blijven** — geen upload naar een onbekende server voor een snelle resize
- **Web-ready presets** — portfolio- en siteformaten zonder Photoshop-gymnastiek
- **Privacy standaard** — EXIF verwijderen zodat GPS en camerametadata niet lekken
- **Minder gewicht, zelfde verhaal** — comprimeren voor snellere pagina's en stillere CDN-facturen

Typische toepassingen: hero-stills voorbereiden, galerij-uploads, CRM/blog-covers en klantoverdrachtspakketten vóór ze een CMS of demopagina raken.

## Voor beginners — wat is dit, in gewone taal?

Voordat een foto op een website komt, heeft die meestal drie gunsten nodig: de juiste pixelgrootte, een kleiner bestand en minder persoonlijke data in de header. Image Prep doet dat in de browser — sleep een afbeelding erin, kies een preset, download een schonere versie.

**Korte glossary**

- **EXIF** — metadata die camera's insluiten (instellingen, tijdstempels, soms GPS)
- **Comprimeren** — bestandsgrootte verkleinen, vaak met een kwaliteitsschuif
- **WebP** — een modern beeldformaat dat vaak kleiner is dan JPEG bij vergelijkbare kwaliteit
- **On-device** — verwerking gebeurt in uw browser; u kiest wanneer u downloadt

## Probeer dit in ongeveer 60 seconden

1. Open [Image Prep](/tools/image-prep)
2. Sleep een JPG of PNG van uw machine erin
3. Kies een resize-preset en formaat (JPEG / WebP / PNG)
4. Schakel EXIF-verwijdering in indien nodig, download daarna het resultaat

## Vereisten en performance

- **Browser:** moderne Chrome, Edge of Firefox met canvas-ondersteuning
- **Privacy:** verwerking is lokaal — vermijd toch geheimen in andere velden plakken
- **Limieten:** extreem grote RAW's kunnen eerst een pass in een desktop-editor vereisen

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Toollayout — bronafbeelding en prep-bediening](/assets/blog/image-prep/view-a.jpg?v=20260722a)

![Na prep — webformaat output klaar om te downloaden](/assets/blog/image-prep/view-b.jpg?v=20260722a)

Ook in deze build:

- Een paar portfolio-stills in batch naar hetzelfde preset
- WebP exporteren wanneer de bestemmingssite het ondersteunt
- Gebruiken vóór upload van covers voor blog- of CRM-demoposts

## Hoe het werkt

De tool gebruikt browser-API's (canvas / beelddecodering) om op uw machine te schalen en opnieuw te encoderen. EXIF-stripping verwijdert ingesloten metadata zodat gepubliceerde bestanden per ongeluk geen GPS of cameraserienummers meedragen. Formaachtergrond: [MDN — Using files from web applications](https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications) en [EXIF — Wikipedia](https://en.wikipedia.org/wiki/Exif).

## FAQ

**Worden mijn foto's geüpload naar IOM-servers?**  
Nee bij normale prep — werk blijft in de browser tot u downloadt. Gebruik die download als het bestand dat u elders publiceert.

**Wordt de kwaliteit slechter?**  
Compressie wisselt altijd grootte voor trouw. Begin met een hoog-kwaliteitspreset; verlaag alleen als het bestand nog zwaar is.

## Tech stack en verder lezen

- [Image Prep-tool](/tools/image-prep)
- [EXIF — Wikipedia](https://en.wikipedia.org/wiki/Exif)
- [WebP — Google developers](https://developers.google.com/speed/webp)
- [File API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/File_API)

## Gerelateerd op IOM

Bekijk meer in [Software](/#software), plus [3D Viewer](/blog/3d-viewer), [360° Panorama Tour Editor](/blog/panorama-360-tour), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$Image Prep — formaat wijzigen, comprimeren en EXIF verwijderen in de browser — IOM$iom$,
  $iom$Portfolio- en webafbeeldingen moeten scherp, licht en privé zijn. Image Prep schaalt naar gangbare presets, comprimeert JPEG/WebP/PNG en verwijdert camera-/GPS-EXIF — bestanden bli$iom$
from public.blog_posts p
where p.slug = $iom$image-prep$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$Image Prep — ridimensiona, comprimi e rimuovi EXIF nel browser$iom$,
  $iom$Le immagini portfolio e web devono essere nitide, leggere e private. Image Prep ridimensiona ai preset comuni, comprime JPEG/WebP/PNG e rimuove EXIF camera/GPS — i file restano sul$iom$,
  $iom$Le immagini portfolio e web devono essere nitide, leggere e private. Image Prep ridimensiona ai preset comuni, comprime JPEG/WebP/PNG e rimuove EXIF camera/GPS — i file restano sul dispositivo finché non scarichi il risultato.

Si trova nella nostra [sezione Software](/#software) come **Image Prep**. La cover mostra l'UI tool Image Prep dalla card software.

## Apri la demo live

**[→ Avvia Image Prep](/tools/image-prep)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Resta on-device** — nessun upload su server sconosciuto per un resize rapido
- **Preset web-ready** — dimensioni portfolio e sito senza acrobazie Photoshop
- **Privacy by default** — rimuovi EXIF così GPS e metadati camera non trapelano
- **Meno peso, stessa storia** — comprimi per pagine più veloci e fatture CDN più leggere

Usi tipici: preparare still hero, upload galleria, cover CRM/blog e pacchetti consegna client prima che arrivino a CMS o pagina demo.

## Per principianti — cos’è, in parole semplici?

Prima che una foto vada su un sito, di solito ha bisogno di tre favori: la giusta dimensione pixel, un file più piccolo e meno dati personali nell'header. Image Prep li fa nel browser — trascina un'immagine, scegli un preset, scarica una versione più pulita.

**Glossario rapido**

- **EXIF** — metadati che le fotocamere incorporano (impostazioni, timestamp, a volte GPS)
- **Comprimere** — ridurre dimensione file, spesso con slider qualità
- **WebP** — formato immagine moderno spesso più piccolo del JPEG a qualità simile
- **On-device** — elaborazione nel browser; scegli tu quando scaricare

## Provalo in circa 60 secondi

1. Apri [Image Prep](/tools/image-prep)
2. Trascina un JPG o PNG dal tuo computer
3. Scegli preset resize e formato (JPEG / WebP / PNG)
4. Abilita rimozione EXIF se serve, poi scarica il risultato

## Requisiti e prestazioni

- **Browser:** Chrome, Edge o Firefox moderni con supporto canvas
- **Privacy:** elaborazione locale — evita comunque di incollare segreti altrove
- **Limiti:** RAW molto grandi possono richiedere un primo passaggio in editor desktop

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Layout tool — immagine sorgente e controlli prep](/assets/blog/image-prep/view-a.jpg?v=20260722a)

![Dopo prep — output web-ready pronto da scaricare](/assets/blog/image-prep/view-b.jpg?v=20260722a)

Anche in questa build:

- Elaborare in batch alcuni still portfolio allo stesso preset
- Esportare WebP quando il sito destinazione lo supporta
- Usare prima di caricare cover per post blog o demo CRM

## Come funziona

Il tool usa API browser (canvas / decodifica immagine) per ridimensionare e ricodificare sulla tua macchina. La rimozione EXIF elimina metadati incorporati così i file pubblicati non portano GPS o seriali camera per sbaglio. Background formati: [MDN — Using files from web applications](https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications) e [EXIF — Wikipedia](https://en.wikipedia.org/wiki/Exif).

## FAQ

**Le mie foto vengono caricate sui server IOM?**  
No in prep normale — il lavoro resta nel browser finché non scarichi. Usa quel download come file da pubblicare altrove.

**La qualità peggiorerà?**  
La compressione scambia sempre dimensione e fedeltà. Parti da preset alta qualità; abbassa solo se il file resta pesante.

## Stack tecnico e letture

- [Tool Image Prep](/tools/image-prep)
- [EXIF — Wikipedia](https://en.wikipedia.org/wiki/Exif)
- [WebP — Google developers](https://developers.google.com/speed/webp)
- [File API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/File_API)

## Correlati su IOM

Esplora di più in [Software](/#software), più [3D Viewer](/blog/3d-viewer), [360° Panorama Tour Editor](/blog/panorama-360-tour), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$Image Prep — ridimensiona, comprimi e rimuovi EXIF nel browser — IOM$iom$,
  $iom$Le immagini portfolio e web devono essere nitide, leggere e private. Image Prep ridimensiona ai preset comuni, comprime JPEG/WebP/PNG e rimuove EXIF camera/GPS — i file restano sul$iom$
from public.blog_posts p
where p.slug = $iom$image-prep$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$Image Prep — redimensionar, comprimir y eliminar EXIF en el navegador$iom$,
  $iom$Las imágenes de portfolio y web deben ser nítidas, ligeras y privadas. Image Prep redimensiona a presets habituales, comprime JPEG/WebP/PNG y elimina EXIF de cámara/GPS — los archi$iom$,
  $iom$Las imágenes de portfolio y web deben ser nítidas, ligeras y privadas. Image Prep redimensiona a presets habituales, comprime JPEG/WebP/PNG y elimina EXIF de cámara/GPS — los archivos permanecen en tu dispositivo hasta que descargues el resultado.

Está en nuestra [sección Software](/#software) como **Image Prep**. La portada muestra la UI de la herramienta Image Prep de la tarjeta de software.

## Abrir la demo en vivo

**[→ Lanzar Image Prep](/tools/image-prep)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Permanecer on-device** — sin subir a un servidor desconocido para un resize rápido
- **Presets web-ready** — tamaños portfolio y sitio sin acrobacias de Photoshop
- **Privacidad por defecto** — eliminar EXIF para que GPS y metadatos de cámara no filtren
- **Menos peso, misma historia** — comprimir para páginas más rápidas y facturas CDN más ligeras

Usos típicos: preparar stills hero, subidas de galería, portadas CRM/blog y paquetes de entrega al cliente antes de llegar a un CMS o página demo.

## Para principiantes — ¿qué es esto, en palabras simples?

Antes de que una foto vaya a un sitio web, suele necesitar tres favores: el tamaño de píxeles correcto, un archivo más pequeño y menos datos personales en la cabecera. Image Prep los hace en el navegador — arrastra una imagen, elige un preset, descarga una versión más limpia.

**Glosario rápido**

- **EXIF** — metadatos que las cámaras incrustan (ajustes, marcas de tiempo, a veces GPS)
- **Comprimir** — reducir tamaño de archivo, a menudo con control de calidad
- **WebP** — formato de imagen moderno a menudo más pequeño que JPEG a calidad similar
- **On-device** — el procesamiento ocurre en tu navegador; tú eliges cuándo descargar

## Pruébalo en unos 60 segundos

1. Abre [Image Prep](/tools/image-prep)
2. Suelta un JPG o PNG de tu máquina
3. Elige un preset de resize y formato (JPEG / WebP / PNG)
4. Activa eliminación EXIF si hace falta, luego descarga el resultado

## Requisitos y rendimiento

- **Navegador:** Chrome, Edge o Firefox modernos con soporte canvas
- **Privacidad:** procesamiento local — evita pegar secretos en otros campos
- **Límites:** RAW extremadamente grandes pueden necesitar un primer paso en editor desktop

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Layout de herramienta — imagen fuente y controles prep](/assets/blog/image-prep/view-a.jpg?v=20260722a)

![Tras prep — salida web-ready lista para descargar](/assets/blog/image-prep/view-b.jpg?v=20260722a)

También en este build:

- Procesar en lote algunos stills de portfolio al mismo preset
- Exportar WebP cuando el sitio destino lo soporte
- Usar antes de subir portadas para posts de blog o demo CRM

## Cómo funciona

La herramienta usa APIs del navegador (canvas / decodificación de imagen) para redimensionar y recodificar en tu máquina. La eliminación EXIF quita metadatos incrustados para que los archivos publicados no lleven GPS o números de serie de cámara por accidente. Contexto de formatos: [MDN — Using files from web applications](https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications) y [EXIF — Wikipedia](https://en.wikipedia.org/wiki/Exif).

## FAQ

**¿Mis fotos se suben a servidores IOM?**  
No en prep normal — el trabajo permanece en el navegador hasta que descargues. Usa esa descarga como el archivo que publicas en otro sitio.

**¿Empeorará la calidad?**  
La compresión siempre intercambia tamaño por fidelidad. Empieza con preset de alta calidad; baja solo si el archivo sigue pesado.

## Stack técnico y lecturas

- [Herramienta Image Prep](/tools/image-prep)
- [EXIF — Wikipedia](https://en.wikipedia.org/wiki/Exif)
- [WebP — Google developers](https://developers.google.com/speed/webp)
- [File API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/File_API)

## Relacionado en IOM

Explora más en [Software](/#software), más [3D Viewer](/blog/3d-viewer), [360° Panorama Tour Editor](/blog/panorama-360-tour), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$Image Prep — redimensionar, comprimir y eliminar EXIF en el navegador — IOM$iom$,
  $iom$Las imágenes de portfolio y web deben ser nítidas, ligeras y privadas. Image Prep redimensiona a presets habituales, comprime JPEG/WebP/PNG y elimina EXIF de cámara/GPS — los archi$iom$
from public.blog_posts p
where p.slug = $iom$image-prep$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$Raven Path Animation — spline flight in the browser$iom$,
  $iom$Animate a raven (or your own GLB) along an editable spline — export path JSON for other software, reimport next visit, and tune timing in the browser.$iom$,
  $iom$Sometimes the story is the motion, not the still. Raven Path puts a winged GLB on a Catmull-Rom spline — drag control points, tune speed and easing, reverse the route, and keep wing-flap animation playing while the bird follows the path.

It lives in our [3D section](/#3d) as **Raven Path Animation**. The cover shows the raven on its editable flight path.

## Open the live demo

**[→ Launch Raven Path Animation](/demos/raven-path/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Path as a design tool** — reshape the flight with visible control points
- **Bring your own model** — import GLB, GLTF, or FBX onto the same path
- **Export & reimport the path** — JSON for other software or your next session
- **Timing you can feel** — speed, ease-in/out, reverse, and tangent vs fixed heading

Typical uses: hero loops for brand films, booth attract loops, narrative web chapters, prototyping creature or product “travel” paths before a full animation pass, and handing a reusable path JSON to other pipelines.

## For beginners — what is this, in plain words?

A spline is a smooth curve defined by a few handles — like a flexible wire in space. Here a raven (or your imported model) rides that wire. You pull the handles, and the flight updates live. No video edit; the path is the edit. When you like the route, export it as JSON and load it again later — or use the points in other tools.

**Quick glossary**

- **Catmull-Rom spline** — a smooth curve that passes through control points ([Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline))
- **GLB / GLTF / FBX** — common 3D model formats you can import onto the path
- **Path JSON** — exported control points (and options) you can reimport on the site or use elsewhere
- **Tangent-aligned** — the model turns to face along the path direction
- **Skeletal animation** — bones drive secondary motion (like wing flaps) while the root follows the curve

## Try this in about 60 seconds

1. Open the [Raven Path demo](/demos/raven-path/)
2. Watch one lap, then drag a spline control point and see the route reshape
3. In **Path**: **Export path JSON**, then **Import path JSON** (or drag the file onto the scene)
4. Optional: **Import GLB / GLTF / FBX**, then tune speed, ease, reverse, or tangent orientation

## Requirements and performance

- **Browser:** modern Chrome, Edge, or Firefox with WebGL
- **GPU:** integrated graphics are usually enough for this scene
- **Input:** mouse or trackpad makes point editing easier than a phone
- **Files:** prefer self-contained GLB for models; path files are JSON

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Wide path view — curve and raven in one frame](/assets/blog/raven-path/view-a.jpg?v=20260722a)

![Closer flight — wing pose along the spline](/assets/blog/raven-path/view-b.jpg?v=20260722a)

Also in this build:

- Copy the THREE.Vector3 snippet from the Path panel for custom Three.js tools
- Compare with the related [spline editor](/demos/spline-editor/) experiment
- Study curve modifiers in the [WebGPU curve demo](/demos/webgpu-modifier-curve/)
- Reuse the path idea for product “tours” or camera fly-throughs

## How it works

The demo uses [Three.js](https://threejs.org/) to sample a Catmull-Rom curve each frame, place the model root on that sample, and optionally align its forward axis to the curve tangent while a skeletal clip (when present) drives secondary motion. Path JSON stores control points, closed-loop, and path transform so you can reimport on the [live demo](/demos/raven-path/) or feed the points into other software. Same family of ideas as three.js curve and animation examples — tuned here for a readable creature loop with import and export.

## FAQ

**Can we swap the raven for our mascot?**  
Yes — use **Import GLB / GLTF / FBX** in the demo to try your model on the path right away. For a branded production build, ask us for a scoped version.

**How do I reuse a path later or in other software?**  
Use **Export path JSON** in the Path panel. Reimport that file next time on the site, or use the `points` / `threeJsSnippet` fields in Blender, Three.js, or your own tools.

**Is this video or realtime?**  
Realtime WebGL. You can screen-record or export elsewhere, but the demo itself is a live scene.

## Tech stack and further reading

- [Raven Path demo](/demos/raven-path/)
- [Three.js](https://threejs.org/)
- [Catmull–Rom spline — Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
- [Spline editor (related)](/demos/spline-editor/)

## Related on IOM

Browse more in [3D](/#3d), plus [Volumetric Lighting](/blog/volume-lighting), [Dream — Ocean scroll](/blog/iom-three), [Three.js Ocean](/blog/threejs-ocean), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$Raven Path Animation — spline flight & path export — IOM$iom$,
  $iom$Try IOM’s Raven Path demo: editable Catmull-Rom flight, GLB/GLTF/FBX import, path JSON export/reimport, and a beginner walkthrough in the 3D section.$iom$
from public.blog_posts p
where p.slug = $iom$raven-path$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$Raven Path Animation — Spline-Flug im Browser$iom$,
  $iom$Animieren Sie einen Raben (oder Ihr eigenes GLB) entlang einer editierbaren Spline — exportieren Sie Pfad-JSON für andere Software, importieren Sie beim nächsten Besuch erneut und justieren Sie Timing im Browser.$iom$,
  $iom$Manchmal ist die Geschichte die Bewegung, nicht das Standbild. Raven Path setzt ein geflügeltes GLB auf eine Catmull-Rom-Spline — Kontrollpunkte ziehen, Geschwindigkeit und Easing feinjustieren, die Route umkehren und Flügelschlag-Animation laufen lassen, während der Vogel dem Pfad folgt.

Es liegt in unserem [3D-Bereich](/#3d) als **Raven Path Animation**. Das Cover zeigt den Raben auf seinem editierbaren Flugpfad.

## Live-Demo öffnen

**[→ Raven Path Animation starten](/demos/raven-path/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Pfad als Designtool** — Flug mit sichtbaren Kontrollpunkten neu formen
- **Eigenes Modell mitbringen** — GLB, GLTF oder FBX auf denselben Pfad importieren
- **Pfad exportieren & reimportieren** — JSON für andere Software oder Ihre nächste Session
- **Timing, das man spürt** — Geschwindigkeit, Ease-in/out, Reverse und Tangente vs. feste Ausrichtung

Typische Einsätze: Hero-Loops für Brand-Filme, Messe-Attract-Loops, narrative Web-Kapitel, Prototyping von Kreatur- oder Produkt-„Reise“-Pfaden vor einem vollen Animationspass und Weitergabe wiederverwendbarer Pfad-JSON an andere Pipelines.

## Für Einsteiger — was ist das, in einfachen Worten?

Eine Spline ist eine glatte Kurve, definiert durch wenige Griffe — wie ein flexibler Draht im Raum. Hier reitet ein Rabe (oder Ihr importiertes Modell) auf diesem Draht. Sie ziehen die Griffe, und der Flug aktualisiert sich live. Kein Videoschnitt; der Pfad ist der Schnitt. Wenn Ihnen die Route gefällt, exportieren Sie sie als JSON und laden sie später erneut — oder nutzen Sie die Punkte in anderen Tools.

**Kurzes Glossar**

- **Catmull-Rom spline** — eine glatte Kurve, die durch Kontrollpunkte verläuft ([Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline))
- **GLB / GLTF / FBX** — gängige 3D-Modellformate, die Sie auf den Pfad importieren können
- **Path JSON** — exportierte Kontrollpunkte (und Optionen), die Sie auf der Site reimportieren oder anderswo nutzen können
- **Tangent-aligned** — das Modell dreht sich entlang der Pfadrichtung
- **Skeletal animation** — Knochen treiben Sekundärbewegung (wie Flügelschlag), während die Wurzel der Kurve folgt

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [Raven Path Demo](/demos/raven-path/)
2. Schauen Sie eine Runde zu, ziehen Sie dann einen Spline-Kontrollpunkt und sehen Sie, wie sich die Route neu formt
3. Unter **Path**: **Export path JSON**, dann **Import path JSON** (oder Datei auf die Szene ziehen)
4. Optional: **Import GLB / GLTF / FBX**, dann Geschwindigkeit, Ease, Reverse oder Tangenten-Ausrichtung justieren

## Anforderungen und Performance

- **Browser:** moderner Chrome, Edge oder Firefox mit WebGL
- **GPU:** integrierte Grafik reicht für diese Szene meist aus
- **Input:** Maus oder Trackpad erleichtert Punktbearbeitung gegenüber dem Handy
- **Dateien:** bevorzugen Sie selbstständige GLB für Modelle; Pfaddateien sind JSON

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Weite Pfadansicht — Kurve und Rabe in einem Frame](/assets/blog/raven-path/view-a.jpg?v=20260722a)

![Näherer Flug — Flügelpose entlang der Spline](/assets/blog/raven-path/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- THREE.Vector3-Snippet aus dem Path-Panel für eigene Three.js-Tools kopieren
- Mit dem verwandten [Spline-Editor](/demos/spline-editor/)-Experiment vergleichen
- Kurvenmodifikatoren in der [WebGPU Curve Demo](/demos/webgpu-modifier-curve/) studieren
- Die Pfad-Idee für Produkt-„Touren“ oder Kamera-Fly-throughs wiederverwenden

## So funktioniert es

Die Demo nutzt [Three.js](https://threejs.org/), um pro Frame eine Catmull-Rom-Kurve zu sampeln, die Modellwurzel auf dieses Sample zu setzen und optional die Vorwärtsachse an die Kurventangente auszurichten, während ein Skelett-Clip (wenn vorhanden) Sekundärbewegung antreibt. Path JSON speichert Kontrollpunkte, geschlossene Schleife und Pfadtransform, damit Sie auf der [Live-Demo](/demos/raven-path/) reimportieren oder die Punkte in andere Software einspeisen können. Dieselbe Ideenfamilie wie three.js Kurven- und Animationsbeispiele — hier abgestimmt auf eine lesbare Kreatur-Schleife mit Import und Export.

## FAQ

**Können wir den Raben durch unser Maskottchen ersetzen?**  
Ja — nutzen Sie **Import GLB / GLTF / FBX** in der Demo, um Ihr Modell sofort auf dem Pfad zu testen. Für einen gebrandeten Produktionsbuild fragen Sie uns nach einer scoped Version.

**Wie nutze ich einen Pfad später oder in anderer Software wieder?**  
Nutzen Sie **Export path JSON** im Path-Panel. Importieren Sie die Datei beim nächsten Mal auf der Site erneut, oder nutzen Sie die Felder `points` / `threeJsSnippet` in Blender, Three.js oder eigenen Tools.

**Ist das Video oder Echtzeit?**  
Echtzeit-WebGL. Sie können screen-recorden oder anderswo exportieren, aber die Demo selbst ist eine Live-Szene.

## Tech-Stack und weiterführende Links

- [Raven Path Demo](/demos/raven-path/)
- [Three.js](https://threejs.org/)
- [Catmull–Rom spline — Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
- [Spline-Editor (verwandt)](/demos/spline-editor/)

## Verwandt bei IOM

Mehr in [3D](/#3d), plus [Volumetric Lighting](/blog/volume-lighting), [Dream — Ocean scroll](/blog/iom-three), [Three.js Ocean](/blog/threejs-ocean), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$Raven Path Animation — Spline-Flug & Pfad-Export — IOM$iom$,
  $iom$Testen Sie IOMs Raven-Path-Demo: editierbarer Catmull-Rom-Flug, GLB/GLTF/FBX-Import, Pfad-JSON-Export/Reimport und Einsteiger-Walkthrough im 3D-Bereich.$iom$
from public.blog_posts p
where p.slug = $iom$raven-path$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$Raven Path Animation — vol spline dans le navigateur$iom$,
  $iom$Animez un corbeau (ou votre propre GLB) le long d'une spline éditable — exportez le JSON du chemin pour d'autres logiciels, réimportez à la prochaine visite et ajustez le timing dans le navigateur.$iom$,
  $iom$Parfois, l'histoire, c'est le mouvement, pas l'image fixe. Raven Path place un GLB ailé sur une spline Catmull-Rom — faites glisser les points de contrôle, réglez vitesse et easing, inversez la route et laissez l'animation de battement d'ailes jouer pendant que l'oiseau suit le chemin.

Il se trouve dans notre [section 3D](/#3d) sous **Raven Path Animation**. La couverture montre le corbeau sur son chemin de vol éditable.

## Ouvrir la démo en direct

**[→ Lancer Raven Path Animation](/demos/raven-path/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Le chemin comme outil de design** — remodeler le vol avec des points de contrôle visibles
- **Apportez votre modèle** — importez GLB, GLTF ou FBX sur le même chemin
- **Exporter et réimporter le chemin** — JSON pour d'autres logiciels ou votre prochaine session
- **Un timing ressenti** — vitesse, ease-in/out, reverse et tangente vs cap fixe

Usages typiques : boucles hero pour films de marque, attract loops de stand, chapitres web narratifs, prototypage de chemins de « voyage » créature ou produit avant une passe d'animation complète, et transmission d'un JSON de chemin réutilisable à d'autres pipelines.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Une spline est une courbe lisse définie par quelques poignées — comme un fil flexible dans l'espace. Ici, un corbeau (ou votre modèle importé) chevauche ce fil. Vous tirez les poignées, et le vol se met à jour en direct. Pas de montage vidéo ; le chemin est le montage. Quand la route vous convient, exportez-la en JSON et rechargez-la plus tard — ou utilisez les points dans d'autres outils.

**Glossaire rapide**

- **Catmull-Rom spline** — une courbe lisse passant par les points de contrôle ([Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline))
- **GLB / GLTF / FBX** — formats de modèles 3D courants importables sur le chemin
- **Path JSON** — points de contrôle exportés (et options) réimportables sur le site ou utilisables ailleurs
- **Tangent-aligned** — le modèle s'oriente le long de la direction du chemin
- **Skeletal animation** — les os pilotent le mouvement secondaire (comme le battement d'ailes) pendant que la racine suit la courbe

## Essayez en environ 60 secondes

1. Ouvrez la [démo Raven Path](/demos/raven-path/)
2. Regardez un tour, puis faites glisser un point de contrôle de la spline et voyez la route se remodeler
3. Dans **Path** : **Export path JSON**, puis **Import path JSON** (ou glissez le fichier sur la scène)
4. Optionnel : **Import GLB / GLTF / FBX**, puis réglez vitesse, ease, reverse ou orientation tangente

## Prérequis et performances

- **Navigateur :** Chrome, Edge ou Firefox moderne avec WebGL
- **GPU :** graphiques intégrés suffisent généralement pour cette scène
- **Saisie :** souris ou trackpad facilitent l'édition de points vs téléphone
- **Fichiers :** privilégiez GLB autonome pour les modèles ; les fichiers de chemin sont en JSON

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Vue large du chemin — courbe et corbeau dans un même cadre](/assets/blog/raven-path/view-a.jpg?v=20260722a)

![Vol rapproché — pose d'aile le long de la spline](/assets/blog/raven-path/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Copier l'extrait THREE.Vector3 du panneau Path pour vos outils Three.js
- Comparer avec l'expérience [éditeur de spline](/demos/spline-editor/) associée
- Étudier les modificateurs de courbe dans la [démo WebGPU curve](/demos/webgpu-modifier-curve/)
- Réutiliser l'idée de chemin pour des « tours » produit ou des fly-through caméra

## Comment ça marche

La démo utilise [Three.js](https://threejs.org/) pour échantillonner une courbe Catmull-Rom à chaque frame, placer la racine du modèle sur cet échantillon et, optionnellement, aligner son axe avant sur la tangente de la courbe pendant qu'un clip squelettique (s'il existe) pilote le mouvement secondaire. Path JSON stocke points de contrôle, boucle fermée et transform du chemin pour réimporter sur la [démo live](/demos/raven-path/) ou alimenter d'autres logiciels. Même famille d'idées que les exemples courbes et animation three.js — ici calibrée pour une boucle créature lisible avec import et export.

## FAQ

**Peut-on remplacer le corbeau par notre mascotte ?**  
Oui — utilisez **Import GLB / GLTF / FBX** dans la démo pour tester votre modèle sur le chemin immédiatement. Pour une version de production brandée, demandez-nous une version scoped.

**Comment réutiliser un chemin plus tard ou dans d'autres logiciels ?**  
Utilisez **Export path JSON** dans le panneau Path. Réimportez ce fichier lors d'une prochaine visite sur le site, ou utilisez les champs `points` / `threeJsSnippet` dans Blender, Three.js ou vos propres outils.

**Est-ce de la vidéo ou du temps réel ?**  
WebGL temps réel. Vous pouvez enregistrer l'écran ou exporter ailleurs, mais la démo elle-même est une scène live.

## Stack technique et lectures

- [Démo Raven Path](/demos/raven-path/)
- [Three.js](https://threejs.org/)
- [Spline Catmull–Rom — Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
- [Éditeur de spline (associé)](/demos/spline-editor/)

## Sur IOM

Parcourez [3D](/#3d), plus [Volumetric Lighting](/blog/volume-lighting), [Dream — Ocean scroll](/blog/iom-three), [Three.js Ocean](/blog/threejs-ocean), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$Raven Path Animation — vol spline et export de chemin — IOM$iom$,
  $iom$Essayez la démo Raven Path d'IOM : vol Catmull-Rom éditable, import GLB/GLTF/FBX, export/réimport JSON du chemin et guide débutant dans la section 3D.$iom$
from public.blog_posts p
where p.slug = $iom$raven-path$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$Raven Path Animation — splinevlucht in de browser$iom$,
  $iom$Animeer een raaf (of uw eigen GLB) langs een bewerkbare spline — exporteer pad-JSON voor andere software, importeer bij het volgende bezoek opnieuw en stem timing af in de browser.$iom$,
  $iom$Soms is het verhaal de beweging, niet het stilstaande beeld. Raven Path zet een gevleugeld GLB op een Catmull-Rom-spline — sleep controlepunten, stel snelheid en easing af, keer de route om en laat vleugelklap-animatie spelen terwijl de vogel het pad volgt.

Het staat in onze [3D-sectie](/#3d) als **Raven Path Animation**. De cover toont de raaf op zijn bewerkbare vluchtpad.

## Open de live demo

**[→ Start Raven Path Animation](/demos/raven-path/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Pad als designtool** — vorm de vlucht opnieuw met zichtbare controlepunten
- **Breng uw eigen model mee** — importeer GLB, GLTF of FBX op hetzelfde pad
- **Exporteer & herimporteer het pad** — JSON voor andere software of uw volgende sessie
- **Timing die u voelt** — snelheid, ease-in/out, reverse en tangent vs. vaste heading

Typische toepassingen: hero-loops voor brandfilms, beurs-attract-loops, narratieve webhoofdstukken, prototypen van creatuur- of product-„reis“-paden vóór een volledige animatiepass, en doorgeven van herbruikbare pad-JSON aan andere pipelines.

## Voor beginners — wat is dit, in gewone taal?

Een spline is een vloeiende curve gedefinieerd door enkele handvatten — als een flexibele draad in de ruimte. Hier rijdt een raaf (of uw geïmporteerde model) op die draad. U trekt de handvatten en de vlucht werkt live bij. Geen videobewerking; het pad ís de bewerking. Als de route bevalt, exporteert u als JSON en laadt u later opnieuw — of gebruikt u de punten in andere tools.

**Korte glossary**

- **Catmull-Rom spline** — een vloeiende curve die door controlepunten loopt ([Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline))
- **GLB / GLTF / FBX** — gangbare 3D-modelformaten die u op het pad kunt importeren
- **Path JSON** — geëxporteerde controlepunten (en opties) die u op de site kunt herimporteren of elders gebruiken
- **Tangent-aligned** — het model draait mee langs de padrichting
- **Skeletal animation** — botten sturen secundaire beweging (zoals vleugelslag) terwijl de root de curve volgt

## Probeer dit in ongeveer 60 seconden

1. Open de [Raven Path-demo](/demos/raven-path/)
2. Kijk één ronde mee, sleep dan een spline-controlepunt en zie de route herschikken
3. Onder **Path**: **Export path JSON**, daarna **Import path JSON** (of sleep het bestand op de scène)
4. Optioneel: **Import GLB / GLTF / FBX**, stel dan snelheid, ease, reverse of tangentoriëntatie af

## Vereisten en performance

- **Browser:** moderne Chrome, Edge of Firefox met WebGL
- **GPU:** geïntegreerde grafiek is meestal genoeg voor deze scène
- **Input:** muis of trackpad maakt puntbewerking makkelijker dan telefoon
- **Bestanden:** verkies zelfstandige GLB voor modellen; padbestanden zijn JSON

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Brede padweergave — curve en raaf in één frame](/assets/blog/raven-path/view-a.jpg?v=20260722a)

![Nadere vlucht — vleugelpose langs de spline](/assets/blog/raven-path/view-b.jpg?v=20260722a)

Ook in deze build:

- Kopieer het THREE.Vector3-snippet uit het Path-paneel voor eigen Three.js-tools
- Vergelijk met het gerelateerde [spline-editor](/demos/spline-editor/)-experiment
- Bestudeer curve-modifiers in de [WebGPU curve-demo](/demos/webgpu-modifier-curve/)
- Herbruik het padidee voor product-„tours“ of camera-fly-throughs

## Hoe het werkt

De demo gebruikt [Three.js](https://threejs.org/) om per frame een Catmull-Rom-curve te samplen, de modelroot op dat sample te plaatsen en optioneel de voorwaartse as op de curvetangent uit te lijnen terwijl een skeletclip (indien aanwezig) secundaire beweging aanstuurt. Path JSON slaat controlepunten, gesloten lus en padtransform op zodat u op de [live demo](/demos/raven-path/) kunt herimporteren of de punten in andere software kunt voeden. Dezelfde ideeënfamilie als three.js curve- en animatievoorbeelden — hier afgestemd op een leesbare creatuurloop met import en export.

## FAQ

**Kunnen we de raaf vervangen door onze mascotte?**  
Ja — gebruik **Import GLB / GLTF / FBX** in de demo om uw model meteen op het pad te proberen. Voor een gebrande productieversie vraagt u ons om een scoped versie.

**Hoe hergebruik ik een pad later of in andere software?**  
Gebruik **Export path JSON** in het Path-paneel. Importeer dat bestand de volgende keer op de site opnieuw, of gebruik de velden `points` / `threeJsSnippet` in Blender, Three.js of eigen tools.

**Is dit video of realtime?**  
Realtime WebGL. U kunt screen-recorden of elders exporteren, maar de demo zelf is een live scène.

## Tech stack en verder lezen

- [Raven Path-demo](/demos/raven-path/)
- [Three.js](https://threejs.org/)
- [Catmull–Rom spline — Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
- [Spline-editor (gerelateerd)](/demos/spline-editor/)

## Gerelateerd op IOM

Bekijk meer in [3D](/#3d), plus [Volumetric Lighting](/blog/volume-lighting), [Dream — Ocean scroll](/blog/iom-three), [Three.js Ocean](/blog/threejs-ocean), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$Raven Path Animation — splinevlucht & pad-export — IOM$iom$,
  $iom$Probeer IOMs Raven Path-demo: bewerkbare Catmull-Rom-vlucht, GLB/GLTF/FBX-import, pad-JSON-export/reimport en beginnerswalkthrough in het 3D-gedeelte.$iom$
from public.blog_posts p
where p.slug = $iom$raven-path$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$Raven Path Animation — volo spline nel browser$iom$,
  $iom$Anima un corvo (o il tuo GLB) lungo una spline modificabile — esporta il JSON del percorso per altri software, reimporta alla visita successiva e regola il timing nel browser.$iom$,
  $iom$A volte la storia è il movimento, non il fermo immagine. Raven Path mette un GLB alato su una spline Catmull-Rom — trascina i punti di controllo, regola velocità ed easing, inverti il percorso e mantieni l'animazione del battito d'ali mentre l'uccello segue la traiettoria.

Si trova nella nostra [sezione 3D](/#3d) come **Raven Path Animation**. La cover mostra il corvo sul suo percorso di volo modificabile.

## Apri la demo live

**[→ Avvia Raven Path Animation](/demos/raven-path/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Percorso come strumento di design** — rimodella il volo con punti di controllo visibili
- **Porta il tuo modello** — importa GLB, GLTF o FBX sullo stesso percorso
- **Esporta e reimporta il percorso** — JSON per altri software o la prossima sessione
- **Timing percepibile** — velocità, ease-in/out, reverse e tangente vs. heading fisso

Usi tipici: loop hero per brand film, attract loop per stand, capitoli web narrativi, prototipazione di percorsi di «viaggio» creatura o prodotto prima di un passaggio animazione completo, e consegna di JSON percorso riutilizzabile ad altre pipeline.

## Per principianti — cos’è, in parole semplici?

Una spline è una curva liscia definita da pochi handle — come un filo flessibile nello spazio. Qui un corvo (o il tuo modello importato) percorre quel filo. Tiri gli handle e il volo si aggiorna live. Niente montaggio video; il percorso è il montaggio. Quando la rotta ti convince, esportala in JSON e ricaricala dopo — o usa i punti in altri tool.

**Glossario rapido**

- **Catmull-Rom spline** — una curva liscia che passa per i punti di controllo ([Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline))
- **GLB / GLTF / FBX** — formati modello 3D comuni importabili sul percorso
- **Path JSON** — punti di controllo esportati (e opzioni) reimportabili sul sito o usabili altrove
- **Tangent-aligned** — il modello ruota per guardare lungo la direzione del percorso
- **Skeletal animation** — le ossa guidano il movimento secondario (come il battito d'ali) mentre la root segue la curva

## Provalo in circa 60 secondi

1. Apri la [demo Raven Path](/demos/raven-path/)
2. Guarda un giro, poi trascina un punto di controllo della spline e vedi la rotta ridisegnarsi
3. In **Path**: **Export path JSON**, poi **Import path JSON** (o trascina il file sulla scena)
4. Opzionale: **Import GLB / GLTF / FBX**, poi regola velocità, ease, reverse o orientamento tangente

## Requisiti e prestazioni

- **Browser:** Chrome, Edge o Firefox moderno con WebGL
- **GPU:** grafica integrata di solito basta per questa scena
- **Input:** mouse o trackpad rendono più facile l'editing dei punti rispetto al telefono
- **File:** preferisci GLB autonomo per i modelli; i file percorso sono JSON

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Vista ampia del percorso — curva e corvo in un frame](/assets/blog/raven-path/view-a.jpg?v=20260722a)

![Volo ravvicinato — posa alare lungo la spline](/assets/blog/raven-path/view-b.jpg?v=20260722a)

Anche in questa build:

- Copia lo snippet THREE.Vector3 dal pannello Path per tool Three.js custom
- Confronta con l'esperimento [spline editor](/demos/spline-editor/) correlato
- Studia i modifier di curva nella [demo WebGPU curve](/demos/webgpu-modifier-curve/)
- Riutilizza l'idea percorso per «tour» prodotto o fly-through camera

## Come funziona

La demo usa [Three.js](https://threejs.org/) per campionare una curva Catmull-Rom ogni frame, posizionare la root del modello su quel campione e, opzionalmente, allineare l'asse forward alla tangente della curva mentre una clip scheletrica (se presente) guida il movimento secondario. Path JSON memorizza punti di controllo, loop chiuso e transform del percorso per reimportare sulla [demo live](/demos/raven-path/) o alimentare altri software. Stessa famiglia di idee degli esempi curve e animazione three.js — qui calibrata per un loop creatura leggibile con import ed export.

## FAQ

**Possiamo sostituire il corvo con la nostra mascotte?**  
Sì — usa **Import GLB / GLTF / FBX** nella demo per provare subito il tuo modello sul percorso. Per una build di produzione brandizzata, chiedici una versione scoped.

**Come riuso un percorso dopo o in altri software?**  
Usa **Export path JSON** nel pannello Path. Reimporta quel file alla visita successiva sul sito, o usa i campi `points` / `threeJsSnippet` in Blender, Three.js o i tuoi tool.

**È video o realtime?**  
WebGL realtime. Puoi screen-recordare o esportare altrove, ma la demo stessa è una scena live.

## Stack tecnico e letture

- [Demo Raven Path](/demos/raven-path/)
- [Three.js](https://threejs.org/)
- [Spline Catmull–Rom — Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
- [Spline editor (correlato)](/demos/spline-editor/)

## Correlati su IOM

Esplora di più in [3D](/#3d), più [Volumetric Lighting](/blog/volume-lighting), [Dream — Ocean scroll](/blog/iom-three), [Three.js Ocean](/blog/threejs-ocean), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$Raven Path Animation — volo spline ed export percorso — IOM$iom$,
  $iom$Prova la demo Raven Path di IOM: volo Catmull-Rom modificabile, import GLB/GLTF/FBX, export/reimport JSON del percorso e guida per principianti nella sezione 3D.$iom$
from public.blog_posts p
where p.slug = $iom$raven-path$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$Raven Path Animation — vuelo spline en el navegador$iom$,
  $iom$Anima un cuervo (o tu propio GLB) a lo largo de una spline editable — exporta JSON del camino para otro software, reimporta en la próxima visita y ajusta el timing en el navegador.$iom$,
  $iom$A veces la historia es el movimiento, no la imagen fija. Raven Path coloca un GLB alado en una spline Catmull-Rom — arrastra puntos de control, ajusta velocidad y easing, invierte la ruta y mantén la animación de aleteo mientras el ave sigue el camino.

Está en nuestra [sección 3D](/#3d) como **Raven Path Animation**. La portada muestra al cuervo en su trayectoria de vuelo editable.

## Abrir la demo en vivo

**[→ Lanzar Raven Path Animation](/demos/raven-path/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Camino como herramienta de diseño** — remodela el vuelo con puntos de control visibles
- **Trae tu propio modelo** — importa GLB, GLTF o FBX al mismo camino
- **Exporta y reimporta el camino** — JSON para otro software o tu próxima sesión
- **Timing que se siente** — velocidad, ease-in/out, reverse y tangente vs. rumbo fijo

Usos típicos: bucles hero para films de marca, attract loops de stand, capítulos web narrativos, prototipado de caminos de «viaje» de criatura o producto antes de un pase de animación completo, y entrega de JSON de camino reutilizable a otras pipelines.

## Para principiantes — ¿qué es esto, en palabras simples?

Una spline es una curva suave definida por unos pocos handles — como un alambre flexible en el espacio. Aquí un cuervo (o tu modelo importado) recorre ese alambre. Tiras de los handles y el vuelo se actualiza en directo. Sin edición de vídeo; el camino es la edición. Cuando te guste la ruta, expórtala como JSON y cárgala después — o usa los puntos en otras herramientas.

**Glosario rápido**

- **Catmull-Rom spline** — una curva suave que pasa por los puntos de control ([Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline))
- **GLB / GLTF / FBX** — formatos de modelo 3D habituales importables al camino
- **Path JSON** — puntos de control exportados (y opciones) reimportables en el sitio o usables en otro lugar
- **Tangent-aligned** — el modelo gira para mirar a lo largo de la dirección del camino
- **Skeletal animation** — los huesos impulsan movimiento secundario (como el aleteo) mientras la raíz sigue la curva

## Pruébalo en unos 60 segundos

1. Abre la [demo Raven Path](/demos/raven-path/)
2. Mira una vuelta, luego arrastra un punto de control de la spline y observa cómo se remodela la ruta
3. En **Path**: **Export path JSON**, luego **Import path JSON** (o arrastra el archivo a la escena)
4. Opcional: **Import GLB / GLTF / FBX**, luego ajusta velocidad, ease, reverse u orientación tangente

## Requisitos y rendimiento

- **Navegador:** Chrome, Edge o Firefox moderno con WebGL
- **GPU:** gráficos integrados suelen bastar para esta escena
- **Entrada:** ratón o trackpad facilitan editar puntos frente al móvil
- **Archivos:** prefiere GLB autocontenido para modelos; los archivos de camino son JSON

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Vista amplia del camino — curva y cuervo en un mismo frame](/assets/blog/raven-path/view-a.jpg?v=20260722a)

![Vuelo más cercano — pose de ala a lo largo de la spline](/assets/blog/raven-path/view-b.jpg?v=20260722a)

También en este build:

- Copia el snippet THREE.Vector3 del panel Path para herramientas Three.js propias
- Compara con el experimento [spline editor](/demos/spline-editor/) relacionado
- Estudia modificadores de curva en la [demo WebGPU curve](/demos/webgpu-modifier-curve/)
- Reutiliza la idea de camino para «tours» de producto o fly-throughs de cámara

## Cómo funciona

La demo usa [Three.js](https://threejs.org/) para muestrear una curva Catmull-Rom cada frame, colocar la raíz del modelo en esa muestra y, opcionalmente, alinear su eje forward a la tangente de la curva mientras un clip esquelético (si existe) impulsa movimiento secundario. Path JSON almacena puntos de control, bucle cerrado y transform del camino para reimportar en la [demo en vivo](/demos/raven-path/) o alimentar otro software. Misma familia de ideas que los ejemplos de curvas y animación three.js — aquí afinada para un bucle de criatura legible con importación y exportación.

## FAQ

**¿Podemos cambiar el cuervo por nuestra mascota?**  
Sí — usa **Import GLB / GLTF / FBX** en la demo para probar tu modelo en el camino al instante. Para una build de producción con marca, pídenos una versión scoped.

**¿Cómo reutilizo un camino después o en otro software?**  
Usa **Export path JSON** en el panel Path. Reimporta ese archivo la próxima vez en el sitio, o usa los campos `points` / `threeJsSnippet` en Blender, Three.js o tus propias herramientas.

**¿Es vídeo o tiempo real?**  
WebGL en tiempo real. Puedes grabar pantalla o exportar en otro sitio, pero la demo en sí es una escena en vivo.

## Stack técnico y lecturas

- [Demo Raven Path](/demos/raven-path/)
- [Three.js](https://threejs.org/)
- [Spline Catmull–Rom — Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
- [Spline editor (relacionado)](/demos/spline-editor/)

## Relacionado en IOM

Explora más en [3D](/#3d), más [Volumetric Lighting](/blog/volume-lighting), [Dream — Ocean scroll](/blog/iom-three), [Three.js Ocean](/blog/threejs-ocean), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$Raven Path Animation — vuelo spline y exportación de camino — IOM$iom$,
  $iom$Prueba la demo Raven Path de IOM: vuelo Catmull-Rom editable, importación GLB/GLTF/FBX, exportación/reimportación JSON del camino y guía para principiantes en la sección 3D.$iom$
from public.blog_posts p
where p.slug = $iom$raven-path$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$Artist Globe — a living map of creative practice$iom$,
  $iom$Portfolios scatter across the web; geography still matters. Artist Globe is an interactive WebGL earth of photographers, painters, sculptors, sound artists, and more — filter by pr$iom$,
  $iom$Portfolios scatter across the web; geography still matters. Artist Globe is an interactive WebGL earth of photographers, painters, sculptors, sound artists, and more — filter by practice, open profiles, highlight countries, and submit a listing for review.

It lives in our [3D section](/#3d) as **Artist Globe**. The cover shows the globe with artist markers from the 3D card.

## Open the live demo

**[→ Launch Artist Globe](/artist-globe)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Discover by place** — spin the world instead of scrolling endless grids
- **Filter by practice** — photographers, painters, sculptors, sound, and more
- **Open real portfolios** — jump from a marker into an artist’s links
- **Community loop** — submit a profile for review when you want to appear

Typical uses: cultural discovery, residency and festival scouting, studio networking, and portfolio features that need a spatial “who is where?” layer.

## For beginners — what is this, in plain words?

Think of a desktop globe with pins for artists. You rotate it, filter who shows up, and click a pin to learn more. It is a map of people and practices, not a storefront checkout.

**Quick glossary**

- **WebGL globe** — a 3D Earth drawn in the browser with [Three.js](https://threejs.org/)-style graphics
- **Practice filter** — show only certain disciplines (e.g. photography)
- **Profile** — an artist card with links and country highlight
- **Submit for review** — request to be added; editors approve before publish

## Try this in about 60 seconds

1. Open [Artist Globe](/artist-globe)
2. Drag to spin; scroll or pinch to zoom toward a region
3. Use practice filters to narrow who appears
4. Click a marker to open a profile, or follow the submit flow if you want to apply

## Requirements and performance

- **Browser:** modern desktop or mobile browser with WebGL
- **Network:** profiles and map assets need a connection
- **Performance:** reduce other GPU tabs if the globe feels heavy on older laptops

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Full globe — markers across continents](/assets/blog/artist-globe/view-a.jpg?v=20260722a)

![Regional focus — country highlight and selected practice](/assets/blog/artist-globe/view-b.jpg?v=20260722a)

Also in this build:

- Highlight a country while pitching a regional cohort
- Share `/artist-globe` as a discovery landing page
- Embed-friendly mode exists for tighter portfolio frames (`?embed=1`)

## How it works

The globe is a [Three.js](https://threejs.org/) / [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) scene: a textured sphere, camera controls, and marker sprites or meshes bound to lat/lon. Profile data and submissions are wired through the IOM web stack so the map stays curated rather than an unmoderated free-for-all.

## FAQ

**Can anyone appear on the globe?**  
Listings go through a submit-and-review path so the map stays useful and trustworthy.

**Is this a social network?**  
No — it is a discovery map of creative practices with links out to portfolios.

## Tech stack and further reading

- [Artist Globe](/artist-globe)
- [Three.js](https://threejs.org/)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
- [IOM 3D section](/#3d)

## Related on IOM

Browse more in [3D](/#3d), plus [Streets GL Bridge](/blog/streets-gl-bridge), [Art Gallery — SSR + Denoise](/blog/ssr-denoise), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$Artist Globe — a living map of creative practice — IOM$iom$,
  $iom$Portfolios scatter across the web; geography still matters. Artist Globe is an interactive WebGL earth of photographers, painters, sculptors, sound artists, and more — filter by pr$iom$
from public.blog_posts p
where p.slug = $iom$artist-globe$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$Artist Globe — eine lebendige Karte kreativer Praxis$iom$,
  $iom$Portfolios verteilen sich im Web; Geografie zählt noch. Artist Globe ist eine interaktive WebGL-Erde aus Fotografen, Malern, Bildhauern, Klangkünstlern und mehr — nach Praxis filte$iom$,
  $iom$Portfolios verteilen sich im Web; Geografie zählt noch. Artist Globe ist eine interaktive WebGL-Erde aus Fotografen, Malern, Bildhauern, Klangkünstlern und mehr — nach Praxis filtern, Profile öffnen, Länder hervorheben und einen Eintrag zur Prüfung einreichen.

Es liegt in unserem [3D-Bereich](/#3d) als **Artist Globe**. Das Cover zeigt den Globus mit Künstler-Markern von der 3D-Karte.

## Live-Demo öffnen

**[→ Artist Globe starten](/artist-globe)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Entdecken nach Ort** — die Welt drehen statt endlose Grids scrollen
- **Nach Praxis filtern** — Fotografen, Maler, Bildhauer, Sound und mehr
- **Echte Portfolios öffnen** — vom Marker zu den Links eines Künstlers springen
- **Community-Loop** — Profil zur Prüfung einreichen, wenn Sie erscheinen möchten

Typische Einsätze: kulturelle Entdeckung, Residency- und Festival-Scouting, Studio-Networking und Portfolio-Features, die eine räumliche „Wer ist wo?“-Schicht brauchen.

## Für Einsteiger — was ist das, in einfachen Worten?

Stellen Sie sich einen Desktop-Globus mit Pins für Künstler vor. Sie drehen ihn, filtern wer erscheint, und klicken einen Pin für mehr Infos. Es ist eine Karte von Menschen und Praktiken, kein Storefront-Checkout.

**Kurzes Glossar**

- **WebGL globe** — eine 3D-Erde im Browser mit [Three.js](https://threejs.org/)-artiger Grafik
- **Practice filter** — nur bestimmte Disziplinen anzeigen (z. B. Fotografie)
- **Profile** — eine Künstlerkarte mit Links und Länder-Highlight
- **Submit for review** — Aufnahme beantragen; Redaktion genehmigt vor Veröffentlichung

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie [Artist Globe](/artist-globe)
2. Ziehen zum Drehen; scrollen oder kneifen zum Zoomen in eine Region
3. Praxis-Filter nutzen, um sichtbare Künstler einzugrenzen
4. Marker klicken für ein Profil, oder Submit-Flow folgen, wenn Sie sich bewerben möchten

## Anforderungen und Performance

- **Browser:** moderner Desktop- oder Mobile-Browser mit WebGL
- **Netzwerk:** Profile und Karten-Assets brauchen Verbindung
- **Performance:** andere GPU-Tabs reduzieren, wenn der Globus auf älteren Laptops schwer wirkt

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Voller Globus — Marker über Kontinente](/assets/blog/artist-globe/view-a.jpg?v=20260722a)

![Regionaler Fokus — Länder-Highlight und gewählte Praxis](/assets/blog/artist-globe/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Land hervorheben beim Pitch einer regionalen Kohorte
- `/artist-globe` als Discovery-Landingpage teilen
- Embed-freundlicher Modus für engere Portfolio-Frames (`?embed=1`)

## So funktioniert es

Der Globus ist eine [Three.js](https://threejs.org/) / [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)-Szene: eine texturierte Kugel, Kamerasteuerung und Marker-Sprites oder -Meshes an lat/lon gebunden. Profildaten und Einreichungen laufen über den IOM-Web-Stack, damit die Karte kuratiert bleibt statt unmoderiertem Free-for-all.

## FAQ

**Kann jeder auf dem Globus erscheinen?**  
Einträge gehen durch Submit-and-Review, damit die Karte nützlich und vertrauenswürdig bleibt.

**Ist das ein soziales Netzwerk?**  
Nein — es ist eine Discovery-Karte kreativer Praktiken mit Links zu Portfolios.

## Tech-Stack und weiterführende Links

- [Artist Globe](/artist-globe)
- [Three.js](https://threejs.org/)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
- [IOM 3D-Bereich](/#3d)

## Verwandt bei IOM

Mehr in [3D](/#3d), plus [Streets GL Bridge](/blog/streets-gl-bridge), [Art Gallery — SSR + Denoise](/blog/ssr-denoise), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$Artist Globe — eine lebendige Karte kreativer Praxis — IOM$iom$,
  $iom$Portfolios verteilen sich im Web; Geografie zählt noch. Artist Globe ist eine interaktive WebGL-Erde aus Fotografen, Malern, Bildhauern, Klangkünstlern und mehr — nach Praxis filte$iom$
from public.blog_posts p
where p.slug = $iom$artist-globe$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$Artist Globe — une carte vivante de la pratique créative$iom$,
  $iom$Les portfolios se dispersent sur le web ; la géographie compte encore. Artist Globe est une Terre WebGL interactive de photographes, peintres, sculpteurs, artistes sonores et plus $iom$,
  $iom$Les portfolios se dispersent sur le web ; la géographie compte encore. Artist Globe est une Terre WebGL interactive de photographes, peintres, sculpteurs, artistes sonores et plus — filtrez par pratique, ouvrez des profils, mettez des pays en évidence et soumettez une fiche pour examen.

Il se trouve dans notre [section 3D](/#3d) sous **Artist Globe**. La couverture montre le globe avec les marqueurs d'artistes de la carte 3D.

## Ouvrir la démo en direct

**[→ Lancer Artist Globe](/artist-globe)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Découvrir par le lieu** — faire tourner le monde au lieu de défiler des grilles infinies
- **Filtrer par pratique** — photographes, peintres, sculpteurs, son, et plus
- **Ouvrir de vrais portfolios** — passer d'un marqueur aux liens d'un artiste
- **Boucle communautaire** — soumettre un profil pour examen quand vous voulez apparaître

Usages typiques : découverte culturelle, repérage de résidences et festivals, réseautage en studio, et mises en avant portfolio qui ont besoin d'une couche spatiale « qui est où ? ».

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Imaginez un globe de bureau avec des épingles pour les artistes. Vous le faites tourner, filtrez qui apparaît, et cliquez une épingle pour en savoir plus. C'est une carte de personnes et de pratiques, pas une caisse de boutique.

**Glossaire rapide**

- **WebGL globe** — une Terre 3D dessinée dans le navigateur avec des graphismes de type [Three.js](https://threejs.org/)
- **Practice filter** — n'afficher que certaines disciplines (ex. photographie)
- **Profile** — une fiche artiste avec liens et surbrillance de pays
- **Submit for review** — demander à être ajouté ; les éditeurs approuvent avant publication

## Essayez en environ 60 secondes

1. Ouvrez [Artist Globe](/artist-globe)
2. Glissez pour faire tourner ; scrollez ou pincez pour zoomer vers une région
3. Utilisez les filtres de pratique pour affiner qui apparaît
4. Cliquez un marqueur pour ouvrir un profil, ou suivez le flux de soumission si vous voulez postuler

## Prérequis et performances

- **Navigateur :** navigateur desktop ou mobile moderne avec WebGL
- **Réseau :** profils et assets de carte nécessitent une connexion
- **Performance :** réduisez les autres onglets GPU si le globe semble lourd sur les vieux portables

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Globe complet — marqueurs sur les continents](/assets/blog/artist-globe/view-a.jpg?v=20260722a)

![Focus régional — surbrillance de pays et pratique sélectionnée](/assets/blog/artist-globe/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Mettre un pays en évidence en pitchant une cohorte régionale
- Partager `/artist-globe` comme page d'accueil de découverte
- Mode embed-friendly pour des cadres portfolio plus serrés (`?embed=1`)

## Comment ça marche

Le globe est une scène [Three.js](https://threejs.org/) / [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) : une sphère texturée, contrôles caméra, et sprites ou meshes marqueurs liés à lat/lon. Données de profil et soumissions passent par la stack web IOM pour que la carte reste curatée plutôt qu'un free-for-all non modéré.

## FAQ

**N'importe qui peut-il apparaître sur le globe ?**  
Les fiches passent par un parcours soumettre-et-examiner pour que la carte reste utile et fiable.

**Est-ce un réseau social ?**  
Non — c'est une carte de découverte de pratiques créatives avec liens vers les portfolios.

## Stack technique et lectures

- [Artist Globe](/artist-globe)
- [Three.js](https://threejs.org/)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
- [Section 3D IOM](/#3d)

## Sur IOM

Parcourez [3D](/#3d), plus [Streets GL Bridge](/blog/streets-gl-bridge), [Art Gallery — SSR + Denoise](/blog/ssr-denoise), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$Artist Globe — une carte vivante de la pratique créative — IOM$iom$,
  $iom$Les portfolios se dispersent sur le web ; la géographie compte encore. Artist Globe est une Terre WebGL interactive de photographes, peintres, sculpteurs, artistes sonores et plus $iom$
from public.blog_posts p
where p.slug = $iom$artist-globe$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$Artist Globe — een levende kaart van creatieve praktijk$iom$,
  $iom$Portfolio's verspreiden zich over het web; geografie telt nog steeds. Artist Globe is een interactieve WebGL-aarde van fotografen, schilders, beeldhouwers, geluidskunstenaars en me$iom$,
  $iom$Portfolio's verspreiden zich over het web; geografie telt nog steeds. Artist Globe is een interactieve WebGL-aarde van fotografen, schilders, beeldhouwers, geluidskunstenaars en meer — filter op praktijk, open profielen, markeer landen en dien een vermelding in ter beoordeling.

Het staat in onze [3D-sectie](/#3d) als **Artist Globe**. De cover toont de globe met kunstenaarsmarkers van de 3D-kaart.

## Open de live demo

**[→ Start Artist Globe](/artist-globe)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Ontdekken op plaats** — draai de wereld in plaats van eindeloze grids scrollen
- **Filter op praktijk** — fotografen, schilders, beeldhouwers, sound en meer
- **Open echte portfolio's** — spring van een marker naar de links van een kunstenaar
- **Community-loop** — dien een profiel in ter beoordeling wanneer u wilt verschijnen

Typische toepassingen: culturele ontdekking, residency- en festival-scouting, studio-netwerken, en portfolio-features die een ruimtelijke „wie is waar?“-laag nodig hebben.

## Voor beginners — wat is dit, in gewone taal?

Denk aan een bureauglobe met pins voor kunstenaars. U draait hem, filtert wie verschijnt, en klikt een pin voor meer info. Het is een kaart van mensen en praktijken, geen winkelcheckout.

**Korte glossary**

- **WebGL globe** — een 3D-aarde getekend in de browser met [Three.js](https://threejs.org/)-achtige graphics
- **Practice filter** — toon alleen bepaalde disciplines (bijv. fotografie)
- **Profile** — een kunstenaarskaart met links en landhighlight
- **Submit for review** — verzoek om toegevoegd te worden; redacteuren keuren goed vóór publicatie

## Probeer dit in ongeveer 60 seconden

1. Open [Artist Globe](/artist-globe)
2. Sleep om te draaien; scroll of knijp om in te zoomen op een regio
3. Gebruik praktijkfilters om zichtbare kunstenaars te verfijnen
4. Klik een marker voor een profiel, of volg de submit-flow als u wilt solliciteren

## Vereisten en performance

- **Browser:** moderne desktop- of mobiele browser met WebGL
- **Netwerk:** profielen en kaartassets hebben verbinding nodig
- **Performance:** verminder andere GPU-tabs als de globe zwaar voelt op oudere laptops

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Volledige globe — markers over continenten](/assets/blog/artist-globe/view-a.jpg?v=20260722a)

![Regionale focus — landhighlight en gekozen praktijk](/assets/blog/artist-globe/view-b.jpg?v=20260722a)

Ook in deze build:

- Markeer een land bij het pitchen van een regionale cohort
- Deel `/artist-globe` als discovery-landingspagina
- Embed-vriendelijke modus voor strakkere portfolioframes (`?embed=1`)

## Hoe het werkt

De globe is een [Three.js](https://threejs.org/) / [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)-scène: een getextureerde bol, camerabesturing en marker-sprites of -meshes gebonden aan lat/lon. Profielgegevens en inzendingen lopen via de IOM-webstack zodat de kaart gecureerd blijft in plaats van een ongemodereerd free-for-all.

## FAQ

**Kan iedereen op de globe verschijnen?**  
Vermeldingen gaan via submit-and-review zodat de kaart nuttig en betrouwbaar blijft.

**Is dit een sociaal netwerk?**  
Nee — het is een discovery-kaart van creatieve praktijken met links naar portfolio's.

## Tech stack en verder lezen

- [Artist Globe](/artist-globe)
- [Three.js](https://threejs.org/)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
- [IOM 3D-gedeelte](/#3d)

## Gerelateerd op IOM

Bekijk meer in [3D](/#3d), plus [Streets GL Bridge](/blog/streets-gl-bridge), [Art Gallery — SSR + Denoise](/blog/ssr-denoise), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$Artist Globe — een levende kaart van creatieve praktijk — IOM$iom$,
  $iom$Portfolio's verspreiden zich over het web; geografie telt nog steeds. Artist Globe is een interactieve WebGL-aarde van fotografen, schilders, beeldhouwers, geluidskunstenaars en me$iom$
from public.blog_posts p
where p.slug = $iom$artist-globe$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$Artist Globe — una mappa vivente della pratica creativa$iom$,
  $iom$I portfolio si disperdono sul web; la geografia conta ancora. Artist Globe è una Terra WebGL interattiva di fotografi, pittori, scultori, artisti sonori e altro — filtra per pratic$iom$,
  $iom$I portfolio si disperdono sul web; la geografia conta ancora. Artist Globe è una Terra WebGL interattiva di fotografi, pittori, scultori, artisti sonori e altro — filtra per pratica, apri profili, evidenzia paesi e invia una scheda per revisione.

Si trova nella nostra [sezione 3D](/#3d) come **Artist Globe**. La cover mostra il globo con i marker artista dalla card 3D.

## Apri la demo live

**[→ Avvia Artist Globe](/artist-globe)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Scoprire per luogo** — ruota il mondo invece di scrollare griglie infinite
- **Filtra per pratica** — fotografi, pittori, scultori, sound e altro
- **Apri portfolio reali** — passa da un marker ai link di un artista
- **Loop community** — invia un profilo per revisione quando vuoi comparire

Usi tipici: scoperta culturale, scouting residenze e festival, networking in studio, e feature portfolio che servono uno strato spaziale «chi è dove?».

## Per principianti — cos’è, in parole semplici?

Immagina un globo da scrivania con pin per gli artisti. Lo ruoti, filtri chi appare e clicchi un pin per saperne di più. È una mappa di persone e pratiche, non un checkout di negozio.

**Glossario rapido**

- **WebGL globe** — una Terra 3D disegnata nel browser con grafica in stile [Three.js](https://threejs.org/)
- **Practice filter** — mostra solo certe discipline (es. fotografia)
- **Profile** — una scheda artista con link ed evidenziazione paese
- **Submit for review** — richiesta di aggiunta; gli editor approvano prima della pubblicazione

## Provalo in circa 60 secondi

1. Apri [Artist Globe](/artist-globe)
2. Trascina per ruotare; scroll o pinch per zoomare su una regione
3. Usa i filtri pratica per restringere chi appare
4. Clicca un marker per aprire un profilo, o segui il flusso submit se vuoi candidarti

## Requisiti e prestazioni

- **Browser:** browser desktop o mobile moderno con WebGL
- **Rete:** profili e asset mappa richiedono connessione
- **Performance:** riduci altre tab GPU se il globo pesa su laptop datati

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Globo completo — marker sui continenti](/assets/blog/artist-globe/view-a.jpg?v=20260722a)

![Focus regionale — evidenziazione paese e pratica selezionata](/assets/blog/artist-globe/view-b.jpg?v=20260722a)

Anche in questa build:

- Evidenzia un paese mentre presenti una cohort regionale
- Condividi `/artist-globe` come landing page di scoperta
- Esiste modalità embed-friendly per frame portfolio più stretti (`?embed=1`)

## Come funziona

Il globo è una scena [Three.js](https://threejs.org/) / [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API): una sfera texturizzata, controlli camera e sprite o mesh marker legati a lat/lon. Dati profilo e submission passano dallo stack web IOM così la mappa resta curata invece di un free-for-all non moderato.

## FAQ

**Chiunque può comparire sul globo?**  
Le schede passano per submit-and-review così la mappa resta utile e affidabile.

**È un social network?**  
No — è una mappa di scoperta di pratiche creative con link ai portfolio.

## Stack tecnico e letture

- [Artist Globe](/artist-globe)
- [Three.js](https://threejs.org/)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
- [Sezione 3D IOM](/#3d)

## Correlati su IOM

Esplora di più in [3D](/#3d), più [Streets GL Bridge](/blog/streets-gl-bridge), [Art Gallery — SSR + Denoise](/blog/ssr-denoise), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$Artist Globe — una mappa vivente della pratica creativa — IOM$iom$,
  $iom$I portfolio si disperdono sul web; la geografia conta ancora. Artist Globe è una Terra WebGL interattiva di fotografi, pittori, scultori, artisti sonori e altro — filtra per pratic$iom$
from public.blog_posts p
where p.slug = $iom$artist-globe$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$Artist Globe — un mapa vivo de la práctica creativa$iom$,
  $iom$Los portfolios se dispersan por la web; la geografía sigue importando. Artist Globe es una Tierra WebGL interactiva de fotógrafos, pintores, escultores, artistas sonoros y más — fi$iom$,
  $iom$Los portfolios se dispersan por la web; la geografía sigue importando. Artist Globe es una Tierra WebGL interactiva de fotógrafos, pintores, escultores, artistas sonoros y más — filtra por práctica, abre perfiles, resalta países y envía una ficha para revisión.

Está en nuestra [sección 3D](/#3d) como **Artist Globe**. La portada muestra el globo con marcadores de artistas de la tarjeta 3D.

## Abrir la demo en vivo

**[→ Lanzar Artist Globe](/artist-globe)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Descubrir por lugar** — gira el mundo en lugar de scroll infinito de grids
- **Filtrar por práctica** — fotógrafos, pintores, escultores, sonido y más
- **Abrir portfolios reales** — salta de un marcador a los enlaces de un artista
- **Bucle comunitario** — envía un perfil para revisión cuando quieras aparecer

Usos típicos: descubrimiento cultural, scouting de residencias y festivales, networking de estudio, y features de portfolio que necesitan una capa espacial «¿quién está dónde?».

## Para principiantes — ¿qué es esto, en palabras simples?

Piensa en un globo de escritorio con pins para artistas. Lo giras, filtras quién aparece y clicas un pin para saber más. Es un mapa de personas y prácticas, no un checkout de tienda.

**Glosario rápido**

- **WebGL globe** — una Tierra 3D dibujada en el navegador con gráficos tipo [Three.js](https://threejs.org/)
- **Practice filter** — muestra solo ciertas disciplinas (p. ej. fotografía)
- **Profile** — una ficha de artista con enlaces y resaltado de país
- **Submit for review** — solicitud de alta; editores aprueban antes de publicar

## Pruébalo en unos 60 segundos

1. Abre [Artist Globe](/artist-globe)
2. Arrastra para girar; scroll o pellizca para acercar a una región
3. Usa filtros de práctica para acotar quién aparece
4. Clic en un marcador para abrir un perfil, o sigue el flujo de envío si quieres solicitar

## Requisitos y rendimiento

- **Navegador:** navegador desktop o móvil moderno con WebGL
- **Red:** perfiles y assets del mapa requieren conexión
- **Rendimiento:** reduce otras pestañas GPU si el globo pesa en portátiles antiguos

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Globo completo — marcadores en continentes](/assets/blog/artist-globe/view-a.jpg?v=20260722a)

![Enfoque regional — resaltado de país y práctica seleccionada](/assets/blog/artist-globe/view-b.jpg?v=20260722a)

También en este build:

- Resalta un país al presentar una cohorte regional
- Comparte `/artist-globe` como landing de descubrimiento
- Existe modo embed-friendly para marcos de portfolio más ajustados (`?embed=1`)

## Cómo funciona

El globo es una escena [Three.js](https://threejs.org/) / [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API): una esfera texturizada, controles de cámara y sprites o meshes marcadores ligados a lat/lon. Datos de perfil y envíos pasan por el stack web IOM para que el mapa siga curado en lugar de un free-for-all sin moderar.

## FAQ

**¿Cualquiera puede aparecer en el globo?**  
Las fichas pasan por envío y revisión para que el mapa siga útil y fiable.

**¿Es una red social?**  
No — es un mapa de descubrimiento de prácticas creativas con enlaces a portfolios.

## Stack técnico y lecturas

- [Artist Globe](/artist-globe)
- [Three.js](https://threejs.org/)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
- [Sección 3D IOM](/#3d)

## Relacionado en IOM

Explora más en [3D](/#3d), más [Streets GL Bridge](/blog/streets-gl-bridge), [Art Gallery — SSR + Denoise](/blog/ssr-denoise), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$Artist Globe — un mapa vivo de la práctica creativa — IOM$iom$,
  $iom$Los portfolios se dispersan por la web; la geografía sigue importando. Artist Globe es una Tierra WebGL interactiva de fotógrafos, pintores, escultores, artistas sonoros y más — fi$iom$
from public.blog_posts p
where p.slug = $iom$artist-globe$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$Art Gallery — WebGPU SSR + Denoise$iom$,
  $iom$Shiny floors and glass only feel real when reflections hold up. This gallery demo runs WebGPU screen-space reflections with spatiotemporal denoising — import GLTF/FBX, swap HDR/EXR$iom$,
  $iom$Shiny floors and glass only feel real when reflections hold up. This gallery demo runs WebGPU screen-space reflections with spatiotemporal denoising — import GLTF/FBX, swap HDR/EXR skies, walk in third person, and compare raw vs cleaned reflections.

It lives in our [3D section](/#3d) as **Art Gallery**. The cover shows the gallery space with denoised reflections.

## Open the live demo

**[→ Launch Art Gallery — WebGPU SSR + Denoise](/demos/ssr-denoise/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Reflections that hold** — SSR with denoise instead of a blurry smear
- **Bring your own model** — load GLTF/FBX into the gallery shell
- **Swap the sky** — HDR/EXR panoramas change mood in seconds
- **Walk the space** — third-person explore for client-scale reading

Typical uses: interior product viz, gallery and showroom pitches, material reviews, and WebGPU R&D conversations about reflection quality vs frame rate.

## For beginners — what is this, in plain words?

Screen-space reflections (SSR) fake mirrors and glossy floors by reusing what the camera already sees, instead of rendering a full second world. That can look noisy. Denoise is the cleanup pass that turns sparkly noise into a stable reflection — closer to what you expect from film lighting, still running live.

**Quick glossary**

- **WebGPU** — modern browser GPU API ([Wikipedia](https://en.wikipedia.org/wiki/WebGPU), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API))
- **SSR** — screen-space reflections — glossy mirrors from what is on screen
- **Denoise** — a filter that smooths noisy reflection samples over space/time
- **HDR / EXR** — high-dynamic-range environment maps for lighting and sky
- **Third-person walk** — move a character through the gallery instead of free-fly only

## Try this in about 60 seconds

1. Open the [SSR + Denoise demo](/demos/ssr-denoise/) in Chrome or Edge
2. Orbit or walk until you see a glossy floor reflection
3. Toggle or compare raw vs denoised reflections if the UI exposes the switch
4. Optional: import a small GLTF/FBX or swap an HDR to re-light the room

## Requirements and performance

- **Browser:** Chrome or Edge with WebGPU enabled (113+ recommended)
- **Hardware:** a discrete or recent integrated GPU; lower quality if it stutters
- **Mobile:** limited — treat desktop as the first experience

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Gallery wide — art walls and reflective floor](/assets/blog/ssr-denoise/view-a.jpg?v=20260722a)

![Reflection detail — denoised gloss under the lights](/assets/blog/ssr-denoise/view-b.jpg?v=20260722a)

Also in this build:

- Load custom models to see how a client piece reads in the room
- Compare reflection quality while moving — denoise shows its value in motion
- Pair with other WebGPU studies like volumetric lighting on the same site

## How it works

The starting point is the official three.js [WebGPU SSR + denoise example](https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise) ([source on GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html)). IOM wraps that pipeline in a gallery shell with model import, HDR/EXR swap, and walk mode so the effect is client-readable, not only a tech sample.

## FAQ

**Why is the page blank or warning me?**  
This demo needs WebGPU. Use a recent Chrome or Edge build; Safari and older Firefox may not expose the API yet.

**Is SSR the same as ray tracing?**  
No. SSR reuses the screen image; path-traced or hardware ray-traced reflections are a heavier path. Denoise makes SSR more presentable in realtime.

## Tech stack and further reading

- [Live SSR + Denoise demo](/demos/ssr-denoise/)
- [three.js SSR denoise example](https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise)
- [Example source on GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Related on IOM

Browse more in [3D](/#3d), plus [Volumetric Lighting](/blog/volume-lighting), [Three.js Ocean](/blog/threejs-ocean), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$Art Gallery — WebGPU SSR + Denoise — IOM$iom$,
  $iom$Shiny floors and glass only feel real when reflections hold up. This gallery demo runs WebGPU screen-space reflections with spatiotemporal denoising — import GLTF/FBX, swap HDR/EXR$iom$
from public.blog_posts p
where p.slug = $iom$ssr-denoise$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$Art Gallery — WebGPU SSR + Denoise$iom$,
  $iom$Glänzende Böden und Glas wirken nur echt, wenn Reflexionen halten. Diese Gallery-Demo fährt WebGPU Screen-Space Reflections mit spatiotemporaler Denoise — GLTF/FBX importieren, HDR$iom$,
  $iom$Glänzende Böden und Glas wirken nur echt, wenn Reflexionen halten. Diese Gallery-Demo fährt WebGPU Screen-Space Reflections mit spatiotemporaler Denoise — GLTF/FBX importieren, HDR/EXR-Himmel tauschen, in Third Person laufen und rohe vs. bereinigte Reflexionen vergleichen.

Es liegt in unserem [3D-Bereich](/#3d) als **Art Gallery**. Das Cover zeigt den Galerieraum mit denoised Reflexionen.

## Live-Demo öffnen

**[→ Art Gallery — WebGPU SSR + Denoise starten](/demos/ssr-denoise/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Reflexionen, die halten** — SSR mit Denoise statt unscharfem Schlieren
- **Eigenes Modell mitbringen** — GLTF/FBX in die Gallery-Hülle laden
- **Himmel tauschen** — HDR/EXR-Panoramen ändern Stimmung in Sekunden
- **Raum begehen** — Third-Person-Explore für client-taugliches Lesen

Typische Einsätze: Innenraum-Produktviz, Gallery- und Showroom-Pitches, Material-Reviews und WebGPU-R&D-Gespräche über Reflexionsqualität vs. Framerate.

## Für Einsteiger — was ist das, in einfachen Worten?

Screen-Space Reflections (SSR) faken Spiegel und glänzende Böden, indem sie wiederverwenden, was die Kamera schon sieht, statt eine zweite Welt voll zu rendern. Das kann rauschig wirken. Denoise ist der Cleanup-Pass, der funkelndes Rauschen in eine stabile Reflexion verwandelt — näher an dem, was man von Filmlicht erwartet, weiterhin live.

**Kurzes Glossar**

- **WebGPU** — moderne Browser-GPU-API ([Wikipedia](https://en.wikipedia.org/wiki/WebGPU), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API))
- **SSR** — Screen-Space Reflections — glänzende Spiegel aus dem, was auf dem Bildschirm ist
- **Denoise** — ein Filter, der rauschige Reflexionssamples über Raum/Zeit glättet
- **HDR / EXR** — High-Dynamic-Range-Umgebungsmaps für Beleuchtung und Himmel
- **Third-person walk** — eine Figur durch die Gallery bewegen statt nur Free-Fly

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [SSR + Denoise Demo](/demos/ssr-denoise/) in Chrome oder Edge
2. Orbitieren oder laufen, bis Sie eine glänzende Bodenreflexion sehen
3. Rohe vs. denoised Reflexionen umschalten oder vergleichen, wenn die UI den Schalter bietet
4. Optional: kleines GLTF/FBX importieren oder HDR tauschen, um den Raum neu zu beleuchten

## Anforderungen und Performance

- **Browser:** Chrome oder Edge mit WebGPU (113+ empfohlen)
- **Hardware:** diskrete oder aktuelle integrierte GPU; Qualität senken bei Ruckeln
- **Mobile:** begrenzt — Desktop als erste Erfahrung behandeln

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Gallery weit — Kunstwände und reflektierender Boden](/assets/blog/ssr-denoise/view-a.jpg?v=20260722a)

![Reflexionsdetail — denoised Glanz unter den Lichtern](/assets/blog/ssr-denoise/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Custom-Modelle laden, um zu sehen, wie ein Kundenstück im Raum wirkt
- Reflexionsqualität in Bewegung vergleichen — Denoise zeigt seinen Wert live
- Mit anderen WebGPU-Studien wie Volumetric Lighting auf derselben Site kombinieren

## So funktioniert es

Ausgangspunkt ist das offizielle three.js [WebGPU SSR + Denoise Beispiel](https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise) ([Quelle auf GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html)). IOM packt diese Pipeline in eine Gallery-Hülle mit Modellimport, HDR/EXR-Swap und Walk-Mode, damit der Effekt client-lesbar ist, nicht nur ein Tech-Sample.

## FAQ

**Warum ist die Seite leer oder warnt sie mich?**  
Diese Demo braucht WebGPU. Nutzen Sie einen aktuellen Chrome- oder Edge-Build; Safari und älteres Firefox exponieren die API ggf. noch nicht.

**Ist SSR dasselbe wie Ray Tracing?**  
Nein. SSR nutzt das Bildschirmbild wieder; path-traced oder hardware-ray-traced Reflexionen sind ein schwererer Weg. Denoise macht SSR in Echtzeit präsentabler.

## Tech-Stack und weiterführende Links

- [Live SSR + Denoise Demo](/demos/ssr-denoise/)
- [three.js SSR Denoise Beispiel](https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise)
- [Beispielquelle auf GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Verwandt bei IOM

Mehr in [3D](/#3d), plus [Volumetric Lighting](/blog/volume-lighting), [Three.js Ocean](/blog/threejs-ocean), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$Art Gallery — WebGPU SSR + Denoise — IOM$iom$,
  $iom$Glänzende Böden und Glas wirken nur echt, wenn Reflexionen halten. Diese Gallery-Demo fährt WebGPU Screen-Space Reflections mit spatiotemporaler Denoise — GLTF/FBX importieren, HDR$iom$
from public.blog_posts p
where p.slug = $iom$ssr-denoise$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$Art Gallery — WebGPU SSR + Denoise$iom$,
  $iom$Les sols brillants et le verre ne semblent réels que si les reflets tiennent. Cette démo galerie exécute des réflexions screen-space WebGPU avec débruitage spatiotemporel — importe$iom$,
  $iom$Les sols brillants et le verre ne semblent réels que si les reflets tiennent. Cette démo galerie exécute des réflexions screen-space WebGPU avec débruitage spatiotemporel — importez GLTF/FBX, changez les ciels HDR/EXR, marchez en third person et comparez reflets bruts vs nettoyés.

Il se trouve dans notre [section 3D](/#3d) sous **Art Gallery**. La couverture montre l'espace galerie avec reflets débruités.

## Ouvrir la démo en direct

**[→ Lancer Art Gallery — WebGPU SSR + Denoise](/demos/ssr-denoise/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Des reflets qui tiennent** — SSR avec denoise au lieu d'une traînée floue
- **Apportez votre modèle** — chargez GLTF/FBX dans l'enveloppe galerie
- **Changez le ciel** — panoramas HDR/EXR changent l'ambiance en secondes
- **Parcourez l'espace** — exploration third person pour une lecture à l'échelle client

Usages typiques : viz produit intérieur, pitches galerie et showroom, revues de matériaux, et conversations R&D WebGPU sur qualité de réflexion vs framerate.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Les réflexions screen-space (SSR) simulent miroirs et sols brillants en réutilisant ce que la caméra voit déjà, au lieu de rendre un second monde complet. Ça peut paraître bruité. Denoise est la passe de nettoyage qui transforme le bruit scintillant en réflexion stable — plus proche de l'éclairage cinéma, toujours en direct.

**Glossaire rapide**

- **WebGPU** — API GPU navigateur moderne ([Wikipedia](https://en.wikipedia.org/wiki/WebGPU), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API))
- **SSR** — screen-space reflections — miroirs brillants à partir de ce qui est à l'écran
- **Denoise** — un filtre qui lisse les échantillons de réflexion bruités dans l'espace et le temps
- **HDR / EXR** — cartes d'environnement haute plage dynamique pour éclairage et ciel
- **Third-person walk** — déplacer un personnage dans la galerie au lieu du free-fly seul

## Essayez en environ 60 secondes

1. Ouvrez la [démo SSR + Denoise](/demos/ssr-denoise/) dans Chrome ou Edge
2. Orbitez ou marchez jusqu'à voir une réflexion de sol brillant
3. Basculez ou comparez reflets bruts vs débruités si l'UI expose l'interrupteur
4. Optionnel : importez un petit GLTF/FBX ou changez un HDR pour ré-éclairer la pièce

## Prérequis et performances

- **Navigateur :** Chrome ou Edge avec WebGPU activé (113+ recommandé)
- **Matériel :** GPU discret ou intégré récent ; baissez la qualité si ça saccade
- **Mobile :** limité — traitez le desktop comme première expérience

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Galerie large — murs d'art et sol réfléchissant](/assets/blog/ssr-denoise/view-a.jpg?v=20260722a)

![Détail de réflexion — brillance débruitée sous les lumières](/assets/blog/ssr-denoise/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Charger des modèles custom pour voir comment une pièce client se lit dans la pièce
- Comparer la qualité de réflexion en mouvement — le denoise montre sa valeur en direct
- Associer à d'autres études WebGPU comme le volumetric lighting sur le même site

## Comment ça marche

Le point de départ est l'exemple officiel three.js [WebGPU SSR + denoise](https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise) ([source sur GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html)). IOM enveloppe ce pipeline dans une coque galerie avec import de modèle, swap HDR/EXR et mode walk pour que l'effet soit lisible client, pas seulement un échantillon tech.

## FAQ

**Pourquoi la page est-elle vide ou m'avertit-elle ?**  
Cette démo nécessite WebGPU. Utilisez une version récente de Chrome ou Edge ; Safari et les vieux Firefox n'exposent peut-être pas encore l'API.

**SSR, est-ce la même chose que le ray tracing ?**  
Non. SSR réutilise l'image à l'écran ; les reflets path-traced ou ray-traced matériel sont une voie plus lourde. Denoise rend SSR plus présentable en temps réel.

## Stack technique et lectures

- [Démo live SSR + Denoise](/demos/ssr-denoise/)
- [Exemple three.js SSR denoise](https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise)
- [Source de l'exemple sur GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Sur IOM

Parcourez [3D](/#3d), plus [Volumetric Lighting](/blog/volume-lighting), [Three.js Ocean](/blog/threejs-ocean), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$Art Gallery — WebGPU SSR + Denoise — IOM$iom$,
  $iom$Les sols brillants et le verre ne semblent réels que si les reflets tiennent. Cette démo galerie exécute des réflexions screen-space WebGPU avec débruitage spatiotemporel — importe$iom$
from public.blog_posts p
where p.slug = $iom$ssr-denoise$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$Art Gallery — WebGPU SSR + Denoise$iom$,
  $iom$Glanzende vloeren en glas voelen alleen echt als reflecties standhouden. Deze gallery-demo draait WebGPU screen-space reflections met spatiotemporal denoising — importeer GLTF/FBX,$iom$,
  $iom$Glanzende vloeren en glas voelen alleen echt als reflecties standhouden. Deze gallery-demo draait WebGPU screen-space reflections met spatiotemporal denoising — importeer GLTF/FBX, wissel HDR/EXR-luchten, loop in third person en vergelijk ruwe vs. opgeschoonde reflecties.

Het staat in onze [3D-sectie](/#3d) als **Art Gallery**. De cover toont de galerieruimte met denoised reflecties.

## Open de live demo

**[→ Start Art Gallery — WebGPU SSR + Denoise](/demos/ssr-denoise/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Reflecties die standhouden** — SSR met denoise in plaats van een wazige smeer
- **Breng uw eigen model mee** — laad GLTF/FBX in de gallery-shell
- **Wissel de lucht** — HDR/EXR-panorama's veranderen sfeer in seconden
- **Loop de ruimte** — third-person explore voor client-schaal leesbaarheid

Typische toepassingen: interieur productviz, gallery- en showroom-pitches, materiaalreviews en WebGPU R&D-gesprekken over reflectiekwaliteit vs. framerate.

## Voor beginners — wat is dit, in gewone taal?

Screen-space reflections (SSR) simuleren spiegels en glanzende vloeren door te hergebruiken wat de camera al ziet, in plaats van een volledige tweede wereld te renderen. Dat kan ruisig lijken. Denoise is de cleanup-pass die sprankelende ruis omzet in een stabiele reflectie — dichter bij wat u van filmlighting verwacht, nog steeds live.

**Korte glossary**

- **WebGPU** — moderne browser-GPU-API ([Wikipedia](https://en.wikipedia.org/wiki/WebGPU), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API))
- **SSR** — screen-space reflections — glanzende spiegels van wat op scherm staat
- **Denoise** — een filter die ruisige reflectiesamples over ruimte/tijd gladstrijkt
- **HDR / EXR** — high-dynamic-range omgevingsmaps voor belichting en lucht
- **Third-person walk** — beweeg een personage door de gallery in plaats van alleen free-fly

## Probeer dit in ongeveer 60 seconden

1. Open de [SSR + Denoise-demo](/demos/ssr-denoise/) in Chrome of Edge
2. Orbit of loop tot u een glanzende vloerreflectie ziet
3. Schakel of vergelijk ruwe vs. denoised reflecties als de UI de switch toont
4. Optioneel: importeer klein GLTF/FBX of wissel HDR om de kamer opnieuw te belichten

## Vereisten en performance

- **Browser:** Chrome of Edge met WebGPU ingeschakeld (113+ aanbevolen)
- **Hardware:** discrete of recente geïntegreerde GPU; verlaag kwaliteit bij haperen
- **Mobile:** beperkt — behandel desktop als eerste ervaring

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Gallery breed — kunstwanden en reflecterende vloer](/assets/blog/ssr-denoise/view-a.jpg?v=20260722a)

![Reflectiedetail — denoised glans onder de lampen](/assets/blog/ssr-denoise/view-b.jpg?v=20260722a)

Ook in deze build:

- Laad custom modellen om te zien hoe een clientstuk in de kamer leest
- Vergelijk reflectiekwaliteit in beweging — denoise toont zijn waarde live
- Combineer met andere WebGPU-studies zoals volumetric lighting op dezelfde site

## Hoe het werkt

Het startpunt is het officiële three.js [WebGPU SSR + denoise-voorbeeld](https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise) ([bron op GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html)). IOM wikkelt die pipeline in een gallery-shell met modelimport, HDR/EXR-swap en walk mode zodat het effect client-leesbaar is, niet alleen een tech-sample.

## FAQ

**Waarom is de pagina leeg of waarschuwt die?**  
Deze demo vereist WebGPU. Gebruik een recente Chrome- of Edge-build; Safari en oudere Firefox exposeren de API mogelijk nog niet.

**Is SSR hetzelfde als ray tracing?**  
Nee. SSR hergebruikt het schermbeeld; path-traced of hardware ray-traced reflecties zijn een zwaarder pad. Denoise maakt SSR presentabeler in realtime.

## Tech stack en verder lezen

- [Live SSR + Denoise-demo](/demos/ssr-denoise/)
- [three.js SSR denoise-voorbeeld](https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise)
- [Voorbeeldbron op GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Gerelateerd op IOM

Bekijk meer in [3D](/#3d), plus [Volumetric Lighting](/blog/volume-lighting), [Three.js Ocean](/blog/threejs-ocean), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$Art Gallery — WebGPU SSR + Denoise — IOM$iom$,
  $iom$Glanzende vloeren en glas voelen alleen echt als reflecties standhouden. Deze gallery-demo draait WebGPU screen-space reflections met spatiotemporal denoising — importeer GLTF/FBX,$iom$
from public.blog_posts p
where p.slug = $iom$ssr-denoise$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$Art Gallery — WebGPU SSR + Denoise$iom$,
  $iom$Pavimenti lucidi e vetro sembrano reali solo se i riflessi reggono. Questa demo galleria esegue screen-space reflections WebGPU con denoise spatiotemporale — importa GLTF/FBX, camb$iom$,
  $iom$Pavimenti lucidi e vetro sembrano reali solo se i riflessi reggono. Questa demo galleria esegue screen-space reflections WebGPU con denoise spatiotemporale — importa GLTF/FBX, cambia cieli HDR/EXR, cammina in third person e confronta riflessi raw vs. puliti.

Si trova nella nostra [sezione 3D](/#3d) come **Art Gallery**. La cover mostra lo spazio galleria con riflessi denoised.

## Apri la demo live

**[→ Avvia Art Gallery — WebGPU SSR + Denoise](/demos/ssr-denoise/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Riflessi che reggono** — SSR con denoise invece di una scia sfocata
- **Porta il tuo modello** — carica GLTF/FBX nella shell galleria
- **Cambia il cielo** — panorami HDR/EXR cambiano mood in secondi
- **Percorri lo spazio** — esplorazione third person per lettura client-scale

Usi tipici: viz prodotto interni, pitch galleria e showroom, review materiali, e conversazioni R&D WebGPU su qualità riflessi vs. framerate.

## Per principianti — cos’è, in parole semplici?

Le screen-space reflections (SSR) simulano specchi e pavimenti lucidi riusando ciò che la camera vede già, invece di renderizzare un secondo mondo completo. Può sembrare rumoroso. Denoise è il pass di pulizia che trasforma rumore scintillante in riflesso stabile — più vicino all'illuminazione da film, ancora live.

**Glossario rapido**

- **WebGPU** — API GPU browser moderna ([Wikipedia](https://en.wikipedia.org/wiki/WebGPU), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API))
- **SSR** — screen-space reflections — specchi lucidi da ciò che è a schermo
- **Denoise** — un filtro che leviga campioni riflesso rumorosi nello spazio/tempo
- **HDR / EXR** — environment map ad alta gamma dinamica per illuminazione e cielo
- **Third-person walk** — muovi un personaggio nella galleria invece del solo free-fly

## Provalo in circa 60 secondi

1. Apri la [demo SSR + Denoise](/demos/ssr-denoise/) in Chrome o Edge
2. Orbita o cammina finché vedi un riflesso lucido sul pavimento
3. Attiva o confronta riflessi raw vs. denoised se l'UI espone lo switch
4. Opzionale: importa un piccolo GLTF/FBX o cambia HDR per re-illuminare la stanza

## Requisiti e prestazioni

- **Browser:** Chrome o Edge con WebGPU abilitato (113+ consigliato)
- **Hardware:** GPU discreta o integrata recente; abbassa qualità se scatta
- **Mobile:** limitato — tratta desktop come prima esperienza

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Galleria ampia — pareti d'arte e pavimento riflettente](/assets/blog/ssr-denoise/view-a.jpg?v=20260722a)

![Dettaglio riflesso — lucentezza denoised sotto le luci](/assets/blog/ssr-denoise/view-b.jpg?v=20260722a)

Anche in questa build:

- Carica modelli custom per vedere come un pezzo cliente legge nella stanza
- Confronta qualità riflesso in movimento — il denoise mostra valore live
- Abbina ad altri studi WebGPU come volumetric lighting sullo stesso sito

## Come funziona

Il punto di partenza è l'esempio ufficiale three.js [WebGPU SSR + denoise](https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise) ([sorgente su GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html)). IOM avvolge quella pipeline in una shell galleria con import modello, swap HDR/EXR e walk mode così l'effetto è leggibile client, non solo un sample tech.

## FAQ

**Perché la pagina è vuota o mi avvisa?**  
Questa demo richiede WebGPU. Usa una build recente di Chrome o Edge; Safari e Firefox datati potrebbero non esporre ancora l'API.

**SSR è uguale al ray tracing?**  
No. SSR riusa l'immagine a schermo; riflessi path-traced o ray-traced hardware sono un percorso più pesante. Denoise rende SSR più presentabile in realtime.

## Stack tecnico e letture

- [Demo live SSR + Denoise](/demos/ssr-denoise/)
- [Esempio three.js SSR denoise](https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise)
- [Sorgente esempio su GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Correlati su IOM

Esplora di più in [3D](/#3d), più [Volumetric Lighting](/blog/volume-lighting), [Three.js Ocean](/blog/threejs-ocean), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$Art Gallery — WebGPU SSR + Denoise — IOM$iom$,
  $iom$Pavimenti lucidi e vetro sembrano reali solo se i riflessi reggono. Questa demo galleria esegue screen-space reflections WebGPU con denoise spatiotemporale — importa GLTF/FBX, camb$iom$
from public.blog_posts p
where p.slug = $iom$ssr-denoise$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$Art Gallery — WebGPU SSR + Denoise$iom$,
  $iom$Suelos brillantes y cristal solo se sienten reales si los reflejos aguantan. Esta demo galería ejecuta screen-space reflections WebGPU con denoise espaciotemporal — importa GLTF/FB$iom$,
  $iom$Suelos brillantes y cristal solo se sienten reales si los reflejos aguantan. Esta demo galería ejecuta screen-space reflections WebGPU con denoise espaciotemporal — importa GLTF/FBX, cambia cielos HDR/EXR, camina en third person y compara reflejos crudos vs. limpios.

Está en nuestra [sección 3D](/#3d) como **Art Gallery**. La portada muestra el espacio galería con reflejos denoised.

## Abrir la demo en vivo

**[→ Lanzar Art Gallery — WebGPU SSR + Denoise](/demos/ssr-denoise/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Reflejos que aguantan** — SSR con denoise en lugar de una mancha borrosa
- **Trae tu propio modelo** — carga GLTF/FBX en la shell galería
- **Cambia el cielo** — panoramas HDR/EXR cambian el mood en segundos
- **Recorre el espacio** — exploración third person para lectura a escala cliente

Usos típicos: viz de producto interior, pitches de galería y showroom, revisiones de material, y conversaciones R&D WebGPU sobre calidad de reflejo vs. framerate.

## Para principiantes — ¿qué es esto, en palabras simples?

Las screen-space reflections (SSR) simulan espejos y suelos brillantes reutilizando lo que la cámara ya ve, en lugar de renderizar un segundo mundo completo. Puede verse ruidoso. Denoise es el pase de limpieza que convierte ruido chispeante en reflejo estable — más cerca de la iluminación cinematográfica, aún en directo.

**Glosario rápido**

- **WebGPU** — API GPU moderna del navegador ([Wikipedia](https://en.wikipedia.org/wiki/WebGPU), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API))
- **SSR** — screen-space reflections — espejos brillantes a partir de lo que hay en pantalla
- **Denoise** — un filtro que suaviza muestras de reflejo ruidosas en espacio/tiempo
- **HDR / EXR** — mapas de entorno de alto rango dinámico para iluminación y cielo
- **Third-person walk** — mueve un personaje por la galería en lugar de solo free-fly

## Pruébalo en unos 60 segundos

1. Abre la [demo SSR + Denoise](/demos/ssr-denoise/) en Chrome o Edge
2. Orbita o camina hasta ver un reflejo brillante en el suelo
3. Activa o compara reflejos crudos vs. denoised si la UI expone el interruptor
4. Opcional: importa un GLTF/FBX pequeño o cambia HDR para reiluminar la sala

## Requisitos y rendimiento

- **Navegador:** Chrome o Edge con WebGPU activado (113+ recomendado)
- **Hardware:** GPU discreta o integrada reciente; baja calidad si se traba
- **Móvil:** limitado — trata desktop como primera experiencia

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Galería amplia — paredes de arte y suelo reflectante](/assets/blog/ssr-denoise/view-a.jpg?v=20260722a)

![Detalle de reflejo — brillo denoised bajo las luces](/assets/blog/ssr-denoise/view-b.jpg?v=20260722a)

También en este build:

- Carga modelos custom para ver cómo lee una pieza de cliente en la sala
- Compara calidad de reflejo en movimiento — denoise muestra su valor en directo
- Combina con otros estudios WebGPU como volumetric lighting en el mismo sitio

## Cómo funciona

El punto de partida es el ejemplo oficial three.js [WebGPU SSR + denoise](https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise) ([fuente en GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html)). IOM envuelve esa pipeline en una shell galería con importación de modelo, swap HDR/EXR y modo walk para que el efecto sea legible para clientes, no solo una muestra técnica.

## FAQ

**¿Por qué la página está en blanco o me avisa?**  
Esta demo necesita WebGPU. Usa una build reciente de Chrome o Edge; Safari y Firefox antiguos pueden no exponer aún la API.

**¿SSR es lo mismo que ray tracing?**  
No. SSR reutiliza la imagen de pantalla; reflejos path-traced o ray-traced por hardware son un camino más pesado. Denoise hace SSR más presentable en tiempo real.

## Stack técnico y lecturas

- [Demo live SSR + Denoise](/demos/ssr-denoise/)
- [Ejemplo three.js SSR denoise](https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise)
- [Fuente del ejemplo en GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Relacionado en IOM

Explora más en [3D](/#3d), más [Volumetric Lighting](/blog/volume-lighting), [Three.js Ocean](/blog/threejs-ocean), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$Art Gallery — WebGPU SSR + Denoise — IOM$iom$,
  $iom$Suelos brillantes y cristal solo se sienten reales si los reflejos aguantan. Esta demo galería ejecuta screen-space reflections WebGPU con denoise espaciotemporal — importa GLTF/FB$iom$
from public.blog_posts p
where p.slug = $iom$ssr-denoise$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$Dream — Ocean scroll narrative$iom$,
  $iom$Not every 3D piece should be an orbit cube. Dream is a scroll narrative through still dark water, rain, distant land, and shore — procedural distortion, optional ambient audio, and$iom$,
  $iom$Not every 3D piece should be an orbit cube. Dream is a scroll narrative through still dark water, rain, distant land, and shore — procedural distortion, optional ambient audio, and a weather runtime with sky, clouds, and day/night sync. Chapter 1 of 9; work in progress.

It lives in our [3D section](/#3d) as **Dream**. The cover is the Dream start screen — title, calm line, and the play control before the scroll begins.

## Open the live demo

**[→ Launch Dream — Ocean scroll](/demos/dreams-iom/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Scroll as camera** — the page motion tells the chapter, not only a drag orbit
- **Atmosphere first** — water, rain, and weather set the emotional beat
- **Audio that follows** — optional ambient crossfade with the visual chapters
- **Series mindset** — chapter 1 of 9 signals a longer narrative arc

Typical uses: brand story landings, exhibition web companions, folio openers, and experiments where mood and pacing matter as much as model fidelity.

## For beginners — what is this, in plain words?

Instead of a free camera you fly yourself, you scroll — and the scene advances like pages in a picture book. Water and weather shaders do the heavy visual lifting; you read with your thumb or mouse wheel.

**Quick glossary**

- **Scroll narrative** — story beats tied to page scroll position
- **Procedural distortion** — shader motion that warps the surface without a video file
- **Weather runtime** — sky, clouds, and day/night driven by parameters
- **Crossfade audio** — ambient layers blend as chapters change

## Try this in about 60 seconds

1. Open the [Dream — Ocean scroll demo](/demos/dreams-iom/)
2. Tap play on the start screen, then scroll slowly through the first water beats
3. Pause on the floating figure — notice ripples, sky, and weather mood
4. If audio is enabled in your build, unmute and scroll again for the crossfade

## Requirements and performance

- **Browser:** modern Chrome/Edge/Firefox with WebGL
- **Motion:** desktop scroll or trackpad gives the intended pacing
- **Audio:** optional — some browsers require a click before sound starts

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Start screen — DREAM., calm line, and play to enter the scroll](/assets/blog/iom-three/view-a.jpg?v=20260722a)

![After play — floating figure on still dark water](/assets/blog/iom-three/view-b.jpg?v=20260722a)

Also in this build:

- Treat it as a mood board for a longer multi-chapter launch
- Pair with the [Three.js Ocean](/blog/threejs-ocean) study for surface technique contrast
- Scope a branded chapter with custom copy and audio bed

## How it works

The experience is a [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) canvas driven by scroll position: shader-based water and atmospheric passes update as the narrative progress value changes. Weather (sky, clouds, day/night) is a parameter runtime rather than a baked video. Live at [/demos/dreams-iom/](/demos/dreams-iom/).

## FAQ

**Is this finished?**  
Chapter 1 of 9 is the public beat — a work-in-progress narrative, not a closed film.

**Can we put our brand story here?**  
Yes as a scoped adaptation: copy, pacing, audio, and visual grade. Contact us with the chapter outline.

## Tech stack and further reading

- [Dream — Ocean scroll](/demos/dreams-iom/)
- [Three.js](https://threejs.org/)
- [WebGL — Wikipedia](https://en.wikipedia.org/wiki/WebGL)
- [IOM 3D section](/#3d)

## Related on IOM

Browse more in [3D](/#3d), plus [Three.js Ocean](/blog/threejs-ocean), [Raven Path Animation](/blog/raven-path), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$Dream — Ocean scroll narrative — IOM$iom$,
  $iom$Not every 3D piece should be an orbit cube. Dream is a scroll narrative through still dark water, rain, distant land, and shore — procedural distortion, optional ambient audio, and$iom$
from public.blog_posts p
where p.slug = $iom$iom-three$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$Dream — Ocean-Scroll-Narrative$iom$,
  $iom$Nicht jedes 3D-Stück soll ein Orbit-Würfel sein. Dream ist eine Scroll-Narrative durch still dunkles Wasser, Regen, ferne Landmassen und Ufer — prozedurale Verzerrung, optionales A$iom$,
  $iom$Nicht jedes 3D-Stück soll ein Orbit-Würfel sein. Dream ist eine Scroll-Narrative durch still dunkles Wasser, Regen, ferne Landmassen und Ufer — prozedurale Verzerrung, optionales Ambient-Audio und eine Weather-Runtime mit Himmel, Wolken und Tag/Nacht-Sync. Kapitel 1 von 9; Work in Progress.

Es liegt in unserem [3D-Bereich](/#3d) als **Dream**. Das Cover ist der Dream-Startscreen — Titel, ruhige Zeile und Play-Control vor dem Scroll-Start.

## Live-Demo öffnen

**[→ Dream — Ocean scroll starten](/demos/dreams-iom/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Scroll als Kamera** — Seitenbewegung erzählt das Kapitel, nicht nur Orbit-Drag
- **Atmosphäre zuerst** — Wasser, Regen und Wetter setzen den emotionalen Beat
- **Audio, das folgt** — optionales Ambient-Crossfade mit den visuellen Kapiteln
- **Serien-Mindset** — Kapitel 1 von 9 signalisiert einen längeren Narrativ-Bogen

Typische Einsätze: Brand-Story-Landings, Ausstellungs-Web-Begleiter, Folio-Opener und Experimente, bei denen Stimmung und Pacing genauso zählen wie Modelltreue.

## Für Einsteiger — was ist das, in einfachen Worten?

Statt einer freien Kamera, die Sie selbst fliegen, scrollen Sie — und die Szene schreitet vor wie Seiten in einem Bilderbuch. Wasser- und Wetter-Shader leisten die visuelle Hauptarbeit; Sie lesen mit Daumen oder Mausrad.

**Kurzes Glossar**

- **Scroll narrative** — Story-Beats an Scroll-Position gebunden
- **Procedural distortion** — Shader-Bewegung, die die Oberfläche ohne Videodatei verformt
- **Weather runtime** — Himmel, Wolken und Tag/Nacht über Parameter gesteuert
- **Crossfade audio** — Ambient-Layer mischen sich beim Kapitelwechsel

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [Dream — Ocean scroll Demo](/demos/dreams-iom/)
2. Play auf dem Startscreen tippen, dann langsam durch die ersten Wasser-Beats scrollen
3. Bei der schwebenden Figur pausieren — Wellen, Himmel und Wetterstimmung beachten
4. Wenn Audio in Ihrem Build aktiv ist, entmuten und erneut scrollen für das Crossfade

## Anforderungen und Performance

- **Browser:** moderner Chrome/Edge/Firefox mit WebGL
- **Motion:** Desktop-Scroll oder Trackpad gibt das beabsichtigte Pacing
- **Audio:** optional — manche Browser brauchen Klick vor Soundstart

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Startscreen — DREAM., ruhige Zeile und Play zum Scroll-Einstieg](/assets/blog/iom-three/view-a.jpg?v=20260722a)

![Nach Play — schwebende Figur auf still dunklem Wasser](/assets/blog/iom-three/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Als Moodboard für einen längeren Multi-Kapitel-Launch nutzen
- Mit der [Three.js Ocean](/blog/threejs-ocean)-Studie für Oberflächentechnik-Kontrast paaren
- Ein gebrandetes Kapitel mit Custom-Copy und Audio-Bed scopen

## So funktioniert es

Die Experience ist ein [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)-Canvas, gesteuert durch Scroll-Position: shader-basiertes Wasser und atmosphärische Pässe aktualisieren sich mit dem Narrativ-Fortschrittswert. Wetter (Himmel, Wolken, Tag/Nacht) ist eine Parameter-Runtime statt gebackenem Video. Live unter [/demos/dreams-iom/](/demos/dreams-iom/).

## FAQ

**Ist das fertig?**  
Kapitel 1 von 9 ist der öffentliche Beat — eine Work-in-Progress-Narrative, kein abgeschlossener Film.

**Können wir unsere Brand-Story hier platzieren?**  
Ja als scoped Adaptation: Copy, Pacing, Audio und visueller Grade. Kontaktieren Sie uns mit dem Kapitel-Outline.

## Tech-Stack und weiterführende Links

- [Dream — Ocean scroll](/demos/dreams-iom/)
- [Three.js](https://threejs.org/)
- [WebGL — Wikipedia](https://en.wikipedia.org/wiki/WebGL)
- [IOM 3D-Bereich](/#3d)

## Verwandt bei IOM

Mehr in [3D](/#3d), plus [Three.js Ocean](/blog/threejs-ocean), [Raven Path Animation](/blog/raven-path), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$Dream — Ocean-Scroll-Narrative — IOM$iom$,
  $iom$Nicht jedes 3D-Stück soll ein Orbit-Würfel sein. Dream ist eine Scroll-Narrative durch still dunkles Wasser, Regen, ferne Landmassen und Ufer — prozedurale Verzerrung, optionales A$iom$
from public.blog_posts p
where p.slug = $iom$iom-three$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$Dream — récit scroll océan$iom$,
  $iom$Toute pièce 3D ne devrait pas être un cube en orbite. Dream est un récit au scroll à travers eau sombre et calme, pluie, terre lointaine et rivage — distorsion procédurale, audio a$iom$,
  $iom$Toute pièce 3D ne devrait pas être un cube en orbite. Dream est un récit au scroll à travers eau sombre et calme, pluie, terre lointaine et rivage — distorsion procédurale, audio ambiant optionnel et runtime météo avec ciel, nuages et sync jour/nuit. Chapitre 1 sur 9 ; work in progress.

Il se trouve dans notre [section 3D](/#3d) sous **Dream**. La couverture est l'écran de départ Dream — titre, ligne calme et contrôle play avant le début du scroll.

## Ouvrir la démo en direct

**[→ Lancer Dream — Ocean scroll](/demos/dreams-iom/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Le scroll comme caméra** — le mouvement de page raconte le chapitre, pas seulement un drag en orbite
- **L'atmosphère d'abord** — eau, pluie et météo posent le beat émotionnel
- **Un audio qui suit** — crossfade ambiant optionnel avec les chapitres visuels
- **Esprit série** — chapitre 1 sur 9 signale un arc narratif plus long

Usages typiques : landings de story de marque, compagnons web d'exposition, ouvertures de folio, et expériences où ambiance et rythme comptent autant que la fidélité du modèle.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Au lieu d'une caméra libre que vous pilotez, vous scrollez — et la scène avance comme des pages dans un livre d'images. Les shaders eau et météo font le gros du visuel ; vous lisez avec le pouce ou la molette.

**Glossaire rapide**

- **Scroll narrative** — beats narratifs liés à la position de scroll
- **Procedural distortion** — mouvement shader qui déforme la surface sans fichier vidéo
- **Weather runtime** — ciel, nuages et jour/nuit pilotés par paramètres
- **Crossfade audio** — couches ambiantes se mélangent au changement de chapitre

## Essayez en environ 60 secondes

1. Ouvrez la [démo Dream — Ocean scroll](/demos/dreams-iom/)
2. Appuyez play sur l'écran de départ, puis scrollez lentement à travers les premiers beats d'eau
3. Pausez sur la figure flottante — observez ondulations, ciel et ambiance météo
4. Si l'audio est activé dans votre build, unmutez et scrollez à nouveau pour le crossfade

## Prérequis et performances

- **Navigateur :** Chrome/Edge/Firefox moderne avec WebGL
- **Mouvement :** scroll desktop ou trackpad donne le rythme prévu
- **Audio :** optionnel — certains navigateurs exigent un clic avant le son

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Écran de départ — DREAM., ligne calme et play pour entrer dans le scroll](/assets/blog/iom-three/view-a.jpg?v=20260722a)

![Après play — figure flottante sur eau sombre et calme](/assets/blog/iom-three/view-b.jpg?v=20260722a)

Aussi dans ce build :

- L'utiliser comme mood board pour un lancement multi-chapitres plus long
- Associer à l'étude [Three.js Ocean](/blog/threejs-ocean) pour contraster les techniques de surface
- Scoper un chapitre brandé avec copy et bed audio custom

## Comment ça marche

L'expérience est un canvas [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) piloté par la position de scroll : eau shader et passes atmosphériques se mettent à jour avec la valeur de progression narrative. Météo (ciel, nuages, jour/nuit) est un runtime de paramètres plutôt qu'une vidéo baked. Live sur [/demos/dreams-iom/](/demos/dreams-iom/).

## FAQ

**Est-ce terminé ?**  
Chapitre 1 sur 9 est le beat public — un récit work-in-progress, pas un film clos.

**Peut-on y placer notre story de marque ?**  
Oui en adaptation scoped : copy, rythme, audio et grade visuel. Contactez-nous avec le plan du chapitre.

## Stack technique et lectures

- [Dream — Ocean scroll](/demos/dreams-iom/)
- [Three.js](https://threejs.org/)
- [WebGL — Wikipedia](https://en.wikipedia.org/wiki/WebGL)
- [Section 3D IOM](/#3d)

## Sur IOM

Parcourez [3D](/#3d), plus [Three.js Ocean](/blog/threejs-ocean), [Raven Path Animation](/blog/raven-path), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$Dream — récit scroll océan — IOM$iom$,
  $iom$Toute pièce 3D ne devrait pas être un cube en orbite. Dream est un récit au scroll à travers eau sombre et calme, pluie, terre lointaine et rivage — distorsion procédurale, audio a$iom$
from public.blog_posts p
where p.slug = $iom$iom-three$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$Dream — ocean scroll-verhaal$iom$,
  $iom$Niet elk 3D-stuk hoeft een orbit-kubus te zijn. Dream is een scroll-verhaal door stil donker water, regen, ver land en kust — procedurele vervorming, optionele ambient-audio en een$iom$,
  $iom$Niet elk 3D-stuk hoeft een orbit-kubus te zijn. Dream is een scroll-verhaal door stil donker water, regen, ver land en kust — procedurele vervorming, optionele ambient-audio en een weather-runtime met lucht, wolken en dag/nacht-sync. Hoofdstuk 1 van 9; work in progress.

Het staat in onze [3D-sectie](/#3d) als **Dream**. De cover is het Dream-startscherm — titel, kalme regel en play-control vóór het scrollen begint.

## Open de live demo

**[→ Start Dream — Ocean scroll](/demos/dreams-iom/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Scroll als camera** — paginabeweging vertelt het hoofdstuk, niet alleen orbit-drag
- **Atmosfeer eerst** — water, regen en weer zetten de emotionele beat
- **Audio die meeloopt** — optionele ambient crossfade met de visuele hoofdstukken
- **Serie-mindset** — hoofdstuk 1 van 9 signaleert een langer narratief boog

Typische toepassingen: brand story-landings, tentoonstellings-webbegeleiders, folio-openers en experimenten waar sfeer en pacing net zo tellen als modelfideliteit.

## Voor beginners — wat is dit, in gewone taal?

In plaats van een vrije camera die u zelf vliegt, scrollt u — en de scène schrijdt vooruit als pagina's in een prentenboek. Water- en weershaders doen het zware visuele werk; u leest met duim of muiswiel.

**Korte glossary**

- **Scroll narrative** — verhaalbeats gekoppeld aan scrollpositie
- **Procedural distortion** — shaderbeweging die het oppervlak vervormt zonder videobestand
- **Weather runtime** — lucht, wolken en dag/nacht aangestuurd door parameters
- **Crossfade audio** — ambient-lagen mengen bij hoofdstukwissel

## Probeer dit in ongeveer 60 seconden

1. Open de [Dream — Ocean scroll-demo](/demos/dreams-iom/)
2. Tik play op het startscherm, scroll dan langzaam door de eerste waterbeats
3. Pauzeer bij de zwevende figuur — let op rimpels, lucht en weerssfeer
4. Als audio in uw build staat, unmute en scroll opnieuw voor de crossfade

## Vereisten en performance

- **Browser:** moderne Chrome/Edge/Firefox met WebGL
- **Motion:** desktop-scroll of trackpad geeft het bedoelde pacing
- **Audio:** optioneel — sommige browsers vereisen klik vóór geluid start

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Startscherm — DREAM., kalme regel en play om het scrollen te betreden](/assets/blog/iom-three/view-a.jpg?v=20260722a)

![Na play — zwevende figuur op stil donker water](/assets/blog/iom-three/view-b.jpg?v=20260722a)

Ook in deze build:

- Gebruik als moodboard voor een langere multi-hoofdstuk-launch
- Combineer met de [Three.js Ocean](/blog/threejs-ocean)-studie voor oppervlaktetechniek-contrast
- Scope een gebrand hoofdstuk met custom copy en audio bed

## Hoe het werkt

De ervaring is een [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)-canvas aangestuurd door scrollpositie: shader-gebaseerd water en atmosferische passes updaten met de narratieve voortgangswaarde. Weer (lucht, wolken, dag/nacht) is een parameter-runtime in plaats van gebakken video. Live op [/demos/dreams-iom/](/demos/dreams-iom/).

## FAQ

**Is dit af?**  
Hoofdstuk 1 van 9 is de publieke beat — een work-in-progress-verhaal, geen afgesloten film.

**Kunnen we ons brandverhaal hier plaatsen?**  
Ja als scoped adaptatie: copy, pacing, audio en visuele grade. Neem contact op met het hoofdstukoutline.

## Tech stack en verder lezen

- [Dream — Ocean scroll](/demos/dreams-iom/)
- [Three.js](https://threejs.org/)
- [WebGL — Wikipedia](https://en.wikipedia.org/wiki/WebGL)
- [IOM 3D-gedeelte](/#3d)

## Gerelateerd op IOM

Bekijk meer in [3D](/#3d), plus [Three.js Ocean](/blog/threejs-ocean), [Raven Path Animation](/blog/raven-path), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$Dream — ocean scroll-verhaal — IOM$iom$,
  $iom$Niet elk 3D-stuk hoeft een orbit-kubus te zijn. Dream is een scroll-verhaal door stil donker water, regen, ver land en kust — procedurele vervorming, optionele ambient-audio en een$iom$
from public.blog_posts p
where p.slug = $iom$iom-three$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$Dream — narrativa scroll oceano$iom$,
  $iom$Non ogni pezzo 3D deve essere un cubo in orbita. Dream è una narrativa scroll attraverso acqua scura e calma, pioggia, terra lontana e riva — distorsione procedurale, audio ambient$iom$,
  $iom$Non ogni pezzo 3D deve essere un cubo in orbita. Dream è una narrativa scroll attraverso acqua scura e calma, pioggia, terra lontana e riva — distorsione procedurale, audio ambient opzionale e runtime meteo con cielo, nuvole e sync giorno/notte. Capitolo 1 di 9; work in progress.

Si trova nella nostra [sezione 3D](/#3d) come **Dream**. La cover è lo schermo iniziale Dream — titolo, linea calma e controllo play prima che inizi lo scroll.

## Apri la demo live

**[→ Avvia Dream — Ocean scroll](/demos/dreams-iom/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Scroll come camera** — il movimento pagina racconta il capitolo, non solo drag in orbita
- **Atmosfera prima** — acqua, pioggia e meteo impostano il beat emotivo
- **Audio che segue** — crossfade ambient opzionale con i capitoli visivi
- **Mentalità serie** — capitolo 1 di 9 segnala un arco narrativo più lungo

Usi tipici: landing story brand, companion web per mostre, opener folio, e esperimenti dove mood e pacing contano quanto la fedeltà del modello.

## Per principianti — cos’è, in parole semplici?

Invece di una camera libera che piloti tu, scrolli — e la scena avanza come pagine in un libro illustrato. Shader acqua e meteo fanno il grosso del visivo; leggi con pollice o rotella.

**Glossario rapido**

- **Scroll narrative** — beat narrativi legati alla posizione di scroll
- **Procedural distortion** — movimento shader che deforma la superficie senza file video
- **Weather runtime** — cielo, nuvole e giorno/notte guidati da parametri
- **Crossfade audio** — layer ambient si mescolano al cambio capitolo

## Provalo in circa 60 secondi

1. Apri la [demo Dream — Ocean scroll](/demos/dreams-iom/)
2. Tocca play sullo schermo iniziale, poi scrolla lentamente i primi beat acqua
3. Fermati sulla figura fluttuante — nota increspature, cielo e mood meteo
4. Se l'audio è attivo nella tua build, unmute e scrolla di nuovo per il crossfade

## Requisiti e prestazioni

- **Browser:** Chrome/Edge/Firefox moderno con WebGL
- **Motion:** scroll desktop o trackpad dà il pacing previsto
- **Audio:** opzionale — alcuni browser richiedono click prima del suono

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Schermo iniziale — DREAM., linea calma e play per entrare nello scroll](/assets/blog/iom-three/view-a.jpg?v=20260722a)

![Dopo play — figura fluttuante su acqua scura e calma](/assets/blog/iom-three/view-b.jpg?v=20260722a)

Anche in questa build:

- Usalo come mood board per un lancio multi-capitolo più lungo
- Abbina allo studio [Three.js Ocean](/blog/threejs-ocean) per contrasto tecnica superficie
- Scopa un capitolo brandizzato con copy e audio bed custom

## Come funziona

L'esperienza è un canvas [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) guidato dalla posizione di scroll: acqua shader e pass atmosferici si aggiornano col valore progresso narrativo. Meteo (cielo, nuvole, giorno/notte) è un runtime parametri invece di video baked. Live su [/demos/dreams-iom/](/demos/dreams-iom/).

## FAQ

**È finito?**  
Capitolo 1 di 9 è il beat pubblico — una narrativa work-in-progress, non un film chiuso.

**Possiamo mettere la nostra brand story qui?**  
Sì come adattamento scoped: copy, pacing, audio e grade visivo. Contattaci con l'outline del capitolo.

## Stack tecnico e letture

- [Dream — Ocean scroll](/demos/dreams-iom/)
- [Three.js](https://threejs.org/)
- [WebGL — Wikipedia](https://en.wikipedia.org/wiki/WebGL)
- [Sezione 3D IOM](/#3d)

## Correlati su IOM

Esplora di più in [3D](/#3d), più [Three.js Ocean](/blog/threejs-ocean), [Raven Path Animation](/blog/raven-path), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$Dream — narrativa scroll oceano — IOM$iom$,
  $iom$Non ogni pezzo 3D deve essere un cubo in orbita. Dream è una narrativa scroll attraverso acqua scura e calma, pioggia, terra lontana e riva — distorsione procedurale, audio ambient$iom$
from public.blog_posts p
where p.slug = $iom$iom-three$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$Dream — narrativa scroll océano$iom$,
  $iom$No toda pieza 3D debe ser un cubo en órbita. Dream es una narrativa scroll a través de agua oscura y quieta, lluvia, tierra lejana y orilla — distorsión procedural, audio ambient o$iom$,
  $iom$No toda pieza 3D debe ser un cubo en órbita. Dream es una narrativa scroll a través de agua oscura y quieta, lluvia, tierra lejana y orilla — distorsión procedural, audio ambient opcional y runtime meteorológico con cielo, nubes y sync día/noche. Capítulo 1 de 9; work in progress.

Está en nuestra [sección 3D](/#3d) como **Dream**. La portada es la pantalla de inicio Dream — título, línea calmada y control play antes de que empiece el scroll.

## Abrir la demo en vivo

**[→ Lanzar Dream — Ocean scroll](/demos/dreams-iom/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Scroll como cámara** — el movimiento de página cuenta el capítulo, no solo drag en órbita
- **Atmósfera primero** — agua, lluvia y clima marcan el beat emocional
- **Audio que sigue** — crossfade ambient opcional con los capítulos visuales
- **Mentalidad de serie** — capítulo 1 de 9 señala un arco narrativo más largo

Usos típicos: landings de brand story, companions web de exposición, aperturas de folio, y experimentos donde mood y pacing importan tanto como la fidelidad del modelo.

## Para principiantes — ¿qué es esto, en palabras simples?

En lugar de una cámara libre que pilotas tú, haces scroll — y la escena avanza como páginas en un libro ilustrado. Shaders de agua y clima hacen el grueso visual; lees con pulgar o rueda del ratón.

**Glosario rápido**

- **Scroll narrative** — beats narrativos ligados a la posición de scroll
- **Procedural distortion** — movimiento shader que deforma la superficie sin archivo de vídeo
- **Weather runtime** — cielo, nubes y día/noche impulsados por parámetros
- **Crossfade audio** — capas ambient se mezclan al cambiar capítulo

## Pruébalo en unos 60 segundos

1. Abre la [demo Dream — Ocean scroll](/demos/dreams-iom/)
2. Pulsa play en la pantalla de inicio, luego scroll lento por los primeros beats de agua
3. Pausa en la figura flotante — observa ondas, cielo y mood meteorológico
4. Si el audio está activo en tu build, unmute y scroll de nuevo para el crossfade

## Requisitos y rendimiento

- **Navegador:** Chrome/Edge/Firefox moderno con WebGL
- **Motion:** scroll desktop o trackpad da el pacing previsto
- **Audio:** opcional — algunos navegadores requieren clic antes del sonido

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Pantalla de inicio — DREAM., línea calmada y play para entrar al scroll](/assets/blog/iom-three/view-a.jpg?v=20260722a)

![Tras play — figura flotante sobre agua oscura y quieta](/assets/blog/iom-three/view-b.jpg?v=20260722a)

También en este build:

- Úsalo como mood board para un lanzamiento multi-capitulo más largo
- Combina con el estudio [Three.js Ocean](/blog/threejs-ocean) para contraste de técnica de superficie
- Scopea un capítulo con marca con copy y audio bed custom

## Cómo funciona

La experiencia es un canvas [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) guiado por posición de scroll: agua shader y pases atmosféricos se actualizan con el valor de progreso narrativo. Clima (cielo, nubes, día/noche) es un runtime de parámetros en lugar de vídeo baked. Live en [/demos/dreams-iom/](/demos/dreams-iom/).

## FAQ

**¿Está terminado?**  
Capítulo 1 de 9 es el beat público — una narrativa work-in-progress, no una película cerrada.

**¿Podemos poner nuestra brand story aquí?**  
Sí como adaptación scoped: copy, pacing, audio y grade visual. Contáctanos con el outline del capítulo.

## Stack técnico y lecturas

- [Dream — Ocean scroll](/demos/dreams-iom/)
- [Three.js](https://threejs.org/)
- [WebGL — Wikipedia](https://en.wikipedia.org/wiki/WebGL)
- [Sección 3D IOM](/#3d)

## Relacionado en IOM

Explora más en [3D](/#3d), más [Three.js Ocean](/blog/threejs-ocean), [Raven Path Animation](/blog/raven-path), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$Dream — narrativa scroll océano — IOM$iom$,
  $iom$No toda pieza 3D debe ser un cubo en órbita. Dream es una narrativa scroll a través de agua oscura y quieta, lluvia, tierra lejana y orilla — distorsión procedural, audio ambient o$iom$
from public.blog_posts p
where p.slug = $iom$iom-three$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$Three.js Ocean — Gerstner waves, sky, and export$iom$,
  $iom$Need a hero water plate you can brand in minutes? This ocean demo runs Gerstner-wave water with a procedural sky and sunset preset — drop glass 3D text (Google Fonts), decorative i$iom$,
  $iom$Need a hero water plate you can brand in minutes? This ocean demo runs Gerstner-wave water with a procedural sky and sunset preset — drop glass 3D text (Google Fonts), decorative icons, grab wallpaper screenshots, or export up to 30 seconds of WebGL video.

It lives in our [3D section](/#3d) as **Three.js Ocean**. The cover shows the sunset ocean framing from the 3D card.

## Open the live demo

**[→ Launch Three.js Ocean](/demos/ocean/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Readable water fast** — Gerstner waves and sky without a film render farm
- **Type on the water** — glass 3D text with Google Fonts for titles
- **Sunset preset** — a one-click mood for pitches and lockups
- **Takeaways** — wallpaper stills or a short WebGL video export

Typical uses: landing heroes, event key art plates, social wallpapers, and quick “ocean brand moment” comps before a custom water R&D pass.

## For beginners — what is this, in plain words?

Gerstner waves are a classic way to fake ocean swells in real time — peaks and troughs that look more like water than a flat ripple texture. Here they sit under a procedural sky so you can compose a title or icon and capture it.

**Quick glossary**

- **Gerstner wave** — a mathematical swell model used in realtime oceans
- **Procedural sky** — sky color and sun computed in a shader, not a photo dome only
- **Glass 3D text** — extruded type with refractive/transparent shading
- **WebGL video export** — recording frames from the canvas into a short clip

## Try this in about 60 seconds

1. Open the [Three.js Ocean demo](/demos/ocean/)
2. Orbit until the horizon and sun read clearly (try the sunset preset)
3. Add or edit glass 3D text / icons if the UI offers them
4. Capture a wallpaper screenshot or start a short video export (≤30s)

## Requirements and performance

- **Browser:** modern Chrome/Edge recommended for capture and export
- **GPU:** integrated graphics usually fine; lower quality if fans spin up
- **Export:** video capture is heavier — close other tabs for a clean take

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Sunset ocean — horizon and swell](/assets/blog/threejs-ocean/view-a.jpg?v=20260722a)

![Title lockup — glass text over water](/assets/blog/threejs-ocean/view-b.jpg?v=20260722a)

Also in this build:

- Generate social/wallpaper stills without leaving the browser
- Prototype event titles before handing off to motion design
- Compare technique with the scroll narrative in [Dream](/blog/iom-three)

## How it works

Built on the three.js ocean/water lineage ([webgl_shaders_ocean example source](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html)) with IOM UI for text, presets, screenshots, and short canvas recording. [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) drives the water and sky each frame; export is a timed capture of that same canvas.

## FAQ

**Can we use the clip commercially?**  
Treat the public demo as a preview. Ask us for a licensed or branded export package for campaigns.

**Is this the same as Dream — Ocean scroll?**  
No. This is an orbitable ocean plate with export tools; Dream is a scroll narrative chapter at [/demos/dreams-iom/](/demos/dreams-iom/).

## Tech stack and further reading

- [Ocean demo](/demos/ocean/)
- [three.js ocean example source](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html)
- [Three.js](https://threejs.org/)
- [Gerstner wave — Wikipedia](https://en.wikipedia.org/wiki/Trochoidal_wave)

## Related on IOM

Browse more in [3D](/#3d), plus [Dream — Ocean scroll](/blog/iom-three), [Art Gallery — SSR + Denoise](/blog/ssr-denoise), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$Three.js Ocean — Gerstner waves, sky, and export — IOM$iom$,
  $iom$Need a hero water plate you can brand in minutes? This ocean demo runs Gerstner-wave water with a procedural sky and sunset preset — drop glass 3D text (Google Fonts), decorative i$iom$
from public.blog_posts p
where p.slug = $iom$threejs-ocean$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$Three.js Ocean — Gerstner-Wellen, Himmel und Export$iom$,
  $iom$Brauchen Sie eine Hero-Wasserplatte, die Sie in Minuten branden können? Diese Ocean-Demo fährt Gerstner-Wave-Wasser mit prozeduralem Himmel und Sunset-Preset — Glass-3D-Text (Googl$iom$,
  $iom$Brauchen Sie eine Hero-Wasserplatte, die Sie in Minuten branden können? Diese Ocean-Demo fährt Gerstner-Wave-Wasser mit prozeduralem Himmel und Sunset-Preset — Glass-3D-Text (Google Fonts) platzieren, dekorative Icons, Wallpaper-Screenshots oder bis zu 30 Sekunden WebGL-Video exportieren.

Es liegt in unserem [3D-Bereich](/#3d) als **Three.js Ocean**. Das Cover zeigt die Sunset-Ocean-Framing von der 3D-Karte.

## Live-Demo öffnen

**[→ Three.js Ocean starten](/demos/ocean/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Lesbares Wasser schnell** — Gerstner-Wellen und Himmel ohne Film-Renderfarm
- **Typ auf dem Wasser** — Glass-3D-Text mit Google Fonts für Titel
- **Sunset-Preset** — One-Click-Stimmung für Pitches und Lockups
- **Takeaways** — Wallpaper-Stills oder kurzer WebGL-Video-Export

Typische Einsätze: Landing-Heroes, Event-Key-Art-Plates, Social-Wallpapers und schnelle „Ocean-Brand-Moment“-Comps vor einem Custom-Water-R&D-Pass.

## Für Einsteiger — was ist das, in einfachen Worten?

Gerstner-Wellen sind ein Klassiker, um Ozeanschwellen in Echtzeit zu faken — Gipfel und Täler, die mehr nach Wasser aussehen als eine flache Ripple-Textur. Hier liegen sie unter einem prozeduralen Himmel, damit Sie Titel oder Icon komponieren und capturen können.

**Kurzes Glossar**

- **Gerstner wave** — ein mathematisches Schwellenmodell für Echtzeit-Ozeane
- **Procedural sky** — Himmelsfarbe und Sonne im Shader berechnet, nicht nur Foto-Dome
- **Glass 3D text** — extrudierter Typ mit refraktivem/transparentem Shading
- **WebGL video export** — Frames vom Canvas in einen kurzen Clip aufnehmen

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [Three.js Ocean Demo](/demos/ocean/)
2. Orbitieren, bis Horizont und Sonne klar lesen (Sunset-Preset probieren)
3. Glass-3D-Text / Icons hinzufügen oder bearbeiten, wenn die UI sie bietet
4. Wallpaper-Screenshot capturen oder kurzen Video-Export starten (≤30s)

## Anforderungen und Performance

- **Browser:** moderner Chrome/Edge empfohlen für Capture und Export
- **GPU:** integrierte Grafik meist ausreichend; Qualität senken, wenn Lüfter hochdrehen
- **Export:** Video-Capture ist schwerer — andere Tabs schließen für sauberen Take

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Sunset-Ocean — Horizont und Schwellung](/assets/blog/threejs-ocean/view-a.jpg?v=20260722a)

![Titel-Lockup — Glass-Text über Wasser](/assets/blog/threejs-ocean/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Social-/Wallpaper-Stills ohne Browser-Verlassen erzeugen
- Event-Titel prototypen vor Handoff an Motion Design
- Technik mit der Scroll-Narrative in [Dream](/blog/iom-three) vergleichen

## So funktioniert es

Aufgebaut auf der three.js Ocean/Water-Linie ([webgl_shaders_ocean Beispielquelle](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html)) mit IOM-UI für Text, Presets, Screenshots und kurze Canvas-Aufnahme. [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) treibt Wasser und Himmel pro Frame; Export ist eine zeitgesteuerte Aufnahme desselben Canvas.

## FAQ

**Können wir den Clip kommerziell nutzen?**  
Behandeln Sie die öffentliche Demo als Preview. Fragen Sie uns nach einem lizenzierten oder gebrandeten Export-Paket für Kampagnen.

**Ist das dasselbe wie Dream — Ocean scroll?**  
Nein. Das ist eine orbitierbare Ocean-Platte mit Export-Tools; Dream ist ein Scroll-Narrative-Kapitel unter [/demos/dreams-iom/](/demos/dreams-iom/).

## Tech-Stack und weiterführende Links

- [Ocean Demo](/demos/ocean/)
- [three.js Ocean Beispielquelle](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html)
- [Three.js](https://threejs.org/)
- [Gerstner wave — Wikipedia](https://en.wikipedia.org/wiki/Trochoidal_wave)

## Verwandt bei IOM

Mehr in [3D](/#3d), plus [Dream — Ocean scroll](/blog/iom-three), [Art Gallery — SSR + Denoise](/blog/ssr-denoise), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$Three.js Ocean — Gerstner-Wellen, Himmel und Export — IOM$iom$,
  $iom$Brauchen Sie eine Hero-Wasserplatte, die Sie in Minuten branden können? Diese Ocean-Demo fährt Gerstner-Wave-Wasser mit prozeduralem Himmel und Sunset-Preset — Glass-3D-Text (Googl$iom$
from public.blog_posts p
where p.slug = $iom$threejs-ocean$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$Three.js Ocean — vagues Gerstner, ciel et export$iom$,
  $iom$Besoin d'une assiette eau hero brandable en minutes ? Cette démo océan exécute de l'eau à vagues Gerstner avec ciel procédural et preset sunset — déposez du texte 3D verre (Google $iom$,
  $iom$Besoin d'une assiette eau hero brandable en minutes ? Cette démo océan exécute de l'eau à vagues Gerstner avec ciel procédural et preset sunset — déposez du texte 3D verre (Google Fonts), icônes décoratives, capturez des wallpapers ou exportez jusqu'à 30 secondes de vidéo WebGL.

Il se trouve dans notre [section 3D](/#3d) sous **Three.js Ocean**. La couverture montre le cadrage océan sunset de la carte 3D.

## Ouvrir la démo en direct

**[→ Lancer Three.js Ocean](/demos/ocean/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Eau lisible vite** — vagues Gerstner et ciel sans ferme de rendu film
- **Typo sur l'eau** — texte 3D verre avec Google Fonts pour les titres
- **Preset sunset** — une ambiance one-click pour pitches et lockups
- **Livrables** — stills wallpaper ou court export vidéo WebGL

Usages typiques : heroes de landing, assiettes key art d'événement, wallpapers sociaux, et comps rapides « moment marque océan » avant une passe R&D eau custom.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Les vagues Gerstner sont un classique pour simuler des houles océan en temps réel — crêtes et creux qui ressemblent plus à de l'eau qu'à une texture ripple plate. Ici elles sont sous un ciel procédural pour composer un titre ou une icône et le capturer.

**Glossaire rapide**

- **Gerstner wave** — un modèle mathématique de houle utilisé dans les océans temps réel
- **Procedural sky** — couleur de ciel et soleil calculées en shader, pas seulement un dôme photo
- **Glass 3D text** — typo extrudée avec shading réfractif/transparent
- **WebGL video export** — enregistrement de frames du canvas en clip court

## Essayez en environ 60 secondes

1. Ouvrez la [démo Three.js Ocean](/demos/ocean/)
2. Orbitez jusqu'à ce que l'horizon et le soleil se lisent clairement (essayez le preset sunset)
3. Ajoutez ou éditez texte 3D verre / icônes si l'UI les propose
4. Capturez un screenshot wallpaper ou lancez un court export vidéo (≤30s)

## Prérequis et performances

- **Navigateur :** Chrome/Edge moderne recommandé pour capture et export
- **GPU :** graphiques intégrés suffisent généralement ; baissez la qualité si les ventilateurs tournent
- **Export :** la capture vidéo est plus lourde — fermez les autres onglets pour un take propre

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Océan sunset — horizon et houle](/assets/blog/threejs-ocean/view-a.jpg?v=20260722a)

![Lockup titre — texte verre sur l'eau](/assets/blog/threejs-ocean/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Générer des stills social/wallpaper sans quitter le navigateur
- Prototyper des titres d'événement avant handoff au motion design
- Comparer la technique avec le récit scroll dans [Dream](/blog/iom-three)

## Comment ça marche

Construit sur la lignée océan/eau three.js ([source exemple webgl_shaders_ocean](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html)) avec UI IOM pour texte, presets, screenshots et courte capture canvas. [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) pilote eau et ciel à chaque frame ; l'export est une capture temporisée du même canvas.

## FAQ

**Peut-on utiliser le clip commercialement ?**  
Traitez la démo publique comme un aperçu. Demandez-nous un pack d'export licencié ou brandé pour les campagnes.

**Est-ce la même chose que Dream — Ocean scroll ?**  
Non. C'est une assiette océan orbitable avec outils d'export ; Dream est un chapitre narratif scroll sur [/demos/dreams-iom/](/demos/dreams-iom/).

## Stack technique et lectures

- [Démo Ocean](/demos/ocean/)
- [Source exemple océan three.js](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html)
- [Three.js](https://threejs.org/)
- [Vague Gerstner — Wikipedia](https://en.wikipedia.org/wiki/Trochoidal_wave)

## Sur IOM

Parcourez [3D](/#3d), plus [Dream — Ocean scroll](/blog/iom-three), [Art Gallery — SSR + Denoise](/blog/ssr-denoise), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$Three.js Ocean — vagues Gerstner, ciel et export — IOM$iom$,
  $iom$Besoin d'une assiette eau hero brandable en minutes ? Cette démo océan exécute de l'eau à vagues Gerstner avec ciel procédural et preset sunset — déposez du texte 3D verre (Google $iom$
from public.blog_posts p
where p.slug = $iom$threejs-ocean$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$Three.js Ocean — Gerstner-golven, lucht en export$iom$,
  $iom$Een hero-waterplaat nodig die u in minuten kunt branden? Deze ocean-demo draait Gerstner-wave-water met procedurele lucht en sunset-preset — plaats glass 3D-tekst (Google Fonts), d$iom$,
  $iom$Een hero-waterplaat nodig die u in minuten kunt branden? Deze ocean-demo draait Gerstner-wave-water met procedurele lucht en sunset-preset — plaats glass 3D-tekst (Google Fonts), decoratieve iconen, pak wallpaper-screenshots of exporteer tot 30 seconden WebGL-video.

Het staat in onze [3D-sectie](/#3d) als **Three.js Ocean**. De cover toont de sunset-ocean-framing van de 3D-kaart.

## Open de live demo

**[→ Start Three.js Ocean](/demos/ocean/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Leesbaar water snel** — Gerstner-golven en lucht zonder film-renderfarm
- **Typo op het water** — glass 3D-tekst met Google Fonts voor titels
- **Sunset-preset** — one-click-sfeer voor pitches en lockups
- **Takeaways** — wallpaper-stills of korte WebGL-video-export

Typische toepassingen: landing-heroes, event key art-platen, social wallpapers en snelle „ocean brand moment“-comps vóór een custom water R&D-pass.

## Voor beginners — wat is dit, in gewone taal?

Gerstner-golven zijn een klassieke manier om oceaangolven realtime te faken — pieken en dalen die meer op water lijken dan een vlakke ripple-textuur. Hier liggen ze onder een procedurele lucht zodat u titel of icoon kunt componeren en capturen.

**Korte glossary**

- **Gerstner wave** — een wiskundig deiningmodel gebruikt in realtime oceanen
- **Procedural sky** — luchtkleur en zon berekend in shader, niet alleen fotodome
- **Glass 3D text** — extrudeerde typo met refractief/transparant shading
- **WebGL video export** — frames van het canvas opnemen in een korte clip

## Probeer dit in ongeveer 60 seconden

1. Open de [Three.js Ocean-demo](/demos/ocean/)
2. Orbit tot horizon en zon duidelijk lezen (probeer sunset-preset)
3. Voeg glass 3D-tekst / iconen toe of bewerk ze als de UI ze biedt
4. Capture wallpaper-screenshot of start korte video-export (≤30s)

## Vereisten en performance

- **Browser:** moderne Chrome/Edge aanbevolen voor capture en export
- **GPU:** geïntegreerde grafiek meestal prima; verlaag kwaliteit als ventilatoren opdraaien
- **Export:** video-capture is zwaarder — sluit andere tabs voor schone take

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Sunset-ocean — horizon en deining](/assets/blog/threejs-ocean/view-a.jpg?v=20260722a)

![Titel-lockup — glass-tekst over water](/assets/blog/threejs-ocean/view-b.jpg?v=20260722a)

Ook in deze build:

- Genereer social/wallpaper-stills zonder de browser te verlaten
- Prototype eventtitels vóór handoff aan motion design
- Vergelijk techniek met het scroll-verhaal in [Dream](/blog/iom-three)

## Hoe het werkt

Gebouwd op de three.js ocean/water-lijn ([webgl_shaders_ocean voorbeeldbron](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html)) met IOM-UI voor tekst, presets, screenshots en korte canvas-opname. [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) drijft water en lucht per frame; export is een getimede capture van hetzelfde canvas.

## FAQ

**Kunnen we de clip commercieel gebruiken?**  
Behandel de publieke demo als preview. Vraag ons om een gelicenseerd of gebrand exportpakket voor campagnes.

**Is dit hetzelfde als Dream — Ocean scroll?**  
Nee. Dit is een orbitbare ocean-plaat met exporttools; Dream is een scroll-verhaalhoofdstuk op [/demos/dreams-iom/](/demos/dreams-iom/).

## Tech stack en verder lezen

- [Ocean-demo](/demos/ocean/)
- [three.js ocean voorbeeldbron](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html)
- [Three.js](https://threejs.org/)
- [Gerstner wave — Wikipedia](https://en.wikipedia.org/wiki/Trochoidal_wave)

## Gerelateerd op IOM

Bekijk meer in [3D](/#3d), plus [Dream — Ocean scroll](/blog/iom-three), [Art Gallery — SSR + Denoise](/blog/ssr-denoise), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$Three.js Ocean — Gerstner-golven, lucht en export — IOM$iom$,
  $iom$Een hero-waterplaat nodig die u in minuten kunt branden? Deze ocean-demo draait Gerstner-wave-water met procedurele lucht en sunset-preset — plaats glass 3D-tekst (Google Fonts), d$iom$
from public.blog_posts p
where p.slug = $iom$threejs-ocean$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$Three.js Ocean — onde Gerstner, cielo ed export$iom$,
  $iom$Serve una piastra acqua hero brandizzabile in minuti? Questa demo oceano esegue acqua Gerstner-wave con cielo procedurale e preset sunset — posiziona testo 3D vetro (Google Fonts),$iom$,
  $iom$Serve una piastra acqua hero brandizzabile in minuti? Questa demo oceano esegue acqua Gerstner-wave con cielo procedurale e preset sunset — posiziona testo 3D vetro (Google Fonts), icone decorative, cattura wallpaper o esporta fino a 30 secondi di video WebGL.

Si trova nella nostra [sezione 3D](/#3d) come **Three.js Ocean**. La cover mostra il framing oceano sunset dalla card 3D.

## Apri la demo live

**[→ Avvia Three.js Ocean](/demos/ocean/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Acqua leggibile in fretta** — onde Gerstner e cielo senza render farm da film
- **Tipo sull'acqua** — testo 3D vetro con Google Fonts per titoli
- **Preset sunset** — mood one-click per pitch e lockup
- **Takeaway** — still wallpaper o breve export video WebGL

Usi tipici: hero landing, piastre key art eventi, wallpaper social, e comp rapide «momento brand oceano» prima di un pass R&D acqua custom.

## Per principianti — cos’è, in parole semplici?

Le onde Gerstner sono un classico per simulare mare in realtime — picchi e valli che sembrano più acqua di una texture ripple piatta. Qui stanno sotto un cielo procedurale così componi titolo o icona e catturi.

**Glossario rapido**

- **Gerstner wave** — un modello matematico di mare usato negli oceani realtime
- **Procedural sky** — colore cielo e sole calcolati in shader, non solo cupola foto
- **Glass 3D text** — tipo estruso con shading rifrattivo/trasparente
- **WebGL video export** — registrazione frame dal canvas in clip breve

## Provalo in circa 60 secondi

1. Apri la [demo Three.js Ocean](/demos/ocean/)
2. Orbita finché orizzonte e sole si leggono chiaramente (prova preset sunset)
3. Aggiungi o modifica testo 3D vetro / icone se l'UI li offre
4. Cattura screenshot wallpaper o avvia breve export video (≤30s)

## Requisiti e prestazioni

- **Browser:** Chrome/Edge moderno consigliato per capture ed export
- **GPU:** grafica integrata di solito basta; abbassa qualità se le ventole girano
- **Export:** la capture video pesa di più — chiudi altre tab per take pulito

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Oceano sunset — orizzonte e mareggiata](/assets/blog/threejs-ocean/view-a.jpg?v=20260722a)

![Lockup titolo — testo vetro sull'acqua](/assets/blog/threejs-ocean/view-b.jpg?v=20260722a)

Anche in questa build:

- Genera still social/wallpaper senza uscire dal browser
- Prototipa titoli evento prima del handoff al motion design
- Confronta tecnica con la narrativa scroll in [Dream](/blog/iom-three)

## Come funziona

Costruito sulla linea ocean/water three.js ([sorgente esempio webgl_shaders_ocean](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html)) con UI IOM per testo, preset, screenshot e breve registrazione canvas. [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) guida acqua e cielo ogni frame; l'export è una capture temporizzata dello stesso canvas.

## FAQ

**Possiamo usare la clip commercialmente?**  
Tratta la demo pubblica come anteprima. Chiedici un pacchetto export licenziato o brandizzato per campagne.

**È uguale a Dream — Ocean scroll?**  
No. Questa è una piastra oceano orbitabile con tool export; Dream è un capitolo narrativo scroll su [/demos/dreams-iom/](/demos/dreams-iom/).

## Stack tecnico e letture

- [Demo Ocean](/demos/ocean/)
- [Sorgente esempio ocean three.js](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html)
- [Three.js](https://threejs.org/)
- [Onda Gerstner — Wikipedia](https://en.wikipedia.org/wiki/Trochoidal_wave)

## Correlati su IOM

Esplora di più in [3D](/#3d), più [Dream — Ocean scroll](/blog/iom-three), [Art Gallery — SSR + Denoise](/blog/ssr-denoise), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$Three.js Ocean — onde Gerstner, cielo ed export — IOM$iom$,
  $iom$Serve una piastra acqua hero brandizzabile in minuti? Questa demo oceano esegue acqua Gerstner-wave con cielo procedurale e preset sunset — posiziona testo 3D vetro (Google Fonts),$iom$
from public.blog_posts p
where p.slug = $iom$threejs-ocean$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$Three.js Ocean — olas Gerstner, cielo y exportación$iom$,
  $iom$¿Necesitas una placa de agua hero que puedas brandear en minutos? Esta demo océano ejecuta agua Gerstner-wave con cielo procedural y preset sunset — coloca texto 3D de vidrio (Goog$iom$,
  $iom$¿Necesitas una placa de agua hero que puedas brandear en minutos? Esta demo océano ejecuta agua Gerstner-wave con cielo procedural y preset sunset — coloca texto 3D de vidrio (Google Fonts), iconos decorativos, captura wallpapers o exporta hasta 30 segundos de vídeo WebGL.

Está en nuestra [sección 3D](/#3d) como **Three.js Ocean**. La portada muestra el encuadre océano sunset de la tarjeta 3D.

## Abrir la demo en vivo

**[→ Lanzar Three.js Ocean](/demos/ocean/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Agua legible rápido** — olas Gerstner y cielo sin granja de render de cine
- **Tipografía sobre el agua** — texto 3D de vidrio con Google Fonts para títulos
- **Preset sunset** — mood one-click para pitches y lockups
- **Entregables** — stills wallpaper o exportación corta de vídeo WebGL

Usos típicos: heroes de landing, placas key art de eventos, wallpapers sociales, y comps rápidas de «momento marca océano» antes de un pase R&D de agua custom.

## Para principiantes — ¿qué es esto, en palabras simples?

Las olas Gerstner son un clásico para simular oleaje oceánico en tiempo real — picos y valles que parecen más agua que una textura ripple plana. Aquí están bajo un cielo procedural para componer título o icono y capturarlo.

**Glosario rápido**

- **Gerstner wave** — un modelo matemático de oleaje usado en océanos en tiempo real
- **Procedural sky** — color de cielo y sol calculados en shader, no solo cúpula foto
- **Glass 3D text** — tipografía extruida con shading refractivo/transparente
- **WebGL video export** — grabación de frames del canvas en clip corto

## Pruébalo en unos 60 segundos

1. Abre la [demo Three.js Ocean](/demos/ocean/)
2. Orbita hasta que horizonte y sol se lean claramente (prueba preset sunset)
3. Añade o edita texto 3D de vidrio / iconos si la UI los ofrece
4. Captura screenshot wallpaper o inicia exportación corta de vídeo (≤30s)

## Requisitos y rendimiento

- **Navegador:** Chrome/Edge moderno recomendado para captura y exportación
- **GPU:** gráficos integrados suelen bastar; baja calidad si suben ventiladores
- **Exportación:** captura de vídeo pesa más — cierra otras pestañas para take limpio

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Océano sunset — horizonte y oleaje](/assets/blog/threejs-ocean/view-a.jpg?v=20260722a)

![Lockup de título — texto de vidrio sobre el agua](/assets/blog/threejs-ocean/view-b.jpg?v=20260722a)

También en este build:

- Genera stills social/wallpaper sin salir del navegador
- Prototipa títulos de evento antes del handoff a motion design
- Compara técnica con la narrativa scroll en [Dream](/blog/iom-three)

## Cómo funciona

Construido sobre la línea ocean/water three.js ([fuente ejemplo webgl_shaders_ocean](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html)) con UI IOM para texto, presets, screenshots y captura corta de canvas. [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) impulsa agua y cielo cada frame; la exportación es una captura temporizada del mismo canvas.

## FAQ

**¿Podemos usar el clip comercialmente?**  
Trata la demo pública como preview. Pídenos un paquete de exportación licenciado o con marca para campañas.

**¿Es lo mismo que Dream — Ocean scroll?**  
No. Esta es una placa océano orbitable con herramientas de exportación; Dream es un capítulo narrativo scroll en [/demos/dreams-iom/](/demos/dreams-iom/).

## Stack técnico y lecturas

- [Demo Ocean](/demos/ocean/)
- [Fuente ejemplo ocean three.js](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html)
- [Three.js](https://threejs.org/)
- [Ola Gerstner — Wikipedia](https://en.wikipedia.org/wiki/Trochoidal_wave)

## Relacionado en IOM

Explora más en [3D](/#3d), más [Dream — Ocean scroll](/blog/iom-three), [Art Gallery — SSR + Denoise](/blog/ssr-denoise), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$Three.js Ocean — olas Gerstner, cielo y exportación — IOM$iom$,
  $iom$¿Necesitas una placa de agua hero que puedas brandear en minutos? Esta demo océano ejecuta agua Gerstner-wave con cielo procedural y preset sunset — coloca texto 3D de vidrio (Goog$iom$
from public.blog_posts p
where p.slug = $iom$threejs-ocean$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$The Black Witness — 360° visitor tour$iom$,
  $iom$Same raven, many worlds — city, forest, mountain, mist. This visitor preview opens The Black Witness tour without editor chrome, framed at yaw −84.7° and pitch −6°, with hotspots, $iom$,
  $iom$Same raven, many worlds — city, forest, mountain, mist. This visitor preview opens The Black Witness tour without editor chrome, framed at yaw −84.7° and pitch −6°, with hotspots, guided steps, and optional WebGPU atmosphere.

It lives in our [360 Tours section](/#360) as **The Black Witness**. The cover is guided-tour step 1 — The Black Witness raven hotspot with popup open.

## Open the live demo

**[→ Launch The Black Witness — 360° Tour](/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Visitor-first link** — no editor UI; guests only see the tour
- **Guided steps** — a path through the story, not only free look
- **Hotspots with meaning** — info and jumps that teach as you explore
- **Shareable framing** — deep-link yaw/pitch so the first view is intentional

Typical uses: exhibition companions, photography series launches, booth attract loops, and client proofs of how a finished 360 story feels on a phone or laptop.

## For beginners — what is this, in plain words?

You are standing inside a 360° photograph. Drag to look around; tap markers to learn or move to the next place. Preview mode is the “guest ticket” — the editor is how we build it; this link is how audiences experience it.

**Quick glossary**

- **Visitor preview** — tour mode without editing tools (`mode=preview`)
- **Yaw / pitch** — horizontal and vertical look angles for the starting view
- **Guided tour** — ordered stops the experience can advance through
- **Hotspot** — a tappable marker for info or the next scene

## Try this in about 60 seconds

1. Open the [Black Witness visitor tour](/demos/panorama-360/?mode=preview)
2. Click **Play guided tour** — four camera stops with popups and effects
3. Open a hotspot yourself after stopping the tour
4. Share the preview URL so colleagues land in the same experience

## Requirements and performance

- **Browser:** modern mobile or desktop browser; WebGPU effects need a capable device
- **Network:** panoramas are image-heavy — prefer Wi‑Fi for first load
- **Input:** touch drag or mouse; headset not required

## What you see

The cover is guided-tour step 1; the stills below continue the same Black Witness walkthrough:

![Step 2 — animated fire hotspot and particle popup](/assets/blog/panorama-suite/view-a.jpg?v=20260722a)

![Step 3 — water / spout beat on the rooftop](/assets/blog/panorama-suite/view-b.jpg?v=20260722a)

![Step 4 — Animated birds popup with the flock against the storm sky](/assets/blog/panorama-suite/view-c.jpg?v=20260722a)

Also in this build:

- Jump to the [editor](/demos/panorama-360/) when you need to author hotspots
- Reuse the deep-link pattern for branded first views on other projects
- Follow the effects stack: [particles](/blog/webgpu-particles) → [spout](/blog/spout) → [birds](/blog/webgpu-compute-birds)

## How it works

Preview reuses the same panorama engine as the [360° Tour Editor](/blog/panorama-360-tour), but URL flags hide authoring chrome and set the initial camera (`yaw`, `pitch`). Hotspots and guided steps are project data over equirectangular scenes — [Three.js](https://threejs.org/) for the sphere camera, optional [WebGPU](https://en.wikipedia.org/wiki/WebGPU) layers for atmosphere. On The Black Witness, Step 2 layers [particles](/blog/webgpu-particles), Step 3 [spout](/blog/spout), and Step 4 [birds](/blog/webgpu-compute-birds) — each with hotspot+popup so guests get motion timed to a clickable story beat.

## FAQ

**Why does my view start in a specific direction?**  
The link sets yaw −84.7° and pitch −6° so everyone shares the same opening composition.

**Can I edit hotspots from this URL?**  
Not in preview. Use the [tour editor](/demos/panorama-360/) (or ask us for a production authoring build).

**What are the effect layers on steps 2–4?**  
Step 2 particles, Step 3 spout/water, Step 4 birds — each paired with a hotspot popup. The standalone experiment pages document the same tech.

## Tech stack and further reading

- [Visitor tour link](/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6)
- [Tour editor](/demos/panorama-360/)
- [Three.js](https://threejs.org/)
- [WebGPU — Wikipedia](https://en.wikipedia.org/wiki/WebGPU)

## Related on IOM

Browse more in [360 Tours](/#360), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [WebGPU Particles](/blog/webgpu-particles), [Spout](/blog/spout), [WebGPU Compute Birds](/blog/webgpu-compute-birds), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$The Black Witness — 360° visitor tour — IOM$iom$,
  $iom$Same raven, many worlds — city, forest, mountain, mist. This visitor preview opens The Black Witness tour without editor chrome, framed at yaw −84.7° and pitch −6°, with hotspots, $iom$
from public.blog_posts p
where p.slug = $iom$panorama-suite$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$The Black Witness — 360° Besuchertour$iom$,
  $iom$Derselbe Rabe, viele Welten — Stadt, Wald, Berg, Nebel. Diese Besuchervorschau öffnet The Black Witness Tour ohne Editor-Chrome, gerahmt bei Yaw −84,7° und Pitch −6°, mit Hotspots,$iom$,
  $iom$Derselbe Rabe, viele Welten — Stadt, Wald, Berg, Nebel. Diese Besuchervorschau öffnet The Black Witness Tour ohne Editor-Chrome, gerahmt bei Yaw −84,7° und Pitch −6°, mit Hotspots, geführten Schritten und optionaler WebGPU-Atmosphäre.

Es liegt in unserem [360°-Touren-Bereich](/#360) als **The Black Witness**. Das Cover ist geführter Tour-Schritt 1 — The Black Witness Rabe-Hotspot mit geöffnetem Popup.

## Live-Demo öffnen

**[→ The Black Witness — 360° Tour starten](/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Besucherorientierter Link** — keine Editor-UI; Gäste sehen nur die Tour
- **Geführte Schritte** — ein Pfad durch die Geschichte, nicht nur freies Umsehen
- **Hotspots mit Bedeutung** — Info und Sprünge, die beim Erkunden lehren
- **Teilbares Framing** — Deep-Link Yaw/Pitch, damit die erste Ansicht bewusst gesetzt ist

Typische Einsätze: Ausstellungsbegleiter, Fotoserien-Launches, Messe-Attract-Loops und Kundenproofs, wie eine fertige 360°-Story auf dem Handy oder Laptop wirkt.

## Für Einsteiger — was ist das, in einfachen Worten?

Sie stehen in einem 360°-Foto. Ziehen zum Umsehen; tippen Sie Marker, um zu lernen oder zum nächsten Ort zu springen. Der Preview-Modus ist das „Gästeticket“ — der Editor ist, wie wir bauen; dieser Link ist, wie Publikum es erlebt.

**Kurzes Glossar**

- **Besuchervorschau** — Tour-Modus ohne Bearbeitungswerkzeuge (`mode=preview`)
- **Yaw / Pitch** — horizontale und vertikale Blickwinkel für die Startansicht
- **Geführte Tour** — geordnete Stopps, durch die die Experience voranschreiten kann
- **Hotspot** — ein antippbarer Marker für Info oder die nächste Szene

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [Black Witness Besuchertour](/demos/panorama-360/?mode=preview)
2. Klicken Sie **Play guided tour** — vier Kamera-Stopps mit Popups und Effekten
3. Öffnen Sie nach dem Stoppen der Tour selbst einen Hotspot
4. Teilen Sie die Preview-URL, damit Kollegen dieselbe Experience landen

## Anforderungen und Performance

- **Browser:** moderner Mobile- oder Desktop-Browser; WebGPU-Effekte brauchen ein leistungsfähiges Gerät
- **Netzwerk:** Panoramen sind bildlastig — Wi‑Fi für den ersten Load bevorzugen
- **Input:** Touch-Ziehen oder Maus; Headset nicht erforderlich

## Was Sie sehen

Das Cover ist Guided-Tour-Schritt 1; die Stillbilder darunter setzen denselben Black-Witness-Rundgang fort:

![Schritt 2 — animierter Feuer-Hotspot und Partikel-Popup](/assets/blog/panorama-suite/view-a.jpg?v=20260722a)

![Schritt 3 — Wasser-/Spout-Beat auf dem Dach](/assets/blog/panorama-suite/view-b.jpg?v=20260722a)

![Schritt 4 — Animierter Vögel-Popup mit der Schar gegen den Sturmhimmel](/assets/blog/panorama-suite/view-c.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Zum [Editor](/demos/panorama-360/) springen, wenn Sie Hotspots authorn müssen
- Das Deep-Link-Muster für gebrandete Erstansichten in anderen Projekten wiederverwenden
- Dem Effekt-Stack folgen: [Particles](/blog/webgpu-particles) → [Spout](/blog/spout) → [Birds](/blog/webgpu-compute-birds)

## So funktioniert es

Preview nutzt dieselbe Panorama-Engine wie der [360° Tour Editor](/blog/panorama-360-tour), aber URL-Flags verbergen Authoring-Chrome und setzen die Startkamera (`yaw`, `pitch`). Hotspots und geführte Schritte sind Projektdaten über equirectangular Szenen — [Three.js](https://threejs.org/) für Kamera und Kugel, optionale [WebGPU](https://en.wikipedia.org/wiki/WebGPU)-Layer für Atmosphäre. Bei The Black Witness legt Schritt 2 [Particles](/blog/webgpu-particles), Schritt 3 [Spout](/blog/spout) und Schritt 4 [Birds](/blog/webgpu-compute-birds) — jeweils mit Hotspot+Popup, damit Gäste Bewegung zu einem klickbaren Story-Beat bekommen.

## FAQ

**Warum startet meine Ansicht in eine bestimmte Richtung?**  
Der Link setzt Yaw −84,7° und Pitch −6°, damit alle dieselbe Eröffnungskomposition teilen.

**Kann ich Hotspots über diese URL bearbeiten?**  
Nicht in Preview. Nutzen Sie den [Tour Editor](/demos/panorama-360/) (oder fragen Sie uns nach einem Production-Authoring-Build).

**Was sind die Effekt-Layer in Schritten 2–4?**  
Schritt 2 Particles, Schritt 3 Spout/Wasser, Schritt 4 Birds — jeweils mit Hotspot-Popup. Die standalone Experiment-Seiten dokumentieren dieselbe Tech.

## Tech-Stack und weiterführende Links

- [Besuchertour-Link](/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6)
- [Tour Editor](/demos/panorama-360/)
- [Three.js](https://threejs.org/)
- [WebGPU — Wikipedia](https://en.wikipedia.org/wiki/WebGPU)

## Verwandt bei IOM

Mehr in [360°-Touren](/#360), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [WebGPU Particles](/blog/webgpu-particles), [Spout](/blog/spout), [WebGPU Compute Birds](/blog/webgpu-compute-birds), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$The Black Witness — 360° Besuchertour — IOM$iom$,
  $iom$Derselbe Rabe, viele Welten — Stadt, Wald, Berg, Nebel. Diese Besuchervorschau öffnet The Black Witness Tour ohne Editor-Chrome, gerahmt bei Yaw −84,7° und Pitch −6°, mit Hotspots,$iom$
from public.blog_posts p
where p.slug = $iom$panorama-suite$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$The Black Witness — visite 360° visiteur$iom$,
  $iom$Le même corbeau, de nombreux mondes — ville, forêt, montagne, brume. Cet aperçu visiteur ouvre la tour The Black Witness sans chrome d'éditeur, cadré à yaw −84,7° et pitch −6°, ave$iom$,
  $iom$Le même corbeau, de nombreux mondes — ville, forêt, montagne, brume. Cet aperçu visiteur ouvre la tour The Black Witness sans chrome d'éditeur, cadré à yaw −84,7° et pitch −6°, avec hotspots, étapes guidées et atmosphère WebGPU optionnelle.

Il se trouve dans notre [section Visites 360°](/#360) sous **The Black Witness**. La couverture est l'étape 1 de la visite guidée — hotspot corbeau The Black Witness avec popup ouvert.

## Ouvrir la démo en direct

**[→ Lancer The Black Witness — Tour 360°](/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Lien visiteur d'abord** — pas d'UI éditeur ; les invités ne voient que la tour
- **Étapes guidées** — un parcours dans l'histoire, pas seulement le regard libre
- **Hotspots porteurs de sens** — info et sauts qui enseignent en explorant
- **Cadrage partageable** — deep-link yaw/pitch pour une première vue intentionnelle

Usages typiques : compagnons d'exposition, lancements de séries photo, boucles d'attraction stand et preuves client de ce qu'une histoire 360° finie ressent sur téléphone ou laptop.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Vous êtes debout dans une photographie 360°. Glissez pour regarder ; touchez les marqueurs pour apprendre ou aller au lieu suivant. Le mode preview est le « billet invité » — l'éditeur sert à construire ; ce lien est comment le public vit l'expérience.

**Glossaire rapide**

- **Aperçu visiteur** — mode tour sans outils d'édition (`mode=preview`)
- **Yaw / pitch** — angles de regard horizontal et vertical pour la vue de départ
- **Visite guidée** — arrêts ordonnés que l'expérience peut enchaîner
- **Hotspot** — un marqueur cliquable pour info ou la scène suivante

## Essayez en environ 60 secondes

1. Ouvrir la [tour visiteur Black Witness](/demos/panorama-360/?mode=preview)
2. Cliquer **Play guided tour** — quatre arrêts caméra avec popups et effets
3. Ouvrir un hotspot vous-même après avoir arrêté la tour
4. Partager l'URL preview pour que les collègues arrivent dans la même expérience

## Prérequis et performances

- **Navigateur :** navigateur mobile ou desktop moderne ; les effets WebGPU demandent un appareil capable
- **Réseau :** panoramas lourds en images — préférer le Wi‑Fi au premier chargement
- **Entrée :** glisser tactile ou souris ; casque non requis

## Ce que vous voyez

La couverture est l’étape 1 de la visite guidée ; les images ci-dessous poursuivent le même parcours Black Witness :

![Étape 2 — hotspot feu animé et popup particules](/assets/blog/panorama-suite/view-a.jpg?v=20260722a)

![Étape 3 — beat eau / spout sur le toit](/assets/blog/panorama-suite/view-b.jpg?v=20260722a)

![Étape 4 — popup oiseaux animés avec la volée contre le ciel d'orage](/assets/blog/panorama-suite/view-c.jpg?v=20260722a)

Aussi dans ce build :

- Aller à l'[éditeur](/demos/panorama-360/) quand vous devez authorer des hotspots
- Réutiliser le pattern deep-link pour des premières vues brandées sur d'autres projets
- Suivre la pile d'effets : [particles](/blog/webgpu-particles) → [spout](/blog/spout) → [birds](/blog/webgpu-compute-birds)

## Comment ça marche

Preview réutilise le même moteur panorama que l'[éditeur de tour 360°](/blog/panorama-360-tour), mais les flags URL masquent le chrome d'authoring et fixent la caméra initiale (`yaw`, `pitch`). Hotspots et étapes guidées sont des données projet sur scènes équirectangulaires — [Three.js](https://threejs.org/) pour la sphère caméra, couches [WebGPU](https://en.wikipedia.org/wiki/WebGPU) optionnelles pour l'atmosphère. Sur The Black Witness, l'étape 2 superpose [particles](/blog/webgpu-particles), l'étape 3 [spout](/blog/spout) et l'étape 4 [birds](/blog/webgpu-compute-birds) — chacune avec hotspot+popup pour que les invités aient du mouvement calé sur un beat narratif cliquable.

## FAQ

**Pourquoi ma vue démarre dans une direction précise ?**  
Le lien fixe yaw −84,7° et pitch −6° pour que tout le monde partage la même composition d'ouverture.

**Puis-je éditer les hotspots depuis cette URL ?**  
Pas en preview. Utilisez l'[éditeur de tour](/demos/panorama-360/) (ou demandez-nous un build d'authoring production).

**Quelles sont les couches d'effet aux étapes 2–4 ?**  
Étape 2 particles, étape 3 spout/eau, étape 4 birds — chacune avec popup hotspot. Les pages d'expérience standalone documentent la même tech.

## Stack technique et lectures

- [Lien tour visiteur](/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6)
- [Éditeur de tour](/demos/panorama-360/)
- [Three.js](https://threejs.org/)
- [WebGPU — Wikipedia](https://en.wikipedia.org/wiki/WebGPU)

## Sur IOM

Parcourez [Visites 360°](/#360), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [WebGPU Particles](/blog/webgpu-particles), [Spout](/blog/spout), [WebGPU Compute Birds](/blog/webgpu-compute-birds), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$The Black Witness — visite 360° visiteur — IOM$iom$,
  $iom$Le même corbeau, de nombreux mondes — ville, forêt, montagne, brume. Cet aperçu visiteur ouvre la tour The Black Witness sans chrome d'éditeur, cadré à yaw −84,7° et pitch −6°, ave$iom$
from public.blog_posts p
where p.slug = $iom$panorama-suite$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$The Black Witness — 360° bezoekerstour$iom$,
  $iom$Dezelfde raaf, vele werelden — stad, bos, berg, mist. Deze bezoekerspreview opent The Black Witness tour zonder editor-chrome, geframed op yaw −84,7° en pitch −6°, met hotspots, be$iom$,
  $iom$Dezelfde raaf, vele werelden — stad, bos, berg, mist. Deze bezoekerspreview opent The Black Witness tour zonder editor-chrome, geframed op yaw −84,7° en pitch −6°, met hotspots, begeleide stappen en optionele WebGPU-atmosfeer.

Het staat in onze [360°-tours-sectie](/#360) als **The Black Witness**. De cover is begeleide tour stap 1 — The Black Witness raaf-hotspot met popup open.

## Open de live demo

**[→ Start The Black Witness — 360° Tour](/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Bezoeker-eerst link** — geen editor-UI; gasten zien alleen de tour
- **Begeleide stappen** — een pad door het verhaal, niet alleen vrij rondkijken
- **Hotspots met betekenis** — info en sprongen die leren terwijl je verkent
- **Deelbaar framing** — deep-link yaw/pitch zodat het eerste beeld bewust is

Typische toepassingen: tentoonstellingsbegeleiders, fotoserie-launches, stand-attract loops en klantproofs van hoe een afgerond 360°-verhaal aanvoelt op telefoon of laptop.

## Voor beginners — wat is dit, in gewone taal?

U staat in een 360°-foto. Sleep om rond te kijken; tik op markers om te leren of naar de volgende plek te gaan. Preview-modus is het „gastenticket“ — de editor is hoe we bouwen; deze link is hoe publiek het ervaart.

**Korte glossary**

- **Bezoekerspreview** — tourmodus zonder bewerkingstools (`mode=preview`)
- **Yaw / pitch** — horizontale en verticale kijkhoeken voor het startbeeld
- **Begeleide tour** — geordende stops waar de experience doorheen kan gaan
- **Hotspot** — een tappable marker voor info of de volgende scène

## Probeer dit in ongeveer 60 seconden

1. Open de [Black Witness bezoekerstour](/demos/panorama-360/?mode=preview)
2. Klik **Play guided tour** — vier camerastops met popups en effecten
3. Open zelf een hotspot na het stoppen van de tour
4. Deel de preview-URL zodat collega's in dezelfde experience landen

## Vereisten en performance

- **Browser:** moderne mobiele of desktopbrowser; WebGPU-effecten vragen een capabel apparaat
- **Netwerk:** panorama's zijn beeldzwaar — Wi‑Fi bij eerste load aanbevolen
- **Input:** touch-sleep of muis; headset niet vereist

## Wat je ziet

De cover is guided-tour stap 1; de stills hieronder zetten dezelfde Black Witness-walkthrough voort:

![Stap 2 — geanimeerde vuur-hotspot en deeltjes-popup](/assets/blog/panorama-suite/view-a.jpg?v=20260722a)

![Stap 3 — water / spout-beat op het dak](/assets/blog/panorama-suite/view-b.jpg?v=20260722a)

![Stap 4 — Geanimeerde vogels-popup met de zwerm tegen de stormlucht](/assets/blog/panorama-suite/view-c.jpg?v=20260722a)

Ook in deze build:

- Naar de [editor](/demos/panorama-360/) springen wanneer u hotspots moet authoreren
- Het deep-link-patroon hergebruiken voor gebrandeerde eerste beelden in andere projecten
- De effectstack volgen: [particles](/blog/webgpu-particles) → [spout](/blog/spout) → [birds](/blog/webgpu-compute-birds)

## Hoe het werkt

Preview hergebruikt dezelfde panorama-engine als de [360° Tour Editor](/blog/panorama-360-tour), maar URL-flags verbergen authoring-chrome en zetten de startcamera (`yaw`, `pitch`). Hotspots en begeleide stappen zijn projectdata over equirectangular scènes — [Three.js](https://threejs.org/) voor bolcamera, optionele [WebGPU](https://en.wikipedia.org/wiki/WebGPU)-lagen voor sfeer. Op The Black Witness legt Stap 2 [particles](/blog/webgpu-particles), Stap 3 [spout](/blog/spout) en Stap 4 [birds](/blog/webgpu-compute-birds) — elk met hotspot+popup zodat gasten beweging krijgen op een klikbaar verhaalbeat.

## FAQ

**Waarom start mijn beeld in een specifieke richting?**  
De link zet yaw −84,7° en pitch −6° zodat iedereen dezelfde openingscompositie deelt.

**Kan ik hotspots bewerken via deze URL?**  
Niet in preview. Gebruik de [tour editor](/demos/panorama-360/) (of vraag ons om een production authoring-build).

**Wat zijn de effectlagen in stappen 2–4?**  
Stap 2 particles, Stap 3 spout/water, Stap 4 birds — elk met hotspot-popup. De standalone experimentpagina's documenteren dezelfde tech.

## Tech stack en verder lezen

- [Bezoekerstour-link](/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6)
- [Tour editor](/demos/panorama-360/)
- [Three.js](https://threejs.org/)
- [WebGPU — Wikipedia](https://en.wikipedia.org/wiki/WebGPU)

## Gerelateerd op IOM

Bekijk meer in [360°-tours](/#360), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [WebGPU Particles](/blog/webgpu-particles), [Spout](/blog/spout), [WebGPU Compute Birds](/blog/webgpu-compute-birds), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$The Black Witness — 360° bezoekerstour — IOM$iom$,
  $iom$Dezelfde raaf, vele werelden — stad, bos, berg, mist. Deze bezoekerspreview opent The Black Witness tour zonder editor-chrome, geframed op yaw −84,7° en pitch −6°, met hotspots, be$iom$
from public.blog_posts p
where p.slug = $iom$panorama-suite$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$The Black Witness — tour visitatore 360°$iom$,
  $iom$Lo stesso corvo, molti mondi — città, foresta, montagna, nebbia. Questa anteprima visitatore apre il tour The Black Witness senza chrome dell'editor, inquadrato a yaw −84,7° e pitc$iom$,
  $iom$Lo stesso corvo, molti mondi — città, foresta, montagna, nebbia. Questa anteprima visitatore apre il tour The Black Witness senza chrome dell'editor, inquadrato a yaw −84,7° e pitch −6°, con hotspot, passi guidati e atmosfera WebGPU opzionale.

Si trova nella nostra [sezione Tour 360°](/#360) come **The Black Witness**. La copertina è il passo 1 del tour guidato — hotspot corvo The Black Witness con popup aperto.

## Apri la demo live

**[→ Avvia The Black Witness — Tour 360°](/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Link visitatore-first** — nessuna UI editor; gli ospiti vedono solo il tour
- **Passi guidati** — un percorso nella storia, non solo sguardo libero
- **Hotspot con significato** — info e salti che insegnano mentre esplori
- **Framing condivisibile** — deep-link yaw/pitch per una prima vista intenzionale

Usi tipici: compagni di mostra, lancio di serie fotografiche, loop attract da stand e proof client di come una storia 360° finita si sente su telefono o laptop.

## Per principianti — cos’è, in parole semplici?

Siete in piedi dentro una fotografia 360°. Trascinate per guardarvi intorno; toccate i marker per imparare o andare al posto successivo. La modalità preview è il „biglietto ospite“ — l'editor è come costruiamo; questo link è come il pubblico la vive.

**Glossario rapido**

- **Anteprima visitatore** — modalità tour senza strumenti di editing (`mode=preview`)
- **Yaw / pitch** — angoli di sguardo orizzontale e verticale per la vista iniziale
- **Tour guidato** — fermate ordinate che l'esperienza può attraversare
- **Hotspot** — un marker tappabile per info o la scena successiva

## Provalo in circa 60 secondi

1. Aprire il [tour visitatore Black Witness](/demos/panorama-360/?mode=preview)
2. Cliccare **Play guided tour** — quattro fermate camera con popup ed effetti
3. Aprire un hotspot da soli dopo aver fermato il tour
4. Condividere l'URL preview così i colleghi arrivano nella stessa esperienza

## Requisiti e prestazioni

- **Browser:** browser mobile o desktop moderno; gli effetti WebGPU richiedono un dispositivo capace
- **Rete:** i panorami sono pesanti in immagini — preferire Wi‑Fi al primo caricamento
- **Input:** trascinamento touch o mouse; headset non richiesto

## Cosa vedi

La cover è lo step 1 del tour guidato; le immagini sotto continuano lo stesso percorso Black Witness:

![Passo 2 — hotspot fuoco animato e popup particelle](/assets/blog/panorama-suite/view-a.jpg?v=20260722a)

![Passo 3 — beat acqua / spout sul tetto](/assets/blog/panorama-suite/view-b.jpg?v=20260722a)

![Passo 4 — Popup uccelli animati con lo stormo contro il cielo tempestoso](/assets/blog/panorama-suite/view-c.jpg?v=20260722a)

Anche in questa build:

- Saltare all'[editor](/demos/panorama-360/) quando serve authorare hotspot
- Riutilizzare il pattern deep-link per prime viste brandizzate in altri progetti
- Seguire lo stack effetti: [particles](/blog/webgpu-particles) → [spout](/blog/spout) → [birds](/blog/webgpu-compute-birds)

## Come funziona

Preview riusa lo stesso motore panorama dell'[Editor tour 360°](/blog/panorama-360-tour), ma i flag URL nascondono il chrome di authoring e impostano la camera iniziale (`yaw`, `pitch`). Hotspot e passi guidati sono dati di progetto su scene equirettangolari — [Three.js](https://threejs.org/) per sfera e camera, layer [WebGPU](https://en.wikipedia.org/wiki/WebGPU) opzionali per l'atmosfera. Su The Black Witness, il Passo 2 sovrappone [particles](/blog/webgpu-particles), il Passo 3 [spout](/blog/spout) e il Passo 4 [birds](/blog/webgpu-compute-birds) — ciascuno con hotspot+popup così gli ospiti hanno movimento sincronizzato a un beat narrativo cliccabile.

## FAQ

**Perché la mia vista parte in una direzione specifica?**  
Il link imposta yaw −84,7° e pitch −6° così tutti condividono la stessa composizione di apertura.

**Posso modificare gli hotspot da questo URL?**  
Non in preview. Usare l'[editor tour](/demos/panorama-360/) (o chiederci un build di authoring production).

**Quali sono i layer effetto nei passi 2–4?**  
Passo 2 particles, Passo 3 spout/acqua, Passo 4 birds — ciascuno con popup hotspot. Le pagine esperimento standalone documentano la stessa tech.

## Stack tecnico e letture

- [Link tour visitatore](/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6)
- [Editor tour](/demos/panorama-360/)
- [Three.js](https://threejs.org/)
- [WebGPU — Wikipedia](https://en.wikipedia.org/wiki/WebGPU)

## Correlati su IOM

Esplora di più in [Tour 360°](/#360), più [360° Panorama Tour Editor](/blog/panorama-360-tour), [WebGPU Particles](/blog/webgpu-particles), [Spout](/blog/spout), [WebGPU Compute Birds](/blog/webgpu-compute-birds), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$The Black Witness — tour visitatore 360° — IOM$iom$,
  $iom$Lo stesso corvo, molti mondi — città, foresta, montagna, nebbia. Questa anteprima visitatore apre il tour The Black Witness senza chrome dell'editor, inquadrato a yaw −84,7° e pitc$iom$
from public.blog_posts p
where p.slug = $iom$panorama-suite$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$The Black Witness — tour visitante 360°$iom$,
  $iom$El mismo cuervo, muchos mundos — ciudad, bosque, montaña, niebla. Esta vista previa para visitantes abre el tour The Black Witness sin chrome del editor, enmarcado en yaw −84,7° y $iom$,
  $iom$El mismo cuervo, muchos mundos — ciudad, bosque, montaña, niebla. Esta vista previa para visitantes abre el tour The Black Witness sin chrome del editor, enmarcado en yaw −84,7° y pitch −6°, con hotspots, pasos guiados y atmósfera WebGPU opcional.

Está en nuestra [sección Tours 360°](/#360) como **The Black Witness**. La portada es el paso 1 del tour guiado — hotspot del cuervo The Black Witness con popup abierto.

## Abrir la demo en vivo

**[→ Lanzar The Black Witness — Tour 360°](/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Enlace visitante primero** — sin UI del editor; los invitados solo ven el tour
- **Pasos guiados** — un recorrido por la historia, no solo mirada libre
- **Hotspots con significado** — info y saltos que enseñan mientras exploras
- **Encuadre compartible** — deep-link yaw/pitch para que la primera vista sea intencional

Usos típicos: compañeros de exposición, lanzamientos de series fotográficas, bucles attract de stand y pruebas para clientes de cómo se siente una historia 360° terminada en móvil o portátil.

## Para principiantes — ¿qué es esto, en palabras simples?

Está de pie dentro de una fotografía 360°. Arrastre para mirar alrededor; toque marcadores para aprender o ir al siguiente lugar. El modo preview es el „boleto de invitado“ — el editor es cómo construimos; este enlace es cómo el público lo vive.

**Glosario rápido**

- **Vista previa visitante** — modo tour sin herramientas de edición (`mode=preview`)
- **Yaw / pitch** — ángulos de mirada horizontal y vertical para la vista inicial
- **Tour guiado** — paradas ordenadas por las que la experiencia puede avanzar
- **Hotspot** — un marcador pulsable para info o la siguiente escena

## Pruébalo en unos 60 segundos

1. Abrir el [tour visitante Black Witness](/demos/panorama-360/?mode=preview)
2. Hacer clic en **Play guided tour** — cuatro paradas de cámara con popups y efectos
3. Abrir un hotspot usted mismo tras detener el tour
4. Compartir la URL preview para que colegas lleguen a la misma experiencia

## Requisitos y rendimiento

- **Navegador:** navegador móvil o de escritorio moderno; los efectos WebGPU requieren un dispositivo capaz
- **Red:** los panoramas son pesados en imágenes — preferir Wi‑Fi en la primera carga
- **Entrada:** arrastre táctil o ratón; auriculares no requeridos

## Lo que ves

La portada es el paso 1 del tour guiado; las imágenes de abajo continúan el mismo recorrido Black Witness:

![Paso 2 — hotspot de fuego animado y popup de partículas](/assets/blog/panorama-suite/view-a.jpg?v=20260722a)

![Paso 3 — beat agua / spout en la azotea](/assets/blog/panorama-suite/view-b.jpg?v=20260722a)

![Paso 4 — Popup de aves animadas con la bandada contra el cielo tormentoso](/assets/blog/panorama-suite/view-c.jpg?v=20260722a)

También en este build:

- Ir al [editor](/demos/panorama-360/) cuando necesite authorar hotspots
- Reutilizar el patrón deep-link para primeras vistas de marca en otros proyectos
- Seguir la pila de efectos: [particles](/blog/webgpu-particles) → [spout](/blog/spout) → [birds](/blog/webgpu-compute-birds)

## Cómo funciona

Preview reutiliza el mismo motor panorama que el [Editor de tour 360°](/blog/panorama-360-tour), pero los flags URL ocultan el chrome de authoring y fijan la cámara inicial (`yaw`, `pitch`). Hotspots y pasos guiados son datos de proyecto sobre escenas equirectangulares — [Three.js](https://threejs.org/) para esfera y cámara, capas [WebGPU](https://en.wikipedia.org/wiki/WebGPU) opcionales para atmósfera. En The Black Witness, el Paso 2 superpone [particles](/blog/webgpu-particles), el Paso 3 [spout](/blog/spout) y el Paso 4 [birds](/blog/webgpu-compute-birds) — cada uno con hotspot+popup para que los invitados tengan movimiento sincronizado a un beat narrativo clicable.

## FAQ

**¿Por qué mi vista empieza en una dirección concreta?**  
El enlace fija yaw −84,7° y pitch −6° para que todos compartan la misma composición de apertura.

**¿Puedo editar hotspots desde esta URL?**  
No en preview. Use el [editor de tour](/demos/panorama-360/) (o pídanos un build de authoring de producción).

**¿Cuáles son las capas de efecto en los pasos 2–4?**  
Paso 2 particles, Paso 3 spout/agua, Paso 4 birds — cada uno con popup hotspot. Las páginas de experimento standalone documentan la misma tech.

## Stack técnico y lecturas

- [Enlace tour visitante](/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6)
- [Editor de tour](/demos/panorama-360/)
- [Three.js](https://threejs.org/)
- [WebGPU — Wikipedia](https://en.wikipedia.org/wiki/WebGPU)

## Relacionado en IOM

Explora más en [Tours 360°](/#360), más [360° Panorama Tour Editor](/blog/panorama-360-tour), [WebGPU Particles](/blog/webgpu-particles), [Spout](/blog/spout), [WebGPU Compute Birds](/blog/webgpu-compute-birds), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$The Black Witness — tour visitante 360° — IOM$iom$,
  $iom$El mismo cuervo, muchos mundos — ciudad, bosque, montaña, niebla. Esta vista previa para visitantes abre el tour The Black Witness sin chrome del editor, enmarcado en yaw −84,7° y $iom$
from public.blog_posts p
where p.slug = $iom$panorama-suite$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$CSS3D Sprites — HTML in 3D space$iom$,
  $iom$Five hundred and twelve HTML elements floating as sprites — then morphing between a plane, cube, cloud, and sphere. It is Three.js CSS3DRenderer: real DOM nodes in camera space, no$iom$,
  $iom$Five hundred and twelve HTML elements floating as sprites — then morphing between a plane, cube, cloud, and sphere. It is Three.js CSS3DRenderer: real DOM nodes in camera space, not just textured quads.

It lives in our [Experiments section](/#experiments) as **CSS3D Sprites**. The cover shows the sprite cloud mid-morph — HTML tiles reading as a 3D formation.

## Open the live demo

**[→ Launch CSS3D Sprites](/demos/css3d-sprites/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **DOM meets depth** — real HTML/CSS content that still orbits in 3D
- **Morph storytelling** — plane → cube → cloud → sphere sells “data becoming form”
- **Motion without a game engine** — pulsing scale and transitions in the browser
- **Prototype UI in space** — cards, labels, or photos as spatial layouts

Typical uses: spatial UI sketches, portfolio “particle of cards” moments, and client demos where content must stay readable HTML.

## For beginners — what is this, in plain words?

Imagine photo thumbnails or colored tiles arranged in a room you can spin. Each tile is still a normal webpage element — just positioned in 3D. When the shape changes, the tiles fly to new places like a choreographed flock.

**Quick glossary**

- **CSS3DRenderer** — Three.js path that positions HTML elements with CSS 3D transforms
- **Sprite** — a flat element that faces or sits in the scene as a billboard-like unit
- **Morph** — animated transition of positions from one formation to another
- **WebGL camera** — the same 3D camera math as WebGL scenes, driving CSS transforms

## Try this in about 60 seconds

1. Open the [CSS3D Sprites demo](/demos/css3d-sprites/)
2. Drag to orbit; watch the formation pulse
3. Trigger shape changes (plane, cube, random, sphere) if buttons or UI are present
4. Zoom in until individual HTML sprites stay sharp — that is the DOM advantage

## Requirements and performance

- **Browser:** modern Chrome, Edge, Firefox, or Safari with CSS 3D transforms
- **GPU:** light load compared with heavy WebGPU compute — fine on most laptops
- **Note:** this is CSS3D + Three.js camera math, not a WebGPU compute demo

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Sphere or cube formation — sprites reading as a solid volume](/assets/blog/css3d-sprites/view-a.jpg?v=20260722a)

![Cloud / random scatter — depth and parallax of HTML tiles](/assets/blog/css3d-sprites/view-b.jpg?v=20260722a)

Also in this build:

- Swap sprite content for images, labels, or brand colors
- Use morphs as section transitions in a pitch site
- Compare with the upstream [three.js css3d_sprites](https://threejs.org/examples/#css3d_sprites) example

## How it works

Three.js drives a shared camera; [CSS3DRenderer](https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer) maps object matrices to CSS `transform` on DOM nodes. Formations are target positions; animation interpolates each sprite toward the next layout. Upstream reference: [css3d_sprites](https://threejs.org/examples/#css3d_sprites) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/css3d_sprites.html)). Unlike WebGPU particle systems, work here is layout + CSS compositing rather than compute shaders.

## FAQ

**Is this WebGL or WebGPU?**  
Neither as the main path — sprites are HTML via CSS3D. Three.js still uses 3D camera math familiar from WebGL scenes.

**Can we put real product cards in the cloud?**  
Yes in principle — each sprite can hold richer HTML. We scope performance and readability for client builds.

## Tech stack and further reading

- [three.js — css3d_sprites](https://threejs.org/examples/#css3d_sprites)
- [CSS3DRenderer docs](https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer)
- [Three.js](https://threejs.org/)

## Related on IOM

Browse more in [Experiments](/#experiments), plus [BufferGeometry Draw Range](/blog/buffergeometry-drawrange), [WebGPU TSL Linked Particles](/blog/webgpu-tsl-linked-particles), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$CSS3D Sprites — HTML in 3D space — IOM$iom$,
  $iom$Five hundred and twelve HTML elements floating as sprites — then morphing between a plane, cube, cloud, and sphere. It is Three.js CSS3DRenderer: real DOM nodes in camera space, no$iom$
from public.blog_posts p
where p.slug = $iom$css3d-sprites$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$CSS3D Sprites — HTML im 3D-Raum$iom$,
  $iom$Fünfhundertzwei HTML-Elemente schweben als Sprites — und morphen zwischen Ebene, Würfel, Wolke und Kugel. Das ist Three.js CSS3DRenderer: echte DOM-Knoten im Kameraraum, nicht nur $iom$,
  $iom$Fünfhundertzwei HTML-Elemente schweben als Sprites — und morphen zwischen Ebene, Würfel, Wolke und Kugel. Das ist Three.js CSS3DRenderer: echte DOM-Knoten im Kameraraum, nicht nur texturierte Quads.

Es liegt in unserem [Experimente-Bereich](/#experiments) als **CSS3D Sprites**. Das Cover zeigt die Sprite-Wolke mitten im Morph — HTML-Kacheln lesen sich als 3D-Formation.

## Live-Demo öffnen

**[→ CSS3D Sprites starten](/demos/css3d-sprites/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **DOM trifft Tiefe** — echte HTML/CSS-Inhalte, die trotzdem in 3D kreisen
- **Morph-Storytelling** — Ebene → Würfel → Wolke → Kugel verkauft „Daten werden Form“
- **Bewegung ohne Game Engine** — pulsierende Skalierung und Übergänge im Browser
- **UI-Prototyp im Raum** — Karten, Labels oder Fotos als räumliche Layouts

Typische Einsätze: räumliche UI-Sketches, Portfolio-„Partikel aus Karten“-Momente und Kundendemos, bei denen Inhalt lesbares HTML bleiben muss.

## Für Einsteiger — was ist das, in einfachen Worten?

Stellen Sie sich Foto-Thumbnails oder farbige Kacheln in einem Raum vor, den Sie drehen können. Jede Kachel ist noch ein normales Webseiten-Element — nur im 3D positioniert. Wenn sich die Form ändert, fliegen die Kacheln wie ein choreografierter Schwarm an neue Plätze.

**Kurzes Glossar**

- **CSS3DRenderer** — Three.js-Pfad, der HTML-Elemente mit CSS-3D-Transforms positioniert
- **Sprite** — ein flaches Element, das der Szene als billboard-artige Einheit zugewandt ist
- **Morph** — animierter Übergang der Positionen von einer Formation zur nächsten
- **WebGL camera** — dieselbe 3D-Kamera-Mathematik wie in WebGL-Szenen, die CSS-Transforms antreibt

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [CSS3D Sprites Demo](/demos/css3d-sprites/)
2. Ziehen zum Orbitieren; beobachten Sie das pulsierende Formation
3. Formwechsel auslösen (Ebene, Würfel, Random, Kugel), falls Buttons oder UI vorhanden
4. Hineinzoomen, bis einzelne HTML-Sprites scharf bleiben — das ist der DOM-Vorteil

## Anforderungen und Performance

- **Browser:** moderner Chrome, Edge, Firefox oder Safari mit CSS-3D-Transforms
- **GPU:** leichte Last im Vergleich zu schwerem WebGPU-Compute — gut auf den meisten Laptops
- **Hinweis:** CSS3D + Three.js-Kamera-Math, kein WebGPU-Compute-Demo

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Kugel- oder Würfelformation — Sprites lesen sich als solides Volumen](/assets/blog/css3d-sprites/view-a.jpg?v=20260722a)

![Wolke / Random-Streuung — Tiefe und Parallax der HTML-Kacheln](/assets/blog/css3d-sprites/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Sprite-Inhalt gegen Bilder, Labels oder Markenfarben tauschen
- Morphs als Sektionsübergänge in einer Pitch-Site nutzen
- Mit dem upstream [three.js css3d_sprites](https://threejs.org/examples/#css3d_sprites)-Beispiel vergleichen

## So funktioniert es

Three.js treibt eine gemeinsame Kamera; [CSS3DRenderer](https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer) mappt Objektmatrizen auf CSS-`transform` an DOM-Knoten. Formationen sind Zielpositionen; Animation interpoliert jeden Sprite zur nächsten Anordnung. Upstream-Referenz: [css3d_sprites](https://threejs.org/examples/#css3d_sprites) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/css3d_sprites.html)). Anders als WebGPU-Partikelsysteme ist die Arbeit hier Layout + CSS-Compositing statt Compute Shaders.

## FAQ

**Ist das WebGL oder WebGPU?**  
Weder als Hauptpfad — Sprites sind HTML via CSS3D. Three.js nutzt trotzdem 3D-Kamera-Math aus WebGL-Szenen.

**Können wir echte Produktkarten in die Wolke legen?**  
Ja prinzipiell — jeder Sprite kann reicheres HTML halten. Wir scopen Performance und Lesbarkeit für Kundenbuilds.

## Tech-Stack und weiterführende Links

- [three.js — css3d_sprites](https://threejs.org/examples/#css3d_sprites)
- [CSS3DRenderer docs](https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer)
- [Three.js](https://threejs.org/)

## Verwandt bei IOM

Mehr in [Experimente](/#experiments), plus [BufferGeometry Draw Range](/blog/buffergeometry-drawrange), [WebGPU TSL Linked Particles](/blog/webgpu-tsl-linked-particles), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$CSS3D Sprites — HTML im 3D-Raum — IOM$iom$,
  $iom$Fünfhundertzwei HTML-Elemente schweben als Sprites — und morphen zwischen Ebene, Würfel, Wolke und Kugel. Das ist Three.js CSS3DRenderer: echte DOM-Knoten im Kameraraum, nicht nur $iom$
from public.blog_posts p
where p.slug = $iom$css3d-sprites$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$CSS3D Sprites — HTML dans l'espace 3D$iom$,
  $iom$Cinq cent douze éléments HTML flottant comme sprites — puis morphant entre plan, cube, nuage et sphère. C'est Three.js CSS3DRenderer : de vrais nœuds DOM dans l'espace caméra, pas $iom$,
  $iom$Cinq cent douze éléments HTML flottant comme sprites — puis morphant entre plan, cube, nuage et sphère. C'est Three.js CSS3DRenderer : de vrais nœuds DOM dans l'espace caméra, pas seulement des quads texturés.

Il se trouve dans notre [section Expériences](/#experiments) sous **CSS3D Sprites**. La couverture montre le nuage de sprites en plein morph — tuiles HTML lisibles comme formation 3D.

## Ouvrir la démo en direct

**[→ Lancer CSS3D Sprites](/demos/css3d-sprites/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **DOM rencontre la profondeur** — vrai contenu HTML/CSS qui orbite quand même en 3D
- **Storytelling morph** — plan → cube → nuage → sphère vend « les données deviennent forme »
- **Mouvement sans moteur de jeu** — pulsation d'échelle et transitions dans le navigateur
- **Prototype UI dans l'espace** — cartes, labels ou photos en layouts spatiaux

Usages typiques : croquis UI spatiaux, moments portfolio « particule de cartes » et démos client où le contenu doit rester du HTML lisible.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Imaginez des vignettes photo ou tuiles colorées disposées dans une pièce que vous faites tourner. Chaque tuile reste un élément web normal — juste positionné en 3D. Quand la forme change, les tuiles volent vers de nouvelles places comme une volée chorégraphiée.

**Glossaire rapide**

- **CSS3DRenderer** — voie Three.js qui positionne les éléments HTML avec des transforms CSS 3D
- **Sprite** — un élément plat qui fait face ou se tient dans la scène comme unité type billboard
- **Morph** — transition animée des positions d'une formation à une autre
- **WebGL camera** — la même math caméra 3D que les scènes WebGL, pilotant les transforms CSS

## Essayez en environ 60 secondes

1. Ouvrir la [démo CSS3D Sprites](/demos/css3d-sprites/)
2. Glisser pour orbiter ; observer la formation pulser
3. Déclencher les changements de forme (plan, cube, aléatoire, sphère) si boutons ou UI présents
4. Zoomer jusqu'à ce que les sprites HTML individuels restent nets — c'est l'avantage DOM

## Prérequis et performances

- **Navigateur :** Chrome, Edge, Firefox ou Safari moderne avec transforms CSS 3D
- **GPU :** charge légère comparée au compute WebGPU lourd — OK sur la plupart des laptops
- **Note :** CSS3D + math caméra Three.js, pas une démo compute WebGPU

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Formation sphère ou cube — sprites lisibles comme volume solide](/assets/blog/css3d-sprites/view-a.jpg?v=20260722a)

![Nuage / dispersion aléatoire — profondeur et parallaxe des tuiles HTML](/assets/blog/css3d-sprites/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Remplacer le contenu sprite par images, labels ou couleurs de marque
- Utiliser les morphs comme transitions de section dans un site pitch
- Comparer avec l'exemple upstream [three.js css3d_sprites](https://threejs.org/examples/#css3d_sprites)

## Comment ça marche

Three.js pilote une caméra partagée ; [CSS3DRenderer](https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer) mappe les matrices objet sur `transform` CSS des nœuds DOM. Les formations sont des positions cibles ; l'animation interpole chaque sprite vers la disposition suivante. Référence upstream : [css3d_sprites](https://threejs.org/examples/#css3d_sprites) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/css3d_sprites.html)). Contrairement aux systèmes de particules WebGPU, le travail ici est layout + compositing CSS plutôt que compute shaders.

## FAQ

**Est-ce WebGL ou WebGPU ?**  
Ni l'un ni l'autre comme voie principale — les sprites sont du HTML via CSS3D. Three.js utilise quand même la math caméra 3D familière des scènes WebGL.

**Pouvons-nous mettre de vraies cartes produit dans le nuage ?**  
Oui en principe — chaque sprite peut contenir du HTML plus riche. Nous cadrons performance et lisibilité pour les builds client.

## Stack technique et lectures

- [three.js — css3d_sprites](https://threejs.org/examples/#css3d_sprites)
- [CSS3DRenderer docs](https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer)
- [Three.js](https://threejs.org/)

## Sur IOM

Parcourez [Expériences](/#experiments), plus [BufferGeometry Draw Range](/blog/buffergeometry-drawrange), [WebGPU TSL Linked Particles](/blog/webgpu-tsl-linked-particles), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$CSS3D Sprites — HTML dans l'espace 3D — IOM$iom$,
  $iom$Cinq cent douze éléments HTML flottant comme sprites — puis morphant entre plan, cube, nuage et sphère. C'est Three.js CSS3DRenderer : de vrais nœuds DOM dans l'espace caméra, pas $iom$
from public.blog_posts p
where p.slug = $iom$css3d-sprites$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$CSS3D Sprites — HTML in 3D-ruimte$iom$,
  $iom$Vijfhonderdtwaalf HTML-elementen drijvend als sprites — dan morphend tussen vlak, kubus, wolk en bol. Het is Three.js CSS3DRenderer: echte DOM-nodes in cameraruimte, niet alleen ge$iom$,
  $iom$Vijfhonderdtwaalf HTML-elementen drijvend als sprites — dan morphend tussen vlak, kubus, wolk en bol. Het is Three.js CSS3DRenderer: echte DOM-nodes in cameraruimte, niet alleen getextureerde quads.

Het staat in onze [Experimenten-sectie](/#experiments) als **CSS3D Sprites**. De cover toont de sprite-wolk midden in morph — HTML-tegels lezen als 3D-formatie.

## Open de live demo

**[→ Start CSS3D Sprites](/demos/css3d-sprites/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **DOM ontmoet diepte** — echte HTML/CSS-inhoud die toch in 3D orbiteert
- **Morph storytelling** — vlak → kubus → wolk → bol verkoopt „data wordt vorm“
- **Beweging zonder game engine** — pulserende schaal en overgangen in de browser
- **UI-prototype in ruimte** — kaarten, labels of foto's als ruimtelijke layouts

Typische toepassingen: ruimtelijke UI-schetsen, portfolio „deeltje van kaarten“-momenten en klantdemo's waar content leesbare HTML moet blijven.

## Voor beginners — wat is dit, in gewone taal?

Stel u fotothumbnails of gekleurde tegels voor in een kamer die u kunt draaien. Elke tegel is nog een normaal webpagina-element — alleen in 3D gepositioneerd. Als de vorm verandert, vliegen de tegels naar nieuwe plekken als een gechoreografeerde zwerm.

**Korte glossary**

- **CSS3DRenderer** — Three.js-pad dat HTML-elementen positioneert met CSS 3D transforms
- **Sprite** — een plat element dat in de scène als billboard-achtige eenheid staat
- **Morph** — geanimeerde overgang van posities van de ene formatie naar de andere
- **WebGL camera** — dezelfde 3D-camerawiskunde als WebGL-scènes, die CSS transforms aanstuurt

## Probeer dit in ongeveer 60 seconden

1. Open de [CSS3D Sprites demo](/demos/css3d-sprites/)
2. Sleep om te orbiteren; kijk hoe de formatie pulseert
3. Trigger vormwissels (vlak, kubus, random, bol) als knoppen of UI aanwezig zijn
4. Zoom in tot individuele HTML-sprites scherp blijven — dat is het DOM-voordeel

## Vereisten en performance

- **Browser:** moderne Chrome, Edge, Firefox of Safari met CSS 3D transforms
- **GPU:** lichte load vergeleken met zwaar WebGPU compute — prima op de meeste laptops
- **Opmerking:** CSS3D + Three.js camerawiskunde, geen WebGPU compute-demo

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Bol- of kubusformatie — sprites lezen als solide volume](/assets/blog/css3d-sprites/view-a.jpg?v=20260722a)

![Wolk / random verspreiding — diepte en parallax van HTML-tegels](/assets/blog/css3d-sprites/view-b.jpg?v=20260722a)

Ook in deze build:

- Sprite-inhoud wisselen voor afbeeldingen, labels of merkkleuren
- Morphs gebruiken als sectie-overgangen in een pitchsite
- Vergelijken met het upstream [three.js css3d_sprites](https://threejs.org/examples/#css3d_sprites)-voorbeeld

## Hoe het werkt

Three.js drijft een gedeelde camera; [CSS3DRenderer](https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer) mapt objectmatrices naar CSS `transform` op DOM-nodes. Formaties zijn doelposities; animatie interpoleert elke sprite naar de volgende layout. Upstream referentie: [css3d_sprites](https://threejs.org/examples/#css3d_sprites) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/css3d_sprites.html)). Anders dan WebGPU-deeltjessystemen is het werk hier layout + CSS compositing in plaats van compute shaders.

## FAQ

**Is dit WebGL of WebGPU?**  
Geen van beide als hoofdpad — sprites zijn HTML via CSS3D. Three.js gebruikt nog steeds 3D-camerawiskunde uit WebGL-scènes.

**Kunnen we echte productkaarten in de wolk zetten?**  
Ja in principe — elke sprite kan rijkere HTML bevatten. We scopen performance en leesbaarheid voor klantbuilds.

## Tech stack en verder lezen

- [three.js — css3d_sprites](https://threejs.org/examples/#css3d_sprites)
- [CSS3DRenderer docs](https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer)
- [Three.js](https://threejs.org/)

## Gerelateerd op IOM

Bekijk meer in [Experimenten](/#experiments), plus [BufferGeometry Draw Range](/blog/buffergeometry-drawrange), [WebGPU TSL Linked Particles](/blog/webgpu-tsl-linked-particles), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$CSS3D Sprites — HTML in 3D-ruimte — IOM$iom$,
  $iom$Vijfhonderdtwaalf HTML-elementen drijvend als sprites — dan morphend tussen vlak, kubus, wolk en bol. Het is Three.js CSS3DRenderer: echte DOM-nodes in cameraruimte, niet alleen ge$iom$
from public.blog_posts p
where p.slug = $iom$css3d-sprites$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$CSS3D Sprites — HTML nello spazio 3D$iom$,
  $iom$Cinquecentododici elementi HTML fluttuanti come sprite — poi morph tra piano, cubo, nuvola e sfera. È Three.js CSS3DRenderer: nodi DOM reali nello spazio camera, non solo quad text$iom$,
  $iom$Cinquecentododici elementi HTML fluttuanti come sprite — poi morph tra piano, cubo, nuvola e sfera. È Three.js CSS3DRenderer: nodi DOM reali nello spazio camera, non solo quad texturizzati.

Si trova nella nostra [sezione Esperimenti](/#experiments) come **CSS3D Sprites**. La copertina mostra la nuvola di sprite a metà morph — tile HTML che leggono come formazione 3D.

## Apri la demo live

**[→ Avvia CSS3D Sprites](/demos/css3d-sprites/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **DOM incontra profondità** — contenuto HTML/CSS reale che orbita comunque in 3D
- **Storytelling morph** — piano → cubo → nuvola → sfera vende „i dati diventano forma“
- **Movimento senza game engine** — scala pulsante e transizioni nel browser
- **Prototipo UI nello spazio** — card, label o foto come layout spaziali

Usi tipici: schizzi UI spaziali, momenti portfolio „particella di card“ e demo client dove il contenuto deve restare HTML leggibile.

## Per principianti — cos’è, in parole semplici?

Immaginate thumbnail foto o tile colorate disposte in una stanza che potete ruotare. Ogni tile è ancora un elemento web normale — solo posizionato in 3D. Quando la forma cambia, le tile volano verso nuove posizioni come uno stormo coreografato.

**Glossario rapido**

- **CSS3DRenderer** — percorso Three.js che posiziona elementi HTML con transform CSS 3D
- **Sprite** — un elemento piatto che sta nella scena come unità tipo billboard
- **Morph** — transizione animata delle posizioni da una formazione all'altra
- **WebGL camera** — la stessa matematica camera 3D delle scene WebGL, che guida i transform CSS

## Provalo in circa 60 secondi

1. Aprire la [demo CSS3D Sprites](/demos/css3d-sprites/)
2. Trascinare per orbitare; osservare la formazione pulsare
3. Attivare cambi forma (piano, cubo, random, sfera) se presenti pulsanti o UI
4. Zoomare finché i singoli sprite HTML restano nitidi — quello è il vantaggio DOM

## Requisiti e prestazioni

- **Browser:** Chrome, Edge, Firefox o Safari moderno con transform CSS 3D
- **GPU:** carico leggero rispetto al compute WebGPU pesante — ok sulla maggior parte dei laptop
- **Nota:** CSS3D + matematica camera Three.js, non una demo compute WebGPU

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Formazione sfera o cubo — sprite che leggono come volume solido](/assets/blog/css3d-sprites/view-a.jpg?v=20260722a)

![Nuvola / dispersione random — profondità e parallax delle tile HTML](/assets/blog/css3d-sprites/view-b.jpg?v=20260722a)

Anche in questa build:

- Scambiare contenuto sprite con immagini, label o colori brand
- Usare i morph come transizioni di sezione in un sito pitch
- Confrontare con l'esempio upstream [three.js css3d_sprites](https://threejs.org/examples/#css3d_sprites)

## Come funziona

Three.js guida una camera condivisa; [CSS3DRenderer](https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer) mappa le matrici oggetto su `transform` CSS dei nodi DOM. Le formazioni sono posizioni target; l'animazione interpola ogni sprite verso il layout successivo. Riferimento upstream: [css3d_sprites](https://threejs.org/examples/#css3d_sprites) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/css3d_sprites.html)). A differenza dei sistemi particelle WebGPU, qui il lavoro è layout + compositing CSS piuttosto che compute shader.

## FAQ

**È WebGL o WebGPU?**  
Né l'uno né l'altro come percorso principale — gli sprite sono HTML via CSS3D. Three.js usa comunque la matematica camera 3D familiare dalle scene WebGL.

**Possiamo mettere card prodotto reali nella nuvola?**  
Sì in principio — ogni sprite può contenere HTML più ricco. Definiamo performance e leggibilità per build client.

## Stack tecnico e letture

- [three.js — css3d_sprites](https://threejs.org/examples/#css3d_sprites)
- [CSS3DRenderer docs](https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer)
- [Three.js](https://threejs.org/)

## Correlati su IOM

Esplora di più in [Esperimenti](/#experiments), più [BufferGeometry Draw Range](/blog/buffergeometry-drawrange), [WebGPU TSL Linked Particles](/blog/webgpu-tsl-linked-particles), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$CSS3D Sprites — HTML nello spazio 3D — IOM$iom$,
  $iom$Cinquecentododici elementi HTML fluttuanti come sprite — poi morph tra piano, cubo, nuvola e sfera. È Three.js CSS3DRenderer: nodi DOM reali nello spazio camera, non solo quad text$iom$
from public.blog_posts p
where p.slug = $iom$css3d-sprites$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$CSS3D Sprites — HTML en espacio 3D$iom$,
  $iom$Quinientas doce elementos HTML flotando como sprites — luego morph entre plano, cubo, nube y esfera. Es Three.js CSS3DRenderer: nodos DOM reales en espacio cámara, no solo quads te$iom$,
  $iom$Quinientas doce elementos HTML flotando como sprites — luego morph entre plano, cubo, nube y esfera. Es Three.js CSS3DRenderer: nodos DOM reales en espacio cámara, no solo quads texturizados.

Está en nuestra [sección Experimentos](/#experiments) como **CSS3D Sprites**. La portada muestra la nube de sprites a mitad de morph — mosaicos HTML leyéndose como formación 3D.

## Abrir la demo en vivo

**[→ Lanzar CSS3D Sprites](/demos/css3d-sprites/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **DOM encuentra profundidad** — contenido HTML/CSS real que aún orbita en 3D
- **Storytelling morph** — plano → cubo → nube → esfera vende „datos que se vuelven forma“
- **Movimiento sin motor de juego** — escala pulsante y transiciones en el navegador
- **Prototipo UI en espacio** — tarjetas, etiquetas o fotos como layouts espaciales

Usos típicos: bocetos UI espaciales, momentos portfolio „partícula de tarjetas“ y demos cliente donde el contenido debe seguir siendo HTML legible.

## Para principiantes — ¿qué es esto, en palabras simples?

Imagine miniaturas de foto o mosaicos de color dispuestos en una habitación que puede girar. Cada mosaico sigue siendo un elemento web normal — solo posicionado en 3D. Cuando la forma cambia, los mosaicos vuelan a nuevos sitios como una bandada coreografiada.

**Glosario rápido**

- **CSS3DRenderer** — ruta Three.js que posiciona elementos HTML con transforms CSS 3D
- **Sprite** — un elemento plano que está en la escena como unidad tipo billboard
- **Morph** — transición animada de posiciones de una formación a otra
- **WebGL camera** — la misma matemática de cámara 3D que escenas WebGL, que impulsa transforms CSS

## Pruébalo en unos 60 segundos

1. Abrir la [demo CSS3D Sprites](/demos/css3d-sprites/)
2. Arrastrar para orbitar; ver la formación pulsar
3. Activar cambios de forma (plano, cubo, aleatorio, esfera) si hay botones o UI
4. Acercar hasta que sprites HTML individuales sigan nítidos — esa es la ventaja DOM

## Requisitos y rendimiento

- **Navegador:** Chrome, Edge, Firefox o Safari moderno con transforms CSS 3D
- **GPU:** carga ligera comparada con compute WebGPU pesado — bien en la mayoría de portátiles
- **Nota:** CSS3D + matemática cámara Three.js, no una demo compute WebGPU

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Formación esfera o cubo — sprites leyéndose como volumen sólido](/assets/blog/css3d-sprites/view-a.jpg?v=20260722a)

![Nube / dispersión aleatoria — profundidad y parallax de mosaicos HTML](/assets/blog/css3d-sprites/view-b.jpg?v=20260722a)

También en este build:

- Cambiar contenido sprite por imágenes, etiquetas o colores de marca
- Usar morphs como transiciones de sección en un sitio pitch
- Comparar con el ejemplo upstream [three.js css3d_sprites](https://threejs.org/examples/#css3d_sprites)

## Cómo funciona

Three.js impulsa una cámara compartida; [CSS3DRenderer](https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer) mapea matrices de objeto a `transform` CSS en nodos DOM. Las formaciones son posiciones objetivo; la animación interpola cada sprite hacia el siguiente layout. Referencia upstream: [css3d_sprites](https://threejs.org/examples/#css3d_sprites) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/css3d_sprites.html)). A diferencia de sistemas de partículas WebGPU, aquí el trabajo es layout + compositing CSS en lugar de compute shaders.

## FAQ

**¿Es WebGL o WebGPU?**  
Ninguno como ruta principal — los sprites son HTML vía CSS3D. Three.js sigue usando matemática cámara 3D familiar de escenas WebGL.

**¿Podemos poner tarjetas de producto reales en la nube?**  
Sí en principio — cada sprite puede contener HTML más rico. Definimos rendimiento y legibilidad para builds cliente.

## Stack técnico y lecturas

- [three.js — css3d_sprites](https://threejs.org/examples/#css3d_sprites)
- [CSS3DRenderer docs](https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer)
- [Three.js](https://threejs.org/)

## Relacionado en IOM

Explora más en [Experimentos](/#experiments), más [BufferGeometry Draw Range](/blog/buffergeometry-drawrange), [WebGPU TSL Linked Particles](/blog/webgpu-tsl-linked-particles), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$CSS3D Sprites — HTML en espacio 3D — IOM$iom$,
  $iom$Quinientas doce elementos HTML flotando como sprites — luego morph entre plano, cubo, nube y esfera. Es Three.js CSS3DRenderer: nodos DOM reales en espacio cámara, no solo quads te$iom$
from public.blog_posts p
where p.slug = $iom$css3d-sprites$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$Shape Particles — WebGPU compute physics$iom$,
  $iom$Thousands of particles snap into a cube, sphere, torus, heart — then Release drops them under GPU gravity with floor bounce. WebGPU compute keeps the simulation on the graphics car$iom$,
  $iom$Thousands of particles snap into a cube, sphere, torus, heart — then Release drops them under GPU gravity with floor bounce. WebGPU compute keeps the simulation on the graphics card.

It lives in our [Experiments section](/#experiments) as **Shape Particles**. The cover shows a shape preset held in formation before the drop.

## Open the live demo

**[→ Launch Shape Particles](/demos/compute-particles/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Formation → chaos → reform** — a clear story for product or brand motion
- **Compute on the GPU** — physics steps without blocking the main thread
- **Shape presets** — cube, sphere, torus, cone, pyramid, ring, heart
- **Interactive proof** — Release and Reset sell the idea in one click

Typical uses: launch teasers, booth loops, and “our data becomes this shape” pitch moments.

## For beginners — what is this, in plain words?

Think of magnetic sand that can hold a logo-like shape, then fall when you let go — and jump back into the shape when you reset. The difference is speed: the GPU updates every particle so it stays smooth.

**Quick glossary**

- **WebGPU** — modern browser GPU API (newer than WebGL) for compute and rendering
- **Compute shader** — GPU program that updates data (positions, velocities) without drawing triangles
- **TSL** — Three.js Shading Language — node-based GPU logic in JS
- **Formation** — target positions that make particles read as a solid shape

## Try this in about 60 seconds

1. Open the [Shape Particles demo](/demos/compute-particles/)
2. Pick a shape preset and orbit the formation
3. Press Release — watch gravity and floor bounce
4. Press Reset to reform; try another shape

## Requirements and performance

- **Browser:** Chrome or Edge with WebGPU enabled (recent versions)
- **GPU:** discrete or recent integrated GPU recommended for dense counts
- **Fallback:** without WebGPU you will see a capability message — this is not a WebGL port

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Held formation — particles reading as a solid preset shape](/assets/blog/compute-particles/view-a.jpg?v=20260722a)

![After Release — spray and bounce on the ground plane](/assets/blog/compute-particles/view-b.jpg?v=20260722a)

Also in this build:

- Cycle presets for a short brand loop
- Tune count / look for booth vs laptop performance
- Compare with [three.js webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles)

## How it works

A [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) compute pass updates particle state each frame; the renderer draws the result. Three.js exposes this through its WebGPU renderer and TSL compute nodes. Upstream: [webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_particles.html)). WebGL can draw particles too, but this demo’s gravity and reform loop are built for WebGPU compute.

## FAQ

**Why does my browser say WebGPU is missing?**  
This experiment needs WebGPU. Use an updated Chrome or Edge; Safari/Firefox support varies by version.

**Can the particles form our logo?**  
Custom target meshes or point clouds are a natural next step — ask us for a scoped build.

## Tech stack and further reading

- [three.js — compute particles](https://threejs.org/examples/#webgpu_compute_particles)
- [WebGPU API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Related on IOM

Browse more in [Experiments](/#experiments), plus [WebGPU Particles](/blog/webgpu-particles), [WebGPU Compute Birds](/blog/webgpu-compute-birds), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$Shape Particles — WebGPU compute physics — IOM$iom$,
  $iom$Thousands of particles snap into a cube, sphere, torus, heart — then Release drops them under GPU gravity with floor bounce. WebGPU compute keeps the simulation on the graphics car$iom$
from public.blog_posts p
where p.slug = $iom$compute-particles$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$Shape Particles — WebGPU Compute Physics$iom$,
  $iom$Tausende Partikel schnappen in Würfel, Kugel, Torus, Herz — dann lässt Release sie unter GPU-Gravitation mit Boden-Bounce fallen. WebGPU Compute hält die Simulation auf der Grafikk$iom$,
  $iom$Tausende Partikel schnappen in Würfel, Kugel, Torus, Herz — dann lässt Release sie unter GPU-Gravitation mit Boden-Bounce fallen. WebGPU Compute hält die Simulation auf der Grafikkarte.

Es liegt in unserem [Experimente-Bereich](/#experiments) als **Shape Particles**. Das Cover zeigt ein Shape-Preset in Formation vor dem Drop.

## Live-Demo öffnen

**[→ Shape Particles starten](/demos/compute-particles/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Formation → Chaos → Reform** — eine klare Story für Produkt- oder Markenmotion
- **Compute auf der GPU** — Physik-Schritte ohne Blockieren des Main Threads
- **Shape-Presets** — Würfel, Kugel, Torus, Kegel, Pyramide, Ring, Herz
- **Interaktiver Proof** — Release und Reset verkaufen die Idee in einem Klick

Typische Einsätze: Launch-Teaser, Messe-Loops und „unsere Daten werden diese Form“-Pitch-Momente.

## Für Einsteiger — was ist das, in einfachen Worten?

Stellen Sie sich magnetischen Sand vor, der eine logoartige Form halten kann, dann fällt, wenn Sie loslassen — und bei Reset zurück in die Form springt. Der Unterschied ist Geschwindigkeit: die GPU aktualisiert jedes Partikel, damit es flüssig bleibt.

**Kurzes Glossar**

- **WebGPU** — moderne Browser-GPU-API (neuer als WebGL) für Compute und Rendering
- **Compute shader** — GPU-Programm, das Daten (Positionen, Geschwindigkeiten) ohne Dreiecke zu zeichnen aktualisiert
- **TSL** — Three.js Shading Language — knotenbasierte GPU-Logik in JS
- **Formation** — Zielpositionen, die Partikel als solide Form lesen lassen

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [Shape Particles Demo](/demos/compute-particles/)
2. Wählen Sie ein Shape-Preset und orbitieren Sie die Formation
3. Drücken Sie Release — beobachten Sie Gravitation und Boden-Bounce
4. Drücken Sie Reset zur Reform; probieren Sie eine andere Form

## Anforderungen und Performance

- **Browser:** Chrome oder Edge mit WebGPU aktiviert (aktuelle Versionen)
- **GPU:** diskrete oder aktuelle integrierte GPU für dichte Counts empfohlen
- **Fallback:** ohne WebGPU sehen Sie eine Capability-Meldung — kein WebGL-Port

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Gehaltene Formation — Partikel lesen sich als solides Preset-Shape](/assets/blog/compute-particles/view-a.jpg?v=20260722a)

![Nach Release — Spray und Bounce auf der Bodenebene](/assets/blog/compute-particles/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Presets für einen kurzen Brand-Loop durchwechseln
- Count / Look für Messe vs. Laptop-Performance tunen
- Mit [three.js webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles) vergleichen

## So funktioniert es

Ein [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)-Compute-Pass aktualisiert Partikel-State pro Frame; der Renderer zeichnet das Ergebnis. Three.js exponiert das über WebGPU Renderer und TSL Compute Nodes. Upstream: [webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_particles.html)). WebGL kann auch Partikel zeichnen, aber Gravitation und Reform-Loop dieser Demo sind für WebGPU Compute gebaut.

## FAQ

**Warum sagt mein Browser, WebGPU fehlt?**  
Dieses Experiment braucht WebGPU. Nutzen Sie aktualisierten Chrome oder Edge; Safari/Firefox-Support variiert je Version.

**Können die Partikel unser Logo formen?**  
Custom Target Meshes oder Point Clouds sind ein natürlicher nächster Schritt — fragen Sie uns nach einem scoped Build.

## Tech-Stack und weiterführende Links

- [three.js — compute particles](https://threejs.org/examples/#webgpu_compute_particles)
- [WebGPU API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Verwandt bei IOM

Mehr in [Experimente](/#experiments), plus [WebGPU Particles](/blog/webgpu-particles), [WebGPU Compute Birds](/blog/webgpu-compute-birds), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$Shape Particles — WebGPU Compute Physics — IOM$iom$,
  $iom$Tausende Partikel schnappen in Würfel, Kugel, Torus, Herz — dann lässt Release sie unter GPU-Gravitation mit Boden-Bounce fallen. WebGPU Compute hält die Simulation auf der Grafikk$iom$
from public.blog_posts p
where p.slug = $iom$compute-particles$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$Shape Particles — physique compute WebGPU$iom$,
  $iom$Des milliers de particules s'alignent en cube, sphère, tore, cœur — puis Release les lâche sous gravité GPU avec rebond au sol. WebGPU compute garde la simulation sur la carte grap$iom$,
  $iom$Des milliers de particules s'alignent en cube, sphère, tore, cœur — puis Release les lâche sous gravité GPU avec rebond au sol. WebGPU compute garde la simulation sur la carte graphique.

Il se trouve dans notre [section Expériences](/#experiments) sous **Shape Particles**. La couverture montre un preset de forme maintenu en formation avant la chute.

## Ouvrir la démo en direct

**[→ Lancer Shape Particles](/demos/compute-particles/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Formation → chaos → reforme** — une histoire claire pour motion produit ou marque
- **Compute sur GPU** — étapes physique sans bloquer le thread principal
- **Presets de forme** — cube, sphère, tore, cône, pyramide, anneau, cœur
- **Preuve interactive** — Release et Reset vendent l'idée en un clic

Usages typiques : teasers de lancement, boucles stand et moments pitch « nos données deviennent cette forme ».

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Pensez à du sable magnétique qui peut tenir une forme type logo, puis tomber quand vous lâchez — et revenir en forme au reset. La différence est la vitesse : le GPU met à jour chaque particule pour rester fluide.

**Glossaire rapide**

- **WebGPU** — API GPU navigateur moderne (plus récente que WebGL) pour compute et rendu
- **Compute shader** — programme GPU qui met à jour les données (positions, vitesses) sans dessiner de triangles
- **TSL** — Three.js Shading Language — logique GPU basée nœuds en JS
- **Formation** — positions cibles qui font lire les particules comme une forme solide

## Essayez en environ 60 secondes

1. Ouvrir la [démo Shape Particles](/demos/compute-particles/)
2. Choisir un preset de forme et orbiter la formation
3. Appuyer Release — observer gravité et rebond au sol
4. Appuyer Reset pour reformer ; essayer une autre forme

## Prérequis et performances

- **Navigateur :** Chrome ou Edge avec WebGPU activé (versions récentes)
- **GPU :** GPU discret ou intégré récent recommandé pour des counts denses
- **Fallback :** sans WebGPU vous verrez un message de capacité — pas de port WebGL

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Formation maintenue — particules lisibles comme preset solide](/assets/blog/compute-particles/view-a.jpg?v=20260722a)

![Après Release — spray et rebond sur le plan au sol](/assets/blog/compute-particles/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Cycler les presets pour une courte boucle marque
- Ajuster count / look pour perf stand vs laptop
- Comparer avec [three.js webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles)

## Comment ça marche

Un pass compute [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) met à jour l'état particules chaque frame ; le renderer dessine le résultat. Three.js expose cela via son renderer WebGPU et nœuds compute TSL. Upstream : [webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_particles.html)). WebGL peut aussi dessiner des particules, mais la boucle gravité/reforme de cette démo est construite pour compute WebGPU.

## FAQ

**Pourquoi mon navigateur dit que WebGPU manque ?**  
Cette expérience nécessite WebGPU. Utilisez Chrome ou Edge à jour ; le support Safari/Firefox varie selon la version.

**Les particules peuvent-elles former notre logo ?**  
Meshes cibles ou nuages de points custom sont une suite naturelle — demandez-nous un build cadré.

## Stack technique et lectures

- [three.js — compute particles](https://threejs.org/examples/#webgpu_compute_particles)
- [WebGPU API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Sur IOM

Parcourez [Expériences](/#experiments), plus [WebGPU Particles](/blog/webgpu-particles), [WebGPU Compute Birds](/blog/webgpu-compute-birds), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$Shape Particles — physique compute WebGPU — IOM$iom$,
  $iom$Des milliers de particules s'alignent en cube, sphère, tore, cœur — puis Release les lâche sous gravité GPU avec rebond au sol. WebGPU compute garde la simulation sur la carte grap$iom$
from public.blog_posts p
where p.slug = $iom$compute-particles$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$Shape Particles — WebGPU compute physics$iom$,
  $iom$Duizenden deeltjes klikken in kubus, bol, torus, hart — dan laat Release ze vallen onder GPU-zwaartekracht met vloerbounce. WebGPU compute houdt de simulatie op de grafische kaart.$iom$,
  $iom$Duizenden deeltjes klikken in kubus, bol, torus, hart — dan laat Release ze vallen onder GPU-zwaartekracht met vloerbounce. WebGPU compute houdt de simulatie op de grafische kaart.

Het staat in onze [Experimenten-sectie](/#experiments) als **Shape Particles**. De cover toont een shape-preset in formatie vóór de drop.

## Open de live demo

**[→ Start Shape Particles](/demos/compute-particles/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Formatie → chaos → reform** — een helder verhaal voor product- of merkmotion
- **Compute op GPU** — fysicastappen zonder main thread te blokkeren
- **Shape-presets** — kubus, bol, torus, kegel, piramide, ring, hart
- **Interactief bewijs** — Release en Reset verkopen het idee in één klik

Typische toepassingen: launch-teasers, standloops en „onze data wordt deze vorm“-pitchmomenten.

## Voor beginners — wat is dit, in gewone taal?

Denk aan magnetisch zand dat een logo-achtige vorm kan houden, dan valt als u loslaat — en terugspringt in vorm bij reset. Het verschil is snelheid: de GPU werkt elk deeltje bij zodat het vloeiend blijft.

**Korte glossary**

- **WebGPU** — moderne browser GPU-API (nieuwer dan WebGL) voor compute en rendering
- **Compute shader** — GPU-programma dat data (posities, snelheden) bijwerkt zonder driehoeken te tekenen
- **TSL** — Three.js Shading Language — node-gebaseerde GPU-logica in JS
- **Formatie** — doelposities die deeltjes als solide vorm laten lezen

## Probeer dit in ongeveer 60 seconden

1. Open de [Shape Particles demo](/demos/compute-particles/)
2. Kies een shape-preset en orbiteer de formatie
3. Druk Release — kijk naar zwaartekracht en vloerbounce
4. Druk Reset om te reformen; probeer een andere vorm

## Vereisten en performance

- **Browser:** Chrome of Edge met WebGPU ingeschakeld (recente versies)
- **GPU:** discrete of recente geïntegreerde GPU aanbevolen voor dichte counts
- **Fallback:** zonder WebGPU ziet u een capability-bericht — geen WebGL-port

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Vastgehouden formatie — deeltjes lezen als solide preset-vorm](/assets/blog/compute-particles/view-a.jpg?v=20260722a)

![Na Release — spray en bounce op het grondvlak](/assets/blog/compute-particles/view-b.jpg?v=20260722a)

Ook in deze build:

- Presets cyclen voor een korte merkloop
- Count / look tunen voor stand vs. laptop-performance
- Vergelijken met [three.js webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles)

## Hoe het werkt

Een [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) compute pass werkt deeltjesstate per frame bij; de renderer tekent het resultaat. Three.js exposeert dit via WebGPU renderer en TSL compute nodes. Upstream: [webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_particles.html)). WebGL kan ook deeltjes tekenen, maar de zwaartekracht- en reform-loop van deze demo is gebouwd voor WebGPU compute.

## FAQ

**Waarom zegt mijn browser dat WebGPU ontbreekt?**  
Dit experiment heeft WebGPU nodig. Gebruik bijgewerkte Chrome of Edge; Safari/Firefox-ondersteuning varieert per versie.

**Kunnen de deeltjes ons logo vormen?**  
Custom target meshes of point clouds zijn een natuurlijke volgende stap — vraag ons om een scoped build.

## Tech stack en verder lezen

- [three.js — compute particles](https://threejs.org/examples/#webgpu_compute_particles)
- [WebGPU API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Gerelateerd op IOM

Bekijk meer in [Experimenten](/#experiments), plus [WebGPU Particles](/blog/webgpu-particles), [WebGPU Compute Birds](/blog/webgpu-compute-birds), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$Shape Particles — WebGPU compute physics — IOM$iom$,
  $iom$Duizenden deeltjes klikken in kubus, bol, torus, hart — dan laat Release ze vallen onder GPU-zwaartekracht met vloerbounce. WebGPU compute houdt de simulatie op de grafische kaart.$iom$
from public.blog_posts p
where p.slug = $iom$compute-particles$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$Shape Particles — fisica compute WebGPU$iom$,
  $iom$Migliaia di particelle si allineano in cubo, sfera, toro, cuore — poi Release le lascia cadere sotto gravità GPU con rimbalzo sul pavimento. WebGPU compute mantiene la simulazione $iom$,
  $iom$Migliaia di particelle si allineano in cubo, sfera, toro, cuore — poi Release le lascia cadere sotto gravità GPU con rimbalzo sul pavimento. WebGPU compute mantiene la simulazione sulla scheda grafica.

Si trova nella nostra [sezione Esperimenti](/#experiments) come **Shape Particles**. La copertina mostra un preset forma tenuto in formazione prima del drop.

## Apri la demo live

**[→ Avvia Shape Particles](/demos/compute-particles/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Formazione → caos → reform** — una storia chiara per motion prodotto o brand
- **Compute su GPU** — passi fisici senza bloccare il main thread
- **Preset forma** — cubo, sfera, toro, cono, piramide, anello, cuore
- **Prova interattiva** — Release e Reset vendono l'idea in un clic

Usi tipici: teaser di lancio, loop da stand e momenti pitch „i nostri dati diventano questa forma“.

## Per principianti — cos’è, in parole semplici?

Pensate a sabbia magnetica che può tenere una forma tipo logo, poi cade quando lasciate — e torna in forma al reset. La differenza è velocità: la GPU aggiorna ogni particella così resta fluida.

**Glossario rapido**

- **WebGPU** — API GPU browser moderna (più recente di WebGL) per compute e rendering
- **Compute shader** — programma GPU che aggiorna dati (posizioni, velocità) senza disegnare triangoli
- **TSL** — Three.js Shading Language — logica GPU basata su nodi in JS
- **Formazione** — posizioni target che fanno leggere le particelle come forma solida

## Provalo in circa 60 secondi

1. Aprire la [demo Shape Particles](/demos/compute-particles/)
2. Scegliere un preset forma e orbitare la formazione
3. Premere Release — osservare gravità e rimbalzo sul pavimento
4. Premere Reset per reformare; provare un'altra forma

## Requisiti e prestazioni

- **Browser:** Chrome o Edge con WebGPU abilitato (versioni recenti)
- **GPU:** GPU discreta o integrata recente consigliata per count densi
- **Fallback:** senza WebGPU vedrete un messaggio capability — non è un port WebGL

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Formazione tenuta — particelle che leggono come preset solido](/assets/blog/compute-particles/view-a.jpg?v=20260722a)

![Dopo Release — spray e rimbalzo sul piano del pavimento](/assets/blog/compute-particles/view-b.jpg?v=20260722a)

Anche in questa build:

- Ciclare preset per un breve loop brand
- Regolare count / look per performance stand vs laptop
- Confrontare con [three.js webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles)

## Come funziona

Un pass compute [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) aggiorna lo stato particelle ogni frame; il renderer disegna il risultato. Three.js espone questo tramite WebGPU renderer e nodi compute TSL. Upstream: [webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_particles.html)). WebGL può disegnare particelle, ma il loop gravità/reform di questa demo è costruito per compute WebGPU.

## FAQ

**Perché il browser dice che manca WebGPU?**  
Questo esperimento richiede WebGPU. Usare Chrome o Edge aggiornato; il supporto Safari/Firefox varia per versione.

**Le particelle possono formare il nostro logo?**  
Mesh target o point cloud custom sono un passo naturale — chiedeteci un build scoped.

## Stack tecnico e letture

- [three.js — compute particles](https://threejs.org/examples/#webgpu_compute_particles)
- [WebGPU API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Correlati su IOM

Esplora di più in [Esperimenti](/#experiments), più [WebGPU Particles](/blog/webgpu-particles), [WebGPU Compute Birds](/blog/webgpu-compute-birds), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$Shape Particles — fisica compute WebGPU — IOM$iom$,
  $iom$Migliaia di particelle si allineano in cubo, sfera, toro, cuore — poi Release le lascia cadere sotto gravità GPU con rimbalzo sul pavimento. WebGPU compute mantiene la simulazione $iom$
from public.blog_posts p
where p.slug = $iom$compute-particles$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$Shape Particles — física compute WebGPU$iom$,
  $iom$Miles de partículas encajan en cubo, esfera, toro, corazón — luego Release las suelta bajo gravedad GPU con rebote en el suelo. WebGPU compute mantiene la simulación en la tarjeta $iom$,
  $iom$Miles de partículas encajan en cubo, esfera, toro, corazón — luego Release las suelta bajo gravedad GPU con rebote en el suelo. WebGPU compute mantiene la simulación en la tarjeta gráfica.

Está en nuestra [sección Experimentos](/#experiments) como **Shape Particles**. La portada muestra un preset de forma mantenido en formación antes del drop.

## Abrir la demo en vivo

**[→ Lanzar Shape Particles](/demos/compute-particles/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Formación → caos → reforma** — una historia clara para motion de producto o marca
- **Compute en GPU** — pasos de física sin bloquear el main thread
- **Presets de forma** — cubo, esfera, toro, cono, pirámide, anillo, corazón
- **Prueba interactiva** — Release y Reset venden la idea en un clic

Usos típicos: teasers de lanzamiento, bucles de stand y momentos pitch „nuestros datos se vuelven esta forma“.

## Para principiantes — ¿qué es esto, en palabras simples?

Piense en arena magnética que puede mantener una forma tipo logo, luego cae al soltar — y vuelve a la forma al reset. La diferencia es velocidad: la GPU actualiza cada partícula para que siga fluida.

**Glosario rápido**

- **WebGPU** — API GPU de navegador moderna (más reciente que WebGL) para compute y rendering
- **Compute shader** — programa GPU que actualiza datos (posiciones, velocidades) sin dibujar triángulos
- **TSL** — Three.js Shading Language — lógica GPU basada en nodos en JS
- **Formación** — posiciones objetivo que hacen leer las partículas como forma sólida

## Pruébalo en unos 60 segundos

1. Abrir la [demo Shape Particles](/demos/compute-particles/)
2. Elegir un preset de forma y orbitar la formación
3. Pulsar Release — ver gravedad y rebote en el suelo
4. Pulsar Reset para reformar; probar otra forma

## Requisitos y rendimiento

- **Navegador:** Chrome o Edge con WebGPU habilitado (versiones recientes)
- **GPU:** GPU discreta o integrada reciente recomendada para counts densos
- **Fallback:** sin WebGPU verá un mensaje de capacidad — no es un port WebGL

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Formación mantenida — partículas leyéndose como preset sólido](/assets/blog/compute-particles/view-a.jpg?v=20260722a)

![Tras Release — spray y rebote en el plano del suelo](/assets/blog/compute-particles/view-b.jpg?v=20260722a)

También en este build:

- Ciclar presets para un bucle de marca corto
- Ajustar count / look para rendimiento stand vs portátil
- Comparar con [three.js webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles)

## Cómo funciona

Un pass compute [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) actualiza el estado de partículas cada frame; el renderer dibuja el resultado. Three.js expone esto vía WebGPU renderer y nodos compute TSL. Upstream: [webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_particles.html)). WebGL también puede dibujar partículas, pero el loop gravedad/reforma de esta demo está construido para compute WebGPU.

## FAQ

**¿Por qué mi navegador dice que falta WebGPU?**  
Este experimento necesita WebGPU. Use Chrome o Edge actualizado; el soporte Safari/Firefox varía por versión.

**¿Pueden las partículas formar nuestro logo?**  
Meshes objetivo o point clouds custom son un paso natural — pídanos un build acotado.

## Stack técnico y lecturas

- [three.js — compute particles](https://threejs.org/examples/#webgpu_compute_particles)
- [WebGPU API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Relacionado en IOM

Explora más en [Experimentos](/#experiments), más [WebGPU Particles](/blog/webgpu-particles), [WebGPU Compute Birds](/blog/webgpu-compute-birds), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$Shape Particles — física compute WebGPU — IOM$iom$,
  $iom$Miles de partículas encajan en cubo, esfera, toro, corazón — luego Release las suelta bajo gravedad GPU con rebote en el suelo. WebGPU compute mantiene la simulación en la tarjeta $iom$
from public.blog_posts p
where p.slug = $iom$compute-particles$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$WebGPU Spotlight — textured beams and shadows$iom$,
  $iom$A spot light that behaves like a theatrical fixture — texture projected into the cone, soft penumbra, decay, and focused shadows — running on Three.js WebGPU with the classic Lucy $iom$,
  $iom$A spot light that behaves like a theatrical fixture — texture projected into the cone, soft penumbra, decay, and focused shadows — running on Three.js WebGPU with the classic Lucy scan as the subject.

It lives in our [Experiments section](/#experiments) as **WebGPU Spotlight**. The cover shows Lucy under the moving spotlight on a shadow-receiving ground.

## Open the live demo

**[→ Launch WebGPU Spotlight](/demos/webgpu-spotlight/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Showroom lighting language** — cone, falloff, and gobo-like texture maps
- **Real shadows** — contact on the ground sells depth for product and sculpture
- **WebGPU materials path** — modern Three.js lighting, not a baked GIF
- **Helpers on demand** — visualize the light when you are tuning

Typical uses: product turntables, gallery studies, and lighting pitches before a full production scene.

## For beginners — what is this, in plain words?

A spotlight is a cone of light, like a stage lamp. Here you can see the soft edge of the cone, how brightness falls off with distance, and how the shadow of the sculpture sits on the floor — all live in the browser.

**Quick glossary**

- **Spotlight** — a light with a cone angle, aim direction, and optional texture in the beam
- **Penumbra** — the soft edge of the light cone
- **Decay** — how quickly intensity falls with distance
- **WebGPU** — the newer browser GPU API used by this Three.js renderer path

## Try this in about 60 seconds

1. Open the [WebGPU Spotlight demo](/demos/webgpu-spotlight/)
2. Orbit around Lucy; watch the moving spot and ground shadow
3. Toggle light helpers if available to see the cone
4. Note penumbra and focus — soft edge vs sharp shadow trade-offs

## Requirements and performance

- **Browser:** Chrome or Edge with WebGPU (this is not the older WebGL lights example)
- **GPU:** any recent laptop GPU is usually enough for this scene
- **Model:** Lucy PLY is included — heavy custom meshes may need optimization

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Three-quarter — cone light reading on Lucy and floor](/assets/blog/webgpu-spotlight/view-a.jpg?v=20260722a)

![Shadow focus — contact shadow and penumbra on the ground](/assets/blog/webgpu-spotlight/view-b.jpg?v=20260722a)

Also in this build:

- Swap gobo / projection textures for brand patterns
- Pair with volumetric demos for “beam in the air” mood
- Study the upstream [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight) example

## How it works

Three.js `WebGPURenderer` evaluates spot lights with maps, penumbra, decay, and shadow maps in the WebGPU pipeline. The scene orbits an animated spot over the Lucy PLY on a receiving plane. Official example: [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_lights_spotlight.html)). WebGL has classic spotlight examples too; this page specifically tracks the WebGPU lights path.

## FAQ

**Is this the same as volumetric god rays?**  
No — this is surface lighting and shadows. For beams in the air, see our volumetric lighting work.

**Can we light our own product?**  
Yes. Replacing Lucy with a GLB and matching exposure is a typical client next step.

## Tech stack and further reading

- [three.js — WebGPU spotlight](https://threejs.org/examples/#webgpu_lights_spotlight)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Related on IOM

Browse more in [Experiments](/#experiments), plus [Volumetric Lighting](/blog/volume-lighting), [WebGPU Custom Fog Scattering](/blog/webgpu-custom-fog-scattering), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$WebGPU Spotlight — textured beams and shadows — IOM$iom$,
  $iom$A spot light that behaves like a theatrical fixture — texture projected into the cone, soft penumbra, decay, and focused shadows — running on Three.js WebGPU with the classic Lucy $iom$
from public.blog_posts p
where p.slug = $iom$webgpu-spotlight$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$WebGPU Spotlight — texturierte Strahlen und Schatten$iom$,
  $iom$Ein Spot Light wie ein theatralisches Fixture — Textur im Kegel projiziert, weiche Penumbra, Decay und fokussierte Schatten — auf Three.js WebGPU mit dem klassischen Lucy-Scan als $iom$,
  $iom$Ein Spot Light wie ein theatralisches Fixture — Textur im Kegel projiziert, weiche Penumbra, Decay und fokussierte Schatten — auf Three.js WebGPU mit dem klassischen Lucy-Scan als Subjekt.

Es liegt in unserem [Experimente-Bereich](/#experiments) als **WebGPU Spotlight**. Das Cover zeigt Lucy unter dem beweglichen Spotlight auf schattenempfangendem Boden.

## Live-Demo öffnen

**[→ WebGPU Spotlight starten](/demos/webgpu-spotlight/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Showroom-Beleuchtungssprache** — Kegel, Falloff und gobo-artige Texture Maps
- **Echte Schatten** — Kontakt am Boden verkauft Tiefe für Produkt und Skulptur
- **WebGPU-Materialpfad** — moderne Three.js-Beleuchtung, kein gebackenes GIF
- **Helpers on demand** — Licht visualisieren beim Tuning

Typische Einsätze: Produkt-Turntables, Galerie-Studien und Beleuchtungs-Pitches vor einer vollen Production-Szene.

## Für Einsteiger — was ist das, in einfachen Worten?

Ein Spotlight ist ein Lichtkegel, wie eine Bühnenlampe. Hier sehen Sie die weiche Kante des Kegels, wie Helligkeit mit der Entfernung abfällt und wie der Schatten der Skulptur auf dem Boden liegt — alles live im Browser.

**Kurzes Glossar**

- **Spotlight** — Licht mit Kegelwinkel, Ausrichtung und optionaler Textur im Strahl
- **Penumbra** — die weiche Kante des Lichtkegels
- **Decay** — wie schnell Intensität mit der Entfernung abfällt
- **WebGPU** — die neuere Browser-GPU-API dieses Three.js-Renderer-Pfads

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [WebGPU Spotlight Demo](/demos/webgpu-spotlight/)
2. Orbitieren Sie um Lucy; beobachten Sie den beweglichen Spot und Bodenschatten
3. Licht-Helpers togglen, falls verfügbar, um den Kegel zu sehen
4. Penumbra und Focus beachten — weiche Kante vs. scharfer Schatten als Trade-offs

## Anforderungen und Performance

- **Browser:** Chrome oder Edge mit WebGPU (nicht das ältere WebGL-Lights-Beispiel)
- **GPU:** jede aktuelle Laptop-GPU reicht meist für diese Szene
- **Model:** Lucy PLY ist enthalten — schwere Custom Meshes brauchen ggf. Optimierung

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Dreiviertel — Kegellicht auf Lucy und Boden lesbar](/assets/blog/webgpu-spotlight/view-a.jpg?v=20260722a)

![Shadow Focus — Kontaktschatten und Penumbra am Boden](/assets/blog/webgpu-spotlight/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Gobo-/Projektionstexturen für Markenmuster tauschen
- Mit volumetrischen Demos für „Strahl in der Luft“-Stimmung paaren
- Das upstream [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight)-Beispiel studieren

## So funktioniert es

Three.js `WebGPURenderer` evaluiert Spot Lights mit Maps, Penumbra, Decay und Shadow Maps in der WebGPU-Pipeline. Die Szene orbitiert einen animierten Spot über Lucy PLY auf einer empfangenden Ebene. Offizielles Beispiel: [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_lights_spotlight.html)). WebGL hat klassische Spotlight-Beispiele; diese Seite folgt speziell dem WebGPU-Lights-Pfad.

## FAQ

**Ist das dasselbe wie volumetrische God Rays?**  
Nein — das ist Oberflächenbeleuchtung und Schatten. Für Strahlen in der Luft siehe unsere volumetrische Beleuchtung.

**Können wir unser eigenes Produkt beleuchten?**  
Ja. Lucy durch ein GLB ersetzen und Exposure matchen ist ein typischer Kunden-Nächstschritt.

## Tech-Stack und weiterführende Links

- [three.js — WebGPU spotlight](https://threejs.org/examples/#webgpu_lights_spotlight)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Verwandt bei IOM

Mehr in [Experimente](/#experiments), plus [Volumetric Lighting](/blog/volume-lighting), [WebGPU Custom Fog Scattering](/blog/webgpu-custom-fog-scattering), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$WebGPU Spotlight — texturierte Strahlen und Schatten — IOM$iom$,
  $iom$Ein Spot Light wie ein theatralisches Fixture — Textur im Kegel projiziert, weiche Penumbra, Decay und fokussierte Schatten — auf Three.js WebGPU mit dem klassischen Lucy-Scan als $iom$
from public.blog_posts p
where p.slug = $iom$webgpu-spotlight$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$WebGPU Spotlight — faisceaux texturés et ombres$iom$,
  $iom$Un spot light qui se comporte comme un projecteur théâtral — texture projetée dans le cône, penumbra douce, decay et ombres focalisées — sur Three.js WebGPU avec le scan classique $iom$,
  $iom$Un spot light qui se comporte comme un projecteur théâtral — texture projetée dans le cône, penumbra douce, decay et ombres focalisées — sur Three.js WebGPU avec le scan classique Lucy comme sujet.

Il se trouve dans notre [section Expériences](/#experiments) sous **WebGPU Spotlight**. La couverture montre Lucy sous le spotlight mobile sur sol recevant les ombres.

## Ouvrir la démo en direct

**[→ Lancer WebGPU Spotlight](/demos/webgpu-spotlight/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Langage lumière showroom** — cône, falloff et texture maps type gobo
- **Vraies ombres** — contact au sol vend la profondeur pour produit et sculpture
- **Voie matériaux WebGPU** — éclairage Three.js moderne, pas un GIF pré-calculé
- **Helpers à la demande** — visualiser la lumière en réglage

Usages typiques : turntables produit, études galerie et pitches éclairage avant une scène production complète.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Un spotlight est un cône de lumière, comme une lampe de scène. Ici vous voyez le bord doux du cône, comment la luminosité décroît avec la distance, et comment l'ombre de la sculpture repose sur le sol — tout en live dans le navigateur.

**Glossaire rapide**

- **Spotlight** — une lumière avec angle de cône, direction et texture optionnelle dans le faisceau
- **Penumbra** — le bord doux du cône lumineux
- **Decay** — vitesse de chute d'intensité avec la distance
- **WebGPU** — l'API GPU navigateur plus récente utilisée par cette voie renderer Three.js

## Essayez en environ 60 secondes

1. Ouvrir la [démo WebGPU Spotlight](/demos/webgpu-spotlight/)
2. Orbiter autour de Lucy ; observer le spot mobile et l'ombre au sol
3. Basculer les helpers lumière si disponibles pour voir le cône
4. Noter penumbra et focus — bord doux vs ombre nette comme compromis

## Prérequis et performances

- **Navigateur :** Chrome ou Edge avec WebGPU (pas l'ancien exemple lights WebGL)
- **GPU :** tout GPU laptop récent suffit en général pour cette scène
- **Modèle :** Lucy PLY inclus — meshes custom lourds peuvent nécessiter optimisation

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Trois-quarts — cône lumineux lisible sur Lucy et sol](/assets/blog/webgpu-spotlight/view-a.jpg?v=20260722a)

![Focus ombre — ombre de contact et penumbra au sol](/assets/blog/webgpu-spotlight/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Échanger textures gobo / projection pour motifs de marque
- Associer à des démos volumétriques pour ambiance « faisceau dans l'air »
- Étudier l'exemple upstream [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight)

## Comment ça marche

Three.js `WebGPURenderer` évalue les spot lights avec maps, penumbra, decay et shadow maps dans le pipeline WebGPU. La scène orbite un spot animé au-dessus de Lucy PLY sur un plan receveur. Exemple officiel : [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_lights_spotlight.html)). WebGL a aussi des exemples spotlight classiques ; cette page suit spécifiquement la voie lights WebGPU.

## FAQ

**Est-ce la même chose que les god rays volumétriques ?**  
Non — c'est éclairage de surface et ombres. Pour des faisceaux dans l'air, voir notre travail d'éclairage volumétrique.

**Pouvons-nous éclairer notre propre produit ?**  
Oui. Remplacer Lucy par un GLB et matcher l'exposition est une suite client typique.

## Stack technique et lectures

- [three.js — WebGPU spotlight](https://threejs.org/examples/#webgpu_lights_spotlight)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Sur IOM

Parcourez [Expériences](/#experiments), plus [Volumetric Lighting](/blog/volume-lighting), [WebGPU Custom Fog Scattering](/blog/webgpu-custom-fog-scattering), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$WebGPU Spotlight — faisceaux texturés et ombres — IOM$iom$,
  $iom$Un spot light qui se comporte comme un projecteur théâtral — texture projetée dans le cône, penumbra douce, decay et ombres focalisées — sur Three.js WebGPU avec le scan classique $iom$
from public.blog_posts p
where p.slug = $iom$webgpu-spotlight$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$WebGPU Spotlight — getextureerde bundels en schaduwen$iom$,
  $iom$Een spot light die zich gedraagt als een theatralisch armatuur — textuur geprojecteerd in de kegel, zachte penumbra, decay en gefocuste schaduwen — op Three.js WebGPU met de klassi$iom$,
  $iom$Een spot light die zich gedraagt als een theatralisch armatuur — textuur geprojecteerd in de kegel, zachte penumbra, decay en gefocuste schaduwen — op Three.js WebGPU met de klassieke Lucy-scan als onderwerp.

Het staat in onze [Experimenten-sectie](/#experiments) als **WebGPU Spotlight**. De cover toont Lucy onder de bewegende spotlight op schaduwontvangende grond.

## Open de live demo

**[→ Start WebGPU Spotlight](/demos/webgpu-spotlight/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Showroom-lichttaal** — kegel, falloff en gobo-achtige texture maps
- **Echte schaduwen** — contact op de grond verkoopt diepte voor product en sculptuur
- **WebGPU materialenpad** — moderne Three.js-verlichting, geen gebakken GIF
- **Helpers on demand** — visualiseer het licht tijdens tunen

Typische toepassingen: product-turntables, galeriestudies en lichtpitches vóór een volledige production-scène.

## Voor beginners — wat is dit, in gewone taal?

Een spotlight is een lichtkegel, zoals een podiump lamp. Hier ziet u de zachte rand van de kegel, hoe helderheid afneemt met afstand, en hoe de schaduw van de sculptuur op de vloer ligt — allemaal live in de browser.

**Korte glossary**

- **Spotlight** — een licht met kegelhoek, richting en optionele textuur in de bundel
- **Penumbra** — de zachte rand van de lichtkegel
- **Decay** — hoe snel intensiteit afneemt met afstand
- **WebGPU** — de nieuwere browser GPU-API gebruikt door dit Three.js renderer-pad

## Probeer dit in ongeveer 60 seconden

1. Open de [WebGPU Spotlight demo](/demos/webgpu-spotlight/)
2. Orbiteer rond Lucy; kijk naar de bewegende spot en grondschaduw
3. Toggle lichthelpers indien beschikbaar om de kegel te zien
4. Let op penumbra en focus — zachte rand vs. scherpe schaduw als trade-offs

## Vereisten en performance

- **Browser:** Chrome of Edge met WebGPU (niet het oudere WebGL lights-voorbeeld)
- **GPU:** elke recente laptop-GPU is meestal genoeg voor deze scène
- **Model:** Lucy PLY is inbegrepen — zware custom meshes kunnen optimalisatie nodig hebben

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Driekwart — kegellicht leesbaar op Lucy en vloer](/assets/blog/webgpu-spotlight/view-a.jpg?v=20260722a)

![Shadow focus — contactschaduw en penumbra op de grond](/assets/blog/webgpu-spotlight/view-b.jpg?v=20260722a)

Ook in deze build:

- Gobo / projectietexturen wisselen voor merkmotieven
- Koppelen aan volumetrische demo's voor „bundel in de lucht“-sfeer
- Het upstream [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight)-voorbeeld bestuderen

## Hoe het werkt

Three.js `WebGPURenderer` evalueert spot lights met maps, penumbra, decay en shadow maps in de WebGPU-pipeline. De scène orbiteert een geanimeerde spot boven Lucy PLY op een ontvangend vlak. Officieel voorbeeld: [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_lights_spotlight.html)). WebGL heeft klassieke spotlight-voorbeelden; deze pagina volgt specifiek het WebGPU lights-pad.

## FAQ

**Is dit hetzelfde als volumetrische god rays?**  
Nee — dit is oppervlakteverlichting en schaduwen. Voor bundels in de lucht, zie ons volumetrische verlichtingswerk.

**Kunnen we ons eigen product belichten?**  
Ja. Lucy vervangen door een GLB en exposure matchen is een typische klant-volgende stap.

## Tech stack en verder lezen

- [three.js — WebGPU spotlight](https://threejs.org/examples/#webgpu_lights_spotlight)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Gerelateerd op IOM

Bekijk meer in [Experimenten](/#experiments), plus [Volumetric Lighting](/blog/volume-lighting), [WebGPU Custom Fog Scattering](/blog/webgpu-custom-fog-scattering), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$WebGPU Spotlight — getextureerde bundels en schaduwen — IOM$iom$,
  $iom$Een spot light die zich gedraagt als een theatralisch armatuur — textuur geprojecteerd in de kegel, zachte penumbra, decay en gefocuste schaduwen — op Three.js WebGPU met de klassi$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-spotlight$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$WebGPU Spotlight — fasci texturizzati e ombre$iom$,
  $iom$Un spot light che si comporta come un proiettore teatrale — texture proiettata nel cono, penombra morbida, decay e ombre focalizzate — su Three.js WebGPU con la classica scansione $iom$,
  $iom$Un spot light che si comporta come un proiettore teatrale — texture proiettata nel cono, penombra morbida, decay e ombre focalizzate — su Three.js WebGPU con la classica scansione Lucy come soggetto.

Si trova nella nostra [sezione Esperimenti](/#experiments) come **WebGPU Spotlight**. La copertina mostra Lucy sotto lo spotlight mobile su pavimento che riceve ombre.

## Apri la demo live

**[→ Avvia WebGPU Spotlight](/demos/webgpu-spotlight/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Linguaggio luce showroom** — cono, falloff e texture map tipo gobo
- **Ombre reali** — contatto a terra vende profondità per prodotto e scultura
- **Percorso materiali WebGPU** — illuminazione Three.js moderna, non GIF pre-calcolata
- **Helper on demand** — visualizzare la luce durante il tuning

Usi tipici: turntable prodotto, studi galleria e pitch illuminazione prima di una scena production completa.

## Per principianti — cos’è, in parole semplici?

Uno spotlight è un cono di luce, come una lampada da palco. Qui vedete il bordo morbido del cono, come la luminosità cala con la distanza, e come l'ombra della scultura sta sul pavimento — tutto live nel browser.

**Glossario rapido**

- **Spotlight** — luce con angolo cono, direzione e texture opzionale nel fascio
- **Penumbra** — il bordo morbido del cono luminoso
- **Decay** — quanto rapidamente l'intensità cala con la distanza
- **WebGPU** — l'API GPU browser più recente usata da questo percorso renderer Three.js

## Provalo in circa 60 secondi

1. Aprire la [demo WebGPU Spotlight](/demos/webgpu-spotlight/)
2. Orbitare intorno a Lucy; osservare lo spot mobile e l'ombra a terra
3. Attivare helper luce se disponibili per vedere il cono
4. Notare penombra e focus — bordo morbido vs ombra netta come compromessi

## Requisiti e prestazioni

- **Browser:** Chrome o Edge con WebGPU (non l'esempio lights WebGL più vecchio)
- **GPU:** qualsiasi GPU laptop recente di solito basta per questa scena
- **Modello:** Lucy PLY incluso — mesh custom pesanti possono richiedere ottimizzazione

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Tre quarti — cono luce leggibile su Lucy e pavimento](/assets/blog/webgpu-spotlight/view-a.jpg?v=20260722a)

![Focus ombra — ombra di contatto e penombra a terra](/assets/blog/webgpu-spotlight/view-b.jpg?v=20260722a)

Anche in questa build:

- Scambiare texture gobo / proiezione per pattern brand
- Abbinare a demo volumetriche per mood „fascio nell'aria“
- Studiare l'esempio upstream [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight)

## Come funziona

Three.js `WebGPURenderer` valuta spot light con map, penombra, decay e shadow map nella pipeline WebGPU. La scena orbita uno spot animato sopra Lucy PLY su un piano ricevente. Esempio ufficiale: [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_lights_spotlight.html)). WebGL ha esempi spotlight classici; questa pagina segue specificamente il percorso lights WebGPU.

## FAQ

**È la stessa cosa dei god ray volumetrici?**  
No — è illuminazione di superficie e ombre. Per fasci nell'aria, vedere il nostro lavoro di illuminazione volumetrica.

**Possiamo illuminare il nostro prodotto?**  
Sì. Sostituire Lucy con un GLB e matchare l'esposizione è un tipico passo client.

## Stack tecnico e letture

- [three.js — WebGPU spotlight](https://threejs.org/examples/#webgpu_lights_spotlight)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Correlati su IOM

Esplora di più in [Esperimenti](/#experiments), più [Volumetric Lighting](/blog/volume-lighting), [WebGPU Custom Fog Scattering](/blog/webgpu-custom-fog-scattering), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$WebGPU Spotlight — fasci texturizzati e ombre — IOM$iom$,
  $iom$Un spot light che si comporta come un proiettore teatrale — texture proiettata nel cono, penombra morbida, decay e ombre focalizzate — su Three.js WebGPU con la classica scansione $iom$
from public.blog_posts p
where p.slug = $iom$webgpu-spotlight$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$WebGPU Spotlight — haces texturizados y sombras$iom$,
  $iom$Un spot light que se comporta como un foco teatral — textura proyectada en el cono, penumbra suave, decay y sombras enfocadas — en Three.js WebGPU con el clásico escaneo Lucy como $iom$,
  $iom$Un spot light que se comporta como un foco teatral — textura proyectada en el cono, penumbra suave, decay y sombras enfocadas — en Three.js WebGPU con el clásico escaneo Lucy como sujeto.

Está en nuestra [sección Experimentos](/#experiments) como **WebGPU Spotlight**. La portada muestra Lucy bajo el spotlight móvil en suelo que recibe sombras.

## Abrir la demo en vivo

**[→ Lanzar WebGPU Spotlight](/demos/webgpu-spotlight/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Lenguaje de luz showroom** — cono, falloff y texture maps tipo gobo
- **Sombras reales** — contacto en el suelo vende profundidad para producto y escultura
- **Ruta materiales WebGPU** — iluminación Three.js moderna, no GIF pre-renderizado
- **Helpers on demand** — visualizar la luz al ajustar

Usos típicos: turntables de producto, estudios de galería y pitches de iluminación antes de una escena production completa.

## Para principiantes — ¿qué es esto, en palabras simples?

Un spotlight es un cono de luz, como una lámpara de escenario. Aquí ve el borde suave del cono, cómo el brillo cae con la distancia y cómo la sombra de la escultura reposa en el suelo — todo en vivo en el navegador.

**Glosario rápido**

- **Spotlight** — luz con ángulo de cono, dirección y textura opcional en el haz
- **Penumbra** — el borde suave del cono de luz
- **Decay** — qué tan rápido cae la intensidad con la distancia
- **WebGPU** — la API GPU de navegador más reciente usada por esta ruta renderer Three.js

## Pruébalo en unos 60 segundos

1. Abrir la [demo WebGPU Spotlight](/demos/webgpu-spotlight/)
2. Orbitar alrededor de Lucy; ver el spot móvil y la sombra en el suelo
3. Alternar helpers de luz si están disponibles para ver el cono
4. Notar penumbra y focus — borde suave vs sombra nítida como trade-offs

## Requisitos y rendimiento

- **Navegador:** Chrome o Edge con WebGPU (no el ejemplo lights WebGL más antiguo)
- **GPU:** cualquier GPU de portátil reciente suele bastar para esta escena
- **Modelo:** Lucy PLY incluido — meshes custom pesados pueden necesitar optimización

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Tres cuartos — cono de luz legible sobre Lucy y suelo](/assets/blog/webgpu-spotlight/view-a.jpg?v=20260722a)

![Focus sombra — sombra de contacto y penumbra en el suelo](/assets/blog/webgpu-spotlight/view-b.jpg?v=20260722a)

También en este build:

- Cambiar texturas gobo / proyección por patrones de marca
- Emparejar con demos volumétricas para mood „haz en el aire“
- Estudiar el ejemplo upstream [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight)

## Cómo funciona

Three.js `WebGPURenderer` evalúa spot lights con maps, penumbra, decay y shadow maps en la pipeline WebGPU. La escena orbita un spot animado sobre Lucy PLY en un plano receptor. Ejemplo oficial: [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_lights_spotlight.html)). WebGL tiene ejemplos spotlight clásicos; esta página sigue específicamente la ruta lights WebGPU.

## FAQ

**¿Es lo mismo que god rays volumétricos?**  
No — es iluminación de superficie y sombras. Para haces en el aire, vea nuestro trabajo de iluminación volumétrica.

**¿Podemos iluminar nuestro propio producto?**  
Sí. Reemplazar Lucy por un GLB y emparejar exposición es un paso cliente típico.

## Stack técnico y lecturas

- [three.js — WebGPU spotlight](https://threejs.org/examples/#webgpu_lights_spotlight)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Relacionado en IOM

Explora más en [Experimentos](/#experiments), más [Volumetric Lighting](/blog/volume-lighting), [WebGPU Custom Fog Scattering](/blog/webgpu-custom-fog-scattering), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$WebGPU Spotlight — haces texturizados y sombras — IOM$iom$,
  $iom$Un spot light que se comporta como un foco teatral — textura proyectada en el cono, penumbra suave, decay y sombras enfocadas — en Three.js WebGPU con el clásico escaneo Lucy como $iom$
from public.blog_posts p
where p.slug = $iom$webgpu-spotlight$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$WebGPU Compute Birds — GPU flocking$iom$,
  $iom$Eight thousand birds flocking in the browser — separation, alignment, and cohesion computed on the GPU. Move the mouse to disturb the flock; tune behavior live.$iom$,
  $iom$Eight thousand birds flocking in the browser — separation, alignment, and cohesion computed on the GPU. Move the mouse to disturb the flock; tune behavior live.

It lives in our [Experiments section](/#experiments) as **WebGPU Compute Birds**. The cover shows the instanced flock as a coherent murmuration.

## Open the live demo

**[→ Launch WebGPU Compute Birds](/demos/webgpu-compute-birds/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Also in the 360° guided tour

In the [360° Panorama Tour](/demos/panorama-360/), **Step 4** is authored as `cam · +birds · hotspot+popup`: the camera tips toward the sky, the WebGPU birds layer brings the atmosphere to life, and a hotspot/popup keeps the story clickable.

Standalone flocking proves the tech; the tour proves the **product pattern** — living GPU layers timed to a guided stop so guests feel motion *and* can still drag to look and tap to learn. Earlier beats use [WebGPU Particles](/blog/webgpu-particles) (Step 2) and [Spout](/blog/spout) (Step 3) the same way.

![Guided tour Step 4 — birds layer + hotspot popup on The Black Witness](/assets/blog/webgpu-compute-birds/tour-bridge.jpg?v=20260722a)

**[→ Open Panorama 360](https://iobjectm.com/demos/panorama-360/)** — **Play guided tour**, Step 4 ([visitor preview](https://iobjectm.com/demos/panorama-360/?mode=preview)).

## Why this matters (even if you are not a developer)

- **Classic boids, modern GPU** — Reynolds-style rules at interactive scale
- **Instancing** — one mesh, thousands of birds
- **Pointer disturbance** — stakeholders feel agency in seconds
- **WebGPU compute** — simulation stays off the CPU main thread

Typical uses: nature-inspired brand moments, science explainer UIs, and stress tests for GPU compute pipelines.

## For beginners — what is this, in plain words?

Birds in a flock follow simple rules: don’t crash, match neighbors, stay with the group. Multiply that by thousands and you get a murmuration. Here those rules run on the graphics card so the motion stays fluid.

**Quick glossary**

- **Boids** — classic flocking model: separation, alignment, cohesion
- **Instancing** — drawing many copies of one mesh efficiently
- **Compute** — GPU work that updates bird positions/velocities each frame
- **WebGPU** — API used here instead of older WebGL-only GPGPU tricks

## Try this in about 60 seconds

1. Open the [WebGPU Compute Birds demo](/demos/webgpu-compute-birds/)
2. Watch the flock settle into coherent motion
3. Move the mouse through the flock to disturb it
4. Open Birds settings and tweak separation / alignment / cohesion

## Requirements and performance

- **Browser:** WebGPU-capable Chrome or Edge recommended
- **GPU:** mid-range or better for 8k instances at smooth frame rates
- **Not WebGL:** the compute flocking path targets WebGPU

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Wide murmuration — flock reading as one volume](/assets/blog/webgpu-compute-birds/view-a.jpg?v=20260722a)

![Closer pass — instanced birds and direction of flight](/assets/blog/webgpu-compute-birds/view-b.jpg?v=20260722a)

Also in this build:

- Retune forces for calmer vs chaotic brand moods
- Use as a background layer behind UI (with care for contrast)
- Layer the flock into a [360° guided tour](/demos/panorama-360/) sky beat (Step 4)
- Compare [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) on threejs.org

## How it works

Each frame a WebGPU compute pass applies flocking forces and writes new transforms; instanced drawing renders the birds. Upstream: [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_birds.html)). Older WebGL “GPGPU birds” examples exist in three.js history; this IOM page follows the WebGPU compute edition.

## FAQ

**Why so many birds?**  
Scale is the point — compute + instancing show what WebGPU can sustain interactively.

**Can birds follow a path or logo?**  
Guiding fields and attractors are common extensions for client stories.

**Where do the birds appear in the 360 tour?**  
Guided-tour Step 4 on The Black Witness — birds layer with a hotspot popup. Open /demos/panorama-360/ and Play guided tour.

## Tech stack and further reading

- [three.js — compute birds](https://threejs.org/examples/#webgpu_compute_birds)
- [360° Panorama Tour Editor](/demos/panorama-360/)
- [Boids — Wikipedia](https://en.wikipedia.org/wiki/Boids)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Related on IOM

Browse more in [Experiments](/#experiments), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [WebGPU Particles](/blog/webgpu-particles), [Spout](/blog/spout), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$WebGPU Compute Birds — GPU flocking — IOM$iom$,
  $iom$Eight thousand birds flocking in the browser — separation, alignment, and cohesion computed on the GPU. Move the mouse to disturb the flock; tune behavior live.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-compute-birds$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$WebGPU Compute Birds — GPU Flocking$iom$,
  $iom$Achttausend Vögel flocken im Browser — Separation, Alignment und Cohesion auf der GPU berechnet. Bewegen Sie die Maus, um die Schar zu stören; Verhalten live tunen.$iom$,
  $iom$Achttausend Vögel flocken im Browser — Separation, Alignment und Cohesion auf der GPU berechnet. Bewegen Sie die Maus, um die Schar zu stören; Verhalten live tunen.

Es liegt in unserem [Experimente-Bereich](/#experiments) als **WebGPU Compute Birds**. Das Cover zeigt die instanzierte Schar als kohärente Murmuration.

## Live-Demo öffnen

**[→ WebGPU Compute Birds starten](/demos/webgpu-compute-birds/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Auch in der 360°-Guided-Tour

In der [360° Panorama Tour](/demos/panorama-360/) ist **Schritt 4** als `cam · +birds · hotspot+popup` authored: die Kamera kippt zum Himmel, der WebGPU Birds-Layer bringt die Atmosphäre zum Leben, und ein Hotspot/Popup hält die Story klickbar.

Standalone Flocking beweist die Tech; die Tour beweist das **Produktmuster** — lebendige GPU-Layer, getimed zu einem geführten Stopp, damit Gäste Bewegung *und* trotzdem Ziehen zum Umsehen und Tippen zum Lernen spüren. Frühere Beats nutzen [WebGPU Particles](/blog/webgpu-particles) (Schritt 2) und [Spout](/blog/spout) (Schritt 3) auf dieselbe Weise.

![Geführte Tour Schritt 4 — Birds-Layer + Hotspot-Popup bei The Black Witness](/assets/blog/webgpu-compute-birds/tour-bridge.jpg?v=20260722a)

**[→ Panorama 360 öffnen](https://iobjectm.com/demos/panorama-360/)** — **Guided Tour abspielen**, Step 4 ([Besucher-Vorschau](https://iobjectm.com/demos/panorama-360/?mode=preview)).

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Klassische Boids, moderne GPU** — Reynolds-Regeln in interaktivem Maßstab
- **Instancing** — ein Mesh, tausende Vögel
- **Pointer-Störung** — Stakeholder spüren Agency in Sekunden
- **WebGPU Compute** — Simulation bleibt vom CPU Main Thread weg

Typische Einsätze: naturinspirierte Markenmomente, Wissenschafts-Explainer-UIs und Stress-Tests für GPU-Compute-Pipelines.

## Für Einsteiger — was ist das, in einfachen Worten?

Vögel in einer Schar folgen einfachen Regeln: nicht crashen, Nachbarn angleichen, bei der Gruppe bleiben. Multiplizieren Sie das mit Tausenden und Sie bekommen eine Murmuration. Hier laufen diese Regeln auf der Grafikkarte, damit die Bewegung flüssig bleibt.

**Kurzes Glossar**

- **Boids** — klassisches Flocking-Modell: Separation, Alignment, Cohesion
- **Instancing** — viele Kopien eines Meshes effizient zeichnen
- **Compute** — GPU-Arbeit, die Vogelpositionen/Geschwindigkeiten pro Frame aktualisiert
- **WebGPU** — API hier statt älterer WebGL-only GPGPU-Tricks

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [WebGPU Compute Birds Demo](/demos/webgpu-compute-birds/)
2. Beobachten Sie, wie die Schar in kohärente Bewegung übergeht
3. Bewegen Sie die Maus durch die Schar, um sie zu stören
4. Öffnen Sie Birds settings und tunen Sie Separation / Alignment / Cohesion

## Anforderungen und Performance

- **Browser:** WebGPU-fähiger Chrome oder Edge empfohlen
- **GPU:** Mittelklasse oder besser für 8k Instanzen bei flüssigen Frame Rates
- **Not WebGL:** der Compute-Flocking-Pfad zielt auf WebGPU

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Weite Murmuration — Schar liest sich als ein Volumen](/assets/blog/webgpu-compute-birds/view-a.jpg?v=20260722a)

![Näherer Pass — instanzierte Vögel und Flugrichtung](/assets/blog/webgpu-compute-birds/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Kräfte für ruhigere vs. chaotische Markenstimmungen retunen
- Als Hintergrund-Layer hinter UI nutzen (Kontrast beachten)
- Die Schar in einen [360° guided tour](/demos/panorama-360/) Himmel-Beat legen (Schritt 4)
- Mit [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) auf threejs.org vergleichen

## So funktioniert es

Pro Frame wendet ein WebGPU-Compute-Pass Flocking-Kräfte an und schreibt neue Transforms; instanced drawing rendert die Vögel. Upstream: [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_birds.html)). Ältere WebGL-„GPGPU birds“-Beispiele existieren in three.js History; diese IOM-Seite folgt der WebGPU-Compute-Edition.

## FAQ

**Warum so viele Vögel?**  
Skala ist der Punkt — Compute + Instancing zeigen, was WebGPU interaktiv tragen kann.

**Können Vögel einem Pfad oder Logo folgen?**  
Guiding Fields und Attractors sind gängige Erweiterungen für Kundenstories.

**Wo erscheinen die Vögel in der 360° Tour?**  
Geführter Tour-Schritt 4 bei The Black Witness — Birds-Layer mit Hotspot-Popup. Öffnen Sie /demos/panorama-360/ und Play guided tour.

## Tech-Stack und weiterführende Links

- [three.js — compute birds](https://threejs.org/examples/#webgpu_compute_birds)
- [360° Panorama Tour Editor](/demos/panorama-360/)
- [Boids — Wikipedia](https://en.wikipedia.org/wiki/Boids)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Verwandt bei IOM

Mehr in [Experimente](/#experiments), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [WebGPU Particles](/blog/webgpu-particles), [Spout](/blog/spout), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$WebGPU Compute Birds — GPU Flocking — IOM$iom$,
  $iom$Achttausend Vögel flocken im Browser — Separation, Alignment und Cohesion auf der GPU berechnet. Bewegen Sie die Maus, um die Schar zu stören; Verhalten live tunen.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-compute-birds$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$WebGPU Compute Birds — flocking GPU$iom$,
  $iom$Huit mille oiseaux en vol en essaim dans le navigateur — separation, alignment et cohesion calculés sur GPU. Bougez la souris pour perturber la volée ; ajustez le comportement en l$iom$,
  $iom$Huit mille oiseaux en vol en essaim dans le navigateur — separation, alignment et cohesion calculés sur GPU. Bougez la souris pour perturber la volée ; ajustez le comportement en live.

Il se trouve dans notre [section Expériences](/#experiments) sous **WebGPU Compute Birds**. La couverture montre la volée instanciée comme murmuration cohérente.

## Ouvrir la démo en direct

**[→ Lancer WebGPU Compute Birds](/demos/webgpu-compute-birds/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Aussi dans la visite guidée 360°

Dans la [360° Panorama Tour](/demos/panorama-360/), **l'Étape 4** est authorée comme `cam · +birds · hotspot+popup` : la caméra bascule vers le ciel, la couche WebGPU birds donne vie à l'atmosphère, et un hotspot/popup garde l'histoire cliquable.

Le flocking standalone prouve la tech ; la tour prouve le **pattern produit** — couches GPU vivantes calées sur un arrêt guidé pour que les invités ressentent le mouvement *et* puissent toujours glisser pour regarder et toucher pour apprendre. Les beats précédents utilisent [WebGPU Particles](/blog/webgpu-particles) (Étape 2) et [Spout](/blog/spout) (Étape 3) de la même façon.

![Visite guidée Étape 4 — couche birds + popup hotspot sur The Black Witness](/assets/blog/webgpu-compute-birds/tour-bridge.jpg?v=20260722a)

**[→ Ouvrir Panorama 360](https://iobjectm.com/demos/panorama-360/)** — **Lancer la visite guidée**, Step 4 ([aperçu visiteur](https://iobjectm.com/demos/panorama-360/?mode=preview)).

## Pourquoi c’est important (même sans être développeur)

- **Boids classiques, GPU moderne** — règles style Reynolds à échelle interactive
- **Instancing** — un mesh, des milliers d'oiseaux
- **Perturbation pointeur** — les parties prenantes ressentent l'agency en secondes
- **WebGPU compute** — simulation hors thread principal CPU

Usages typiques : moments marque inspirés nature, UI explicatives science et stress tests pour pipelines compute GPU.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Les oiseaux en volée suivent des règles simples : ne pas s'écraser, aligner les voisins, rester avec le groupe. Multipliez par des milliers et vous obtenez une murmuration. Ici ces règles tournent sur la carte graphique pour que le mouvement reste fluide.

**Glossaire rapide**

- **Boids** — modèle flocking classique : separation, alignment, cohesion
- **Instancing** — dessiner efficacement de nombreuses copies d'un mesh
- **Compute** — travail GPU qui met à jour positions/vitesses oiseaux chaque frame
- **WebGPU** — API utilisée ici au lieu des anciens tricks GPGPU WebGL-only

## Essayez en environ 60 secondes

1. Ouvrir la [démo WebGPU Compute Birds](/demos/webgpu-compute-birds/)
2. Observer la volée se stabiliser en mouvement cohérent
3. Passer la souris dans la volée pour la perturber
4. Ouvrir Birds settings et ajuster separation / alignment / cohesion

## Prérequis et performances

- **Navigateur :** Chrome ou Edge WebGPU-capable recommandé
- **GPU :** milieu de gamme ou mieux pour 8k instances à frame rates fluides
- **Not WebGL :** la voie flocking compute cible WebGPU

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Large murmuration — volée lisible comme un volume](/assets/blog/webgpu-compute-birds/view-a.jpg?v=20260722a)

![Passage plus proche — oiseaux instanciés et direction de vol](/assets/blog/webgpu-compute-birds/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Retuner les forces pour humeurs marque plus calmes vs chaotiques
- Utiliser comme couche de fond derrière UI (attention au contraste)
- Superposer la volée dans un beat ciel de [360° guided tour](/demos/panorama-360/) (Étape 4)
- Comparer [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) sur threejs.org

## Comment ça marche

Chaque frame un pass compute WebGPU applique les forces flocking et écrit de nouveaux transforms ; le dessin instancié rend les oiseaux. Upstream : [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_birds.html)). D'anciens exemples WebGL « GPGPU birds » existent dans l'histoire three.js ; cette page IOM suit l'édition compute WebGPU.

## FAQ

**Pourquoi autant d'oiseaux ?**  
L'échelle est le point — compute + instancing montrent ce que WebGPU peut soutenir interactivement.

**Les oiseaux peuvent-ils suivre un chemin ou logo ?**  
Champs guides et attracteurs sont des extensions courantes pour histoires client.

**Où apparaissent les oiseaux dans la tour 360 ?**  
Étape 4 visite guidée sur The Black Witness — couche birds avec popup hotspot. Ouvrir /demos/panorama-360/ et Play guided tour.

## Stack technique et lectures

- [three.js — compute birds](https://threejs.org/examples/#webgpu_compute_birds)
- [360° Panorama Tour Editor](/demos/panorama-360/)
- [Boids — Wikipedia](https://en.wikipedia.org/wiki/Boids)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Sur IOM

Parcourez [Expériences](/#experiments), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [WebGPU Particles](/blog/webgpu-particles), [Spout](/blog/spout), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$WebGPU Compute Birds — flocking GPU — IOM$iom$,
  $iom$Huit mille oiseaux en vol en essaim dans le navigateur — separation, alignment et cohesion calculés sur GPU. Bougez la souris pour perturber la volée ; ajustez le comportement en l$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-compute-birds$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$WebGPU Compute Birds — GPU flocking$iom$,
  $iom$Achtduizend vogels zwermen in de browser — separation, alignment en cohesion berekend op GPU. Beweeg de muis om de zwerm te verstoren; tune gedrag live.$iom$,
  $iom$Achtduizend vogels zwermen in de browser — separation, alignment en cohesion berekend op GPU. Beweeg de muis om de zwerm te verstoren; tune gedrag live.

Het staat in onze [Experimenten-sectie](/#experiments) als **WebGPU Compute Birds**. De cover toont de geïnstancieerde zwerm als coherente murmuration.

## Open de live demo

**[→ Start WebGPU Compute Birds](/demos/webgpu-compute-birds/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Ook in de 360° guided tour

In de [360° Panorama Tour](/demos/panorama-360/) is **Stap 4** geauthoriseerd als `cam · +birds · hotspot+popup`: de camera kantelt naar de lucht, de WebGPU birds-laag brengt de sfeer tot leven, en een hotspot/popup houdt het verhaal klikbaar.

Standalone flocking bewijst de tech; de tour bewijst het **productpatroon** — levende GPU-lagen getimed op een begeleide stop zodat gasten beweging *en* nog steeds kunnen slepen om te kijken en tikken om te leren. Eerdere beats gebruiken [WebGPU Particles](/blog/webgpu-particles) (Stap 2) en [Spout](/blog/spout) (Stap 3) op dezelfde manier.

![Begeleide tour Stap 4 — birds-laag + hotspot-popup op The Black Witness](/assets/blog/webgpu-compute-birds/tour-bridge.jpg?v=20260722a)

**[→ Open Panorama 360](https://iobjectm.com/demos/panorama-360/)** — **Speel guided tour**, Step 4 ([bezoekersvoorbeeld](https://iobjectm.com/demos/panorama-360/?mode=preview)).

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Klassieke Boids, moderne GPU** — Reynolds-regels op interactieve schaal
- **Instancing** — één mesh, duizenden vogels
- **Pointer-verstoring** — stakeholders voelen agency in seconden
- **WebGPU compute** — simulatie blijft van CPU main thread af

Typische toepassingen: natuur-geïnspireerde merkmomenten, wetenschap-uitleg-UI's en stresstests voor GPU compute-pipelines.

## Voor beginners — wat is dit, in gewone taal?

Vogels in een zwerm volgen simpele regels: niet crashen, buren matchen, bij de groep blijven. Vermenigvuldig dat met duizenden en u krijgt een murmuration. Hier draaien die regels op de grafische kaart zodat de beweging vloeiend blijft.

**Korte glossary**

- **Boids** — klassiek flocking-model: separation, alignment, cohesion
- **Instancing** — veel kopieën van één mesh efficiënt tekenen
- **Compute** — GPU-werk dat vogelposities/snelheden per frame bijwerkt
- **WebGPU** — API hier gebruikt in plaats van oudere WebGL-only GPGPU-trucs

## Probeer dit in ongeveer 60 seconden

1. Open de [WebGPU Compute Birds demo](/demos/webgpu-compute-birds/)
2. Kijk hoe de zwerm in coherente beweging komt
3. Beweeg de muis door de zwerm om te verstoren
4. Open Birds settings en tweak separation / alignment / cohesion

## Vereisten en performance

- **Browser:** WebGPU-capabele Chrome of Edge aanbevolen
- **GPU:** middenklasse of beter voor 8k instances bij vloeiende frame rates
- **Not WebGL:** het compute flocking-pad richt zich op WebGPU

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Brede murmuration — zwerm leest als één volume](/assets/blog/webgpu-compute-birds/view-a.jpg?v=20260722a)

![Nader pass — geïnstancieerde vogels en vluchtrichting](/assets/blog/webgpu-compute-birds/view-b.jpg?v=20260722a)

Ook in deze build:

- Krachten retunen voor rustigere vs. chaotische merksferen
- Gebruiken als achtergrondlaag achter UI (let op contrast)
- De zwerm in een [360° guided tour](/demos/panorama-360/) lucht-beat leggen (Stap 4)
- Vergelijken met [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) op threejs.org

## Hoe het werkt

Elke frame past een WebGPU compute pass flocking-krachten toe en schrijft nieuwe transforms; instanced drawing rendert de vogels. Upstream: [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_birds.html)). Oudere WebGL „GPGPU birds“-voorbeelden bestaan in three.js-geschiedenis; deze IOM-pagina volgt de WebGPU compute-editie.

## FAQ

**Waarom zoveel vogels?**  
Schaal is het punt — compute + instancing tonen wat WebGPU interactief kan dragen.

**Kunnen vogels een pad of logo volgen?**  
Guiding fields en attractors zijn gangbare uitbreidingen voor klantverhalen.

**Waar verschijnen de vogels in de 360-tour?**  
Begeleide tour Stap 4 op The Black Witness — birds-laag met hotspot-popup. Open /demos/panorama-360/ en Play guided tour.

## Tech stack en verder lezen

- [three.js — compute birds](https://threejs.org/examples/#webgpu_compute_birds)
- [360° Panorama Tour Editor](/demos/panorama-360/)
- [Boids — Wikipedia](https://en.wikipedia.org/wiki/Boids)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Gerelateerd op IOM

Bekijk meer in [Experimenten](/#experiments), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [WebGPU Particles](/blog/webgpu-particles), [Spout](/blog/spout), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$WebGPU Compute Birds — GPU flocking — IOM$iom$,
  $iom$Achtduizend vogels zwermen in de browser — separation, alignment en cohesion berekend op GPU. Beweeg de muis om de zwerm te verstoren; tune gedrag live.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-compute-birds$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$WebGPU Compute Birds — flocking GPU$iom$,
  $iom$Ottomila uccelli in stormo nel browser — separation, alignment e cohesion calcolati su GPU. Muovete il mouse per disturbare lo stormo; regolate il comportamento live.$iom$,
  $iom$Ottomila uccelli in stormo nel browser — separation, alignment e cohesion calcolati su GPU. Muovete il mouse per disturbare lo stormo; regolate il comportamento live.

Si trova nella nostra [sezione Esperimenti](/#experiments) come **WebGPU Compute Birds**. La copertina mostra lo stormo instanziato come murmuration coerente.

## Apri la demo live

**[→ Avvia WebGPU Compute Birds](/demos/webgpu-compute-birds/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Anche nel tour guidato 360°

Nella [360° Panorama Tour](/demos/panorama-360/), **Passo 4** è authorato come `cam · +birds · hotspot+popup`: la camera inclina verso il cielo, il layer WebGPU birds dà vita all'atmosfera, e un hotspot/popup mantiene la storia cliccabile.

Il flocking standalone prova la tech; il tour prova il **pattern prodotto** — layer GPU viventi sincronizzati a una fermata guidata così gli ospiti sentono movimento *e* possono ancora trascinare per guardare e toccare per imparare. I beat precedenti usano [WebGPU Particles](/blog/webgpu-particles) (Passo 2) e [Spout](/blog/spout) (Passo 3) allo stesso modo.

![Tour guidato Passo 4 — layer birds + popup hotspot su The Black Witness](/assets/blog/webgpu-compute-birds/tour-bridge.jpg?v=20260722a)

**[→ Apri Panorama 360](https://iobjectm.com/demos/panorama-360/)** — **Avvia tour guidato**, Step 4 ([anteprima visitatore](https://iobjectm.com/demos/panorama-360/?mode=preview)).

## Perché conta (anche se non sei uno sviluppatore)

- **Boids classici, GPU moderna** — regole stile Reynolds a scala interattiva
- **Instancing** — un mesh, migliaia di uccelli
- **Disturbo puntatore** — gli stakeholder sentono agency in secondi
- **WebGPU compute** — simulazione fuori dal main thread CPU

Usi tipici: momenti brand ispirati alla natura, UI esplicative scientifiche e stress test per pipeline compute GPU.

## Per principianti — cos’è, in parole semplici?

Gli uccelli in stormo seguono regole semplici: non scontrarsi, allinearsi ai vicini, restare con il gruppo. Moltiplicate per migliaia e ottenete una murmuration. Qui quelle regole girano sulla scheda grafica così il movimento resta fluido.

**Glossario rapido**

- **Boids** — modello flocking classico: separation, alignment, cohesion
- **Instancing** — disegnare efficientemente molte copie di un mesh
- **Compute** — lavoro GPU che aggiorna posizioni/velocità uccelli ogni frame
- **WebGPU** — API usata qui invece dei vecchi trucchi GPGPU solo WebGL

## Provalo in circa 60 secondi

1. Aprire la [demo WebGPU Compute Birds](/demos/webgpu-compute-birds/)
2. Osservare lo stormo stabilizzarsi in movimento coerente
3. Muovere il mouse attraverso lo stormo per disturbarlo
4. Aprire Birds settings e regolare separation / alignment / cohesion

## Requisiti e prestazioni

- **Browser:** Chrome o Edge WebGPU-capable consigliato
- **GPU:** mid-range o superiore per 8k istanze a frame rate fluidi
- **Not WebGL:** il percorso flocking compute punta a WebGPU

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Murmuration ampia — stormo che legge come un volume](/assets/blog/webgpu-compute-birds/view-a.jpg?v=20260722a)

![Passaggio più vicino — uccelli instanziati e direzione di volo](/assets/blog/webgpu-compute-birds/view-b.jpg?v=20260722a)

Anche in questa build:

- Ritunare le forze per mood brand più calmi vs caotici
- Usare come layer di sfondo dietro UI (attenzione al contrasto)
- Integrare lo stormo in un beat cielo di [360° guided tour](/demos/panorama-360/) (Passo 4)
- Confrontare [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) su threejs.org

## Come funziona

Ogni frame un pass compute WebGPU applica forze flocking e scrive nuovi transform; il disegno instanziato renderizza gli uccelli. Upstream: [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_birds.html)). Esistono esempi WebGL „GPGPU birds“ più vecchi nella storia three.js; questa pagina IOM segue l'edizione compute WebGPU.

## FAQ

**Perché così tanti uccelli?**  
La scala è il punto — compute + instancing mostrano cosa WebGPU può sostenere interattivamente.

**Gli uccelli possono seguire un percorso o logo?**  
Campi guida e attractor sono estensioni comuni per storie client.

**Dove compaiono gli uccelli nel tour 360?**  
Passo 4 tour guidato su The Black Witness — layer birds con popup hotspot. Aprire /demos/panorama-360/ e Play guided tour.

## Stack tecnico e letture

- [three.js — compute birds](https://threejs.org/examples/#webgpu_compute_birds)
- [360° Panorama Tour Editor](/demos/panorama-360/)
- [Boids — Wikipedia](https://en.wikipedia.org/wiki/Boids)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Correlati su IOM

Esplora di più in [Esperimenti](/#experiments), più [360° Panorama Tour Editor](/blog/panorama-360-tour), [WebGPU Particles](/blog/webgpu-particles), [Spout](/blog/spout), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$WebGPU Compute Birds — flocking GPU — IOM$iom$,
  $iom$Ottomila uccelli in stormo nel browser — separation, alignment e cohesion calcolati su GPU. Muovete il mouse per disturbare lo stormo; regolate il comportamento live.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-compute-birds$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$WebGPU Compute Birds — flocking GPU$iom$,
  $iom$Ocho mil aves en bandada en el navegador — separation, alignment y cohesion calculados en GPU. Mueva el ratón para perturbar la bandada; ajuste el comportamiento en vivo.$iom$,
  $iom$Ocho mil aves en bandada en el navegador — separation, alignment y cohesion calculados en GPU. Mueva el ratón para perturbar la bandada; ajuste el comportamiento en vivo.

Está en nuestra [sección Experimentos](/#experiments) como **WebGPU Compute Birds**. La portada muestra la bandada instanciada como murmuration coherente.

## Abrir la demo en vivo

**[→ Lanzar WebGPU Compute Birds](/demos/webgpu-compute-birds/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## También en el tour guiado 360°

En la [360° Panorama Tour](/demos/panorama-360/), **Paso 4** está authorado como `cam · +birds · hotspot+popup`: la cámara inclina hacia el cielo, la capa WebGPU birds da vida a la atmósfera, y un hotspot/popup mantiene la historia clicable.

El flocking standalone prueba la tech; el tour prueba el **patrón producto** — capas GPU vivas sincronizadas a una parada guiada para que los invitados sientan movimiento *y* aún puedan arrastrar para mirar y tocar para aprender. Los beats anteriores usan [WebGPU Particles](/blog/webgpu-particles) (Paso 2) y [Spout](/blog/spout) (Paso 3) de la misma forma.

![Tour guiado Paso 4 — capa birds + popup hotspot en The Black Witness](/assets/blog/webgpu-compute-birds/tour-bridge.jpg?v=20260722a)

**[→ Abrir Panorama 360](https://iobjectm.com/demos/panorama-360/)** — **Reproducir tour guiado**, Step 4 ([vista previa de visitante](https://iobjectm.com/demos/panorama-360/?mode=preview)).

## Por qué importa (aunque no seas desarrollador)

- **Boids clásicos, GPU moderna** — reglas estilo Reynolds a escala interactiva
- **Instancing** — un mesh, miles de aves
- **Perturbación por puntero** — stakeholders sienten agency en segundos
- **WebGPU compute** — simulación fuera del main thread CPU

Usos típicos: momentos de marca inspirados en la naturaleza, UI explicativas científicas y stress tests para pipelines compute GPU.

## Para principiantes — ¿qué es esto, en palabras simples?

Las aves en bandada siguen reglas simples: no chocar, igualar vecinos, quedarse con el grupo. Multiplique por miles y obtiene una murmuration. Aquí esas reglas corren en la tarjeta gráfica para que el movimiento siga fluido.

**Glosario rápido**

- **Boids** — modelo flocking clásico: separation, alignment, cohesion
- **Instancing** — dibujar eficientemente muchas copias de un mesh
- **Compute** — trabajo GPU que actualiza posiciones/velocidades de aves cada frame
- **WebGPU** — API usada aquí en lugar de trucos GPGPU solo WebGL más antiguos

## Pruébalo en unos 60 segundos

1. Abrir la [demo WebGPU Compute Birds](/demos/webgpu-compute-birds/)
2. Ver la bandada estabilizarse en movimiento coherente
3. Mover el ratón por la bandada para perturbarla
4. Abrir Birds settings y ajustar separation / alignment / cohesion

## Requisitos y rendimiento

- **Navegador:** Chrome o Edge WebGPU-capable recomendado
- **GPU:** gama media o superior para 8k instancias a frame rates fluidos
- **Not WebGL:** la ruta flocking compute apunta a WebGPU

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Murmuration amplia — bandada leyéndose como un volumen](/assets/blog/webgpu-compute-birds/view-a.jpg?v=20260722a)

![Pase más cercano — aves instanciadas y dirección de vuelo](/assets/blog/webgpu-compute-birds/view-b.jpg?v=20260722a)

También en este build:

- Retunear fuerzas para moods de marca más calmados vs caóticos
- Usar como capa de fondo detrás de UI (cuidado con el contraste)
- Integrar la bandada en un beat cielo de [360° guided tour](/demos/panorama-360/) (Paso 4)
- Comparar [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) en threejs.org

## Cómo funciona

Cada frame un pass compute WebGPU aplica fuerzas flocking y escribe nuevos transforms; el dibujo instanciado renderiza las aves. Upstream: [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_birds.html)). Existen ejemplos WebGL „GPGPU birds“ más antiguos en la historia de three.js; esta página IOM sigue la edición compute WebGPU.

## FAQ

**¿Por qué tantas aves?**  
La escala es el punto — compute + instancing muestran qué puede sostener WebGPU de forma interactiva.

**¿Pueden las aves seguir un camino o logo?**  
Campos guía y attractors son extensiones comunes para historias cliente.

**¿Dónde aparecen las aves en el tour 360?**  
Paso 4 tour guiado en The Black Witness — capa birds con popup hotspot. Abrir /demos/panorama-360/ y Play guided tour.

## Stack técnico y lecturas

- [three.js — compute birds](https://threejs.org/examples/#webgpu_compute_birds)
- [360° Panorama Tour Editor](/demos/panorama-360/)
- [Boids — Wikipedia](https://en.wikipedia.org/wiki/Boids)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Relacionado en IOM

Explora más en [Experimentos](/#experiments), más [360° Panorama Tour Editor](/blog/panorama-360-tour), [WebGPU Particles](/blog/webgpu-particles), [Spout](/blog/spout), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$WebGPU Compute Birds — flocking GPU — IOM$iom$,
  $iom$Ocho mil aves en bandada en el navegador — separation, alignment y cohesion calculados en GPU. Mueva el ratón para perturbar la bandada; ajuste el comportamiento en vivo.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-compute-birds$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$WebGPU Parallax UV — depth in a flat texture$iom$,
  $iom$Ice that feels thicker than a flat plane — TSL parallax UV offsets layered ambientCG maps with displacement, normals, and roughness under HDR light.$iom$,
  $iom$Ice that feels thicker than a flat plane — TSL parallax UV offsets layered ambientCG maps with displacement, normals, and roughness under HDR light.

It lives in our [Experiments section](/#experiments) as **WebGPU Parallax UV**. The cover shows the ice ground with parallax depth as the camera grazes the surface.

## Open the live demo

**[→ Launch WebGPU Parallax UV](/demos/webgpu-parallax-uv/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Fake thickness, real savings** — depth cue without a heavy sculpted mesh
- **TSL materials** — modern Three.js node materials on WebGPU
- **PBR stack** — albedo, normal, roughness, displacement working together
- **HDR environment** — reflections that sell frozen material

Typical uses: material studies, ground planes for product shots, and “does this shader read?” reviews.

## For beginners — what is this, in plain words?

A normal photo of ice is flat. Parallax UV tricks the eye: as you move the camera, the texture shifts a little as if there were depth under the surface — like looking into clear ice without modeling every crack.

**Quick glossary**

- **Parallax mapping** — UV offset based on view angle and a height/displacement map
- **TSL** — Three.js Shading Language for node-based GPU materials
- **PBR** — physically based rendering — roughness/metalness-style material model
- **HDR environment** — high-dynamic-range image lighting the scene reflections

## Try this in about 60 seconds

1. Open the [WebGPU Parallax UV demo](/demos/webgpu-parallax-uv/)
2. Orbit low across the ice — watch depth shift with angle
3. Compare grazing vs top-down views
4. Note how normals and roughness change the freeze look under HDR

## Requirements and performance

- **Browser:** WebGPU (Chrome/Edge recommended)
- **Textures:** ambientCG-style maps are bundled; network helps first load
- **GPU:** light-to-moderate — heavier than a flat unlit plane, lighter than full compute flocks

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Grazing angle — parallax depth in the ice plane](/assets/blog/webgpu-parallax-uv/view-a.jpg?v=20260722a)

![Higher view — layered maps and HDR reflection read](/assets/blog/webgpu-parallax-uv/view-b.jpg?v=20260722a)

Also in this build:

- Retarget maps to stone, wood, or branded materials
- Use as a ground under a product GLB
- Study [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv)

## How it works

A TSL material samples height/displacement to offset UVs by view direction (parallax), then layers color, normal, and roughness. WebGPURenderer runs the node graph. Upstream: [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_parallax_uv.html)). Classic WebGL parallax shaders exist; this demo is on the WebGPU + TSL path.

## FAQ

**Is the ice a real 3D volume?**  
No — it is a shaded plane. Parallax fakes depth in the material.

**Can we use our own texture set?**  
Yes. Matching map naming and strength is a standard material swap.

## Tech stack and further reading

- [three.js — parallax UV](https://threejs.org/examples/#webgpu_parallax_uv)
- [ambientCG](https://ambientcg.com/)
- [Three.js](https://threejs.org/)

## Related on IOM

Browse more in [Experiments](/#experiments), plus [WebGPU TSL Raging Sea](/blog/webgpu-tsl-raging-sea), [WebGPU Custom Fog Scattering](/blog/webgpu-custom-fog-scattering), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$WebGPU Parallax UV — depth in a flat texture — IOM$iom$,
  $iom$Ice that feels thicker than a flat plane — TSL parallax UV offsets layered ambientCG maps with displacement, normals, and roughness under HDR light.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-parallax-uv$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$WebGPU Parallax UV — Tiefe in einer flachen Textur$iom$,
  $iom$Eis, das dicker wirkt als eine flache Ebene — TSL-Parallax-UV verschiebt geschichtete ambientCG-Maps mit Displacement, Normalen und Rauheit unter HDR-Licht.$iom$,
  $iom$Eis, das dicker wirkt als eine flache Ebene — TSL-Parallax-UV verschiebt geschichtete ambientCG-Maps mit Displacement, Normalen und Rauheit unter HDR-Licht.

Es liegt in unserem [Experimente-Bereich](/#experiments) als **WebGPU Parallax UV**. Das Cover zeigt den Eisboden mit Parallax-Tiefe, wenn die Kamera die Oberfläche streift.

## Live-Demo öffnen

**[→ WebGPU Parallax UV starten](/demos/webgpu-parallax-uv/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Scheinbare Tiefe, echte Einsparungen** — Tiefenwirkung ohne schweres skulptiertes Mesh
- **TSL-Materialien** — moderne Three.js-Node-Materialien auf WebGPU
- **PBR-Stack** — Albedo, Normal, Rauheit und Displacement im Zusammenspiel
- **HDR-Umgebung** — Reflexionen, die gefrorenes Material glaubwürdig machen

Typische Einsätze: Materialstudien, Bodenebenen für Produktaufnahmen und „Liest sich dieser Shader?“-Reviews.

## Für Einsteiger — was ist das, in einfachen Worten?

Ein normales Eisfoto ist flach. Parallax UV täuscht das Auge: Wenn Sie die Kamera bewegen, verschiebt sich die Textur leicht, als läge Tiefe unter der Oberfläche — wie ein Blick in klares Eis, ohne jede Risslinie zu modellieren.

**Kurzes Glossar**

- **Parallax mapping** — UV-Versatz basierend auf Blickwinkel und einer Höhen-/Displacement-Map
- **TSL** — Three.js Shading Language für node-basierte GPU-Materialien
- **PBR** — physically based rendering — Rauheit/Metalness-Materialmodell
- **HDR environment** — High-Dynamic-Range-Bild, das die Szenenreflexionen beleuchtet

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [WebGPU Parallax UV Demo](/demos/webgpu-parallax-uv/)
2. Orbitieren Sie flach über das Eis — beobachten Sie die Tiefenverschiebung mit dem Winkel
3. Vergleichen Sie Streif- mit Draufsicht
4. Beachten Sie, wie Normalen und Rauheit den Gefrierlook unter HDR verändern

## Anforderungen und Performance

- **Browser:** WebGPU (Chrome/Edge empfohlen)
- **Texturen:** ambientCG-Maps sind enthalten; Netzwerk hilft beim ersten Laden
- **GPU:** leicht bis moderat — schwerer als eine flache unbeleuchtete Ebene, leichter als vollständige Compute-Schwärme

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Streifwinkel — Parallax-Tiefe in der Eisebene](/assets/blog/webgpu-parallax-uv/view-a.jpg?v=20260722a)

![Höhere Sicht — geschichtete Maps und HDR-Reflexion lesbar](/assets/blog/webgpu-parallax-uv/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Maps auf Stein, Holz oder Markenmaterialien umzielen
- Als Boden unter einem Produkt-GLB nutzen
- [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv) studieren

## So funktioniert es

Ein TSL-Material sampelt Höhe/Displacement, um UVs nach Blickrichtung zu verschieben (Parallax), und schichtet Farbe, Normal und Rauheit. WebGPURenderer führt den Node-Graphen aus. Upstream: [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv) ([Quelle](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_parallax_uv.html)). Klassische WebGL-Parallax-Shader existieren; diese Demo folgt dem WebGPU- + TSL-Pfad.

## FAQ

**Ist das Eis ein echtes 3D-Volumen?**  
Nein — es ist eine schattierte Ebene. Parallax täuscht Tiefe im Material vor.

**Können wir unser eigenes Texture-Set nutzen?**  
Ja. Passende Map-Namen und Stärke sind ein Standard-Materialtausch.

## Tech-Stack und weiterführende Links

- [three.js — Parallax UV](https://threejs.org/examples/#webgpu_parallax_uv)
- [ambientCG](https://ambientcg.com/)
- [Three.js](https://threejs.org/)

## Verwandt bei IOM

Mehr in [Experimente](/#experiments), plus [WebGPU TSL Raging Sea](/blog/webgpu-tsl-raging-sea), [WebGPU Custom Fog Scattering](/blog/webgpu-custom-fog-scattering), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$WebGPU Parallax UV — Tiefe in einer flachen Textur — IOM$iom$,
  $iom$Eis, das dicker wirkt als eine flache Ebene — TSL-Parallax-UV verschiebt geschichtete ambientCG-Maps mit Displacement, Normalen und Rauheit unter HDR-Licht.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-parallax-uv$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$WebGPU Parallax UV — profondeur dans une texture plate$iom$,
  $iom$De la glace qui paraît plus épaisse qu'un simple plan — le parallax UV TSL décale des maps ambientCG en couches avec displacement, normales et rugosité sous éclairage HDR.$iom$,
  $iom$De la glace qui paraît plus épaisse qu'un simple plan — le parallax UV TSL décale des maps ambientCG en couches avec displacement, normales et rugosité sous éclairage HDR.

Il se trouve dans notre [section Expériences](/#experiments) sous **WebGPU Parallax UV**. La couverture montre le sol de glace avec profondeur parallax alors que la caméra effleure la surface.

## Ouvrir la démo en direct

**[→ Lancer WebGPU Parallax UV](/demos/webgpu-parallax-uv/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Fausse épaisseur, vraies économies** — sensation de profondeur sans mesh sculpté lourd
- **Matériaux TSL** — matériaux nœuds Three.js modernes sur WebGPU
- **Stack PBR** — albedo, normale, rugosité et displacement travaillent ensemble
- **Environnement HDR** — reflets qui vendent un matériau gelé

Usages typiques : études de matériaux, plans au sol pour prises produit et revues « ce shader se lit-il ? ».

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Une photo normale de glace est plate. Le parallax UV trompe l'œil : en déplaçant la caméra, la texture se décale légèrement comme s'il y avait de la profondeur sous la surface — comme regarder dans de la glace claire sans modéliser chaque fissure.

**Glossaire rapide**

- **Parallax mapping** — décalage UV basé sur l'angle de vue et une map hauteur/displacement
- **TSL** — Three.js Shading Language pour matériaux GPU basés sur nœuds
- **PBR** — physically based rendering — modèle matériau rugosité/métal
- **HDR environment** — image haute plage dynamique éclairant les reflets de la scène

## Essayez en environ 60 secondes

1. Ouvrir la [démo WebGPU Parallax UV](/demos/webgpu-parallax-uv/)
2. Orbiter bas sur la glace — observer le décalage de profondeur selon l'angle
3. Comparer vues rasantes et plongées
4. Noter comment normales et rugosité changent le rendu gelé sous HDR

## Prérequis et performances

- **Navigateur :** WebGPU (Chrome/Edge recommandé)
- **Textures :** maps style ambientCG incluses ; réseau utile au premier chargement
- **GPU :** léger à modéré — plus lourd qu'un plan plat non éclairé, plus léger que des essaims compute complets

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Angle ras — profondeur parallax dans le plan de glace](/assets/blog/webgpu-parallax-uv/view-a.jpg?v=20260722a)

![Vue plus haute — maps en couches et reflet HDR lisibles](/assets/blog/webgpu-parallax-uv/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Retargeter les maps vers pierre, bois ou matériaux de marque
- Utiliser comme sol sous un GLB produit
- Étudier [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv)

## Comment ça marche

Un matériau TSL échantillonne hauteur/displacement pour décaler les UV selon la direction de vue (parallax), puis superpose couleur, normale et rugosité. WebGPURenderer exécute le graphe de nœuds. Upstream : [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_parallax_uv.html)). Des shaders parallax WebGL classiques existent ; cette démo suit la voie WebGPU + TSL.

## FAQ

**La glace est-elle un vrai volume 3D ?**  
Non — c'est un plan ombré. Le parallax simule la profondeur dans le matériau.

**Pouvons-nous utiliser notre propre set de textures ?**  
Oui. Correspondance des noms de maps et intensité = échange matériau standard.

## Stack technique et lectures

- [three.js — parallax UV](https://threejs.org/examples/#webgpu_parallax_uv)
- [ambientCG](https://ambientcg.com/)
- [Three.js](https://threejs.org/)

## Sur IOM

Parcourez [Expériences](/#experiments), plus [WebGPU TSL Raging Sea](/blog/webgpu-tsl-raging-sea), [WebGPU Custom Fog Scattering](/blog/webgpu-custom-fog-scattering), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$WebGPU Parallax UV — profondeur dans une texture plate — IOM$iom$,
  $iom$De la glace qui paraît plus épaisse qu'un simple plan — le parallax UV TSL décale des maps ambientCG en couches avec displacement, normales et rugosité sous éclairage HDR.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-parallax-uv$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$WebGPU Parallax UV — diepte in een vlakke textuur$iom$,
  $iom$IJs dat dikker aanvoelt dan een vlak vlak — TSL parallax UV verschuift gelaagde ambientCG-maps met displacement, normalen en ruwheid onder HDR-licht.$iom$,
  $iom$IJs dat dikker aanvoelt dan een vlak vlak — TSL parallax UV verschuift gelaagde ambientCG-maps met displacement, normalen en ruwheid onder HDR-licht.

Het staat in onze [Experimenten-sectie](/#experiments) als **WebGPU Parallax UV**. De cover toont de ijsgrond met parallax-diepte terwijl de camera langs het oppervlak schuift.

## Open de live demo

**[→ Start WebGPU Parallax UV](/demos/webgpu-parallax-uv/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Nep-dikte, echte besparing** — dieptesignaal zonder zwaar gesculpt mesh
- **TSL-materialen** — moderne Three.js node-materialen op WebGPU
- **PBR-stack** — albedo, normal, ruwheid en displacement samen
- **HDR-omgeving** — reflecties die bevroren materiaal geloofwaardig maken

Typische toepassingen: materiaalstudies, grondvlakken voor productshots en „leest deze shader?“-reviews.

## Voor beginners — wat is dit, in gewone taal?

Een normale ijsfoto is plat. Parallax UV bedriegt het oog: als je de camera beweegt, verschuift de textuur een beetje alsof er diepte onder het oppervlak zit — als kijken in helder ijs zonder elke scheur te modelleren.

**Korte glossary**

- **Parallax mapping** — UV-verschuiving op basis van kijkhoek en een hoogte-/displacement-map
- **TSL** — Three.js Shading Language voor node-gebaseerde GPU-materialen
- **PBR** — physically based rendering — ruwheid/metalness-materiaalmodel
- **HDR environment** — high-dynamic-range-beeld dat scènereflecties verlicht

## Probeer dit in ongeveer 60 seconden

1. Open de [WebGPU Parallax UV-demo](/demos/webgpu-parallax-uv/)
2. Orbit laag over het ijs — zie diepte verschuiven met hoek
3. Vergelijk schuin vs. top-down
4. Let op hoe normalen en ruwheid de bevroren look onder HDR veranderen

## Vereisten en performance

- **Browser:** WebGPU (Chrome/Edge aanbevolen)
- **Texturen:** ambientCG-stijl maps zijn meegeleverd; netwerk helpt bij eerste load
- **GPU:** licht tot matig — zwaarder dan een vlak onverlicht vlak, lichter dan volledige compute-zwermen

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Schuine hoek — parallax-diepte in het ijsvlak](/assets/blog/webgpu-parallax-uv/view-a.jpg?v=20260722a)

![Hogere view — gelaagde maps en HDR-reflectie leesbaar](/assets/blog/webgpu-parallax-uv/view-b.jpg?v=20260722a)

Ook in deze build:

- Maps retargeten naar steen, hout of merkmaterialen
- Als grond onder een product-GLB gebruiken
- [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv) bestuderen

## Hoe het werkt

Een TSL-materiaal samplet hoogte/displacement om UV's te verschuiven op kijkrichting (parallax), en laagt kleur, normal en ruwheid. WebGPURenderer draait de node-grafiek. Upstream: [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv) ([bron](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_parallax_uv.html)). Klassieke WebGL-parallax-shaders bestaan; deze demo volgt het WebGPU + TSL-pad.

## FAQ

**Is het ijs een echt 3D-volume?**  
Nee — het is een schaduwend vlak. Parallax simuleert diepte in het materiaal.

**Kunnen we onze eigen texture-set gebruiken?**  
Ja. Passende map-naming en sterkte is een standaard materiaalswap.

## Tech stack en verder lezen

- [three.js — parallax UV](https://threejs.org/examples/#webgpu_parallax_uv)
- [ambientCG](https://ambientcg.com/)
- [Three.js](https://threejs.org/)

## Gerelateerd op IOM

Bekijk meer in [Experimenten](/#experiments), plus [WebGPU TSL Raging Sea](/blog/webgpu-tsl-raging-sea), [WebGPU Custom Fog Scattering](/blog/webgpu-custom-fog-scattering), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$WebGPU Parallax UV — diepte in een vlakke textuur — IOM$iom$,
  $iom$IJs dat dikker aanvoelt dan een vlak vlak — TSL parallax UV verschuift gelaagde ambientCG-maps met displacement, normalen en ruwheid onder HDR-licht.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-parallax-uv$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$WebGPU Parallax UV — profondità in una texture piatta$iom$,
  $iom$Ghiaccio che sembra più spesso di un piano piatto — il parallax UV TSL offsetta map ambientCG a strati con displacement, normali e rugosità sotto luce HDR.$iom$,
  $iom$Ghiaccio che sembra più spesso di un piano piatto — il parallax UV TSL offsetta map ambientCG a strati con displacement, normali e rugosità sotto luce HDR.

Si trova nella nostra [sezione Esperimenti](/#experiments) come **WebGPU Parallax UV**. La cover mostra il suolo di ghiaccio con profondità parallax mentre la camera sfiora la superficie.

## Apri la demo live

**[→ Avvia WebGPU Parallax UV](/demos/webgpu-parallax-uv/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Spessore simulato, risparmio reale** — segnale di profondità senza mesh scolpito pesante
- **Materiali TSL** — materiali a nodi Three.js moderni su WebGPU
- **Stack PBR** — albedo, normal, rugosità e displacement insieme
- **Ambiente HDR** — riflessi che vendono un materiale ghiacciato

Usi tipici: studi materiali, piani di base per product shot e review « questo shader si legge? ».

## Per principianti — cos’è, in parole semplici?

Una foto normale di ghiaccio è piatta. Il parallax UV inganna l'occhio: muovendo la camera, la texture si sposta leggermente come se ci fosse profondità sotto la superficie — come guardare nel ghiaccio chiaro senza modellare ogni crepa.

**Glossario rapido**

- **Parallax mapping** — offset UV basato su angolo di vista e map altezza/displacement
- **TSL** — Three.js Shading Language per materiali GPU basati su nodi
- **PBR** — physically based rendering — modello materiale rugosità/metalness
- **HDR environment** — immagine ad alta gamma dinamica che illumina i riflessi della scena

## Provalo in circa 60 secondi

1. Apri la [demo WebGPU Parallax UV](/demos/webgpu-parallax-uv/)
2. Orbita basso sul ghiaccio — osserva lo shift di profondità con l'angolo
3. Confronta vista rasente vs. dall'alto
4. Nota come normali e rugosità cambiano il look gelato sotto HDR

## Requisiti e prestazioni

- **Browser:** WebGPU (Chrome/Edge consigliato)
- **Texture:** map stile ambientCG incluse; rete utile al primo caricamento
- **GPU:** da leggero a moderato — più pesante di un piano piatto non illuminato, più leggero di stormi compute completi

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Angolo rasente — profondità parallax nel piano di ghiaccio](/assets/blog/webgpu-parallax-uv/view-a.jpg?v=20260722a)

![Vista più alta — map a strati e riflesso HDR leggibili](/assets/blog/webgpu-parallax-uv/view-b.jpg?v=20260722a)

Anche in questa build:

- Retargetare le map su pietra, legno o materiali di brand
- Usare come base sotto un GLB prodotto
- Studiare [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv)

## Come funziona

Un materiale TSL campiona altezza/displacement per offsettare UV secondo direzione di vista (parallax), poi stratifica colore, normal e rugosità. WebGPURenderer esegue il grafo nodi. Upstream: [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv) ([sorgente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_parallax_uv.html)). Shader parallax WebGL classici esistono; questa demo segue il percorso WebGPU + TSL.

## FAQ

**Il ghiaccio è un vero volume 3D?**  
No — è un piano ombreggiato. Il parallax simula profondità nel materiale.

**Possiamo usare il nostro set di texture?**  
Sì. Nomi map e intensità corrispondenti = swap materiale standard.

## Stack tecnico e letture

- [three.js — parallax UV](https://threejs.org/examples/#webgpu_parallax_uv)
- [ambientCG](https://ambientcg.com/)
- [Three.js](https://threejs.org/)

## Correlati su IOM

Esplora di più in [Esperimenti](/#experiments), più [WebGPU TSL Raging Sea](/blog/webgpu-tsl-raging-sea), [WebGPU Custom Fog Scattering](/blog/webgpu-custom-fog-scattering), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$WebGPU Parallax UV — profondità in una texture piatta — IOM$iom$,
  $iom$Ghiaccio che sembra più spesso di un piano piatto — il parallax UV TSL offsetta map ambientCG a strati con displacement, normali e rugosità sotto luce HDR.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-parallax-uv$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$WebGPU Parallax UV — profundidad en una textura plana$iom$,
  $iom$Hielo que se siente más grueso que un plano plano — parallax UV TSL desplaza mapas ambientCG en capas con displacement, normales y rugosidad bajo luz HDR.$iom$,
  $iom$Hielo que se siente más grueso que un plano plano — parallax UV TSL desplaza mapas ambientCG en capas con displacement, normales y rugosidad bajo luz HDR.

Está en nuestra [sección Experimentos](/#experiments) como **WebGPU Parallax UV**. La portada muestra el suelo de hielo con profundidad parallax mientras la cámara roza la superficie.

## Abrir la demo en vivo

**[→ Lanzar WebGPU Parallax UV](/demos/webgpu-parallax-uv/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Grosor simulado, ahorro real** — señal de profundidad sin malla esculpida pesada
- **Materiales TSL** — materiales nodo Three.js modernos en WebGPU
- **Stack PBR** — albedo, normal, rugosidad y displacement trabajando juntos
- **Entorno HDR** — reflejos que venden material congelado

Usos típicos: estudios de materiales, planos de suelo para product shots y revisiones « ¿se lee este shader? ».

## Para principiantes — ¿qué es esto, en palabras simples?

Una foto normal de hielo es plana. Parallax UV engaña al ojo: al mover la cámara, la textura se desplaza un poco como si hubiera profundidad bajo la superficie — como mirar dentro de hielo claro sin modelar cada grieta.

**Glosario rápido**

- **Parallax mapping** — desplazamiento UV basado en ángulo de vista y mapa altura/displacement
- **TSL** — Three.js Shading Language para materiales GPU basados en nodos
- **PBR** — physically based rendering — modelo material rugosidad/metalness
- **HDR environment** — imagen de alto rango dinámico que ilumina reflejos de escena

## Pruébalo en unos 60 segundos

1. Abre la [demo WebGPU Parallax UV](/demos/webgpu-parallax-uv/)
2. Orbita bajo sobre el hielo — observa el desplazamiento de profundidad con el ángulo
3. Compara vistas rasantes vs. cenitales
4. Nota cómo normales y rugosidad cambian el look helado bajo HDR

## Requisitos y rendimiento

- **Navegador:** WebGPU (Chrome/Edge recomendado)
- **Texturas:** mapas estilo ambientCG incluidos; red ayuda en la primera carga
- **GPU:** ligero a moderado — más pesado que un plano plano sin luz, más ligero que bandadas compute completas

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Ángulo rasante — profundidad parallax en el plano de hielo](/assets/blog/webgpu-parallax-uv/view-a.jpg?v=20260722a)

![Vista más alta — mapas en capas y reflejo HDR legibles](/assets/blog/webgpu-parallax-uv/view-b.jpg?v=20260722a)

También en este build:

- Retargetear mapas a piedra, madera o materiales de marca
- Usar como suelo bajo un GLB de producto
- Estudiar [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv)

## Cómo funciona

Un material TSL samplea altura/displacement para desplazar UVs según dirección de vista (parallax), luego estratifica color, normal y rugosidad. WebGPURenderer ejecuta el grafo de nodos. Upstream: [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv) ([fuente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_parallax_uv.html)). Shaders parallax WebGL clásicos existen; esta demo sigue la ruta WebGPU + TSL.

## FAQ

**¿El hielo es un volumen 3D real?**  
No — es un plano sombreado. Parallax simula profundidad en el material.

**¿Podemos usar nuestro propio set de texturas?**  
Sí. Nombres de mapas e intensidad coincidentes = swap de material estándar.

## Stack técnico y lecturas

- [three.js — parallax UV](https://threejs.org/examples/#webgpu_parallax_uv)
- [ambientCG](https://ambientcg.com/)
- [Three.js](https://threejs.org/)

## Relacionado en IOM

Explora más en [Experimentos](/#experiments), más [WebGPU TSL Raging Sea](/blog/webgpu-tsl-raging-sea), [WebGPU Custom Fog Scattering](/blog/webgpu-custom-fog-scattering), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$WebGPU Parallax UV — profundidad en una textura plana — IOM$iom$,
  $iom$Hielo que se siente más grueso que un plano plano — parallax UV TSL desplaza mapas ambientCG en capas con displacement, normales y rugosidad bajo luz HDR.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-parallax-uv$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$WebGPU TSL Raging Sea — procedural waves$iom$,
  $iom$A stormy ocean without an ocean simulator — layered sine waves and fractal noise displace a dense plane, with computed normals and emissive crests, all in TSL on WebGPU.$iom$,
  $iom$A stormy ocean without an ocean simulator — layered sine waves and fractal noise displace a dense plane, with computed normals and emissive crests, all in TSL on WebGPU.

It lives in our [Experiments section](/#experiments) as **WebGPU TSL Raging Sea**. The cover shows high seas with bright crest highlights.

## Open the live demo

**[→ Launch TSL Raging Sea](/demos/webgpu-tsl-raging-sea/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Procedural water** — no baked flipbook; parameters drive the mood
- **TSL displacement** — wave math lives in the material graph
- **Crest energy** — emissive highlights sell foam and spray without particles
- **WebGPU path** — modern Three.js ocean sketch for pitches and R&D

Typical uses: environment backdrops, marine product context, and shader R&D before FFT ocean systems.

## For beginners — what is this, in plain words?

The “sea” is a flat grid that the GPU pushes up and down every frame using math — big rolling waves plus smaller chop. Lighting on the slopes makes it look like water instead of a wrinkled sheet.

**Quick glossary**

- **Displacement** — moving mesh vertices (or shading) with a height function
- **Fractal noise** — layered noise for natural-looking detail
- **TSL** — Three.js Shading Language used to author the wave graph
- **Normals** — surface directions used for lighting; recomputed from the waves

## Try this in about 60 seconds

1. Open the [TSL Raging Sea demo](/demos/webgpu-tsl-raging-sea/)
2. Orbit and watch large swells versus small chop
3. Look for emissive crests on wave peaks
4. Compare mood with our other ocean experiments on the site

## Requirements and performance

- **Browser:** WebGPU required for this TSL WebGPU example
- **GPU:** denser planes cost more — lower pixel ratio if it stutters
- **Not WebGL ocean:** distinct from the classic WebGL water / FFT demos

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Wide storm sea — layered swells reading at distance](/assets/blog/webgpu-tsl-raging-sea/view-a.jpg?v=20260722a)

![Crest detail — normals and emissive highlights](/assets/blog/webgpu-tsl-raging-sea/view-b.jpg?v=20260722a)

Also in this build:

- Retune amplitude and noise for calm harbor vs storm
- Use as a skybox-adjacent backdrop under a product
- Open [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) upstream

## How it works

Vertex (or equivalent TSL) displacement sums large sines with fractal noise; normals are derived so lighting reacts to slopes; crests get emissive lift. Runs on Three.js WebGPU + TSL. Upstream: [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_raging_sea.html)). For spectrum-based seas, see dedicated FFT ocean work elsewhere on IOM — different technique, often WebGL or hybrid.

## FAQ

**Is this a full ocean simulation?**  
No — it is procedural displacement. Great for look development; not CFD.

**WebGL or WebGPU?**  
WebGPU via Three.js TSL. Broader device coverage may still prefer WebGL oceans.

## Tech stack and further reading

- [three.js — TSL raging sea](https://threejs.org/examples/#webgpu_tsl_raging_sea)
- [Three.js](https://threejs.org/)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Related on IOM

Browse more in [Experiments](/#experiments), plus [WebGPU Parallax UV](/blog/webgpu-parallax-uv), [Terrain Sandbox](/blog/terrain-sandbox), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$WebGPU TSL Raging Sea — procedural waves — IOM$iom$,
  $iom$A stormy ocean without an ocean simulator — layered sine waves and fractal noise displace a dense plane, with computed normals and emissive crests, all in TSL on WebGPU.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-tsl-raging-sea$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$WebGPU TSL Raging Sea — prozedurale Wellen$iom$,
  $iom$Ein stürmisches Meer ohne Ozeansimulator — geschichtete Sinuswellen und fraktale Noise verschieben eine dichte Ebene, mit berechneten Normalen und emissiven Kämmen, alles in TSL au$iom$,
  $iom$Ein stürmisches Meer ohne Ozeansimulator — geschichtete Sinuswellen und fraktale Noise verschieben eine dichte Ebene, mit berechneten Normalen und emissiven Kämmen, alles in TSL auf WebGPU.

Es liegt in unserem [Experimente-Bereich](/#experiments) als **WebGPU TSL Raging Sea**. Das Cover zeigt hohe See mit hellen Kamm-Highlights.

## Live-Demo öffnen

**[→ TSL Raging Sea starten](/demos/webgpu-tsl-raging-sea/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Prozedurales Wasser** — kein gebackenes Flipbook; Parameter steuern die Stimmung
- **TSL-Displacement** — Wellen-Math lebt im Materialgraphen
- **Kamm-Energie** — emissive Highlights verkaufen Schaum und Gischt ohne Partikel
- **WebGPU-Pfad** — moderne Three.js-Ozeanskizze für Pitches und F&E

Typische Einsätze: Umgebungs-Hintergründe, maritimer Produktkontext und Shader-F&E vor FFT-Ozeansystemen.

## Für Einsteiger — was ist das, in einfachen Worten?

Das „Meer“ ist ein flaches Gitter, das die GPU jeden Frame mit Mathematik hoch und runter schiebt — große rollende Wellen plus kleinere Chop. Beleuchtung an den Hängen lässt es wie Wasser statt wie ein faltiges Blatt wirken.

**Kurzes Glossar**

- **Displacement** — Verschiebung von Mesh-Vertices (oder Shading) mit einer Höhenfunktion
- **Fractal noise** — geschichtetes Noise für natürlich wirkende Details
- **TSL** — Three.js Shading Language zur Authoring des Wellengraphen
- **Normals** — Oberflächenrichtungen für Beleuchtung; aus den Wellen neu berechnet

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [TSL Raging Sea Demo](/demos/webgpu-tsl-raging-sea/)
2. Orbitieren und beobachten Sie große Dünungen gegen kleines Chop
3. Suchen Sie emissive Kämme auf Wellengipfeln
4. Vergleichen Sie die Stimmung mit unseren anderen Ozean-Experimenten auf der Site

## Anforderungen und Performance

- **Browser:** WebGPU erforderlich für dieses TSL-WebGPU-Beispiel
- **GPU:** dichtere Ebenen kosten mehr — Pixel-Ratio senken bei Ruckeln
- **Kein WebGL-Ozean:** unterscheidet sich von klassischen WebGL-Wasser-/FFT-Demos

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Weite Sturmsee — geschichtete Dünungen lesbar in der Ferne](/assets/blog/webgpu-tsl-raging-sea/view-a.jpg?v=20260722a)

![Kammdetail — Normalen und emissive Highlights](/assets/blog/webgpu-tsl-raging-sea/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Amplitude und Noise für ruhigen Hafen vs. Sturm neu einstellen
- Als skybox-naher Hintergrund unter einem Produkt nutzen
- [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) upstream öffnen

## So funktioniert es

Vertex- (oder äquivalentes TSL-)Displacement summiert große Sinuswellen mit fraktalem Noise; Normalen werden abgeleitet, damit Beleuchtung auf Hängen reagiert; Kämme erhalten emissive Anhebung. Läuft auf Three.js WebGPU + TSL. Upstream: [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) ([Quelle](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_raging_sea.html)). Für spektrumbasierte Meere siehe dedizierte FFT-Ozean-Arbeit anderswo bei IOM — andere Technik, oft WebGL oder hybrid.

## FAQ

**Ist das eine vollständige Ozeansimulation?**  
Nein — prozedurales Displacement. Ideal für Look Development; kein CFD.

**WebGL oder WebGPU?**  
WebGPU via Three.js TSL. Breitere Geräteabdeckung bevorzugt ggf. noch WebGL-Ozeane.

## Tech-Stack und weiterführende Links

- [three.js — TSL raging sea](https://threejs.org/examples/#webgpu_tsl_raging_sea)
- [Three.js](https://threejs.org/)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Verwandt bei IOM

Mehr in [Experimente](/#experiments), plus [WebGPU Parallax UV](/blog/webgpu-parallax-uv), [Terrain Sandbox](/blog/terrain-sandbox), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$WebGPU TSL Raging Sea — prozedurale Wellen — IOM$iom$,
  $iom$Ein stürmisches Meer ohne Ozeansimulator — geschichtete Sinuswellen und fraktale Noise verschieben eine dichte Ebene, mit berechneten Normalen und emissiven Kämmen, alles in TSL au$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-tsl-raging-sea$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$WebGPU TSL Raging Sea — vagues procédurales$iom$,
  $iom$Une mer déchaînée sans simulateur océanique — sinus en couches et bruit fractal déforment un plan dense, avec normales calculées et crêtes émissives, le tout en TSL sur WebGPU.$iom$,
  $iom$Une mer déchaînée sans simulateur océanique — sinus en couches et bruit fractal déforment un plan dense, avec normales calculées et crêtes émissives, le tout en TSL sur WebGPU.

Il se trouve dans notre [section Expériences](/#experiments) sous **WebGPU TSL Raging Sea**. La couverture montre une haute mer avec reflets lumineux sur les crêtes.

## Ouvrir la démo en direct

**[→ Lancer TSL Raging Sea](/demos/webgpu-tsl-raging-sea/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Eau procédurale** — pas de flipbook pré-calculé ; les paramètres pilotent l'ambiance
- **Displacement TSL** — la math des vagues vit dans le graphe matériau
- **Énergie des crêtes** — highlights émissifs vendent écume et embruns sans particules
- **Voie WebGPU** — croquis océan Three.js moderne pour pitches et R&D

Usages typiques : fonds d'environnement, contexte produit maritime et R&D shader avant systèmes océan FFT.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

La « mer » est une grille plate que le GPU soulève et abaisse chaque frame avec des maths — grosses houles plus petit clapoti. L'éclairage sur les pentes la fait ressembler à de l'eau plutôt qu'à une feuille froissée.

**Glossaire rapide**

- **Displacement** — déplacement des sommets de mesh (ou du shading) via une fonction de hauteur
- **Fractal noise** — bruit en couches pour un détail naturel
- **TSL** — Three.js Shading Language pour authorer le graphe de vagues
- **Normals** — directions de surface pour l'éclairage ; recalculées depuis les vagues

## Essayez en environ 60 secondes

1. Ouvrir la [démo TSL Raging Sea](/demos/webgpu-tsl-raging-sea/)
2. Orbiter et observer grosses houles vs petit clapoti
3. Repérer les crêtes émissives au sommet des vagues
4. Comparer l'ambiance avec nos autres expériences océan sur le site

## Prérequis et performances

- **Navigateur :** WebGPU requis pour cet exemple TSL WebGPU
- **GPU :** plans plus denses coûtent plus — baisser le pixel ratio si saccades
- **Pas océan WebGL :** distinct des démos eau/FFT WebGL classiques

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Mer orageuse large — houles en couches lisibles au loin](/assets/blog/webgpu-tsl-raging-sea/view-a.jpg?v=20260722a)

![Détail de crête — normales et highlights émissifs](/assets/blog/webgpu-tsl-raging-sea/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Retuner amplitude et bruit pour port calme vs tempête
- Utiliser comme fond proche skybox sous un produit
- Ouvrir [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) upstream

## Comment ça marche

Le displacement vertex (ou TSL équivalent) somme de grands sinus avec bruit fractal ; les normales sont dérivées pour que l'éclairage réagisse aux pentes ; les crêtes reçoivent un lift émissif. Tourne sur Three.js WebGPU + TSL. Upstream : [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_raging_sea.html)). Pour mers basées spectre, voir travail océan FFT ailleurs chez IOM — technique différente, souvent WebGL ou hybride.

## FAQ

**Est-ce une simulation océan complète ?**  
Non — displacement procédural. Idéal pour look dev ; pas de CFD.

**WebGL ou WebGPU ?**  
WebGPU via Three.js TSL. Couverture appareils plus large peut encore préférer océans WebGL.

## Stack technique et lectures

- [three.js — TSL raging sea](https://threejs.org/examples/#webgpu_tsl_raging_sea)
- [Three.js](https://threejs.org/)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Sur IOM

Parcourez [Expériences](/#experiments), plus [WebGPU Parallax UV](/blog/webgpu-parallax-uv), [Terrain Sandbox](/blog/terrain-sandbox), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$WebGPU TSL Raging Sea — vagues procédurales — IOM$iom$,
  $iom$Une mer déchaînée sans simulateur océanique — sinus en couches et bruit fractal déforment un plan dense, avec normales calculées et crêtes émissives, le tout en TSL sur WebGPU.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-tsl-raging-sea$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$WebGPU TSL Raging Sea — procedurele golven$iom$,
  $iom$Een stormachtige oceaan zonder oceaan-simulator — gelaagde sinusgolven en fractale noise verplaatsen een dicht vlak, met berekende normalen en emissieve kammen, allemaal in TSL op $iom$,
  $iom$Een stormachtige oceaan zonder oceaan-simulator — gelaagde sinusgolven en fractale noise verplaatsen een dicht vlak, met berekende normalen en emissieve kammen, allemaal in TSL op WebGPU.

Het staat in onze [Experimenten-sectie](/#experiments) als **WebGPU TSL Raging Sea**. De cover toont hoge zee met heldere kamm-highlighting.

## Open de live demo

**[→ Start TSL Raging Sea](/demos/webgpu-tsl-raging-sea/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Procedureel water** — geen gebakken flipbook; parameters sturen de sfeer
- **TSL-displacement** — golf-math leeft in de materiaalgrafiek
- **Kamenergie** — emissieve highlights verkopen schuim en spray zonder deeltjes
- **WebGPU-pad** — moderne Three.js-oceansketch voor pitches en R&D

Typische toepassingen: omgevingsachtergronden, maritieme productcontext en shader-R&D vóór FFT-oceaan-systemen.

## Voor beginners — wat is dit, in gewone taal?

De „zee“ is een plat raster dat de GPU elk frame omhoog en omlaag duwt met wiskunde — grote deining plus klein chop. Belichting op de hellingen maakt het water in plaats van een gerimpeld vel.

**Korte glossary**

- **Displacement** — mesh-vertices (of shading) verplaatsen met een hoogtefunctie
- **Fractal noise** — gelaagde noise voor natuurlijk ogende detail
- **TSL** — Three.js Shading Language voor het golf-grafiekauthoring
- **Normals** — oppervlakrichtingen voor belichting; opnieuw berekend uit de golven

## Probeer dit in ongeveer 60 seconden

1. Open de [TSL Raging Sea-demo](/demos/webgpu-tsl-raging-sea/)
2. Orbit en kijk grote deining vs. klein chop
3. Zoek emissieve kammen op golfpieken
4. Vergelijk sfeer met onze andere oceaan-experimenten op de site

## Vereisten en performance

- **Browser:** WebGPU vereist voor dit TSL WebGPU-voorbeeld
- **GPU:** dichtere vlakken kosten meer — verlaag pixel ratio bij haperen
- **Geen WebGL-oceaan:** anders dan klassieke WebGL water/FFT-demo's

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Brede stormzee — gelaagde deining leesbaar op afstand](/assets/blog/webgpu-tsl-raging-sea/view-a.jpg?v=20260722a)

![Kamdetail — normalen en emissieve highlights](/assets/blog/webgpu-tsl-raging-sea/view-b.jpg?v=20260722a)

Ook in deze build:

- Amplitude en noise retunen voor rustige haven vs. storm
- Als skybox-achtige achtergrond onder een product
- Open [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) upstream

## Hoe het werkt

Vertex- (of equivalent TSL-)displacement sommeert grote sinus met fractale noise; normalen worden afgeleid zodat belichting op hellingen reageert; kammen krijgen emissieve lift. Draait op Three.js WebGPU + TSL. Upstream: [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) ([bron](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_raging_sea.html)). Voor spectrum-gebaseerde zeeën, zie dedicated FFT-oceaanwerk elders bij IOM — andere techniek, vaak WebGL of hybride.

## FAQ

**Is dit een volledige oceaan-simulatie?**  
Nee — procedurele displacement. Ideaal voor look development; geen CFD.

**WebGL of WebGPU?**  
WebGPU via Three.js TSL. Bredere device-dekking kan nog WebGL-oceanen prefereren.

## Tech stack en verder lezen

- [three.js — TSL raging sea](https://threejs.org/examples/#webgpu_tsl_raging_sea)
- [Three.js](https://threejs.org/)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Gerelateerd op IOM

Bekijk meer in [Experimenten](/#experiments), plus [WebGPU Parallax UV](/blog/webgpu-parallax-uv), [Terrain Sandbox](/blog/terrain-sandbox), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$WebGPU TSL Raging Sea — procedurele golven — IOM$iom$,
  $iom$Een stormachtige oceaan zonder oceaan-simulator — gelaagde sinusgolven en fractale noise verplaatsen een dicht vlak, met berekende normalen en emissieve kammen, allemaal in TSL op $iom$
from public.blog_posts p
where p.slug = $iom$webgpu-tsl-raging-sea$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$WebGPU TSL Raging Sea — onde procedurali$iom$,
  $iom$Un mare in tempesta senza simulatore oceanico — onde sinusoidali a strati e noise frattale spostano un piano denso, con normali calcolate e creste emissive, tutto in TSL su WebGPU.$iom$,
  $iom$Un mare in tempesta senza simulatore oceanico — onde sinusoidali a strati e noise frattale spostano un piano denso, con normali calcolate e creste emissive, tutto in TSL su WebGPU.

Si trova nella nostra [sezione Esperimenti](/#experiments) come **WebGPU TSL Raging Sea**. La cover mostra alto mare con highlight luminosi sulle creste.

## Apri la demo live

**[→ Avvia TSL Raging Sea](/demos/webgpu-tsl-raging-sea/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Acqua procedurale** — niente flipbook pre-baked; i parametri guidano l'atmosfera
- **Displacement TSL** — la matematica delle onde vive nel grafo materiale
- **Energia delle creste** — highlight emissivi vendono schiuma e spray senza particelle
- **Percorso WebGPU** — sketch oceano Three.js moderno per pitch e R&D

Usi tipici: sfondi ambientali, contesto prodotto marino e R&D shader prima di sistemi oceano FFT.

## Per principianti — cos’è, in parole semplici?

Il « mare » è una griglia piatta che la GPU spinge su e giù ogni frame con la matematica — grandi onde più piccolo chop. L'illuminazione sui pendii lo fa sembrare acqua invece di un foglio stropicciato.

**Glossario rapido**

- **Displacement** — spostamento vertici mesh (o shading) con una funzione di altezza
- **Fractal noise** — noise a strati per dettaglio naturale
- **TSL** — Three.js Shading Language per authorare il grafo onde
- **Normals** — direzioni di superficie per l'illuminazione; ricalcolate dalle onde

## Provalo in circa 60 secondi

1. Apri la [demo TSL Raging Sea](/demos/webgpu-tsl-raging-sea/)
2. Orbita e osserva grandi mareggiate vs. piccolo chop
3. Cerca creste emissive sui picchi delle onde
4. Confronta l'atmosfera con altri esperimenti oceano sul sito

## Requisiti e prestazioni

- **Browser:** WebGPU richiesto per questo esempio TSL WebGPU
- **GPU:** piani più densi costano di più — abbassa pixel ratio se stutter
- **Non oceano WebGL:** distinto dalle demo acqua/FFT WebGL classiche

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Mare tempestoso ampio — mareggiate a strati leggibili in lontananza](/assets/blog/webgpu-tsl-raging-sea/view-a.jpg?v=20260722a)

![Dettaglio cresta — normali e highlight emissivi](/assets/blog/webgpu-tsl-raging-sea/view-b.jpg?v=20260722a)

Anche in questa build:

- Ritune ampiezza e noise per porto calmo vs. tempesta
- Usare come sfondo adiacente skybox sotto un prodotto
- Apri [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) upstream

## Come funziona

Il displacement vertex (o TSL equivalente) somma grandi sinusoidi con noise frattale; le normali sono derivate così l'illuminazione reagisce ai pendii; le creste ricevono lift emissivo. Gira su Three.js WebGPU + TSL. Upstream: [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) ([sorgente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_raging_sea.html)). Per mari basati su spettro, vedi lavoro oceano FFT dedicato altrove su IOM — tecnica diversa, spesso WebGL o ibrida.

## FAQ

**È una simulazione oceano completa?**  
No — displacement procedurale. Ottimo per look development; non CFD.

**WebGL o WebGPU?**  
WebGPU via Three.js TSL. Copertura device più ampia può ancora preferire oceani WebGL.

## Stack tecnico e letture

- [three.js — TSL raging sea](https://threejs.org/examples/#webgpu_tsl_raging_sea)
- [Three.js](https://threejs.org/)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Correlati su IOM

Esplora di più in [Esperimenti](/#experiments), più [WebGPU Parallax UV](/blog/webgpu-parallax-uv), [Terrain Sandbox](/blog/terrain-sandbox), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$WebGPU TSL Raging Sea — onde procedurali — IOM$iom$,
  $iom$Un mare in tempesta senza simulatore oceanico — onde sinusoidali a strati e noise frattale spostano un piano denso, con normali calcolate e creste emissive, tutto in TSL su WebGPU.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-tsl-raging-sea$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$WebGPU TSL Raging Sea — olas procedurales$iom$,
  $iom$Un mar tormentoso sin simulador oceánico — senos en capas y ruido fractal desplazan un plano denso, con normales calculadas y crestas emisivas, todo en TSL sobre WebGPU.$iom$,
  $iom$Un mar tormentoso sin simulador oceánico — senos en capas y ruido fractal desplazan un plano denso, con normales calculadas y crestas emisivas, todo en TSL sobre WebGPU.

Está en nuestra [sección Experimentos](/#experiments) como **WebGPU TSL Raging Sea**. La portada muestra alta mar con highlights brillantes en las crestas.

## Abrir la demo en vivo

**[→ Lanzar TSL Raging Sea](/demos/webgpu-tsl-raging-sea/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Agua procedural** — sin flipbook pre-baked; parámetros dirigen el mood
- **Displacement TSL** — la matemática de olas vive en el grafo material
- **Energía de crestas** — highlights emisivos venden espuma y spray sin partículas
- **Ruta WebGPU** — sketch océano Three.js moderno para pitches y I+D

Usos típicos: fondos de entorno, contexto producto marino e I+D shader antes de sistemas océano FFT.

## Para principiantes — ¿qué es esto, en palabras simples?

El « mar » es una malla plana que la GPU empuja arriba y abajo cada frame con matemáticas — grandes oleajes más chop pequeño. La iluminación en las pendientes lo hace parecer agua en lugar de una hoja arrugada.

**Glosario rápido**

- **Displacement** — mover vértices de malla (o shading) con una función de altura
- **Fractal noise** — ruido en capas para detalle natural
- **TSL** — Three.js Shading Language para authorar el grafo de olas
- **Normals** — direcciones de superficie para iluminación; recalculadas desde las olas

## Pruébalo en unos 60 segundos

1. Abre la [demo TSL Raging Sea](/demos/webgpu-tsl-raging-sea/)
2. Orbita y observa grandes oleadas vs. chop pequeño
3. Busca crestas emisivas en los picos de ola
4. Compara el mood con otros experimentos océano en el sitio

## Requisitos y rendimiento

- **Navegador:** WebGPU requerido para este ejemplo TSL WebGPU
- **GPU:** planos más densos cuestan más — baja pixel ratio si hay stutter
- **No océano WebGL:** distinto de demos clásicas agua/FFT WebGL

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Mar tormentoso amplio — oleadas en capas legibles a distancia](/assets/blog/webgpu-tsl-raging-sea/view-a.jpg?v=20260722a)

![Detalle de cresta — normales y highlights emisivos](/assets/blog/webgpu-tsl-raging-sea/view-b.jpg?v=20260722a)

También en este build:

- Retunear amplitud y ruido para puerto calmado vs. tormenta
- Usar como fondo adyacente a skybox bajo un producto
- Abrir [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) upstream

## Cómo funciona

Displacement vertex (o TSL equivalente) suma senos grandes con ruido fractal; normales se derivan para que la iluminación reaccione a pendientes; crestas reciben lift emisivo. Corre en Three.js WebGPU + TSL. Upstream: [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) ([fuente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_raging_sea.html)). Para mares basados en espectro, ver trabajo océano FFT dedicado en otro lugar de IOM — técnica distinta, a menudo WebGL o híbrida.

## FAQ

**¿Es una simulación oceánica completa?**  
No — displacement procedural. Ideal para look development; no CFD.

**¿WebGL o WebGPU?**  
WebGPU vía Three.js TSL. Cobertura de dispositivos más amplia puede preferir océanos WebGL.

## Stack técnico y lecturas

- [three.js — TSL raging sea](https://threejs.org/examples/#webgpu_tsl_raging_sea)
- [Three.js](https://threejs.org/)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Relacionado en IOM

Explora más en [Experimentos](/#experiments), más [WebGPU Parallax UV](/blog/webgpu-parallax-uv), [Terrain Sandbox](/blog/terrain-sandbox), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$WebGPU TSL Raging Sea — olas procedurales — IOM$iom$,
  $iom$Un mar tormentoso sin simulador oceánico — senos en capas y ruido fractal desplazan un plano denso, con normales calculadas y crestas emisivas, todo en TSL sobre WebGPU.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-tsl-raging-sea$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$WebGPU TSL Linked Particles — drawn VFX trails$iom$,
  $iom$Move the pointer to spawn a glowing particle trail — GPU compute, turbulence, nearest-neighbor link ribbons, hue rotation, and bloom. A TSL VFX sketch you can feel.$iom$,
  $iom$Move the pointer to spawn a glowing particle trail — GPU compute, turbulence, nearest-neighbor link ribbons, hue rotation, and bloom. A TSL VFX sketch you can feel.

It lives in our [Experiments section](/#experiments) as **WebGPU TSL Linked Particles**. The cover shows linked particle ribbons with bloom.

## Open the live demo

**[→ Launch TSL Linked Particles](/demos/webgpu-tsl-linked-particles/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Pointer as brush** — instant “try it” for clients on a call
- **Links between neighbors** — network / synapse / constellation language
- **Compute + TSL** — spawn, turbulence, and life on the GPU
- **Bloom finish** — soft glow that reads premium on dark UIs

Typical uses: hero backgrounds, interactive booth moments, and tech-brand visual systems.

## For beginners — what is this, in plain words?

You draw with light: particles appear under the cursor, drift with turbulence, and thin lines connect nearby points — like a constellation that remembers your gesture for a moment.

**Quick glossary**

- **Nearest-neighbor links** — lines drawn between particles that are close in space
- **Turbulence** — noisy force field that curls particle motion
- **Bloom** — post-process glow around bright pixels
- **TSL VFX** — effects authored with Three.js Shading Language nodes

## Try this in about 60 seconds

1. Open the [TSL Linked Particles demo](/demos/webgpu-tsl-linked-particles/)
2. Move the pointer across the canvas to draw trails
3. Pause and watch links and hue shift as particles live out
4. Orbit if enabled; note bloom on bright clusters

## Requirements and performance

- **Browser:** WebGPU (Chrome/Edge recommended)
- **GPU:** bloom + compute want a bit of headroom — close other heavy tabs if needed
- **Input:** mouse or trackpad; touch may vary by device

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Dense left cluster — magenta links with cyan accents](/assets/blog/webgpu-tsl-linked-particles/view-a.jpg?v=20260722a)

![Closer mesh — bloomed nodes and neighbor ribbons](/assets/blog/webgpu-tsl-linked-particles/view-b.jpg?v=20260722a)

Also in this build:

- Map pointer to touch / wand for installations
- Recolor hue cycle to brand palette
- Compare [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles)

## How it works

WebGPU compute spawns and advects particles; TSL materials render sprites/ribbons; a link pass connects nearby particles; bloom post-processes the frame. Upstream: [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_vfx_linkedparticles.html)). WebGL line networks (see draw-range) are a related visual idea with a different, more widely supported pipeline.

## FAQ

**Is this the same as the shape particles demo?**  
No — that one forms solid presets and gravity. This one is pointer-drawn VFX with links and bloom.

**Can we slow it down for a calm brand film?**  
Yes — spawn rate, turbulence, and bloom thresholds are typical knobs.

## Tech stack and further reading

- [three.js — TSL linked particles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Related on IOM

Browse more in [Experiments](/#experiments), plus [WebGPU Particles](/blog/webgpu-particles), [BufferGeometry Draw Range](/blog/buffergeometry-drawrange), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$WebGPU TSL Linked Particles — drawn VFX trails — IOM$iom$,
  $iom$Move the pointer to spawn a glowing particle trail — GPU compute, turbulence, nearest-neighbor link ribbons, hue rotation, and bloom. A TSL VFX sketch you can feel.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-tsl-linked-particles$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$WebGPU TSL Linked Particles — gezeichnete VFX-Spuren$iom$,
  $iom$Bewegen Sie den Zeiger, um eine leuchtende Partikelspur zu erzeugen — GPU-Compute, Turbulenz, Nachbarschafts-Link-Bänder, Farbtonrotation und Bloom. Eine TSL-VFX-Skizze, die man sp$iom$,
  $iom$Bewegen Sie den Zeiger, um eine leuchtende Partikelspur zu erzeugen — GPU-Compute, Turbulenz, Nachbarschafts-Link-Bänder, Farbtonrotation und Bloom. Eine TSL-VFX-Skizze, die man spürt.

Es liegt in unserem [Experimente-Bereich](/#experiments) als **WebGPU TSL Linked Particles**. Das Cover zeigt verknüpfte Partikelbänder mit Bloom.

## Live-Demo öffnen

**[→ TSL Linked Particles starten](/demos/webgpu-tsl-linked-particles/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Zeiger als Pinsel** — sofortiges „Probieren“ für Kunden im Call
- **Links zwischen Nachbarn** — Netzwerk-/Synapsen-/Sternbild-Sprache
- **Compute + TSL** — Spawn, Turbulenz und Lebensdauer auf der GPU
- **Bloom-Finish** — weicher Glow, der auf dunklen UIs premium wirkt

Typische Einsätze: Hero-Hintergründe, interaktive Messe-Momente und Tech-Marken-Visuelsysteme.

## Für Einsteiger — was ist das, in einfachen Worten?

Sie zeichnen mit Licht: Partikel erscheinen unter dem Cursor, treiben mit Turbulenz, und dünne Linien verbinden nahe Punkte — wie ein Sternbild, das Ihre Geste einen Moment lang behält.

**Kurzes Glossar**

- **Nearest-neighbor links** — Linien zwischen Partikeln, die im Raum nah beieinander liegen
- **Turbulence** — rauschendes Kraftfeld, das Partikelbewegung wirbelt
- **Bloom** — Post-Process-Glow um helle Pixel
- **TSL VFX** — Effekte, autorisiert mit Three.js Shading Language Nodes

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [TSL Linked Particles Demo](/demos/webgpu-tsl-linked-particles/)
2. Bewegen Sie den Zeiger über die Leinwand, um Spuren zu zeichnen
3. Pausieren und beobachten Sie Links und Farbtonwechsel, während Partikel ausklingen
4. Orbitieren falls aktiv; Bloom bei hellen Clustern beachten

## Anforderungen und Performance

- **Browser:** WebGPU (Chrome/Edge empfohlen)
- **GPU:** Bloom + Compute brauchen etwas Headroom — schwere Tabs schließen bei Bedarf
- **Input:** Maus oder Trackpad; Touch variiert je nach Gerät

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Dichter linker Cluster — magenta Links mit cyan Akzenten](/assets/blog/webgpu-tsl-linked-particles/view-a.jpg?v=20260722a)

![Näheres Mesh — geblühte Knoten und Nachbarbänder](/assets/blog/webgpu-tsl-linked-particles/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Zeiger auf Touch / Wand für Installationen mappen
- Farbtonzyklus auf Markenpalette umstellen
- [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles) vergleichen

## So funktioniert es

WebGPU-Compute spawnt und advektiert Partikel; TSL-Materialien rendern Sprites/Bänder; ein Link-Pass verbindet nahe Partikel; Bloom post-prozessiert den Frame. Upstream: [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles) ([Quelle](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_vfx_linkedparticles.html)). WebGL-Liniennetze (siehe draw-range) sind eine verwandte visuelle Idee mit anderer, breiter unterstützter Pipeline.

## FAQ

**Ist das dasselbe wie die Shape-Particles-Demo?**  
Nein — jene bildet solide Presets und Gravitation. Diese ist zeigergezeichnetes VFX mit Links und Bloom.

**Können wir es für einen ruhigen Markenfilm verlangsamen?**  
Ja — Spawn-Rate, Turbulenz und Bloom-Schwellen sind typische Regler.

## Tech-Stack und weiterführende Links

- [three.js — TSL linked particles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Verwandt bei IOM

Mehr in [Experimente](/#experiments), plus [WebGPU Particles](/blog/webgpu-particles), [BufferGeometry Draw Range](/blog/buffergeometry-drawrange), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$WebGPU TSL Linked Particles — gezeichnete VFX-Spuren — IOM$iom$,
  $iom$Bewegen Sie den Zeiger, um eine leuchtende Partikelspur zu erzeugen — GPU-Compute, Turbulenz, Nachbarschafts-Link-Bänder, Farbtonrotation und Bloom. Eine TSL-VFX-Skizze, die man sp$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-tsl-linked-particles$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$WebGPU TSL Linked Particles — traînées VFX dessinées$iom$,
  $iom$Déplacez le pointeur pour faire apparaître une traînée de particules lumineuses — compute GPU, turbulence, rubans de liens voisins, rotation de teinte et bloom. Un croquis VFX TSL $iom$,
  $iom$Déplacez le pointeur pour faire apparaître une traînée de particules lumineuses — compute GPU, turbulence, rubans de liens voisins, rotation de teinte et bloom. Un croquis VFX TSL que l'on ressent.

Il se trouve dans notre [section Expériences](/#experiments) sous **WebGPU TSL Linked Particles**. La couverture montre des rubans de particules liées avec bloom.

## Ouvrir la démo en direct

**[→ Lancer TSL Linked Particles](/demos/webgpu-tsl-linked-particles/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Pointeur comme pinceau** — « essayez » instantané pour clients en visio
- **Liens entre voisins** — langage réseau / synapse / constellation
- **Compute + TSL** — spawn, turbulence et vie sur le GPU
- **Finition bloom** — glow doux premium sur UI sombres

Usages typiques : fonds hero, moments interactifs stand et systèmes visuels marque tech.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Vous dessinez avec la lumière : des particules apparaissent sous le curseur, dérivent avec la turbulence, et de fines lignes relient les points proches — comme une constellation qui retient votre geste un instant.

**Glossaire rapide**

- **Nearest-neighbor links** — lignes tracées entre particules proches dans l'espace
- **Turbulence** — champ de force bruité qui enroule le mouvement des particules
- **Bloom** — glow post-process autour des pixels lumineux
- **TSL VFX** — effets authorés avec nœuds Three.js Shading Language

## Essayez en environ 60 secondes

1. Ouvrir la [démo TSL Linked Particles](/demos/webgpu-tsl-linked-particles/)
2. Déplacer le pointeur sur le canvas pour dessiner des traînées
3. Pause et observer liens et décalage de teinte pendant la vie des particules
4. Orbiter si activé ; noter le bloom sur clusters lumineux

## Prérequis et performances

- **Navigateur :** WebGPU (Chrome/Edge recommandé)
- **GPU :** bloom + compute veulent un peu de marge — fermer onglets lourds si besoin
- **Entrée :** souris ou trackpad ; touch variable selon appareil

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Cluster dense à gauche — liens magenta avec accents cyan](/assets/blog/webgpu-tsl-linked-particles/view-a.jpg?v=20260722a)

![Mesh rapproché — nœuds bloomés et rubans voisins](/assets/blog/webgpu-tsl-linked-particles/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Mapper le pointeur vers touch / baguette pour installations
- Recolorer le cycle de teinte vers palette de marque
- Comparer [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles)

## Comment ça marche

Le compute WebGPU spawn et advecte les particules ; matériaux TSL rendent sprites/rubans ; une passe de liens connecte particules proches ; bloom post-traite la frame. Upstream : [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_vfx_linkedparticles.html)). Réseaux de lignes WebGL (voir draw-range) = idée visuelle proche, pipeline différent plus largement supporté.

## FAQ

**Est-ce la même démo que shape particles ?**  
Non — celle-ci forme des presets solides et gravité. Ici VFX dessiné au pointeur avec liens et bloom.

**Peut-on ralentir pour un film de marque calme ?**  
Oui — taux de spawn, turbulence et seuils bloom sont des réglages typiques.

## Stack technique et lectures

- [three.js — TSL linked particles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Sur IOM

Parcourez [Expériences](/#experiments), plus [WebGPU Particles](/blog/webgpu-particles), [BufferGeometry Draw Range](/blog/buffergeometry-drawrange), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$WebGPU TSL Linked Particles — traînées VFX dessinées — IOM$iom$,
  $iom$Déplacez le pointeur pour faire apparaître une traînée de particules lumineuses — compute GPU, turbulence, rubans de liens voisins, rotation de teinte et bloom. Un croquis VFX TSL $iom$
from public.blog_posts p
where p.slug = $iom$webgpu-tsl-linked-particles$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$WebGPU TSL Linked Particles — getekende VFX-sporen$iom$,
  $iom$Beweeg de pointer om een gloeiend deeltjesspoor te spawnen — GPU compute, turbulentie, nearest-neighbor link-ribbons, hue-rotatie en bloom. Een TSL VFX-sketch die je voelt.$iom$,
  $iom$Beweeg de pointer om een gloeiend deeltjesspoor te spawnen — GPU compute, turbulentie, nearest-neighbor link-ribbons, hue-rotatie en bloom. Een TSL VFX-sketch die je voelt.

Het staat in onze [Experimenten-sectie](/#experiments) als **WebGPU TSL Linked Particles**. De cover toont gekoppelde deeltjesribbons met bloom.

## Open de live demo

**[→ Start TSL Linked Particles](/demos/webgpu-tsl-linked-particles/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Pointer als penseel** — direct „probeer het“ voor klanten in een call
- **Links tussen buren** — netwerk / synaps / sterrenbeeld-taal
- **Compute + TSL** — spawn, turbulentie en leven op de GPU
- **Bloom-afwerking** — zachte glow die premium leest op donkere UI's

Typische toepassingen: hero-achtergronden, interactieve beursmomenten en tech-merk visuele systemen.

## Voor beginners — wat is dit, in gewone taal?

Je tekent met licht: deeltjes verschijnen onder de cursor, drijven met turbulentie, en dunne lijnen verbinden nabije punten — als een sterrenbeeld dat je gebaar even onthoudt.

**Korte glossary**

- **Nearest-neighbor links** — lijnen getrokken tussen deeltjes die dicht bij elkaar zijn
- **Turbulence** — ruisachtig krachtveld dat deeltjesbeweging kronkelt
- **Bloom** — post-process glow rond heldere pixels
- **TSL VFX** — effecten geauthoriseerd met Three.js Shading Language nodes

## Probeer dit in ongeveer 60 seconden

1. Open de [TSL Linked Particles-demo](/demos/webgpu-tsl-linked-particles/)
2. Beweeg de pointer over het canvas om sporen te tekenen
3. Pauzeer en kijk links en hue-shift terwijl deeltjes uitdoven
4. Orbit indien ingeschakeld; let op bloom op heldere clusters

## Vereisten en performance

- **Browser:** WebGPU (Chrome/Edge aanbevolen)
- **GPU:** bloom + compute willen wat headroom — sluit zware tabs indien nodig
- **Input:** muis of trackpad; touch varieert per device

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Dichte linker cluster — magenta links met cyan accenten](/assets/blog/webgpu-tsl-linked-particles/view-a.jpg?v=20260722a)

![Dichter mesh — gebloemde nodes en buur-ribbons](/assets/blog/webgpu-tsl-linked-particles/view-b.jpg?v=20260722a)

Ook in deze build:

- Pointer mappen naar touch / wand voor installaties
- Hue-cyclus recoloreren naar merkpalet
- Vergelijk [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles)

## Hoe het werkt

WebGPU compute spawnt en advecteert deeltjes; TSL-materialen renderen sprites/ribbons; een link-pass verbindt nabije deeltjes; bloom post-processed het frame. Upstream: [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles) ([bron](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_vfx_linkedparticles.html)). WebGL-lijnnetwerken (zie draw-range) zijn een verwant visueel idee met een andere, breder ondersteunde pipeline.

## FAQ

**Is dit hetzelfde als de shape particles-demo?**  
Nee — die vormt solide presets en zwaartekracht. Deze is pointer-getekend VFX met links en bloom.

**Kunnen we het vertragen voor een rustige merkfilm?**  
Ja — spawn rate, turbulentie en bloom-drempels zijn typische knoppen.

## Tech stack en verder lezen

- [three.js — TSL linked particles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Gerelateerd op IOM

Bekijk meer in [Experimenten](/#experiments), plus [WebGPU Particles](/blog/webgpu-particles), [BufferGeometry Draw Range](/blog/buffergeometry-drawrange), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$WebGPU TSL Linked Particles — getekende VFX-sporen — IOM$iom$,
  $iom$Beweeg de pointer om een gloeiend deeltjesspoor te spawnen — GPU compute, turbulentie, nearest-neighbor link-ribbons, hue-rotatie en bloom. Een TSL VFX-sketch die je voelt.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-tsl-linked-particles$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$WebGPU TSL Linked Particles — scie VFX disegnate$iom$,
  $iom$Muovi il puntatore per generare una scia di particelle luminose — compute GPU, turbolenza, nastri di link tra vicini, rotazione tonalità e bloom. Uno sketch VFX TSL che si sente.$iom$,
  $iom$Muovi il puntatore per generare una scia di particelle luminose — compute GPU, turbolenza, nastri di link tra vicini, rotazione tonalità e bloom. Uno sketch VFX TSL che si sente.

Si trova nella nostra [sezione Esperimenti](/#experiments) come **WebGPU TSL Linked Particles**. La cover mostra nastri di particelle collegate con bloom.

## Apri la demo live

**[→ Avvia TSL Linked Particles](/demos/webgpu-tsl-linked-particles/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Puntatore come pennello** — « prova subito » per clienti in call
- **Link tra vicini** — linguaggio rete / sinapsi / costellazione
- **Compute + TSL** — spawn, turbolenza e vita sulla GPU
- **Finitura bloom** — glow morbido premium su UI scure

Usi tipici: sfondi hero, momenti interattivi stand e sistemi visuali brand tech.

## Per principianti — cos’è, in parole semplici?

Disegni con la luce: le particelle appaiono sotto il cursore, derivano con turbolenza, e linee sottili collegano punti vicini — come una costellazione che ricorda il tuo gesto per un momento.

**Glossario rapido**

- **Nearest-neighbor links** — linee tra particelle vicine nello spazio
- **Turbulence** — campo di forza rumoroso che arriccia il moto delle particelle
- **Bloom** — glow post-process intorno ai pixel luminosi
- **TSL VFX** — effetti authorati con nodi Three.js Shading Language

## Provalo in circa 60 secondi

1. Apri la [demo TSL Linked Particles](/demos/webgpu-tsl-linked-particles/)
2. Muovi il puntatore sul canvas per disegnare scie
3. Pausa e osserva link e shift tonalità mentre le particelle svaniscono
4. Orbita se abilitato; nota bloom su cluster luminosi

## Requisiti e prestazioni

- **Browser:** WebGPU (Chrome/Edge consigliato)
- **GPU:** bloom + compute vogliono un po' di margine — chiudi tab pesanti se serve
- **Input:** mouse o trackpad; touch varia per device

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Cluster denso a sinistra — link magenta con accenti cyan](/assets/blog/webgpu-tsl-linked-particles/view-a.jpg?v=20260722a)

![Mesh più vicina — nodi bloomati e nastri vicini](/assets/blog/webgpu-tsl-linked-particles/view-b.jpg?v=20260722a)

Anche in questa build:

- Mappare puntatore su touch / bacchetta per installazioni
- Ricolorare ciclo tonalità verso palette brand
- Confronta [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles)

## Come funziona

Compute WebGPU spawna e advecta particelle; materiali TSL renderizzano sprite/nastri; un pass link collega particelle vicine; bloom post-processa il frame. Upstream: [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles) ([sorgente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_vfx_linkedparticles.html)). Reti linee WebGL (vedi draw-range) sono idea visiva correlata con pipeline diversa più supportata.

## FAQ

**È uguale alla demo shape particles?**  
No — quella forma preset solidi e gravità. Questa è VFX disegnato col puntatore con link e bloom.

**Possiamo rallentarlo per un film brand calmo?**  
Sì — spawn rate, turbolenza e soglie bloom sono manopole tipiche.

## Stack tecnico e letture

- [three.js — TSL linked particles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Correlati su IOM

Esplora di più in [Esperimenti](/#experiments), più [WebGPU Particles](/blog/webgpu-particles), [BufferGeometry Draw Range](/blog/buffergeometry-drawrange), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$WebGPU TSL Linked Particles — scie VFX disegnate — IOM$iom$,
  $iom$Muovi il puntatore per generare una scia di particelle luminose — compute GPU, turbolenza, nastri di link tra vicini, rotazione tonalità e bloom. Uno sketch VFX TSL che si sente.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-tsl-linked-particles$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$WebGPU TSL Linked Particles — estelas VFX dibujadas$iom$,
  $iom$Mueve el puntero para generar una estela de partículas luminosas — compute GPU, turbulencia, cintas de enlaces entre vecinos, rotación de tono y bloom. Un sketch VFX TSL que se sie$iom$,
  $iom$Mueve el puntero para generar una estela de partículas luminosas — compute GPU, turbulencia, cintas de enlaces entre vecinos, rotación de tono y bloom. Un sketch VFX TSL que se siente.

Está en nuestra [sección Experimentos](/#experiments) como **WebGPU TSL Linked Particles**. La portada muestra cintas de partículas enlazadas con bloom.

## Abrir la demo en vivo

**[→ Lanzar TSL Linked Particles](/demos/webgpu-tsl-linked-particles/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Puntero como pincel** — « pruébalo » instantáneo para clientes en llamada
- **Enlaces entre vecinos** — lenguaje red / sinapsis / constelación
- **Compute + TSL** — spawn, turbulencia y vida en la GPU
- **Acabado bloom** — glow suave premium en UI oscuras

Usos típicos: fondos hero, momentos interactivos en stand y sistemas visuales de marca tech.

## Para principiantes — ¿qué es esto, en palabras simples?

Dibujas con luz: partículas aparecen bajo el cursor, derivan con turbulencia, y líneas finas conectan puntos cercanos — como una constelación que recuerda tu gesto un momento.

**Glosario rápido**

- **Nearest-neighbor links** — líneas dibujadas entre partículas cercanas en el espacio
- **Turbulence** — campo de fuerza ruidoso que arremolina el movimiento de partículas
- **Bloom** — glow post-process alrededor de píxeles brillantes
- **TSL VFX** — efectos authorados con nodos Three.js Shading Language

## Pruébalo en unos 60 segundos

1. Abre la [demo TSL Linked Particles](/demos/webgpu-tsl-linked-particles/)
2. Mueve el puntero por el canvas para dibujar estelas
3. Pausa y observa enlaces y cambio de tono mientras las partículas mueren
4. Orbita si está activo; nota bloom en clusters brillantes

## Requisitos y rendimiento

- **Navegador:** WebGPU (Chrome/Edge recomendado)
- **GPU:** bloom + compute quieren algo de margen — cierra pestañas pesadas si hace falta
- **Input:** ratón o trackpad; touch varía por dispositivo

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Cluster denso a la izquierda — enlaces magenta con acentos cyan](/assets/blog/webgpu-tsl-linked-particles/view-a.jpg?v=20260722a)

![Malla más cercana — nodos con bloom y cintas vecinas](/assets/blog/webgpu-tsl-linked-particles/view-b.jpg?v=20260722a)

También en este build:

- Mapear puntero a touch / varita para instalaciones
- Recolorear ciclo de tono hacia paleta de marca
- Comparar [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles)

## Cómo funciona

Compute WebGPU spawna y advecta partículas; materiales TSL renderizan sprites/cintas; un pass de enlaces conecta partículas cercanas; bloom post-procesa el frame. Upstream: [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles) ([fuente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_vfx_linkedparticles.html)). Redes de líneas WebGL (ver draw-range) son idea visual relacionada con pipeline distinta más ampliamente soportada.

## FAQ

**¿Es lo mismo que la demo shape particles?**  
No — esa forma presets sólidos y gravedad. Esta es VFX dibujado con puntero, enlaces y bloom.

**¿Podemos ralentizarlo para un film de marca calmado?**  
Sí — spawn rate, turbulencia y umbrales bloom son perillas típicas.

## Stack técnico y lecturas

- [three.js — TSL linked particles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Relacionado en IOM

Explora más en [Experimentos](/#experiments), más [WebGPU Particles](/blog/webgpu-particles), [BufferGeometry Draw Range](/blog/buffergeometry-drawrange), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$WebGPU TSL Linked Particles — estelas VFX dibujadas — IOM$iom$,
  $iom$Mueve el puntero para generar una estela de partículas luminosas — compute GPU, turbulencia, cintas de enlaces entre vecinos, rotación de tono y bloom. Un sketch VFX TSL que se sie$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-tsl-linked-particles$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$WebGPU Custom Fog Scattering — walk the haze$iom$,
  $iom$A first-person stroll through procedural pine silhouettes in cool exponential fog — TSL density-based scattering blur that softens the distance like moist air.$iom$,
  $iom$A first-person stroll through procedural pine silhouettes in cool exponential fog — TSL density-based scattering blur that softens the distance like moist air.

It lives in our [Experiments section](/#experiments) as **WebGPU Custom Fog Scattering**. The cover shows pine shapes dissolving into scattered fog.

## Open the live demo

**[→ Launch Custom Fog Scattering](/demos/webgpu-custom-fog-scattering/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Atmosphere as the subject** — mood first, geometry second
- **Scattering blur** — distance softens the way humid air does
- **Tunable density** — fog and scatter as design dials
- **WebGPU + TSL** — custom fog beyond a single scene.fog color

Typical uses: environment pitches, game-like walkthroughs, and “weather as brand” studies.

## For beginners — what is this, in plain words?

Fog is not only a grey tint. In moist air, far trees look softer and milkier. This demo walks you through that feeling — silhouettes of pines fading into a cool haze you can thicken or thin.

**Quick glossary**

- **Exponential fog** — fog that thickens smoothly with distance
- **Scattering** — light bouncing in the medium — here approximated as a blur/softening
- **First-person** — camera moves as if you are walking the scene
- **TSL** — node shading used to customize fog behavior on WebGPU

## Try this in about 60 seconds

1. Open the [Custom Fog Scattering demo](/demos/webgpu-custom-fog-scattering/)
2. Walk or look around the pine field
3. Raise fog density — watch distance collapse into haze
4. Tune scattering factor and compare crisp vs soft far trees

## Requirements and performance

- **Browser:** WebGPU-capable Chrome or Edge
- **Controls:** keyboard / pointer as implemented in the demo UI
- **GPU:** comfortable on modern laptops; lower resolution if motion blurs

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Walk deeper — denser trunks as the haze closes in](/assets/blog/webgpu-custom-fog-scattering/view-a.jpg?v=20260722a)

![Close trunk — scattering softens the forest behind](/assets/blog/webgpu-custom-fog-scattering/view-b.jpg?v=20260722a)

Also in this build:

- Retint fog for dawn / night brand moods
- Swap silhouettes for architecture masses
- Read [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering)

## How it works

Procedural tree-like silhouettes sit in a WebGPU scene; TSL implements density-aware fog and a scattering blur so distant structure softens. Upstream: [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_custom_fog_scattering.html)). Standard WebGL `FogExp2` is simpler; this experiment shows a custom scattering treatment on the WebGPU stack.

## FAQ

**Is this volumetric lighting?**  
Related mood, different technique — here the focus is fog/scattering through a walkable forest, not rect-area god rays.

**Can we use a real site model?**  
Yes as a scoped integration — replace silhouettes with simplified architecture LODs.

## Tech stack and further reading

- [three.js — custom fog scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Related on IOM

Browse more in [Experiments](/#experiments), plus [WebGPU Spotlight](/blog/webgpu-spotlight), [Volumetric Lighting](/blog/volume-lighting), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$WebGPU Custom Fog Scattering — walk the haze — IOM$iom$,
  $iom$A first-person stroll through procedural pine silhouettes in cool exponential fog — TSL density-based scattering blur that softens the distance like moist air.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-custom-fog-scattering$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$WebGPU Custom Fog Scattering — durch den Dunst gehen$iom$,
  $iom$Ein Spaziergang in Ego-Perspektive durch prozedurale Kiefernsilhouetten in kühlem exponentiellem Nebel — TSL-dichtebasiertes Streuungs-Blur, das die Ferne wie feuchte Luft weichzei$iom$,
  $iom$Ein Spaziergang in Ego-Perspektive durch prozedurale Kiefernsilhouetten in kühlem exponentiellem Nebel — TSL-dichtebasiertes Streuungs-Blur, das die Ferne wie feuchte Luft weichzeichnet.

Es liegt in unserem [Experimente-Bereich](/#experiments) als **WebGPU Custom Fog Scattering**. Das Cover zeigt Kiefernformen, die im gestreuten Nebel auflösen.

## Live-Demo öffnen

**[→ Custom Fog Scattering starten](/demos/webgpu-custom-fog-scattering/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Atmosphäre als Subjekt** — Stimmung zuerst, Geometrie zweitens
- **Streuungs-Blur** — Ferne wird weicher wie feuchte Luft
- **Einstellbare Dichte** — Nebel und Streuung als Designregler
- **WebGPU + TSL** — individueller Nebel jenseits einer einzelnen scene.fog-Farbe

Typische Einsätze: Umgebungs-Pitches, spielartige Walkthroughs und „Wetter als Marke“-Studien.

## Für Einsteiger — was ist das, in einfachen Worten?

Nebel ist nicht nur ein grauer Farbton. In feuchter Luft wirken entfernte Bäume weicher und milchiger. Diese Demo führt Sie durch dieses Gefühl — Silhouetten von Kiefern, die in einen kühlen Dunst übergehen, den Sie verdicken oder verdünnen können.

**Kurzes Glossar**

- **Exponential fog** — Nebel, der mit der Entfernung gleichmäßig zunimmt
- **Scattering** — Lichtstreuung im Medium — hier als Blur/Weichzeichnung approximiert
- **First-person** — Kamera bewegt sich, als würden Sie durch die Szene gehen
- **TSL** — Node-Shading zur Anpassung des Nebelverhaltens auf WebGPU

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [Custom Fog Scattering Demo](/demos/webgpu-custom-fog-scattering/)
2. Gehen oder schauen Sie sich im Kiefernfeld um
3. Erhöhen Sie die Nebeldichte — beobachten Sie, wie die Ferne im Dunst verschwindet
4. Streuungsfaktor einstellen und scharfe vs. weiche ferne Bäume vergleichen

## Anforderungen und Performance

- **Browser:** WebGPU-fähiger Chrome oder Edge
- **Steuerung:** Tastatur / Zeiger wie in der Demo-UI implementiert
- **GPU:** komfortabel auf modernen Laptops; Auflösung senken bei Motion Blur

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Tiefer gehen — dichtere Stämme, während der Dunst zunimmt](/assets/blog/webgpu-custom-fog-scattering/view-a.jpg?v=20260722a)

![Nah am Stamm — Streuung weichzeichnet den Wald dahinter](/assets/blog/webgpu-custom-fog-scattering/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Nebel für Morgen-/Nacht-Markenstimmungen umfärben
- Silhouetten gegen Architekturmassen tauschen
- [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering) lesen

## So funktioniert es

Prozedurale baumähnliche Silhouetten sitzen in einer WebGPU-Szene; TSL implementiert dichteabhängigen Nebel und ein Streuungs-Blur, damit entfernte Struktur weicher wird. Upstream: [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering) ([Quelle](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_custom_fog_scattering.html)). Standard-WebGL `FogExp2` ist einfacher; dieses Experiment zeigt eine individuelle Streuungsbehandlung auf dem WebGPU-Stack.

## FAQ

**Ist das volumetrische Beleuchtung?**  
Verwandte Stimmung, andere Technik — hier liegt der Fokus auf Nebel/Streuung durch einen begehbaren Wald, nicht auf rect-area God Rays.

**Können wir ein echtes Standortmodell nutzen?**  
Ja als scoped Integration — Silhouetten durch vereinfachte Architektur-LODs ersetzen.

## Tech-Stack und weiterführende Links

- [three.js — custom fog scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Verwandt bei IOM

Mehr in [Experimente](/#experiments), plus [WebGPU Spotlight](/blog/webgpu-spotlight), [Volumetric Lighting](/blog/volume-lighting), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$WebGPU Custom Fog Scattering — durch den Dunst gehen — IOM$iom$,
  $iom$Ein Spaziergang in Ego-Perspektive durch prozedurale Kiefernsilhouetten in kühlem exponentiellem Nebel — TSL-dichtebasiertes Streuungs-Blur, das die Ferne wie feuchte Luft weichzei$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-custom-fog-scattering$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$WebGPU Custom Fog Scattering — marcher dans la brume$iom$,
  $iom$Une promenade à la première personne parmi des silhouettes de pins procédurales dans un brouillard exponentiel frais — blur de diffusion TSL basé sur la densité qui adoucit la dist$iom$,
  $iom$Une promenade à la première personne parmi des silhouettes de pins procédurales dans un brouillard exponentiel frais — blur de diffusion TSL basé sur la densité qui adoucit la distance comme l'air humide.

Il se trouve dans notre [section Expériences](/#experiments) sous **WebGPU Custom Fog Scattering**. La couverture montre des formes de pins se dissolvant dans le brouillard diffus.

## Ouvrir la démo en direct

**[→ Lancer Custom Fog Scattering](/demos/webgpu-custom-fog-scattering/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Atmosphère comme sujet** — ambiance d'abord, géométrie ensuite
- **Blur de diffusion** — la distance s'adoucit comme l'air humide
- **Densité réglable** — brouillard et diffusion comme curseurs de design
- **WebGPU + TSL** — brouillard custom au-delà d'une seule couleur scene.fog

Usages typiques : pitches environnement, walkthroughs type jeu et études « météo comme marque ».

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Le brouillard n'est pas qu'une teinte grise. Dans l'air humide, les arbres lointains paraissent plus doux et laiteux. Cette démo vous fait vivre cette sensation — silhouettes de pins s'effaçant dans une brume fraîche que vous pouvez épaissir ou clarifier.

**Glossaire rapide**

- **Exponential fog** — brouillard qui s'épaissit progressivement avec la distance
- **Scattering** — rebond de lumière dans le milieu — ici approximé par blur/adoucissement
- **First-person** — caméra se déplace comme si vous marchiez dans la scène
- **TSL** — shading nœuds pour personnaliser le brouillard sur WebGPU

## Essayez en environ 60 secondes

1. Ouvrir la [démo Custom Fog Scattering](/demos/webgpu-custom-fog-scattering/)
2. Marcher ou regarder autour du champ de pins
3. Augmenter la densité du brouillard — voir la distance se fondre dans la brume
4. Ajuster le facteur de diffusion et comparer pins lointains nets vs doux

## Prérequis et performances

- **Navigateur :** Chrome ou Edge compatible WebGPU
- **Contrôles :** clavier / pointeur comme implémenté dans l'UI démo
- **GPU :** confortable sur laptops modernes ; baisser résolution si flou de mouvement

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Avancer — troncs plus denses alors que la brume se referme](/assets/blog/webgpu-custom-fog-scattering/view-a.jpg?v=20260722a)

![Tronc proche — diffusion adoucit la forêt derrière](/assets/blog/webgpu-custom-fog-scattering/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Retinter le brouillard pour ambiances marque aube / nuit
- Remplacer silhouettes par masses architecturales
- Lire [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering)

## Comment ça marche

Silhouettes procédurales type arbre dans une scène WebGPU ; TSL implémente brouillard sensible à la densité et blur de diffusion pour adoucir la structure lointaine. Upstream : [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_custom_fog_scattering.html)). WebGL `FogExp2` standard est plus simple ; cette expérience montre un traitement diffusion custom sur la stack WebGPU.

## FAQ

**Est-ce de l'éclairage volumétrique ?**  
Ambiance proche, technique différente — ici focus brouillard/diffusion dans une forêt traversable, pas god rays rect-area.

**Peut-on utiliser un vrai modèle de site ?**  
Oui en intégration ciblée — remplacer silhouettes par LODs architecture simplifiés.

## Stack technique et lectures

- [three.js — custom fog scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Sur IOM

Parcourez [Expériences](/#experiments), plus [WebGPU Spotlight](/blog/webgpu-spotlight), [Volumetric Lighting](/blog/volume-lighting), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$WebGPU Custom Fog Scattering — marcher dans la brume — IOM$iom$,
  $iom$Une promenade à la première personne parmi des silhouettes de pins procédurales dans un brouillard exponentiel frais — blur de diffusion TSL basé sur la densité qui adoucit la dist$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-custom-fog-scattering$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$WebGPU Custom Fog Scattering — door de nevel lopen$iom$,
  $iom$Een first-person wandeling door procedurele dennensilhouetten in koele exponentiële mist — TSL dichtheidsgebaseerde scattering blur die de afstand zacht maakt als vochtige lucht.$iom$,
  $iom$Een first-person wandeling door procedurele dennensilhouetten in koele exponentiële mist — TSL dichtheidsgebaseerde scattering blur die de afstand zacht maakt als vochtige lucht.

Het staat in onze [Experimenten-sectie](/#experiments) als **WebGPU Custom Fog Scattering**. De cover toont dennenvormen die oplossen in verspreide mist.

## Open de live demo

**[→ Start Custom Fog Scattering](/demos/webgpu-custom-fog-scattering/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Atmosfeer als onderwerp** — sfeer eerst, geometrie daarna
- **Scattering blur** — afstand wordt zachter zoals vochtige lucht
- **Instelbare dichtheid** — mist en scattering als design-dials
- **WebGPU + TSL** — custom mist voorbij een enkele scene.fog-kleur

Typische toepassingen: omgevingspitches, game-achtige walkthroughs en „weer als merk“-studies.

## Voor beginners — wat is dit, in gewone taal?

Mist is niet alleen een grijze tint. In vochtige lucht lijken verre bomen zachter en melkachtiger. Deze demo laat je die sensatie ervaren — silhouetten van dennen die vervagen in een koele nevel die je kunt verdikken of verdunnen.

**Korte glossary**

- **Exponential fog** — mist die geleidelijk dikker wordt met afstand
- **Scattering** — licht dat terugkaatst in het medium — hier benaderd als blur/verzachting
- **First-person** — camera beweegt alsof je door de scène loopt
- **TSL** — node shading om mistgedrag op WebGPU aan te passen

## Probeer dit in ongeveer 60 seconden

1. Open de [Custom Fog Scattering-demo](/demos/webgpu-custom-fog-scattering/)
2. Loop of kijk rond in het dennenveld
3. Verhoog mistdichtheid — zie afstand instorten in nevel
4. Tune scattering factor en vergelijk scherpe vs. zachte verre bomen

## Vereisten en performance

- **Browser:** WebGPU-capabele Chrome of Edge
- **Besturing:** toetsenbord / pointer zoals geïmplementeerd in demo-UI
- **GPU:** comfortabel op moderne laptops; verlaag resolutie bij motion blur

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Dieper lopen — dichtere stammen terwijl de nevel sluit](/assets/blog/webgpu-custom-fog-scattering/view-a.jpg?v=20260722a)

![Dichte stam — scattering verzacht het bos erachter](/assets/blog/webgpu-custom-fog-scattering/view-b.jpg?v=20260722a)

Ook in deze build:

- Mist retinten voor dageraad / nacht merksferen
- Silhouetten wisselen voor architectuurmassa's
- Lees [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering)

## Hoe het werkt

Procedurele boomachtige silhouetten in een WebGPU-scène; TSL implementeert dichtheidsbewuste mist en scattering blur zodat verre structuur zachter wordt. Upstream: [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering) ([bron](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_custom_fog_scattering.html)). Standaard WebGL `FogExp2` is eenvoudiger; dit experiment toont een custom scattering-behandeling op de WebGPU-stack.

## FAQ

**Is dit volumetrische belichting?**  
Verwante sfeer, andere techniek — hier focus op mist/scattering door een beloopbaar bos, geen rect-area god rays.

**Kunnen we een echt sitemodel gebruiken?**  
Ja als scoped integratie — vervang silhouetten door vereenvoudigde architectuur-LODs.

## Tech stack en verder lezen

- [three.js — custom fog scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Gerelateerd op IOM

Bekijk meer in [Experimenten](/#experiments), plus [WebGPU Spotlight](/blog/webgpu-spotlight), [Volumetric Lighting](/blog/volume-lighting), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$WebGPU Custom Fog Scattering — door de nevel lopen — IOM$iom$,
  $iom$Een first-person wandeling door procedurele dennensilhouetten in koele exponentiële mist — TSL dichtheidsgebaseerde scattering blur die de afstand zacht maakt als vochtige lucht.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-custom-fog-scattering$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$WebGPU Custom Fog Scattering — camminare nella foschia$iom$,
  $iom$Una passeggiata in prima persona tra silhouette di pini procedurali in nebbia esponenziale fresca — blur di scattering TSL basato sulla densità che ammorbidisce la distanza come ar$iom$,
  $iom$Una passeggiata in prima persona tra silhouette di pini procedurali in nebbia esponenziale fresca — blur di scattering TSL basato sulla densità che ammorbidisce la distanza come aria umida.

Si trova nella nostra [sezione Esperimenti](/#experiments) come **WebGPU Custom Fog Scattering**. La cover mostra forme di pino che si dissolvono nella nebbia diffusa.

## Apri la demo live

**[→ Avvia Custom Fog Scattering](/demos/webgpu-custom-fog-scattering/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Atmosfera come soggetto** — mood prima, geometria dopo
- **Blur di scattering** — la distanza si ammorbidisce come aria umida
- **Densità regolabile** — nebbia e scattering come dial di design
- **WebGPU + TSL** — nebbia custom oltre un singolo colore scene.fog

Usi tipici: pitch ambientali, walkthrough tipo gioco e studi « meteo come brand ».

## Per principianti — cos’è, in parole semplici?

La nebbia non è solo una tinta grigia. Nell'aria umida gli alberi lontani sembrano più morbidi e lattei. Questa demo ti fa vivere quella sensazione — silhouette di pini che svaniscono in una foschia fresca che puoi addensare o diradare.

**Glossario rapido**

- **Exponential fog** — nebbia che si addensa gradualmente con la distanza
- **Scattering** — luce che rimbalza nel mezzo — qui approssimata come blur/ammorbidimento
- **First-person** — camera si muove come se camminassi nella scena
- **TSL** — node shading per personalizzare il comportamento nebbia su WebGPU

## Provalo in circa 60 secondi

1. Apri la [demo Custom Fog Scattering](/demos/webgpu-custom-fog-scattering/)
2. Cammina o guardati intorno nel campo di pini
3. Alza densità nebbia — osserva la distanza collassare nella foschia
4. Regola fattore scattering e confronta pini lontani nitidi vs. morbidi

## Requisiti e prestazioni

- **Browser:** Chrome o Edge compatibile WebGPU
- **Controlli:** tastiera / puntatore come implementato nell'UI demo
- **GPU:** comodo su laptop moderni; abbassa risoluzione se motion blur

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Cammina più in profondità — tronchi più densi mentre la foschia chiude](/assets/blog/webgpu-custom-fog-scattering/view-a.jpg?v=20260722a)

![Tronco vicino — scattering ammorbidisce la foresta dietro](/assets/blog/webgpu-custom-fog-scattering/view-b.jpg?v=20260722a)

Anche in questa build:

- Retintare nebbia per mood brand alba / notte
- Scambiare silhouette con masse architettoniche
- Leggi [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering)

## Come funziona

Silhouette procedurali simili ad alberi in una scena WebGPU; TSL implementa nebbia consapevole della densità e blur scattering così la struttura lontana si ammorbidisce. Upstream: [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering) ([sorgente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_custom_fog_scattering.html)). WebGL `FogExp2` standard è più semplice; questo esperimento mostra trattamento scattering custom sulla stack WebGPU.

## FAQ

**È illuminazione volumetrica?**  
Mood correlato, tecnica diversa — qui focus nebbia/scattering in un bosco percorribile, non god rays rect-area.

**Possiamo usare un modello sito reale?**  
Sì come integrazione scoped — sostituire silhouette con LOD architettura semplificati.

## Stack tecnico e letture

- [three.js — custom fog scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Correlati su IOM

Esplora di più in [Esperimenti](/#experiments), più [WebGPU Spotlight](/blog/webgpu-spotlight), [Volumetric Lighting](/blog/volume-lighting), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$WebGPU Custom Fog Scattering — camminare nella foschia — IOM$iom$,
  $iom$Una passeggiata in prima persona tra silhouette di pini procedurali in nebbia esponenziale fresca — blur di scattering TSL basato sulla densità che ammorbidisce la distanza come ar$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-custom-fog-scattering$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$WebGPU Custom Fog Scattering — caminar en la bruma$iom$,
  $iom$Un paseo en primera persona entre siluetas de pinos procedurales en niebla exponencial fresca — blur de scattering TSL basado en densidad que suaviza la distancia como aire húmedo.$iom$,
  $iom$Un paseo en primera persona entre siluetas de pinos procedurales en niebla exponencial fresca — blur de scattering TSL basado en densidad que suaviza la distancia como aire húmedo.

Está en nuestra [sección Experimentos](/#experiments) como **WebGPU Custom Fog Scattering**. La portada muestra formas de pino disolviéndose en niebla dispersa.

## Abrir la demo en vivo

**[→ Lanzar Custom Fog Scattering](/demos/webgpu-custom-fog-scattering/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Atmósfera como sujeto** — mood primero, geometría después
- **Blur de scattering** — la distancia se suaviza como aire húmedo
- **Densidad ajustable** — niebla y scattering como diales de diseño
- **WebGPU + TSL** — niebla custom más allá de un solo color scene.fog

Usos típicos: pitches de entorno, walkthroughs tipo juego y estudios « clima como marca ».

## Para principiantes — ¿qué es esto, en palabras simples?

La niebla no es solo un tinte gris. En aire húmedo, los árboles lejanos se ven más suaves y lechosos. Esta demo te lleva por esa sensación — siluetas de pinos desvaneciéndose en bruma fresca que puedes espesar o aclarar.

**Glosario rápido**

- **Exponential fog** — niebla que se espesa gradualmente con la distancia
- **Scattering** — luz rebotando en el medio — aquí aproximada como blur/suavizado
- **First-person** — cámara se mueve como si caminaras la escena
- **TSL** — node shading para personalizar comportamiento de niebla en WebGPU

## Pruébalo en unos 60 segundos

1. Abre la [demo Custom Fog Scattering](/demos/webgpu-custom-fog-scattering/)
2. Camina o mira alrededor del campo de pinos
3. Sube densidad de niebla — observa la distancia colapsar en bruma
4. Ajusta factor de scattering y compara pinos lejanos nítidos vs. suaves

## Requisitos y rendimiento

- **Navegador:** Chrome o Edge compatible WebGPU
- **Controles:** teclado / puntero como implementado en la UI demo
- **GPU:** cómodo en laptops modernas; baja resolución si hay motion blur

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Camina más hondo — troncos más densos mientras la bruma cierra](/assets/blog/webgpu-custom-fog-scattering/view-a.jpg?v=20260722a)

![Tronco cercano — scattering suaviza el bosque detrás](/assets/blog/webgpu-custom-fog-scattering/view-b.jpg?v=20260722a)

También en este build:

- Retintar niebla para moods de marca amanecer / noche
- Cambiar siluetas por masas arquitectónicas
- Lee [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering)

## Cómo funciona

Siluetas procedurales tipo árbol en escena WebGPU; TSL implementa niebla consciente de densidad y blur scattering para suavizar estructura lejana. Upstream: [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering) ([fuente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_custom_fog_scattering.html)). WebGL `FogExp2` estándar es más simple; este experimento muestra tratamiento scattering custom en la stack WebGPU.

## FAQ

**¿Es iluminación volumétrica?**  
Mood relacionado, técnica distinta — aquí foco niebla/scattering en bosque transitable, no god rays rect-area.

**¿Podemos usar un modelo de sitio real?**  
Sí como integración acotada — reemplazar siluetas con LODs arquitectura simplificados.

## Stack técnico y lecturas

- [three.js — custom fog scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/)

## Relacionado en IOM

Explora más en [Experimentos](/#experiments), más [WebGPU Spotlight](/blog/webgpu-spotlight), [Volumetric Lighting](/blog/volume-lighting), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$WebGPU Custom Fog Scattering — caminar en la bruma — IOM$iom$,
  $iom$Un paseo en primera persona entre siluetas de pinos procedurales en niebla exponencial fresca — blur de scattering TSL basado en densidad que suaviza la distancia como aire húmedo.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-custom-fog-scattering$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$WebGPU Curve Modifier — text along a spline$iom$,
  $iom$Extruded text that flows along a closed Catmull-Rom spline — drag control handles and the mesh deforms with the path. A WebGPU take on curve modifiers for logos and type.$iom$,
  $iom$Extruded text that flows along a closed Catmull-Rom spline — drag control handles and the mesh deforms with the path. A WebGPU take on curve modifiers for logos and type.

It lives in our [Experiments section](/#experiments) as **WebGPU Curve Modifier**. The cover shows letterforms bent along the editable curve.

## Open the live demo

**[→ Launch WebGPU Curve Modifier](/demos/webgpu-modifier-curve/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Type as geometry** — logos and headlines that live on a path
- **Live handles** — reshape the story in front of a client
- **Closed spline** — loops for endless booth motion
- **Pairs with path tools** — same family as spline editors and camera rails

Typical uses: animated logos, exhibition titles, and path-driven product callouts.

## For beginners — what is this, in plain words?

Imagine flexible fridge-magnet letters stuck along a bent wire. Move the wire’s control points and the letters slide and bend to match. That is a curve modifier — here running in the browser on WebGPU.

**Quick glossary**

- **Catmull-Rom spline** — a smooth curve that passes through control points
- **Curve modifier** — deforms a mesh so it follows a path
- **Extruded text** — 3D letter geometry built from a font outline
- **Control handle** — draggable point that reshapes the spline

## Try this in about 60 seconds

1. Open the [WebGPU Curve Modifier demo](/demos/webgpu-modifier-curve/)
2. Click a control handle to select it
3. Drag to reshape the closed path — watch the text flow
4. Orbit to check letter thickness and silhouette

## Requirements and performance

- **Browser:** WebGPU (Chrome/Edge recommended)
- **Input:** mouse for handle picking and dragging
- **GPU:** modest — heavier fonts / finer extrusion raise cost

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Full loop — extruded text following the closed spline](/assets/blog/webgpu-modifier-curve/view-a.jpg?v=20260722a)

![Handle edit — local bend of letterforms on the path](/assets/blog/webgpu-modifier-curve/view-b.jpg?v=20260722a)

Also in this build:

- Swap the string for a brand wordmark
- Export path ideas into camera-rail workflows
- Compare [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve)

## How it works

A closed Catmull-Rom curve defines the path; a modifier samples the curve to transform extruded text geometry each update. WebGPURenderer draws the result. Upstream: [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_modifier_curve.html)). For pure path editing without the modifier, see the WebGL [spline editor](https://threejs.org/examples/#webgl_geometry_spline_editor) — complementary tools.

## FAQ

**Can we use our font?**  
Usually yes with a licensed font that can be meshed for the web — we handle conversion in production builds.

**WebGPU required?**  
For this demo page, yes. Curve ideas can also ship on WebGL depending on the project.

## Tech stack and further reading

- [three.js — curve modifier](https://threejs.org/examples/#webgpu_modifier_curve)
- [three.js — spline editor](https://threejs.org/examples/#webgl_geometry_spline_editor)
- [Three.js](https://threejs.org/)

## Related on IOM

Browse more in [Experiments](/#experiments), plus [Catmull Spline Editor](/blog/spline-editor), [Shape Particles](/blog/compute-particles), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$WebGPU Curve Modifier — text along a spline — IOM$iom$,
  $iom$Extruded text that flows along a closed Catmull-Rom spline — drag control handles and the mesh deforms with the path. A WebGPU take on curve modifiers for logos and type.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-modifier-curve$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$WebGPU Curve Modifier — Text entlang einer Spline$iom$,
  $iom$Extrudierter Text, der entlang einer geschlossenen Catmull-Rom-Spline fließt — ziehen Sie Kontrollpunkte und das Mesh deformiert mit dem Pfad. Ein WebGPU-Ansatz für Kurvenmodifikat$iom$,
  $iom$Extrudierter Text, der entlang einer geschlossenen Catmull-Rom-Spline fließt — ziehen Sie Kontrollpunkte und das Mesh deformiert mit dem Pfad. Ein WebGPU-Ansatz für Kurvenmodifikatoren bei Logos und Typografie.

Es liegt in unserem [Experimente-Bereich](/#experiments) als **WebGPU Curve Modifier**. Das Cover zeigt Buchformen, die entlang der editierbaren Kurve gebogen sind.

## Live-Demo öffnen

**[→ WebGPU Curve Modifier starten](/demos/webgpu-modifier-curve/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Typografie als Geometrie** — Logos und Headlines, die auf einem Pfad leben
- **Live-Handles** — die Story vor dem Kunden umformen
- **Geschlossene Spline** — Loops für endlose Messe-Bewegung
- **Passt zu Pfad-Tools** — dieselbe Familie wie Spline-Editoren und Kamera-Rails

Typische Einsätze: animierte Logos, Ausstellungstitel und pfadgeführte Produkt-Callouts.

## Für Einsteiger — was ist das, in einfachen Worten?

Stellen Sie sich flexible Kühlschrankmagnet-Buchstaben entlang eines gebogenen Drahts vor. Bewegen Sie die Kontrollpunkte des Drahts und die Buchstaben gleiten und biegen sich mit. Das ist ein Kurvenmodifikator — hier im Browser auf WebGPU.

**Kurzes Glossar**

- **Catmull-Rom spline** — eine glatte Kurve, die durch Kontrollpunkte verläuft
- **Curve modifier** — deformiert ein Mesh, damit es einem Pfad folgt
- **Extruded text** — 3D-Buchstaben-Geometrie aus einer Font-Kontur
- **Control handle** — ziehbarer Punkt, der die Spline umformt

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [WebGPU Curve Modifier Demo](/demos/webgpu-modifier-curve/)
2. Klicken Sie einen Kontrollpunkt zur Auswahl
3. Ziehen, um den geschlossenen Pfad umzuformen — beobachten Sie den Textfluss
4. Orbitieren, um Buchstabenstärke und Silhouette zu prüfen

## Anforderungen und Performance

- **Browser:** WebGPU (Chrome/Edge empfohlen)
- **Input:** Maus für Handle-Auswahl und -Ziehen
- **GPU:** bescheiden — schwerere Fonts / feinere Extrusion erhöhen Kosten

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Volle Schleife — extrudierter Text folgt der geschlossenen Spline](/assets/blog/webgpu-modifier-curve/view-a.jpg?v=20260722a)

![Handle-Edit — lokale Biegung der Buchformen auf dem Pfad](/assets/blog/webgpu-modifier-curve/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Den String gegen ein Marken-Wortzeichen tauschen
- Pfadideen in Kamera-Rail-Workflows exportieren
- [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve) vergleichen

## So funktioniert es

Eine geschlossene Catmull-Rom-Kurve definiert den Pfad; ein Modifikator sampelt die Kurve, um extrudierte Textgeometrie bei jedem Update zu transformieren. WebGPURenderer zeichnet das Ergebnis. Upstream: [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve) ([Quelle](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_modifier_curve.html)). Für reines Pfad-Editing ohne Modifikator siehe den WebGL [spline editor](https://threejs.org/examples/#webgl_geometry_spline_editor) — komplementäre Tools.

## FAQ

**Können wir unsere Schrift nutzen?**  
In der Regel ja mit einer lizenzierten Schrift, die fürs Web gemesht werden kann — wir übernehmen die Konvertierung in Production Builds.

**WebGPU erforderlich?**  
Für diese Demo-Seite ja. Kurvenideen können je nach Projekt auch auf WebGL ausgeliefert werden.

## Tech-Stack und weiterführende Links

- [three.js — curve modifier](https://threejs.org/examples/#webgpu_modifier_curve)
- [three.js — spline editor](https://threejs.org/examples/#webgl_geometry_spline_editor)
- [Three.js](https://threejs.org/)

## Verwandt bei IOM

Mehr in [Experimente](/#experiments), plus [Catmull Spline Editor](/blog/spline-editor), [Shape Particles](/blog/compute-particles), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$WebGPU Curve Modifier — Text entlang einer Spline — IOM$iom$,
  $iom$Extrudierter Text, der entlang einer geschlossenen Catmull-Rom-Spline fließt — ziehen Sie Kontrollpunkte und das Mesh deformiert mit dem Pfad. Ein WebGPU-Ansatz für Kurvenmodifikat$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-modifier-curve$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$WebGPU Curve Modifier — texte le long d'une spline$iom$,
  $iom$Texte extrudé qui coule le long d'une spline Catmull-Rom fermée — tirez les poignées de contrôle et le mesh se déforme avec le chemin. Une approche WebGPU des modificateurs de cour$iom$,
  $iom$Texte extrudé qui coule le long d'une spline Catmull-Rom fermée — tirez les poignées de contrôle et le mesh se déforme avec le chemin. Une approche WebGPU des modificateurs de courbe pour logos et typo.

Il se trouve dans notre [section Expériences](/#experiments) sous **WebGPU Curve Modifier**. La couverture montre des lettres courbées le long de la courbe éditable.

## Ouvrir la démo en direct

**[→ Lancer WebGPU Curve Modifier](/demos/webgpu-modifier-curve/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Typo comme géométrie** — logos et titres qui vivent sur un chemin
- **Poignées live** — remodeler l'histoire devant le client
- **Spline fermée** — boucles pour mouvement stand infini
- **S'accorde aux outils de chemin** — même famille qu'éditeurs spline et rails caméra

Usages typiques : logos animés, titres d'exposition et callouts produit pilotés par chemin.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Imaginez des lettres magnétiques flexibles collées le long d'un fil courbé. Déplacez les points de contrôle du fil et les lettres glissent et se plient en conséquence. C'est un modificateur de courbe — ici dans le navigateur sur WebGPU.

**Glossaire rapide**

- **Catmull-Rom spline** — courbe lisse passant par les points de contrôle
- **Curve modifier** — déforme un mesh pour suivre un chemin
- **Extruded text** — géométrie de lettres 3D construite depuis un contour de police
- **Control handle** — point draggable qui remodèle la spline

## Essayez en environ 60 secondes

1. Ouvrir la [démo WebGPU Curve Modifier](/demos/webgpu-modifier-curve/)
2. Cliquer une poignée de contrôle pour la sélectionner
3. Tirer pour remodeler le chemin fermé — observer le flux du texte
4. Orbiter pour vérifier épaisseur et silhouette des lettres

## Prérequis et performances

- **Navigateur :** WebGPU (Chrome/Edge recommandé)
- **Entrée :** souris pour sélection et drag des poignées
- **GPU :** modeste — polices lourdes / extrusion fine augmentent le coût

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Boucle complète — texte extrudé suivant la spline fermée](/assets/blog/webgpu-modifier-curve/view-a.jpg?v=20260722a)

![Édition poignée — courbure locale des lettres sur le chemin](/assets/blog/webgpu-modifier-curve/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Remplacer la chaîne par un wordmark de marque
- Exporter idées de chemin vers workflows rails caméra
- Comparer [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve)

## Comment ça marche

Une courbe Catmull-Rom fermée définit le chemin ; un modificateur échantillonne la courbe pour transformer la géométrie texte extrudée à chaque update. WebGPURenderer dessine le résultat. Upstream : [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_modifier_curve.html)). Pour édition pure de chemin sans modificateur, voir l'[éditeur spline](https://threejs.org/examples/#webgl_geometry_spline_editor) WebGL — outils complémentaires.

## FAQ

**Peut-on utiliser notre police ?**  
En général oui avec une police licenciée meshable pour le web — nous gérons la conversion en builds production.

**WebGPU requis ?**  
Pour cette page démo, oui. Les idées de courbe peuvent aussi partir en WebGL selon le projet.

## Stack technique et lectures

- [three.js — curve modifier](https://threejs.org/examples/#webgpu_modifier_curve)
- [three.js — spline editor](https://threejs.org/examples/#webgl_geometry_spline_editor)
- [Three.js](https://threejs.org/)

## Sur IOM

Parcourez [Expériences](/#experiments), plus [Catmull Spline Editor](/blog/spline-editor), [Shape Particles](/blog/compute-particles), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$WebGPU Curve Modifier — texte le long d'une spline — IOM$iom$,
  $iom$Texte extrudé qui coule le long d'une spline Catmull-Rom fermée — tirez les poignées de contrôle et le mesh se déforme avec le chemin. Une approche WebGPU des modificateurs de cour$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-modifier-curve$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$WebGPU Curve Modifier — tekst langs een spline$iom$,
  $iom$Geëxtrudeerde tekst die langs een gesloten Catmull-Rom-spline stroomt — sleep controle-handles en het mesh deformeert met het pad. Een WebGPU-aanpak van curve modifiers voor logo's$iom$,
  $iom$Geëxtrudeerde tekst die langs een gesloten Catmull-Rom-spline stroomt — sleep controle-handles en het mesh deformeert met het pad. Een WebGPU-aanpak van curve modifiers voor logo's en type.

Het staat in onze [Experimenten-sectie](/#experiments) als **WebGPU Curve Modifier**. De cover toont lettervormen gebogen langs de bewerkbare curve.

## Open de live demo

**[→ Start WebGPU Curve Modifier](/demos/webgpu-modifier-curve/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Type als geometrie** — logo's en headlines die op een pad leven
- **Live handles** — het verhaal herformen voor een klant
- **Gesloten spline** — loops voor eindeloze beursbeweging
- **Past bij pad-tools** — zelfde familie als spline-editors en camera rails

Typische toepassingen: geanimeerde logo's, tentoonstellingstitels en pad-gedreven product callouts.

## Voor beginners — wat is dit, in gewone taal?

Stel je flexibele koelkastmagnet-letters langs een gebogen draad voor. Verplaats de controlepunten van de draad en de letters glijden en buigen mee. Dat is een curve modifier — hier in de browser op WebGPU.

**Korte glossary**

- **Catmull-Rom spline** — een gladde curve die door controlepunten loopt
- **Curve modifier** — deformeert een mesh zodat het een pad volgt
- **Extruded text** — 3D-lettergeometrie uit een font-outline
- **Control handle** — sleepbaar punt dat de spline herformt

## Probeer dit in ongeveer 60 seconden

1. Open de [WebGPU Curve Modifier-demo](/demos/webgpu-modifier-curve/)
2. Klik een controle-handle om te selecteren
3. Sleep om het gesloten pad te herformen — zie de tekst stromen
4. Orbit om letterdikte en silhouet te checken

## Vereisten en performance

- **Browser:** WebGPU (Chrome/Edge aanbevolen)
- **Input:** muis voor handle picking en slepen
- **GPU:** bescheiden — zwaardere fonts / fijnere extrusie verhogen kosten

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Volledige loop — geëxtrudeerde tekst volgt de gesloten spline](/assets/blog/webgpu-modifier-curve/view-a.jpg?v=20260722a)

![Handle-edit — lokale buiging van lettervormen op het pad](/assets/blog/webgpu-modifier-curve/view-b.jpg?v=20260722a)

Ook in deze build:

- De string wisselen voor een merk-wordmark
- Padideeën exporteren naar camera-rail workflows
- Vergelijk [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve)

## Hoe het werkt

Een gesloten Catmull-Rom-curve definieert het pad; een modifier samplet de curve om geëxtrudeerde tekstgeometrie bij elke update te transformeren. WebGPURenderer tekent het resultaat. Upstream: [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve) ([bron](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_modifier_curve.html)). Voor puur pad-editing zonder modifier, zie de WebGL [spline editor](https://threejs.org/examples/#webgl_geometry_spline_editor) — complementaire tools.

## FAQ

**Kunnen we ons font gebruiken?**  
Meestal ja met een gelicenseerd font dat voor web gemesht kan worden — wij doen conversie in production builds.

**WebGPU vereist?**  
Voor deze demopagina ja. Curve-ideeën kunnen ook op WebGL afhankelijk van het project.

## Tech stack en verder lezen

- [three.js — curve modifier](https://threejs.org/examples/#webgpu_modifier_curve)
- [three.js — spline editor](https://threejs.org/examples/#webgl_geometry_spline_editor)
- [Three.js](https://threejs.org/)

## Gerelateerd op IOM

Bekijk meer in [Experimenten](/#experiments), plus [Catmull Spline Editor](/blog/spline-editor), [Shape Particles](/blog/compute-particles), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$WebGPU Curve Modifier — tekst langs een spline — IOM$iom$,
  $iom$Geëxtrudeerde tekst die langs een gesloten Catmull-Rom-spline stroomt — sleep controle-handles en het mesh deformeert met het pad. Een WebGPU-aanpak van curve modifiers voor logo's$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-modifier-curve$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$WebGPU Curve Modifier — testo lungo una spline$iom$,
  $iom$Testo estruso che scorre lungo una spline Catmull-Rom chiusa — trascina le maniglie di controllo e la mesh si deforma col percorso. Un approccio WebGPU ai curve modifier per logo e$iom$,
  $iom$Testo estruso che scorre lungo una spline Catmull-Rom chiusa — trascina le maniglie di controllo e la mesh si deforma col percorso. Un approccio WebGPU ai curve modifier per logo e tipografia.

Si trova nella nostra [sezione Esperimenti](/#experiments) come **WebGPU Curve Modifier**. La cover mostra letterforme piegate lungo la curva editabile.

## Apri la demo live

**[→ Avvia WebGPU Curve Modifier](/demos/webgpu-modifier-curve/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Tipo come geometria** — logo e headline che vivono su un percorso
- **Maniglie live** — rimodellare la storia davanti al client
- **Spline chiusa** — loop per movimento stand infinito
- **Si abbina agli strumenti percorso** — stessa famiglia di editor spline e rail camera

Usi tipici: logo animati, titoli esposizione e callout prodotto guidati dal percorso.

## Per principianti — cos’è, in parole semplici?

Immagina lettere magnetiche flessibili lungo un filo curvo. Muovi i punti di controllo del filo e le lettere scivolano e si piegano di conseguenza. È un curve modifier — qui nel browser su WebGPU.

**Glossario rapido**

- **Catmull-Rom spline** — curva liscia che passa per i punti di controllo
- **Curve modifier** — deforma una mesh perché segua un percorso
- **Extruded text** — geometria lettere 3D da contorno font
- **Control handle** — punto trascinabile che rimodella la spline

## Provalo in circa 60 secondi

1. Apri la [demo WebGPU Curve Modifier](/demos/webgpu-modifier-curve/)
2. Clicca una maniglia di controllo per selezionarla
3. Trascina per rimodellare il percorso chiuso — osserva il flusso del testo
4. Orbita per controllare spessore lettere e silhouette

## Requisiti e prestazioni

- **Browser:** WebGPU (Chrome/Edge consigliato)
- **Input:** mouse per picking e drag delle maniglie
- **GPU:** modesto — font più pesanti / estrusione fine aumentano costo

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Loop completo — testo estruso che segue la spline chiusa](/assets/blog/webgpu-modifier-curve/view-a.jpg?v=20260722a)

![Edit maniglia — curvatura locale delle letterforme sul percorso](/assets/blog/webgpu-modifier-curve/view-b.jpg?v=20260722a)

Anche in questa build:

- Scambiare la stringa con un wordmark brand
- Esportare idee percorso in workflow rail camera
- Confronta [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve)

## Come funziona

Una curva Catmull-Rom chiusa definisce il percorso; un modifier campiona la curva per trasformare geometria testo estruso ad ogni update. WebGPURenderer disegna il risultato. Upstream: [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve) ([sorgente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_modifier_curve.html)). Per editing puro percorso senza modifier, vedi l'[editor spline](https://threejs.org/examples/#webgl_geometry_spline_editor) WebGL — strumenti complementari.

## FAQ

**Possiamo usare il nostro font?**  
Di solito sì con font licenziato meshabile per il web — gestiamo conversione nei build production.

**WebGPU richiesto?**  
Per questa pagina demo sì. Idee curva possono anche andare su WebGL a seconda del progetto.

## Stack tecnico e letture

- [three.js — curve modifier](https://threejs.org/examples/#webgpu_modifier_curve)
- [three.js — spline editor](https://threejs.org/examples/#webgl_geometry_spline_editor)
- [Three.js](https://threejs.org/)

## Correlati su IOM

Esplora di più in [Esperimenti](/#experiments), più [Catmull Spline Editor](/blog/spline-editor), [Shape Particles](/blog/compute-particles), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$WebGPU Curve Modifier — testo lungo una spline — IOM$iom$,
  $iom$Testo estruso che scorre lungo una spline Catmull-Rom chiusa — trascina le maniglie di controllo e la mesh si deforma col percorso. Un approccio WebGPU ai curve modifier per logo e$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-modifier-curve$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$WebGPU Curve Modifier — texto a lo largo de una spline$iom$,
  $iom$Texto extruido que fluye a lo largo de una spline Catmull-Rom cerrada — arrastra manijas de control y la malla se deforma con el camino. Un enfoque WebGPU de curve modifiers para l$iom$,
  $iom$Texto extruido que fluye a lo largo de una spline Catmull-Rom cerrada — arrastra manijas de control y la malla se deforma con el camino. Un enfoque WebGPU de curve modifiers para logos y tipografía.

Está en nuestra [sección Experimentos](/#experiments) como **WebGPU Curve Modifier**. La portada muestra letras curvadas a lo largo de la curva editable.

## Abrir la demo en vivo

**[→ Lanzar WebGPU Curve Modifier](/demos/webgpu-modifier-curve/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Tipo como geometría** — logos y titulares que viven en un camino
- **Manijas live** — remodelar la historia frente al cliente
- **Spline cerrada** — loops para movimiento infinito en stand
- **Combina con herramientas de camino** — misma familia que editores spline y rails de cámara

Usos típicos: logos animados, títulos de exposición y callouts de producto guiados por camino.

## Para principiantes — ¿qué es esto, en palabras simples?

Imagina letras magnéticas flexibles pegadas a un alambre curvo. Mueve los puntos de control del alambre y las letras se deslizan y doblan en consecuencia. Eso es un curve modifier — aquí en el navegador sobre WebGPU.

**Glosario rápido**

- **Catmull-Rom spline** — curva suave que pasa por puntos de control
- **Curve modifier** — deforma una malla para seguir un camino
- **Extruded text** — geometría de letras 3D construida desde contorno de fuente
- **Control handle** — punto arrastrable que remodela la spline

## Pruébalo en unos 60 segundos

1. Abre la [demo WebGPU Curve Modifier](/demos/webgpu-modifier-curve/)
2. Haz clic en una manija de control para seleccionarla
3. Arrastra para remodelar el camino cerrado — observa el flujo del texto
4. Orbita para revisar grosor de letras y silueta

## Requisitos y rendimiento

- **Navegador:** WebGPU (Chrome/Edge recomendado)
- **Input:** ratón para picking y arrastre de manijas
- **GPU:** modesto — fuentes más pesadas / extrusión fina suben coste

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Loop completo — texto extruido siguiendo la spline cerrada](/assets/blog/webgpu-modifier-curve/view-a.jpg?v=20260722a)

![Edición de manija — curvatura local de letras en el camino](/assets/blog/webgpu-modifier-curve/view-b.jpg?v=20260722a)

También en este build:

- Cambiar la cadena por un wordmark de marca
- Exportar ideas de camino a workflows de rails de cámara
- Comparar [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve)

## Cómo funciona

Una curva Catmull-Rom cerrada define el camino; un modifier samplea la curva para transformar geometría de texto extruido en cada update. WebGPURenderer dibuja el resultado. Upstream: [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve) ([fuente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_modifier_curve.html)). Para edición pura de camino sin modifier, ver el [editor spline](https://threejs.org/examples/#webgl_geometry_spline_editor) WebGL — herramientas complementarias.

## FAQ

**¿Podemos usar nuestra fuente?**  
Normalmente sí con fuente licenciada meshable para web — gestionamos conversión en builds de producción.

**¿WebGPU requerido?**  
Para esta página demo, sí. Ideas de curva también pueden ir en WebGL según el proyecto.

## Stack técnico y lecturas

- [three.js — curve modifier](https://threejs.org/examples/#webgpu_modifier_curve)
- [three.js — spline editor](https://threejs.org/examples/#webgl_geometry_spline_editor)
- [Three.js](https://threejs.org/)

## Relacionado en IOM

Explora más en [Experimentos](/#experiments), más [Catmull Spline Editor](/blog/spline-editor), [Shape Particles](/blog/compute-particles), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$WebGPU Curve Modifier — texto a lo largo de una spline — IOM$iom$,
  $iom$Texto extruido que fluye a lo largo de una spline Catmull-Rom cerrada — arrastra manijas de control y la malla se deforma con el camino. Un enfoque WebGPU de curve modifiers para l$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-modifier-curve$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$WebGPU Particles — fire and smoke sprites$iom$,
  $iom$Instanced fire and smoke sprites with TSL life cycles — rotating smoke UVs, additive fire, and a simple ground grid. Compact WebGPU VFX for mood and product heat.$iom$,
  $iom$Instanced fire and smoke sprites with TSL life cycles — rotating smoke UVs, additive fire, and a simple ground grid. Compact WebGPU VFX for mood and product heat.

It lives in our [Experiments section](/#experiments) as **WebGPU Particles**. The cover shows the same fire/smoke particle language as Guided Tour Step 2 on The Black Witness — rooftop heat with an “Animated fire” hotspot popup inside https://iobjectm.com/demos/panorama-360/.

## Open the live demo

**[→ Launch WebGPU Particles](/demos/webgpu-particles/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Also in the 360° guided tour

Standalone fire/smoke is only half the story. In the [360° Panorama Tour](/demos/panorama-360/), **Step 2** is authored as `cam · +particles · hotspot+popup`: the camera lands on a rooftop beat, a particle layer sells heat/atmosphere, and a hotspot opens a popup so guests get story + agency in one stop.

That connection is the interactivity benefit — particles are not a background wallpaper; they mark a **moment you can stop on, look around, and click**. The same VFX craft you explore in this demo becomes a guided beat inside a shareable tour. See also [Spout](/blog/spout) (Step 3) and [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4).

![Guided tour Step 2 — particles + hotspot popup on The Black Witness](/assets/blog/webgpu-particles/tour-bridge.jpg?v=20260722a)

**[→ Open Panorama 360](https://iobjectm.com/demos/panorama-360/)** — **Play guided tour**, Step 2 ([visitor preview](https://iobjectm.com/demos/panorama-360/?mode=preview)).

## Why this matters (even if you are not a developer)

- **Readable elemental VFX** — fire + smoke without a full FX package
- **Instanced sprites** — many particles, one draw strategy
- **TSL life cycles** — spawn, age, and fade on the GPU path
- **Additive fire** — glow that composites cleanly on dark scenes
- **Wired into 360 tours** — Step 2 on [Panorama 360](https://iobjectm.com/demos/panorama-360/) pairs particles with a hotspot popup

Typical uses: forge / launch moods, camp and industrial sketches, lightweight hero loops, and heat beats inside interactive 360° guided tours.

## For beginners — what is this, in plain words?

Fire and smoke here are many small images (sprites) that fade and swirl over time. Additive blending makes flames feel bright; smoke uses softer textures. Together they sell heat without simulating real combustion. In our [360° tour](https://iobjectm.com/demos/panorama-360/), that same particle language becomes Guided Tour Step 2 — a stop guests can look around and click.

**Quick glossary**

- **Sprite particle** — a textured quad, often camera-facing, used for smoke/fire
- **Additive blending** — colors add up — bright for fire, easy to overblow if unchecked
- **Life cycle** — birth, aging, and death of each particle
- **Instancing** — efficiently drawing many particles from one template
- **Guided tour Step 2** — on /demos/panorama-360/ — cam · +particles · hotspot+popup

## Try this in about 60 seconds

1. Open the [WebGPU Particles demo](/demos/webgpu-particles/)
2. Orbit the column — separate fire core from smoke body
3. Watch sprite rotation / UV motion in the smoke
4. Open [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, and watch Step 2 (particles + hotspot)

## Requirements and performance

- **Browser:** WebGPU via Three.js (not the older WebGL particle examples alone)
- **GPU:** fine on most modern laptops at default counts
- **Display:** darker UI backgrounds showcase additive fire best

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Rooftop fire walkthrough — animated plume over the city](/assets/blog/webgpu-particles/view-a.jpg?v=20260722a)

![Closer heat — particle plume over the city skyline](/assets/blog/webgpu-particles/view-b.jpg?v=20260722a)

Also in this build:

- Recolor flames for brand-safe heat
- Layer under a product silhouette for launch films
- Drop the same particle language into a [360° guided tour](/demos/panorama-360/) beat (Step 2)
- Open [webgpu_particles](https://threejs.org/examples/#webgpu_particles)

## How it works

Instanced sprites sample fire/smoke textures; TSL node materials animate life, rotation, and blending; WebGPURenderer composites the frame. Upstream: [webgpu_particles](https://threejs.org/examples/#webgpu_particles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_particles.html)). WebGL particle systems remain widely used for broader support — pick the API to match the audience devices.

## FAQ

**Is this real fluid simulation?**  
No — sprite VFX with authored motion. Cheap, controllable, pitch-friendly.

**How is this different from linked particles?**  
This is fire/smoke sprites. Linked particles emphasize pointer trails and neighbor ribbons.

**Where do these particles appear in the 360 tour?**  
Guided-tour Step 2 on The Black Witness — particles layered with a hotspot popup. Open /demos/panorama-360/ and Play guided tour.

## Tech stack and further reading

- [three.js — WebGPU particles](https://threejs.org/examples/#webgpu_particles)
- [360° Panorama Tour Editor](/demos/panorama-360/)
- [Three.js](https://threejs.org/)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Related on IOM

Browse more in [Experiments](/#experiments), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [Spout](/blog/spout), [WebGPU Compute Birds](/blog/webgpu-compute-birds), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$WebGPU Particles — fire and smoke sprites — IOM$iom$,
  $iom$Instanced fire and smoke sprites with TSL life cycles — rotating smoke UVs, additive fire, and a simple ground grid. Compact WebGPU VFX for mood and product heat.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-particles$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$WebGPU Particles — Feuer- und Rauch-Sprites$iom$,
  $iom$Instanzierte Feuer- und Rauch-Sprites mit TSL-Lebenszyklen — rotierende Rauch-UVs, additives Feuer und ein einfaches Bodengitter. Kompaktes WebGPU-VFX für Stimmung und Produktwärme$iom$,
  $iom$Instanzierte Feuer- und Rauch-Sprites mit TSL-Lebenszyklen — rotierende Rauch-UVs, additives Feuer und ein einfaches Bodengitter. Kompaktes WebGPU-VFX für Stimmung und Produktwärme.

Es liegt in unserem [Experimente-Bereich](/#experiments) als **WebGPU Particles**. Das Cover zeigt dieselbe Feuer-/Rauch-Partikelsprache wie Guided Tour Step 2 auf The Black Witness — Dachwärme mit einem „Animated fire“-Hotspot-Popup in https://iobjectm.com/demos/panorama-360/.

## Live-Demo öffnen

**[→ WebGPU Particles starten](/demos/webgpu-particles/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Auch in der 360°-Guided-Tour

Standalone Feuer/Rauch ist nur die halbe Geschichte. In der [360° Panorama Tour](/demos/panorama-360/) ist **Step 2** autorisiert als `cam · +particles · hotspot+popup`: die Kamera landet auf einem Dach-Beat, eine Partikelschicht verkauft Wärme/Atmosphäre, und ein Hotspot öffnet ein Popup, damit Gäste Story + Agency in einem Stopp bekommen.

Diese Verbindung ist der Interaktivitätsvorteil — Partikel sind kein Hintergrund-Tapete; sie markieren einen **Moment, an dem man anhalten, umsehen und klicken kann**. Dasselbe VFX-Craft aus dieser Demo wird zu einem Guided Beat in einer teilbaren Tour. Siehe auch [Spout](/blog/spout) (Step 3) und [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4).

![Guided tour Step 2 — Partikel + Hotspot-Popup auf The Black Witness](/assets/blog/webgpu-particles/tour-bridge.jpg?v=20260722a)

**[→ Panorama 360 öffnen](https://iobjectm.com/demos/panorama-360/)** — **Guided Tour abspielen**, Step 2 ([Besucher-Vorschau](https://iobjectm.com/demos/panorama-360/?mode=preview)).

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Lesbares elementares VFX** — Feuer + Rauch ohne volles FX-Paket
- **Instanzierte Sprites** — viele Partikel, eine Draw-Strategie
- **TSL-Lebenszyklen** — Spawn, Alter und Fade auf dem GPU-Pfad
- **Additives Feuer** — Glow, der auf dunklen Szenen sauber kompositiert
- **In 360°-Touren eingebunden** — Step 2 auf [Panorama 360](https://iobjectm.com/demos/panorama-360/) paart Partikel mit Hotspot-Popup

Typische Einsätze: Schmiede-/Launch-Stimmungen, Camp- und Industrie-Sketches, leichte Hero-Loops und Wärme-Beats in interaktiven 360°-Guided-Touren.

## Für Einsteiger — was ist das, in einfachen Worten?

Feuer und Rauch sind hier viele kleine Bilder (Sprites), die über die Zeit verblassen und wirbeln. Additives Blending lässt Flammen hell wirken; Rauch nutzt weichere Texturen. Zusammen verkaufen sie Wärme ohne echte Verbrennung zu simulieren. In unserer [360°-Tour](https://iobjectm.com/demos/panorama-360/) wird dieselbe Partikelsprache zu Guided Tour Step 2 — ein Stopp, den Gäste umsehen und anklicken können.

**Kurzes Glossar**

- **Sprite particle** — texturiertes Quad, oft kamerageführt, für Rauch/Feuer
- **Additive blending** — Farben addieren sich — hell für Feuer, leicht überzogen wenn unkontrolliert
- **Life cycle** — Geburt, Altern und Tod jedes Partikels
- **Instancing** — effizientes Zeichnen vieler Partikel aus einer Vorlage
- **Guided tour Step 2** — auf /demos/panorama-360/ — cam · +particles · hotspot+popup

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [WebGPU Particles Demo](/demos/webgpu-particles/)
2. Orbitieren Sie die Säule — trennen Sie Feuerkern von Rauchkörper
3. Beobachten Sie Sprite-Rotation / UV-Bewegung im Rauch
4. Öffnen Sie [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, und sehen Sie Step 2 (Partikel + Hotspot)

## Anforderungen und Performance

- **Browser:** WebGPU via Three.js (nicht nur die älteren WebGL-Partikelbeispiele)
- **GPU:** fein auf den meisten modernen Laptops bei Standard-Counts
- **Display:** dunklere UI-Hintergründe zeigen additives Feuer am besten

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Dach-Feuer-Walkthrough — animierte Fontäne über der Stadt](/assets/blog/webgpu-particles/view-a.jpg?v=20260722a)

![Nähere Wärme — Partikelfontäne über der Stadtsilhouette](/assets/blog/webgpu-particles/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Flammen für markensichere Wärme umfärben
- Unter einer Produkt-Silhouette für Launch-Filme legen
- Dieselbe Partikelsprache in einen [360°-Guided-Tour](/demos/panorama-360/) Beat legen (Step 2)
- [webgpu_particles](https://threejs.org/examples/#webgpu_particles) öffnen

## So funktioniert es

Instanzierte Sprites sampeln Feuer-/Rauch-Texturen; TSL-Node-Materialien animieren Leben, Rotation und Blending; WebGPURenderer kompositiert den Frame. Upstream: [webgpu_particles](https://threejs.org/examples/#webgpu_particles) ([Quelle](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_particles.html)). WebGL-Partikelsysteme bleiben weit verbreitet für breitere Unterstützung — API passend zur Zielgruppe wählen.

## FAQ

**Ist das eine echte Fluidsimulation?**  
Nein — Sprite-VFX mit autorisiertem Motion. Günstig, kontrollierbar, pitch-freundlich.

**Wie unterscheidet sich das von linked particles?**  
Das hier sind Feuer/Rauch-Sprites. Linked particles betonen Zeiger-Spuren und Nachbarbänder.

**Wo erscheinen diese Partikel in der 360°-Tour?**  
Guided-tour Step 2 auf The Black Witness — Partikel mit Hotspot-Popup. Öffnen Sie /demos/panorama-360/ und Play guided tour.

## Tech-Stack und weiterführende Links

- [three.js — WebGPU particles](https://threejs.org/examples/#webgpu_particles)
- [360° Panorama Tour Editor](/demos/panorama-360/)
- [Three.js](https://threejs.org/)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Verwandt bei IOM

Mehr in [Experimente](/#experiments), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [Spout](/blog/spout), [WebGPU Compute Birds](/blog/webgpu-compute-birds), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$WebGPU Particles — Feuer- und Rauch-Sprites — IOM$iom$,
  $iom$Instanzierte Feuer- und Rauch-Sprites mit TSL-Lebenszyklen — rotierende Rauch-UVs, additives Feuer und ein einfaches Bodengitter. Kompaktes WebGPU-VFX für Stimmung und Produktwärme$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-particles$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$WebGPU Particles — sprites feu et fumée$iom$,
  $iom$Sprites feu et fumée instanciés avec cycles de vie TSL — UV fumée rotatives, feu additif et grille au sol simple. VFX WebGPU compact pour ambiance et chaleur produit.$iom$,
  $iom$Sprites feu et fumée instanciés avec cycles de vie TSL — UV fumée rotatives, feu additif et grille au sol simple. VFX WebGPU compact pour ambiance et chaleur produit.

Il se trouve dans notre [section Expériences](/#experiments) sous **WebGPU Particles**. La couverture montre le même langage particules feu/fumée que Guided Tour Step 2 sur The Black Witness — chaleur rooftop avec popup hotspot « Animated fire » dans https://iobjectm.com/demos/panorama-360/.

## Ouvrir la démo en direct

**[→ Lancer WebGPU Particles](/demos/webgpu-particles/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Aussi dans la visite guidée 360°

Feu/fumée standalone n'est que la moitié de l'histoire. Dans la [360° Panorama Tour](/demos/panorama-360/), **Step 2** est authoré comme `cam · +particles · hotspot+popup` : la caméra atterrit sur un beat rooftop, une couche particules vend chaleur/ambiance, et un hotspot ouvre un popup pour que les visiteurs aient histoire + agency en un arrêt.

Cette connexion est le bénéfice interactivité — les particules ne sont pas un fond wallpaper ; elles marquent un **moment où l'on peut s'arrêter, regarder autour et cliquer**. Le même craft VFX exploré ici devient un beat guidé dans une tour partageable. Voir aussi [Spout](/blog/spout) (Step 3) et [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4).

![Guided tour Step 2 — particules + popup hotspot sur The Black Witness](/assets/blog/webgpu-particles/tour-bridge.jpg?v=20260722a)

**[→ Ouvrir Panorama 360](https://iobjectm.com/demos/panorama-360/)** — **Lancer la visite guidée**, Step 2 ([aperçu visiteur](https://iobjectm.com/demos/panorama-360/?mode=preview)).

## Pourquoi c’est important (même sans être développeur)

- **VFX élémentaire lisible** — feu + fumée sans package FX complet
- **Sprites instanciés** — beaucoup de particules, une stratégie de draw
- **Cycles de vie TSL** — spawn, vieillissement et fade sur la voie GPU
- **Feu additif** — glow qui composite proprement sur scènes sombres
- **Branché aux tours 360°** — Step 2 sur [Panorama 360](https://iobjectm.com/demos/panorama-360/) associe particules et popup hotspot

Usages typiques : ambiances forge / lancement, croquis camp et industriel, boucles hero légères et beats chaleur dans tours guidées 360° interactives.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Feu et fumée ici sont de petites images (sprites) qui s'estompent et tourbillonnent dans le temps. Le blending additif rend les flammes lumineuses ; la fumée utilise des textures plus douces. Ensemble ils vendent la chaleur sans simuler une vraie combustion. Dans notre [tour 360°](https://iobjectm.com/demos/panorama-360/), ce même langage devient Guided Tour Step 2 — un arrêt que les visiteurs peuvent regarder autour et cliquer.

**Glossaire rapide**

- **Sprite particle** — quad texturé, souvent face caméra, pour fumée/feu
- **Additive blending** — les couleurs s'additionnent — lumineux pour le feu, facile à sur-exposer
- **Life cycle** — naissance, vieillissement et mort de chaque particule
- **Instancing** — dessiner efficacement beaucoup de particules depuis un modèle
- **Guided tour Step 2** — sur /demos/panorama-360/ — cam · +particles · hotspot+popup

## Essayez en environ 60 secondes

1. Ouvrir la [démo WebGPU Particles](/demos/webgpu-particles/)
2. Orbiter la colonne — séparer cœur de feu et corps de fumée
3. Observer rotation sprite / mouvement UV dans la fumée
4. Ouvrir [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, et regarder Step 2 (particules + hotspot)

## Prérequis et performances

- **Navigateur :** WebGPU via Three.js (pas seulement les anciens exemples particules WebGL)
- **GPU :** correct sur la plupart des laptops modernes aux counts par défaut
- **Affichage :** fonds UI sombres mettent le feu additif en valeur

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Walkthrough feu rooftop — panache animé sur la ville](/assets/blog/webgpu-particles/view-a.jpg?v=20260722a)

![Chaleur rapprochée — panache particules sur skyline urbain](/assets/blog/webgpu-particles/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Recolorer flammes pour chaleur safe marque
- Superposer sous silhouette produit pour films lancement
- Déposer le même langage particules dans un beat [tour guidée 360°](/demos/panorama-360/) (Step 2)
- Ouvrir [webgpu_particles](https://threejs.org/examples/#webgpu_particles)

## Comment ça marche

Sprites instanciés échantillonnent textures feu/fumée ; matériaux nœuds TSL animent vie, rotation et blending ; WebGPURenderer composite la frame. Upstream : [webgpu_particles](https://threejs.org/examples/#webgpu_particles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_particles.html)). Systèmes particules WebGL restent largement utilisés pour support plus large — choisir l'API selon les appareils audience.

## FAQ

**Est-ce une vraie simulation fluide ?**  
Non — VFX sprites avec mouvement authoré. Bon marché, contrôlable, pitch-friendly.

**En quoi diffère-t-il des linked particles ?**  
Ici ce sont sprites feu/fumée. Linked particles mettent l'accent sur traînées pointeur et rubans voisins.

**Où apparaissent ces particules dans la tour 360 ?**  
Guided-tour Step 2 sur The Black Witness — particules avec popup hotspot. Ouvrir /demos/panorama-360/ et Play guided tour.

## Stack technique et lectures

- [three.js — WebGPU particles](https://threejs.org/examples/#webgpu_particles)
- [360° Panorama Tour Editor](/demos/panorama-360/)
- [Three.js](https://threejs.org/)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Sur IOM

Parcourez [Expériences](/#experiments), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [Spout](/blog/spout), [WebGPU Compute Birds](/blog/webgpu-compute-birds), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$WebGPU Particles — sprites feu et fumée — IOM$iom$,
  $iom$Sprites feu et fumée instanciés avec cycles de vie TSL — UV fumée rotatives, feu additif et grille au sol simple. VFX WebGPU compact pour ambiance et chaleur produit.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-particles$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$WebGPU Particles — vuur- en rooksprites$iom$,
  $iom$Geïnstancieerde vuur- en rooksprites met TSL-levenscycli — roterende rook-UV's, additief vuur en een eenvoudig grondraster. Compact WebGPU-VFX voor sfeer en productwarmte.$iom$,
  $iom$Geïnstancieerde vuur- en rooksprites met TSL-levenscycli — roterende rook-UV's, additief vuur en een eenvoudig grondraster. Compact WebGPU-VFX voor sfeer en productwarmte.

Het staat in onze [Experimenten-sectie](/#experiments) als **WebGPU Particles**. De cover toont dezelfde vuur/rook-deeltjestaal als Guided Tour Step 2 op The Black Witness — dakwarmte met een „Animated fire“-hotspotpopup in https://iobjectm.com/demos/panorama-360/.

## Open de live demo

**[→ Start WebGPU Particles](/demos/webgpu-particles/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Ook in de 360° guided tour

Standalone vuur/rook is maar half het verhaal. In de [360° Panorama Tour](/demos/panorama-360/) is **Step 2** geauthoriseerd als `cam · +particles · hotspot+popup`: de camera landt op een dakbeat, een deeltjeslaag verkoopt warmte/sfeer, en een hotspot opent een popup zodat gasten verhaal + agency in één stop krijgen.

Die koppeling is het interactiviteitsvoordeel — deeltjes zijn geen achtergrondbehang; ze markeren een **moment waarop je kunt stoppen, rondkijken en klikken**. Hetzelfde VFX-vakmanschap uit deze demo wordt een guided beat in een deelbare tour. Zie ook [Spout](/blog/spout) (Step 3) en [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4).

![Guided tour Step 2 — deeltjes + hotspotpopup op The Black Witness](/assets/blog/webgpu-particles/tour-bridge.jpg?v=20260722a)

**[→ Open Panorama 360](https://iobjectm.com/demos/panorama-360/)** — **Speel guided tour**, Step 2 ([bezoekersvoorbeeld](https://iobjectm.com/demos/panorama-360/?mode=preview)).

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Leesbaar elementair VFX** — vuur + rook zonder volledig FX-pakket
- **Geïnstancieerde sprites** — veel deeltjes, één draw-strategie
- **TSL-levenscycli** — spawn, veroudering en fade op het GPU-pad
- **Additief vuur** — glow die netjes compositeert op donkere scènes
- **Aangesloten op 360°-tours** — Step 2 op [Panorama 360](https://iobjectm.com/demos/panorama-360/) koppelt deeltjes aan hotspotpopup

Typische toepassingen: smidse-/launch-sferen, camp- en industriële schetsen, lichte hero-loops en warmtebeats in interactieve 360° guided tours.

## Voor beginners — wat is dit, in gewone taal?

Vuur en rook zijn hier veel kleine beelden (sprites) die in de loop van de tijd vervagen en wervelen. Additief blending maakt vlammen helder; rook gebruikt zachtere texturen. Samen verkopen ze warmte zonder echte verbranding te simuleren. In onze [360°-tour](https://iobjectm.com/demos/panorama-360/) wordt diezelfde deeltjestaal Guided Tour Step 2 — een stop waar gasten rondkijken en klikken.

**Korte glossary**

- **Sprite particle** — getextureerd quad, vaak camera-facing, voor rook/vuur
- **Additive blending** — kleuren tellen op — helder voor vuur, gemakkelijk te overblazen
- **Life cycle** — geboorte, veroudering en dood van elk deeltje
- **Instancing** — efficiënt veel deeltjes tekenen vanuit één sjabloon
- **Guided tour Step 2** — op /demos/panorama-360/ — cam · +particles · hotspot+popup

## Probeer dit in ongeveer 60 seconden

1. Open de [WebGPU Particles-demo](/demos/webgpu-particles/)
2. Orbit de kolom — scheid vuurkern van rooklichaam
3. Kijk naar sprite-rotatie / UV-beweging in de rook
4. Open [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, en bekijk Step 2 (deeltjes + hotspot)

## Vereisten en performance

- **Browser:** WebGPU via Three.js (niet alleen oudere WebGL-deeltjesvoorbeelden)
- **GPU:** prima op de meeste moderne laptops bij standaard counts
- **Display:** donkere UI-achtergronden laten additief vuur het best zien

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Dakvuur-walkthrough — geanimeerde pluim boven de stad](/assets/blog/webgpu-particles/view-a.jpg?v=20260722a)

![Nadere warmte — deeltjespluim boven de skyline](/assets/blog/webgpu-particles/view-b.jpg?v=20260722a)

Ook in deze build:

- Vlammen recoloreren voor merkveilige warmte
- Onder een productsilhouet leggen voor launch-films
- Dezelfde deeltjestaal in een [360° guided tour](/demos/panorama-360/) beat droppen (Step 2)
- Open [webgpu_particles](https://threejs.org/examples/#webgpu_particles)

## Hoe het werkt

Geïnstancieerde sprites samplen vuur/rook-textures; TSL-node-materialen animeren leven, rotatie en blending; WebGPURenderer compositeert het frame. Upstream: [webgpu_particles](https://threejs.org/examples/#webgpu_particles) ([bron](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_particles.html)). WebGL-deeltjessystemen blijven wijd gebruikt voor bredere ondersteuning — kies API passend bij doelgroepdevices.

## FAQ

**Is dit echte fluidsimulatie?**  
Nee — sprite-VFX met geauthoriseerde beweging. Goedkoop, controleerbaar, pitch-vriendelijk.

**Hoe verschilt dit van linked particles?**  
Dit zijn vuur/rook-sprites. Linked particles benadrukken pointer-sporen en buur-ribbons.

**Waar verschijnen deze deeltjes in de 360-tour?**  
Guided-tour Step 2 op The Black Witness — deeltjes met hotspotpopup. Open /demos/panorama-360/ en Play guided tour.

## Tech stack en verder lezen

- [three.js — WebGPU particles](https://threejs.org/examples/#webgpu_particles)
- [360° Panorama Tour Editor](/demos/panorama-360/)
- [Three.js](https://threejs.org/)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Gerelateerd op IOM

Bekijk meer in [Experimenten](/#experiments), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [Spout](/blog/spout), [WebGPU Compute Birds](/blog/webgpu-compute-birds), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$WebGPU Particles — vuur- en rooksprites — IOM$iom$,
  $iom$Geïnstancieerde vuur- en rooksprites met TSL-levenscycli — roterende rook-UV's, additief vuur en een eenvoudig grondraster. Compact WebGPU-VFX voor sfeer en productwarmte.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-particles$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$WebGPU Particles — sprite fuoco e fumo$iom$,
  $iom$Sprite fuoco e fumo instanziati con cicli di vita TSL — UV fumo rotanti, fuoco additivo e griglia a terra semplice. VFX WebGPU compatto per mood e calore prodotto.$iom$,
  $iom$Sprite fuoco e fumo instanziati con cicli di vita TSL — UV fumo rotanti, fuoco additivo e griglia a terra semplice. VFX WebGPU compatto per mood e calore prodotto.

Si trova nella nostra [sezione Esperimenti](/#experiments) come **WebGPU Particles**. La cover mostra lo stesso linguaggio particelle fuoco/fumo di Guided Tour Step 2 su The Black Witness — calore rooftop con popup hotspot « Animated fire » in https://iobjectm.com/demos/panorama-360/.

## Apri la demo live

**[→ Avvia WebGPU Particles](/demos/webgpu-particles/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Anche nel tour guidato 360°

Fuoco/fumo standalone è solo metà della storia. Nel [360° Panorama Tour](/demos/panorama-360/), **Step 2** è authorato come `cam · +particles · hotspot+popup`: la camera atterra su un beat rooftop, uno strato particelle vende calore/atmosfera, e un hotspot apre un popup così gli ospiti hanno storia + agency in una tappa.

Quella connessione è il vantaggio interattività — le particelle non sono wallpaper di sfondo; segnano un **momento in cui puoi fermarti, guardarti intorno e cliccare**. Lo stesso craft VFX esplorato qui diventa un beat guidato in un tour condivisibile. Vedi anche [Spout](/blog/spout) (Step 3) e [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4).

![Guided tour Step 2 — particelle + popup hotspot su The Black Witness](/assets/blog/webgpu-particles/tour-bridge.jpg?v=20260722a)

**[→ Apri Panorama 360](https://iobjectm.com/demos/panorama-360/)** — **Avvia tour guidato**, Step 2 ([anteprima visitatore](https://iobjectm.com/demos/panorama-360/?mode=preview)).

## Perché conta (anche se non sei uno sviluppatore)

- **VFX elementare leggibile** — fuoco + fumo senza pacchetto FX completo
- **Sprite instanziati** — molte particelle, una strategia di draw
- **Cicli di vita TSL** — spawn, invecchiamento e fade sul percorso GPU
- **Fuoco additivo** — glow che compone pulito su scene scure
- **Integrato nei tour 360°** — Step 2 su [Panorama 360](https://iobjectm.com/demos/panorama-360/) abbina particelle e popup hotspot

Usi tipici: mood fucina/lancio, sketch camp e industriali, loop hero leggeri e beat calore in tour guidati 360° interattivi.

## Per principianti — cos’è, in parole semplici?

Fuoco e fumo qui sono molte piccole immagini (sprite) che svaniscono e vorticoso nel tempo. Blending additivo rende le fiamme luminose; il fumo usa texture più morbide. Insieme vendono calore senza simulare combustione reale. Nel nostro [tour 360°](https://iobjectm.com/demos/panorama-360/), lo stesso linguaggio diventa Guided Tour Step 2 — una tappa che gli ospiti possono guardare intorno e cliccare.

**Glossario rapido**

- **Sprite particle** — quad texturizzato, spesso camera-facing, per fumo/fuoco
- **Additive blending** — i colori si sommano — luminoso per fuoco, facile da sovraesporre
- **Life cycle** — nascita, invecchiamento e morte di ogni particella
- **Instancing** — disegnare efficientemente molte particelle da un template
- **Guided tour Step 2** — su /demos/panorama-360/ — cam · +particles · hotspot+popup

## Provalo in circa 60 secondi

1. Apri la [demo WebGPU Particles](/demos/webgpu-particles/)
2. Orbita la colonna — separa nucleo fuoco da corpo fumo
3. Osserva rotazione sprite / movimento UV nel fumo
4. Apri [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, e guarda Step 2 (particelle + hotspot)

## Requisiti e prestazioni

- **Browser:** WebGPU via Three.js (non solo vecchi esempi particelle WebGL)
- **GPU:** ok sulla maggior parte dei laptop moderni ai count predefiniti
- **Display:** sfondi UI scuri mostrano meglio il fuoco additivo

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Walkthrough fuoco rooftop — pennacchio animato sulla città](/assets/blog/webgpu-particles/view-a.jpg?v=20260722a)

![Calore ravvicinato — pennacchio particelle sulla skyline](/assets/blog/webgpu-particles/view-b.jpg?v=20260722a)

Anche in questa build:

- Ricolorare fiamme per calore brand-safe
- Stratificare sotto silhouette prodotto per film lancio
- Inserire lo stesso linguaggio particelle in un beat [tour guidato 360°](/demos/panorama-360/) (Step 2)
- Apri [webgpu_particles](https://threejs.org/examples/#webgpu_particles)

## Come funziona

Sprite instanziati campionano texture fuoco/fumo; materiali nodo TSL animano vita, rotazione e blending; WebGPURenderer compone il frame. Upstream: [webgpu_particles](https://threejs.org/examples/#webgpu_particles) ([sorgente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_particles.html)). Sistemi particelle WebGL restano ampiamente usati per supporto più ampio — scegli API in base ai device del pubblico.

## FAQ

**È simulazione fluida reale?**  
No — VFX sprite con motion authorato. Economico, controllabile, pitch-friendly.

**In cosa differisce da linked particles?**  
Questi sono sprite fuoco/fumo. Linked particles enfatizzano scie puntatore e nastri vicini.

**Dove compaiono queste particelle nel tour 360?**  
Guided-tour Step 2 su The Black Witness — particelle con popup hotspot. Apri /demos/panorama-360/ e Play guided tour.

## Stack tecnico e letture

- [three.js — WebGPU particles](https://threejs.org/examples/#webgpu_particles)
- [360° Panorama Tour Editor](/demos/panorama-360/)
- [Three.js](https://threejs.org/)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Correlati su IOM

Esplora di più in [Esperimenti](/#experiments), più [360° Panorama Tour Editor](/blog/panorama-360-tour), [Spout](/blog/spout), [WebGPU Compute Birds](/blog/webgpu-compute-birds), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$WebGPU Particles — sprite fuoco e fumo — IOM$iom$,
  $iom$Sprite fuoco e fumo instanziati con cicli di vita TSL — UV fumo rotanti, fuoco additivo e griglia a terra semplice. VFX WebGPU compatto per mood e calore prodotto.$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-particles$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$WebGPU Particles — sprites de fuego y humo$iom$,
  $iom$Sprites de fuego y humo instanciados con ciclos de vida TSL — UV de humo rotativas, fuego aditivo y una cuadrícula de suelo simple. VFX WebGPU compacto para ambiente y calor de pro$iom$,
  $iom$Sprites de fuego y humo instanciados con ciclos de vida TSL — UV de humo rotativas, fuego aditivo y una cuadrícula de suelo simple. VFX WebGPU compacto para ambiente y calor de producto.

Está en nuestra [sección Experimentos](/#experiments) como **WebGPU Particles**. La portada muestra el mismo lenguaje de partículas fuego/humo que Guided Tour Step 2 en The Black Witness — calor en azotea con popup hotspot « Animated fire » en https://iobjectm.com/demos/panorama-360/.

## Abrir la demo en vivo

**[→ Lanzar WebGPU Particles](/demos/webgpu-particles/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## También en el tour guiado 360°

Fuego/humo standalone es solo la mitad de la historia. En el [360° Panorama Tour](/demos/panorama-360/), **Step 2** está authorado como `cam · +particles · hotspot+popup`: la cámara aterriza en un beat de azotea, una capa de partículas vende calor/atmósfera, y un hotspot abre un popup para que los invitados tengan historia + agency en una parada.

Esa conexión es el beneficio de interactividad — las partículas no son wallpaper de fondo; marcan un **momento donde puedes parar, mirar alrededor y clicar**. El mismo craft VFX que exploras aquí se convierte en un beat guiado dentro de un tour compartible. Ver también [Spout](/blog/spout) (Step 3) y [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4).

![Guided tour Step 2 — partículas + popup hotspot en The Black Witness](/assets/blog/webgpu-particles/tour-bridge.jpg?v=20260722a)

**[→ Abrir Panorama 360](https://iobjectm.com/demos/panorama-360/)** — **Reproducir tour guiado**, Step 2 ([vista previa de visitante](https://iobjectm.com/demos/panorama-360/?mode=preview)).

## Por qué importa (aunque no seas desarrollador)

- **VFX elemental legible** — fuego + humo sin paquete FX completo
- **Sprites instanciados** — muchas partículas, una estrategia de draw
- **Ciclos de vida TSL** — spawn, envejecimiento y fade en la ruta GPU
- **Fuego aditivo** — glow que compone limpio en escenas oscuras
- **Integrado en tours 360°** — Step 2 en [Panorama 360](https://iobjectm.com/demos/panorama-360/) empareja partículas con popup hotspot

Usos típicos: ambientes de forja/lanzamiento, bocetos camp e industriales, loops hero ligeros y beats de calor en tours guiados 360° interactivos.

## Para principiantes — ¿qué es esto, en palabras simples?

Fuego y humo aquí son muchas imágenes pequeñas (sprites) que se desvanecen y arremolinan con el tiempo. Blending aditivo hace las llamas brillantes; el humo usa texturas más suaves. Juntos venden calor sin simular combustión real. En nuestro [tour 360°](https://iobjectm.com/demos/panorama-360/), ese mismo lenguaje se convierte en Guided Tour Step 2 — una parada donde los invitados pueden mirar alrededor y clicar.

**Glosario rápido**

- **Sprite particle** — quad texturizado, a menudo camera-facing, para humo/fuego
- **Additive blending** — los colores se suman — brillante para fuego, fácil de sobreexponer
- **Life cycle** — nacimiento, envejecimiento y muerte de cada partícula
- **Instancing** — dibujar eficientemente muchas partículas desde una plantilla
- **Guided tour Step 2** — en /demos/panorama-360/ — cam · +particles · hotspot+popup

## Pruébalo en unos 60 segundos

1. Abre la [demo WebGPU Particles](/demos/webgpu-particles/)
2. Orbita la columna — separa núcleo de fuego del cuerpo de humo
3. Observa rotación de sprite / movimiento UV en el humo
4. Abre [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, y mira Step 2 (partículas + hotspot)

## Requisitos y rendimiento

- **Navegador:** WebGPU vía Three.js (no solo ejemplos antiguos de partículas WebGL)
- **GPU:** bien en la mayoría de laptops modernas con counts por defecto
- **Pantalla:** fondos UI oscuros muestran mejor el fuego aditivo

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Walkthrough fuego en azotea — penacho animado sobre la ciudad](/assets/blog/webgpu-particles/view-a.jpg?v=20260722a)

![Calor cercano — penacho de partículas sobre el skyline](/assets/blog/webgpu-particles/view-b.jpg?v=20260722a)

También en este build:

- Recolorear llamas para calor brand-safe
- Capa bajo silueta de producto para films de lanzamiento
- Insertar el mismo lenguaje de partículas en un beat de [tour guiado 360°](/demos/panorama-360/) (Step 2)
- Abrir [webgpu_particles](https://threejs.org/examples/#webgpu_particles)

## Cómo funciona

Sprites instanciados samplean texturas fuego/humo; materiales nodo TSL animan vida, rotación y blending; WebGPURenderer compone el frame. Upstream: [webgpu_particles](https://threejs.org/examples/#webgpu_particles) ([fuente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_particles.html)). Sistemas de partículas WebGL siguen muy usados para soporte más amplio — elige API según dispositivos de la audiencia.

## FAQ

**¿Es simulación de fluidos real?**  
No — VFX sprite con motion authorado. Barato, controlable, pitch-friendly.

**¿En qué difiere de linked particles?**  
Estos son sprites fuego/humo. Linked particles enfatizan estelas de puntero y cintas vecinas.

**¿Dónde aparecen estas partículas en el tour 360?**  
Guided-tour Step 2 en The Black Witness — partículas con popup hotspot. Abre /demos/panorama-360/ y Play guided tour.

## Stack técnico y lecturas

- [three.js — WebGPU particles](https://threejs.org/examples/#webgpu_particles)
- [360° Panorama Tour Editor](/demos/panorama-360/)
- [Three.js](https://threejs.org/)
- [WebGPU — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## Relacionado en IOM

Explora más en [Experimentos](/#experiments), más [360° Panorama Tour Editor](/blog/panorama-360-tour), [Spout](/blog/spout), [WebGPU Compute Birds](/blog/webgpu-compute-birds), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$WebGPU Particles — sprites de fuego y humo — IOM$iom$,
  $iom$Sprites de fuego y humo instanciados con ciclos de vida TSL — UV de humo rotativas, fuego aditivo y una cuadrícula de suelo simple. VFX WebGPU compacto para ambiente y calor de pro$iom$
from public.blog_posts p
where p.slug = $iom$webgpu-particles$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$BufferGeometry Draw Range — particle networks on WebGL$iom$,
  $iom$A living particle network with proximity lines — `BufferGeometry.setDrawRange()` draws only the active points and segments. Classic Three.js WebGL, still a workhorse for data-look $iom$,
  $iom$A living particle network with proximity lines — `BufferGeometry.setDrawRange()` draws only the active points and segments. Classic Three.js WebGL, still a workhorse for data-look visuals.

It lives in our [Experiments section](/#experiments) as **BufferGeometry Draw Range**. The cover shows the node-link particle cloud with active connections.

## Open the live demo

**[→ Launch BufferGeometry Draw Range](/demos/buffergeometry-drawrange/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Network aesthetic** — nodes and edges that feel like data
- **Draw range control** — render only what is alive this frame
- **Tunable graph** — count, distance, and max connections
- **Wide device reach** — WebGL, not WebGPU-only

Typical uses: tech brand backgrounds, “connected system” metaphors, and lightweight WebGL embeds.

## For beginners — what is this, in plain words?

Dots float in space; when two get close, a thin line appears — like people becoming a network. The clever bit is efficiency: the engine only draws the currently active dots and lines instead of everything all the time.

**Quick glossary**

- **BufferGeometry** — Three.js mesh data stored in GPU buffers
- **Draw range** — limit which slice of a buffer gets drawn this frame
- **Proximity link** — a line spawned when particles are within a distance
- **WebGL** — the widely supported browser 3D API used by this demo

## Try this in about 60 seconds

1. Open the [BufferGeometry Draw Range demo](/demos/buffergeometry-drawrange/)
2. Orbit the particle cloud
3. Raise or lower particle count and link distance in the UI
4. Watch lines appear/disappear as neighbors change

## Requirements and performance

- **Browser:** any modern browser with WebGL
- **GPU:** scales with particle and connection counts — dial down on weak devices
- **API note:** WebGL path — useful when WebGPU is unavailable

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Full network — particles with proximity segments](/assets/blog/buffergeometry-drawrange/view-a.jpg?v=20260722a)

![Closer graph — draw-range active links reading clearly](/assets/blog/buffergeometry-drawrange/view-b.jpg?v=20260722a)

Also in this build:

- Map colors to categories or signal strength
- Use as a muted background under UI copy
- Study [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange)

## How it works

Particles update in JS (or simple GPU-friendly buffers); line segments are rebuilt or ranged for near pairs; `setDrawRange` limits draws to the active subset. Upstream: [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_buffergeometry_drawrange.html)). For WebGPU compute flocks and TSL link ribbons, see the newer experiments — same visual family, different API.

## FAQ

**Why not WebGPU here?**  
WebGL still wins for maximum device coverage. We pick WebGPU when compute or TSL materials need it.

**Can links represent real data?**  
Yes — replace random proximity with your graph edges in a production build.

## Tech stack and further reading

- [three.js — buffergeometry drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange)
- [Three.js BufferGeometry](https://threejs.org/docs/#api/en/core/BufferGeometry)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

## Related on IOM

Browse more in [Experiments](/#experiments), plus [CSS3D Sprites](/blog/css3d-sprites), [WebGPU TSL Linked Particles](/blog/webgpu-tsl-linked-particles), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$BufferGeometry Draw Range — particle networks on WebGL — IOM$iom$,
  $iom$A living particle network with proximity lines — `BufferGeometry.setDrawRange()` draws only the active points and segments. Classic Three.js WebGL, still a workhorse for data-look $iom$
from public.blog_posts p
where p.slug = $iom$buffergeometry-drawrange$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$BufferGeometry Draw Range — Partikelnetzwerke auf WebGL$iom$,
  $iom$Ein lebendiges Partikelnetzwerk mit Nähe-Linien — `BufferGeometry.setDrawRange()` zeichnet nur die aktiven Punkte und Segmente. Klassisches Three.js WebGL, weiterhin ein Workhorse $iom$,
  $iom$Ein lebendiges Partikelnetzwerk mit Nähe-Linien — `BufferGeometry.setDrawRange()` zeichnet nur die aktiven Punkte und Segmente. Klassisches Three.js WebGL, weiterhin ein Workhorse für Data-Look-Visuals.

Es liegt in unserem [Experimente-Bereich](/#experiments) als **BufferGeometry Draw Range**. Das Cover zeigt die Knoten-Link-Partikelwolke mit aktiven Verbindungen.

## Live-Demo öffnen

**[→ BufferGeometry Draw Range starten](/demos/buffergeometry-drawrange/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Netzwerk-Ästhetik** — Knoten und Kanten, die sich wie Daten anfühlen
- **Draw-Range-Kontrolle** — nur rendern, was diesen Frame lebt
- **Einstellbarer Graph** — Count, Distanz und max. Verbindungen
- **Breite Geräte-Reichweite** — WebGL, nicht WebGPU-only

Typische Einsätze: Tech-Marken-Hintergründe, „verbundenes System“-Metaphern und leichte WebGL-Embeds.

## Für Einsteiger — was ist das, in einfachen Worten?

Punkte schweben im Raum; wenn zwei nah kommen, erscheint eine dünne Linie — wie Menschen, die ein Netzwerk werden. Der clevere Teil ist Effizienz: die Engine zeichnet nur die gerade aktiven Punkte und Linien statt alles die ganze Zeit.

**Kurzes Glossar**

- **BufferGeometry** — Three.js-Mesh-Daten in GPU-Buffern gespeichert
- **Draw range** — begrenzt, welcher Buffer-Abschnitt diesen Frame gezeichnet wird
- **Proximity link** — Linie, wenn Partikel innerhalb einer Distanz sind
- **WebGL** — die weit unterstützte Browser-3D-API dieser Demo

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [BufferGeometry Draw Range Demo](/demos/buffergeometry-drawrange/)
2. Orbitieren Sie die Partikelwolke
3. Erhöhen oder senken Sie Partikel-Count und Link-Distanz in der UI
4. Beobachten Sie Linien erscheinen/verschwinden, wenn sich Nachbarn ändern

## Anforderungen und Performance

- **Browser:** jeder moderne Browser mit WebGL
- **GPU:** skaliert mit Partikel- und Verbindungs-Counts — auf schwachen Geräten runterdrehen
- **API-Hinweis:** WebGL-Pfad — nützlich wenn WebGPU nicht verfügbar

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Volles Netzwerk — Partikel mit Nähe-Segmenten](/assets/blog/buffergeometry-drawrange/view-a.jpg?v=20260722a)

![Näherer Graph — draw-range-aktive Links klar lesbar](/assets/blog/buffergeometry-drawrange/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Farben auf Kategorien oder Signalstärke mappen
- Als gedämpfter Hintergrund unter UI-Copy nutzen
- [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange) studieren

## So funktioniert es

Partikel updaten in JS (oder einfachen GPU-freundlichen Buffern); Liniensegmente werden für nahe Paare neu gebaut oder geranged; `setDrawRange` limitiert Draws auf die aktive Teilmenge. Upstream: [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange) ([Quelle](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_buffergeometry_drawrange.html)). Für WebGPU-Compute-Schwärme und TSL-Link-Bänder siehe neuere Experimente — gleiche visuelle Familie, andere API.

## FAQ

**Warum nicht WebGPU hier?**  
WebGL gewinnt noch für maximale Geräteabdeckung. WebGPU wählen wir, wenn Compute oder TSL-Materialien es brauchen.

**Können Links echte Daten repräsentieren?**  
Ja — Zufallsnähe in Production durch Ihre Graph-Kanten ersetzen.

## Tech-Stack und weiterführende Links

- [three.js — buffergeometry drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange)
- [Three.js BufferGeometry](https://threejs.org/docs/#api/en/core/BufferGeometry)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

## Verwandt bei IOM

Mehr in [Experimente](/#experiments), plus [CSS3D Sprites](/blog/css3d-sprites), [WebGPU TSL Linked Particles](/blog/webgpu-tsl-linked-particles), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$BufferGeometry Draw Range — Partikelnetzwerke auf WebGL — IOM$iom$,
  $iom$Ein lebendiges Partikelnetzwerk mit Nähe-Linien — `BufferGeometry.setDrawRange()` zeichnet nur die aktiven Punkte und Segmente. Klassisches Three.js WebGL, weiterhin ein Workhorse $iom$
from public.blog_posts p
where p.slug = $iom$buffergeometry-drawrange$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$BufferGeometry Draw Range — réseaux particules WebGL$iom$,
  $iom$Un réseau particules vivant avec lignes de proximité — `BufferGeometry.setDrawRange()` ne dessine que points et segments actifs. Three.js WebGL classique, toujours un workhorse pou$iom$,
  $iom$Un réseau particules vivant avec lignes de proximité — `BufferGeometry.setDrawRange()` ne dessine que points et segments actifs. Three.js WebGL classique, toujours un workhorse pour visuels look data.

Il se trouve dans notre [section Expériences](/#experiments) sous **BufferGeometry Draw Range**. La couverture montre le nuage particules nœuds-liens avec connexions actives.

## Ouvrir la démo en direct

**[→ Lancer BufferGeometry Draw Range](/demos/buffergeometry-drawrange/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Esthétique réseau** — nœuds et arêtes qui sentent la data
- **Contrôle draw range** — ne render que ce qui vit cette frame
- **Graphe réglable** — count, distance et connexions max
- **Portée appareils large** — WebGL, pas WebGPU-only

Usages typiques : fonds marque tech, métaphores « système connecté » et embeds WebGL légers.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Des points flottent ; quand deux se rapprochent, une fine ligne apparaît — comme des gens devenant un réseau. L'astuce est l'efficacité : le moteur ne dessine que les points et lignes actifs au lieu de tout tout le temps.

**Glossaire rapide**

- **BufferGeometry** — données mesh Three.js stockées dans buffers GPU
- **Draw range** — limiter quelle tranche de buffer est dessinée cette frame
- **Proximity link** — ligne quand particules sont dans une distance
- **WebGL** — API 3D navigateur largement supportée utilisée par cette démo

## Essayez en environ 60 secondes

1. Ouvrir la [démo BufferGeometry Draw Range](/demos/buffergeometry-drawrange/)
2. Orbiter le nuage particules
3. Monter ou baisser count particules et distance liens dans l'UI
4. Observer lignes apparaître/disparaître quand voisins changent

## Prérequis et performances

- **Navigateur :** tout navigateur moderne avec WebGL
- **GPU :** scale avec counts particules et connexions — baisser sur appareils faibles
- **Note API :** voie WebGL — utile quand WebGPU indisponible

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Réseau complet — particules avec segments proximité](/assets/blog/buffergeometry-drawrange/view-a.jpg?v=20260722a)

![Graphe rapproché — liens actifs draw-range lisibles](/assets/blog/buffergeometry-drawrange/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Mapper couleurs vers catégories ou force signal
- Utiliser comme fond atténué sous copy UI
- Étudier [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange)

## Comment ça marche

Particules updatent en JS (ou buffers GPU-friendly simples) ; segments ligne rebuild ou rangés pour paires proches ; `setDrawRange` limite draws au sous-ensemble actif. Upstream : [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_buffergeometry_drawrange.html)). Pour essaims compute WebGPU et rubans liens TSL, voir expériences plus récentes — même famille visuelle, API différente.

## FAQ

**Pourquoi pas WebGPU ici ?**  
WebGL gagne encore pour couverture appareils max. WebGPU quand compute ou matériaux TSL le demandent.

**Les liens peuvent-ils représenter de vraies data ?**  
Oui — remplacer proximité aléatoire par vos arêtes graphe en build production.

## Stack technique et lectures

- [three.js — buffergeometry drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange)
- [Three.js BufferGeometry](https://threejs.org/docs/#api/en/core/BufferGeometry)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

## Sur IOM

Parcourez [Expériences](/#experiments), plus [CSS3D Sprites](/blog/css3d-sprites), [WebGPU TSL Linked Particles](/blog/webgpu-tsl-linked-particles), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$BufferGeometry Draw Range — réseaux particules WebGL — IOM$iom$,
  $iom$Un réseau particules vivant avec lignes de proximité — `BufferGeometry.setDrawRange()` ne dessine que points et segments actifs. Three.js WebGL classique, toujours un workhorse pou$iom$
from public.blog_posts p
where p.slug = $iom$buffergeometry-drawrange$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$BufferGeometry Draw Range — deeltjesnetwerken op WebGL$iom$,
  $iom$Een levend deeltjesnetwerk met nabijheidslijnen — `BufferGeometry.setDrawRange()` tekent alleen actieve punten en segmenten. Klassiek Three.js WebGL, nog steeds een workhorse voor $iom$,
  $iom$Een levend deeltjesnetwerk met nabijheidslijnen — `BufferGeometry.setDrawRange()` tekent alleen actieve punten en segmenten. Klassiek Three.js WebGL, nog steeds een workhorse voor data-look visuals.

Het staat in onze [Experimenten-sectie](/#experiments) als **BufferGeometry Draw Range**. De cover toont de knoop-link-deeltjeswolk met actieve verbindingen.

## Open de live demo

**[→ Start BufferGeometry Draw Range](/demos/buffergeometry-drawrange/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Netwerk-esthetiek** — knopen en randen die als data voelen
- **Draw range-controle** — alleen renderen wat deze frame leeft
- **Instelbare graaf** — count, afstand en max. verbindingen
- **Breed device-bereik** — WebGL, niet WebGPU-only

Typische toepassingen: tech-merkachtergronden, „verbonden systeem“-metaforen en lichte WebGL-embeds.

## Voor beginners — wat is dit, in gewone taal?

Stippen zweven; wanneer twee dichtbij komen, verschijnt een dunne lijn — als mensen die een netwerk worden. Het slimme deel is efficiëntie: de engine tekent alleen de actieve stippen en lijnen in plaats van alles de hele tijd.

**Korte glossary**

- **BufferGeometry** — Three.js meshdata opgeslagen in GPU-buffers
- **Draw range** — beperkt welk deel van een buffer deze frame wordt getekend
- **Proximity link** — lijn wanneer deeltjes binnen een afstand zijn
- **WebGL** — de wijd ondersteunde browser-3D-API van deze demo

## Probeer dit in ongeveer 60 seconden

1. Open de [BufferGeometry Draw Range-demo](/demos/buffergeometry-drawrange/)
2. Orbit de deeltjeswolk
3. Verhoog of verlaag deeltjestelling en linkafstand in de UI
4. Kijk hoe lijnen verschijnen/verdwijnen als buren veranderen

## Vereisten en performance

- **Browser:** elke moderne browser met WebGL
- **GPU:** schaalt met deeltjes- en verbindingscounts — lager op zwakke devices
- **API-notitie:** WebGL-pad — nuttig wanneer WebGPU niet beschikbaar

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Volledig netwerk — deeltjes met nabijheidssegmenten](/assets/blog/buffergeometry-drawrange/view-a.jpg?v=20260722a)

![Nadere graaf — draw-range-actieve links duidelijk leesbaar](/assets/blog/buffergeometry-drawrange/view-b.jpg?v=20260722a)

Ook in deze build:

- Kleuren mappen naar categorieën of signaalsterkte
- Als gedempte achtergrond onder UI-copy gebruiken
- Bestudeer [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange)

## Hoe het werkt

Deeltjes updaten in JS (of eenvoudige GPU-vriendelijke buffers); lijnsegmenten worden herbouwd of geranged voor nabije paren; `setDrawRange` beperkt draws tot actieve subset. Upstream: [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange) ([bron](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_buffergeometry_drawrange.html)). Voor WebGPU compute-zwermen en TSL-linkribbons, zie nieuwere experimenten — zelfde visuele familie, andere API.

## FAQ

**Waarom geen WebGPU hier?**  
WebGL wint nog voor maximale device-dekking. WebGPU kiezen we wanneer compute of TSL-materialen het nodig hebben.

**Kunnen links echte data representeren?**  
Ja — vervang willekeurige nabijheid door uw graaf-randen in een production build.

## Tech stack en verder lezen

- [three.js — buffergeometry drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange)
- [Three.js BufferGeometry](https://threejs.org/docs/#api/en/core/BufferGeometry)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

## Gerelateerd op IOM

Bekijk meer in [Experimenten](/#experiments), plus [CSS3D Sprites](/blog/css3d-sprites), [WebGPU TSL Linked Particles](/blog/webgpu-tsl-linked-particles), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$BufferGeometry Draw Range — deeltjesnetwerken op WebGL — IOM$iom$,
  $iom$Een levend deeltjesnetwerk met nabijheidslijnen — `BufferGeometry.setDrawRange()` tekent alleen actieve punten en segmenten. Klassiek Three.js WebGL, nog steeds een workhorse voor $iom$
from public.blog_posts p
where p.slug = $iom$buffergeometry-drawrange$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$BufferGeometry Draw Range — reti particelle su WebGL$iom$,
  $iom$Una rete particelle vivente con linee di prossimità — `BufferGeometry.setDrawRange()` disegna solo punti e segmenti attivi. Three.js WebGL classico, ancora un workhorse per visual $iom$,
  $iom$Una rete particelle vivente con linee di prossimità — `BufferGeometry.setDrawRange()` disegna solo punti e segmenti attivi. Three.js WebGL classico, ancora un workhorse per visual data-look.

Si trova nella nostra [sezione Esperimenti](/#experiments) come **BufferGeometry Draw Range**. La cover mostra la nube particelle nodo-link con connessioni attive.

## Apri la demo live

**[→ Avvia BufferGeometry Draw Range](/demos/buffergeometry-drawrange/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Estetica rete** — nodi e archi che sembrano dati
- **Controllo draw range** — render solo ciò che vive questo frame
- **Grafo regolabile** — count, distanza e connessioni max
- **Ampia copertura device** — WebGL, non solo WebGPU

Usi tipici: sfondi brand tech, metafore « sistema connesso » e embed WebGL leggeri.

## Per principianti — cos’è, in parole semplici?

Punti fluttuano; quando due si avvicinano, appare una linea sottile — come persone che diventano rete. Il trucco è efficienza: il motore disegna solo punti e linee attivi invece di tutto sempre.

**Glossario rapido**

- **BufferGeometry** — dati mesh Three.js in buffer GPU
- **Draw range** — limita quale fetta di buffer viene disegnata questo frame
- **Proximity link** — linea quando particelle sono entro una distanza
- **WebGL** — API 3D browser ampiamente supportata usata da questa demo

## Provalo in circa 60 secondi

1. Apri la [demo BufferGeometry Draw Range](/demos/buffergeometry-drawrange/)
2. Orbita la nube particelle
3. Alza o abbassa count particelle e distanza link nell'UI
4. Osserva linee apparire/scomparire quando i vicini cambiano

## Requisiti e prestazioni

- **Browser:** qualsiasi browser moderno con WebGL
- **GPU:** scala con count particelle e connessioni — abbassa su device deboli
- **Nota API:** percorso WebGL — utile quando WebGPU non disponibile

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Rete completa — particelle con segmenti prossimità](/assets/blog/buffergeometry-drawrange/view-a.jpg?v=20260722a)

![Grafo ravvicinato — link attivi draw-range chiaramente leggibili](/assets/blog/buffergeometry-drawrange/view-b.jpg?v=20260722a)

Anche in questa build:

- Mappare colori a categorie o forza segnale
- Usare come sfondo attenuato sotto copy UI
- Studiare [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange)

## Come funziona

Particelle aggiornano in JS (o buffer GPU-friendly semplici); segmenti linea ricostruiti o ranged per coppie vicine; `setDrawRange` limita draw al sottoinsieme attivo. Upstream: [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange) ([sorgente](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_buffergeometry_drawrange.html)). Per stormi compute WebGPU e nastri link TSL, vedi esperimenti più recenti — stessa famiglia visiva, API diversa.

## FAQ

**Perché non WebGPU qui?**  
WebGL vince ancora per copertura device massima. WebGPU quando serve compute o materiali TSL.

**I link possono rappresentare dati reali?**  
Sì — sostituire prossimità casuale con i tuoi archi grafo in build production.

## Stack tecnico e letture

- [three.js — buffergeometry drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange)
- [Three.js BufferGeometry](https://threejs.org/docs/#api/en/core/BufferGeometry)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

## Correlati su IOM

Esplora di più in [Esperimenti](/#experiments), più [CSS3D Sprites](/blog/css3d-sprites), [WebGPU TSL Linked Particles](/blog/webgpu-tsl-linked-particles), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$BufferGeometry Draw Range — reti particelle su WebGL — IOM$iom$,
  $iom$Una rete particelle vivente con linee di prossimità — `BufferGeometry.setDrawRange()` disegna solo punti e segmenti attivi. Three.js WebGL classico, ancora un workhorse per visual $iom$
from public.blog_posts p
where p.slug = $iom$buffergeometry-drawrange$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$BufferGeometry Draw Range — redes de partículas en WebGL$iom$,
  $iom$Una red de partículas viva con líneas de proximidad — `BufferGeometry.setDrawRange()` dibuja solo puntos y segmentos activos. Three.js WebGL clásico, aún un workhorse para visuales$iom$,
  $iom$Una red de partículas viva con líneas de proximidad — `BufferGeometry.setDrawRange()` dibuja solo puntos y segmentos activos. Three.js WebGL clásico, aún un workhorse para visuales tipo data.

Está en nuestra [sección Experimentos](/#experiments) como **BufferGeometry Draw Range**. La portada muestra la nube de partículas nodo-enlace con conexiones activas.

## Abrir la demo en vivo

**[→ Lanzar BufferGeometry Draw Range](/demos/buffergeometry-drawrange/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Estética de red** — nodos y aristas que se sienten como datos
- **Control draw range** — render solo lo vivo este frame
- **Grafo ajustable** — count, distancia y conexiones máx.
- **Amplio alcance de dispositivos** — WebGL, no solo WebGPU

Usos típicos: fondos de marca tech, metáforas de « sistema conectado » y embeds WebGL ligeros.

## Para principiantes — ¿qué es esto, en palabras simples?

Puntos flotan; cuando dos se acercan, aparece una línea fina — como personas convirtiéndose en red. Lo ingenioso es eficiencia: el motor solo dibuja puntos y líneas activos en lugar de todo todo el tiempo.

**Glosario rápido**

- **BufferGeometry** — datos mesh Three.js almacenados en buffers GPU
- **Draw range** — limita qué porción de buffer se dibuja este frame
- **Proximity link** — línea cuando partículas están dentro de una distancia
- **WebGL** — API 3D de navegador ampliamente soportada usada por esta demo

## Pruébalo en unos 60 segundos

1. Abre la [demo BufferGeometry Draw Range](/demos/buffergeometry-drawrange/)
2. Orbita la nube de partículas
3. Sube o baja count de partículas y distancia de enlaces en la UI
4. Observa líneas aparecer/desaparecer cuando cambian vecinos

## Requisitos y rendimiento

- **Navegador:** cualquier navegador moderno con WebGL
- **GPU:** escala con counts de partículas y conexiones — baja en dispositivos débiles
- **Nota API:** ruta WebGL — útil cuando WebGPU no está disponible

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Red completa — partículas con segmentos de proximidad](/assets/blog/buffergeometry-drawrange/view-a.jpg?v=20260722a)

![Grafo cercano — enlaces activos draw-range claramente legibles](/assets/blog/buffergeometry-drawrange/view-b.jpg?v=20260722a)

También en este build:

- Mapear colores a categorías o fuerza de señal
- Usar como fondo atenuado bajo copy UI
- Estudiar [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange)

## Cómo funciona

Partículas actualizan en JS (o buffers GPU-friendly simples); segmentos de línea se reconstruyen o rangen para pares cercanos; `setDrawRange` limita draws al subconjunto activo. Upstream: [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange) ([fuente](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_buffergeometry_drawrange.html)). Para bandadas compute WebGPU y cintas link TSL, ver experimentos más nuevos — misma familia visual, API distinta.

## FAQ

**¿Por qué no WebGPU aquí?**  
WebGL aún gana para máxima cobertura de dispositivos. WebGPU cuando compute o materiales TSL lo necesitan.

**¿Los enlaces pueden representar datos reales?**  
Sí — reemplazar proximidad aleatoria con tus aristas de grafo en build de producción.

## Stack técnico y lecturas

- [three.js — buffergeometry drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange)
- [Three.js BufferGeometry](https://threejs.org/docs/#api/en/core/BufferGeometry)
- [WebGL — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

## Relacionado en IOM

Explora más en [Experimentos](/#experiments), más [CSS3D Sprites](/blog/css3d-sprites), [WebGPU TSL Linked Particles](/blog/webgpu-tsl-linked-particles), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$BufferGeometry Draw Range — redes de partículas en WebGL — IOM$iom$,
  $iom$Una red de partículas viva con líneas de proximidad — `BufferGeometry.setDrawRange()` dibuja solo puntos y segmentos activos. Three.js WebGL clásico, aún un workhorse para visuales$iom$
from public.blog_posts p
where p.slug = $iom$buffergeometry-drawrange$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$Catmull Spline Editor — paths you can drag$iom$,
  $iom$Interactive Catmull-Rom paths with transform gizmos — compare uniform, centripetal, and chordal types, tune tension, and export `Vector3` arrays for camera rails and object paths.$iom$,
  $iom$Interactive Catmull-Rom paths with transform gizmos — compare uniform, centripetal, and chordal types, tune tension, and export `Vector3` arrays for camera rails and object paths.

It lives in our [Experiments section](/#experiments) as **Catmull Spline Editor**. The cover shows the editable spline with control points and curve type contrast.

## Open the live demo

**[→ Launch Catmull Spline Editor](/demos/spline-editor/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Author paths visually** — no hand-typing coordinate lists first
- **Curve type comparison** — uniform vs centripetal vs chordal in one place
- **Export-ready** — Vector3 arrays for rails, fly-throughs, and modifiers
- **WebGL reliability** — works where WebGPU is not available yet

Typical uses: camera path planning, product turntable rails, and briefing tools for motion.

## For beginners — what is this, in plain words?

A spline is a smooth curve guided by a few control points — like a flexible ruler. Drag the points, and the path updates. Filmmakers and games use the same idea for camera moves; here you edit it in the browser.

**Quick glossary**

- **Catmull-Rom** — spline family that interpolates through control points
- **Centripetal** — parameterization that usually avoids loops/cusps better than uniform
- **Tension** — how tightly the curve bends toward the controls
- **Gizmo** — on-screen translate/rotate/scale handle for a point

## Try this in about 60 seconds

1. Open the [Spline Editor demo](/demos/spline-editor/)
2. Drag control points with the gizmo
3. Switch uniform / centripetal / chordal and compare the bend
4. Export or copy Vector3 data if the UI offers it — use it as a camera rail

## Requirements and performance

- **Browser:** modern WebGL browser (Chrome, Edge, Firefox, Safari)
- **Input:** mouse for gizmo drags; desktop is easiest
- **API:** WebGL Three.js example family — not WebGPU

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Full path — control points and smooth Catmull-Rom curve](/assets/blog/spline-editor/view-a.jpg?v=20260722a)

![Gizmo edit — local reshape of the rail](/assets/blog/spline-editor/view-b.jpg?v=20260722a)

Also in this build:

- Feed exports into fly-through cameras
- Pair with the WebGPU curve modifier for type-on-path
- Use upstream [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor)

## How it works

Control points define a `CatmullRomCurve3`; the editor visualizes the polyline/curve and lets you transform points. Curve type and tension change parameterization. Upstream: [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_geometry_spline_editor.html)). Exporting points connects to IOM path tools and the [WebGPU curve modifier](/demos/webgpu-modifier-curve/).

## FAQ

**Which curve type should I pick?**  
Centripetal is a safe default for avoiding sharp cusps; compare in the UI for your path.

**Can this drive a real camera on a client site?**  
Yes — we wire exported points into a production camera controller.

## Tech stack and further reading

- [three.js — spline editor](https://threejs.org/examples/#webgl_geometry_spline_editor)
- [Catmull–Rom spline — Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline)
- [Three.js](https://threejs.org/)

## Related on IOM

Browse more in [Experiments](/#experiments), plus [WebGPU Curve Modifier](/blog/webgpu-modifier-curve), [Terrain Sandbox](/blog/terrain-sandbox), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$Catmull Spline Editor — paths you can drag — IOM$iom$,
  $iom$Interactive Catmull-Rom paths with transform gizmos — compare uniform, centripetal, and chordal types, tune tension, and export `Vector3` arrays for camera rails and object paths.$iom$
from public.blog_posts p
where p.slug = $iom$spline-editor$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$Catmull Spline Editor — Pfade zum Ziehen$iom$,
  $iom$Interaktive Catmull-Rom-Pfade mit Transform-Gizmos — uniform, zentripetal und chordal vergleichen, Spannung tunen und `Vector3`-Arrays für Kamera-Rails und Objektpfade exportieren.$iom$,
  $iom$Interaktive Catmull-Rom-Pfade mit Transform-Gizmos — uniform, zentripetal und chordal vergleichen, Spannung tunen und `Vector3`-Arrays für Kamera-Rails und Objektpfade exportieren.

Es liegt in unserem [Experimente-Bereich](/#experiments) als **Catmull Spline Editor**. Das Cover zeigt die editierbare Spline mit Kontrollpunkten und Kurventyp-Kontrast.

## Live-Demo öffnen

**[→ Catmull Spline Editor starten](/demos/spline-editor/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Pfade visuell authorisieren** — keine Koordinatenlisten zuerst von Hand tippen
- **Kurventyp-Vergleich** — uniform vs. zentripetal vs. chordal an einem Ort
- **Export-ready** — Vector3-Arrays für Rails, Fly-throughs und Modifiers
- **WebGL-Zuverlässigkeit** — funktioniert, wo WebGPU noch nicht verfügbar ist

Typische Einsätze: Kamera-Pfad-Planung, Produkt-Turntable-Rails und Briefing-Tools für Motion.

## Für Einsteiger — was ist das, in einfachen Worten?

Eine Spline ist eine glatte Kurve, die von wenigen Kontrollpunkten geführt wird — wie ein flexibles Lineal. Ziehen Sie die Punkte, und der Pfad aktualisiert sich. Filmemacher und Games nutzen dieselbe Idee für Kamerafahrten; hier editieren Sie im Browser.

**Kurzes Glossar**

- **Catmull-Rom** — Spline-Familie, die durch Kontrollpunkte interpoliert
- **Centripetal** — Parametrisierung, die meist besser als uniform Schleifen/Spitzen vermeidet
- **Tension** — wie straff die Kurve zu den Kontrollen biegt
- **Gizmo** — On-Screen-Translate/Rotate/Scale-Handle für einen Punkt

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [Spline Editor Demo](/demos/spline-editor/)
2. Ziehen Sie Kontrollpunkte mit dem Gizmo
3. Wechseln Sie uniform / centripetal / chordal und vergleichen Sie die Biegung
4. Exportieren oder kopieren Sie Vector3-Daten falls die UI es bietet — als Kamera-Rail nutzen

## Anforderungen und Performance

- **Browser:** moderner WebGL-Browser (Chrome, Edge, Firefox, Safari)
- **Input:** Maus für Gizmo-Drags; Desktop am einfachsten
- **API:** WebGL Three.js-Beispielfamilie — nicht WebGPU

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Voller Pfad — Kontrollpunkte und glatte Catmull-Rom-Kurve](/assets/blog/spline-editor/view-a.jpg?v=20260722a)

![Gizmo-Edit — lokales Umformen der Rail](/assets/blog/spline-editor/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Exporte in Fly-through-Kameras einspeisen
- Mit dem WebGPU Curve Modifier für Type-on-Path paaren
- Upstream [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor) nutzen

## So funktioniert es

Kontrollpunkte definieren eine `CatmullRomCurve3`; der Editor visualisiert Polyline/Kurve und lässt Punkte transformieren. Kurventyp und Spannung ändern Parametrisierung. Upstream: [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor) ([Quelle](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_geometry_spline_editor.html)). Exportierte Punkte verbinden zu IOM-Pfad-Tools und dem [WebGPU curve modifier](/demos/webgpu-modifier-curve/).

## FAQ

**Welchen Kurventyp soll ich wählen?**  
Centripetal ist ein sicherer Default gegen scharfe Spitzen; im UI für Ihren Pfad vergleichen.

**Kann das eine echte Kamera auf einer Client-Site steuern?**  
Ja — wir verdrahten exportierte Punkte in einen Production-Kamera-Controller.

## Tech-Stack und weiterführende Links

- [three.js — spline editor](https://threejs.org/examples/#webgl_geometry_spline_editor)
- [Catmull–Rom spline — Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline)
- [Three.js](https://threejs.org/)

## Verwandt bei IOM

Mehr in [Experimente](/#experiments), plus [WebGPU Curve Modifier](/blog/webgpu-modifier-curve), [Terrain Sandbox](/blog/terrain-sandbox), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$Catmull Spline Editor — Pfade zum Ziehen — IOM$iom$,
  $iom$Interaktive Catmull-Rom-Pfade mit Transform-Gizmos — uniform, zentripetal und chordal vergleichen, Spannung tunen und `Vector3`-Arrays für Kamera-Rails und Objektpfade exportieren.$iom$
from public.blog_posts p
where p.slug = $iom$spline-editor$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$Catmull Spline Editor — chemins à faire glisser$iom$,
  $iom$Chemins Catmull-Rom interactifs avec gizmos transform — comparer uniform, centripetal et chordal, tuner tension, exporter tableaux `Vector3` pour rails caméra et chemins objets.$iom$,
  $iom$Chemins Catmull-Rom interactifs avec gizmos transform — comparer uniform, centripetal et chordal, tuner tension, exporter tableaux `Vector3` pour rails caméra et chemins objets.

Il se trouve dans notre [section Expériences](/#experiments) sous **Catmull Spline Editor**. La couverture montre la spline éditable avec points de contrôle et contraste type courbe.

## Ouvrir la démo en direct

**[→ Lancer Catmull Spline Editor](/demos/spline-editor/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Authorer chemins visuellement** — pas de listes coordonnées tapées d'abord
- **Comparaison type courbe** — uniform vs centripetal vs chordal au même endroit
- **Prêt export** — tableaux Vector3 pour rails, fly-throughs et modifiers
- **Fiabilité WebGL** — fonctionne où WebGPU pas encore dispo

Usages typiques : planification chemins caméra, rails turntable produit et outils briefing motion.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Une spline est une courbe lisse guidée par quelques points de contrôle — comme une règle flexible. Tirez les points, le chemin se met à jour. Cinéastes et jeux utilisent la même idée pour mouvements caméra ; ici vous éditez dans le navigateur.

**Glossaire rapide**

- **Catmull-Rom** — famille spline interpolant à travers points de contrôle
- **Centripetal** — paramétrisation évitant souvent mieux boucles/cuspides que uniform
- **Tension** — à quel point la courbe se courbe vers les contrôles
- **Gizmo** — poignée translate/rotate/scale à l'écran pour un point

## Essayez en environ 60 secondes

1. Ouvrir la [démo Spline Editor](/demos/spline-editor/)
2. Tirer points de contrôle avec le gizmo
3. Basculer uniform / centripetal / chordal et comparer la courbure
4. Exporter ou copier data Vector3 si l'UI le propose — rail caméra

## Prérequis et performances

- **Navigateur :** navigateur WebGL moderne (Chrome, Edge, Firefox, Safari)
- **Entrée :** souris pour drags gizmo ; desktop plus facile
- **API :** famille exemple Three.js WebGL — pas WebGPU

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Chemin complet — points contrôle et courbe Catmull-Rom lisse](/assets/blog/spline-editor/view-a.jpg?v=20260722a)

![Edit gizmo — reshape local du rail](/assets/blog/spline-editor/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Alimenter exports dans caméras fly-through
- Associer au WebGPU curve modifier pour type-on-path
- Utiliser upstream [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor)

## Comment ça marche

Points contrôle définissent une `CatmullRomCurve3` ; l'éditeur visualise polyligne/courbe et permet transformer points. Type courbe et tension changent paramétrisation. Upstream : [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_geometry_spline_editor.html)). Exporter points connecte aux outils chemin IOM et au [WebGPU curve modifier](/demos/webgpu-modifier-curve/).

## FAQ

**Quel type de courbe choisir ?**  
Centripetal est un default sûr contre cuspides ; comparer dans l'UI pour votre chemin.

**Peut-il piloter une vraie caméra sur site client ?**  
Oui — nous câblons points exportés dans un contrôleur caméra production.

## Stack technique et lectures

- [three.js — spline editor](https://threejs.org/examples/#webgl_geometry_spline_editor)
- [Catmull–Rom spline — Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline)
- [Three.js](https://threejs.org/)

## Sur IOM

Parcourez [Expériences](/#experiments), plus [WebGPU Curve Modifier](/blog/webgpu-modifier-curve), [Terrain Sandbox](/blog/terrain-sandbox), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$Catmull Spline Editor — chemins à faire glisser — IOM$iom$,
  $iom$Chemins Catmull-Rom interactifs avec gizmos transform — comparer uniform, centripetal et chordal, tuner tension, exporter tableaux `Vector3` pour rails caméra et chemins objets.$iom$
from public.blog_posts p
where p.slug = $iom$spline-editor$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$Catmull Spline Editor — paden die je kunt slepen$iom$,
  $iom$Interactieve Catmull-Rom-paden met transform-gizmos — uniform, centripetal en chordal vergelijken, spanning tunen en `Vector3`-arrays exporteren voor camera rails en objectpaden.$iom$,
  $iom$Interactieve Catmull-Rom-paden met transform-gizmos — uniform, centripetal en chordal vergelijken, spanning tunen en `Vector3`-arrays exporteren voor camera rails en objectpaden.

Het staat in onze [Experimenten-sectie](/#experiments) als **Catmull Spline Editor**. De cover toont de bewerkbare spline met controlepunten en kurvetype-contrast.

## Open de live demo

**[→ Start Catmull Spline Editor](/demos/spline-editor/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Paden visueel authoriseren** — geen coördinatenlijsten eerst intypen
- **Kurvetype-vergelijking** — uniform vs centripetal vs chordal op één plek
- **Export-ready** — Vector3-arrays voor rails, fly-throughs en modifiers
- **WebGL-betrouwbaarheid** — werkt waar WebGPU nog niet beschikbaar is

Typische toepassingen: camerapadplanning, product-turntable rails en briefingtools voor motion.

## Voor beginners — wat is dit, in gewone taal?

Een spline is een gladde curve geleid door enkele controlepunten — als een flexibele liniaal. Sleep de punten en het pad update. Filmmakers en games gebruiken hetzelfde idee voor camerabewegingen; hier bewerk je het in de browser.

**Korte glossary**

- **Catmull-Rom** — splinefamilie die door controlepunten interpoleert
- **Centripetal** — parametrisatie die meestal beter lussen/cuspes vermijdt dan uniform
- **Tension** — hoe strak de curve naar de controles buigt
- **Gizmo** — translate/rotate/scale-handle op scherm voor een punt

## Probeer dit in ongeveer 60 seconden

1. Open de [Spline Editor-demo](/demos/spline-editor/)
2. Sleep controlepunten met de gizmo
3. Schakel uniform / centripetal / chordal en vergelijk de buiging
4. Exporteer of kopieer Vector3-data als de UI het biedt — als camera rail

## Vereisten en performance

- **Browser:** moderne WebGL-browser (Chrome, Edge, Firefox, Safari)
- **Input:** muis voor gizmo-drags; desktop is het makkelijkst
- **API:** WebGL Three.js-voorbeeldfamilie — niet WebGPU

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Volledig pad — controlepunten en gladde Catmull-Rom-curve](/assets/blog/spline-editor/view-a.jpg?v=20260722a)

![Gizmo-edit — lokale herformulering van de rail](/assets/blog/spline-editor/view-b.jpg?v=20260722a)

Ook in deze build:

- Exports voeden in fly-through-camera's
- Koppelen met WebGPU curve modifier voor type-on-path
- Upstream [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor) gebruiken

## Hoe het werkt

Controlepunten definiëren een `CatmullRomCurve3`; de editor visualiseert polyline/curve en laat punten transformeren. Kurvetype en spanning wijzigen parametrisatie. Upstream: [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor) ([bron](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_geometry_spline_editor.html)). Exporteren van punten verbindt met IOM-padtools en de [WebGPU curve modifier](/demos/webgpu-modifier-curve/).

## FAQ

**Welk kurvetype moet ik kiezen?**  
Centripetal is een veilige default tegen scherpe cuspes; vergelijk in de UI voor uw pad.

**Kan dit een echte camera op een clientsite aansturen?**  
Ja — we koppelen geëxporteerde punten aan een production cameracontroller.

## Tech stack en verder lezen

- [three.js — spline editor](https://threejs.org/examples/#webgl_geometry_spline_editor)
- [Catmull–Rom spline — Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline)
- [Three.js](https://threejs.org/)

## Gerelateerd op IOM

Bekijk meer in [Experimenten](/#experiments), plus [WebGPU Curve Modifier](/blog/webgpu-modifier-curve), [Terrain Sandbox](/blog/terrain-sandbox), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$Catmull Spline Editor — paden die je kunt slepen — IOM$iom$,
  $iom$Interactieve Catmull-Rom-paden met transform-gizmos — uniform, centripetal en chordal vergelijken, spanning tunen en `Vector3`-arrays exporteren voor camera rails en objectpaden.$iom$
from public.blog_posts p
where p.slug = $iom$spline-editor$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$Catmull Spline Editor — percorsi da trascinare$iom$,
  $iom$Percorsi Catmull-Rom interattivi con gizmo transform — confronta uniform, centripetal e chordal, regola tensione, esporta array `Vector3` per rail camera e percorsi oggetti.$iom$,
  $iom$Percorsi Catmull-Rom interattivi con gizmo transform — confronta uniform, centripetal e chordal, regola tensione, esporta array `Vector3` per rail camera e percorsi oggetti.

Si trova nella nostra [sezione Esperimenti](/#experiments) come **Catmull Spline Editor**. La cover mostra la spline editabile con punti controllo e contrasto tipo curva.

## Apri la demo live

**[→ Avvia Catmull Spline Editor](/demos/spline-editor/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Authorare percorsi visivamente** — niente liste coordinate digitate prima
- **Confronto tipo curva** — uniform vs centripetal vs chordal in un posto
- **Pronto export** — array Vector3 per rail, fly-through e modifier
- **Affidabilità WebGL** — funziona dove WebGPU non è ancora disponibile

Usi tipici: pianificazione percorsi camera, rail turntable prodotto e tool briefing motion.

## Per principianti — cos’è, in parole semplici?

Una spline è una curva liscia guidata da pochi punti controllo — come un righello flessibile. Trascina i punti e il percorso si aggiorna. Filmmaker e giochi usano la stessa idea per movimenti camera; qui lo editi nel browser.

**Glossario rapido**

- **Catmull-Rom** — famiglia spline che interpola attraverso punti controllo
- **Centripetal** — parametrizzazione che di solito evita meglio loop/cuspidi del uniform
- **Tension** — quanto strettamente la curva piega verso i controlli
- **Gizmo** — maniglia translate/rotate/scale on-screen per un punto

## Provalo in circa 60 secondi

1. Apri la [demo Spline Editor](/demos/spline-editor/)
2. Trascina punti controllo con il gizmo
3. Passa uniform / centripetal / chordal e confronta la curvatura
4. Esporta o copia dati Vector3 se l'UI lo offre — rail camera

## Requisiti e prestazioni

- **Browser:** browser WebGL moderno (Chrome, Edge, Firefox, Safari)
- **Input:** mouse per drag gizmo; desktop più facile
- **API:** famiglia esempio Three.js WebGL — non WebGPU

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Percorso completo — punti controllo e curva Catmull-Rom liscia](/assets/blog/spline-editor/view-a.jpg?v=20260722a)

![Edit gizmo — riforma locale del rail](/assets/blog/spline-editor/view-b.jpg?v=20260722a)

Anche in questa build:

- Alimentare export in camere fly-through
- Abbinare al WebGPU curve modifier per type-on-path
- Usare upstream [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor)

## Come funziona

Punti controllo definiscono una `CatmullRomCurve3`; l'editor visualizza polilinea/curva e permette trasformare punti. Tipo curva e tensione cambiano parametrizzazione. Upstream: [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor) ([sorgente](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_geometry_spline_editor.html)). Esportare punti collega agli strumenti percorso IOM e al [WebGPU curve modifier](/demos/webgpu-modifier-curve/).

## FAQ

**Quale tipo curva scegliere?**  
Centripetal è default sicuro contro cuspidi; confronta nell'UI per il tuo percorso.

**Può guidare una camera reale su sito client?**  
Sì — colleghiamo punti esportati a un controller camera production.

## Stack tecnico e letture

- [three.js — spline editor](https://threejs.org/examples/#webgl_geometry_spline_editor)
- [Catmull–Rom spline — Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline)
- [Three.js](https://threejs.org/)

## Correlati su IOM

Esplora di più in [Esperimenti](/#experiments), più [WebGPU Curve Modifier](/blog/webgpu-modifier-curve), [Terrain Sandbox](/blog/terrain-sandbox), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$Catmull Spline Editor — percorsi da trascinare — IOM$iom$,
  $iom$Percorsi Catmull-Rom interattivi con gizmo transform — confronta uniform, centripetal e chordal, regola tensione, esporta array `Vector3` per rail camera e percorsi oggetti.$iom$
from public.blog_posts p
where p.slug = $iom$spline-editor$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$Catmull Spline Editor — caminos que puedes arrastrar$iom$,
  $iom$Caminos Catmull-Rom interactivos con gizmos transform — compara uniform, centripetal y chordal, ajusta tensión y exporta arrays `Vector3` para rails de cámara y caminos de objetos.$iom$,
  $iom$Caminos Catmull-Rom interactivos con gizmos transform — compara uniform, centripetal y chordal, ajusta tensión y exporta arrays `Vector3` para rails de cámara y caminos de objetos.

Está en nuestra [sección Experimentos](/#experiments) como **Catmull Spline Editor**. La portada muestra la spline editable con puntos de control y contraste de tipo de curva.

## Abrir la demo en vivo

**[→ Lanzar Catmull Spline Editor](/demos/spline-editor/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Authorar caminos visualmente** — sin teclear listas de coordenadas primero
- **Comparación de tipo de curva** — uniform vs centripetal vs chordal en un lugar
- **Listo para export** — arrays Vector3 para rails, fly-throughs y modifiers
- **Fiabilidad WebGL** — funciona donde WebGPU aún no está disponible

Usos típicos: planificación de caminos de cámara, rails turntable de producto y herramientas briefing de motion.

## Para principiantes — ¿qué es esto, en palabras simples?

Una spline es una curva suave guiada por pocos puntos de control — como una regla flexible. Arrastra los puntos y el camino se actualiza. Cine y juegos usan la misma idea para movimientos de cámara; aquí lo editas en el navegador.

**Glosario rápido**

- **Catmull-Rom** — familia spline que interpola a través de puntos de control
- **Centripetal** — parametrización que suele evitar mejor bucles/cúspides que uniform
- **Tension** — qué tan fuerte la curva se curva hacia los controles
- **Gizmo** — manija translate/rotate/scale en pantalla para un punto

## Pruébalo en unos 60 segundos

1. Abre la [demo Spline Editor](/demos/spline-editor/)
2. Arrastra puntos de control con el gizmo
3. Cambia uniform / centripetal / chordal y compara la curvatura
4. Exporta o copia datos Vector3 si la UI lo ofrece — rail de cámara

## Requisitos y rendimiento

- **Navegador:** navegador WebGL moderno (Chrome, Edge, Firefox, Safari)
- **Input:** ratón para drags de gizmo; desktop es más fácil
- **API:** familia ejemplo Three.js WebGL — no WebGPU

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Camino completo — puntos de control y curva Catmull-Rom suave](/assets/blog/spline-editor/view-a.jpg?v=20260722a)

![Edición gizmo — reforma local del rail](/assets/blog/spline-editor/view-b.jpg?v=20260722a)

También en este build:

- Alimentar exports en cámaras fly-through
- Emparejar con WebGPU curve modifier para type-on-path
- Usar upstream [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor)

## Cómo funciona

Puntos de control definen una `CatmullRomCurve3`; el editor visualiza polilínea/curva y permite transformar puntos. Tipo de curva y tensión cambian parametrización. Upstream: [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor) ([fuente](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_geometry_spline_editor.html)). Exportar puntos conecta con herramientas de camino IOM y el [WebGPU curve modifier](/demos/webgpu-modifier-curve/).

## FAQ

**¿Qué tipo de curva elegir?**  
Centripetal es default seguro contra cúspides; compara en la UI para tu camino.

**¿Puede conducir una cámara real en sitio cliente?**  
Sí — conectamos puntos exportados a un controlador de cámara de producción.

## Stack técnico y lecturas

- [three.js — spline editor](https://threejs.org/examples/#webgl_geometry_spline_editor)
- [Catmull–Rom spline — Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline)
- [Three.js](https://threejs.org/)

## Relacionado en IOM

Explora más en [Experimentos](/#experiments), más [WebGPU Curve Modifier](/blog/webgpu-modifier-curve), [Terrain Sandbox](/blog/terrain-sandbox), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$Catmull Spline Editor — caminos que puedes arrastrar — IOM$iom$,
  $iom$Caminos Catmull-Rom interactivos con gizmos transform — compara uniform, centripetal y chordal, ajusta tensión y exporta arrays `Vector3` para rails de cámara y caminos de objetos.$iom$
from public.blog_posts p
where p.slug = $iom$spline-editor$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$Terrain Sandbox — paint a world from noise$iom$,
  $iom$Layered noise becomes hills you can orbit — drop trees, rocks, and markers, regenerate seeds, tune height and roughness. An IOM WebGL sandbox MVP toward brushes, GLTF, and real DEM$iom$,
  $iom$Layered noise becomes hills you can orbit — drop trees, rocks, and markers, regenerate seeds, tune height and roughness. An IOM WebGL sandbox MVP toward brushes, GLTF, and real DEM data.

It lives in our [Experiments section](/#experiments) as **Terrain Sandbox**. The cover shows a seeded terrain patch with scattered props.

## Open the live demo

**[→ Launch Terrain Sandbox](/demos/terrain-sandbox/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Playable landscape** — stakeholders understand site mood fast
- **Seed + knobs** — reproducible variants for art direction
- **Props on the surface** — trees/rocks/markers for scale stories
- **Roadmap-friendly** — MVP toward sculpt, GLTF, MapTiler DEM

Typical uses: early environment pitches, game-like previews, and workshop tools for layout talks.

## For beginners — what is this, in plain words?

The ground is not sculpted by hand yet — math (noise) invents hills. You change how tall and rough they are, plant a few objects so the scale feels real, and spin around as if scouting a location.

**Quick glossary**

- **Procedural terrain** — landscape generated from algorithms instead of a scanned mesh
- **Seed** — number that makes the same random landscape reproducible
- **DEM** — digital elevation model — real-world height data (future path)
- **WebGL** — browser 3D API used by this sandbox

## Try this in about 60 seconds

1. Open the [Terrain Sandbox demo](/demos/terrain-sandbox/)
2. Orbit the terrain; regenerate seed for a new landform
3. Tune height and roughness
4. Place trees, rocks, or markers and re-check silhouette

## Requirements and performance

- **Browser:** modern WebGL browser
- **GPU:** larger grids cost more — reduce resolution on light devices
- **Network:** none required for core noise terrain (props are local to the demo)

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Wide landform — noise hills with readable ridgelines](/assets/blog/terrain-sandbox/view-a.jpg?v=20260722a)

![Prop pass — trees/rocks giving human scale](/assets/blog/terrain-sandbox/view-b.jpg?v=20260722a)

Also in this build:

- Save favorite seeds as art-direction references
- Plan a follow-up with sculpt brushes or GLTF props
- Compare with real-world tiles in Procedural GL

## How it works

Layered noise samples build a heightmap; a mesh is displaced and shaded; props raycast or height-sample onto the surface. The stack is Three.js on **WebGL** for broad support. This is an IOM sandbox MVP — not a three.js stock example — with a path toward brushes, asset import, and optional MapTiler DEM for real sites.

## FAQ

**Is this real geography?**  
Not yet — procedural noise. Real DEM / MapTiler is on the roadmap for site-true work.

**WebGL or WebGPU?**  
WebGL for this sandbox so more devices can open the link.

## Tech stack and further reading

- [Three.js](https://threejs.org/)
- [MapTiler](https://www.maptiler.com/)
- [Procedural noise (intro)](https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web/Building_up_a_basic_demo_with_Three.js)

## Related on IOM

Browse more in [Experiments](/#experiments), plus [Procedural GL Terrain](/blog/procedural-gl), [WebGPU TSL Raging Sea](/blog/webgpu-tsl-raging-sea), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$Terrain Sandbox — paint a world from noise — IOM$iom$,
  $iom$Layered noise becomes hills you can orbit — drop trees, rocks, and markers, regenerate seeds, tune height and roughness. An IOM WebGL sandbox MVP toward brushes, GLTF, and real DEM$iom$
from public.blog_posts p
where p.slug = $iom$terrain-sandbox$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$Terrain Sandbox — eine Welt aus Noise malen$iom$,
  $iom$Geschichtetes Noise wird zu Hügeln, die Sie orbitieren können — Bäume, Felsen und Marker platzieren, Seeds regenerieren, Höhe und Rauheit tunen. Ein IOM WebGL-Sandbox-MVP Richtung $iom$,
  $iom$Geschichtetes Noise wird zu Hügeln, die Sie orbitieren können — Bäume, Felsen und Marker platzieren, Seeds regenerieren, Höhe und Rauheit tunen. Ein IOM WebGL-Sandbox-MVP Richtung Brushes, GLTF und echte DEM-Daten.

Es liegt in unserem [Experimente-Bereich](/#experiments) als **Terrain Sandbox**. Das Cover zeigt ein geseedetes Terrain-Patch mit verstreuten Props.

## Live-Demo öffnen

**[→ Terrain Sandbox starten](/demos/terrain-sandbox/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Spielbare Landschaft** — Stakeholder verstehen Site-Mood schnell
- **Seed + Knobs** — reproduzierbare Varianten für Art Direction
- **Props auf der Oberfläche** — Bäume/Felsen/Marker für Scale-Stories
- **Roadmap-freundlich** — MVP Richtung Sculpt, GLTF, MapTiler DEM

Typische Einsätze: frühe Umgebungs-Pitches, game-ähnliche Previews und Workshop-Tools für Layout-Gespräche.

## Für Einsteiger — was ist das, in einfachen Worten?

Der Boden ist noch nicht von Hand sculptiert — Mathematik (Noise) erfindet Hügel. Sie ändern, wie hoch und rau sie sind, pflanzen ein paar Objekte, damit die Skala real wirkt, und drehen sich, als würden Sie einen Standort erkunden.

**Kurzes Glossar**

- **Procedural terrain** — Landschaft aus Algorithmen statt gescanntem Mesh
- **Seed** — Zahl, die dieselbe zufällige Landschaft reproduzierbar macht
- **DEM** — digital elevation model — echte Höhendaten (Zukunftspfad)
- **WebGL** — Browser-3D-API dieser Sandbox

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [Terrain Sandbox Demo](/demos/terrain-sandbox/)
2. Orbitieren Sie das Terrain; regenerieren Sie Seed für neues Landform
3. Höhe und Rauheit tunen
4. Bäume, Felsen oder Marker platzieren und Silhouette neu prüfen

## Anforderungen und Performance

- **Browser:** moderner WebGL-Browser
- **GPU:** größere Grids kosten mehr — Auflösung auf leichten Geräten senken
- **Netzwerk:** nicht nötig für Kern-Noise-Terrain (Props sind lokal zur Demo)

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Weite Landform — Noise-Hügel mit lesbaren Gratlinien](/assets/blog/terrain-sandbox/view-a.jpg?v=20260722a)

![Prop-Pass — Bäume/Felsen geben menschliche Skala](/assets/blog/terrain-sandbox/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Lieblings-Seeds als Art-Direction-Referenzen speichern
- Follow-up mit Sculpt-Brushes oder GLTF-Props planen
- Mit echten Tiles in Procedural GL vergleichen

## So funktioniert es

Geschichtete Noise-Samples bauen eine Heightmap; ein Mesh wird displaced und geschattet; Props raycasten oder height-samplen auf die Oberfläche. Der Stack ist Three.js auf **WebGL** für breite Unterstützung. Das ist ein IOM-Sandbox-MVP — kein three.js-Stock-Beispiel — mit Pfad zu Brushes, Asset-Import und optionalem MapTiler DEM für echte Sites.

## FAQ

**Ist das echte Geografie?**  
Noch nicht — prozedurales Noise. Echtes DEM / MapTiler ist auf der Roadmap für site-true Arbeit.

**WebGL oder WebGPU?**  
WebGL für diese Sandbox, damit mehr Geräte den Link öffnen können.

## Tech-Stack und weiterführende Links

- [Three.js](https://threejs.org/)
- [MapTiler](https://www.maptiler.com/)
- [Procedural noise (intro)](https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web/Building_up_a_basic_demo_with_Three.js)

## Verwandt bei IOM

Mehr in [Experimente](/#experiments), plus [Procedural GL Terrain](/blog/procedural-gl), [WebGPU TSL Raging Sea](/blog/webgpu-tsl-raging-sea), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$Terrain Sandbox — eine Welt aus Noise malen — IOM$iom$,
  $iom$Geschichtetes Noise wird zu Hügeln, die Sie orbitieren können — Bäume, Felsen und Marker platzieren, Seeds regenerieren, Höhe und Rauheit tunen. Ein IOM WebGL-Sandbox-MVP Richtung $iom$
from public.blog_posts p
where p.slug = $iom$terrain-sandbox$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$Terrain Sandbox — peindre un monde depuis le bruit$iom$,
  $iom$Bruit en couches devient collines à orbiter — placer arbres, rochers et marqueurs, régénérer seeds, tuner hauteur et rugosité. Un MVP sandbox WebGL IOM vers brushes, GLTF et vraies$iom$,
  $iom$Bruit en couches devient collines à orbiter — placer arbres, rochers et marqueurs, régénérer seeds, tuner hauteur et rugosité. Un MVP sandbox WebGL IOM vers brushes, GLTF et vraies data DEM.

Il se trouve dans notre [section Expériences](/#experiments) sous **Terrain Sandbox**. La couverture montre un patch terrain seedé avec props dispersés.

## Ouvrir la démo en direct

**[→ Lancer Terrain Sandbox](/demos/terrain-sandbox/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Paysage jouable** — stakeholders comprennent mood site vite
- **Seed + knobs** — variantes reproductibles pour direction artistique
- **Props sur surface** — arbres/rochers/marqueurs pour histoires d'échelle
- **Roadmap-friendly** — MVP vers sculpt, GLTF, MapTiler DEM

Usages typiques : pitches environnement précoces, previews type jeu et outils atelier pour talks layout.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Le sol n'est pas encore sculpté à la main — des maths (bruit) inventent collines. Vous changez hauteur et rugosité, plantez quelques objets pour que l'échelle paraisse réelle, et tournez comme en repérage.

**Glossaire rapide**

- **Procedural terrain** — paysage généré par algorithmes au lieu d'un mesh scanné
- **Seed** — nombre rendant le même paysage aléatoire reproductible
- **DEM** — digital elevation model — data hauteur réelle (voie future)
- **WebGL** — API 3D navigateur utilisée par cette sandbox

## Essayez en environ 60 secondes

1. Ouvrir la [démo Terrain Sandbox](/demos/terrain-sandbox/)
2. Orbiter le terrain ; régénérer seed pour nouveau relief
3. Tuner hauteur et rugosité
4. Placer arbres, rochers ou marqueurs et revoir silhouette

## Prérequis et performances

- **Navigateur :** navigateur WebGL moderne
- **GPU :** grilles plus grandes coûtent plus — réduire résolution sur appareils légers
- **Réseau :** non requis pour terrain bruit core (props locaux à la démo)

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Relief large — collines bruit avec crêtes lisibles](/assets/blog/terrain-sandbox/view-a.jpg?v=20260722a)

![Pass props — arbres/rochers donnant échelle humaine](/assets/blog/terrain-sandbox/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Sauver seeds favoris comme références direction artistique
- Planifier suite avec brushes sculpt ou props GLTF
- Comparer avec vraies tuiles dans Procedural GL

## Comment ça marche

Échantillons bruit en couches construisent heightmap ; mesh displaced et ombré ; props raycast ou height-sample sur surface. Stack Three.js sur **WebGL** pour support large. MVP sandbox IOM — pas exemple stock three.js — avec voie vers brushes, import assets et MapTiler DEM optionnel pour vrais sites.

## FAQ

**Est-ce vraie géographie ?**  
Pas encore — bruit procédural. Vrai DEM / MapTiler sur roadmap pour travail site-true.

**WebGL ou WebGPU ?**  
WebGL pour cette sandbox afin que plus d'appareils ouvrent le lien.

## Stack technique et lectures

- [Three.js](https://threejs.org/)
- [MapTiler](https://www.maptiler.com/)
- [Procedural noise (intro)](https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web/Building_up_a_basic_demo_with_Three.js)

## Sur IOM

Parcourez [Expériences](/#experiments), plus [Procedural GL Terrain](/blog/procedural-gl), [WebGPU TSL Raging Sea](/blog/webgpu-tsl-raging-sea), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$Terrain Sandbox — peindre un monde depuis le bruit — IOM$iom$,
  $iom$Bruit en couches devient collines à orbiter — placer arbres, rochers et marqueurs, régénérer seeds, tuner hauteur et rugosité. Un MVP sandbox WebGL IOM vers brushes, GLTF et vraies$iom$
from public.blog_posts p
where p.slug = $iom$terrain-sandbox$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$Terrain Sandbox — een wereld schilderen uit noise$iom$,
  $iom$Gelaagde noise wordt heuvels die je kunt orbiten — bomen, rotsen en markers plaatsen, seeds regenereren, hoogte en ruwheid tunen. Een IOM WebGL-sandbox-MVP richting brushes, GLTF e$iom$,
  $iom$Gelaagde noise wordt heuvels die je kunt orbiten — bomen, rotsen en markers plaatsen, seeds regenereren, hoogte en ruwheid tunen. Een IOM WebGL-sandbox-MVP richting brushes, GLTF en echte DEM-data.

Het staat in onze [Experimenten-sectie](/#experiments) als **Terrain Sandbox**. De cover toont een geseed terreinpatch met verspreide props.

## Open de live demo

**[→ Start Terrain Sandbox](/demos/terrain-sandbox/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Speelbaar landschap** — stakeholders begrijpen site-sfeer snel
- **Seed + knoppen** — reproduceerbare varianten voor art direction
- **Props op het oppervlak** — bomen/rotsen/markers voor schaalverhalen
- **Roadmap-vriendelijk** — MVP richting sculpt, GLTF, MapTiler DEM

Typische toepassingen: vroege omgevingspitches, game-achtige previews en workshoptools voor layoutgesprekken.

## Voor beginners — wat is dit, in gewone taal?

De grond is nog niet met de hand gesculpt — wiskunde (noise) bedenkt heuvels. Je verandert hoe hoog en ruw ze zijn, plant enkele objecten zodat schaal echt voelt, en draait rond alsof je een locatie verkent.

**Korte glossary**

- **Procedural terrain** — landschap gegenereerd uit algoritmen in plaats van gescand mesh
- **Seed** — getal dat hetzelfde willekeurige landschap reproduceerbaar maakt
- **DEM** — digital elevation model — echte hoogtedata (toekomstpad)
- **WebGL** — browser-3D-API gebruikt door deze sandbox

## Probeer dit in ongeveer 60 seconden

1. Open de [Terrain Sandbox-demo](/demos/terrain-sandbox/)
2. Orbit het terrein; regenereer seed voor nieuw landvorm
3. Tune hoogte en ruwheid
4. Plaats bomen, rotsen of markers en check silhouet opnieuw

## Vereisten en performance

- **Browser:** moderne WebGL-browser
- **GPU:** grotere grids kosten meer — verlaag resolutie op lichte devices
- **Netwerk:** niet vereist voor kern-noise-terrein (props lokaal aan demo)

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Brede landvorm — noise-heuvels met leesbare graatlijnen](/assets/blog/terrain-sandbox/view-a.jpg?v=20260722a)

![Props-pass — bomen/rotsen geven menselijke schaal](/assets/blog/terrain-sandbox/view-b.jpg?v=20260722a)

Ook in deze build:

- Favoriete seeds opslaan als art-direction-referenties
- Follow-up plannen met sculpt-brushes of GLTF-props
- Vergelijk met echte tiles in Procedural GL

## Hoe het werkt

Gelaagde noise-samples bouwen een heightmap; een mesh wordt displaced en geschaduwd; props raycasten of height-samplen op het oppervlak. De stack is Three.js op **WebGL** voor brede ondersteuning. Dit is een IOM-sandbox-MVP — geen three.js stockvoorbeeld — met pad naar brushes, asset-import en optionele MapTiler DEM voor echte sites.

## FAQ

**Is dit echte geografie?**  
Nog niet — procedurele noise. Echte DEM / MapTiler staat op de roadmap voor site-true werk.

**WebGL of WebGPU?**  
WebGL voor deze sandbox zodat meer devices de link kunnen openen.

## Tech stack en verder lezen

- [Three.js](https://threejs.org/)
- [MapTiler](https://www.maptiler.com/)
- [Procedural noise (intro)](https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web/Building_up_a_basic_demo_with_Three.js)

## Gerelateerd op IOM

Bekijk meer in [Experimenten](/#experiments), plus [Procedural GL Terrain](/blog/procedural-gl), [WebGPU TSL Raging Sea](/blog/webgpu-tsl-raging-sea), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$Terrain Sandbox — een wereld schilderen uit noise — IOM$iom$,
  $iom$Gelaagde noise wordt heuvels die je kunt orbiten — bomen, rotsen en markers plaatsen, seeds regenereren, hoogte en ruwheid tunen. Een IOM WebGL-sandbox-MVP richting brushes, GLTF e$iom$
from public.blog_posts p
where p.slug = $iom$terrain-sandbox$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$Terrain Sandbox — dipingere un mondo dal noise$iom$,
  $iom$Noise a strati diventa colline da orbitare — pianta alberi, rocce e marker, rigenera seed, regola altezza e rugosità. Un MVP sandbox WebGL IOM verso brush, GLTF e dati DEM reali.$iom$,
  $iom$Noise a strati diventa colline da orbitare — pianta alberi, rocce e marker, rigenera seed, regola altezza e rugosità. Un MVP sandbox WebGL IOM verso brush, GLTF e dati DEM reali.

Si trova nella nostra [sezione Esperimenti](/#experiments) come **Terrain Sandbox**. La cover mostra una patch terreno seedata con props sparsi.

## Apri la demo live

**[→ Avvia Terrain Sandbox](/demos/terrain-sandbox/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Paesaggio giocabile** — stakeholder capiscono mood sito velocemente
- **Seed + manopole** — varianti riproducibili per art direction
- **Props sulla superficie** — alberi/rocce/marker per storie di scala
- **Roadmap-friendly** — MVP verso sculpt, GLTF, MapTiler DEM

Usi tipici: pitch ambientali precoci, preview tipo gioco e tool workshop per talk layout.

## Per principianti — cos’è, in parole semplici?

Il terreno non è ancora scolpito a mano — la matematica (noise) inventa colline. Cambi quanto sono alte e ruvide, pianti qualche oggetto perché la scala sembri reale, e giri come esplorando un sito.

**Glossario rapido**

- **Procedural terrain** — paesaggio generato da algoritmi invece di mesh scansionata
- **Seed** — numero che rende riproducibile lo stesso paesaggio casuale
- **DEM** — digital elevation model — dati altezza reali (percorso futuro)
- **WebGL** — API 3D browser usata da questa sandbox

## Provalo in circa 60 secondi

1. Apri la [demo Terrain Sandbox](/demos/terrain-sandbox/)
2. Orbita il terreno; rigenera seed per nuova landform
3. Regola altezza e rugosità
4. Piazza alberi, rocce o marker e ricontrolla silhouette

## Requisiti e prestazioni

- **Browser:** browser WebGL moderno
- **GPU:** griglie più grandi costano di più — riduci risoluzione su device leggeri
- **Rete:** non richiesta per terreno noise core (props locali alla demo)

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Landform ampia — colline noise con crinali leggibili](/assets/blog/terrain-sandbox/view-a.jpg?v=20260722a)

![Pass props — alberi/rocce danno scala umana](/assets/blog/terrain-sandbox/view-b.jpg?v=20260722a)

Anche in questa build:

- Salvare seed preferiti come riferimenti art direction
- Pianificare follow-up con brush sculpt o props GLTF
- Confrontare con tile reali in Procedural GL

## Come funziona

Campioni noise a strati costruiscono heightmap; mesh displaced e ombreggiata; props raycast o height-sample sulla superficie. Stack Three.js su **WebGL** per supporto ampio. MVP sandbox IOM — non esempio stock three.js — con percorso verso brush, import asset e MapTiler DEM opzionale per siti reali.

## FAQ

**È geografia reale?**  
Non ancora — noise procedurale. DEM / MapTiler reali in roadmap per lavoro site-true.

**WebGL o WebGPU?**  
WebGL per questa sandbox così più device aprono il link.

## Stack tecnico e letture

- [Three.js](https://threejs.org/)
- [MapTiler](https://www.maptiler.com/)
- [Procedural noise (intro)](https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web/Building_up_a_basic_demo_with_Three.js)

## Correlati su IOM

Esplora di più in [Esperimenti](/#experiments), più [Procedural GL Terrain](/blog/procedural-gl), [WebGPU TSL Raging Sea](/blog/webgpu-tsl-raging-sea), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$Terrain Sandbox — dipingere un mondo dal noise — IOM$iom$,
  $iom$Noise a strati diventa colline da orbitare — pianta alberi, rocce e marker, rigenera seed, regola altezza e rugosità. Un MVP sandbox WebGL IOM verso brush, GLTF e dati DEM reali.$iom$
from public.blog_posts p
where p.slug = $iom$terrain-sandbox$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$Terrain Sandbox — pintar un mundo desde noise$iom$,
  $iom$Noise en capas se convierte en colinas que puedes orbitar — coloca árboles, rocas y marcadores, regenera seeds, ajusta altura y rugosidad. Un MVP sandbox WebGL IOM hacia brushes, G$iom$,
  $iom$Noise en capas se convierte en colinas que puedes orbitar — coloca árboles, rocas y marcadores, regenera seeds, ajusta altura y rugosidad. Un MVP sandbox WebGL IOM hacia brushes, GLTF y datos DEM reales.

Está en nuestra [sección Experimentos](/#experiments) como **Terrain Sandbox**. La portada muestra un parche de terreno con seed y props dispersos.

## Abrir la demo en vivo

**[→ Lanzar Terrain Sandbox](/demos/terrain-sandbox/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Paisaje jugable** — stakeholders entienden mood del sitio rápido
- **Seed + perillas** — variantes reproducibles para dirección artística
- **Props en superficie** — árboles/rocas/marcadores para historias de escala
- **Roadmap-friendly** — MVP hacia sculpt, GLTF, MapTiler DEM

Usos típicos: pitches de entorno tempranos, previews tipo juego y herramientas workshop para charlas de layout.

## Para principiantes — ¿qué es esto, en palabras simples?

El suelo aún no está esculpido a mano — matemáticas (noise) inventan colinas. Cambias qué tan altas y rugosas son, plantas algunos objetos para que la escala se sienta real, y giras como explorando un sitio.

**Glosario rápido**

- **Procedural terrain** — paisaje generado por algoritmos en lugar de malla escaneada
- **Seed** — número que hace reproducible el mismo paisaje aleatorio
- **DEM** — digital elevation model — datos de altura reales (ruta futura)
- **WebGL** — API 3D de navegador usada por este sandbox

## Pruébalo en unos 60 segundos

1. Abre la [demo Terrain Sandbox](/demos/terrain-sandbox/)
2. Orbita el terreno; regenera seed para nueva landform
3. Ajusta altura y rugosidad
4. Coloca árboles, rocas o marcadores y revisa silueta

## Requisitos y rendimiento

- **Navegador:** navegador WebGL moderno
- **GPU:** grids más grandes cuestan más — reduce resolución en dispositivos ligeros
- **Red:** no requerida para terreno noise core (props locales a la demo)

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Landform amplia — colinas noise con crestas legibles](/assets/blog/terrain-sandbox/view-a.jpg?v=20260722a)

![Pass props — árboles/rocas dando escala humana](/assets/blog/terrain-sandbox/view-b.jpg?v=20260722a)

También en este build:

- Guardar seeds favoritos como referencias de dirección artística
- Planear follow-up con brushes sculpt o props GLTF
- Comparar con tiles reales en Procedural GL

## Cómo funciona

Muestras noise en capas construyen heightmap; malla displaced y sombreada; props raycast o height-sample en superficie. Stack Three.js en **WebGL** para soporte amplio. MVP sandbox IOM — no ejemplo stock three.js — con ruta hacia brushes, import de assets y MapTiler DEM opcional para sitios reales.

## FAQ

**¿Es geografía real?**  
Aún no — noise procedural. DEM / MapTiler real en roadmap para trabajo site-true.

**¿WebGL o WebGPU?**  
WebGL para este sandbox para que más dispositivos abran el enlace.

## Stack técnico y lecturas

- [Three.js](https://threejs.org/)
- [MapTiler](https://www.maptiler.com/)
- [Procedural noise (intro)](https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web/Building_up_a_basic_demo_with_Three.js)

## Relacionado en IOM

Explora más en [Experimentos](/#experiments), más [Procedural GL Terrain](/blog/procedural-gl), [WebGPU TSL Raging Sea](/blog/webgpu-tsl-raging-sea), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$Terrain Sandbox — pintar un mundo desde noise — IOM$iom$,
  $iom$Noise en capas se convierte en colinas que puedes orbitar — coloca árboles, rocas y marcadores, regenera seeds, ajusta altura y rugosidad. Un MVP sandbox WebGL IOM hacia brushes, G$iom$
from public.blog_posts p
where p.slug = $iom$terrain-sandbox$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$Procedural GL Terrain — real-world tiles in 3D$iom$,
  $iom$Real landscapes streamed as GPU LOD terrain — our page embeds the official [procedural.eu](https://www.procedural.eu/map/) map powered by procedural-gl.js (MPL-2.0). First step: th$iom$,
  $iom$Real landscapes streamed as GPU LOD terrain — our page embeds the official [procedural.eu](https://www.procedural.eu/map/) map powered by procedural-gl.js (MPL-2.0). First step: the live upstream demo; a self-hosted MapTiler build can follow.

It lives in our [Experiments section](/#experiments) as **Procedural GL Terrain**. The cover is a live still from the procedural.eu map embed — real MapTiler elevation/imagery tiles in 3D, not a noise sandbox.

## Open the live demo

**[→ Launch Procedural GL Terrain](/demos/procedural-gl/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Why this matters (even if you are not a developer)

- **Real places** — elevation from map tiles, not only noise
- **GPU LOD** — detail where you look, lighter meshes farther out
- **Open-source core** — procedural-gl.js under MPL-2.0
- **Bridge to production** — embed now; self-host later with your key

Typical uses: site context for architecture, location pitches, and geo storytelling on the web.

## For beginners — what is this, in plain words?

Instead of inventing hills, this viewer loads real terrain tiles so you can fly over actual geography in 3D — closer to a lightweight Earth view than a game level made of noise.

**Quick glossary**

- **LOD** — level of detail — more mesh detail near the camera
- **Map tiles** — image/elevation pieces streamed for the current view
- **procedural-gl.js** — open-source library for GPU terrain from map data
- **MapTiler** — tile provider often used for production keys (kept out of the repo)

## Try this in about 60 seconds

1. Open the [Procedural GL demo](/demos/procedural-gl/)
2. Wait for the embedded [procedural.eu map](https://www.procedural.eu/map/) to load
3. Pan and zoom across real terrain
4. Imagine dropping a client building or path on a known ridge

## Requirements and performance

- **Network:** required — tiles and the procedural.eu embed need connectivity
- **Browser:** modern Chromium recommended for WebGL terrain
- **Keys:** production MapTiler keys stay server-side / env — never committed

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Regional view — LOD terrain from streamed tiles](/assets/blog/procedural-gl/view-a.jpg?v=20260722a)

![Closer relief — ridges and valleys reading in 3D](/assets/blog/procedural-gl/view-b.jpg?v=20260722a)

Also in this build:

- Use as context beside a geolocated GLB
- Plan a self-hosted MapTiler-backed fork
- Read docs at [procedural.eu](https://www.procedural.eu/)

## How it works

Our `/demos/procedural-gl/` page embeds the official map experience at [procedural.eu/map](https://www.procedural.eu/map/). Under the hood, [procedural-gl-js](https://github.com/felixpalmer/procedural-gl-js) builds GPU LOD meshes from elevation/imagery tiles (WebGL). IOM’s next step can be a self-hosted build with MapTiler — API keys stay out of the git repo. This is geographic terrain, complementary to the procedural noise [Terrain Sandbox](/demos/terrain-sandbox/).

## FAQ

**Is the map hosted by IOM?**  
This first step embeds procedural.eu. A self-hosted variant is a separate production task.

**WebGL or WebGPU?**  
WebGL terrain streaming via procedural-gl.js — chosen for the library’s stack and tile ecosystem.

## Tech stack and further reading

- [procedural.eu map](https://www.procedural.eu/map/)
- [procedural.eu docs](https://www.procedural.eu/)
- [procedural-gl-js on GitHub](https://github.com/felixpalmer/procedural-gl-js)

## Related on IOM

Browse more in [Experiments](/#experiments), plus [Terrain Sandbox](/blog/terrain-sandbox), [Streets GL Bridge](/blog/streets-gl-bridge), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$Procedural GL Terrain — real-world tiles in 3D — IOM$iom$,
  $iom$Real landscapes streamed as GPU LOD terrain — our page embeds the official [procedural.eu](https://www.procedural.eu/map/) map powered by procedural-gl.js (MPL-2.0). First step: th$iom$
from public.blog_posts p
where p.slug = $iom$procedural-gl$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$Procedural GL Terrain — echte Welt-Tiles in 3D$iom$,
  $iom$Echte Landschaften als GPU-LOD-Terrain gestreamt — unsere Seite embeddet die offizielle [procedural.eu](https://www.procedural.eu/map/) Map powered by procedural-gl.js (MPL-2.0). E$iom$,
  $iom$Echte Landschaften als GPU-LOD-Terrain gestreamt — unsere Seite embeddet die offizielle [procedural.eu](https://www.procedural.eu/map/) Map powered by procedural-gl.js (MPL-2.0). Erster Schritt: live upstream Demo; self-hosted MapTiler Build kann folgen.

Es liegt in unserem [Experimente-Bereich](/#experiments) als **Procedural GL Terrain**. Das Cover ist ein Live-Still vom procedural.eu Map-Embed — echte MapTiler Elevation/Imagery-Tiles in 3D, keine Noise-Sandbox.

## Live-Demo öffnen

**[→ Procedural GL Terrain starten](/demos/procedural-gl/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Echte Orte** — Höhe aus Map-Tiles, nicht nur Noise
- **GPU LOD** — Detail wo Sie hinschauen, leichtere Meshes weiter weg
- **Open-Source-Kern** — procedural-gl.js unter MPL-2.0
- **Brücke zur Production** — jetzt embedden; später self-hosten mit Ihrem Key

Typische Einsätze: Site-Kontext für Architektur, Location-Pitches und Geo-Storytelling im Web.

## Für Einsteiger — was ist das, in einfachen Worten?

Statt Hügel zu erfinden, lädt dieser Viewer echte Terrain-Tiles, damit Sie tatsächliche Geografie in 3D überfliegen können — näher an einer leichten Earth-View als an einem aus Noise gebauten Game-Level.

**Kurzes Glossar**

- **LOD** — level of detail — mehr Mesh-Detail nahe der Kamera
- **Map tiles** — Bild-/Elevation-Stücke für die aktuelle Ansicht gestreamt
- **procedural-gl.js** — Open-Source-Bibliothek für GPU-Terrain aus Map-Daten
- **MapTiler** — Tile-Provider, oft für Production-Keys (nicht im Repo)

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [Procedural GL Demo](/demos/procedural-gl/)
2. Warten Sie, bis der embedded [procedural.eu map](https://www.procedural.eu/map/) lädt
3. Pan und Zoom über echtes Terrain
4. Stellen Sie sich vor, ein Client-Gebäude oder Pfad auf einem bekannten Grat zu platzieren

## Anforderungen und Performance

- **Netzwerk:** erforderlich — Tiles und procedural.eu Embed brauchen Konnektivität
- **Browser:** modernes Chromium für WebGL-Terrain empfohlen
- **Keys:** Production MapTiler Keys bleiben server-side / env — nie committed

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Regionalansicht — LOD-Terrain aus gestreamten Tiles](/assets/blog/procedural-gl/view-a.jpg?v=20260722a)

![Näheres Relief — Grate und Täler lesbar in 3D](/assets/blog/procedural-gl/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Als Kontext neben einem geolokalisierten GLB nutzen
- Self-hosted MapTiler-Fork planen
- Docs auf [procedural.eu](https://www.procedural.eu/) lesen

## So funktioniert es

Unsere `/demos/procedural-gl/` Seite embeddet die offizielle Map-Erfahrung unter [procedural.eu/map](https://www.procedural.eu/map/). Unter der Haube baut [procedural-gl-js](https://github.com/felixpalmer/procedural-gl-js) GPU-LOD-Meshes aus Elevation/Imagery-Tiles (WebGL). IOMs nächster Schritt kann ein self-hosted Build mit MapTiler sein — API-Keys bleiben aus dem Git-Repo. Das ist geografisches Terrain, komplementär zur prozeduralen Noise [Terrain Sandbox](/demos/terrain-sandbox/).

## FAQ

**Wird die Map von IOM gehostet?**  
Dieser erste Schritt embeddet procedural.eu. Eine self-hosted Variante ist eine separate Production-Aufgabe.

**WebGL oder WebGPU?**  
WebGL-Terrain-Streaming via procedural-gl.js — gewählt für Stack und Tile-Ökosystem der Bibliothek.

## Tech-Stack und weiterführende Links

- [procedural.eu map](https://www.procedural.eu/map/)
- [procedural.eu docs](https://www.procedural.eu/)
- [procedural-gl-js on GitHub](https://github.com/felixpalmer/procedural-gl-js)

## Verwandt bei IOM

Mehr in [Experimente](/#experiments), plus [Terrain Sandbox](/blog/terrain-sandbox), [Streets GL Bridge](/blog/streets-gl-bridge), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$Procedural GL Terrain — echte Welt-Tiles in 3D — IOM$iom$,
  $iom$Echte Landschaften als GPU-LOD-Terrain gestreamt — unsere Seite embeddet die offizielle [procedural.eu](https://www.procedural.eu/map/) Map powered by procedural-gl.js (MPL-2.0). E$iom$
from public.blog_posts p
where p.slug = $iom$procedural-gl$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$Procedural GL Terrain — tuiles monde réel en 3D$iom$,
  $iom$Paysages réels streamés en terrain GPU LOD — notre page embed la [procedural.eu](https://www.procedural.eu/map/) map officielle powered by procedural-gl.js (MPL-2.0). Première étap$iom$,
  $iom$Paysages réels streamés en terrain GPU LOD — notre page embed la [procedural.eu](https://www.procedural.eu/map/) map officielle powered by procedural-gl.js (MPL-2.0). Première étape : démo upstream live ; build MapTiler self-hosted peut suivre.

Il se trouve dans notre [section Expériences](/#experiments) sous **Procedural GL Terrain**. La couverture est un still live de l'embed procedural.eu — vraies tuiles élévation/imagerie MapTiler en 3D, pas sandbox bruit.

## Ouvrir la démo en direct

**[→ Lancer Procedural GL Terrain](/demos/procedural-gl/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Pourquoi c’est important (même sans être développeur)

- **Vrais lieux** — élévation depuis tuiles map, pas seulement bruit
- **GPU LOD** — détail où vous regardez, meshes plus légers au loin
- **Cœur open-source** — procedural-gl.js sous MPL-2.0
- **Pont vers production** — embed maintenant ; self-host plus tard avec votre clé

Usages typiques : contexte site architecture, pitches location et geo storytelling web.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Au lieu d'inventer collines, ce viewer charge vraies tuiles terrain pour survoler géographie réelle en 3D — plus proche d'une Earth view légère qu'un niveau jeu fait de bruit.

**Glossaire rapide**

- **LOD** — level of detail — plus de détail mesh près caméra
- **Map tiles** — morceaux image/élévation streamés pour vue actuelle
- **procedural-gl.js** — bibliothèque open-source terrain GPU depuis data map
- **MapTiler** — fournisseur tuiles souvent utilisé pour clés production (hors repo)

## Essayez en environ 60 secondes

1. Ouvrir la [démo Procedural GL](/demos/procedural-gl/)
2. Attendre chargement de la [procedural.eu map](https://www.procedural.eu/map/) embed
3. Pan et zoom sur vrai terrain
4. Imaginer déposer bâtiment client ou chemin sur une crête connue

## Prérequis et performances

- **Réseau :** requis — tuiles et embed procedural.eu demandent connectivité
- **Navigateur :** Chromium moderne recommandé pour terrain WebGL
- **Clés :** clés MapTiler production restent server-side / env — jamais commitées

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Vue régionale — terrain LOD depuis tuiles streamées](/assets/blog/procedural-gl/view-a.jpg?v=20260722a)

![Relief rapproché — crêtes et vallées lisibles en 3D](/assets/blog/procedural-gl/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Utiliser comme contexte à côté d'un GLB géolocalisé
- Planifier fork MapTiler self-hosted
- Lire docs sur [procedural.eu](https://www.procedural.eu/)

## Comment ça marche

Notre page `/demos/procedural-gl/` embed l'expérience map officielle sur [procedural.eu/map](https://www.procedural.eu/map/). Sous le capot, [procedural-gl-js](https://github.com/felixpalmer/procedural-gl-js) construit meshes GPU LOD depuis tuiles élévation/imagerie (WebGL). Prochaine étape IOM : build self-hosted avec MapTiler — clés API hors repo git. Terrain géographique, complémentaire au bruit procédural [Terrain Sandbox](/demos/terrain-sandbox/).

## FAQ

**La map est-elle hébergée par IOM ?**  
Cette première étape embed procedural.eu. Variante self-hosted = tâche production séparée.

**WebGL ou WebGPU ?**  
Streaming terrain WebGL via procedural-gl.js — choisi pour stack bibliothèque et écosystème tuiles.

## Stack technique et lectures

- [procedural.eu map](https://www.procedural.eu/map/)
- [procedural.eu docs](https://www.procedural.eu/)
- [procedural-gl-js on GitHub](https://github.com/felixpalmer/procedural-gl-js)

## Sur IOM

Parcourez [Expériences](/#experiments), plus [Terrain Sandbox](/blog/terrain-sandbox), [Streets GL Bridge](/blog/streets-gl-bridge), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$Procedural GL Terrain — tuiles monde réel en 3D — IOM$iom$,
  $iom$Paysages réels streamés en terrain GPU LOD — notre page embed la [procedural.eu](https://www.procedural.eu/map/) map officielle powered by procedural-gl.js (MPL-2.0). Première étap$iom$
from public.blog_posts p
where p.slug = $iom$procedural-gl$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$Procedural GL Terrain — echte wereldtiles in 3D$iom$,
  $iom$Echte landschappen gestreamd als GPU LOD-terrein — onze pagina embedt de officiële [procedural.eu](https://www.procedural.eu/map/) map powered by procedural-gl.js (MPL-2.0). Eerste$iom$,
  $iom$Echte landschappen gestreamd als GPU LOD-terrein — onze pagina embedt de officiële [procedural.eu](https://www.procedural.eu/map/) map powered by procedural-gl.js (MPL-2.0). Eerste stap: live upstream demo; self-hosted MapTiler build kan volgen.

Het staat in onze [Experimenten-sectie](/#experiments) als **Procedural GL Terrain**. De cover is een live still van de procedural.eu map-embed — echte MapTiler elevation/imagery-tiles in 3D, geen noise-sandbox.

## Open de live demo

**[→ Start Procedural GL Terrain](/demos/procedural-gl/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Echte plaatsen** — hoogte uit maptiles, niet alleen noise
- **GPU LOD** — detail waar je kijkt, lichtere meshes verder weg
- **Open-source kern** — procedural-gl.js onder MPL-2.0
- **Brug naar productie** — embed nu; self-host later met uw key

Typische toepassingen: sitecontext voor architectuur, locatiepitches en geo-storytelling op het web.

## Voor beginners — wat is dit, in gewone taal?

In plaats van heuvels te verzinnen, laadt deze viewer echte terreintiles zodat je werkelijke geografie in 3D kunt overvliegen — dichter bij een lichte Earth view dan een gamelevel van noise.

**Korte glossary**

- **LOD** — level of detail — meer meshdetail nabij camera
- **Map tiles** — beeld/elevatie-stukken gestreamd voor huidige view
- **procedural-gl.js** — open-source bibliotheek voor GPU-terrein uit mapdata
- **MapTiler** — tileprovider vaak gebruikt voor production keys (niet in repo)

## Probeer dit in ongeveer 60 seconden

1. Open de [Procedural GL-demo](/demos/procedural-gl/)
2. Wacht tot de embedded [procedural.eu map](https://www.procedural.eu/map/) laadt
3. Pan en zoom over echt terrein
4. Stel je voor een clientgebouw of pad op een bekende graat te plaatsen

## Vereisten en performance

- **Netwerk:** vereist — tiles en procedural.eu embed hebben connectiviteit nodig
- **Browser:** modern Chromium aanbevolen voor WebGL-terrein
- **Keys:** production MapTiler keys blijven server-side / env — nooit gecommit

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Regionale view — LOD-terrein uit gestreamde tiles](/assets/blog/procedural-gl/view-a.jpg?v=20260722a)

![Nader reliëf — graten en valleien leesbaar in 3D](/assets/blog/procedural-gl/view-b.jpg?v=20260722a)

Ook in deze build:

- Als context naast een geolokaliseerde GLB gebruiken
- Self-hosted MapTiler-fork plannen
- Docs lezen op [procedural.eu](https://www.procedural.eu/)

## Hoe het werkt

Onze `/demos/procedural-gl/` pagina embedt de officiële map-ervaring op [procedural.eu/map](https://www.procedural.eu/map/). Onder de motorkap bouwt [procedural-gl-js](https://github.com/felixpalmer/procedural-gl-js) GPU LOD-meshes uit elevation/imagery-tiles (WebGL). IOMs volgende stap kan een self-hosted build met MapTiler zijn — API-keys blijven uit git repo. Dit is geografisch terrein, complementair aan procedurele noise [Terrain Sandbox](/demos/terrain-sandbox/).

## FAQ

**Wordt de map gehost door IOM?**  
Deze eerste stap embedt procedural.eu. Een self-hosted variant is een aparte productiontaak.

**WebGL of WebGPU?**  
WebGL-terreinstreaming via procedural-gl.js — gekozen voor stack en tile-ecosysteem van de bibliotheek.

## Tech stack en verder lezen

- [procedural.eu map](https://www.procedural.eu/map/)
- [procedural.eu docs](https://www.procedural.eu/)
- [procedural-gl-js on GitHub](https://github.com/felixpalmer/procedural-gl-js)

## Gerelateerd op IOM

Bekijk meer in [Experimenten](/#experiments), plus [Terrain Sandbox](/blog/terrain-sandbox), [Streets GL Bridge](/blog/streets-gl-bridge), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$Procedural GL Terrain — echte wereldtiles in 3D — IOM$iom$,
  $iom$Echte landschappen gestreamd als GPU LOD-terrein — onze pagina embedt de officiële [procedural.eu](https://www.procedural.eu/map/) map powered by procedural-gl.js (MPL-2.0). Eerste$iom$
from public.blog_posts p
where p.slug = $iom$procedural-gl$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$Procedural GL Terrain — tile mondo reale in 3D$iom$,
  $iom$Paesaggi reali streamati come terreno GPU LOD — la nostra pagina embedda la [procedural.eu](https://www.procedural.eu/map/) map ufficiale powered by procedural-gl.js (MPL-2.0). Pri$iom$,
  $iom$Paesaggi reali streamati come terreno GPU LOD — la nostra pagina embedda la [procedural.eu](https://www.procedural.eu/map/) map ufficiale powered by procedural-gl.js (MPL-2.0). Primo passo: demo upstream live; build MapTiler self-hosted può seguire.

Si trova nella nostra [sezione Esperimenti](/#experiments) come **Procedural GL Terrain**. La cover è uno still live dall'embed procedural.eu — tile elevazione/immagini MapTiler reali in 3D, non sandbox noise.

## Apri la demo live

**[→ Avvia Procedural GL Terrain](/demos/procedural-gl/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Perché conta (anche se non sei uno sviluppatore)

- **Luoghi reali** — elevazione da tile map, non solo noise
- **GPU LOD** — dettaglio dove guardi, mesh più leggere lontano
- **Core open-source** — procedural-gl.js sotto MPL-2.0
- **Ponte verso production** — embed ora; self-host dopo con la tua key

Usi tipici: contesto sito architettura, pitch location e geo storytelling web.

## Per principianti — cos’è, in parole semplici?

Invece di inventare colline, questo viewer carica tile terreno reali così puoi sorvolare geografia effettiva in 3D — più vicino a una Earth view leggera che a un livello gioco fatto di noise.

**Glossario rapido**

- **LOD** — level of detail — più dettaglio mesh vicino camera
- **Map tiles** — pezzi immagine/elevazione streamati per vista corrente
- **procedural-gl.js** — libreria open-source terreno GPU da dati map
- **MapTiler** — provider tile spesso usato per key production (fuori repo)

## Provalo in circa 60 secondi

1. Apri la [demo Procedural GL](/demos/procedural-gl/)
2. Attendi caricamento della [procedural.eu map](https://www.procedural.eu/map/) embed
3. Pan e zoom su terreno reale
4. Immagina posizionare edificio client o percorso su un crinale noto

## Requisiti e prestazioni

- **Rete:** richiesta — tile e embed procedural.eu necessitano connettività
- **Browser:** Chromium moderno consigliato per terreno WebGL
- **Key:** key MapTiler production restano server-side / env — mai committate

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Vista regionale — terreno LOD da tile streamate](/assets/blog/procedural-gl/view-a.jpg?v=20260722a)

![Rilievo ravvicinato — crinali e valli leggibili in 3D](/assets/blog/procedural-gl/view-b.jpg?v=20260722a)

Anche in questa build:

- Usare come contesto accanto a GLB geolocalizzato
- Pianificare fork MapTiler self-hosted
- Leggere docs su [procedural.eu](https://www.procedural.eu/)

## Come funziona

La nostra pagina `/demos/procedural-gl/` embedda l'esperienza map ufficiale su [procedural.eu/map](https://www.procedural.eu/map/). Sotto il cofano, [procedural-gl-js](https://github.com/felixpalmer/procedural-gl-js) costruisce mesh GPU LOD da tile elevazione/immagini (WebGL). Prossimo passo IOM: build self-hosted con MapTiler — API key fuori git repo. Terreno geografico, complementare al noise procedurale [Terrain Sandbox](/demos/terrain-sandbox/).

## FAQ

**La map è hostata da IOM?**  
Questo primo passo embedda procedural.eu. Variante self-hosted = task production separato.

**WebGL o WebGPU?**  
Streaming terreno WebGL via procedural-gl.js — scelto per stack libreria ed ecosistema tile.

## Stack tecnico e letture

- [procedural.eu map](https://www.procedural.eu/map/)
- [procedural.eu docs](https://www.procedural.eu/)
- [procedural-gl-js on GitHub](https://github.com/felixpalmer/procedural-gl-js)

## Correlati su IOM

Esplora di più in [Esperimenti](/#experiments), più [Terrain Sandbox](/blog/terrain-sandbox), [Streets GL Bridge](/blog/streets-gl-bridge), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$Procedural GL Terrain — tile mondo reale in 3D — IOM$iom$,
  $iom$Paesaggi reali streamati come terreno GPU LOD — la nostra pagina embedda la [procedural.eu](https://www.procedural.eu/map/) map ufficiale powered by procedural-gl.js (MPL-2.0). Pri$iom$
from public.blog_posts p
where p.slug = $iom$procedural-gl$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$Procedural GL Terrain — tiles del mundo real en 3D$iom$,
  $iom$Paisajes reales streamados como terreno GPU LOD — nuestra página embedda el [procedural.eu](https://www.procedural.eu/map/) map oficial powered by procedural-gl.js (MPL-2.0). Prime$iom$,
  $iom$Paisajes reales streamados como terreno GPU LOD — nuestra página embedda el [procedural.eu](https://www.procedural.eu/map/) map oficial powered by procedural-gl.js (MPL-2.0). Primer paso: demo upstream live; build MapTiler self-hosted puede seguir.

Está en nuestra [sección Experimentos](/#experiments) como **Procedural GL Terrain**. La portada es un still live del embed procedural.eu — tiles elevación/imagen MapTiler reales en 3D, no sandbox noise.

## Abrir la demo en vivo

**[→ Lanzar Procedural GL Terrain](/demos/procedural-gl/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## Por qué importa (aunque no seas desarrollador)

- **Lugares reales** — elevación desde tiles map, no solo noise
- **GPU LOD** — detalle donde miras, mallas más ligeras lejos
- **Core open-source** — procedural-gl.js bajo MPL-2.0
- **Puente a producción** — embed ahora; self-host después con tu key

Usos típicos: contexto de sitio para arquitectura, pitches de ubicación y geo storytelling web.

## Para principiantes — ¿qué es esto, en palabras simples?

En lugar de inventar colinas, este viewer carga tiles de terreno reales para sobrevolar geografía actual en 3D — más cerca de una Earth view ligera que un nivel de juego hecho de noise.

**Glosario rápido**

- **LOD** — level of detail — más detalle mesh cerca de cámara
- **Map tiles** — piezas imagen/elevación streamadas para vista actual
- **procedural-gl.js** — librería open-source terreno GPU desde datos map
- **MapTiler** — proveedor tiles usado a menudo para keys producción (fuera del repo)

## Pruébalo en unos 60 segundos

1. Abre la [demo Procedural GL](/demos/procedural-gl/)
2. Espera a que cargue el embed [procedural.eu map](https://www.procedural.eu/map/)
3. Pan y zoom sobre terreno real
4. Imagina colocar edificio cliente o camino en una cresta conocida

## Requisitos y rendimiento

- **Red:** requerida — tiles y embed procedural.eu necesitan conectividad
- **Navegador:** Chromium moderno recomendado para terreno WebGL
- **Keys:** keys MapTiler producción quedan server-side / env — nunca commiteadas

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Vista regional — terreno LOD desde tiles streamadas](/assets/blog/procedural-gl/view-a.jpg?v=20260722a)

![Relieve cercano — crestas y valles legibles en 3D](/assets/blog/procedural-gl/view-b.jpg?v=20260722a)

También en este build:

- Usar como contexto junto a GLB geolocalizado
- Planear fork MapTiler self-hosted
- Leer docs en [procedural.eu](https://www.procedural.eu/)

## Cómo funciona

Nuestra página `/demos/procedural-gl/` embedda la experiencia map oficial en [procedural.eu/map](https://www.procedural.eu/map/). Bajo el capó, [procedural-gl-js](https://github.com/felixpalmer/procedural-gl-js) construye mallas GPU LOD desde tiles elevación/imagen (WebGL). Siguiente paso IOM: build self-hosted con MapTiler — API keys fuera del git repo. Terreno geográfico, complementario al noise procedural [Terrain Sandbox](/demos/terrain-sandbox/).

## FAQ

**¿El map está hosteado por IOM?**  
Este primer paso embedda procedural.eu. Variante self-hosted = tarea producción separada.

**¿WebGL o WebGPU?**  
Streaming terreno WebGL vía procedural-gl.js — elegido por stack de librería y ecosistema tiles.

## Stack técnico y lecturas

- [procedural.eu map](https://www.procedural.eu/map/)
- [procedural.eu docs](https://www.procedural.eu/)
- [procedural-gl-js on GitHub](https://github.com/felixpalmer/procedural-gl-js)

## Relacionado en IOM

Explora más en [Experimentos](/#experiments), más [Terrain Sandbox](/blog/terrain-sandbox), [Streets GL Bridge](/blog/streets-gl-bridge), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$Procedural GL Terrain — tiles del mundo real en 3D — IOM$iom$,
  $iom$Paisajes reales streamados como terreno GPU LOD — nuestra página embedda el [procedural.eu](https://www.procedural.eu/map/) map oficial powered by procedural-gl.js (MPL-2.0). Prime$iom$
from public.blog_posts p
where p.slug = $iom$procedural-gl$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$Spout — raymarched pipe water$iom$,
  $iom$A chrome pipe pouring raymarched water — refraction, transparency, and reflections in a self-hosted WebGL2 port of P_Malin’s classic Shadertoy. Drag to orbit the sculpture of fluid$iom$,
  $iom$A chrome pipe pouring raymarched water — refraction, transparency, and reflections in a self-hosted WebGL2 port of P_Malin’s classic Shadertoy. Drag to orbit the sculpture of fluid — then see the same water beat layered into our [360° Panorama Tour](https://iobjectm.com/demos/panorama-360/) (guided Step 3).

It lives in our [Experiments section](/#experiments) as **Spout**. The cover shows the pipe spout with refractive water catching the environment. The same effect language appears as Step 3 (`+particles/spout`) inside https://iobjectm.com/demos/panorama-360/.

## Open the live demo

**[→ Launch Spout](/demos/spout/)**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.

## Also in the 360° guided tour

Spout is not only a standalone experiment. On [https://iobjectm.com/demos/panorama-360/](https://iobjectm.com/demos/panorama-360/), **Step 3** of The Black Witness guided tour is authored as `cam · +particles/spout · hotspot+popup`: the camera lands on the rooftop water beat, the spout/water layer sells liquid motion in place, and a hotspot popup keeps the narrative interactive.

That is the interactivity benefit — guests do not only watch refraction; they arrive at a **timed stop**, can still drag to look around, and can click the hotspot for meaning. Open the editor or [visitor preview](https://iobjectm.com/demos/panorama-360/?mode=preview), hit **Play guided tour**, and step to Step 3. Pair with [WebGPU Particles](/blog/webgpu-particles) (Step 2) and [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4) for the full effects stack.

![Guided tour Step 3 — spout / water particles + hotspot popup on The Black Witness](/assets/blog/spout/tour-bridge.jpg?v=20260722a)

**[→ Open Panorama 360](https://iobjectm.com/demos/panorama-360/)** — **Play guided tour**, Step 3 ([visitor preview](https://iobjectm.com/demos/panorama-360/?mode=preview)).

## Why this matters (even if you are not a developer)

- **Shadertoy pedigree** — a known study piece, now on iobjectm.com
- **Raymarched water** — no particle splash mesh; distance fields do the work
- **Refraction & reflection** — material language clients recognize from ads
- **WebGL2 port** — broad real-time reach without WebGPU
- **Wired into 360 tours** — Step 3 on [Panorama 360](https://iobjectm.com/demos/panorama-360/) pairs spout/water with a hotspot popup

Typical uses: shader craft demos, liquid branding mood boards, teaching raymarching look-dev, and water beats inside interactive 360° guided tours.

## For beginners — what is this, in plain words?

The water is not a filmed splash. The GPU walks rays through a mathematical shape until it hits “water” or “metal,” then bends the view like a lens. That is why the pipe and fluid can look so clean from every angle. In our [360° tour](https://iobjectm.com/demos/panorama-360/), that same liquid language becomes a guided stop guests can look around and click.

**Quick glossary**

- **Raymarching** — stepping along a ray through a distance field until a surface is found
- **SDF** — signed distance function — math that describes shapes for raymarchers
- **Refraction** — bending of the view through transparent water
- **Shadertoy** — online playground for pixel/raymarch shaders (original by P_Malin)
- **Guided tour Step 3** — on /demos/panorama-360/ — cam · +particles/spout · hotspot+popup

## Try this in about 60 seconds

1. Open the [Spout demo](/demos/spout/)
2. Drag to orbit the pipe and water
3. Watch refraction shift the background through the fluid
4. Open [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, and watch Step 3 (spout / water + hotspot)
5. Compare with the original [Shadertoy view](https://www.shadertoy.com/view/lsXGzH)

## Requirements and performance

- **Browser:** WebGL2-capable Chrome, Edge, Firefox, or Safari
- **GPU:** light-to-moderate raymarch cost — reduce resolution if needed
- **API:** WebGL2 shader port — not WebGPU compute

## What you see

Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:

![Hero spout — pipe metal and refractive water column](/assets/blog/spout/view-a.jpg?v=20260722a)

![Orbit detail — reflections and transparency in the fluid](/assets/blog/spout/view-b.jpg?v=20260722a)

Also in this build:

- Retune palette for brand metals and fluid tint
- Use stills as look-dev references for product liquids
- Drop the water beat into a [360° guided tour](/demos/panorama-360/) stop (Step 3)
- Credit and study P_Malin’s [Shadertoy](https://www.shadertoy.com/view/lsXGzH)

## How it works

A full-screen (or mesh-bound) WebGL2 fragment shader raymarches SDFs for the pipe and water, applying refraction, transparency, and reflections. IOM hosts a port of P_Malin’s Shadertoy experiment [lsXGzH](https://www.shadertoy.com/view/lsXGzH) under `/demos/spout/`. This is classic shader art on **WebGL2**, complementary to Three.js scene demos and distinct from WebGPU TSL water.

## FAQ

**Is the water simulated with physics?**  
No — it is raymarched shader geometry/animation, not a fluid particle sim.

**Can this run inside a Three.js product scene?**  
Often as a screen pass or localized effect — we scope integration per project. The panorama tour at https://iobjectm.com/demos/panorama-360/ is one production example.

**Where does Spout show up in the 360 tour?**  
Guided-tour Step 3 on The Black Witness — spout/water with a hotspot popup. Open https://iobjectm.com/demos/panorama-360/ and Play guided tour.

## Tech stack and further reading

- [Panorama 360 (live)](https://iobjectm.com/demos/panorama-360/)
- [Panorama 360 — visitor preview](https://iobjectm.com/demos/panorama-360/?mode=preview)
- [Shadertoy — Spout (P_Malin)](https://www.shadertoy.com/view/lsXGzH)
- [Ray marching — Wikipedia](https://en.wikipedia.org/wiki/Ray_marching)
- [WebGL2 — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext)

## Related on IOM

Browse more in [Experiments](/#experiments), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [The Black Witness — 360° Tour](/blog/panorama-suite), [WebGPU Particles](/blog/webgpu-particles), [WebGPU Compute Birds](/blog/webgpu-compute-birds), or [contact us](/#contact) if you want something like this scoped for a client pitch.$iom$,
  $iom$Spout — raymarched pipe water — IOM$iom$,
  $iom$A chrome pipe pouring raymarched water — refraction, transparency, and reflections in a self-hosted WebGL2 port of P_Malin’s classic Shadertoy. Drag to orbit the sculpture of fluid$iom$
from public.blog_posts p
where p.slug = $iom$spout$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$Spout — raymarched Rohrwasser$iom$,
  $iom$Ein Chromrohr mit raymarched Wasser — Brechung, Transparenz und Reflexionen in einem self-hosted WebGL2-Port von P_Malins klassischem Shadertoy. Ziehen zum Orbitieren der Flüssigke$iom$,
  $iom$Ein Chromrohr mit raymarched Wasser — Brechung, Transparenz und Reflexionen in einem self-hosted WebGL2-Port von P_Malins klassischem Shadertoy. Ziehen zum Orbitieren der Flüssigkeitsskulptur — dann denselben Wasser-Beat in unserer [360° Panorama Tour](https://iobjectm.com/demos/panorama-360/) (Guided Step 3).

Es liegt in unserem [Experimente-Bereich](/#experiments) als **Spout**. Das Cover zeigt den Rohrauslauf mit refraktivem Wasser, das die Umgebung einfängt. Dieselbe Effektsprache erscheint als Step 3 (`+particles/spout`) in https://iobjectm.com/demos/panorama-360/.

## Live-Demo öffnen

**[→ Spout starten](/demos/spout/)**

Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.

## Auch in der 360°-Guided-Tour

Spout ist nicht nur ein Standalone-Experiment. Auf [https://iobjectm.com/demos/panorama-360/](https://iobjectm.com/demos/panorama-360/) ist **Step 3** der The Black Witness Guided Tour autorisiert als `cam · +particles/spout · hotspot+popup`: die Kamera landet auf dem Dach-Wasser-Beat, die Spout/Wasser-Schicht verkauft Flüssigkeitsbewegung vor Ort, und ein Hotspot-Popup hält die Narrative interaktiv.

Das ist der Interaktivitätsvorteil — Gäste schauen nicht nur Brechung; sie kommen an einem **getimten Stop** an, können noch umsehen und den Hotspot für Bedeutung anklicken. Editor oder [Visitor Preview](https://iobjectm.com/demos/panorama-360/?mode=preview) öffnen, **Play guided tour** drücken und zu Step 3 gehen. Paaren mit [WebGPU Particles](/blog/webgpu-particles) (Step 2) und [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4) für den vollen Effects-Stack.

![Guided tour Step 3 — Spout / Wasserpartikel + Hotspot-Popup auf The Black Witness](/assets/blog/spout/tour-bridge.jpg?v=20260722a)

**[→ Panorama 360 öffnen](https://iobjectm.com/demos/panorama-360/)** — **Guided Tour abspielen**, Step 3 ([Besucher-Vorschau](https://iobjectm.com/demos/panorama-360/?mode=preview)).

## Warum das zählt (auch ohne Entwickler-Hintergrund)

- **Shadertoy-Pedigree** — ein bekanntes Studienstück, jetzt auf iobjectm.com
- **Raymarched Wasser** — kein Partikel-Splash-Mesh; Distance Fields leisten die Arbeit
- **Brechung & Reflexion** — Materialsprache, die Kunden aus Werbung kennen
- **WebGL2-Port** — breite Echtzeit-Reichweite ohne WebGPU
- **In 360°-Touren eingebunden** — Step 3 auf [Panorama 360](https://iobjectm.com/demos/panorama-360/) paart Spout/Wasser mit Hotspot-Popup

Typische Einsätze: Shader-Craft-Demos, Liquid-Branding-Moodboards, Raymarching-Look-Dev lehren und Wasser-Beats in interaktiven 360°-Guided-Touren.

## Für Einsteiger — was ist das, in einfachen Worten?

Das Wasser ist kein gefilmter Splash. Die GPU läuft Strahlen durch eine mathematische Form, bis sie „Wasser“ oder „Metall“ trifft, und biegt die Sicht wie eine Linse. Deshalb wirken Rohr und Flüssigkeit aus jedem Winkel so sauber. In unserer [360°-Tour](https://iobjectm.com/demos/panorama-360/) wird dieselbe Flüssigkeitssprache zu einem Guided Stop, den Gäste umsehen und anklicken können.

**Kurzes Glossar**

- **Raymarching** — Schritte entlang eines Strahls durch ein Distance Field bis eine Oberfläche gefunden wird
- **SDF** — signed distance function — Mathematik, die Formen für Raymarcher beschreibt
- **Refraction** — Biegung der Sicht durch transparentes Wasser
- **Shadertoy** — Online-Playground für Pixel/Raymarch-Shader (Original von P_Malin)
- **Guided tour Step 3** — auf /demos/panorama-360/ — cam · +particles/spout · hotspot+popup

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [Spout Demo](/demos/spout/)
2. Ziehen zum Orbitieren von Rohr und Wasser
3. Beobachten Sie Brechung, die den Hintergrund durch die Flüssigkeit verschiebt
4. Öffnen Sie [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, und sehen Sie Step 3 (Spout / Wasser + Hotspot)
5. Vergleichen mit der originalen [Shadertoy-Ansicht](https://www.shadertoy.com/view/lsXGzH)

## Anforderungen und Performance

- **Browser:** WebGL2-fähiger Chrome, Edge, Firefox oder Safari
- **GPU:** leicht bis moderater Raymarch-Kosten — Auflösung senken bei Bedarf
- **API:** WebGL2-Shader-Port — kein WebGPU-Compute

## Was Sie sehen

Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:

![Hero-Spout — Rohrmetall und refraktive Wassersäule](/assets/blog/spout/view-a.jpg?v=20260722a)

![Orbit-Detail — Reflexionen und Transparenz in der Flüssigkeit](/assets/blog/spout/view-b.jpg?v=20260722a)

Ebenfalls in diesem Build:

- Palette für Markenmetalle und Flüssigkeitstint retunen
- Stills als Look-Dev-Referenzen für Produktflüssigkeiten nutzen
- Den Wasser-Beat in einen [360°-Guided-Tour](/demos/panorama-360/) Stop legen (Step 3)
- P_Malins [Shadertoy](https://www.shadertoy.com/view/lsXGzH) crediten und studieren

## So funktioniert es

Ein Fullscreen- (oder mesh-gebundener) WebGL2-Fragment-Shader raymarched SDFs für Rohr und Wasser mit Brechung, Transparenz und Reflexionen. IOM hostet einen Port von P_Malins Shadertoy-Experiment [lsXGzH](https://www.shadertoy.com/view/lsXGzH) unter `/demos/spout/`. Das ist klassische Shader-Kunst auf **WebGL2**, komplementär zu Three.js-Szenen-Demos und distinct von WebGPU TSL-Wasser.

## FAQ

**Wird das Wasser mit Physik simuliert?**  
Nein — raymarched Shader-Geometrie/Animation, keine Fluid-Partikel-Sim.

**Kann das in einer Three.js-Produktszene laufen?**  
Oft als Screen-Pass oder lokalisierter Effekt — Integration pro Projekt scoped. Die Panorama-Tour unter https://iobjectm.com/demos/panorama-360/ ist ein Production-Beispiel.

**Wo erscheint Spout in der 360°-Tour?**  
Guided-tour Step 3 auf The Black Witness — Spout/Wasser mit Hotspot-Popup. Öffnen Sie https://iobjectm.com/demos/panorama-360/ und Play guided tour.

## Tech-Stack und weiterführende Links

- [Panorama 360 (live)](https://iobjectm.com/demos/panorama-360/)
- [Panorama 360 — visitor preview](https://iobjectm.com/demos/panorama-360/?mode=preview)
- [Shadertoy — Spout (P_Malin)](https://www.shadertoy.com/view/lsXGzH)
- [Ray marching — Wikipedia](https://en.wikipedia.org/wiki/Ray_marching)
- [WebGL2 — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext)

## Verwandt bei IOM

Mehr in [Experimente](/#experiments), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [The Black Witness — 360° Tour](/blog/panorama-suite), [WebGPU Particles](/blog/webgpu-particles), [WebGPU Compute Birds](/blog/webgpu-compute-birds), oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.$iom$,
  $iom$Spout — raymarched Rohrwasser — IOM$iom$,
  $iom$Ein Chromrohr mit raymarched Wasser — Brechung, Transparenz und Reflexionen in einem self-hosted WebGL2-Port von P_Malins klassischem Shadertoy. Ziehen zum Orbitieren der Flüssigke$iom$
from public.blog_posts p
where p.slug = $iom$spout$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$Spout — eau de tuyau en raymarching$iom$,
  $iom$Un tuyau chromé versant de l'eau raymarchée — réfraction, transparence et réflexions dans un port WebGL2 self-hosted du Shadertoy classique de P_Malin. Glissez pour orbiter la scul$iom$,
  $iom$Un tuyau chromé versant de l'eau raymarchée — réfraction, transparence et réflexions dans un port WebGL2 self-hosted du Shadertoy classique de P_Malin. Glissez pour orbiter la sculpture fluide — puis le même beat eau intégré dans notre [360° Panorama Tour](https://iobjectm.com/demos/panorama-360/) (guided Step 3).

Il se trouve dans notre [section Expériences](/#experiments) sous **Spout**. La couverture montre le bec avec eau réfractive capturant l'environnement. Le même langage d'effet apparaît comme Step 3 (`+particles/spout`) dans https://iobjectm.com/demos/panorama-360/.

## Ouvrir la démo en direct

**[→ Lancer Spout](/demos/spout/)**

Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.

## Aussi dans la visite guidée 360°

Spout n'est pas qu'une expérience standalone. Sur [https://iobjectm.com/demos/panorama-360/](https://iobjectm.com/demos/panorama-360/), **Step 3** de la tour guidée The Black Witness est authoré comme `cam · +particles/spout · hotspot+popup` : la caméra atterrit sur le beat eau rooftop, la couche spout/eau vend mouvement liquide sur place, et un popup hotspot garde le récit interactif.

C'est le bénéfice interactivité — visiteurs ne regardent pas seulement réfraction ; ils arrivent à un **arrêt temporisé**, peuvent encore regarder autour et cliquer hotspot pour le sens. Ouvrir l'éditeur ou [aperçu visiteur](https://iobjectm.com/demos/panorama-360/?mode=preview), **Play guided tour**, et aller à Step 3. Associer avec [WebGPU Particles](/blog/webgpu-particles) (Step 2) et [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4) pour la stack effets complète.

![Guided tour Step 3 — spout / particules eau + popup hotspot sur The Black Witness](/assets/blog/spout/tour-bridge.jpg?v=20260722a)

**[→ Ouvrir Panorama 360](https://iobjectm.com/demos/panorama-360/)** — **Lancer la visite guidée**, Step 3 ([aperçu visiteur](https://iobjectm.com/demos/panorama-360/?mode=preview)).

## Pourquoi c’est important (même sans être développeur)

- **Pedigree Shadertoy** — pièce d'étude connue, maintenant sur iobjectm.com
- **Eau raymarchée** — pas de mesh splash particules ; distance fields font le travail
- **Réfraction & réflexion** — langage matériau que clients reconnaissent des pubs
- **Port WebGL2** — portée temps réel large sans WebGPU
- **Branché aux tours 360°** — Step 3 sur [Panorama 360](https://iobjectm.com/demos/panorama-360/) associe spout/eau et popup hotspot

Usages typiques : démos craft shader, moodboards branding liquide, enseigner look-dev raymarching et beats eau dans tours guidées 360° interactives.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

L'eau n'est pas un splash filmé. Le GPU avance des rayons dans une forme mathématique jusqu'à toucher « eau » ou « métal », puis courbe la vue comme une lentille. C'est pourquoi tuyau et fluide paraissent si propres sous tous les angles. Dans notre [tour 360°](https://iobjectm.com/demos/panorama-360/), ce même langage liquide devient un arrêt guidé que visiteurs peuvent regarder autour et cliquer.

**Glossaire rapide**

- **Raymarching** — pas le long d'un rayon dans un distance field jusqu'à trouver une surface
- **SDF** — signed distance function — maths décrivant formes pour raymarchers
- **Refraction** — courbure de la vue à travers eau transparente
- **Shadertoy** — playground en ligne shaders pixel/raymarch (original P_Malin)
- **Guided tour Step 3** — sur /demos/panorama-360/ — cam · +particles/spout · hotspot+popup

## Essayez en environ 60 secondes

1. Ouvrir la [démo Spout](/demos/spout/)
2. Glisser pour orbiter tuyau et eau
3. Observer réfraction décaler l'arrière-plan à travers le fluide
4. Ouvrir [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, et regarder Step 3 (spout / eau + hotspot)
5. Comparer avec la [vue Shadertoy](https://www.shadertoy.com/view/lsXGzH) originale

## Prérequis et performances

- **Navigateur :** Chrome, Edge, Firefox ou Safari compatible WebGL2
- **GPU :** coût raymarch léger à modéré — réduire résolution si besoin
- **API :** port shader WebGL2 — pas compute WebGPU

## Ce que vous voyez

Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :

![Spout hero — métal tuyau et colonne eau réfractive](/assets/blog/spout/view-a.jpg?v=20260722a)

![Détail orbite — réflexions et transparence dans le fluide](/assets/blog/spout/view-b.jpg?v=20260722a)

Aussi dans ce build :

- Retuner palette pour métaux marque et teinte fluide
- Utiliser stills comme références look-dev liquides produit
- Déposer le beat eau dans un arrêt [tour guidée 360°](/demos/panorama-360/) (Step 3)
- Créditer et étudier le [Shadertoy](https://www.shadertoy.com/view/lsXGzH) de P_Malin

## Comment ça marche

Un shader fragment WebGL2 plein écran (ou lié mesh) raymarche SDFs pour tuyau et eau, appliquant réfraction, transparence et réflexions. IOM héberge un port de l'expérience Shadertoy [lsXGzH](https://www.shadertoy.com/view/lsXGzH) de P_Malin sous `/demos/spout/`. C'est shader art classique sur **WebGL2**, complémentaire aux démos scène Three.js et distinct de l'eau WebGPU TSL.

## FAQ

**L'eau est-elle simulée avec physique ?**  
Non — géométrie/animation shader raymarchée, pas sim particules fluide.

**Peut-il tourner dans une scène produit Three.js ?**  
Souvent en pass écran ou effet localisé — intégration scoped par projet. La tour panorama sur https://iobjectm.com/demos/panorama-360/ est un exemple production.

**Où Spout apparaît-il dans la tour 360 ?**  
Guided-tour Step 3 sur The Black Witness — spout/eau avec popup hotspot. Ouvrir https://iobjectm.com/demos/panorama-360/ et Play guided tour.

## Stack technique et lectures

- [Panorama 360 (live)](https://iobjectm.com/demos/panorama-360/)
- [Panorama 360 — visitor preview](https://iobjectm.com/demos/panorama-360/?mode=preview)
- [Shadertoy — Spout (P_Malin)](https://www.shadertoy.com/view/lsXGzH)
- [Ray marching — Wikipedia](https://en.wikipedia.org/wiki/Ray_marching)
- [WebGL2 — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext)

## Sur IOM

Parcourez [Expériences](/#experiments), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [The Black Witness — 360° Tour](/blog/panorama-suite), [WebGPU Particles](/blog/webgpu-particles), [WebGPU Compute Birds](/blog/webgpu-compute-birds), ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.$iom$,
  $iom$Spout — eau de tuyau en raymarching — IOM$iom$,
  $iom$Un tuyau chromé versant de l'eau raymarchée — réfraction, transparence et réflexions dans un port WebGL2 self-hosted du Shadertoy classique de P_Malin. Glissez pour orbiter la scul$iom$
from public.blog_posts p
where p.slug = $iom$spout$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$Spout — raymarched pijpwatere$iom$,
  $iom$Een chroom pijp met raymarched water — breking, transparantie en reflecties in een self-hosted WebGL2-port van P_Malins klassieke Shadertoy. Sleep om de vloeistofsculptuur te orbit$iom$,
  $iom$Een chroom pijp met raymarched water — breking, transparantie en reflecties in een self-hosted WebGL2-port van P_Malins klassieke Shadertoy. Sleep om de vloeistofsculptuur te orbiten — en zie dezelfde waterbeat in onze [360° Panorama Tour](https://iobjectm.com/demos/panorama-360/) (guided Step 3).

Het staat in onze [Experimenten-sectie](/#experiments) als **Spout**. De cover toont de pijpuitloop met refractief water dat de omgeving vangt. Dezelfde effecttaal verschijnt als Step 3 (`+particles/spout`) in https://iobjectm.com/demos/panorama-360/.

## Open de live demo

**[→ Start Spout](/demos/spout/)**

Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.

## Ook in de 360° guided tour

Spout is niet alleen een standalone experiment. Op [https://iobjectm.com/demos/panorama-360/](https://iobjectm.com/demos/panorama-360/) is **Step 3** van The Black Witness guided tour geauthoriseerd als `cam · +particles/spout · hotspot+popup`: de camera landt op de rooftop waterbeat, de spout/waterlaag verkoopt vloeistofbeweging ter plekke, en een hotspotpopup houdt het verhaal interactief.

Dat is het interactiviteitsvoordeel — gasten kijken niet alleen naar breking; ze komen aan op een **getimede stop**, kunnen nog rondkijken en de hotspot klikken voor betekenis. Open de editor of [bezoekerspreview](https://iobjectm.com/demos/panorama-360/?mode=preview), druk **Play guided tour**, en ga naar Step 3. Combineer met [WebGPU Particles](/blog/webgpu-particles) (Step 2) en [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4) voor de volledige effects stack.

![Guided tour Step 3 — spout / waterdeeltjes + hotspotpopup op The Black Witness](/assets/blog/spout/tour-bridge.jpg?v=20260722a)

**[→ Open Panorama 360](https://iobjectm.com/demos/panorama-360/)** — **Speel guided tour**, Step 3 ([bezoekersvoorbeeld](https://iobjectm.com/demos/panorama-360/?mode=preview)).

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

- **Shadertoy-pedigree** — bekend studiestuk, nu op iobjectm.com
- **Raymarched water** — geen deeltjessplash-mesh; distance fields doen het werk
- **Breking & reflectie** — materiaaltaal die klanten uit ads herkennen
- **WebGL2-port** — brede real-time reach zonder WebGPU
- **Aangesloten op 360°-tours** — Step 3 op [Panorama 360](https://iobjectm.com/demos/panorama-360/) koppelt spout/water aan hotspotpopup

Typische toepassingen: shader craft-demo's, liquid branding moodboards, raymarching look-dev onderwijzen en waterbeats in interactieve 360° guided tours.

## Voor beginners — wat is dit, in gewone taal?

Het water is geen gefilmde splash. De GPU loopt stralen door een wiskundige vorm tot het „water“ of „metaal“ raakt, en buigt het zicht als een lens. Daarom lijken pijp en vloeistof vanuit elke hoek zo schoon. In onze [360°-tour](https://iobjectm.com/demos/panorama-360/) wordt diezelfde vloeistoftaal een guided stop waar gasten rondkijken en klikken.

**Korte glossary**

- **Raymarching** — stappen langs een straal door een distance field tot een oppervlak gevonden is
- **SDF** — signed distance function — wiskunde die vormen beschrijft voor raymarchers
- **Refraction** — buigen van het zicht door transparant water
- **Shadertoy** — online playground voor pixel/raymarch-shaders (origineel door P_Malin)
- **Guided tour Step 3** — op /demos/panorama-360/ — cam · +particles/spout · hotspot+popup

## Probeer dit in ongeveer 60 seconden

1. Open de [Spout-demo](/demos/spout/)
2. Sleep om pijp en water te orbiten
3. Kijk hoe breking de achtergrond door de vloeistof verschuift
4. Open [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, en bekijk Step 3 (spout / water + hotspot)
5. Vergelijk met het originele [Shadertoy-beeld](https://www.shadertoy.com/view/lsXGzH)

## Vereisten en performance

- **Browser:** WebGL2-capabele Chrome, Edge, Firefox of Safari
- **GPU:** licht tot matige raymarch-kosten — verlaag resolutie indien nodig
- **API:** WebGL2-shaderport — geen WebGPU-compute

## Wat je ziet

Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:

![Hero spout — pijpmetaal en refractieve waterkolom](/assets/blog/spout/view-a.jpg?v=20260722a)

![Orbitdetail — reflecties en transparantie in de vloeistof](/assets/blog/spout/view-b.jpg?v=20260722a)

Ook in deze build:

- Palet retunen voor merkmetalen en vloeistoftint
- Stills gebruiken als look-dev-referenties voor productvloeistoffen
- De waterbeat in een [360° guided tour](/demos/panorama-360/) stop droppen (Step 3)
- P_Malins [Shadertoy](https://www.shadertoy.com/view/lsXGzH) crediteren en bestuderen

## Hoe het werkt

Een fullscreen (of mesh-gebonden) WebGL2-fragmentshader raymarched SDFs voor pijp en water, met breking, transparantie en reflecties. IOM host een port van P_Malins Shadertoy-experiment [lsXGzH](https://www.shadertoy.com/view/lsXGzH) onder `/demos/spout/`. Dit is klassieke shaderkunst op **WebGL2**, complementair aan Three.js-scènedemo's en distinct van WebGPU TSL-water.

## FAQ

**Wordt het water gesimuleerd met fysica?**  
Nee — het is raymarched shadergeometrie/animatie, geen vloeistofdeeltjessim.

**Kan dit in een Three.js-productscène draaien?**  
Vaak als screen pass of gelokaliseerd effect — integratie scoped per project. De panoramatour op https://iobjectm.com/demos/panorama-360/ is een productionvoorbeeld.

**Waar verschijnt Spout in de 360-tour?**  
Guided-tour Step 3 op The Black Witness — spout/water met hotspotpopup. Open https://iobjectm.com/demos/panorama-360/ en Play guided tour.

## Tech stack en verder lezen

- [Panorama 360 (live)](https://iobjectm.com/demos/panorama-360/)
- [Panorama 360 — visitor preview](https://iobjectm.com/demos/panorama-360/?mode=preview)
- [Shadertoy — Spout (P_Malin)](https://www.shadertoy.com/view/lsXGzH)
- [Ray marching — Wikipedia](https://en.wikipedia.org/wiki/Ray_marching)
- [WebGL2 — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext)

## Gerelateerd op IOM

Bekijk meer in [Experimenten](/#experiments), plus [360° Panorama Tour Editor](/blog/panorama-360-tour), [The Black Witness — 360° Tour](/blog/panorama-suite), [WebGPU Particles](/blog/webgpu-particles), [WebGPU Compute Birds](/blog/webgpu-compute-birds), of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.$iom$,
  $iom$Spout — raymarched pijpwatere — IOM$iom$,
  $iom$Een chroom pijp met raymarched water — breking, transparantie en reflecties in een self-hosted WebGL2-port van P_Malins klassieke Shadertoy. Sleep om de vloeistofsculptuur te orbit$iom$
from public.blog_posts p
where p.slug = $iom$spout$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$Spout — acqua a tubo raymarched$iom$,
  $iom$Un tubo cromato che versa acqua raymarched — rifrazione, trasparenza e riflessi in un port WebGL2 self-hosted del classico Shadertoy di P_Malin. Trascina per orbitare la scultura f$iom$,
  $iom$Un tubo cromato che versa acqua raymarched — rifrazione, trasparenza e riflessi in un port WebGL2 self-hosted del classico Shadertoy di P_Malin. Trascina per orbitare la scultura fluida — poi lo stesso beat acqua integrato nel nostro [360° Panorama Tour](https://iobjectm.com/demos/panorama-360/) (guided Step 3).

Si trova nella nostra [sezione Esperimenti](/#experiments) come **Spout**. La cover mostra il beccuccio con acqua rifrattiva che cattura l'ambiente. Lo stesso linguaggio effetto appare come Step 3 (`+particles/spout`) in https://iobjectm.com/demos/panorama-360/.

## Apri la demo live

**[→ Avvia Spout](/demos/spout/)**

Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.

## Anche nel tour guidato 360°

Spout non è solo un esperimento standalone. Su [https://iobjectm.com/demos/panorama-360/](https://iobjectm.com/demos/panorama-360/), **Step 3** del tour guidato The Black Witness è authorato come `cam · +particles/spout · hotspot+popup`: la camera atterra sul beat acqua rooftop, lo strato spout/acqua vende movimento liquido sul posto, e un popup hotspot mantiene la narrativa interattiva.

Questo è il vantaggio interattività — gli ospiti non guardano solo rifrazione; arrivano a una **tappa temporizzata**, possono ancora guardarsi intorno e cliccare l'hotspot per significato. Apri l'editor o [anteprima visitatore](https://iobjectm.com/demos/panorama-360/?mode=preview), premi **Play guided tour**, e vai a Step 3. Abbina con [WebGPU Particles](/blog/webgpu-particles) (Step 2) e [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4) per lo stack effetti completo.

![Guided tour Step 3 — spout / particelle acqua + popup hotspot su The Black Witness](/assets/blog/spout/tour-bridge.jpg?v=20260722a)

**[→ Apri Panorama 360](https://iobjectm.com/demos/panorama-360/)** — **Avvia tour guidato**, Step 3 ([anteprima visitatore](https://iobjectm.com/demos/panorama-360/?mode=preview)).

## Perché conta (anche se non sei uno sviluppatore)

- **Pedigree Shadertoy** — pezzo studio noto, ora su iobjectm.com
- **Acqua raymarched** — niente mesh splash particelle; distance fields fanno il lavoro
- **Rifrazione & riflessione** — linguaggio materiale che i clienti riconoscono dalle ads
- **Port WebGL2** — ampia reach real-time senza WebGPU
- **Integrato nei tour 360°** — Step 3 su [Panorama 360](https://iobjectm.com/demos/panorama-360/) abbina spout/acqua e popup hotspot

Usi tipici: demo craft shader, moodboard branding liquido, insegnare look-dev raymarching e beat acqua in tour guidati 360° interattivi.

## Per principianti — cos’è, in parole semplici?

L'acqua non è uno splash filmato. La GPU avanza raggi attraverso una forma matematica finché colpisce « acqua » o « metallo », poi curva la vista come una lente. Ecco perché tubo e fluido sembrano così puliti da ogni angolo. Nel nostro [tour 360°](https://iobjectm.com/demos/panorama-360/), lo stesso linguaggio liquido diventa una tappa guidata che gli ospiti possono guardare intorno e cliccare.

**Glossario rapido**

- **Raymarching** — passi lungo un raggio attraverso un distance field fino a trovare una superficie
- **SDF** — signed distance function — matematica che descrive forme per raymarcher
- **Refraction** — curvatura della vista attraverso acqua trasparente
- **Shadertoy** — playground online shader pixel/raymarch (originale di P_Malin)
- **Guided tour Step 3** — su /demos/panorama-360/ — cam · +particles/spout · hotspot+popup

## Provalo in circa 60 secondi

1. Apri la [demo Spout](/demos/spout/)
2. Trascina per orbitare tubo e acqua
3. Osserva la rifrazione spostare lo sfondo attraverso il fluido
4. Apri [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, e guarda Step 3 (spout / acqua + hotspot)
5. Confronta con la [vista Shadertoy](https://www.shadertoy.com/view/lsXGzH) originale

## Requisiti e prestazioni

- **Browser:** Chrome, Edge, Firefox o Safari compatibile WebGL2
- **GPU:** costo raymarch da leggero a moderato — riduci risoluzione se serve
- **API:** port shader WebGL2 — non compute WebGPU

## Cosa vedi

Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:

![Spout hero — metallo tubo e colonna acqua rifrattiva](/assets/blog/spout/view-a.jpg?v=20260722a)

![Dettaglio orbit — riflessi e trasparenza nel fluido](/assets/blog/spout/view-b.jpg?v=20260722a)

Anche in questa build:

- Retunare palette per metalli brand e tinta fluido
- Usare still come riferimenti look-dev liquidi prodotto
- Inserire il beat acqua in una tappa [tour guidato 360°](/demos/panorama-360/) (Step 3)
- Creditare e studiare lo [Shadertoy](https://www.shadertoy.com/view/lsXGzH) di P_Malin

## Come funziona

Un fragment shader WebGL2 fullscreen (o legato a mesh) raymarched SDF per tubo e acqua, applicando rifrazione, trasparenza e riflessi. IOM ospita un port dell'esperimento Shadertoy [lsXGzH](https://www.shadertoy.com/view/lsXGzH) di P_Malin sotto `/demos/spout/`. È shader art classica su **WebGL2**, complementare alle demo scena Three.js e distinta dall'acqua WebGPU TSL.

## FAQ

**L'acqua è simulata con fisica?**  
No — geometria/animazione shader raymarched, non sim particelle fluido.

**Può girare in una scena prodotto Three.js?**  
Spesso come screen pass o effetto localizzato — integrazione scoped per progetto. Il tour panorama su https://iobjectm.com/demos/panorama-360/ è un esempio production.

**Dove compare Spout nel tour 360?**  
Guided-tour Step 3 su The Black Witness — spout/acqua con popup hotspot. Apri https://iobjectm.com/demos/panorama-360/ e Play guided tour.

## Stack tecnico e letture

- [Panorama 360 (live)](https://iobjectm.com/demos/panorama-360/)
- [Panorama 360 — visitor preview](https://iobjectm.com/demos/panorama-360/?mode=preview)
- [Shadertoy — Spout (P_Malin)](https://www.shadertoy.com/view/lsXGzH)
- [Ray marching — Wikipedia](https://en.wikipedia.org/wiki/Ray_marching)
- [WebGL2 — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext)

## Correlati su IOM

Esplora di più in [Esperimenti](/#experiments), più [360° Panorama Tour Editor](/blog/panorama-360-tour), [The Black Witness — 360° Tour](/blog/panorama-suite), [WebGPU Particles](/blog/webgpu-particles), [WebGPU Compute Birds](/blog/webgpu-compute-birds), o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.$iom$,
  $iom$Spout — acqua a tubo raymarched — IOM$iom$,
  $iom$Un tubo cromato che versa acqua raymarched — rifrazione, trasparenza e riflessi in un port WebGL2 self-hosted del classico Shadertoy di P_Malin. Trascina per orbitare la scultura f$iom$
from public.blog_posts p
where p.slug = $iom$spout$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$Spout — agua de tubería raymarched$iom$,
  $iom$Una tubería cromada vertiendo agua raymarched — refracción, transparencia y reflexiones en un port WebGL2 self-hosted del Shadertoy clásico de P_Malin. Arrastra para orbitar la esc$iom$,
  $iom$Una tubería cromada vertiendo agua raymarched — refracción, transparencia y reflexiones en un port WebGL2 self-hosted del Shadertoy clásico de P_Malin. Arrastra para orbitar la escultura fluida — luego el mismo beat de agua integrado en nuestro [360° Panorama Tour](https://iobjectm.com/demos/panorama-360/) (guided Step 3).

Está en nuestra [sección Experimentos](/#experiments) como **Spout**. La portada muestra el caño con agua refractiva capturando el entorno. El mismo lenguaje de efecto aparece como Step 3 (`+particles/spout`) en https://iobjectm.com/demos/panorama-360/.

## Abrir la demo en vivo

**[→ Lanzar Spout](/demos/spout/)**

No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.

## También en el tour guiado 360°

Spout no es solo un experimento standalone. En [https://iobjectm.com/demos/panorama-360/](https://iobjectm.com/demos/panorama-360/), **Step 3** del tour guiado The Black Witness está authorado como `cam · +particles/spout · hotspot+popup`: la cámara aterriza en el beat agua rooftop, la capa spout/agua vende movimiento líquido in situ, y un popup hotspot mantiene la narrativa interactiva.

Ese es el beneficio de interactividad — invitados no solo miran refracción; llegan a una **parada temporizada**, aún pueden mirar alrededor y clicar el hotspot por significado. Abre el editor o [vista previa visitante](https://iobjectm.com/demos/panorama-360/?mode=preview), pulsa **Play guided tour**, y ve a Step 3. Empareja con [WebGPU Particles](/blog/webgpu-particles) (Step 2) y [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4) para el stack de efectos completo.

![Guided tour Step 3 — spout / partículas agua + popup hotspot en The Black Witness](/assets/blog/spout/tour-bridge.jpg?v=20260722a)

**[→ Abrir Panorama 360](https://iobjectm.com/demos/panorama-360/)** — **Reproducir tour guiado**, Step 3 ([vista previa de visitante](https://iobjectm.com/demos/panorama-360/?mode=preview)).

## Por qué importa (aunque no seas desarrollador)

- **Pedigree Shadertoy** — pieza de estudio conocida, ahora en iobjectm.com
- **Agua raymarched** — sin malla splash de partículas; distance fields hacen el trabajo
- **Refracción y reflexión** — lenguaje material que clientes reconocen de anuncios
- **Port WebGL2** — alcance en tiempo real amplio sin WebGPU
- **Integrado en tours 360°** — Step 3 en [Panorama 360](https://iobjectm.com/demos/panorama-360/) empareja spout/agua con popup hotspot

Usos típicos: demos craft shader, moodboards branding líquido, enseñar look-dev raymarching y beats de agua en tours guiados 360° interactivos.

## Para principiantes — ¿qué es esto, en palabras simples?

El agua no es un splash filmado. La GPU avanza rayos a través de una forma matemática hasta golpear « agua » o « metal », y curva la vista como una lente. Por eso tubo y fluido se ven tan limpios desde cualquier ángulo. En nuestro [tour 360°](https://iobjectm.com/demos/panorama-360/), ese mismo lenguaje líquido se convierte en una parada guiada donde invitados pueden mirar alrededor y clicar.

**Glosario rápido**

- **Raymarching** — pasos a lo largo de un rayo a través de un distance field hasta encontrar superficie
- **SDF** — signed distance function — matemática que describe formas para raymarchers
- **Refraction** — curvatura de la vista a través de agua transparente
- **Shadertoy** — playground online de shaders pixel/raymarch (original de P_Malin)
- **Guided tour Step 3** — en /demos/panorama-360/ — cam · +particles/spout · hotspot+popup

## Pruébalo en unos 60 segundos

1. Abre la [demo Spout](/demos/spout/)
2. Arrastra para orbitar tubo y agua
3. Observa la refracción desplazar el fondo a través del fluido
4. Abre [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, y mira Step 3 (spout / agua + hotspot)
5. Compara con la [vista Shadertoy](https://www.shadertoy.com/view/lsXGzH) original

## Requisitos y rendimiento

- **Navegador:** Chrome, Edge, Firefox o Safari compatible WebGL2
- **GPU:** coste raymarch ligero a moderado — reduce resolución si hace falta
- **API:** port shader WebGL2 — no compute WebGPU

## Lo que ves

Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:

![Spout hero — metal de tubo y columna de agua refractiva](/assets/blog/spout/view-a.jpg?v=20260722a)

![Detalle orbit — reflexiones y transparencia en el fluido](/assets/blog/spout/view-b.jpg?v=20260722a)

También en este build:

- Retunear paleta para metales de marca y tinte de fluido
- Usar stills como referencias look-dev de líquidos de producto
- Insertar el beat de agua en una parada de [tour guiado 360°](/demos/panorama-360/) (Step 3)
- Creditar y estudiar el [Shadertoy](https://www.shadertoy.com/view/lsXGzH) de P_Malin

## Cómo funciona

Un fragment shader WebGL2 fullscreen (o ligado a mesh) raymarched SDFs para tubo y agua, aplicando refracción, transparencia y reflexiones. IOM aloja un port del experimento Shadertoy [lsXGzH](https://www.shadertoy.com/view/lsXGzH) de P_Malin bajo `/demos/spout/`. Es shader art clásico en **WebGL2**, complementario a demos escena Three.js y distinto del agua WebGPU TSL.

## FAQ

**¿El agua se simula con física?**  
No — geometría/animación shader raymarched, no sim de partículas fluido.

**¿Puede correr dentro de una escena producto Three.js?**  
A menudo como screen pass o efecto localizado — integración acotada por proyecto. El tour panorama en https://iobjectm.com/demos/panorama-360/ es un ejemplo de producción.

**¿Dónde aparece Spout en el tour 360?**  
Guided-tour Step 3 en The Black Witness — spout/agua con popup hotspot. Abre https://iobjectm.com/demos/panorama-360/ y Play guided tour.

## Stack técnico y lecturas

- [Panorama 360 (live)](https://iobjectm.com/demos/panorama-360/)
- [Panorama 360 — visitor preview](https://iobjectm.com/demos/panorama-360/?mode=preview)
- [Shadertoy — Spout (P_Malin)](https://www.shadertoy.com/view/lsXGzH)
- [Ray marching — Wikipedia](https://en.wikipedia.org/wiki/Ray_marching)
- [WebGL2 — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext)

## Relacionado en IOM

Explora más en [Experimentos](/#experiments), más [360° Panorama Tour Editor](/blog/panorama-360-tour), [The Black Witness — 360° Tour](/blog/panorama-suite), [WebGPU Particles](/blog/webgpu-particles), [WebGPU Compute Birds](/blog/webgpu-compute-birds), o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.$iom$,
  $iom$Spout — agua de tubería raymarched — IOM$iom$,
  $iom$Una tubería cromada vertiendo agua raymarched — refracción, transparencia y reflexiones en un port WebGL2 self-hosted del Shadertoy clásico de P_Malin. Arrastra para orbitar la esc$iom$
from public.blog_posts p
where p.slug = $iom$spout$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$en$iom$,
  $iom$Volumetric Lighting — Rect Area lights in the browser$iom$,
  $iom$See god rays live in the browser: WebGPU volumetric lights, a Pagani turntable, camera paths, and your own GLB — for product viz, pitches, and anyone curious how the effect works.$iom$,
  $iom$God rays in a product shot used to mean offline renders or heavy game engines. This demo brings that “light you can see in the air” look to a Chrome/Edge tab — colored panel lights, soft haze, a car on a turntable, and camera views you can record.

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
- Save / load a `.vlproject.json` project file

## How it works

The scene is not fake bloom over a flat plate. A volume box is ray-marched each frame through a 3D noise field so light shafts pick up density as they travel.

### WebGPU

[WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) is the modern GPU API for the web — closer to Vulkan/Metal/D3D12 than older WebGL. It unlocks newer shading pipelines that three.js exposes through its WebGPU renderer.

### Three.js + TSL

We use [Three.js](https://threejs.org/) (r185 in this demo) with `WebGPURenderer`, TSL nodes, and `VolumeNodeMaterial`. Rect-area lights feed the volumetric pass; separate spotlight proxies handle surface lighting and shadows (rect-area lights do not cast classic shadow maps).

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

Browse more realtime work in [3D](/#3d) and [Experiments](/#experiments), or [contact us](/#contact) if you want volumetric lighting or WebGPU product viz scoped for a client pitch.$iom$,
  $iom$Volumetric Lighting with WebGPU Rect Area Lights — IOM$iom$,
  $iom$Try IOM’s WebGPU volumetric lighting demo: god rays, Pagani turntable, camera paths, and GLB import — plus a beginner guide, try-this walkthrough, and when to use it for product viz.$iom$
from public.blog_posts p
where p.slug = $iom$volume-lighting$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$de$iom$,
  $iom$Volumetrisches Licht — Rect-Area-Lichter im Browser$iom$,
  $iom$God Rays live im Browser: WebGPU-Volumenlicht, Pagani-Drehscheibe, Kamerapfade und eigenes GLB — für Product Viz, Pitches und alle, die den Effekt verstehen wollen.$iom$,
  $iom$God Rays in einem Produktshot bedeuteten früher Offline-Renders oder schwere Game-Engines. Diese Demo bringt den Look „Licht, das man in der Luft sieht“ in einen Chrome/Edge-Tab — farbige Panel-Lichter, weicher Dunst, ein Auto auf der Drehscheibe und Kamerablicke, die Sie aufzeichnen können.

Es liegt in unserem [3D-Bereich](/#3d) als **Volumetric Lighting — Rect Area**. Das Cover oben ist die Hero-Drei-Viertel-Ansicht (Pagani als Silhouette vor den RGB-Beams).

## Live-Demo öffnen

**[→ Volumetric Lighting starten](/demos/volume-lighting/)**

Ziehen zum Orbitieren, scrollen zum Zoomen. Keine Installation. Wenn Ihr Browser kein WebGPU unterstützt, sehen Sie eine klare Meldung statt einer leeren Seite.

## Warum das zählt (auch ohne Entwickler-Hintergrund)

Sichtbare Lichtstrahlen lassen ein Produkt premium und filmisch wirken — dieselbe Sprache wie Auto-Spots, Museumslighting und Brandfilme. Der Unterschied hier ist **Tempo und Zugang**:

- **Einen Look in Minuten pitchen** — Link öffnen, Auto orbitieren, Nebel justieren, Kamerapfad aufzeichnen
- **Eigenes Modell testen** — GLB / GLTF / FBX laden und unter volumetrischem Licht lesen
- **Kein Render-Farm-Warten** — Kunden können es im Call auf dem Laptop ausprobieren
- **Showroom / Booth ready** — dieselbe Tech-Familie wie immersive Web-Erlebnisse auf [iobjectm.com](/)

Typische Einsätze: Automotive- und Produktkonfiguratoren, Launch-Pages, Trade-Booth-Previews, Galerie-Lichtstudien und „Was wäre, wenn wir es so beleuchten?“ vor dem Production-Build.

## Für Einsteiger — was ist das, in einfachen Worten?

Stellen Sie sich ein staubiges Lager mit Sonnenlicht durch ein hohes Fenster vor. Sie sehen nicht nur das helle Fenster — Sie sehen den **Strahl** in der Luft, weil Staub den Lichtweg sichtbar macht. Dieser Look heißt oft **God Rays** oder **volumetrisches Licht**.

In Film und Games brauchen solche Strahlen oft lange Renderzeiten oder schwere Desktop-Apps. Hier läuft dieselbe Idee **live im Browser**.

**Kurzes Glossar**

- **Browser-Demo** — eine Webpage mit 3D-Grafik, keine Download-App
- **WebGPU** — neuerer Weg, wie Browser mit der GPU sprechen ([Wikipedia](https://en.wikipedia.org/wiki/WebGPU), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API))
- **Three.js** — populäres Toolkit für 3D im Web ([threejs.org](https://threejs.org/))
- **Rect area light** — Licht wie ein leuchtendes Panel oder Softbox, kein winziger Punkt
- **Camera view** — gespeicherter Winkel, zu dem Sie springen oder den Sie als kurzen Pfad abspielen

## In etwa 60 Sekunden ausprobieren

1. Öffnen Sie die [Live-Demo](/demos/volume-lighting/)
2. **Ziehen** Sie in der Szene zum Orbitieren; **scrollen** zum Zoomen
3. Oben links: **Camera views** → **Record** (oder **Ctrl+Shift+S**), um den aktuellen Winkel zu speichern
4. Oben rechts: **Volumetric Lighting** → **fog intensity** und **smoke amount** ausprobieren
5. Optional: **Objects** → kleines GLB importieren
6. **Play** in Camera views, um zwischen aufgezeichneten Views zu steppen

![Wo klicken — Camera views (links), Volumetric Lighting und Objects (rechts)](/assets/blog/volume-lighting/ui.jpg?v=20260718d)

## Anforderungen und Performance

- **Browser:** Chrome oder Edge 113+ empfohlen; Firefox Nightly kann mit reifendem WebGPU funktionieren. Safari holt auf, kann aber hinterherhinken.
- **Hardware:** Laptop mit diskreter oder aktueller integrierter GPU ist ideal. Auf schwächeren Geräten **resolution** und **step count** unter Volumetric Lighting → Ray Marching senken.
- **Mobile:** Die Demo läuft, aber Controls und GPU-Last sind schwerer — Desktop zuerst.
- **Bei Ruckeln:** Fog, Smoke oder Ray-March-Auflösung reduzieren; andere GPU-Tabs schließen.

## Was Sie sehen

Zwei weitere Winkel derselben Szene (Serien-Pagani Utopia unter rotierenden RGB-Rect-Lights). Das Cover ist die erste Kamera; diese Stillbilder setzen den Rundgang fort:

![Durch die Beams — Blick an den Rect-Area-Panels vorbei in die Nebel-Volume](/assets/blog/volume-lighting/beams.jpg?v=20260718d)

![Tiefes Seitenprofil — Metallkarosse, Bodenschatten und volumetrischer Dunst](/assets/blog/volume-lighting/profile.jpg?v=20260718d)

Ebenfalls in der Demo:

- Orbit, Zoom und **Camera-Keyframes** aufzeichnen, dann einen Pfad abspielen
- Eigenes **GLB / GLTF / FBX** importieren und im selben Nebel neu belichten
- Ray-March-Auflösung, Step Count, Denoise, Fog und Smoke justieren
- `.vlproject.json` speichern / laden

## So funktioniert es

Die Szene ist kein Fake-Bloom über einer flachen Platte. Eine Volume-Box wird jedes Frame durch ein 3D-Noise-Feld ray-gemarched, sodass Lichtschächte unterwegs Dichte aufnehmen.

### WebGPU

[WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) ist die moderne GPU-API fürs Web — näher an Vulkan/Metal/D3D12 als älteres WebGL. Sie öffnet neuere Shading-Pipelines, die three.js über den WebGPU-Renderer exponiert.

### Three.js + TSL

Wir nutzen [Three.js](https://threejs.org/) (r185 in dieser Demo) mit `WebGPURenderer`, TSL-Nodes und `VolumeNodeMaterial`. Rect-Area-Lights speisen den volumetrischen Pass; separate Spotlight-Proxies übernehmen Oberflächenlicht und Schatten (Rect-Area wirft keine klassischen Shadow Maps).

Defaults halten den Effekt interaktiv: Viertel-Auflösung Ray March, moderate Steps und optionales Gaussian Denoise für Mid-Range-GPUs.

### Über das Upstream-Beispiel hinaus

Ausgangspunkt ist das offizielle three.js-[Volumetric-Lighting-Rect-Area](https://threejs.org/examples/#webgpu_volume_lighting_rectarea)-Beispiel ([Source auf GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_volume_lighting_rectarea.html)). IOM ergänzt Pagani-Szene, Modellimport, Transform-Gizmo, Camera-Keyframes und Projekt-Save/Load.

Serienauto: [Pagani Utopia 2023 auf Sketchfab](https://sketchfab.com/3d-models/pagani-utopia-2023-4787fa901db1454bb971ba83739d1de6) ([zirodesign](https://sketchfab.com/zirodesign)) — Credit bleibt in der Demo-Attribution.

## FAQ

**Muss ich eine App installieren?**  
Nein. Es ist eine Webpage. Sie brauchen nur einen WebGPU-fähigen Browser.

**Kann ich mein eigenes 3D-Modell nutzen?**  
Ja. Im Objects-Panel GLB, GLTF oder FBX importieren und im selben Volume neu belichten.

**Ist das WebGL oder WebGPU?**  
Diese Demo zielt auf **WebGPU** via Three.js. Ältere WebGL-Demos auf der Site sind ein anderer, breiter unterstützter Pfad.

**Können Kunden das im Call ausprobieren?**  
Ja — teilen Sie den [Demo-Link](/demos/volume-lighting/). Für einen polierten Pitch locken wir Kamerapfade, Branding und ein Custom-Modell.

## Tech-Stack und weiterführende Links

- [WebGPU — Wikipedia](https://en.wikipedia.org/wiki/WebGPU)
- [WebGPU API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/) und das [Rect-Area-Volumetric-Beispiel](https://threejs.org/examples/#webgpu_volume_lighting_rectarea)
- Verwandte IOM-Builds: [Art Gallery — WebGPU SSR + Denoise](/demos/ssr-denoise/), [WebGPU Spotlight](/demos/webgpu-spotlight/)

## Verwandt bei IOM

Mehr Realtime-Arbeit in [3D](/#3d) und [Experimente](/#experiments), oder [kontaktieren Sie uns](/#contact), wenn Sie volumetrisches Licht oder WebGPU Product Viz für einen Kundenpitch brauchen.$iom$,
  $iom$Volumetrisches Licht mit WebGPU Rect-Area-Lights — IOM$iom$,
  $iom$IOMs WebGPU-Demo für volumetrisches Licht: God Rays, Pagani-Drehscheibe, Kamerapfade und GLB-Import — plus Einsteiger-Guide und Wann es für Product Viz Sinn ergibt.$iom$
from public.blog_posts p
where p.slug = $iom$volume-lighting$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$fr$iom$,
  $iom$Éclairage volumétrique — lumières Rect Area dans le navigateur$iom$,
  $iom$God rays en direct dans le navigateur : lumières volumétriques WebGPU, plateau Pagani, chemins caméra et votre propre GLB — pour la product viz, les pitches et la curiosité technique.$iom$,
  $iom$Les god rays dans une photo produit signifiaient autrefois des rendus offline ou des moteurs lourds. Cette démo apporte ce look « lumière visible dans l’air » dans un onglet Chrome/Edge — panneaux colorés, brume douce, une voiture sur plateau, et des vues caméra enregistrables.

Elle se trouve dans notre [section 3D](/#3d) sous **Volumetric Lighting — Rect Area**. La couverture est la vue hero trois-quarts (Pagani en silhouette devant les faisceaux RVB).

## Ouvrir la démo en direct

**[→ Lancer Volumetric Lighting](/demos/volume-lighting/)**

Glissez pour orbiter, molette pour zoomer. Aucune installation. Sans WebGPU, un message clair apparaît au lieu d’une page vide.

## Pourquoi c’est important (même sans être développeur)

Des faisceaux visibles rendent un produit premium et cinématographique — le langage des pubs auto, musées et films de marque. Ici, la différence est la **vitesse et l’accès** :

- **Pitcher un look en minutes** — ouvrir un lien, orbiter, régler le brouillard, enregistrer un chemin
- **Tester votre modèle** — importer GLB / GLTF / FBX sous lumière volumétrique
- **Sans ferme de rendu** — les clients peuvent essayer sur un laptop en appel
- **Showroom / stand ready** — même famille tech que nos expériences web immersives sur [iobjectm.com](/)

Usages typiques : configurateurs auto/produit, pages de lancement, previews de stand, études d’éclairage de galerie, et conversations « et si on éclairait comme ça ? » avant la prod.

## Pour débutants — qu’est-ce que c’est, en mots simples ?

Imaginez un entrepôt poussiéreux avec le soleil par une haute fenêtre. Vous ne voyez pas seulement la fenêtre — vous voyez le **faisceau** dans l’air, parce que la poussière rend le chemin de lumière visible. On appelle souvent ça **god rays** ou **éclairage volumétrique**.

Au cinéma et dans les jeux, ces faisceaux demandent de longs rendus ou une app desktop lourde. Ici, la même idée tourne **en direct dans le navigateur**.

**Glossaire rapide**

- **Démo navigateur** — une page qui dessine de la 3D, pas une app à installer
- **WebGPU** — façon moderne pour le navigateur de parler au GPU ([Wikipedia](https://en.wikipedia.org/wiki/WebGPU), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API))
- **Three.js** — toolkit populaire pour la 3D web ([threejs.org](https://threejs.org/))
- **Rect area light** — lumière en panneau / softbox, pas une petite ampoule ponctuelle
- **Camera view** — angle sauvegardé à rejouer ou enchaîner

## Essayez en environ 60 secondes

1. Ouvrez la [démo live](/demos/volume-lighting/)
2. **Glissez** pour orbiter ; **molette** pour zoomer
3. En haut à gauche : **Camera views** → **Record** (ou **Ctrl+Shift+S**)
4. En haut à droite : **Volumetric Lighting** → essayez **fog intensity** et **smoke amount**
5. Optionnel : **Objects** → importer un petit GLB
6. **Play** dans Camera views pour enchaîner les vues

![Où cliquer — Camera views (gauche), Volumetric Lighting et Objects (droite)](/assets/blog/volume-lighting/ui.jpg?v=20260718d)

## Prérequis et performances

- **Navigateur :** Chrome ou Edge 113+ recommandé ; Firefox Nightly possible selon WebGPU. Safari progresse mais peut être en retard.
- **Matériel :** GPU discret ou iGPU récent idéal. Sur machines faibles, baissez **resolution** et **step count** sous Volumetric Lighting → Ray Marching.
- **Mobile :** ça tourne, mais desktop d’abord.
- **Si ça saccade :** réduisez fog, smoke ou résolution ; fermez d’autres onglets GPU.

## Ce que vous voyez

Deux autres angles de la même scène (Pagani Utopia stock sous rect lights RVB rotatives). La couverture est la première caméra ; ces images poursuivent le parcours :

![À travers les faisceaux — au-delà des panneaux rect-area dans le volume de brouillard](/assets/blog/volume-lighting/beams.jpg?v=20260718d)

![Profil bas — carrosserie métallique, ombres au sol et brume volumétrique](/assets/blog/volume-lighting/profile.jpg?v=20260718d)

Aussi dans la démo :

- Orbiter, zoomer, enregistrer des **keyframes caméra**, puis jouer un chemin
- Importer votre **GLB / GLTF / FBX** et le relight dans le même volume
- Régler résolution ray-march, steps, denoise, fog et smoke
- Sauver / charger un `.vlproject.json`

## Comment ça marche

Ce n’est pas un faux bloom sur une plaque plate. Une boîte de volume est ray-marchée chaque frame dans un champ de bruit 3D pour que les shafts prennent de la densité en chemin.

### WebGPU

[WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) est l’API GPU moderne du web — plus proche de Vulkan/Metal/D3D12 que WebGL. Elle débloque des pipelines que three.js expose via son renderer WebGPU.

### Three.js + TSL

Nous utilisons [Three.js](https://threejs.org/) (r185) avec `WebGPURenderer`, nodes TSL et `VolumeNodeMaterial`. Les rect-area lights alimentent la passe volumétrique ; des spotlights proxies gèrent surface et ombres.

Les défauts restent interactifs : ray march en quart de résolution, steps modestes, denoise gaussien optionnel.

### Au-delà de l’exemple upstream

Point de départ : l’exemple officiel three.js [volumetric lighting rect-area](https://threejs.org/examples/#webgpu_volume_lighting_rectarea) ([source GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_volume_lighting_rectarea.html)). IOM ajoute la scène Pagani, l’import modèle, le gizmo, les keyframes caméra et le save/load projet.

Voiture stock : [Pagani Utopia 2023 sur Sketchfab](https://sketchfab.com/3d-models/pagani-utopia-2023-4787fa901db1454bb971ba83739d1de6) ([zirodesign](https://sketchfab.com/zirodesign)) — crédit conservé dans l’attribution.

## FAQ

**Faut-il installer une app ?**  
Non. C’est une page web. Il faut un navigateur compatible WebGPU.

**Puis-je utiliser mon modèle 3D ?**  
Oui. Panneau Objects : importer GLB, GLTF ou FBX et relight dans le même volume.

**WebGL ou WebGPU ?**  
Cette démo cible **WebGPU** via Three.js. D’autres démos WebGL du site restent utiles pour une couverture device plus large.

**Les clients peuvent-ils essayer en appel ?**  
Oui — partagez le [lien démo](/demos/volume-lighting/). Pour un pitch poli, nous verrouillons chemins caméra, branding et modèle custom.

## Stack technique et lectures

- [WebGPU — Wikipedia](https://en.wikipedia.org/wiki/WebGPU)
- [WebGPU API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/) et l’[exemple volumétrique rect-area](https://threejs.org/examples/#webgpu_volume_lighting_rectarea)
- Builds IOM liées : [Art Gallery — WebGPU SSR + Denoise](/demos/ssr-denoise/), [WebGPU Spotlight](/demos/webgpu-spotlight/)

## Sur IOM

Plus de realtime dans [3D](/#3d) et [Expériences](/#experiments), ou [contactez-nous](/#contact) pour un éclairage volumétrique / product viz WebGPU scoped pour un pitch client.$iom$,
  $iom$Éclairage volumétrique WebGPU Rect Area — IOM$iom$,
  $iom$Démo WebGPU IOM d’éclairage volumétrique : god rays, plateau Pagani, chemins caméra et import GLB — guide débutant et cas d’usage product viz.$iom$
from public.blog_posts p
where p.slug = $iom$volume-lighting$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$nl$iom$,
  $iom$Volumetrische belichting — Rect Area-lichten in de browser$iom$,
  $iom$God rays live in de browser: WebGPU volumetrisch licht, Pagani-draaitafel, camerapaden en je eigen GLB — voor product viz, pitches en wie het effect wil begrijpen.$iom$,
  $iom$God rays in een productshot betekenden vroeger offline renders of zware game-engines. Deze demo brengt die “licht dat je in de lucht ziet”-look naar een Chrome/Edge-tab — gekleurde panellichten, zachte haze, een auto op een draaitafel, en camera views die je kunt opnemen.

Het staat in onze [3D-sectie](/#3d) als **Volumetric Lighting — Rect Area**. De cover is de hero three-quarter view (Pagani als silhouet tegen de RGB-beams).

## Open de live demo

**[→ Start Volumetric Lighting](/demos/volume-lighting/)**

Sleep om te orbiteren, scroll om te zoomen. Geen installatie. Zonder WebGPU zie je een duidelijke melding in plaats van een lege pagina.

## Waarom dit telt (ook zonder ontwikkelaar te zijn)

Zichtbare lichtstralen maken een product premium en filmisch — dezelfde taal als autospots, museumlicht en brandfilms. Het verschil hier is **snelheid en toegang**:

- **Pitch een look in minuten** — open een link, orbit, tweaks fog, neem een camerapad op
- **Test je eigen model** — drop GLB / GLTF / FBX onder volumetrisch licht
- **Geen render farm** — klanten kunnen het in een call op een laptop proberen
- **Showroom / booth ready** — dezelfde tech-familie als immersive web op [iobjectm.com](/)

Typische toepassingen: automotive- en productconfigurators, launch pages, trade-booth previews, galerij-lichtstudies, en “wat als we het zo belichten?” vóór de productiebuild.

## Voor beginners — wat is dit, in gewone taal?

Denk aan een stoffig magazijn met zonlicht door een hoog raam. Je ziet niet alleen het raam — je ziet de **straal** in de lucht, omdat stof het lichtpad zichtbaar maakt. Die look heet vaak **god rays** of **volumetrische belichting**.

In film en games kosten die stralen meestal lange renders of een zware desktop-app. Hier draait hetzelfde idee **live in je browser**.

**Korte glossary**

- **Browserdemo** — een webpage met 3D-graphics, geen download-app
- **WebGPU** — nieuwere manier waarop browsers met de GPU praten ([Wikipedia](https://en.wikipedia.org/wiki/WebGPU), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API))
- **Three.js** — populaire toolkit voor 3D op het web ([threejs.org](https://threejs.org/))
- **Rect area light** — licht als een panel of softbox, geen klein puntlampje
- **Camera view** — opgeslagen hoek om naar terug te springen of als pad af te spelen

## Probeer dit in ongeveer 60 seconden

1. Open de [live demo](/demos/volume-lighting/)
2. **Sleep** om te orbiteren; **scroll** om te zoomen
3. Linksboven: **Camera views** → **Record** (of **Ctrl+Shift+S**)
4. Rechtsboven: **Volumetric Lighting** → probeer **fog intensity** en **smoke amount**
5. Optioneel: **Objects** → importeer een klein GLB
6. **Play** in Camera views om tussen views te stappen

![Waar klikken — Camera views (links), Volumetric Lighting en Objects (rechts)](/assets/blog/volume-lighting/ui.jpg?v=20260718d)

## Vereisten en performance

- **Browser:** Chrome of Edge 113+ aanbevolen; Firefox Nightly kan werken naarmate WebGPU rijpt. Safari loopt soms achter.
- **Hardware:** discrete of recente iGPU ideaal. Op zwakkere machines: verlaag **resolution** en **step count** onder Volumetric Lighting → Ray Marching.
- **Mobiel:** het draait, maar desktop eerst.
- **Bij stotteren:** verlaag fog, smoke of ray-march-resolutie; sluit andere GPU-tabs.

## Wat je ziet

Nog twee hoeken van dezelfde scene (stock Pagani Utopia onder roterende RGB rect lights). De cover is de eerste camera; deze stills zetten de walkthrough voort:

![Door de beams — langs de rect-area panels de fog volume in](/assets/blog/volume-lighting/beams.jpg?v=20260718d)

![Laag zijprofiel — metalen body, vloerschaduwen en volumetrische haze](/assets/blog/volume-lighting/profile.jpg?v=20260718d)

Ook in de demo:

- Orbit, zoom en **camera keyframes** opnemen, daarna een pad afspelen
- Eigen **GLB / GLTF / FBX** importeren en opnieuw belichten
- Ray-march-resolutie, steps, denoise, fog en smoke tweaken
- `.vlproject.json` opslaan / laden

## Hoe het werkt

Dit is geen nep-bloom op een platte plaat. Een volume-box wordt elk frame door een 3D-noisefield ray-gemarched zodat light shafts onderweg dichtheid oppikken.

### WebGPU

[WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) is de moderne GPU-API voor het web — dichter bij Vulkan/Metal/D3D12 dan ouder WebGL. Het ontsluit nieuwere shading-pipelines via de WebGPU-renderer van three.js.

### Three.js + TSL

We gebruiken [Three.js](https://threejs.org/) (r185) met `WebGPURenderer`, TSL-nodes en `VolumeNodeMaterial`. Rect-area lights voeden de volumetrische pass; aparte spotlight-proxies doen surface lighting en schaduwen.

Defaults blijven interactief: quarter-resolution ray march, bescheiden steps, optionele Gaussian denoise.

### Voorbij het upstream-voorbeeld

Startpunt is het officiële three.js [volumetric lighting rect-area](https://threejs.org/examples/#webgpu_volume_lighting_rectarea)-voorbeeld ([source op GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_volume_lighting_rectarea.html)). IOM voegt Pagani-scene, modelimport, transform-gizmo, camera keyframes en project save/load toe.

Stock auto: [Pagani Utopia 2023 op Sketchfab](https://sketchfab.com/3d-models/pagani-utopia-2023-4787fa901db1454bb971ba83739d1de6) ([zirodesign](https://sketchfab.com/zirodesign)) — credit blijft in de demo-attributie.

## FAQ

**Moet ik een app installeren?**  
Nee. Het is een webpage. Je hebt alleen een WebGPU-capable browser nodig.

**Kan ik mijn eigen 3D-model gebruiken?**  
Ja. Objects-paneel: importeer GLB, GLTF of FBX en belicht opnieuw in hetzelfde volume.

**Is dit WebGL of WebGPU?**  
Deze demo mikt op **WebGPU** via Three.js. Oudere WebGL-demo’s elders op de site dekken bredere devices.

**Kunnen klanten dit in een call proberen?**  
Ja — deel de [demolink](/demos/volume-lighting/). Voor een gepolijste pitch locken we camerapaden, branding en een custom model.

## Tech stack en verder lezen

- [WebGPU — Wikipedia](https://en.wikipedia.org/wiki/WebGPU)
- [WebGPU API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/) en het [rect-area volumetric voorbeeld](https://threejs.org/examples/#webgpu_volume_lighting_rectarea)
- Gerelateerde IOM-builds: [Art Gallery — WebGPU SSR + Denoise](/demos/ssr-denoise/), [WebGPU Spotlight](/demos/webgpu-spotlight/)

## Gerelateerd op IOM

Meer realtime in [3D](/#3d) en [Experimenten](/#experiments), of [neem contact op](/#contact) voor volumetrisch licht of WebGPU product viz scoped voor een client pitch.$iom$,
  $iom$Volumetrische belichting met WebGPU Rect Area Lights — IOM$iom$,
  $iom$IOM’s WebGPU-demo voor volumetrisch licht: god rays, Pagani-draaitafel, camerapaden en GLB-import — plus beginnersgids en wanneer het past voor product viz.$iom$
from public.blog_posts p
where p.slug = $iom$volume-lighting$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$it$iom$,
  $iom$Illuminazione volumetrica — luci Rect Area nel browser$iom$,
  $iom$God rays live nel browser: luci volumetriche WebGPU, turntable Pagani, percorsi camera e il tuo GLB — per product viz, pitch e chi vuole capire l’effetto.$iom$,
  $iom$I god rays in uno shot di prodotto un tempo richiedevano render offline o engine pesanti. Questa demo porta quel look “luce che si vede nell’aria” in una scheda Chrome/Edge — pannelli colorati, haze morbida, un’auto sul turntable e viste camera che puoi registrare.

Si trova nella nostra [sezione 3D](/#3d) come **Volumetric Lighting — Rect Area**. La cover è la vista hero a tre quarti (Pagani in controluce sui beam RGB).

## Apri la demo live

**[→ Avvia Volumetric Lighting](/demos/volume-lighting/)**

Trascina per orbitare, scroll per zoom. Nessuna installazione. Senza WebGPU vedi un messaggio chiaro invece di una pagina vuota.

## Perché conta (anche se non sei uno sviluppatore)

Fasci di luce visibili rendono un prodotto premium e cinematografico — il linguaggio di spot auto, musei e film di brand. Qui la differenza è **velocità e accesso**:

- **Pitch di un look in minuti** — apri un link, orbita, regola la fog, registra un percorso
- **Prova il tuo modello** — importa GLB / GLTF / FBX sotto luce volumetrica
- **Niente render farm** — i clienti possono provarlo in call sul laptop
- **Showroom / booth ready** — stessa famiglia tech delle esperienze web immersive su [iobjectm.com](/)

Usi tipici: configuratori auto/prodotto, launch page, preview di stand, studi di luce per gallery, e “e se lo illuminassimo così?” prima della produzione.

## Per principianti — cos’è, in parole semplici?

Immagina un magazzino polveroso con sole da una finestra alta. Non vedi solo la finestra — vedi il **raggio** nell’aria, perché la polvere rende visibile il percorso della luce. Quel look si chiama spesso **god rays** o **illuminazione volumetrica**.

In film e game quei raggi richiedono render lunghi o app desktop pesanti. Qui la stessa idea gira **live nel browser**.

**Glossario rapido**

- **Demo browser** — una pagina con grafica 3D, non un’app da scaricare
- **WebGPU** — modo più nuovo per far parlare il browser con la GPU ([Wikipedia](https://en.wikipedia.org/wiki/WebGPU), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API))
- **Three.js** — toolkit popolare per la 3D web ([threejs.org](https://threejs.org/))
- **Rect area light** — luce a pannello / softbox, non una lampadina puntiforme
- **Camera view** — angolo salvato da riprendere o riprodurre come percorso

## Provalo in circa 60 secondi

1. Apri la [demo live](/demos/volume-lighting/)
2. **Trascina** per orbitare; **scroll** per zoom
3. In alto a sinistra: **Camera views** → **Record** (o **Ctrl+Shift+S**)
4. In alto a destra: **Volumetric Lighting** → prova **fog intensity** e **smoke amount**
5. Opzionale: **Objects** → importa un GLB piccolo
6. **Play** in Camera views per passare tra le viste

![Dove cliccare — Camera views (sinistra), Volumetric Lighting e Objects (destra)](/assets/blog/volume-lighting/ui.jpg?v=20260718d)

## Requisiti e prestazioni

- **Browser:** Chrome o Edge 113+ consigliati; Firefox Nightly può funzionare con WebGPU in maturazione. Safari migliora ma può restare indietro.
- **Hardware:** GPU dedicata o iGPU recente ideale. Su macchine deboli abbassa **resolution** e **step count** sotto Volumetric Lighting → Ray Marching.
- **Mobile:** funziona, ma meglio partire da desktop.
- **Se scatta:** riduci fog, smoke o risoluzione; chiudi altre tab GPU.

## Cosa vedi

Altri due angoli della stessa scena (Pagani Utopia stock sotto rect light RGB rotanti). La cover è la prima camera; queste immagini continuano il percorso:

![Attraverso i beam — oltre i pannelli rect-area nel volume di fog](/assets/blog/volume-lighting/beams.jpg?v=20260718d)

![Profilo basso — carrozzeria metallica, ombre a terra e haze volumetrica](/assets/blog/volume-lighting/profile.jpg?v=20260718d)

Anche in questa demo:

- Orbit, zoom e **keyframe camera**, poi play di un percorso
- Importa il tuo **GLB / GLTF / FBX** e rilight nello stesso volume
- Regola risoluzione ray-march, step, denoise, fog e smoke
- Salva / carica un `.vlproject.json`

## Come funziona

Non è bloom finto su una piastra piatta. Una volume box viene ray-marched ogni frame attraverso un campo di noise 3D così gli shaft raccolgono densità lungo il percorso.

### WebGPU

[WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) è l’API GPU moderna per il web — più vicina a Vulkan/Metal/D3D12 del vecchio WebGL. Sblocca pipeline che three.js espone con il renderer WebGPU.

### Three.js + TSL

Usiamo [Three.js](https://threejs.org/) (r185) con `WebGPURenderer`, nodi TSL e `VolumeNodeMaterial`. Le rect-area lights alimentano il pass volumetrico; spotlight proxy gestiscono luce di superficie e ombre.

I default restano interattivi: ray march a un quarto di risoluzione, step moderati, denoise gaussiano opzionale.

### Oltre l’esempio upstream

Punto di partenza: l’esempio ufficiale three.js [volumetric lighting rect-area](https://threejs.org/examples/#webgpu_volume_lighting_rectarea) ([source su GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_volume_lighting_rectarea.html)). IOM aggiunge scena Pagani, import modello, gizmo, keyframe camera e save/load progetto.

Auto stock: [Pagani Utopia 2023 su Sketchfab](https://sketchfab.com/3d-models/pagani-utopia-2023-4787fa901db1454bb971ba83739d1de6) ([zirodesign](https://sketchfab.com/zirodesign)) — credito nella attribution della demo.

## FAQ

**Devo installare un’app?**  
No. È una pagina web. Serve solo un browser con WebGPU.

**Posso usare il mio modello 3D?**  
Sì. Pannello Objects: importa GLB, GLTF o FBX e rilight nello stesso volume.

**È WebGL o WebGPU?**  
Questa demo punta a **WebGPU** via Three.js. Altre demo WebGL del sito coprono più device.

**I clienti possono provarla in call?**  
Sì — condividi il [link demo](/demos/volume-lighting/). Per un pitch rifinito blocchiamo percorsi camera, branding e modello custom.

## Stack tecnico e letture

- [WebGPU — Wikipedia](https://en.wikipedia.org/wiki/WebGPU)
- [WebGPU API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/) e l’[esempio volumetrico rect-area](https://threejs.org/examples/#webgpu_volume_lighting_rectarea)
- Build IOM correlate: [Art Gallery — WebGPU SSR + Denoise](/demos/ssr-denoise/), [WebGPU Spotlight](/demos/webgpu-spotlight/)

## Correlati su IOM

Altro realtime in [3D](/#3d) e [Esperimenti](/#experiments), o [contattaci](/#contact) per illuminazione volumetrica o product viz WebGPU scoped per un pitch cliente.$iom$,
  $iom$Illuminazione volumetrica con WebGPU Rect Area Lights — IOM$iom$,
  $iom$Demo WebGPU IOM di illuminazione volumetrica: god rays, turntable Pagani, percorsi camera e import GLB — guida per principianti e quando usarla in product viz.$iom$
from public.blog_posts p
where p.slug = $iom$volume-lighting$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select p.id,
  $iom$es$iom$,
  $iom$Iluminación volumétrica — luces Rect Area en el navegador$iom$,
  $iom$God rays en vivo en el navegador: luces volumétricas WebGPU, plato Pagani, rutas de cámara y tu propio GLB — para product viz, pitches y quien quiera entender el efecto.$iom$,
  $iom$Los god rays en una foto de producto antes significaban renders offline o motores pesados. Esta demo trae ese look de “luz que se ve en el aire” a una pestaña de Chrome/Edge — paneles de color, haze suave, un coche en plato giratorio y vistas de cámara que puedes grabar.

Está en nuestra [sección 3D](/#3d) como **Volumetric Lighting — Rect Area**. La portada es la vista hero a tres cuartos (Pagani en silueta frente a los beams RGB).

## Abrir la demo en vivo

**[→ Lanzar Volumetric Lighting](/demos/volume-lighting/)**

Arrastra para orbitar, scroll para zoom. Sin instalación. Si el navegador no soporta WebGPU, verás un mensaje claro en lugar de una página en blanco.

## Por qué importa (aunque no seas desarrollador)

Los haces visibles hacen que un producto se sienta premium y cinematográfico — el lenguaje de anuncios de coches, museos y brand films. La diferencia aquí es **velocidad y acceso**:

- **Pitch de un look en minutos** — abre un enlace, orbita, ajusta fog, graba una ruta
- **Prueba tu modelo** — importa GLB / GLTF / FBX bajo luz volumétrica
- **Sin granja de render** — los clientes pueden probarlo en una call en el portátil
- **Showroom / booth ready** — la misma familia tech que las experiencias web inmersivas en [iobjectm.com](/)

Usos típicos: configuradores auto/producto, páginas de lanzamiento, previews de stand, estudios de luz de galería, y “¿y si lo iluminamos así?” antes de la producción.

## Para principiantes — ¿qué es esto, en palabras simples?

Imagina un almacén polvoriento con sol por una ventana alta. No solo ves la ventana — ves el **haz** en el aire, porque el polvo hace visible el camino de la luz. Ese look suele llamarse **god rays** o **iluminación volumétrica**.

En cine y juegos esos haces suelen costar renders largos o una app de escritorio pesada. Aquí la misma idea corre **en vivo en el navegador**.

**Glosario rápido**

- **Demo de navegador** — una página con gráficos 3D, no una app descargable
- **WebGPU** — forma más nueva de que el navegador hable con la GPU ([Wikipedia](https://en.wikipedia.org/wiki/WebGPU), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API))
- **Three.js** — toolkit popular para 3D en la web ([threejs.org](https://threejs.org/))
- **Rect area light** — luz en forma de panel o softbox, no una bombilla puntual
- **Camera view** — ángulo guardado al que volver o reproducir como ruta corta

## Pruébalo en unos 60 segundos

1. Abre la [demo en vivo](/demos/volume-lighting/)
2. **Arrastra** para orbitar; **scroll** para zoom
3. Arriba a la izquierda: **Camera views** → **Record** (o **Ctrl+Shift+S**)
4. Arriba a la derecha: **Volumetric Lighting** → prueba **fog intensity** y **smoke amount**
5. Opcional: **Objects** → importa un GLB pequeño
6. **Play** en Camera views para saltar entre vistas

![Dónde hacer clic — Camera views (izq.), Volumetric Lighting y Objects (der.)](/assets/blog/volume-lighting/ui.jpg?v=20260718d)

## Requisitos y rendimiento

- **Navegador:** Chrome o Edge 113+ recomendados; Firefox Nightly puede funcionar según madure WebGPU. Safari mejora pero puede ir detrás.
- **Hardware:** GPU dedicada o iGPU reciente ideal. En máquinas débiles baja **resolution** y **step count** en Volumetric Lighting → Ray Marching.
- **Móvil:** funciona, pero mejor empezar en escritorio.
- **Si va a tirones:** reduce fog, smoke o resolución; cierra otras pestañas GPU.

## Lo que ves

Dos ángulos más de la misma escena (Pagani Utopia de stock bajo rect lights RGB rotatorias). La portada es la primera cámara; estas imágenes continúan el recorrido:

![A través de los beams — más allá de los paneles rect-area hacia el volumen de niebla](/assets/blog/volume-lighting/beams.jpg?v=20260718d)

![Perfil bajo — carrocería metálica, sombras en el suelo y haze volumétrica](/assets/blog/volume-lighting/profile.jpg?v=20260718d)

También en la demo:

- Orbitar, zoom y grabar **keyframes de cámara**, luego reproducir una ruta
- Importar tu **GLB / GLTF / FBX** y relight en el mismo volumen
- Ajustar resolución de ray-march, steps, denoise, fog y smoke
- Guardar / cargar un `.vlproject.json`

## Cómo funciona

No es bloom falso sobre una placa plana. Una caja de volumen se ray-marches cada frame a través de un campo de ruido 3D para que los shafts capten densidad en el camino.

### WebGPU

[WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) es la API GPU moderna de la web — más cercana a Vulkan/Metal/D3D12 que el WebGL antiguo. Desbloquea pipelines que three.js expone con su renderer WebGPU.

### Three.js + TSL

Usamos [Three.js](https://threejs.org/) (r185) con `WebGPURenderer`, nodos TSL y `VolumeNodeMaterial`. Las rect-area lights alimentan el pass volumétrico; spotlights proxy manejan luz de superficie y sombras.

Los defaults se mantienen interactivos: ray march a un cuarto de resolución, steps modestos y denoise gaussiano opcional.

### Más allá del ejemplo upstream

Punto de partida: el ejemplo oficial de three.js [volumetric lighting rect-area](https://threejs.org/examples/#webgpu_volume_lighting_rectarea) ([source en GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_volume_lighting_rectarea.html)). IOM añade la escena Pagani, importación de modelo, gizmo, keyframes de cámara y save/load de proyecto.

Coche de stock: [Pagani Utopia 2023 en Sketchfab](https://sketchfab.com/3d-models/pagani-utopia-2023-4787fa901db1454bb971ba83739d1de6) ([zirodesign](https://sketchfab.com/zirodesign)) — crédito en la atribución de la demo.

## FAQ

**¿Necesito instalar una app?**  
No. Es una página web. Solo hace falta un navegador con WebGPU.

**¿Puedo usar mi propio modelo 3D?**  
Sí. Panel Objects: importa GLB, GLTF o FBX y relight en el mismo volumen.

**¿Es WebGL o WebGPU?**  
Esta demo apunta a **WebGPU** vía Three.js. Otras demos WebGL del sitio cubren más dispositivos.

**¿Pueden los clientes probarlo en una call?**  
Sí — comparte el [enlace de la demo](/demos/volume-lighting/). Para un pitch pulido bloqueamos rutas de cámara, branding y un modelo custom.

## Stack técnico y lecturas

- [WebGPU — Wikipedia](https://en.wikipedia.org/wiki/WebGPU)
- [WebGPU API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Three.js](https://threejs.org/) y el [ejemplo volumétrico rect-area](https://threejs.org/examples/#webgpu_volume_lighting_rectarea)
- Builds IOM relacionadas: [Art Gallery — WebGPU SSR + Denoise](/demos/ssr-denoise/), [WebGPU Spotlight](/demos/webgpu-spotlight/)

## Relacionado en IOM

Más realtime en [3D](/#3d) y [Experimentos](/#experiments), o [contáctanos](/#contact) si quieres iluminación volumétrica o product viz WebGPU scoped para un pitch de cliente.$iom$,
  $iom$Iluminación volumétrica con WebGPU Rect Area Lights — IOM$iom$,
  $iom$Demo WebGPU de IOM de iluminación volumétrica: god rays, plato Pagani, rutas de cámara e importación GLB — guía para principiantes y cuándo usarla en product viz.$iom$
from public.blog_posts p
where p.slug = $iom$volume-lighting$iom$
on conflict (post_id, locale) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  updated_at = now();

-- 162 translation rows for 27 catalog posts