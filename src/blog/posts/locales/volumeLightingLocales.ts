import type { BlogContentLocale, BlogPostTranslationFields } from '../../types'

/** Full article translations for volume-lighting (not generated from DemoPostSpec). */
export const VOLUME_LIGHTING_LOCALES: Record<
  Exclude<BlogContentLocale, 'en'>,
  BlogPostTranslationFields
> = {
  de: {
    title: 'Volumetrisches Licht — Rect-Area-Lichter im Browser',
    excerpt:
      'God Rays live im Browser: WebGPU-Volumenlicht, Pagani-Drehscheibe, Kamerapfade und eigenes GLB — für Product Viz, Pitches und alle, die den Effekt verstehen wollen.',
    seo_title: 'Volumetrisches Licht mit WebGPU Rect-Area-Lights — IOM',
    seo_description:
      'IOMs WebGPU-Demo für volumetrisches Licht: God Rays, Pagani-Drehscheibe, Kamerapfade und GLB-Import — plus Einsteiger-Guide und Wann es für Product Viz Sinn ergibt.',
    body: `God Rays in einem Produktshot bedeuteten früher Offline-Renders oder schwere Game-Engines. Diese Demo bringt den Look „Licht, das man in der Luft sieht“ in einen Chrome/Edge-Tab — farbige Panel-Lichter, weicher Dunst, ein Auto auf der Drehscheibe und Kamerablicke, die Sie aufzeichnen können.

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
- \`.vlproject.json\` speichern / laden

## So funktioniert es

Die Szene ist kein Fake-Bloom über einer flachen Platte. Eine Volume-Box wird jedes Frame durch ein 3D-Noise-Feld ray-gemarched, sodass Lichtschächte unterwegs Dichte aufnehmen.

### WebGPU

[WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) ist die moderne GPU-API fürs Web — näher an Vulkan/Metal/D3D12 als älteres WebGL. Sie öffnet neuere Shading-Pipelines, die three.js über den WebGPU-Renderer exponiert.

### Three.js + TSL

Wir nutzen [Three.js](https://threejs.org/) (r185 in dieser Demo) mit \`WebGPURenderer\`, TSL-Nodes und \`VolumeNodeMaterial\`. Rect-Area-Lights speisen den volumetrischen Pass; separate Spotlight-Proxies übernehmen Oberflächenlicht und Schatten (Rect-Area wirft keine klassischen Shadow Maps).

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

Mehr Realtime-Arbeit in [3D](/#3d) und [Experimente](/#experiments), oder [kontaktieren Sie uns](/#contact), wenn Sie volumetrisches Licht oder WebGPU Product Viz für einen Kundenpitch brauchen.`,
  },
  fr: {
    title: 'Éclairage volumétrique — lumières Rect Area dans le navigateur',
    excerpt:
      'God rays en direct dans le navigateur : lumières volumétriques WebGPU, plateau Pagani, chemins caméra et votre propre GLB — pour la product viz, les pitches et la curiosité technique.',
    seo_title: 'Éclairage volumétrique WebGPU Rect Area — IOM',
    seo_description:
      'Démo WebGPU IOM d’éclairage volumétrique : god rays, plateau Pagani, chemins caméra et import GLB — guide débutant et cas d’usage product viz.',
    body: `Les god rays dans une photo produit signifiaient autrefois des rendus offline ou des moteurs lourds. Cette démo apporte ce look « lumière visible dans l’air » dans un onglet Chrome/Edge — panneaux colorés, brume douce, une voiture sur plateau, et des vues caméra enregistrables.

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
- Sauver / charger un \`.vlproject.json\`

## Comment ça marche

Ce n’est pas un faux bloom sur une plaque plate. Une boîte de volume est ray-marchée chaque frame dans un champ de bruit 3D pour que les shafts prennent de la densité en chemin.

### WebGPU

[WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) est l’API GPU moderne du web — plus proche de Vulkan/Metal/D3D12 que WebGL. Elle débloque des pipelines que three.js expose via son renderer WebGPU.

### Three.js + TSL

Nous utilisons [Three.js](https://threejs.org/) (r185) avec \`WebGPURenderer\`, nodes TSL et \`VolumeNodeMaterial\`. Les rect-area lights alimentent la passe volumétrique ; des spotlights proxies gèrent surface et ombres.

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

Plus de realtime dans [3D](/#3d) et [Expériences](/#experiments), ou [contactez-nous](/#contact) pour un éclairage volumétrique / product viz WebGPU scoped pour un pitch client.`,
  },
  nl: {
    title: 'Volumetrische belichting — Rect Area-lichten in de browser',
    excerpt:
      'God rays live in de browser: WebGPU volumetrisch licht, Pagani-draaitafel, camerapaden en je eigen GLB — voor product viz, pitches en wie het effect wil begrijpen.',
    seo_title: 'Volumetrische belichting met WebGPU Rect Area Lights — IOM',
    seo_description:
      'IOM’s WebGPU-demo voor volumetrisch licht: god rays, Pagani-draaitafel, camerapaden en GLB-import — plus beginnersgids en wanneer het past voor product viz.',
    body: `God rays in een productshot betekenden vroeger offline renders of zware game-engines. Deze demo brengt die “licht dat je in de lucht ziet”-look naar een Chrome/Edge-tab — gekleurde panellichten, zachte haze, een auto op een draaitafel, en camera views die je kunt opnemen.

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
- \`.vlproject.json\` opslaan / laden

## Hoe het werkt

Dit is geen nep-bloom op een platte plaat. Een volume-box wordt elk frame door een 3D-noisefield ray-gemarched zodat light shafts onderweg dichtheid oppikken.

### WebGPU

[WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) is de moderne GPU-API voor het web — dichter bij Vulkan/Metal/D3D12 dan ouder WebGL. Het ontsluit nieuwere shading-pipelines via de WebGPU-renderer van three.js.

### Three.js + TSL

We gebruiken [Three.js](https://threejs.org/) (r185) met \`WebGPURenderer\`, TSL-nodes en \`VolumeNodeMaterial\`. Rect-area lights voeden de volumetrische pass; aparte spotlight-proxies doen surface lighting en schaduwen.

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

Meer realtime in [3D](/#3d) en [Experimenten](/#experiments), of [neem contact op](/#contact) voor volumetrisch licht of WebGPU product viz scoped voor een client pitch.`,
  },
  it: {
    title: 'Illuminazione volumetrica — luci Rect Area nel browser',
    excerpt:
      'God rays live nel browser: luci volumetriche WebGPU, turntable Pagani, percorsi camera e il tuo GLB — per product viz, pitch e chi vuole capire l’effetto.',
    seo_title: 'Illuminazione volumetrica con WebGPU Rect Area Lights — IOM',
    seo_description:
      'Demo WebGPU IOM di illuminazione volumetrica: god rays, turntable Pagani, percorsi camera e import GLB — guida per principianti e quando usarla in product viz.',
    body: `I god rays in uno shot di prodotto un tempo richiedevano render offline o engine pesanti. Questa demo porta quel look “luce che si vede nell’aria” in una scheda Chrome/Edge — pannelli colorati, haze morbida, un’auto sul turntable e viste camera che puoi registrare.

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
- Salva / carica un \`.vlproject.json\`

## Come funziona

Non è bloom finto su una piastra piatta. Una volume box viene ray-marched ogni frame attraverso un campo di noise 3D così gli shaft raccolgono densità lungo il percorso.

### WebGPU

[WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) è l’API GPU moderna per il web — più vicina a Vulkan/Metal/D3D12 del vecchio WebGL. Sblocca pipeline che three.js espone con il renderer WebGPU.

### Three.js + TSL

Usiamo [Three.js](https://threejs.org/) (r185) con \`WebGPURenderer\`, nodi TSL e \`VolumeNodeMaterial\`. Le rect-area lights alimentano il pass volumetrico; spotlight proxy gestiscono luce di superficie e ombre.

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

Altro realtime in [3D](/#3d) e [Esperimenti](/#experiments), o [contattaci](/#contact) per illuminazione volumetrica o product viz WebGPU scoped per un pitch cliente.`,
  },
  es: {
    title: 'Iluminación volumétrica — luces Rect Area en el navegador',
    excerpt:
      'God rays en vivo en el navegador: luces volumétricas WebGPU, plato Pagani, rutas de cámara y tu propio GLB — para product viz, pitches y quien quiera entender el efecto.',
    seo_title: 'Iluminación volumétrica con WebGPU Rect Area Lights — IOM',
    seo_description:
      'Demo WebGPU de IOM de iluminación volumétrica: god rays, plato Pagani, rutas de cámara e importación GLB — guía para principiantes y cuándo usarla en product viz.',
    body: `Los god rays en una foto de producto antes significaban renders offline o motores pesados. Esta demo trae ese look de “luz que se ve en el aire” a una pestaña de Chrome/Edge — paneles de color, haze suave, un coche en plato giratorio y vistas de cámara que puedes grabar.

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
- Guardar / cargar un \`.vlproject.json\`

## Cómo funciona

No es bloom falso sobre una placa plana. Una caja de volumen se ray-marches cada frame a través de un campo de ruido 3D para que los shafts capten densidad en el camino.

### WebGPU

[WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) es la API GPU moderna de la web — más cercana a Vulkan/Metal/D3D12 que el WebGL antiguo. Desbloquea pipelines que three.js expone con su renderer WebGPU.

### Three.js + TSL

Usamos [Three.js](https://threejs.org/) (r185) con \`WebGPURenderer\`, nodos TSL y \`VolumeNodeMaterial\`. Las rect-area lights alimentan el pass volumétrico; spotlights proxy manejan luz de superficie y sombras.

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

Más realtime en [3D](/#3d) y [Experimentos](/#experiments), o [contáctanos](/#contact) si quieres iluminación volumétrica o product viz WebGPU scoped para un pitch de cliente.`,
  },
}
