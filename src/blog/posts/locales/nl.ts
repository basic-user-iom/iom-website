/* Auto-assembled by scripts/assemble-blog-locale-packs.mjs — do not hand-edit large blocks */
import type { DemoPostLocalePack } from './types'

export const nlDemoBlogPosts: DemoPostLocalePack = {
  "3d-viewer": {
    pageTitle: "3D Viewer — productmodellen in de browser",
    demoLabel: "3D Viewer",
    heroVideoCaption: "Productwalkthrough — orbit, HDR-belichting en viewer-chrome",
    excerpt: `v3.19.2 desktop-release: Streets GL-betrouwbaarheid en textuurkwaliteit, Product-mode textuurherstel na City-teardown, uniforme paneelheaders — plus GLTF/FBX/OBJ/IFC-review met HDR-grondprojectie en Streets GL.`,
    seo_title: "3D Viewer v3.19.2 — Streets GL-textures & betrouwbaarheid — IOM",
    seo_description: `3D Viewer v3.19.2 voor Windows (Setup + Portable): Streets GL vertex-budget/simplify-fixes, UV-behoudende 4k-textures, Product-mode textuurherstel en uniforme FloatingPanelHeader-paneelheaders. Browserreview voor GLTF/FBX/OBJ/IFC met HDR en Streets GL.`,
    hook: `Klanten zouden geen CAD-licentie nodig moeten hebben om een model te beoordelen. Onze 3D Viewer zet GLTF, FBX, OBJ en IFC in een deelbaar browser- (en desktop-)venster — orbit, materialen inspecteren, belichten met 360° HDR en grondprojectie, of het mesh in OSM / Streets GL-stadscontext plaatsen wanneer de locatie het verhaal vertelt.`,
    coverNote: `Een korte walkthrough opent het artikel; de stills hieronder tonen 360° HDR-grondprojectie en OSM 3D / Streets GL-stadscontext in dezelfde viewer.`,
    whatYouSeeIntro: `Twee mogelijkheden die het model verder verkopen dan een grijs niets — filmische HDR-belichting, daarna echt stadsbeeld:`,
    whyBullets: [
      `- **Deel een link, geen ZIP** — stakeholders openen het model op een laptop tijdens een call`,
      "- **Eén viewer voor veel formaten** — minder e-mails met „welke app opent dit?”",
      `- **360° HDR + grondprojectie** — echte belichting en contactschaduwen zodat het product op de plate staat`,
      `- **OSM 3D / Streets GL in de viewer** — stadscontext combineren met uw eigen modellen wanneer de straat de pitch verkoopt`,
    ],
    whyUses: `productconfigurators, architectuur- en buitenplaatsingen, beurs-tablets, asynchrone klantgoedkeuringen en standalone webpresentaties geëxporteerd uit dezelfde pipeline.`,
    beginner: `Een 3D-viewer is als een foto van uw product die u kunt draaien. In plaats van platte beelden staat het echte model op de pagina — slepen om te draaien, inzoomen op details, in HDR-licht wikkelen of op een echte OpenStreetMap-stad plaatsen wanneer u „waar staat dit?” nodig hebt. Geen installatie voor de webversie; een Windows-desktopbuild dekt offline of zware assets.`,
    glossary: [
      {
        term: "GLTF / GLB",
        def: `gangbare webvriendelijke 3D-bestandsformaten ([Khronos glTF](https://www.khronos.org/gltf/))`,
      },
      {
        term: "Orbit",
        def: "slepen om de camera rond het model te draaien",
      },
      {
        term: "360° HDR-omgeving",
        def: "een high-dynamic-range wrap die het model belicht vanuit een echte lucht/scène",
      },
      {
        term: "Grondprojectie",
        def: `projectie van de HDR op het vloervlak zodat schaduwen en reflecties bij de omgeving passen`,
      },
      {
        term: "OSM 3D / Streets GL",
        def: `OpenStreetMap-afgeleide 3D-stadscontext die u met uw modellen in de viewer kunt combineren ([streets.gl](https://streets.gl/))`,
      },
      {
        term: "Hotspot",
        def: "een klikbare marker op het model met info of een link",
      },
    ],
    trySteps: [
      `Open de [3D Viewer-site](https://3dbviewer.com/) of download Windows Setup / Portable van de [v3.19.2-release](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)`,
      "Laad een sample of uw eigen GLTF/GLB als de build import toestaat",
      `Probeer een 360° HDR-omgeving met grondprojectie — zie contactschaduwen het product op de plate verankeren`,
      "Open OSM 3D / Streets GL en stel u voor (of plaats) uw model in echt stadsbeeld",
    ],
    requirements: [
      "**Browser:** moderne Chrome, Edge of Firefox voor de webversie",
      `**Windows desktop:** Setup of Portable van [GitHub Releases v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2) (Electron 41)`,
      `**Bestanden:** geef de voorkeur aan GLB/GLTF voor web; zwaar CAD kan eerst conversie vereisen`,
      `**GPU:** path tracing en dichte stadslagen vragen een degelijke GPU — val terug op lichtere modi op zwakkere apparaten`,
    ],
    viewA: {
      caption: `360° HDR met grondprojectie — product belicht door de plate, schaduwen leesbaar op asfalt`,
    },
    viewB: {
      caption: `OSM 3D / Streets GL in de viewer — stadscontext die u met uw modellen kunt combineren`,
    },
    alsoCan: [
      "Wissel HDR-omgevingen en tijd van de dag voor verschillende sferen",
      `Gebruik path tracing voor stills wanneer kwaliteit belangrijker is dan realtime snelheid`,
      `Mix Product / City / Hybrid-modi bij review van buiten- of stedelijke plaatsingen`,
      "Exporteer een standalone webpresentatie voor klantoverdracht",
    ],
    howWorks: `De viewer is gebouwd op de [Three.js](https://threejs.org/)-familie met focus op praktische review: meshes laden, kadreren, belichten met HDR + grondprojectie, en — wanneer de briefing een straat nodig heeft — OSM 3D / Streets GL-stadscontext openen in dezelfde chrome. Desktopbuilds breiden hetzelfde idee uit voor offline of grote assets. Formaatondersteuning volgt echte klantpipelines — het doel is altijd „openen, begrijpen, beslissen.” Live product: [3dbviewer.com](https://3dbviewer.com/).`,
    whatsNew: {
      heading: "Nieuw in v3.19.2",
      body: `Streets GL Bridge-betrouwbaarheid en textuurkwaliteit, plus Product-mode-verfijning:

- **Streets GL sync** — vertex-budget simplify met UV-behoud zodat auto's en grote meshes betrouwbaar in stadscontext landen
- **Betere textures in City** — tot 4k binaire textuuroverdracht met automatische payload-fit voor grote Meshy-maps
- **Product-mode restore** — textures verdwijnen niet meer na verlaten van Streets GL / City-teardown
- **Uniforme paneelheaders** — gedeelde FloatingPanelHeader-chrome over editorpanelen

**Download (Windows x64):** [Setup](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Setup-3.19.2-x64.exe) | [Portable](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Portable-3.19.2-x64.exe) | [Release notes](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)`,
    },
    faq: [
      {
        q: "Hebben klanten CAD-software nodig?",
        a: "Nee voor review — een browserlink is genoeg voor de meeste stakeholders.",
      },
      {
        q: "Kunnen we het model op een echte straat tonen?",
        a: `Ja — OSM 3D / Streets GL draait in de viewer zodat u stadscontext met uw GLB/GLTF kunt combineren.`,
      },
      {
        q: "Waar krijg ik de Windows-desktopbuild?",
        a: `Setup- en Portable-installers staan op de [v3.19.2 GitHub-release](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2), ook gelinkt vanaf [3dbviewer.com](https://3dbviewer.com/).`,
      },
      {
        q: "Kunnen we het branden?",
        a: "Ja. Viewer-chrome, omgevingen en hotspot-inhoud kunnen uw merk volgen.",
      },
    ],
    reading: [
      {
        label: "3D Viewer live",
        url: "https://3dbviewer.com/",
      },
      {
        label: "v3.19.2 Windows-downloads",
        url: "https://github.com/basic-user-iom/3d/releases/tag/v3.19.2",
      },
      {
        label: "glTF-overzicht — Khronos",
        url: "https://www.khronos.org/gltf/",
      },
      {
        label: "Streets GL live-kaart",
        url: "https://streets.gl/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGL — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API",
      },
    ],
    related: [
      {
        label: "Streets GL Bridge",
        url: "/blog/streets-gl-bridge",
      },
      {
        label: "Volumetrische belichting",
        url: "/blog/volume-lighting",
      },
    ],
  },
  "streets-gl-bridge": {
    pageTitle: "Streets GL Bridge — OSM-stadscontext voor 3D-modellen",
    demoLabel: "Streets GL Bridge",
    hook: `Een mooi model heeft nog steeds een plek nodig om te staan. Streets GL Bridge verkent OpenStreetMap 3D-stadscontext als grondlaag — zodat geolokaliseerde assets in een herkenbaar straatbeeld staan in plaats van een lege leegte.`,
    coverNote: "De cover toont de kaart-/bridge-framing van de portfoliokaart.",
    whyBullets: [
      `- **Locatie verkoopt het verhaal** — klanten herkennen het blok, niet alleen het mesh`,
      "- **Open kaartdata** — OSM als levende stadslaag onder uw asset",
      "- **Bridge-mindset** — verbind uw modelpipeline met een navigeerbare grond",
      "- **Open-source-DNA** — gebouwd rond het Streets GL-ecosysteem",
    ],
    whyUses: `stedelijke voorstellen, site-contextslides, geolokaliseerde product- of architectuurpreviews, en gesprekken over „waar staat dit op straat?” vóór een volledige GIS-build.`,
    beginner: `Denk aan Google Earth-vibes, maar gericht op het plaatsen van uw 3D-object in een echt stratenraster. De kaart is het podium; het model de acteur. U orbit en verkent in plaats van naar een grijze oneindige vloer te staren.`,
    glossary: [
      {
        term: "OSM",
        def: `OpenStreetMap — community-gebouwde kaartdata ([openstreetmap.org](https://www.openstreetmap.org/))`,
      },
      {
        term: "Grondlaag",
        def: "de stad, wegen en terrein onder uw model",
      },
      {
        term: "Geolokaliseerd",
        def: "geplaatst op echte breedte-/lengtegraad op aarde",
      },
      {
        term: "WebGL",
        def: `de browser-GPU-API die de 3D-kaart tekent ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API))`,
      },
    ],
    trySteps: [
      "Open de [Streets GL Bridge-demo](/demos/streets-gl/)",
      "Wacht tot de kaart-embed stabiel is",
      `Pan en zoom de stadscontext (of vergelijk met de [live Streets GL-kaart](https://streets.gl/))`,
      "Stel u voor een klantgebouw of kiosk op een bekende hoek te plaatsen",
    ],
    requirements: [
      "**Netwerk:** kaarttegels en embed vereisen een verbinding",
      "**Browser:** moderne Chromium aanbevolen voor WebGL-kaartweergaven",
      `**Performance:** dichte steden zijn zwaarder — zoom in voor vloeiender verkenning`,
    ],
    viewA: {
      caption: "Stadsbeeld — straten en massa als context",
    },
    viewB: {
      caption: "Nauwere stedelijke lezing — waar een model zou staan",
    },
    alsoCan: [
      `Gebruiken als referentielaag bij het plaatsen van geolokaliseerde GLB's`,
      "Stakeholders verwijzen naar de live [streets.gl](https://streets.gl/)-kaart",
      "Koppelen aan Simple 3D Buildings-concepten van OSM",
    ],
    howWorks: `Streets GL rendert OSM-afgeleide 3D-stadsstructuur in de browser. Onze bridge-pagina host die context voor IOM-workflows — een praktische „waar staat dit?”-laag in plaats van een volledige GIS-suite. Upstream-project: [StrandedKitty/streets-gl](https://github.com/StrandedKitty/streets-gl); live-kaart op [streets.gl](https://streets.gl/).`,
    faq: [
      {
        q: "Is dit Google Maps?",
        a: "Nee — het bouwt voort op OpenStreetMap en de open Streets GL-tooling.",
      },
      {
        q: "Kunnen we ons gebouw plaatsen?",
        a: `Dat is de bedoeling van de bridge: geolokaliseerde modellen boven stadscontext. Vraag ons om een scoped integratie.`,
      },
    ],
    reading: [
      {
        label: "Streets GL live-kaart",
        url: "https://streets.gl/",
      },
      {
        label: "streets-gl op GitHub",
        url: "https://github.com/StrandedKitty/streets-gl",
      },
      {
        label: "OSM Simple 3D Buildings",
        url: "https://wiki.openstreetmap.org/wiki/Simple_3D_Buildings",
      },
      {
        label: "WebGL — Wikipedia",
        url: "https://en.wikipedia.org/wiki/WebGL",
      },
    ],
    related: [
      {
        label: "Artist Globe",
        url: "/blog/artist-globe",
      },
      {
        label: "3D Viewer",
        url: "/blog/3d-viewer",
      },
    ],
  },
  "panorama-360-tour": {
    pageTitle: "360° Panorama Tour Editor — begeleide walks in de browser bouwen",
    demoLabel: "360° Panorama Tour Editor",
    hook: `Beursbezoekers onthouden ervaringen. Deze editor laadt equirectangular panorama's, plaatst hotspots, koppelt multi-scène-tours en slaat een \`.360project\` op — alles in de browser, standaard openend op The Black Witness.`,
    coverNote: "De cover is begeleide tour stap 1 op The Black Witness — raaf-hotspot + popup.",
    whyBullets: [
      `- **Editor + bezoeker in één stack** — bouw de tour, deel daarna een preview-link`,
      "- **Hotspots die uitleggen** — info, scènelinks en optionele iframe-popups",
      "- **Multi-scène-tours** — leid gasten van stand naar productlijn naar locatie",
      `- **Projectbestanden die u houdt** — \`.360project\` opslaan en herladen tussen sessies`,
    ],
    whyUses: `beursbegeleiders, locatie-walkthroughs, productlijnverhalen, museum-soft-launches en klantgoedkeuringen vóór een volledige productietour-build.`,
    beginner: `Een 360°-panorama is een foto die helemaal om u heen wikkelt — alsof u midden in een ruimte staat. De editor maakt van die foto's een tour: klikbare markers (hotspots), links tussen kamers en een pad dat gasten kunnen volgen zonder een app te downloaden.`,
    glossary: [
      {
        term: "Equirectangular",
        def: "een gangbare 360°-beeldlayout (volledige bol afgevlakt tot rechthoek)",
      },
      {
        term: "Hotspot",
        def: "een klikbare marker — info, scènesprong of URL/iframe",
      },
      {
        term: "Begeleide tour",
        def: "een gescripte reeks camerastops, popups en optionele effecten",
      },
      {
        term: ".360project",
        def: `IOM's opslagbestand voor panorama's, hotspots en tourinstellingen`,
      },
      {
        term: "WebGPU birds",
        def: "optioneel zwermeffect op de tour (GPU-ondersteund)",
      },
    ],
    trySteps: [
      `Open de [360° Panorama Tour Editor](/demos/panorama-360/) (of [bezoekerspreview](/demos/panorama-360/?mode=preview))`,
      "Klik **Play guided tour** en bekijk de vier Black Witness-stappen",
      "Stop de tour en klik zelf hotspots — raaf, vuur, water, vogels",
      `Selecteer in de editor elke STEPS-rij om de camera te springen en die beat te bewerken`,
    ],
    requirements: [
      `**Browser:** moderne Chrome of Edge aanbevolen; WebGPU-functies vereisen een capabele GPU`,
      `**Afbeeldingen:** equirectangular JPG, PNG, WebP; HDR/EXR/KTX2 wanneer de pipeline ze ondersteunt`,
      "**Mobiel:** bekijken werkt; bewerken is comfortabeler op desktop",
    ],
    viewA: {
      caption: "Stap 2 — geanimeerde vuur-hotspot en deeltjes-popup",
    },
    viewB: {
      caption: "Stap 3 — water-/spout-beat op het dak",
    },
    viewC: {
      caption: "Stap 4 — Animated birds-popup met de zwerm tegen de stormlucht",
    },
    alsoCan: [
      `Meerdere panorama's koppelen tot een begeleide multi-scène-tour`,
      `URL- of iframe-popups op hotspots toevoegen voor productpagina's of embeds`,
      `[Deeltjes](/blog/webgpu-particles), [spout](/blog/spout) en [vogels](/blog/webgpu-compute-birds) layeren op begeleide stappen 2–4`,
    ],
    howWorks: `Panorama's worden op een bol (of cube-pipeline) gemapt zodat de camera in het midden staat — de klassieke web-360-aanpak met [Three.js](https://threejs.org/) en moderne browser-API's ([WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) / optioneel [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)). Hotspots zijn scène-metadata: positie, type en doel. Begeleide tourstappen op The Black Witness koppelen dezelfde effectdemo's aan interactieve beats — Stap 2 \`+particles\` ([WebGPU Particles](/blog/webgpu-particles)), Stap 3 \`+particles/spout\` ([Spout](/blog/spout)), Stap 4 \`+birds\` ([WebGPU Compute Birds](/blog/webgpu-compute-birds)) — elk met \`hotspot+popup\` zodat beweging en klikbaar verhaal samenkomen. Bezoekerspreview is dezelfde engine zonder editor-chrome — zie [The Black Witness-tour](/blog/panorama-suite).`,
    faq: [
      {
        q: "Hebben gasten een app nodig?",
        a: `Nee. Deel een browserlink. Preview-modus verbergt de editor zodat bezoekers alleen de tour zien.`,
      },
      {
        q: `Kunnen we onze eigen panorama's gebruiken?`,
        a: `Ja — laad equirectangular stills in de editor en bouw hotspots rond uw locatie of product.`,
      },
      {
        q: "Hoe verbinden deeltjes, spout en vogels met de tour?",
        a: `Optionele effectlagen op begeleide stappen 2–4. Elke stap koppelt een camerastop met een effect en hotspot-popup — verken de standalone demo's, daarna Play guided tour in /demos/panorama-360/.`,
      },
    ],
    reading: [
      {
        label: "Live tour-editor",
        url: "/demos/panorama-360/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
      {
        label: "Equirectangular projection — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Equirectangular_projection",
      },
    ],
    related: [
      {
        label: "The Black Witness — 360° Tour",
        url: "/blog/panorama-suite",
      },
      {
        label: "WebGPU Particles",
        url: "/blog/webgpu-particles",
      },
      {
        label: "Spout",
        url: "/blog/spout",
      },
      {
        label: "WebGPU Compute Birds",
        url: "/blog/webgpu-compute-birds",
      },
    ],
  },
  "crm-demo": {
    pageTitle: "CRM Demo — probeer de IOM-client-sandbox",
    demoLabel: "CRM Demo",
    hook: `Wilt u zien hoe IOM leads, projecten en tijd beheert zonder live klantdata aan te raken? De CRM Demo is een interactieve sandbox met fictieve bedrijven — pipeline, boards, ideeën en blogconcepten die in dit browsertabblad blijven.`,
    coverNote: "De cover toont de CRM-sandbox-UI van de portfoliokaart.",
    whyBullets: [
      "- **Veilig alles aanklikken** — wijzigingen raken nooit productiedatabases",
      `- **Volledig workspace-gevoel** — leads, projecten, tijd, ideeën en voorbeeldblogposts`,
      "- **Pitchen in een meeting** — open `/crm-demo` en loop live door de flow",
      "- **Zelfde productfamilie** — spiegelt de echte klant-CRM op `/client-login`",
    ],
    whyUses: `salesdemo's, onboarding-walkthroughs, stakeholdertraining en gesprekken over „hoe zou onze pipeline eruitzien?” vóór provisioning van een echte workspace.`,
    beginner: `Een CRM (customer relationship management) is waar een studio bijhoudt wie heeft geïnformeerd, welke projecten actief zijn en hoe tijd wordt besteed. Deze demo is een oefenkeuken: de recepten zijn echt, de ingrediënten fictief, en niets wat u typt verlaat uw tabblad tenzij u het zelf exporteert.`,
    glossary: [
      {
        term: "Sandbox",
        def: "een oefenkopie van de app met nepgegevens die veilig reset",
      },
      {
        term: "Pipeline",
        def: "fasen die een lead doorloopt voordat het een project wordt",
      },
      {
        term: "In-memory",
        def: "data leeft in deze browsersessie, niet op de live server",
      },
      {
        term: "Client login",
        def: "de echte CRM op `/client-login` met Supabase-ondersteunde data",
      },
    ],
    trySteps: [
      "Open de [CRM Demo](/crm-demo)",
      "Blader door Leads of Projects — open een fictieve bedrijfskaart",
      `Maak een kleine wijziging (status, notitie of boardkaart) om de sandbox te voelen`,
      "Optioneel: open Blog in de demo-CRM en bekijk een voorbeeldpost",
    ],
    requirements: [
      "**Browser:** elke moderne desktopbrowser; een breed venster helpt voor boards",
      `**Privacy:** sandboxdata blijft lokaal in het tabblad — refresh kan de store resetten`,
      `**Niet productie:** voer hier nooit echte klantgeheimen in; gebruik \`/client-login\` voor live werk`,
    ],
    viewA: {
      caption: "Pipeline-weergave — fictieve leads in fasekolommen",
    },
    viewB: {
      caption: "Projectboard — taken en context voor een demobedrijf",
    },
    alsoCan: [
      "Tijdregistratie en ideeënkaarten verkennen met voorbeeldinvoer",
      "De demo-workspace resetten voor een schone start",
      "Het sandbox-gevoel vergelijken met de echte CRM na login",
    ],
    howWorks: `De publieke [CRM Demo](/crm-demo) gebruikt een in-memory store zodat elke klik wegwerpbaar is. De productie-CRM op \`/client-login\` praat met Supabase voor echte medewerker- en klantdata. Dezelfde UI-taal, ander backend — zodat een pitch nooit een live record riskeert.`,
    faq: [
      {
        q: "Zien andere bezoekers mijn wijzigingen?",
        a: `Nee. De sandbox is per browsertabblad / sessie. Anderen zien hun eigen kopie van de fictieve data.`,
      },
      {
        q: "Is dit hetzelfde als client login?",
        a: `Zelfde productfamilie en schermen, maar \`/crm-demo\` raakt nooit live databases. Echt werk gebeurt op \`/client-login\`.`,
      },
    ],
    reading: [
      {
        label: "CRM Demo",
        url: "/crm-demo",
      },
      {
        label: "Client login",
        url: "/client-login",
      },
      {
        label: "IOM home",
        url: "/",
      },
    ],
    related: [
      {
        label: "360° Panorama Tour Editor",
        url: "/blog/panorama-360-tour",
      },
      {
        label: "Image Prep",
        url: "/blog/image-prep",
      },
    ],
  },
  "image-prep": {
    pageTitle: "Image Prep — formaat wijzigen, comprimeren en EXIF verwijderen in de browser",
    demoLabel: "Image Prep",
    hook: `Portfolio- en webafbeeldingen moeten scherp, licht en privé zijn. Image Prep schaalt naar gangbare presets, comprimeert JPEG/WebP/PNG en verwijdert camera-/GPS-EXIF — bestanden blijven op uw apparaat tot u het resultaat downloadt.`,
    coverNote: "De cover toont de Image Prep-tool-UI van de softwarekaart.",
    whyBullets: [
      `- **Op apparaat blijven** — geen upload naar een onbekende server voor een snelle resize`,
      "- **Web-ready presets** — portfolio- en siteformaten zonder Photoshop-gymnastiek",
      `- **Privacy standaard** — EXIF verwijderen zodat GPS en camerametadata niet lekken`,
      `- **Minder gewicht, zelfde verhaal** — comprimeren voor snellere pagina's en stillere CDN-facturen`,
    ],
    whyUses: `hero-stills voorbereiden, galerij-uploads, CRM/blog-covers en klantoverdrachtspakketten vóór ze een CMS of demopagina raken.`,
    beginner: `Voordat een foto op een website komt, heeft die meestal drie gunsten nodig: de juiste pixelgrootte, een kleiner bestand en minder persoonlijke data in de header. Image Prep doet dat in de browser — sleep een afbeelding erin, kies een preset, download een schonere versie.`,
    glossary: [
      {
        term: "EXIF",
        def: `metadata die camera's insluiten (instellingen, tijdstempels, soms GPS)`,
      },
      {
        term: "Comprimeren",
        def: "bestandsgrootte verkleinen, vaak met een kwaliteitsschuif",
      },
      {
        term: "WebP",
        def: "een modern beeldformaat dat vaak kleiner is dan JPEG bij vergelijkbare kwaliteit",
      },
      {
        term: "On-device",
        def: "verwerking gebeurt in uw browser; u kiest wanneer u downloadt",
      },
    ],
    trySteps: [
      "Open [Image Prep](/tools/image-prep)",
      "Sleep een JPG of PNG van uw machine erin",
      "Kies een resize-preset en formaat (JPEG / WebP / PNG)",
      "Schakel EXIF-verwijdering in indien nodig, download daarna het resultaat",
    ],
    requirements: [
      "**Browser:** moderne Chrome, Edge of Firefox met canvas-ondersteuning",
      `**Privacy:** verwerking is lokaal — vermijd toch geheimen in andere velden plakken`,
      `**Limieten:** extreem grote RAW's kunnen eerst een pass in een desktop-editor vereisen`,
    ],
    viewA: {
      caption: "Toollayout — bronafbeelding en prep-bediening",
    },
    viewB: {
      caption: "Na prep — webformaat output klaar om te downloaden",
    },
    alsoCan: [
      "Een paar portfolio-stills in batch naar hetzelfde preset",
      "WebP exporteren wanneer de bestemmingssite het ondersteunt",
      "Gebruiken vóór upload van covers voor blog- of CRM-demoposts",
    ],
    howWorks: `De tool gebruikt browser-API's (canvas / beelddecodering) om op uw machine te schalen en opnieuw te encoderen. EXIF-stripping verwijdert ingesloten metadata zodat gepubliceerde bestanden per ongeluk geen GPS of cameraserienummers meedragen. Formaachtergrond: [MDN — Using files from web applications](https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications) en [EXIF — Wikipedia](https://en.wikipedia.org/wiki/Exif).`,
    faq: [
      {
        q: `Worden mijn foto's geüpload naar IOM-servers?`,
        a: `Nee bij normale prep — werk blijft in de browser tot u downloadt. Gebruik die download als het bestand dat u elders publiceert.`,
      },
      {
        q: "Wordt de kwaliteit slechter?",
        a: `Compressie wisselt altijd grootte voor trouw. Begin met een hoog-kwaliteitspreset; verlaag alleen als het bestand nog zwaar is.`,
      },
    ],
    reading: [
      {
        label: "Image Prep-tool",
        url: "/tools/image-prep",
      },
      {
        label: "EXIF — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Exif",
      },
      {
        label: "WebP — Google developers",
        url: "https://developers.google.com/speed/webp",
      },
      {
        label: "File API — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/File_API",
      },
    ],
    related: [
      {
        label: "3D Viewer",
        url: "/blog/3d-viewer",
      },
      {
        label: "360° Panorama Tour Editor",
        url: "/blog/panorama-360-tour",
      },
    ],
  },
  "raven-path": {
    pageTitle: "Raven Path Animation — splinevlucht in de browser",
    demoLabel: "Raven Path Animation",
    hook: `Soms is het verhaal de beweging, niet het stilstaande beeld. Raven Path zet een gevleugeld GLB op een Catmull-Rom-spline — sleep controlepunten, stel snelheid en easing af, keer de route om en laat vleugelklap-animatie spelen terwijl de vogel het pad volgt.`,
    excerpt: `Animeer een raaf (of uw eigen GLB) langs een bewerkbare spline — exporteer pad-JSON voor andere software, importeer bij het volgende bezoek opnieuw en stem timing af in de browser.`,
    seo_title: "Raven Path Animation — splinevlucht & pad-export — IOM",
    seo_description: `Probeer IOMs Raven Path-demo: bewerkbare Catmull-Rom-vlucht, GLB/GLTF/FBX-import, pad-JSON-export/reimport en beginnerswalkthrough in het 3D-gedeelte.`,
    coverNote: "De cover toont de raaf op zijn bewerkbare vluchtpad.",
    whyBullets: [
      "- **Pad als designtool** — vorm de vlucht opnieuw met zichtbare controlepunten",
      "- **Breng uw eigen model mee** — importeer GLB, GLTF of FBX op hetzelfde pad",
      `- **Exporteer & herimporteer het pad** — JSON voor andere software of uw volgende sessie`,
      `- **Timing die u voelt** — snelheid, ease-in/out, reverse en tangent vs. vaste heading`,
    ],
    whyUses: `hero-loops voor brandfilms, beurs-attract-loops, narratieve webhoofdstukken, prototypen van creatuur- of product-„reis“-paden vóór een volledige animatiepass, en doorgeven van herbruikbare pad-JSON aan andere pipelines.`,
    beginner: `Een spline is een vloeiende curve gedefinieerd door enkele handvatten — als een flexibele draad in de ruimte. Hier rijdt een raaf (of uw geïmporteerde model) op die draad. U trekt de handvatten en de vlucht werkt live bij. Geen videobewerking; het pad ís de bewerking. Als de route bevalt, exporteert u als JSON en laadt u later opnieuw — of gebruikt u de punten in andere tools.`,
    glossary: [
      {
        term: "Catmull-Rom spline",
        def: `een vloeiende curve die door controlepunten loopt ([Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline))`,
      },
      {
        term: "GLB / GLTF / FBX",
        def: "gangbare 3D-modelformaten die u op het pad kunt importeren",
      },
      {
        term: "Path JSON",
        def: `geëxporteerde controlepunten (en opties) die u op de site kunt herimporteren of elders gebruiken`,
      },
      {
        term: "Tangent-aligned",
        def: "het model draait mee langs de padrichting",
      },
      {
        term: "Skeletal animation",
        def: `botten sturen secundaire beweging (zoals vleugelslag) terwijl de root de curve volgt`,
      },
    ],
    trySteps: [
      "Open de [Raven Path-demo](/demos/raven-path/)",
      `Kijk één ronde mee, sleep dan een spline-controlepunt en zie de route herschikken`,
      `Onder **Path**: **Export path JSON**, daarna **Import path JSON** (of sleep het bestand op de scène)`,
      `Optioneel: **Import GLB / GLTF / FBX**, stel dan snelheid, ease, reverse of tangentoriëntatie af`,
    ],
    requirements: [
      "**Browser:** moderne Chrome, Edge of Firefox met WebGL",
      "**GPU:** geïntegreerde grafiek is meestal genoeg voor deze scène",
      "**Input:** muis of trackpad maakt puntbewerking makkelijker dan telefoon",
      "**Bestanden:** verkies zelfstandige GLB voor modellen; padbestanden zijn JSON",
    ],
    viewA: {
      caption: "Brede padweergave — curve en raaf in één frame",
    },
    viewB: {
      caption: "Nadere vlucht — vleugelpose langs de spline",
    },
    alsoCan: [
      "Kopieer het THREE.Vector3-snippet uit het Path-paneel voor eigen Three.js-tools",
      "Vergelijk met het gerelateerde [spline-editor](/demos/spline-editor/)-experiment",
      `Bestudeer curve-modifiers in de [WebGPU curve-demo](/demos/webgpu-modifier-curve/)`,
      "Herbruik het padidee voor product-„tours“ of camera-fly-throughs",
    ],
    howWorks: `De demo gebruikt [Three.js](https://threejs.org/) om per frame een Catmull-Rom-curve te samplen, de modelroot op dat sample te plaatsen en optioneel de voorwaartse as op de curvetangent uit te lijnen terwijl een skeletclip (indien aanwezig) secundaire beweging aanstuurt. Path JSON slaat controlepunten, gesloten lus en padtransform op zodat u op de [live demo](/demos/raven-path/) kunt herimporteren of de punten in andere software kunt voeden. Dezelfde ideeënfamilie als three.js curve- en animatievoorbeelden — hier afgestemd op een leesbare creatuurloop met import en export.`,
    faq: [
      {
        q: "Kunnen we de raaf vervangen door onze mascotte?",
        a: `Ja — gebruik **Import GLB / GLTF / FBX** in de demo om uw model meteen op het pad te proberen. Voor een gebrande productieversie vraagt u ons om een scoped versie.`,
      },
      {
        q: "Hoe hergebruik ik een pad later of in andere software?",
        a: `Gebruik **Export path JSON** in het Path-paneel. Importeer dat bestand de volgende keer op de site opnieuw, of gebruik de velden \`points\` / \`threeJsSnippet\` in Blender, Three.js of eigen tools.`,
      },
      {
        q: "Is dit video of realtime?",
        a: `Realtime WebGL. U kunt screen-recorden of elders exporteren, maar de demo zelf is een live scène.`,
      },
    ],
    reading: [
      {
        label: "Raven Path-demo",
        url: "/demos/raven-path/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "Catmull–Rom spline — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline",
      },
      {
        label: "WebGL — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API",
      },
      {
        label: "Spline-editor (gerelateerd)",
        url: "/demos/spline-editor/",
      },
    ],
    related: [
      {
        label: "Volumetric Lighting",
        url: "/blog/volume-lighting",
      },
      {
        label: "Dream — Ocean scroll",
        url: "/blog/iom-three",
      },
      {
        label: "Three.js Ocean",
        url: "/blog/threejs-ocean",
      },
    ],
  },
  "artist-globe": {
    pageTitle: "Artist Globe — een levende kaart van creatieve praktijk",
    demoLabel: "Artist Globe",
    hook: `Portfolio's verspreiden zich over het web; geografie telt nog steeds. Artist Globe is een interactieve WebGL-aarde van fotografen, schilders, beeldhouwers, geluidskunstenaars en meer — filter op praktijk, open profielen, markeer landen en dien een vermelding in ter beoordeling.`,
    coverNote: "De cover toont de globe met kunstenaarsmarkers van de 3D-kaart.",
    whyBullets: [
      `- **Ontdekken op plaats** — draai de wereld in plaats van eindeloze grids scrollen`,
      "- **Filter op praktijk** — fotografen, schilders, beeldhouwers, sound en meer",
      `- **Open echte portfolio's** — spring van een marker naar de links van een kunstenaar`,
      `- **Community-loop** — dien een profiel in ter beoordeling wanneer u wilt verschijnen`,
    ],
    whyUses: `culturele ontdekking, residency- en festival-scouting, studio-netwerken, en portfolio-features die een ruimtelijke „wie is waar?“-laag nodig hebben.`,
    beginner: `Denk aan een bureauglobe met pins voor kunstenaars. U draait hem, filtert wie verschijnt, en klikt een pin voor meer info. Het is een kaart van mensen en praktijken, geen winkelcheckout.`,
    glossary: [
      {
        term: "WebGL globe",
        def: `een 3D-aarde getekend in de browser met [Three.js](https://threejs.org/)-achtige graphics`,
      },
      {
        term: "Practice filter",
        def: "toon alleen bepaalde disciplines (bijv. fotografie)",
      },
      {
        term: "Profile",
        def: "een kunstenaarskaart met links en landhighlight",
      },
      {
        term: "Submit for review",
        def: "verzoek om toegevoegd te worden; redacteuren keuren goed vóór publicatie",
      },
    ],
    trySteps: [
      "Open [Artist Globe](/artist-globe)",
      "Sleep om te draaien; scroll of knijp om in te zoomen op een regio",
      "Gebruik praktijkfilters om zichtbare kunstenaars te verfijnen",
      "Klik een marker voor een profiel, of volg de submit-flow als u wilt solliciteren",
    ],
    requirements: [
      "**Browser:** moderne desktop- of mobiele browser met WebGL",
      "**Netwerk:** profielen en kaartassets hebben verbinding nodig",
      `**Performance:** verminder andere GPU-tabs als de globe zwaar voelt op oudere laptops`,
    ],
    viewA: {
      caption: "Volledige globe — markers over continenten",
    },
    viewB: {
      caption: "Regionale focus — landhighlight en gekozen praktijk",
    },
    alsoCan: [
      "Markeer een land bij het pitchen van een regionale cohort",
      "Deel `/artist-globe` als discovery-landingspagina",
      "Embed-vriendelijke modus voor strakkere portfolioframes (`?embed=1`)",
    ],
    howWorks: `De globe is een [Three.js](https://threejs.org/) / [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)-scène: een getextureerde bol, camerabesturing en marker-sprites of -meshes gebonden aan lat/lon. Profielgegevens en inzendingen lopen via de IOM-webstack zodat de kaart gecureerd blijft in plaats van een ongemodereerd free-for-all.`,
    faq: [
      {
        q: "Kan iedereen op de globe verschijnen?",
        a: `Vermeldingen gaan via submit-and-review zodat de kaart nuttig en betrouwbaar blijft.`,
      },
      {
        q: "Is dit een sociaal netwerk?",
        a: `Nee — het is een discovery-kaart van creatieve praktijken met links naar portfolio's.`,
      },
    ],
    reading: [
      {
        label: "Artist Globe",
        url: "/artist-globe",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGL — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API",
      },
      {
        label: "IOM 3D-gedeelte",
        url: "/#3d",
      },
    ],
    related: [
      {
        label: "Streets GL Bridge",
        url: "/blog/streets-gl-bridge",
      },
      {
        label: "Art Gallery — SSR + Denoise",
        url: "/blog/ssr-denoise",
      },
    ],
  },
  "ssr-denoise": {
    pageTitle: "Art Gallery — WebGPU SSR + Denoise",
    demoLabel: "Art Gallery — WebGPU SSR + Denoise",
    hook: `Glanzende vloeren en glas voelen alleen echt als reflecties standhouden. Deze gallery-demo draait WebGPU screen-space reflections met spatiotemporal denoising — importeer GLTF/FBX, wissel HDR/EXR-luchten, loop in third person en vergelijk ruwe vs. opgeschoonde reflecties.`,
    coverNote: "De cover toont de galerieruimte met denoised reflecties.",
    whyBullets: [
      `- **Reflecties die standhouden** — SSR met denoise in plaats van een wazige smeer`,
      "- **Breng uw eigen model mee** — laad GLTF/FBX in de gallery-shell",
      `- **Wissel de lucht** — HDR/EXR-panorama's veranderen sfeer in seconden`,
      "- **Loop de ruimte** — third-person explore voor client-schaal leesbaarheid",
    ],
    whyUses: `interieur productviz, gallery- en showroom-pitches, materiaalreviews en WebGPU R&D-gesprekken over reflectiekwaliteit vs. framerate.`,
    beginner: `Screen-space reflections (SSR) simuleren spiegels en glanzende vloeren door te hergebruiken wat de camera al ziet, in plaats van een volledige tweede wereld te renderen. Dat kan ruisig lijken. Denoise is de cleanup-pass die sprankelende ruis omzet in een stabiele reflectie — dichter bij wat u van filmlighting verwacht, nog steeds live.`,
    glossary: [
      {
        term: "WebGPU",
        def: `moderne browser-GPU-API ([Wikipedia](https://en.wikipedia.org/wiki/WebGPU), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API))`,
      },
      {
        term: "SSR",
        def: "screen-space reflections — glanzende spiegels van wat op scherm staat",
      },
      {
        term: "Denoise",
        def: "een filter die ruisige reflectiesamples over ruimte/tijd gladstrijkt",
      },
      {
        term: "HDR / EXR",
        def: "high-dynamic-range omgevingsmaps voor belichting en lucht",
      },
      {
        term: "Third-person walk",
        def: "beweeg een personage door de gallery in plaats van alleen free-fly",
      },
    ],
    trySteps: [
      "Open de [SSR + Denoise-demo](/demos/ssr-denoise/) in Chrome of Edge",
      "Orbit of loop tot u een glanzende vloerreflectie ziet",
      "Schakel of vergelijk ruwe vs. denoised reflecties als de UI de switch toont",
      `Optioneel: importeer klein GLTF/FBX of wissel HDR om de kamer opnieuw te belichten`,
    ],
    requirements: [
      "**Browser:** Chrome of Edge met WebGPU ingeschakeld (113+ aanbevolen)",
      `**Hardware:** discrete of recente geïntegreerde GPU; verlaag kwaliteit bij haperen`,
      "**Mobile:** beperkt — behandel desktop als eerste ervaring",
    ],
    viewA: {
      caption: "Gallery breed — kunstwanden en reflecterende vloer",
    },
    viewB: {
      caption: "Reflectiedetail — denoised glans onder de lampen",
    },
    alsoCan: [
      "Laad custom modellen om te zien hoe een clientstuk in de kamer leest",
      "Vergelijk reflectiekwaliteit in beweging — denoise toont zijn waarde live",
      "Combineer met andere WebGPU-studies zoals volumetric lighting op dezelfde site",
    ],
    howWorks: `Het startpunt is het officiële three.js [WebGPU SSR + denoise-voorbeeld](https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise) ([bron op GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html)). IOM wikkelt die pipeline in een gallery-shell met modelimport, HDR/EXR-swap en walk mode zodat het effect client-leesbaar is, niet alleen een tech-sample.`,
    faq: [
      {
        q: "Waarom is de pagina leeg of waarschuwt die?",
        a: `Deze demo vereist WebGPU. Gebruik een recente Chrome- of Edge-build; Safari en oudere Firefox exposeren de API mogelijk nog niet.`,
      },
      {
        q: "Is SSR hetzelfde als ray tracing?",
        a: `Nee. SSR hergebruikt het schermbeeld; path-traced of hardware ray-traced reflecties zijn een zwaarder pad. Denoise maakt SSR presentabeler in realtime.`,
      },
    ],
    reading: [
      {
        label: "Live SSR + Denoise-demo",
        url: "/demos/ssr-denoise/",
      },
      {
        label: "three.js SSR denoise-voorbeeld",
        url: "https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise",
      },
      {
        label: "Voorbeeldbron op GitHub",
        url: `https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html`,
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
    ],
    related: [
      {
        label: "Volumetric Lighting",
        url: "/blog/volume-lighting",
      },
      {
        label: "Three.js Ocean",
        url: "/blog/threejs-ocean",
      },
    ],
  },
  "iom-three": {
    pageTitle: "Dream — ocean scroll-verhaal",
    demoLabel: "Dream — Ocean scroll",
    hook: `Niet elk 3D-stuk hoeft een orbit-kubus te zijn. Dream is een scroll-verhaal door stil donker water, regen, ver land en kust — procedurele vervorming, optionele ambient-audio en een weather-runtime met lucht, wolken en dag/nacht-sync. Hoofdstuk 1 van 9; work in progress.`,
    coverNote: `De cover is het Dream-startscherm — titel, kalme regel en play-control vóór het scrollen begint.`,
    whyBullets: [
      `- **Scroll als camera** — paginabeweging vertelt het hoofdstuk, niet alleen orbit-drag`,
      "- **Atmosfeer eerst** — water, regen en weer zetten de emotionele beat",
      `- **Audio die meeloopt** — optionele ambient crossfade met de visuele hoofdstukken`,
      "- **Serie-mindset** — hoofdstuk 1 van 9 signaleert een langer narratief boog",
    ],
    whyUses: `brand story-landings, tentoonstellings-webbegeleiders, folio-openers en experimenten waar sfeer en pacing net zo tellen als modelfideliteit.`,
    beginner: `In plaats van een vrije camera die u zelf vliegt, scrollt u — en de scène schrijdt vooruit als pagina's in een prentenboek. Water- en weershaders doen het zware visuele werk; u leest met duim of muiswiel.`,
    glossary: [
      {
        term: "Scroll narrative",
        def: "verhaalbeats gekoppeld aan scrollpositie",
      },
      {
        term: "Procedural distortion",
        def: "shaderbeweging die het oppervlak vervormt zonder videobestand",
      },
      {
        term: "Weather runtime",
        def: "lucht, wolken en dag/nacht aangestuurd door parameters",
      },
      {
        term: "Crossfade audio",
        def: "ambient-lagen mengen bij hoofdstukwissel",
      },
    ],
    trySteps: [
      "Open de [Dream — Ocean scroll-demo](/demos/dreams-iom/)",
      "Tik play op het startscherm, scroll dan langzaam door de eerste waterbeats",
      "Pauzeer bij de zwevende figuur — let op rimpels, lucht en weerssfeer",
      "Als audio in uw build staat, unmute en scroll opnieuw voor de crossfade",
    ],
    requirements: [
      "**Browser:** moderne Chrome/Edge/Firefox met WebGL",
      "**Motion:** desktop-scroll of trackpad geeft het bedoelde pacing",
      "**Audio:** optioneel — sommige browsers vereisen klik vóór geluid start",
    ],
    viewA: {
      caption: "Startscherm — DREAM., kalme regel en play om het scrollen te betreden",
    },
    viewB: {
      caption: "Na play — zwevende figuur op stil donker water",
    },
    alsoCan: [
      "Gebruik als moodboard voor een langere multi-hoofdstuk-launch",
      `Combineer met de [Three.js Ocean](/blog/threejs-ocean)-studie voor oppervlaktetechniek-contrast`,
      "Scope een gebrand hoofdstuk met custom copy en audio bed",
    ],
    howWorks: `De ervaring is een [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)-canvas aangestuurd door scrollpositie: shader-gebaseerd water en atmosferische passes updaten met de narratieve voortgangswaarde. Weer (lucht, wolken, dag/nacht) is een parameter-runtime in plaats van gebakken video. Live op [/demos/dreams-iom/](/demos/dreams-iom/).`,
    faq: [
      {
        q: "Is dit af?",
        a: `Hoofdstuk 1 van 9 is de publieke beat — een work-in-progress-verhaal, geen afgesloten film.`,
      },
      {
        q: "Kunnen we ons brandverhaal hier plaatsen?",
        a: `Ja als scoped adaptatie: copy, pacing, audio en visuele grade. Neem contact op met het hoofdstukoutline.`,
      },
    ],
    reading: [
      {
        label: "Dream — Ocean scroll",
        url: "/demos/dreams-iom/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGL — Wikipedia",
        url: "https://en.wikipedia.org/wiki/WebGL",
      },
      {
        label: "IOM 3D-gedeelte",
        url: "/#3d",
      },
    ],
    related: [
      {
        label: "Three.js Ocean",
        url: "/blog/threejs-ocean",
      },
      {
        label: "Raven Path Animation",
        url: "/blog/raven-path",
      },
    ],
  },
  "threejs-ocean": {
    pageTitle: "Three.js Ocean — Gerstner-golven, lucht en export",
    demoLabel: "Three.js Ocean",
    hook: `Een hero-waterplaat nodig die u in minuten kunt branden? Deze ocean-demo draait Gerstner-wave-water met procedurele lucht en sunset-preset — plaats glass 3D-tekst (Google Fonts), decoratieve iconen, pak wallpaper-screenshots of exporteer tot 30 seconden WebGL-video.`,
    coverNote: "De cover toont de sunset-ocean-framing van de 3D-kaart.",
    whyBullets: [
      "- **Leesbaar water snel** — Gerstner-golven en lucht zonder film-renderfarm",
      "- **Typo op het water** — glass 3D-tekst met Google Fonts voor titels",
      "- **Sunset-preset** — one-click-sfeer voor pitches en lockups",
      "- **Takeaways** — wallpaper-stills of korte WebGL-video-export",
    ],
    whyUses: `landing-heroes, event key art-platen, social wallpapers en snelle „ocean brand moment“-comps vóór een custom water R&D-pass.`,
    beginner: `Gerstner-golven zijn een klassieke manier om oceaangolven realtime te faken — pieken en dalen die meer op water lijken dan een vlakke ripple-textuur. Hier liggen ze onder een procedurele lucht zodat u titel of icoon kunt componeren en capturen.`,
    glossary: [
      {
        term: "Gerstner wave",
        def: "een wiskundig deiningmodel gebruikt in realtime oceanen",
      },
      {
        term: "Procedural sky",
        def: "luchtkleur en zon berekend in shader, niet alleen fotodome",
      },
      {
        term: "Glass 3D text",
        def: "extrudeerde typo met refractief/transparant shading",
      },
      {
        term: "WebGL video export",
        def: "frames van het canvas opnemen in een korte clip",
      },
    ],
    trySteps: [
      "Open de [Three.js Ocean-demo](/demos/ocean/)",
      "Orbit tot horizon en zon duidelijk lezen (probeer sunset-preset)",
      "Voeg glass 3D-tekst / iconen toe of bewerk ze als de UI ze biedt",
      "Capture wallpaper-screenshot of start korte video-export (≤30s)",
    ],
    requirements: [
      "**Browser:** moderne Chrome/Edge aanbevolen voor capture en export",
      `**GPU:** geïntegreerde grafiek meestal prima; verlaag kwaliteit als ventilatoren opdraaien`,
      "**Export:** video-capture is zwaarder — sluit andere tabs voor schone take",
    ],
    viewA: {
      caption: "Sunset-ocean — horizon en deining",
    },
    viewB: {
      caption: "Titel-lockup — glass-tekst over water",
    },
    alsoCan: [
      "Genereer social/wallpaper-stills zonder de browser te verlaten",
      "Prototype eventtitels vóór handoff aan motion design",
      "Vergelijk techniek met het scroll-verhaal in [Dream](/blog/iom-three)",
    ],
    howWorks: `Gebouwd op de three.js ocean/water-lijn ([webgl_shaders_ocean voorbeeldbron](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html)) met IOM-UI voor tekst, presets, screenshots en korte canvas-opname. [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) drijft water en lucht per frame; export is een getimede capture van hetzelfde canvas.`,
    faq: [
      {
        q: "Kunnen we de clip commercieel gebruiken?",
        a: `Behandel de publieke demo als preview. Vraag ons om een gelicenseerd of gebrand exportpakket voor campagnes.`,
      },
      {
        q: "Is dit hetzelfde als Dream — Ocean scroll?",
        a: `Nee. Dit is een orbitbare ocean-plaat met exporttools; Dream is een scroll-verhaalhoofdstuk op [/demos/dreams-iom/](/demos/dreams-iom/).`,
      },
    ],
    reading: [
      {
        label: "Ocean-demo",
        url: "/demos/ocean/",
      },
      {
        label: "three.js ocean voorbeeldbron",
        url: "https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "Gerstner wave — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Trochoidal_wave",
      },
    ],
    related: [
      {
        label: "Dream — Ocean scroll",
        url: "/blog/iom-three",
      },
      {
        label: "Art Gallery — SSR + Denoise",
        url: "/blog/ssr-denoise",
      },
    ],
  },
  "panorama-suite": {
    pageTitle: "The Black Witness — 360° bezoekerstour",
    demoLabel: "The Black Witness — 360° Tour",
    hook: `Dezelfde raaf, vele werelden — stad, bos, berg, mist. Deze bezoekerspreview opent The Black Witness tour zonder editor-chrome, geframed op yaw −84,7° en pitch −6°, met hotspots, begeleide stappen en optionele WebGPU-atmosfeer.`,
    coverNote: `De cover is begeleide tour stap 1 — The Black Witness raaf-hotspot met popup open.`,
    whyBullets: [
      "- **Bezoeker-eerst link** — geen editor-UI; gasten zien alleen de tour",
      "- **Begeleide stappen** — een pad door het verhaal, niet alleen vrij rondkijken",
      "- **Hotspots met betekenis** — info en sprongen die leren terwijl je verkent",
      "- **Deelbaar framing** — deep-link yaw/pitch zodat het eerste beeld bewust is",
    ],
    whyUses: `tentoonstellingsbegeleiders, fotoserie-launches, stand-attract loops en klantproofs van hoe een afgerond 360°-verhaal aanvoelt op telefoon of laptop.`,
    beginner: `U staat in een 360°-foto. Sleep om rond te kijken; tik op markers om te leren of naar de volgende plek te gaan. Preview-modus is het „gastenticket“ — de editor is hoe we bouwen; deze link is hoe publiek het ervaart.`,
    glossary: [
      {
        term: "Bezoekerspreview",
        def: "tourmodus zonder bewerkingstools (`mode=preview`)",
      },
      {
        term: "Yaw / pitch",
        def: "horizontale en verticale kijkhoeken voor het startbeeld",
      },
      {
        term: "Begeleide tour",
        def: "geordende stops waar de experience doorheen kan gaan",
      },
      {
        term: "Hotspot",
        def: "een tappable marker voor info of de volgende scène",
      },
    ],
    trySteps: [
      "Open de [Black Witness bezoekerstour](/demos/panorama-360/?mode=preview)",
      "Klik **Play guided tour** — vier camerastops met popups en effecten",
      "Open zelf een hotspot na het stoppen van de tour",
      `Deel de preview-URL zodat collega's in dezelfde experience landen`,
    ],
    requirements: [
      `**Browser:** moderne mobiele of desktopbrowser; WebGPU-effecten vragen een capabel apparaat`,
      `**Netwerk:** panorama's zijn beeldzwaar — Wi‑Fi bij eerste load aanbevolen`,
      "**Input:** touch-sleep of muis; headset niet vereist",
    ],
    viewA: {
      caption: "Stap 2 — geanimeerde vuur-hotspot en deeltjes-popup",
    },
    viewB: {
      caption: "Stap 3 — water / spout-beat op het dak",
    },
    viewC: {
      caption: "Stap 4 — Geanimeerde vogels-popup met de zwerm tegen de stormlucht",
    },
    alsoCan: [
      `Naar de [editor](/demos/panorama-360/) springen wanneer u hotspots moet authoreren`,
      `Het deep-link-patroon hergebruiken voor gebrandeerde eerste beelden in andere projecten`,
      `De effectstack volgen: [particles](/blog/webgpu-particles) → [spout](/blog/spout) → [birds](/blog/webgpu-compute-birds)`,
    ],
    howWorks: `Preview hergebruikt dezelfde panorama-engine als de [360° Tour Editor](/blog/panorama-360-tour), maar URL-flags verbergen authoring-chrome en zetten de startcamera (\`yaw\`, \`pitch\`). Hotspots en begeleide stappen zijn projectdata over equirectangular scènes — [Three.js](https://threejs.org/) voor bolcamera, optionele [WebGPU](https://en.wikipedia.org/wiki/WebGPU)-lagen voor sfeer. Op The Black Witness legt Stap 2 [particles](/blog/webgpu-particles), Stap 3 [spout](/blog/spout) en Stap 4 [birds](/blog/webgpu-compute-birds) — elk met hotspot+popup zodat gasten beweging krijgen op een klikbaar verhaalbeat.`,
    faq: [
      {
        q: "Waarom start mijn beeld in een specifieke richting?",
        a: `De link zet yaw −84,7° en pitch −6° zodat iedereen dezelfde openingscompositie deelt.`,
      },
      {
        q: "Kan ik hotspots bewerken via deze URL?",
        a: `Niet in preview. Gebruik de [tour editor](/demos/panorama-360/) (of vraag ons om een production authoring-build).`,
      },
      {
        q: "Wat zijn de effectlagen in stappen 2–4?",
        a: `Stap 2 particles, Stap 3 spout/water, Stap 4 birds — elk met hotspot-popup. De standalone experimentpagina's documenteren dezelfde tech.`,
      },
    ],
    reading: [
      {
        label: "Bezoekerstour-link",
        url: "/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6",
      },
      {
        label: "Tour editor",
        url: "/demos/panorama-360/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGPU — Wikipedia",
        url: "https://en.wikipedia.org/wiki/WebGPU",
      },
    ],
    related: [
      {
        label: "360° Panorama Tour Editor",
        url: "/blog/panorama-360-tour",
      },
      {
        label: "WebGPU Particles",
        url: "/blog/webgpu-particles",
      },
      {
        label: "Spout",
        url: "/blog/spout",
      },
      {
        label: "WebGPU Compute Birds",
        url: "/blog/webgpu-compute-birds",
      },
    ],
  },
  "css3d-sprites": {
    pageTitle: "CSS3D Sprites — HTML in 3D-ruimte",
    demoLabel: "CSS3D Sprites",
    hook: `Vijfhonderdtwaalf HTML-elementen drijvend als sprites — dan morphend tussen vlak, kubus, wolk en bol. Het is Three.js CSS3DRenderer: echte DOM-nodes in cameraruimte, niet alleen getextureerde quads.`,
    coverNote: `De cover toont de sprite-wolk midden in morph — HTML-tegels lezen als 3D-formatie.`,
    whyBullets: [
      "- **DOM ontmoet diepte** — echte HTML/CSS-inhoud die toch in 3D orbiteert",
      "- **Morph storytelling** — vlak → kubus → wolk → bol verkoopt „data wordt vorm“",
      `- **Beweging zonder game engine** — pulserende schaal en overgangen in de browser`,
      `- **UI-prototype in ruimte** — kaarten, labels of foto's als ruimtelijke layouts`,
    ],
    whyUses: `ruimtelijke UI-schetsen, portfolio „deeltje van kaarten“-momenten en klantdemo's waar content leesbare HTML moet blijven.`,
    beginner: `Stel u fotothumbnails of gekleurde tegels voor in een kamer die u kunt draaien. Elke tegel is nog een normaal webpagina-element — alleen in 3D gepositioneerd. Als de vorm verandert, vliegen de tegels naar nieuwe plekken als een gechoreografeerde zwerm.`,
    glossary: [
      {
        term: "CSS3DRenderer",
        def: "Three.js-pad dat HTML-elementen positioneert met CSS 3D transforms",
      },
      {
        term: "Sprite",
        def: "een plat element dat in de scène als billboard-achtige eenheid staat",
      },
      {
        term: "Morph",
        def: "geanimeerde overgang van posities van de ene formatie naar de andere",
      },
      {
        term: "WebGL camera",
        def: "dezelfde 3D-camerawiskunde als WebGL-scènes, die CSS transforms aanstuurt",
      },
    ],
    trySteps: [
      "Open de [CSS3D Sprites demo](/demos/css3d-sprites/)",
      "Sleep om te orbiteren; kijk hoe de formatie pulseert",
      "Trigger vormwissels (vlak, kubus, random, bol) als knoppen of UI aanwezig zijn",
      "Zoom in tot individuele HTML-sprites scherp blijven — dat is het DOM-voordeel",
    ],
    requirements: [
      "**Browser:** moderne Chrome, Edge, Firefox of Safari met CSS 3D transforms",
      `**GPU:** lichte load vergeleken met zwaar WebGPU compute — prima op de meeste laptops`,
      "**Opmerking:** CSS3D + Three.js camerawiskunde, geen WebGPU compute-demo",
    ],
    viewA: {
      caption: "Bol- of kubusformatie — sprites lezen als solide volume",
    },
    viewB: {
      caption: "Wolk / random verspreiding — diepte en parallax van HTML-tegels",
    },
    alsoCan: [
      "Sprite-inhoud wisselen voor afbeeldingen, labels of merkkleuren",
      "Morphs gebruiken als sectie-overgangen in een pitchsite",
      `Vergelijken met het upstream [three.js css3d_sprites](https://threejs.org/examples/#css3d_sprites)-voorbeeld`,
    ],
    howWorks: `Three.js drijft een gedeelde camera; [CSS3DRenderer](https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer) mapt objectmatrices naar CSS \`transform\` op DOM-nodes. Formaties zijn doelposities; animatie interpoleert elke sprite naar de volgende layout. Upstream referentie: [css3d_sprites](https://threejs.org/examples/#css3d_sprites) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/css3d_sprites.html)). Anders dan WebGPU-deeltjessystemen is het werk hier layout + CSS compositing in plaats van compute shaders.`,
    faq: [
      {
        q: "Is dit WebGL of WebGPU?",
        a: `Geen van beide als hoofdpad — sprites zijn HTML via CSS3D. Three.js gebruikt nog steeds 3D-camerawiskunde uit WebGL-scènes.`,
      },
      {
        q: "Kunnen we echte productkaarten in de wolk zetten?",
        a: `Ja in principe — elke sprite kan rijkere HTML bevatten. We scopen performance en leesbaarheid voor klantbuilds.`,
      },
    ],
    reading: [
      {
        label: "three.js — css3d_sprites",
        url: "https://threejs.org/examples/#css3d_sprites",
      },
      {
        label: "CSS3DRenderer docs",
        url: "https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "BufferGeometry Draw Range",
        url: "/blog/buffergeometry-drawrange",
      },
      {
        label: "WebGPU TSL Linked Particles",
        url: "/blog/webgpu-tsl-linked-particles",
      },
    ],
  },
  "compute-particles": {
    pageTitle: "Shape Particles — WebGPU compute physics",
    demoLabel: "Shape Particles",
    hook: `Duizenden deeltjes klikken in kubus, bol, torus, hart — dan laat Release ze vallen onder GPU-zwaartekracht met vloerbounce. WebGPU compute houdt de simulatie op de grafische kaart.`,
    coverNote: "De cover toont een shape-preset in formatie vóór de drop.",
    whyBullets: [
      "- **Formatie → chaos → reform** — een helder verhaal voor product- of merkmotion",
      "- **Compute op GPU** — fysicastappen zonder main thread te blokkeren",
      "- **Shape-presets** — kubus, bol, torus, kegel, piramide, ring, hart",
      "- **Interactief bewijs** — Release en Reset verkopen het idee in één klik",
    ],
    whyUses: "launch-teasers, standloops en „onze data wordt deze vorm“-pitchmomenten.",
    beginner: `Denk aan magnetisch zand dat een logo-achtige vorm kan houden, dan valt als u loslaat — en terugspringt in vorm bij reset. Het verschil is snelheid: de GPU werkt elk deeltje bij zodat het vloeiend blijft.`,
    glossary: [
      {
        term: "WebGPU",
        def: "moderne browser GPU-API (nieuwer dan WebGL) voor compute en rendering",
      },
      {
        term: "Compute shader",
        def: `GPU-programma dat data (posities, snelheden) bijwerkt zonder driehoeken te tekenen`,
      },
      {
        term: "TSL",
        def: "Three.js Shading Language — node-gebaseerde GPU-logica in JS",
      },
      {
        term: "Formatie",
        def: "doelposities die deeltjes als solide vorm laten lezen",
      },
    ],
    trySteps: [
      "Open de [Shape Particles demo](/demos/compute-particles/)",
      "Kies een shape-preset en orbiteer de formatie",
      "Druk Release — kijk naar zwaartekracht en vloerbounce",
      "Druk Reset om te reformen; probeer een andere vorm",
    ],
    requirements: [
      "**Browser:** Chrome of Edge met WebGPU ingeschakeld (recente versies)",
      "**GPU:** discrete of recente geïntegreerde GPU aanbevolen voor dichte counts",
      "**Fallback:** zonder WebGPU ziet u een capability-bericht — geen WebGL-port",
    ],
    viewA: {
      caption: "Vastgehouden formatie — deeltjes lezen als solide preset-vorm",
    },
    viewB: {
      caption: "Na Release — spray en bounce op het grondvlak",
    },
    alsoCan: [
      "Presets cyclen voor een korte merkloop",
      "Count / look tunen voor stand vs. laptop-performance",
      `Vergelijken met [three.js webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles)`,
    ],
    howWorks: `Een [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) compute pass werkt deeltjesstate per frame bij; de renderer tekent het resultaat. Three.js exposeert dit via WebGPU renderer en TSL compute nodes. Upstream: [webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_particles.html)). WebGL kan ook deeltjes tekenen, maar de zwaartekracht- en reform-loop van deze demo is gebouwd voor WebGPU compute.`,
    faq: [
      {
        q: "Waarom zegt mijn browser dat WebGPU ontbreekt?",
        a: `Dit experiment heeft WebGPU nodig. Gebruik bijgewerkte Chrome of Edge; Safari/Firefox-ondersteuning varieert per versie.`,
      },
      {
        q: "Kunnen de deeltjes ons logo vormen?",
        a: `Custom target meshes of point clouds zijn een natuurlijke volgende stap — vraag ons om een scoped build.`,
      },
    ],
    reading: [
      {
        label: "three.js — compute particles",
        url: "https://threejs.org/examples/#webgpu_compute_particles",
      },
      {
        label: "WebGPU API — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "WebGPU Particles",
        url: "/blog/webgpu-particles",
      },
      {
        label: "WebGPU Compute Birds",
        url: "/blog/webgpu-compute-birds",
      },
    ],
  },
  "webgpu-spotlight": {
    pageTitle: "WebGPU Spotlight — getextureerde bundels en schaduwen",
    demoLabel: "WebGPU Spotlight",
    hook: `Een spot light die zich gedraagt als een theatralisch armatuur — textuur geprojecteerd in de kegel, zachte penumbra, decay en gefocuste schaduwen — op Three.js WebGPU met de klassieke Lucy-scan als onderwerp.`,
    coverNote: "De cover toont Lucy onder de bewegende spotlight op schaduwontvangende grond.",
    whyBullets: [
      "- **Showroom-lichttaal** — kegel, falloff en gobo-achtige texture maps",
      `- **Echte schaduwen** — contact op de grond verkoopt diepte voor product en sculptuur`,
      "- **WebGPU materialenpad** — moderne Three.js-verlichting, geen gebakken GIF",
      "- **Helpers on demand** — visualiseer het licht tijdens tunen",
    ],
    whyUses: `product-turntables, galeriestudies en lichtpitches vóór een volledige production-scène.`,
    beginner: `Een spotlight is een lichtkegel, zoals een podiump lamp. Hier ziet u de zachte rand van de kegel, hoe helderheid afneemt met afstand, en hoe de schaduw van de sculptuur op de vloer ligt — allemaal live in de browser.`,
    glossary: [
      {
        term: "Spotlight",
        def: "een licht met kegelhoek, richting en optionele textuur in de bundel",
      },
      {
        term: "Penumbra",
        def: "de zachte rand van de lichtkegel",
      },
      {
        term: "Decay",
        def: "hoe snel intensiteit afneemt met afstand",
      },
      {
        term: "WebGPU",
        def: "de nieuwere browser GPU-API gebruikt door dit Three.js renderer-pad",
      },
    ],
    trySteps: [
      "Open de [WebGPU Spotlight demo](/demos/webgpu-spotlight/)",
      "Orbiteer rond Lucy; kijk naar de bewegende spot en grondschaduw",
      "Toggle lichthelpers indien beschikbaar om de kegel te zien",
      "Let op penumbra en focus — zachte rand vs. scherpe schaduw als trade-offs",
    ],
    requirements: [
      "**Browser:** Chrome of Edge met WebGPU (niet het oudere WebGL lights-voorbeeld)",
      "**GPU:** elke recente laptop-GPU is meestal genoeg voor deze scène",
      `**Model:** Lucy PLY is inbegrepen — zware custom meshes kunnen optimalisatie nodig hebben`,
    ],
    viewA: {
      caption: "Driekwart — kegellicht leesbaar op Lucy en vloer",
    },
    viewB: {
      caption: "Shadow focus — contactschaduw en penumbra op de grond",
    },
    alsoCan: [
      "Gobo / projectietexturen wisselen voor merkmotieven",
      `Koppelen aan volumetrische demo's voor „bundel in de lucht“-sfeer`,
      `Het upstream [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight)-voorbeeld bestuderen`,
    ],
    howWorks: `Three.js \`WebGPURenderer\` evalueert spot lights met maps, penumbra, decay en shadow maps in de WebGPU-pipeline. De scène orbiteert een geanimeerde spot boven Lucy PLY op een ontvangend vlak. Officieel voorbeeld: [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_lights_spotlight.html)). WebGL heeft klassieke spotlight-voorbeelden; deze pagina volgt specifiek het WebGPU lights-pad.`,
    faq: [
      {
        q: "Is dit hetzelfde als volumetrische god rays?",
        a: `Nee — dit is oppervlakteverlichting en schaduwen. Voor bundels in de lucht, zie ons volumetrische verlichtingswerk.`,
      },
      {
        q: "Kunnen we ons eigen product belichten?",
        a: `Ja. Lucy vervangen door een GLB en exposure matchen is een typische klant-volgende stap.`,
      },
    ],
    reading: [
      {
        label: "three.js — WebGPU spotlight",
        url: "https://threejs.org/examples/#webgpu_lights_spotlight",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "Volumetric Lighting",
        url: "/blog/volume-lighting",
      },
      {
        label: "WebGPU Custom Fog Scattering",
        url: "/blog/webgpu-custom-fog-scattering",
      },
    ],
  },
  "webgpu-compute-birds": {
    pageTitle: "WebGPU Compute Birds — GPU flocking",
    demoLabel: "WebGPU Compute Birds",
    hook: `Achtduizend vogels zwermen in de browser — separation, alignment en cohesion berekend op GPU. Beweeg de muis om de zwerm te verstoren; tune gedrag live.`,
    coverNote: "De cover toont de geïnstancieerde zwerm als coherente murmuration.",
    whyBullets: [
      "- **Klassieke Boids, moderne GPU** — Reynolds-regels op interactieve schaal",
      "- **Instancing** — één mesh, duizenden vogels",
      "- **Pointer-verstoring** — stakeholders voelen agency in seconden",
      "- **WebGPU compute** — simulatie blijft van CPU main thread af",
    ],
    whyUses: `natuur-geïnspireerde merkmomenten, wetenschap-uitleg-UI's en stresstests voor GPU compute-pipelines.`,
    beginner: `Vogels in een zwerm volgen simpele regels: niet crashen, buren matchen, bij de groep blijven. Vermenigvuldig dat met duizenden en u krijgt een murmuration. Hier draaien die regels op de grafische kaart zodat de beweging vloeiend blijft.`,
    glossary: [
      {
        term: "Boids",
        def: "klassiek flocking-model: separation, alignment, cohesion",
      },
      {
        term: "Instancing",
        def: "veel kopieën van één mesh efficiënt tekenen",
      },
      {
        term: "Compute",
        def: "GPU-werk dat vogelposities/snelheden per frame bijwerkt",
      },
      {
        term: "WebGPU",
        def: "API hier gebruikt in plaats van oudere WebGL-only GPGPU-trucs",
      },
    ],
    trySteps: [
      "Open de [WebGPU Compute Birds demo](/demos/webgpu-compute-birds/)",
      "Kijk hoe de zwerm in coherente beweging komt",
      "Beweeg de muis door de zwerm om te verstoren",
      "Open Birds settings en tweak separation / alignment / cohesion",
    ],
    requirements: [
      "**Browser:** WebGPU-capabele Chrome of Edge aanbevolen",
      "**GPU:** middenklasse of beter voor 8k instances bij vloeiende frame rates",
      "**Not WebGL:** het compute flocking-pad richt zich op WebGPU",
    ],
    viewA: {
      caption: "Brede murmuration — zwerm leest als één volume",
    },
    viewB: {
      caption: "Nader pass — geïnstancieerde vogels en vluchtrichting",
    },
    alsoCan: [
      "Krachten retunen voor rustigere vs. chaotische merksferen",
      "Gebruiken als achtergrondlaag achter UI (let op contrast)",
      `De zwerm in een [360° guided tour](/demos/panorama-360/) lucht-beat leggen (Stap 4)`,
      `Vergelijken met [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) op threejs.org`,
    ],
    howWorks: `Elke frame past een WebGPU compute pass flocking-krachten toe en schrijft nieuwe transforms; instanced drawing rendert de vogels. Upstream: [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_birds.html)). Oudere WebGL „GPGPU birds“-voorbeelden bestaan in three.js-geschiedenis; deze IOM-pagina volgt de WebGPU compute-editie.`,
    tourBridge: {
      step: 4,
      stepLabel: "Begeleide tour Stap 4 — birds-laag + hotspot-popup op The Black Witness",
      body: `In de [360° Panorama Tour](/demos/panorama-360/) is **Stap 4** geauthoriseerd als \`cam · +birds · hotspot+popup\`: de camera kantelt naar de lucht, de WebGPU birds-laag brengt de sfeer tot leven, en een hotspot/popup houdt het verhaal klikbaar.

Standalone flocking bewijst de tech; de tour bewijst het **productpatroon** — levende GPU-lagen getimed op een begeleide stop zodat gasten beweging *en* nog steeds kunnen slepen om te kijken en tikken om te leren. Eerdere beats gebruiken [WebGPU Particles](/blog/webgpu-particles) (Stap 2) en [Spout](/blog/spout) (Stap 3) op dezelfde manier.`,
    },
    faq: [
      {
        q: "Waarom zoveel vogels?",
        a: `Schaal is het punt — compute + instancing tonen wat WebGPU interactief kan dragen.`,
      },
      {
        q: "Kunnen vogels een pad of logo volgen?",
        a: "Guiding fields en attractors zijn gangbare uitbreidingen voor klantverhalen.",
      },
      {
        q: "Waar verschijnen de vogels in de 360-tour?",
        a: `Begeleide tour Stap 4 op The Black Witness — birds-laag met hotspot-popup. Open /demos/panorama-360/ en Play guided tour.`,
      },
    ],
    reading: [
      {
        label: "three.js — compute birds",
        url: "https://threejs.org/examples/#webgpu_compute_birds",
      },
      {
        label: "360° Panorama Tour Editor",
        url: "/demos/panorama-360/",
      },
      {
        label: "Boids — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Boids",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
    ],
    related: [
      {
        label: "360° Panorama Tour Editor",
        url: "/blog/panorama-360-tour",
      },
      {
        label: "WebGPU Particles",
        url: "/blog/webgpu-particles",
      },
      {
        label: "Spout",
        url: "/blog/spout",
      },
    ],
  },
  "webgpu-parallax-uv": {
    pageTitle: "WebGPU Parallax UV — diepte in een vlakke textuur",
    demoLabel: "WebGPU Parallax UV",
    hook: `IJs dat dikker aanvoelt dan een vlak vlak — TSL parallax UV verschuift gelaagde ambientCG-maps met displacement, normalen en ruwheid onder HDR-licht.`,
    coverNote: `De cover toont de ijsgrond met parallax-diepte terwijl de camera langs het oppervlak schuift.`,
    whyBullets: [
      "- **Nep-dikte, echte besparing** — dieptesignaal zonder zwaar gesculpt mesh",
      "- **TSL-materialen** — moderne Three.js node-materialen op WebGPU",
      "- **PBR-stack** — albedo, normal, ruwheid en displacement samen",
      "- **HDR-omgeving** — reflecties die bevroren materiaal geloofwaardig maken",
    ],
    whyUses: `materiaalstudies, grondvlakken voor productshots en „leest deze shader?“-reviews.`,
    beginner: `Een normale ijsfoto is plat. Parallax UV bedriegt het oog: als je de camera beweegt, verschuift de textuur een beetje alsof er diepte onder het oppervlak zit — als kijken in helder ijs zonder elke scheur te modelleren.`,
    glossary: [
      {
        term: "Parallax mapping",
        def: "UV-verschuiving op basis van kijkhoek en een hoogte-/displacement-map",
      },
      {
        term: "TSL",
        def: "Three.js Shading Language voor node-gebaseerde GPU-materialen",
      },
      {
        term: "PBR",
        def: "physically based rendering — ruwheid/metalness-materiaalmodel",
      },
      {
        term: "HDR environment",
        def: "high-dynamic-range-beeld dat scènereflecties verlicht",
      },
    ],
    trySteps: [
      "Open de [WebGPU Parallax UV-demo](/demos/webgpu-parallax-uv/)",
      "Orbit laag over het ijs — zie diepte verschuiven met hoek",
      "Vergelijk schuin vs. top-down",
      "Let op hoe normalen en ruwheid de bevroren look onder HDR veranderen",
    ],
    requirements: [
      "**Browser:** WebGPU (Chrome/Edge aanbevolen)",
      `**Texturen:** ambientCG-stijl maps zijn meegeleverd; netwerk helpt bij eerste load`,
      `**GPU:** licht tot matig — zwaarder dan een vlak onverlicht vlak, lichter dan volledige compute-zwermen`,
    ],
    viewA: {
      caption: "Schuine hoek — parallax-diepte in het ijsvlak",
    },
    viewB: {
      caption: "Hogere view — gelaagde maps en HDR-reflectie leesbaar",
    },
    alsoCan: [
      "Maps retargeten naar steen, hout of merkmaterialen",
      "Als grond onder een product-GLB gebruiken",
      `[webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv) bestuderen`,
    ],
    howWorks: `Een TSL-materiaal samplet hoogte/displacement om UV's te verschuiven op kijkrichting (parallax), en laagt kleur, normal en ruwheid. WebGPURenderer draait de node-grafiek. Upstream: [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv) ([bron](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_parallax_uv.html)). Klassieke WebGL-parallax-shaders bestaan; deze demo volgt het WebGPU + TSL-pad.`,
    faq: [
      {
        q: "Is het ijs een echt 3D-volume?",
        a: "Nee — het is een schaduwend vlak. Parallax simuleert diepte in het materiaal.",
      },
      {
        q: "Kunnen we onze eigen texture-set gebruiken?",
        a: "Ja. Passende map-naming en sterkte is een standaard materiaalswap.",
      },
    ],
    reading: [
      {
        label: "three.js — parallax UV",
        url: "https://threejs.org/examples/#webgpu_parallax_uv",
      },
      {
        label: "ambientCG",
        url: "https://ambientcg.com/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "WebGPU TSL Raging Sea",
        url: "/blog/webgpu-tsl-raging-sea",
      },
      {
        label: "WebGPU Custom Fog Scattering",
        url: "/blog/webgpu-custom-fog-scattering",
      },
    ],
  },
  "webgpu-tsl-raging-sea": {
    pageTitle: "WebGPU TSL Raging Sea — procedurele golven",
    demoLabel: "TSL Raging Sea",
    hook: `Een stormachtige oceaan zonder oceaan-simulator — gelaagde sinusgolven en fractale noise verplaatsen een dicht vlak, met berekende normalen en emissieve kammen, allemaal in TSL op WebGPU.`,
    coverNote: "De cover toont hoge zee met heldere kamm-highlighting.",
    whyBullets: [
      "- **Procedureel water** — geen gebakken flipbook; parameters sturen de sfeer",
      "- **TSL-displacement** — golf-math leeft in de materiaalgrafiek",
      "- **Kamenergie** — emissieve highlights verkopen schuim en spray zonder deeltjes",
      "- **WebGPU-pad** — moderne Three.js-oceansketch voor pitches en R&D",
    ],
    whyUses: `omgevingsachtergronden, maritieme productcontext en shader-R&D vóór FFT-oceaan-systemen.`,
    beginner: `De „zee“ is een plat raster dat de GPU elk frame omhoog en omlaag duwt met wiskunde — grote deining plus klein chop. Belichting op de hellingen maakt het water in plaats van een gerimpeld vel.`,
    glossary: [
      {
        term: "Displacement",
        def: "mesh-vertices (of shading) verplaatsen met een hoogtefunctie",
      },
      {
        term: "Fractal noise",
        def: "gelaagde noise voor natuurlijk ogende detail",
      },
      {
        term: "TSL",
        def: "Three.js Shading Language voor het golf-grafiekauthoring",
      },
      {
        term: "Normals",
        def: "oppervlakrichtingen voor belichting; opnieuw berekend uit de golven",
      },
    ],
    trySteps: [
      "Open de [TSL Raging Sea-demo](/demos/webgpu-tsl-raging-sea/)",
      "Orbit en kijk grote deining vs. klein chop",
      "Zoek emissieve kammen op golfpieken",
      "Vergelijk sfeer met onze andere oceaan-experimenten op de site",
    ],
    requirements: [
      "**Browser:** WebGPU vereist voor dit TSL WebGPU-voorbeeld",
      "**GPU:** dichtere vlakken kosten meer — verlaag pixel ratio bij haperen",
      `**Geen WebGL-oceaan:** anders dan klassieke WebGL water/FFT-demo's`,
    ],
    viewA: {
      caption: "Brede stormzee — gelaagde deining leesbaar op afstand",
    },
    viewB: {
      caption: "Kamdetail — normalen en emissieve highlights",
    },
    alsoCan: [
      "Amplitude en noise retunen voor rustige haven vs. storm",
      "Als skybox-achtige achtergrond onder een product",
      `Open [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) upstream`,
    ],
    howWorks: `Vertex- (of equivalent TSL-)displacement sommeert grote sinus met fractale noise; normalen worden afgeleid zodat belichting op hellingen reageert; kammen krijgen emissieve lift. Draait op Three.js WebGPU + TSL. Upstream: [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) ([bron](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_raging_sea.html)). Voor spectrum-gebaseerde zeeën, zie dedicated FFT-oceaanwerk elders bij IOM — andere techniek, vaak WebGL of hybride.`,
    faq: [
      {
        q: "Is dit een volledige oceaan-simulatie?",
        a: "Nee — procedurele displacement. Ideaal voor look development; geen CFD.",
      },
      {
        q: "WebGL of WebGPU?",
        a: `WebGPU via Three.js TSL. Bredere device-dekking kan nog WebGL-oceanen prefereren.`,
      },
    ],
    reading: [
      {
        label: "three.js — TSL raging sea",
        url: "https://threejs.org/examples/#webgpu_tsl_raging_sea",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
    ],
    related: [
      {
        label: "WebGPU Parallax UV",
        url: "/blog/webgpu-parallax-uv",
      },
      {
        label: "Terrain Sandbox",
        url: "/blog/terrain-sandbox",
      },
    ],
  },
  "webgpu-tsl-linked-particles": {
    pageTitle: "WebGPU TSL Linked Particles — getekende VFX-sporen",
    demoLabel: "TSL Linked Particles",
    hook: `Beweeg de pointer om een gloeiend deeltjesspoor te spawnen — GPU compute, turbulentie, nearest-neighbor link-ribbons, hue-rotatie en bloom. Een TSL VFX-sketch die je voelt.`,
    coverNote: "De cover toont gekoppelde deeltjesribbons met bloom.",
    whyBullets: [
      "- **Pointer als penseel** — direct „probeer het“ voor klanten in een call",
      "- **Links tussen buren** — netwerk / synaps / sterrenbeeld-taal",
      "- **Compute + TSL** — spawn, turbulentie en leven op de GPU",
      `- **Bloom-afwerking** — zachte glow die premium leest op donkere UI's`,
    ],
    whyUses: "hero-achtergronden, interactieve beursmomenten en tech-merk visuele systemen.",
    beginner: `Je tekent met licht: deeltjes verschijnen onder de cursor, drijven met turbulentie, en dunne lijnen verbinden nabije punten — als een sterrenbeeld dat je gebaar even onthoudt.`,
    glossary: [
      {
        term: "Nearest-neighbor links",
        def: "lijnen getrokken tussen deeltjes die dicht bij elkaar zijn",
      },
      {
        term: "Turbulence",
        def: "ruisachtig krachtveld dat deeltjesbeweging kronkelt",
      },
      {
        term: "Bloom",
        def: "post-process glow rond heldere pixels",
      },
      {
        term: "TSL VFX",
        def: "effecten geauthoriseerd met Three.js Shading Language nodes",
      },
    ],
    trySteps: [
      "Open de [TSL Linked Particles-demo](/demos/webgpu-tsl-linked-particles/)",
      "Beweeg de pointer over het canvas om sporen te tekenen",
      "Pauzeer en kijk links en hue-shift terwijl deeltjes uitdoven",
      "Orbit indien ingeschakeld; let op bloom op heldere clusters",
    ],
    requirements: [
      "**Browser:** WebGPU (Chrome/Edge aanbevolen)",
      "**GPU:** bloom + compute willen wat headroom — sluit zware tabs indien nodig",
      "**Input:** muis of trackpad; touch varieert per device",
    ],
    viewA: {
      caption: "Dichte linker cluster — magenta links met cyan accenten",
    },
    viewB: {
      caption: "Dichter mesh — gebloemde nodes en buur-ribbons",
    },
    alsoCan: [
      "Pointer mappen naar touch / wand voor installaties",
      "Hue-cyclus recoloreren naar merkpalet",
      `Vergelijk [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles)`,
    ],
    howWorks: `WebGPU compute spawnt en advecteert deeltjes; TSL-materialen renderen sprites/ribbons; een link-pass verbindt nabije deeltjes; bloom post-processed het frame. Upstream: [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles) ([bron](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_vfx_linkedparticles.html)). WebGL-lijnnetwerken (zie draw-range) zijn een verwant visueel idee met een andere, breder ondersteunde pipeline.`,
    faq: [
      {
        q: "Is dit hetzelfde als de shape particles-demo?",
        a: `Nee — die vormt solide presets en zwaartekracht. Deze is pointer-getekend VFX met links en bloom.`,
      },
      {
        q: "Kunnen we het vertragen voor een rustige merkfilm?",
        a: "Ja — spawn rate, turbulentie en bloom-drempels zijn typische knoppen.",
      },
    ],
    reading: [
      {
        label: "three.js — TSL linked particles",
        url: "https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "WebGPU Particles",
        url: "/blog/webgpu-particles",
      },
      {
        label: "BufferGeometry Draw Range",
        url: "/blog/buffergeometry-drawrange",
      },
    ],
  },
  "webgpu-custom-fog-scattering": {
    pageTitle: "WebGPU Custom Fog Scattering — door de nevel lopen",
    demoLabel: "Custom Fog Scattering",
    hook: `Een first-person wandeling door procedurele dennensilhouetten in koele exponentiële mist — TSL dichtheidsgebaseerde scattering blur die de afstand zacht maakt als vochtige lucht.`,
    coverNote: "De cover toont dennenvormen die oplossen in verspreide mist.",
    whyBullets: [
      "- **Atmosfeer als onderwerp** — sfeer eerst, geometrie daarna",
      "- **Scattering blur** — afstand wordt zachter zoals vochtige lucht",
      "- **Instelbare dichtheid** — mist en scattering als design-dials",
      "- **WebGPU + TSL** — custom mist voorbij een enkele scene.fog-kleur",
    ],
    whyUses: "omgevingspitches, game-achtige walkthroughs en „weer als merk“-studies.",
    beginner: `Mist is niet alleen een grijze tint. In vochtige lucht lijken verre bomen zachter en melkachtiger. Deze demo laat je die sensatie ervaren — silhouetten van dennen die vervagen in een koele nevel die je kunt verdikken of verdunnen.`,
    glossary: [
      {
        term: "Exponential fog",
        def: "mist die geleidelijk dikker wordt met afstand",
      },
      {
        term: "Scattering",
        def: "licht dat terugkaatst in het medium — hier benaderd als blur/verzachting",
      },
      {
        term: "First-person",
        def: "camera beweegt alsof je door de scène loopt",
      },
      {
        term: "TSL",
        def: "node shading om mistgedrag op WebGPU aan te passen",
      },
    ],
    trySteps: [
      "Open de [Custom Fog Scattering-demo](/demos/webgpu-custom-fog-scattering/)",
      "Loop of kijk rond in het dennenveld",
      "Verhoog mistdichtheid — zie afstand instorten in nevel",
      "Tune scattering factor en vergelijk scherpe vs. zachte verre bomen",
    ],
    requirements: [
      "**Browser:** WebGPU-capabele Chrome of Edge",
      "**Besturing:** toetsenbord / pointer zoals geïmplementeerd in demo-UI",
      "**GPU:** comfortabel op moderne laptops; verlaag resolutie bij motion blur",
    ],
    viewA: {
      caption: "Dieper lopen — dichtere stammen terwijl de nevel sluit",
    },
    viewB: {
      caption: "Dichte stam — scattering verzacht het bos erachter",
    },
    alsoCan: [
      "Mist retinten voor dageraad / nacht merksferen",
      `Silhouetten wisselen voor architectuurmassa's`,
      `Lees [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering)`,
    ],
    howWorks: `Procedurele boomachtige silhouetten in een WebGPU-scène; TSL implementeert dichtheidsbewuste mist en scattering blur zodat verre structuur zachter wordt. Upstream: [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering) ([bron](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_custom_fog_scattering.html)). Standaard WebGL \`FogExp2\` is eenvoudiger; dit experiment toont een custom scattering-behandeling op de WebGPU-stack.`,
    faq: [
      {
        q: "Is dit volumetrische belichting?",
        a: `Verwante sfeer, andere techniek — hier focus op mist/scattering door een beloopbaar bos, geen rect-area god rays.`,
      },
      {
        q: "Kunnen we een echt sitemodel gebruiken?",
        a: `Ja als scoped integratie — vervang silhouetten door vereenvoudigde architectuur-LODs.`,
      },
    ],
    reading: [
      {
        label: "three.js — custom fog scattering",
        url: "https://threejs.org/examples/#webgpu_custom_fog_scattering",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "WebGPU Spotlight",
        url: "/blog/webgpu-spotlight",
      },
      {
        label: "Volumetric Lighting",
        url: "/blog/volume-lighting",
      },
    ],
  },
  "webgpu-modifier-curve": {
    pageTitle: "WebGPU Curve Modifier — tekst langs een spline",
    demoLabel: "WebGPU Curve Modifier",
    hook: `Geëxtrudeerde tekst die langs een gesloten Catmull-Rom-spline stroomt — sleep controle-handles en het mesh deformeert met het pad. Een WebGPU-aanpak van curve modifiers voor logo's en type.`,
    coverNote: "De cover toont lettervormen gebogen langs de bewerkbare curve.",
    whyBullets: [
      `- **Type als geometrie** — logo's en headlines die op een pad leven`,
      "- **Live handles** — het verhaal herformen voor een klant",
      "- **Gesloten spline** — loops voor eindeloze beursbeweging",
      "- **Past bij pad-tools** — zelfde familie als spline-editors en camera rails",
    ],
    whyUses: `geanimeerde logo's, tentoonstellingstitels en pad-gedreven product callouts.`,
    beginner: `Stel je flexibele koelkastmagnet-letters langs een gebogen draad voor. Verplaats de controlepunten van de draad en de letters glijden en buigen mee. Dat is een curve modifier — hier in de browser op WebGPU.`,
    glossary: [
      {
        term: "Catmull-Rom spline",
        def: "een gladde curve die door controlepunten loopt",
      },
      {
        term: "Curve modifier",
        def: "deformeert een mesh zodat het een pad volgt",
      },
      {
        term: "Extruded text",
        def: "3D-lettergeometrie uit een font-outline",
      },
      {
        term: "Control handle",
        def: "sleepbaar punt dat de spline herformt",
      },
    ],
    trySteps: [
      "Open de [WebGPU Curve Modifier-demo](/demos/webgpu-modifier-curve/)",
      "Klik een controle-handle om te selecteren",
      "Sleep om het gesloten pad te herformen — zie de tekst stromen",
      "Orbit om letterdikte en silhouet te checken",
    ],
    requirements: [
      "**Browser:** WebGPU (Chrome/Edge aanbevolen)",
      "**Input:** muis voor handle picking en slepen",
      "**GPU:** bescheiden — zwaardere fonts / fijnere extrusie verhogen kosten",
    ],
    viewA: {
      caption: "Volledige loop — geëxtrudeerde tekst volgt de gesloten spline",
    },
    viewB: {
      caption: "Handle-edit — lokale buiging van lettervormen op het pad",
    },
    alsoCan: [
      "De string wisselen voor een merk-wordmark",
      "Padideeën exporteren naar camera-rail workflows",
      `Vergelijk [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve)`,
    ],
    howWorks: `Een gesloten Catmull-Rom-curve definieert het pad; een modifier samplet de curve om geëxtrudeerde tekstgeometrie bij elke update te transformeren. WebGPURenderer tekent het resultaat. Upstream: [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve) ([bron](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_modifier_curve.html)). Voor puur pad-editing zonder modifier, zie de WebGL [spline editor](https://threejs.org/examples/#webgl_geometry_spline_editor) — complementaire tools.`,
    faq: [
      {
        q: "Kunnen we ons font gebruiken?",
        a: `Meestal ja met een gelicenseerd font dat voor web gemesht kan worden — wij doen conversie in production builds.`,
      },
      {
        q: "WebGPU vereist?",
        a: `Voor deze demopagina ja. Curve-ideeën kunnen ook op WebGL afhankelijk van het project.`,
      },
    ],
    reading: [
      {
        label: "three.js — curve modifier",
        url: "https://threejs.org/examples/#webgpu_modifier_curve",
      },
      {
        label: "three.js — spline editor",
        url: "https://threejs.org/examples/#webgl_geometry_spline_editor",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "Catmull Spline Editor",
        url: "/blog/spline-editor",
      },
      {
        label: "Shape Particles",
        url: "/blog/compute-particles",
      },
    ],
  },
  "webgpu-particles": {
    pageTitle: "WebGPU Particles — vuur- en rooksprites",
    demoLabel: "WebGPU Particles",
    hook: `Geïnstancieerde vuur- en rooksprites met TSL-levenscycli — roterende rook-UV's, additief vuur en een eenvoudig grondraster. Compact WebGPU-VFX voor sfeer en productwarmte.`,
    coverNote: `De cover toont dezelfde vuur/rook-deeltjestaal als Guided Tour Step 2 op The Black Witness — dakwarmte met een „Animated fire“-hotspotpopup in https://iobjectm.com/demos/panorama-360/.`,
    whyBullets: [
      "- **Leesbaar elementair VFX** — vuur + rook zonder volledig FX-pakket",
      "- **Geïnstancieerde sprites** — veel deeltjes, één draw-strategie",
      "- **TSL-levenscycli** — spawn, veroudering en fade op het GPU-pad",
      "- **Additief vuur** — glow die netjes compositeert op donkere scènes",
      `- **Aangesloten op 360°-tours** — Step 2 op [Panorama 360](https://iobjectm.com/demos/panorama-360/) koppelt deeltjes aan hotspotpopup`,
    ],
    whyUses: `smidse-/launch-sferen, camp- en industriële schetsen, lichte hero-loops en warmtebeats in interactieve 360° guided tours.`,
    beginner: `Vuur en rook zijn hier veel kleine beelden (sprites) die in de loop van de tijd vervagen en wervelen. Additief blending maakt vlammen helder; rook gebruikt zachtere texturen. Samen verkopen ze warmte zonder echte verbranding te simuleren. In onze [360°-tour](https://iobjectm.com/demos/panorama-360/) wordt diezelfde deeltjestaal Guided Tour Step 2 — een stop waar gasten rondkijken en klikken.`,
    glossary: [
      {
        term: "Sprite particle",
        def: "getextureerd quad, vaak camera-facing, voor rook/vuur",
      },
      {
        term: "Additive blending",
        def: "kleuren tellen op — helder voor vuur, gemakkelijk te overblazen",
      },
      {
        term: "Life cycle",
        def: "geboorte, veroudering en dood van elk deeltje",
      },
      {
        term: "Instancing",
        def: "efficiënt veel deeltjes tekenen vanuit één sjabloon",
      },
      {
        term: "Guided tour Step 2",
        def: "op /demos/panorama-360/ — cam · +particles · hotspot+popup",
      },
    ],
    trySteps: [
      "Open de [WebGPU Particles-demo](/demos/webgpu-particles/)",
      "Orbit de kolom — scheid vuurkern van rooklichaam",
      "Kijk naar sprite-rotatie / UV-beweging in de rook",
      `Open [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, en bekijk Step 2 (deeltjes + hotspot)`,
    ],
    requirements: [
      "**Browser:** WebGPU via Three.js (niet alleen oudere WebGL-deeltjesvoorbeelden)",
      "**GPU:** prima op de meeste moderne laptops bij standaard counts",
      "**Display:** donkere UI-achtergronden laten additief vuur het best zien",
    ],
    viewA: {
      caption: "Dakvuur-walkthrough — geanimeerde pluim boven de stad",
    },
    viewB: {
      caption: "Nadere warmte — deeltjespluim boven de skyline",
    },
    alsoCan: [
      "Vlammen recoloreren voor merkveilige warmte",
      "Onder een productsilhouet leggen voor launch-films",
      `Dezelfde deeltjestaal in een [360° guided tour](/demos/panorama-360/) beat droppen (Step 2)`,
      "Open [webgpu_particles](https://threejs.org/examples/#webgpu_particles)",
    ],
    howWorks: `Geïnstancieerde sprites samplen vuur/rook-textures; TSL-node-materialen animeren leven, rotatie en blending; WebGPURenderer compositeert het frame. Upstream: [webgpu_particles](https://threejs.org/examples/#webgpu_particles) ([bron](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_particles.html)). WebGL-deeltjessystemen blijven wijd gebruikt voor bredere ondersteuning — kies API passend bij doelgroepdevices.`,
    tourBridge: {
      step: 2,
      stepLabel: "Guided tour Step 2 — deeltjes + hotspotpopup op The Black Witness",
      body: `Standalone vuur/rook is maar half het verhaal. In de [360° Panorama Tour](/demos/panorama-360/) is **Step 2** geauthoriseerd als \`cam · +particles · hotspot+popup\`: de camera landt op een dakbeat, een deeltjeslaag verkoopt warmte/sfeer, en een hotspot opent een popup zodat gasten verhaal + agency in één stop krijgen.

Die koppeling is het interactiviteitsvoordeel — deeltjes zijn geen achtergrondbehang; ze markeren een **moment waarop je kunt stoppen, rondkijken en klikken**. Hetzelfde VFX-vakmanschap uit deze demo wordt een guided beat in een deelbare tour. Zie ook [Spout](/blog/spout) (Step 3) en [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4).`,
    },
    faq: [
      {
        q: "Is dit echte fluidsimulatie?",
        a: `Nee — sprite-VFX met geauthoriseerde beweging. Goedkoop, controleerbaar, pitch-vriendelijk.`,
      },
      {
        q: "Hoe verschilt dit van linked particles?",
        a: `Dit zijn vuur/rook-sprites. Linked particles benadrukken pointer-sporen en buur-ribbons.`,
      },
      {
        q: "Waar verschijnen deze deeltjes in de 360-tour?",
        a: `Guided-tour Step 2 op The Black Witness — deeltjes met hotspotpopup. Open /demos/panorama-360/ en Play guided tour.`,
      },
    ],
    reading: [
      {
        label: "three.js — WebGPU particles",
        url: "https://threejs.org/examples/#webgpu_particles",
      },
      {
        label: "360° Panorama Tour Editor",
        url: "/demos/panorama-360/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
    ],
    related: [
      {
        label: "360° Panorama Tour Editor",
        url: "/blog/panorama-360-tour",
      },
      {
        label: "Spout",
        url: "/blog/spout",
      },
      {
        label: "WebGPU Compute Birds",
        url: "/blog/webgpu-compute-birds",
      },
    ],
  },
  "buffergeometry-drawrange": {
    pageTitle: "BufferGeometry Draw Range — deeltjesnetwerken op WebGL",
    demoLabel: "BufferGeometry Draw Range",
    hook: `Een levend deeltjesnetwerk met nabijheidslijnen — \`BufferGeometry.setDrawRange()\` tekent alleen actieve punten en segmenten. Klassiek Three.js WebGL, nog steeds een workhorse voor data-look visuals.`,
    coverNote: "De cover toont de knoop-link-deeltjeswolk met actieve verbindingen.",
    whyBullets: [
      "- **Netwerk-esthetiek** — knopen en randen die als data voelen",
      "- **Draw range-controle** — alleen renderen wat deze frame leeft",
      "- **Instelbare graaf** — count, afstand en max. verbindingen",
      "- **Breed device-bereik** — WebGL, niet WebGPU-only",
    ],
    whyUses: "tech-merkachtergronden, „verbonden systeem“-metaforen en lichte WebGL-embeds.",
    beginner: `Stippen zweven; wanneer twee dichtbij komen, verschijnt een dunne lijn — als mensen die een netwerk worden. Het slimme deel is efficiëntie: de engine tekent alleen de actieve stippen en lijnen in plaats van alles de hele tijd.`,
    glossary: [
      {
        term: "BufferGeometry",
        def: "Three.js meshdata opgeslagen in GPU-buffers",
      },
      {
        term: "Draw range",
        def: "beperkt welk deel van een buffer deze frame wordt getekend",
      },
      {
        term: "Proximity link",
        def: "lijn wanneer deeltjes binnen een afstand zijn",
      },
      {
        term: "WebGL",
        def: "de wijd ondersteunde browser-3D-API van deze demo",
      },
    ],
    trySteps: [
      "Open de [BufferGeometry Draw Range-demo](/demos/buffergeometry-drawrange/)",
      "Orbit de deeltjeswolk",
      "Verhoog of verlaag deeltjestelling en linkafstand in de UI",
      "Kijk hoe lijnen verschijnen/verdwijnen als buren veranderen",
    ],
    requirements: [
      "**Browser:** elke moderne browser met WebGL",
      "**GPU:** schaalt met deeltjes- en verbindingscounts — lager op zwakke devices",
      "**API-notitie:** WebGL-pad — nuttig wanneer WebGPU niet beschikbaar",
    ],
    viewA: {
      caption: "Volledig netwerk — deeltjes met nabijheidssegmenten",
    },
    viewB: {
      caption: "Nadere graaf — draw-range-actieve links duidelijk leesbaar",
    },
    alsoCan: [
      "Kleuren mappen naar categorieën of signaalsterkte",
      "Als gedempte achtergrond onder UI-copy gebruiken",
      `Bestudeer [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange)`,
    ],
    howWorks: `Deeltjes updaten in JS (of eenvoudige GPU-vriendelijke buffers); lijnsegmenten worden herbouwd of geranged voor nabije paren; \`setDrawRange\` beperkt draws tot actieve subset. Upstream: [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange) ([bron](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_buffergeometry_drawrange.html)). Voor WebGPU compute-zwermen en TSL-linkribbons, zie nieuwere experimenten — zelfde visuele familie, andere API.`,
    faq: [
      {
        q: "Waarom geen WebGPU hier?",
        a: `WebGL wint nog voor maximale device-dekking. WebGPU kiezen we wanneer compute of TSL-materialen het nodig hebben.`,
      },
      {
        q: "Kunnen links echte data representeren?",
        a: `Ja — vervang willekeurige nabijheid door uw graaf-randen in een production build.`,
      },
    ],
    reading: [
      {
        label: "three.js — buffergeometry drawrange",
        url: "https://threejs.org/examples/#webgl_buffergeometry_drawrange",
      },
      {
        label: "Three.js BufferGeometry",
        url: "https://threejs.org/docs/#api/en/core/BufferGeometry",
      },
      {
        label: "WebGL — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API",
      },
    ],
    related: [
      {
        label: "CSS3D Sprites",
        url: "/blog/css3d-sprites",
      },
      {
        label: "WebGPU TSL Linked Particles",
        url: "/blog/webgpu-tsl-linked-particles",
      },
    ],
  },
  "spline-editor": {
    pageTitle: "Catmull Spline Editor — paden die je kunt slepen",
    demoLabel: "Catmull Spline Editor",
    hook: `Interactieve Catmull-Rom-paden met transform-gizmos — uniform, centripetal en chordal vergelijken, spanning tunen en \`Vector3\`-arrays exporteren voor camera rails en objectpaden.`,
    coverNote: "De cover toont de bewerkbare spline met controlepunten en kurvetype-contrast.",
    whyBullets: [
      "- **Paden visueel authoriseren** — geen coördinatenlijsten eerst intypen",
      "- **Kurvetype-vergelijking** — uniform vs centripetal vs chordal op één plek",
      "- **Export-ready** — Vector3-arrays voor rails, fly-throughs en modifiers",
      "- **WebGL-betrouwbaarheid** — werkt waar WebGPU nog niet beschikbaar is",
    ],
    whyUses: "camerapadplanning, product-turntable rails en briefingtools voor motion.",
    beginner: `Een spline is een gladde curve geleid door enkele controlepunten — als een flexibele liniaal. Sleep de punten en het pad update. Filmmakers en games gebruiken hetzelfde idee voor camerabewegingen; hier bewerk je het in de browser.`,
    glossary: [
      {
        term: "Catmull-Rom",
        def: "splinefamilie die door controlepunten interpoleert",
      },
      {
        term: "Centripetal",
        def: "parametrisatie die meestal beter lussen/cuspes vermijdt dan uniform",
      },
      {
        term: "Tension",
        def: "hoe strak de curve naar de controles buigt",
      },
      {
        term: "Gizmo",
        def: "translate/rotate/scale-handle op scherm voor een punt",
      },
    ],
    trySteps: [
      "Open de [Spline Editor-demo](/demos/spline-editor/)",
      "Sleep controlepunten met de gizmo",
      "Schakel uniform / centripetal / chordal en vergelijk de buiging",
      "Exporteer of kopieer Vector3-data als de UI het biedt — als camera rail",
    ],
    requirements: [
      "**Browser:** moderne WebGL-browser (Chrome, Edge, Firefox, Safari)",
      "**Input:** muis voor gizmo-drags; desktop is het makkelijkst",
      "**API:** WebGL Three.js-voorbeeldfamilie — niet WebGPU",
    ],
    viewA: {
      caption: "Volledig pad — controlepunten en gladde Catmull-Rom-curve",
    },
    viewB: {
      caption: "Gizmo-edit — lokale herformulering van de rail",
    },
    alsoCan: [
      `Exports voeden in fly-through-camera's`,
      "Koppelen met WebGPU curve modifier voor type-on-path",
      `Upstream [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor) gebruiken`,
    ],
    howWorks: `Controlepunten definiëren een \`CatmullRomCurve3\`; de editor visualiseert polyline/curve en laat punten transformeren. Kurvetype en spanning wijzigen parametrisatie. Upstream: [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor) ([bron](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_geometry_spline_editor.html)). Exporteren van punten verbindt met IOM-padtools en de [WebGPU curve modifier](/demos/webgpu-modifier-curve/).`,
    faq: [
      {
        q: "Welk kurvetype moet ik kiezen?",
        a: `Centripetal is een veilige default tegen scherpe cuspes; vergelijk in de UI voor uw pad.`,
      },
      {
        q: "Kan dit een echte camera op een clientsite aansturen?",
        a: "Ja — we koppelen geëxporteerde punten aan een production cameracontroller.",
      },
    ],
    reading: [
      {
        label: "three.js — spline editor",
        url: "https://threejs.org/examples/#webgl_geometry_spline_editor",
      },
      {
        label: "Catmull–Rom spline — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "WebGPU Curve Modifier",
        url: "/blog/webgpu-modifier-curve",
      },
      {
        label: "Terrain Sandbox",
        url: "/blog/terrain-sandbox",
      },
    ],
  },
  "terrain-sandbox": {
    pageTitle: "Terrain Sandbox — een wereld schilderen uit noise",
    demoLabel: "Terrain Sandbox",
    hook: `Gelaagde noise wordt heuvels die je kunt orbiten — bomen, rotsen en markers plaatsen, seeds regenereren, hoogte en ruwheid tunen. Een IOM WebGL-sandbox-MVP richting brushes, GLTF en echte DEM-data.`,
    coverNote: "De cover toont een geseed terreinpatch met verspreide props.",
    whyBullets: [
      "- **Speelbaar landschap** — stakeholders begrijpen site-sfeer snel",
      "- **Seed + knoppen** — reproduceerbare varianten voor art direction",
      "- **Props op het oppervlak** — bomen/rotsen/markers voor schaalverhalen",
      "- **Roadmap-vriendelijk** — MVP richting sculpt, GLTF, MapTiler DEM",
    ],
    whyUses: `vroege omgevingspitches, game-achtige previews en workshoptools voor layoutgesprekken.`,
    beginner: `De grond is nog niet met de hand gesculpt — wiskunde (noise) bedenkt heuvels. Je verandert hoe hoog en ruw ze zijn, plant enkele objecten zodat schaal echt voelt, en draait rond alsof je een locatie verkent.`,
    glossary: [
      {
        term: "Procedural terrain",
        def: "landschap gegenereerd uit algoritmen in plaats van gescand mesh",
      },
      {
        term: "Seed",
        def: "getal dat hetzelfde willekeurige landschap reproduceerbaar maakt",
      },
      {
        term: "DEM",
        def: "digital elevation model — echte hoogtedata (toekomstpad)",
      },
      {
        term: "WebGL",
        def: "browser-3D-API gebruikt door deze sandbox",
      },
    ],
    trySteps: [
      "Open de [Terrain Sandbox-demo](/demos/terrain-sandbox/)",
      "Orbit het terrein; regenereer seed voor nieuw landvorm",
      "Tune hoogte en ruwheid",
      "Plaats bomen, rotsen of markers en check silhouet opnieuw",
    ],
    requirements: [
      "**Browser:** moderne WebGL-browser",
      "**GPU:** grotere grids kosten meer — verlaag resolutie op lichte devices",
      "**Netwerk:** niet vereist voor kern-noise-terrein (props lokaal aan demo)",
    ],
    viewA: {
      caption: "Brede landvorm — noise-heuvels met leesbare graatlijnen",
    },
    viewB: {
      caption: "Props-pass — bomen/rotsen geven menselijke schaal",
    },
    alsoCan: [
      "Favoriete seeds opslaan als art-direction-referenties",
      "Follow-up plannen met sculpt-brushes of GLTF-props",
      "Vergelijk met echte tiles in Procedural GL",
    ],
    howWorks: `Gelaagde noise-samples bouwen een heightmap; een mesh wordt displaced en geschaduwd; props raycasten of height-samplen op het oppervlak. De stack is Three.js op **WebGL** voor brede ondersteuning. Dit is een IOM-sandbox-MVP — geen three.js stockvoorbeeld — met pad naar brushes, asset-import en optionele MapTiler DEM voor echte sites.`,
    faq: [
      {
        q: "Is dit echte geografie?",
        a: `Nog niet — procedurele noise. Echte DEM / MapTiler staat op de roadmap voor site-true werk.`,
      },
      {
        q: "WebGL of WebGPU?",
        a: "WebGL voor deze sandbox zodat meer devices de link kunnen openen.",
      },
    ],
    reading: [
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "MapTiler",
        url: "https://www.maptiler.com/",
      },
      {
        label: "Procedural noise (intro)",
        url: `https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web/Building_up_a_basic_demo_with_Three.js`,
      },
    ],
    related: [
      {
        label: "Procedural GL Terrain",
        url: "/blog/procedural-gl",
      },
      {
        label: "WebGPU TSL Raging Sea",
        url: "/blog/webgpu-tsl-raging-sea",
      },
    ],
  },
  "procedural-gl": {
    pageTitle: "Procedural GL Terrain — echte wereldtiles in 3D",
    demoLabel: "Procedural GL Terrain",
    hook: `Echte landschappen gestreamd als GPU LOD-terrein — onze pagina embedt de officiële [procedural.eu](https://www.procedural.eu/map/) map powered by procedural-gl.js (MPL-2.0). Eerste stap: live upstream demo; self-hosted MapTiler build kan volgen.`,
    coverNote: `De cover is een live still van de procedural.eu map-embed — echte MapTiler elevation/imagery-tiles in 3D, geen noise-sandbox.`,
    whyBullets: [
      "- **Echte plaatsen** — hoogte uit maptiles, niet alleen noise",
      "- **GPU LOD** — detail waar je kijkt, lichtere meshes verder weg",
      "- **Open-source kern** — procedural-gl.js onder MPL-2.0",
      "- **Brug naar productie** — embed nu; self-host later met uw key",
    ],
    whyUses: "sitecontext voor architectuur, locatiepitches en geo-storytelling op het web.",
    beginner: `In plaats van heuvels te verzinnen, laadt deze viewer echte terreintiles zodat je werkelijke geografie in 3D kunt overvliegen — dichter bij een lichte Earth view dan een gamelevel van noise.`,
    glossary: [
      {
        term: "LOD",
        def: "level of detail — meer meshdetail nabij camera",
      },
      {
        term: "Map tiles",
        def: "beeld/elevatie-stukken gestreamd voor huidige view",
      },
      {
        term: "procedural-gl.js",
        def: "open-source bibliotheek voor GPU-terrein uit mapdata",
      },
      {
        term: "MapTiler",
        def: "tileprovider vaak gebruikt voor production keys (niet in repo)",
      },
    ],
    trySteps: [
      "Open de [Procedural GL-demo](/demos/procedural-gl/)",
      "Wacht tot de embedded [procedural.eu map](https://www.procedural.eu/map/) laadt",
      "Pan en zoom over echt terrein",
      "Stel je voor een clientgebouw of pad op een bekende graat te plaatsen",
    ],
    requirements: [
      "**Netwerk:** vereist — tiles en procedural.eu embed hebben connectiviteit nodig",
      "**Browser:** modern Chromium aanbevolen voor WebGL-terrein",
      "**Keys:** production MapTiler keys blijven server-side / env — nooit gecommit",
    ],
    viewA: {
      caption: "Regionale view — LOD-terrein uit gestreamde tiles",
    },
    viewB: {
      caption: "Nader reliëf — graten en valleien leesbaar in 3D",
    },
    alsoCan: [
      "Als context naast een geolokaliseerde GLB gebruiken",
      "Self-hosted MapTiler-fork plannen",
      "Docs lezen op [procedural.eu](https://www.procedural.eu/)",
    ],
    howWorks: `Onze \`/demos/procedural-gl/\` pagina embedt de officiële map-ervaring op [procedural.eu/map](https://www.procedural.eu/map/). Onder de motorkap bouwt [procedural-gl-js](https://github.com/felixpalmer/procedural-gl-js) GPU LOD-meshes uit elevation/imagery-tiles (WebGL). IOMs volgende stap kan een self-hosted build met MapTiler zijn — API-keys blijven uit git repo. Dit is geografisch terrein, complementair aan procedurele noise [Terrain Sandbox](/demos/terrain-sandbox/).`,
    faq: [
      {
        q: "Wordt de map gehost door IOM?",
        a: `Deze eerste stap embedt procedural.eu. Een self-hosted variant is een aparte productiontaak.`,
      },
      {
        q: "WebGL of WebGPU?",
        a: `WebGL-terreinstreaming via procedural-gl.js — gekozen voor stack en tile-ecosysteem van de bibliotheek.`,
      },
    ],
    reading: [
      {
        label: "procedural.eu map",
        url: "https://www.procedural.eu/map/",
      },
      {
        label: "procedural.eu docs",
        url: "https://www.procedural.eu/",
      },
      {
        label: "procedural-gl-js on GitHub",
        url: "https://github.com/felixpalmer/procedural-gl-js",
      },
    ],
    related: [
      {
        label: "Terrain Sandbox",
        url: "/blog/terrain-sandbox",
      },
      {
        label: "Streets GL Bridge",
        url: "/blog/streets-gl-bridge",
      },
    ],
  },
  spout: {
    pageTitle: "Spout — raymarched pijpwatere",
    demoLabel: "Spout",
    hook: `Een chroom pijp met raymarched water — breking, transparantie en reflecties in een self-hosted WebGL2-port van P_Malins klassieke Shadertoy. Sleep om de vloeistofsculptuur te orbiten — en zie dezelfde waterbeat in onze [360° Panorama Tour](https://iobjectm.com/demos/panorama-360/) (guided Step 3).`,
    coverNote: `De cover toont de pijpuitloop met refractief water dat de omgeving vangt. Dezelfde effecttaal verschijnt als Step 3 (\`+particles/spout\`) in https://iobjectm.com/demos/panorama-360/.`,
    whyBullets: [
      "- **Shadertoy-pedigree** — bekend studiestuk, nu op iobjectm.com",
      "- **Raymarched water** — geen deeltjessplash-mesh; distance fields doen het werk",
      "- **Breking & reflectie** — materiaaltaal die klanten uit ads herkennen",
      "- **WebGL2-port** — brede real-time reach zonder WebGPU",
      `- **Aangesloten op 360°-tours** — Step 3 op [Panorama 360](https://iobjectm.com/demos/panorama-360/) koppelt spout/water aan hotspotpopup`,
    ],
    whyUses: `shader craft-demo's, liquid branding moodboards, raymarching look-dev onderwijzen en waterbeats in interactieve 360° guided tours.`,
    beginner: `Het water is geen gefilmde splash. De GPU loopt stralen door een wiskundige vorm tot het „water“ of „metaal“ raakt, en buigt het zicht als een lens. Daarom lijken pijp en vloeistof vanuit elke hoek zo schoon. In onze [360°-tour](https://iobjectm.com/demos/panorama-360/) wordt diezelfde vloeistoftaal een guided stop waar gasten rondkijken en klikken.`,
    glossary: [
      {
        term: "Raymarching",
        def: "stappen langs een straal door een distance field tot een oppervlak gevonden is",
      },
      {
        term: "SDF",
        def: "signed distance function — wiskunde die vormen beschrijft voor raymarchers",
      },
      {
        term: "Refraction",
        def: "buigen van het zicht door transparant water",
      },
      {
        term: "Shadertoy",
        def: "online playground voor pixel/raymarch-shaders (origineel door P_Malin)",
      },
      {
        term: "Guided tour Step 3",
        def: "op /demos/panorama-360/ — cam · +particles/spout · hotspot+popup",
      },
    ],
    trySteps: [
      "Open de [Spout-demo](/demos/spout/)",
      "Sleep om pijp en water te orbiten",
      "Kijk hoe breking de achtergrond door de vloeistof verschuift",
      `Open [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, en bekijk Step 3 (spout / water + hotspot)`,
      `Vergelijk met het originele [Shadertoy-beeld](https://www.shadertoy.com/view/lsXGzH)`,
    ],
    requirements: [
      "**Browser:** WebGL2-capabele Chrome, Edge, Firefox of Safari",
      "**GPU:** licht tot matige raymarch-kosten — verlaag resolutie indien nodig",
      "**API:** WebGL2-shaderport — geen WebGPU-compute",
    ],
    viewA: {
      caption: "Hero spout — pijpmetaal en refractieve waterkolom",
    },
    viewB: {
      caption: "Orbitdetail — reflecties en transparantie in de vloeistof",
    },
    alsoCan: [
      "Palet retunen voor merkmetalen en vloeistoftint",
      "Stills gebruiken als look-dev-referenties voor productvloeistoffen",
      `De waterbeat in een [360° guided tour](/demos/panorama-360/) stop droppen (Step 3)`,
      `P_Malins [Shadertoy](https://www.shadertoy.com/view/lsXGzH) crediteren en bestuderen`,
    ],
    howWorks: `Een fullscreen (of mesh-gebonden) WebGL2-fragmentshader raymarched SDFs voor pijp en water, met breking, transparantie en reflecties. IOM host een port van P_Malins Shadertoy-experiment [lsXGzH](https://www.shadertoy.com/view/lsXGzH) onder \`/demos/spout/\`. Dit is klassieke shaderkunst op **WebGL2**, complementair aan Three.js-scènedemo's en distinct van WebGPU TSL-water.`,
    tourBridge: {
      step: 3,
      stepLabel: "Guided tour Step 3 — spout / waterdeeltjes + hotspotpopup op The Black Witness",
      body: `Spout is niet alleen een standalone experiment. Op [https://iobjectm.com/demos/panorama-360/](https://iobjectm.com/demos/panorama-360/) is **Step 3** van The Black Witness guided tour geauthoriseerd als \`cam · +particles/spout · hotspot+popup\`: de camera landt op de rooftop waterbeat, de spout/waterlaag verkoopt vloeistofbeweging ter plekke, en een hotspotpopup houdt het verhaal interactief.

Dat is het interactiviteitsvoordeel — gasten kijken niet alleen naar breking; ze komen aan op een **getimede stop**, kunnen nog rondkijken en de hotspot klikken voor betekenis. Open de editor of [bezoekerspreview](https://iobjectm.com/demos/panorama-360/?mode=preview), druk **Play guided tour**, en ga naar Step 3. Combineer met [WebGPU Particles](/blog/webgpu-particles) (Step 2) en [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4) voor de volledige effects stack.`,
    },
    faq: [
      {
        q: "Wordt het water gesimuleerd met fysica?",
        a: "Nee — het is raymarched shadergeometrie/animatie, geen vloeistofdeeltjessim.",
      },
      {
        q: "Kan dit in een Three.js-productscène draaien?",
        a: `Vaak als screen pass of gelokaliseerd effect — integratie scoped per project. De panoramatour op https://iobjectm.com/demos/panorama-360/ is een productionvoorbeeld.`,
      },
      {
        q: "Waar verschijnt Spout in de 360-tour?",
        a: `Guided-tour Step 3 op The Black Witness — spout/water met hotspotpopup. Open https://iobjectm.com/demos/panorama-360/ en Play guided tour.`,
      },
    ],
    reading: [
      {
        label: "Panorama 360 (live)",
        url: "https://iobjectm.com/demos/panorama-360/",
      },
      {
        label: "Panorama 360 — visitor preview",
        url: "https://iobjectm.com/demos/panorama-360/?mode=preview",
      },
      {
        label: "Shadertoy — Spout (P_Malin)",
        url: "https://www.shadertoy.com/view/lsXGzH",
      },
      {
        label: "Ray marching — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Ray_marching",
      },
      {
        label: "WebGL2 — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext",
      },
    ],
    related: [
      {
        label: "360° Panorama Tour Editor",
        url: "/blog/panorama-360-tour",
      },
      {
        label: "The Black Witness — 360° Tour",
        url: "/blog/panorama-suite",
      },
      {
        label: "WebGPU Particles",
        url: "/blog/webgpu-particles",
      },
      {
        label: "WebGPU Compute Birds",
        url: "/blog/webgpu-compute-birds",
      },
    ],
  },
}
