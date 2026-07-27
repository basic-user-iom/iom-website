/* Auto-assembled by scripts/assemble-blog-locale-packs.mjs — do not hand-edit large blocks */
import type { DemoPostLocalePack } from './types'

export const deDemoBlogPosts: DemoPostLocalePack = {
  "3d-viewer": {
    pageTitle: "3D Viewer — Produktmodelle im Browser",
    demoLabel: "3D Viewer",
    heroVideoCaption: "Produkt-Walkthrough — Orbit, HDR-Beleuchtung und Viewer-Chrome",
    excerpt: `v3.19.2 Desktop-Release: Streets GL Zuverlässigkeit und Texturqualität, Product-Mode-Texturwiederherstellung nach City-Teardown, einheitliche Panel-Header — plus GLTF/FBX/OBJ/IFC-Review mit HDR-Bodenprojektion und Streets GL.`,
    seo_title: "3D Viewer v3.19.2 — Streets GL Texturen & Zuverlässigkeit — IOM",
    seo_description: `3D Viewer v3.19.2 für Windows (Setup + Portable): Streets GL Vertex-Budget/Simplify-Fixes, UV-erhaltende 4k-Texturen, Product-Mode-Texturwiederherstellung und einheitliche Floating-Panel-Header. Browser-Review für GLTF/FBX/OBJ/IFC mit HDR und Streets GL.`,
    hook: `Kunden sollten keinen CAD-Platz brauchen, um ein Modell zu prüfen. Unser 3D Viewer stellt GLTF, FBX, OBJ und IFC in einem teilbaren Browser- (und Desktop-)Fenster bereit — Orbit, Materialien inspizieren, mit 360° HDR und Bodenprojektion beleuchten oder das Mesh in OSM / Streets GL-Stadtkontext platzieren, wenn der Standort die Geschichte erzählt.`,
    coverNote: `Ein kurzer Walkthrough leitet den Beitrag; die Stills unten zeigen 360° HDR-Bodenprojektion und OSM 3D / Streets GL-Stadtkontext im selben Viewer.`,
    whatYouSeeIntro: `Zwei Fähigkeiten, die das Modell über eine graue Leere hinaus verkaufen — filmische HDR-Beleuchtung, dann echtes Stadtbild:`,
    whyBullets: [
      `- **Link teilen, nicht ZIP** — Stakeholder öffnen das Modell während eines Calls auf dem Laptop`,
      `- **Ein Viewer für viele Formate** — weniger E-Mails mit „Welche App öffnet das?“`,
      `- **360° HDR + Bodenprojektion** — echte Beleuchtung und Kontaktschatten, damit das Produkt auf der Platte sitzt`,
      `- **OSM 3D / Streets GL im Viewer** — Stadtkontext mit eigenen Modellen kombinieren, wenn die Straße den Pitch verkauft`,
    ],
    whyUses: `Produktkonfiguratoren, Architektur- und Außenplatzierungen, Messe-Tablets, asynchrone Kundenfreigaben und eigenständige Web-Präsentationen aus derselben Pipeline.`,
    beginner: `Ein 3D-Viewer ist wie ein Foto Ihres Produkts, das Sie drehen können. Statt flacher Bilder sitzt das echte Modell auf der Seite — ziehen zum Drehen, zoomen für Details, in HDR-Licht hüllen oder auf einer echten OpenStreetMap-Stadt platzieren, wenn Sie „Wo sitzt das?“ brauchen. Keine Installation für die Web-Version; ein Windows-Desktop-Build deckt Offline oder schwere Assets ab.`,
    glossary: [
      {
        term: "GLTF / GLB",
        def: `gängige webfreundliche 3D-Dateiformate ([Khronos glTF](https://www.khronos.org/gltf/))`,
      },
      {
        term: "Orbit",
        def: "ziehen, um die Kamera um das Modell zu drehen",
      },
      {
        term: "360° HDR-Umgebung",
        def: `ein High-Dynamic-Range-Wrap, der das Modell von echtem Himmel/Szene aus beleuchtet`,
      },
      {
        term: "Bodenprojektion",
        def: `Projektion des HDR auf die Bodenebene, damit Schatten und Reflexionen zur Umgebung passen`,
      },
      {
        term: "OSM 3D / Streets GL",
        def: `OpenStreetMap-basierter 3D-Stadtkontext, den Sie mit Ihren Modellen im Viewer kombinieren können ([streets.gl](https://streets.gl/))`,
      },
      {
        term: "Hotspot",
        def: "ein klickbarer Marker auf dem Modell mit Info oder Link",
      },
    ],
    trySteps: [
      `Öffnen Sie die [3D Viewer Website](https://3dbviewer.com/) oder laden Sie Windows Setup / Portable vom [v3.19.2 Release](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)`,
      "Laden Sie ein Sample oder Ihr eigenes GLTF/GLB, wenn der Build Import erlaubt",
      `Probieren Sie eine 360° HDR-Umgebung mit Bodenprojektion — beobachten Sie, wie Kontaktschatten das Produkt auf der Platte verankern`,
      `Öffnen Sie OSM 3D / Streets GL und stellen Sie sich (oder platzieren Sie) Ihr Modell im echten Stadtbild vor`,
    ],
    requirements: [
      "**Browser:** moderner Chrome, Edge oder Firefox für die Web-Version",
      `**Windows Desktop:** Setup oder Portable von [GitHub Releases v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2) (Electron 41)`,
      "**Dateien:** GLB/GLTF für Web bevorzugen; schweres CAD ggf. zuerst konvertieren",
      `**GPU:** Path Tracing und dichte Stadtschichten wünschen eine solide GPU — auf leichten Geräten auf leichtere Modi zurückfallen`,
    ],
    viewA: {
      caption: `360° HDR mit Bodenprojektion — Produkt von der Platte beleuchtet, Schatten auf Asphalt lesbar`,
    },
    viewB: {
      caption: `OSM 3D / Streets GL im Viewer — Stadtkontext, den Sie mit Ihren Modellen kombinieren können`,
    },
    alsoCan: [
      "HDR-Umgebungen und Tageszeit für verschiedene Stimmungen wechseln",
      "Path Tracing für Stills nutzen, wenn Qualität Echtzeitgeschwindigkeit schlägt",
      `Product / City / Hybrid-Modi beim Review von Außen- oder Stadtplatzierungen mischen`,
      "Eigenständige Web-Präsentation für Kundenübergabe exportieren",
    ],
    howWorks: `Der Viewer basiert auf der [Three.js](https://threejs.org/)-Familie mit Fokus auf praktisches Review: Meshes laden, einrahmen, mit HDR + Bodenprojektion beleuchten und — wenn das Briefing eine Straße braucht — OSM 3D / Streets GL-Stadtkontext im selben Chrome öffnen. Desktop-Builds erweitern dieselbe Idee bei Offline oder großen Assets. Formatunterstützung folgt echten Kundenpipelines — das Ziel ist immer „öffnen, verstehen, entscheiden.“ Live-Produkt: [3dbviewer.com](https://3dbviewer.com/).`,
    whatsNew: {
      heading: "Neu in v3.19.2",
      body: `Streets GL Bridge-Zuverlässigkeit und Texturqualität, plus Product-Mode-Feinschliff:

- **Streets GL Sync** — Vertex-Budget-Simplify mit UV-Erhalt, damit Autos und große Meshes zuverlässig im Stadtkontext landen
- **Bessere Texturen in City** — bis 4k binärer Texturtransfer mit automatischer Payload-Anpassung für große Meshy-Maps
- **Product-Mode Restore** — Texturen verschwinden nicht mehr nach Verlassen von Streets GL / City-Teardown
- **Einheitliche Panel-Header** — gemeinsames FloatingPanelHeader-Chrome über Editor-Panels

**Download (Windows x64):** [Setup](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Setup-3.19.2-x64.exe) | [Portable](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Portable-3.19.2-x64.exe) | [Release Notes](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)`,
    },
    faq: [
      {
        q: "Brauchen Kunden CAD-Software?",
        a: "Nein für Review — ein Browser-Link reicht den meisten Stakeholdern.",
      },
      {
        q: "Können wir das Modell auf einer echten Straße zeigen?",
        a: `Ja — OSM 3D / Streets GL läuft im Viewer, damit Sie Stadtkontext mit Ihrem GLB/GLTF kombinieren können.`,
      },
      {
        q: "Wo bekomme ich den Windows-Desktop-Build?",
        a: `Setup- und Portable-Installer stehen auf dem [v3.19.2 GitHub Release](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2), auch verlinkt von [3dbviewer.com](https://3dbviewer.com/).`,
      },
      {
        q: "Können wir es branden?",
        a: "Ja. Viewer-Chrome, Umgebungen und Hotspot-Inhalte können Ihrer Marke folgen.",
      },
    ],
    reading: [
      {
        label: "3D Viewer live",
        url: "https://3dbviewer.com/",
      },
      {
        label: "v3.19.2 Windows-Downloads",
        url: "https://github.com/basic-user-iom/3d/releases/tag/v3.19.2",
      },
      {
        label: "glTF Übersicht — Khronos",
        url: "https://www.khronos.org/gltf/",
      },
      {
        label: "Streets GL Live-Karte",
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
        label: "Volumetrische Beleuchtung",
        url: "/blog/volume-lighting",
      },
    ],
  },
  "streets-gl-bridge": {
    pageTitle: "Streets GL Bridge — OSM-Stadtkontext für 3D-Modelle",
    demoLabel: "Streets GL Bridge",
    hook: `Ein schönes Modell braucht trotzdem einen Ort zum Stehen. Streets GL Bridge erkundet OpenStreetMap-3D-Stadtkontext als Bodenschicht — damit geolokalisierte Assets in einer erkennbaren Straßenkulisse statt in einer leeren Leere sitzen.`,
    coverNote: "Das Cover zeigt die Karten-/Bridge-Framing der Portfolio-Karte.",
    whyBullets: [
      "- **Ort erzählt die Geschichte** — Kunden erkennen den Block, nicht nur das Mesh",
      "- **Offene Kartendaten** — OSM als lebende Stadtschicht unter Ihrem Asset",
      "- **Bridge-Mindset** — Ihre Modellpipeline mit navigierbarem Boden verbinden",
      "- **Open-Source-DNA** — gebaut um das Streets GL-Ökosystem",
    ],
    whyUses: `Städtische Vorschläge, Site-Context-Slides, geolokalisierte Produkt- oder Architekturvorschauen und Gespräche über „Wo sitzt das auf der Straße?“ vor einem vollen GIS-Build.`,
    beginner: `Denken Sie an Google-Earth-Vibes, aber darauf ausgelegt, Ihr 3D-Objekt in ein echtes Straßenraster zu setzen. Die Karte ist die Bühne; das Modell der Darsteller. Sie orbitieren und erkunden statt auf einen grauen unendlichen Boden zu starren.`,
    glossary: [
      {
        term: "OSM",
        def: `OpenStreetMap — community-basierte Kartendaten ([openstreetmap.org](https://www.openstreetmap.org/))`,
      },
      {
        term: "Bodenschicht",
        def: "Stadt, Straßen und Gelände unter Ihrem Modell",
      },
      {
        term: "Geolokalisiert",
        def: "an echter Breite/Länge auf der Erde platziert",
      },
      {
        term: "WebGL",
        def: `die Browser-GPU-API, die die 3D-Karte zeichnet ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API))`,
      },
    ],
    trySteps: [
      "Öffnen Sie die [Streets GL Bridge Demo](/demos/streets-gl/)",
      "Warten Sie, bis das Karten-Embed sich setzt",
      `Schwenken und zoomen Sie den Stadtkontext (oder vergleichen Sie mit der [live Streets GL Karte](https://streets.gl/))`,
      `Stellen Sie sich vor, ein Kundengebäude oder Kiosk auf eine bekannte Ecke zu setzen`,
    ],
    requirements: [
      "**Netzwerk:** Kacheln und Embed brauchen Verbindung",
      "**Browser:** moderner Chromium empfohlen für WebGL-Kartenansichten",
      `**Performance:** dichte Städte sind schwerer — reinzoomen für flüssigere Erkundung`,
    ],
    viewA: {
      caption: "Stadtbild — Straßen und Massierung als Kontext",
    },
    viewB: {
      caption: "Nähere städtische Lesart — wo ein Modell sitzen würde",
    },
    alsoCan: [
      "Als Referenzschicht beim Platzieren geolokalisierter GLBs nutzen",
      "Stakeholder auf die live [streets.gl](https://streets.gl/) Karte verweisen",
      "Mit Simple 3D Buildings-Konzepten von OSM paaren",
    ],
    howWorks: `Streets GL rendert OSM-basierte 3D-Stadtstruktur im Browser. Unsere Bridge-Seite hostet diesen Kontext für IOM-Workflows — eine praktische „Wo sitzt das?“-Schicht statt einer vollen GIS-Suite. Upstream-Projekt: [StrandedKitty/streets-gl](https://github.com/StrandedKitty/streets-gl); Live-Karte unter [streets.gl](https://streets.gl/).`,
    faq: [
      {
        q: "Ist das Google Maps?",
        a: "Nein — es baut auf OpenStreetMap und den offenen Streets GL-Tools auf.",
      },
      {
        q: "Können wir unser Gebäude einsetzen?",
        a: `Das ist die Absicht der Bridge: geolokalisierte Modelle über Stadtkontext. Fragen Sie uns nach einer scoped Integration.`,
      },
    ],
    reading: [
      {
        label: "Streets GL Live-Karte",
        url: "https://streets.gl/",
      },
      {
        label: "streets-gl auf GitHub",
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
    pageTitle: "360° Panorama Tour Editor — geführte Walks im Browser erstellen",
    demoLabel: "360° Panorama Tour Editor",
    hook: `Messebesucher erinnern sich an Erlebnisse. Dieser Editor lädt equirectangular Panoramen, platziert Hotspots, verknüpft Multi-Szenen-Touren und speichert eine \`.360project\` — alles im Browser, standardmäßig mit The Black Witness.`,
    coverNote: `Das Cover ist geführte Tour Schritt 1 auf The Black Witness — Rabe-Hotspot + Popup.`,
    whyBullets: [
      "- **Editor + Besucher in einem Stack** — Tour bauen, dann Preview-Link teilen",
      "- **Hotspots, die erklären** — Info, Szenenlinks und optionale iframe-Popups",
      "- **Multi-Szenen-Touren** — Gäste von Stand zu Produktlinie zu Venue führen",
      `- **Projektdateien, die Sie behalten** — \`.360project\` zwischen Sessions speichern und neu laden`,
    ],
    whyUses: `Messe-Begleiter, Venue-Walkthroughs, Produktlinien-Geschichten, Museum-Soft-Launches und Kundenfreigaben vor einem vollen Produktionstour-Build.`,
    beginner: `Ein 360°-Panorama ist ein Foto, das sich ganz um Sie legt — wie mitten in einem Raum stehen. Der Editor macht aus diesen Fotos eine Tour: klickbare Marker (Hotspots), Verbindungen zwischen Räumen und ein Pfad, den Gäste ohne App-Download folgen können.`,
    glossary: [
      {
        term: "Equirectangular",
        def: "gängiges 360°-Bildlayout (volle Kugel auf Rechteck abgeflacht)",
      },
      {
        term: "Hotspot",
        def: "ein klickbarer Marker — Info, Szenensprung oder URL/iframe",
      },
      {
        term: "Geführte Tour",
        def: "eine skriptierte Sequenz aus Kamerastops, Popups und optionalen Effekten",
      },
      {
        term: ".360project",
        def: "IOMs Speicherdatei für Panoramen, Hotspots und Tour-Einstellungen",
      },
      {
        term: "WebGPU birds",
        def: "optionaler Schwarm-Effekt auf der Tour (GPU-gestützt)",
      },
    ],
    trySteps: [
      `Öffnen Sie den [360° Panorama Tour Editor](/demos/panorama-360/) (oder [Besucher-Preview](/demos/panorama-360/?mode=preview))`,
      "Klicken Sie **Play guided tour** und sehen Sie die vier Black Witness Schritte",
      `Stoppen Sie die Tour und klicken Sie Hotspots selbst — Rabe, Feuer, Wasser, Vögel`,
      `Im Editor wählen Sie jede STEPS-Zeile, um die Kamera zu springen und den Beat zu bearbeiten`,
    ],
    requirements: [
      `**Browser:** moderner Chrome oder Edge empfohlen; WebGPU-Features brauchen eine fähige GPU`,
      `**Bilder:** equirectangular JPG, PNG, WebP; HDR/EXR/KTX2 wenn die Pipeline sie unterstützt`,
      "**Mobil:** Ansehen funktioniert; Bearbeiten ist am Desktop angenehmer",
    ],
    viewA: {
      caption: "Schritt 2 — animierter Feuer-Hotspot und Partikel-Popup",
    },
    viewB: {
      caption: "Schritt 3 — Wasser-/Spout-Beat auf dem Dach",
    },
    viewC: {
      caption: "Schritt 4 — Animated birds Popup mit dem Schwarm gegen den Sturmhimmel",
    },
    alsoCan: [
      "Mehrere Panoramen zu einer geführten Multi-Szenen-Tour verknüpfen",
      "URL- oder iframe-Popups auf Hotspots für Produktseiten oder Embeds hinzufügen",
      `[Partikel](/blog/webgpu-particles), [Spout](/blog/spout) und [Vögel](/blog/webgpu-compute-birds) auf geführten Schritten 2–4 layern`,
    ],
    howWorks: `Panoramen werden auf eine Kugel (oder Cube-Pipeline) gemappt, damit die Kamera in der Mitte sitzt — der klassische Web-360-Ansatz mit [Three.js](https://threejs.org/) und modernen Browser-APIs ([WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) / optional [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)). Hotspots sind Szenen-Metadaten: Position, Typ und Ziel. Geführte Tour-Schritte auf The Black Witness verdrahten dieselben Effekt-Demos in interaktive Beats — Schritt 2 \`+particles\` ([WebGPU Particles](/blog/webgpu-particles)), Schritt 3 \`+particles/spout\` ([Spout](/blog/spout)), Schritt 4 \`+birds\` ([WebGPU Compute Birds](/blog/webgpu-compute-birds)) — jeweils mit \`hotspot+popup\`, damit Bewegung und klickbare Story zusammenkommen. Besucher-Preview ist dieselbe Engine ohne Editor-Chrome — siehe [The Black Witness Tour](/blog/panorama-suite).`,
    faq: [
      {
        q: "Brauchen Gäste eine App?",
        a: `Nein. Teilen Sie einen Browser-Link. Preview-Modus verbirgt den Editor, Gäste sehen nur die Tour.`,
      },
      {
        q: "Können wir eigene Panoramen nutzen?",
        a: `Ja — laden Sie equirectangular Stills in den Editor und bauen Sie Hotspots um Ihr Venue oder Produkt.`,
      },
      {
        q: "Wie hängen Partikel, Spout und Vögel mit der Tour zusammen?",
        a: `Optionale Effektschichten auf geführten Schritten 2–4. Jeder Schritt paart einen Kamerastop mit Effekt und Hotspot-Popup — erkunden Sie die Standalone-Demos, dann Play guided tour in /demos/panorama-360/.`,
      },
    ],
    reading: [
      {
        label: "Live Tour Editor",
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
    pageTitle: "CRM Demo — IOM Client-Sandbox ausprobieren",
    demoLabel: "CRM Demo",
    hook: `Möchten Sie sehen, wie IOM Leads, Projekte und Zeit verwaltet, ohne Live-Kundendaten anzufassen? Die CRM Demo ist eine interaktive Sandbox mit fiktiven Unternehmen — Pipeline, Boards, Ideen und Blog-Entwürfe bleiben in diesem Browser-Tab.`,
    coverNote: "Das Cover zeigt die CRM-Sandbox-UI der Portfolio-Karte.",
    whyBullets: [
      "- **Sicher alles anklicken** — Änderungen treffen nie Produktionsdatenbanken",
      `- **Volles Workspace-Gefühl** — Leads, Projekte, Zeit, Ideen und Sample-Blogposts`,
      "- **Im Meeting pitchen** — `/crm-demo` öffnen und den Flow live durchgehen",
      `- **Gleiche Produktfamilie** — spiegelt das echte Client-CRM unter \`/client-login\``,
    ],
    whyUses: `Sales-Demos, Onboarding-Walkthroughs, Stakeholder-Training und Gespräche über „Wie würde unsere Pipeline aussehen?“ vor Bereitstellung eines echten Workspace.`,
    beginner: `Ein CRM (Customer Relationship Management) ist, wo ein Studio trackt, wer angefragt hat, welche Projekte aktiv sind und wie Zeit verbracht wird. Diese Demo ist eine Übungsküche: die Rezepte sind echt, die Zutaten fiktiv, und nichts, was Sie tippen, verlässt Ihren Tab, außer Sie exportieren es selbst.`,
    glossary: [
      {
        term: "Sandbox",
        def: "eine Übungskopie der App mit Fake-Daten, die sicher zurücksetzt",
      },
      {
        term: "Pipeline",
        def: "Stufen, die ein Lead durchläuft, bevor er Projekt wird",
      },
      {
        term: "In-memory",
        def: "Daten leben in dieser Browser-Session, nicht auf dem Live-Server",
      },
      {
        term: "Client login",
        def: "das echte CRM unter `/client-login` mit Supabase-Daten",
      },
    ],
    trySteps: [
      "Öffnen Sie die [CRM Demo](/crm-demo)",
      "Durchsuchen Sie Leads oder Projects — öffnen Sie eine fiktive Firmenkarte",
      `Machen Sie eine kleine Änderung (Status, Notiz oder Board-Karte), um die Sandbox zu spüren`,
      "Optional: Blog in der Demo-CRM öffnen und einen Sample-Post previewen",
    ],
    requirements: [
      "**Browser:** jeder moderne Desktop-Browser; breites Fenster hilft bei Boards",
      `**Datenschutz:** Sandbox-Daten bleiben lokal im Tab — Refresh kann den Store zurücksetzen`,
      `**Nicht Produktion:** nie echte Kundengeheimnisse hier eingeben; \`/client-login\` für Live-Arbeit`,
    ],
    viewA: {
      caption: "Pipeline-Ansicht — fiktive Leads in Stagespalten",
    },
    viewB: {
      caption: "Projektboard — Tasks und Kontext für eine Demo-Firma",
    },
    alsoCan: [
      "Zeiterfassung und Ideen-Maps mit Sample-Einträgen erkunden",
      "Demo-Workspace zurücksetzen für einen sauberen Start",
      "Sandbox-Gefühl mit echtem CRM nach Login vergleichen",
    ],
    howWorks: `Die öffentliche [CRM Demo](/crm-demo) nutzt einen In-Memory-Store, damit jeder Klick wegwerfbar ist. Das Produktions-CRM unter \`/client-login\` spricht mit Supabase für echte Mitarbeiter- und Kundendaten. Gleiche UI-Sprache, anderes Backend — damit ein Pitch nie einen Live-Datensatz riskiert.`,
    faq: [
      {
        q: "Sehen andere Besucher meine Änderungen?",
        a: `Nein. Die Sandbox ist pro Browser-Tab / Session. Andere sehen ihre eigene Kopie der fiktiven Daten.`,
      },
      {
        q: "Ist das dasselbe wie Client Login?",
        a: `Gleiche Produktfamilie und Screens, aber \`/crm-demo\` berührt nie Live-Datenbanken. Echte Arbeit passiert unter \`/client-login\`.`,
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
        label: "IOM Startseite",
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
    pageTitle: "Image Prep — Größe ändern, komprimieren und EXIF im Browser entfernen",
    demoLabel: "Image Prep",
    hook: `Portfolio- und Web-Bilder sollten scharf, leicht und privat sein. Image Prep skaliert auf gängige Presets, komprimiert JPEG/WebP/PNG und entfernt Kamera-/GPS-EXIF — Dateien bleiben auf Ihrem Gerät, bis Sie das Ergebnis herunterladen.`,
    coverNote: "Das Cover zeigt die Image Prep Tool-UI der Software-Karte.",
    whyBullets: [
      `- **Auf dem Gerät bleiben** — kein Upload auf einen unbekannten Server für schnelles Resize`,
      "- **Web-ready Presets** — Portfolio- und Site-Größen ohne Photoshop-Gymnastik",
      `- **Datenschutz standardmäßig** — EXIF entfernen, damit GPS und Kamerametadaten nicht leaken`,
      `- **Weniger Gewicht, gleiche Story** — komprimieren für schnellere Seiten und leisere CDN-Rechnungen`,
    ],
    whyUses: `Hero-Stills vorbereiten, Galerie-Uploads, CRM/Blog-Covers und Kunden-Handoff-Pakete vor CMS oder Demo-Seite.`,
    beginner: `Bevor ein Foto auf eine Website kommt, braucht es meist drei Gefallen: die richtige Pixelgröße, eine kleinere Datei und weniger persönliche Daten im Header. Image Prep erledigt das im Browser — Bild reinziehen, Preset wählen, saubere Version herunterladen.`,
    glossary: [
      {
        term: "EXIF",
        def: "Metadaten, die Kameras einbetten (Einstellungen, Zeitstempel, manchmal GPS)",
      },
      {
        term: "Komprimieren",
        def: "Dateigröße reduzieren, oft mit Qualitätsregler",
      },
      {
        term: "WebP",
        def: "modernes Bildformat, oft kleiner als JPEG bei ähnlicher Qualität",
      },
      {
        term: "On-device",
        def: "Verarbeitung im Browser; Sie entscheiden, wann heruntergeladen wird",
      },
    ],
    trySteps: [
      "Öffnen Sie [Image Prep](/tools/image-prep)",
      "Ziehen Sie ein JPG oder PNG von Ihrem Rechner rein",
      "Wählen Sie ein Resize-Preset und Format (JPEG / WebP / PNG)",
      "EXIF-Entfernung aktivieren falls nötig, dann Ergebnis herunterladen",
    ],
    requirements: [
      "**Browser:** moderner Chrome, Edge oder Firefox mit Canvas-Unterstützung",
      `**Datenschutz:** Verarbeitung ist lokal — trotzdem keine Geheimnisse in unrelated Felder einfügen`,
      "**Limits:** extrem große RAWs ggf. zuerst in Desktop-Editor",
    ],
    viewA: {
      caption: "Tool-Layout — Quellbild und Prep-Controls",
    },
    viewB: {
      caption: "Nach Prep — webgerechte Ausgabe zum Download bereit",
    },
    alsoCan: [
      "Ein paar Portfolio-Stills im Batch auf dasselbe Preset",
      "WebP exportieren, wenn die Zielsite es unterstützt",
      "Vor Upload von Covers für Blog- oder CRM-Demo-Posts nutzen",
    ],
    howWorks: `Das Tool nutzt Browser-APIs (Canvas / Bilddekodierung) zum Resize und Re-Encode auf Ihrer Maschine. EXIF-Stripping entfernt eingebettete Metadaten, damit veröffentlichte Dateien nicht versehentlich GPS oder Seriennummern tragen. Formathintergrund: [MDN — Using files from web applications](https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications) und [EXIF — Wikipedia](https://en.wikipedia.org/wiki/Exif).`,
    faq: [
      {
        q: "Laden meine Fotos auf IOM-Server hoch?",
        a: `Nein bei normaler Prep — Arbeit bleibt im Browser bis zum Download. Nutzen Sie diesen Download als Datei zum Veröffentlichen.`,
      },
      {
        q: "Sieht die Qualität schlechter aus?",
        a: `Kompression tauscht immer Größe gegen Treue. Starten Sie mit hohem Qualitäts-Preset; nur runterdrehen, wenn die Datei noch schwer ist.`,
      },
    ],
    reading: [
      {
        label: "Image Prep Tool",
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
    pageTitle: "Raven Path Animation — Spline-Flug im Browser",
    demoLabel: "Raven Path Animation",
    hook: `Manchmal ist die Geschichte die Bewegung, nicht das Standbild. Raven Path setzt ein geflügeltes GLB auf eine Catmull-Rom-Spline — Kontrollpunkte ziehen, Geschwindigkeit und Easing feinjustieren, die Route umkehren und Flügelschlag-Animation laufen lassen, während der Vogel dem Pfad folgt.`,
    excerpt: `Animieren Sie einen Raben (oder Ihr eigenes GLB) entlang einer editierbaren Spline — exportieren Sie Pfad-JSON für andere Software, importieren Sie beim nächsten Besuch erneut und justieren Sie Timing im Browser.`,
    seo_title: "Raven Path Animation — Spline-Flug & Pfad-Export — IOM",
    seo_description: `Testen Sie IOMs Raven-Path-Demo: editierbarer Catmull-Rom-Flug, GLB/GLTF/FBX-Import, Pfad-JSON-Export/Reimport und Einsteiger-Walkthrough im 3D-Bereich.`,
    coverNote: "Das Cover zeigt den Raben auf seinem editierbaren Flugpfad.",
    whyBullets: [
      "- **Pfad als Designtool** — Flug mit sichtbaren Kontrollpunkten neu formen",
      `- **Eigenes Modell mitbringen** — GLB, GLTF oder FBX auf denselben Pfad importieren`,
      `- **Pfad exportieren & reimportieren** — JSON für andere Software oder Ihre nächste Session`,
      `- **Timing, das man spürt** — Geschwindigkeit, Ease-in/out, Reverse und Tangente vs. feste Ausrichtung`,
    ],
    whyUses: `Hero-Loops für Brand-Filme, Messe-Attract-Loops, narrative Web-Kapitel, Prototyping von Kreatur- oder Produkt-„Reise“-Pfaden vor einem vollen Animationspass und Weitergabe wiederverwendbarer Pfad-JSON an andere Pipelines.`,
    beginner: `Eine Spline ist eine glatte Kurve, definiert durch wenige Griffe — wie ein flexibler Draht im Raum. Hier reitet ein Rabe (oder Ihr importiertes Modell) auf diesem Draht. Sie ziehen die Griffe, und der Flug aktualisiert sich live. Kein Videoschnitt; der Pfad ist der Schnitt. Wenn Ihnen die Route gefällt, exportieren Sie sie als JSON und laden sie später erneut — oder nutzen Sie die Punkte in anderen Tools.`,
    glossary: [
      {
        term: "Catmull-Rom spline",
        def: `eine glatte Kurve, die durch Kontrollpunkte verläuft ([Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline))`,
      },
      {
        term: "GLB / GLTF / FBX",
        def: "gängige 3D-Modellformate, die Sie auf den Pfad importieren können",
      },
      {
        term: "Path JSON",
        def: `exportierte Kontrollpunkte (und Optionen), die Sie auf der Site reimportieren oder anderswo nutzen können`,
      },
      {
        term: "Tangent-aligned",
        def: "das Modell dreht sich entlang der Pfadrichtung",
      },
      {
        term: "Skeletal animation",
        def: `Knochen treiben Sekundärbewegung (wie Flügelschlag), während die Wurzel der Kurve folgt`,
      },
    ],
    trySteps: [
      "Öffnen Sie die [Raven Path Demo](/demos/raven-path/)",
      `Schauen Sie eine Runde zu, ziehen Sie dann einen Spline-Kontrollpunkt und sehen Sie, wie sich die Route neu formt`,
      `Unter **Path**: **Export path JSON**, dann **Import path JSON** (oder Datei auf die Szene ziehen)`,
      `Optional: **Import GLB / GLTF / FBX**, dann Geschwindigkeit, Ease, Reverse oder Tangenten-Ausrichtung justieren`,
    ],
    requirements: [
      "**Browser:** moderner Chrome, Edge oder Firefox mit WebGL",
      "**GPU:** integrierte Grafik reicht für diese Szene meist aus",
      "**Input:** Maus oder Trackpad erleichtert Punktbearbeitung gegenüber dem Handy",
      `**Dateien:** bevorzugen Sie selbstständige GLB für Modelle; Pfaddateien sind JSON`,
    ],
    viewA: {
      caption: "Weite Pfadansicht — Kurve und Rabe in einem Frame",
    },
    viewB: {
      caption: "Näherer Flug — Flügelpose entlang der Spline",
    },
    alsoCan: [
      "THREE.Vector3-Snippet aus dem Path-Panel für eigene Three.js-Tools kopieren",
      "Mit dem verwandten [Spline-Editor](/demos/spline-editor/)-Experiment vergleichen",
      `Kurvenmodifikatoren in der [WebGPU Curve Demo](/demos/webgpu-modifier-curve/) studieren`,
      "Die Pfad-Idee für Produkt-„Touren“ oder Kamera-Fly-throughs wiederverwenden",
    ],
    howWorks: `Die Demo nutzt [Three.js](https://threejs.org/), um pro Frame eine Catmull-Rom-Kurve zu sampeln, die Modellwurzel auf dieses Sample zu setzen und optional die Vorwärtsachse an die Kurventangente auszurichten, während ein Skelett-Clip (wenn vorhanden) Sekundärbewegung antreibt. Path JSON speichert Kontrollpunkte, geschlossene Schleife und Pfadtransform, damit Sie auf der [Live-Demo](/demos/raven-path/) reimportieren oder die Punkte in andere Software einspeisen können. Dieselbe Ideenfamilie wie three.js Kurven- und Animationsbeispiele — hier abgestimmt auf eine lesbare Kreatur-Schleife mit Import und Export.`,
    faq: [
      {
        q: "Können wir den Raben durch unser Maskottchen ersetzen?",
        a: `Ja — nutzen Sie **Import GLB / GLTF / FBX** in der Demo, um Ihr Modell sofort auf dem Pfad zu testen. Für einen gebrandeten Produktionsbuild fragen Sie uns nach einer scoped Version.`,
      },
      {
        q: "Wie nutze ich einen Pfad später oder in anderer Software wieder?",
        a: `Nutzen Sie **Export path JSON** im Path-Panel. Importieren Sie die Datei beim nächsten Mal auf der Site erneut, oder nutzen Sie die Felder \`points\` / \`threeJsSnippet\` in Blender, Three.js oder eigenen Tools.`,
      },
      {
        q: "Ist das Video oder Echtzeit?",
        a: `Echtzeit-WebGL. Sie können screen-recorden oder anderswo exportieren, aber die Demo selbst ist eine Live-Szene.`,
      },
    ],
    reading: [
      {
        label: "Raven Path Demo",
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
        label: "Spline-Editor (verwandt)",
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
    pageTitle: "Artist Globe — eine lebendige Karte kreativer Praxis",
    demoLabel: "Artist Globe",
    hook: `Portfolios verteilen sich im Web; Geografie zählt noch. Artist Globe ist eine interaktive WebGL-Erde aus Fotografen, Malern, Bildhauern, Klangkünstlern und mehr — nach Praxis filtern, Profile öffnen, Länder hervorheben und einen Eintrag zur Prüfung einreichen.`,
    coverNote: "Das Cover zeigt den Globus mit Künstler-Markern von der 3D-Karte.",
    whyBullets: [
      "- **Entdecken nach Ort** — die Welt drehen statt endlose Grids scrollen",
      "- **Nach Praxis filtern** — Fotografen, Maler, Bildhauer, Sound und mehr",
      "- **Echte Portfolios öffnen** — vom Marker zu den Links eines Künstlers springen",
      `- **Community-Loop** — Profil zur Prüfung einreichen, wenn Sie erscheinen möchten`,
    ],
    whyUses: `kulturelle Entdeckung, Residency- und Festival-Scouting, Studio-Networking und Portfolio-Features, die eine räumliche „Wer ist wo?“-Schicht brauchen.`,
    beginner: `Stellen Sie sich einen Desktop-Globus mit Pins für Künstler vor. Sie drehen ihn, filtern wer erscheint, und klicken einen Pin für mehr Infos. Es ist eine Karte von Menschen und Praktiken, kein Storefront-Checkout.`,
    glossary: [
      {
        term: "WebGL globe",
        def: "eine 3D-Erde im Browser mit [Three.js](https://threejs.org/)-artiger Grafik",
      },
      {
        term: "Practice filter",
        def: "nur bestimmte Disziplinen anzeigen (z. B. Fotografie)",
      },
      {
        term: "Profile",
        def: "eine Künstlerkarte mit Links und Länder-Highlight",
      },
      {
        term: "Submit for review",
        def: "Aufnahme beantragen; Redaktion genehmigt vor Veröffentlichung",
      },
    ],
    trySteps: [
      "Öffnen Sie [Artist Globe](/artist-globe)",
      "Ziehen zum Drehen; scrollen oder kneifen zum Zoomen in eine Region",
      "Praxis-Filter nutzen, um sichtbare Künstler einzugrenzen",
      `Marker klicken für ein Profil, oder Submit-Flow folgen, wenn Sie sich bewerben möchten`,
    ],
    requirements: [
      "**Browser:** moderner Desktop- oder Mobile-Browser mit WebGL",
      "**Netzwerk:** Profile und Karten-Assets brauchen Verbindung",
      `**Performance:** andere GPU-Tabs reduzieren, wenn der Globus auf älteren Laptops schwer wirkt`,
    ],
    viewA: {
      caption: "Voller Globus — Marker über Kontinente",
    },
    viewB: {
      caption: "Regionaler Fokus — Länder-Highlight und gewählte Praxis",
    },
    alsoCan: [
      "Land hervorheben beim Pitch einer regionalen Kohorte",
      "`/artist-globe` als Discovery-Landingpage teilen",
      "Embed-freundlicher Modus für engere Portfolio-Frames (`?embed=1`)",
    ],
    howWorks: `Der Globus ist eine [Three.js](https://threejs.org/) / [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)-Szene: eine texturierte Kugel, Kamerasteuerung und Marker-Sprites oder -Meshes an lat/lon gebunden. Profildaten und Einreichungen laufen über den IOM-Web-Stack, damit die Karte kuratiert bleibt statt unmoderiertem Free-for-all.`,
    faq: [
      {
        q: "Kann jeder auf dem Globus erscheinen?",
        a: `Einträge gehen durch Submit-and-Review, damit die Karte nützlich und vertrauenswürdig bleibt.`,
      },
      {
        q: "Ist das ein soziales Netzwerk?",
        a: "Nein — es ist eine Discovery-Karte kreativer Praktiken mit Links zu Portfolios.",
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
        label: "IOM 3D-Bereich",
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
    hook: `Glänzende Böden und Glas wirken nur echt, wenn Reflexionen halten. Diese Gallery-Demo fährt WebGPU Screen-Space Reflections mit spatiotemporaler Denoise — GLTF/FBX importieren, HDR/EXR-Himmel tauschen, in Third Person laufen und rohe vs. bereinigte Reflexionen vergleichen.`,
    coverNote: "Das Cover zeigt den Galerieraum mit denoised Reflexionen.",
    whyBullets: [
      "- **Reflexionen, die halten** — SSR mit Denoise statt unscharfem Schlieren",
      "- **Eigenes Modell mitbringen** — GLTF/FBX in die Gallery-Hülle laden",
      "- **Himmel tauschen** — HDR/EXR-Panoramen ändern Stimmung in Sekunden",
      "- **Raum begehen** — Third-Person-Explore für client-taugliches Lesen",
    ],
    whyUses: `Innenraum-Produktviz, Gallery- und Showroom-Pitches, Material-Reviews und WebGPU-R&D-Gespräche über Reflexionsqualität vs. Framerate.`,
    beginner: `Screen-Space Reflections (SSR) faken Spiegel und glänzende Böden, indem sie wiederverwenden, was die Kamera schon sieht, statt eine zweite Welt voll zu rendern. Das kann rauschig wirken. Denoise ist der Cleanup-Pass, der funkelndes Rauschen in eine stabile Reflexion verwandelt — näher an dem, was man von Filmlicht erwartet, weiterhin live.`,
    glossary: [
      {
        term: "WebGPU",
        def: `moderne Browser-GPU-API ([Wikipedia](https://en.wikipedia.org/wiki/WebGPU), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API))`,
      },
      {
        term: "SSR",
        def: "Screen-Space Reflections — glänzende Spiegel aus dem, was auf dem Bildschirm ist",
      },
      {
        term: "Denoise",
        def: "ein Filter, der rauschige Reflexionssamples über Raum/Zeit glättet",
      },
      {
        term: "HDR / EXR",
        def: "High-Dynamic-Range-Umgebungsmaps für Beleuchtung und Himmel",
      },
      {
        term: "Third-person walk",
        def: "eine Figur durch die Gallery bewegen statt nur Free-Fly",
      },
    ],
    trySteps: [
      "Öffnen Sie die [SSR + Denoise Demo](/demos/ssr-denoise/) in Chrome oder Edge",
      "Orbitieren oder laufen, bis Sie eine glänzende Bodenreflexion sehen",
      `Rohe vs. denoised Reflexionen umschalten oder vergleichen, wenn die UI den Schalter bietet`,
      `Optional: kleines GLTF/FBX importieren oder HDR tauschen, um den Raum neu zu beleuchten`,
    ],
    requirements: [
      "**Browser:** Chrome oder Edge mit WebGPU (113+ empfohlen)",
      `**Hardware:** diskrete oder aktuelle integrierte GPU; Qualität senken bei Ruckeln`,
      "**Mobile:** begrenzt — Desktop als erste Erfahrung behandeln",
    ],
    viewA: {
      caption: "Gallery weit — Kunstwände und reflektierender Boden",
    },
    viewB: {
      caption: "Reflexionsdetail — denoised Glanz unter den Lichtern",
    },
    alsoCan: [
      "Custom-Modelle laden, um zu sehen, wie ein Kundenstück im Raum wirkt",
      "Reflexionsqualität in Bewegung vergleichen — Denoise zeigt seinen Wert live",
      `Mit anderen WebGPU-Studien wie Volumetric Lighting auf derselben Site kombinieren`,
    ],
    howWorks: `Ausgangspunkt ist das offizielle three.js [WebGPU SSR + Denoise Beispiel](https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise) ([Quelle auf GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html)). IOM packt diese Pipeline in eine Gallery-Hülle mit Modellimport, HDR/EXR-Swap und Walk-Mode, damit der Effekt client-lesbar ist, nicht nur ein Tech-Sample.`,
    faq: [
      {
        q: "Warum ist die Seite leer oder warnt sie mich?",
        a: `Diese Demo braucht WebGPU. Nutzen Sie einen aktuellen Chrome- oder Edge-Build; Safari und älteres Firefox exponieren die API ggf. noch nicht.`,
      },
      {
        q: "Ist SSR dasselbe wie Ray Tracing?",
        a: `Nein. SSR nutzt das Bildschirmbild wieder; path-traced oder hardware-ray-traced Reflexionen sind ein schwererer Weg. Denoise macht SSR in Echtzeit präsentabler.`,
      },
    ],
    reading: [
      {
        label: "Live SSR + Denoise Demo",
        url: "/demos/ssr-denoise/",
      },
      {
        label: "three.js SSR Denoise Beispiel",
        url: "https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise",
      },
      {
        label: "Beispielquelle auf GitHub",
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
    pageTitle: "Dream — Ocean-Scroll-Narrative",
    demoLabel: "Dream — Ocean scroll",
    hook: `Nicht jedes 3D-Stück soll ein Orbit-Würfel sein. Dream ist eine Scroll-Narrative durch still dunkles Wasser, Regen, ferne Landmassen und Ufer — prozedurale Verzerrung, optionales Ambient-Audio und eine Weather-Runtime mit Himmel, Wolken und Tag/Nacht-Sync. Kapitel 1 von 9; Work in Progress.`,
    coverNote: `Das Cover ist der Dream-Startscreen — Titel, ruhige Zeile und Play-Control vor dem Scroll-Start.`,
    whyBullets: [
      `- **Scroll als Kamera** — Seitenbewegung erzählt das Kapitel, nicht nur Orbit-Drag`,
      "- **Atmosphäre zuerst** — Wasser, Regen und Wetter setzen den emotionalen Beat",
      "- **Audio, das folgt** — optionales Ambient-Crossfade mit den visuellen Kapiteln",
      `- **Serien-Mindset** — Kapitel 1 von 9 signalisiert einen längeren Narrativ-Bogen`,
    ],
    whyUses: `Brand-Story-Landings, Ausstellungs-Web-Begleiter, Folio-Opener und Experimente, bei denen Stimmung und Pacing genauso zählen wie Modelltreue.`,
    beginner: `Statt einer freien Kamera, die Sie selbst fliegen, scrollen Sie — und die Szene schreitet vor wie Seiten in einem Bilderbuch. Wasser- und Wetter-Shader leisten die visuelle Hauptarbeit; Sie lesen mit Daumen oder Mausrad.`,
    glossary: [
      {
        term: "Scroll narrative",
        def: "Story-Beats an Scroll-Position gebunden",
      },
      {
        term: "Procedural distortion",
        def: "Shader-Bewegung, die die Oberfläche ohne Videodatei verformt",
      },
      {
        term: "Weather runtime",
        def: "Himmel, Wolken und Tag/Nacht über Parameter gesteuert",
      },
      {
        term: "Crossfade audio",
        def: "Ambient-Layer mischen sich beim Kapitelwechsel",
      },
    ],
    trySteps: [
      "Öffnen Sie die [Dream — Ocean scroll Demo](/demos/dreams-iom/)",
      `Play auf dem Startscreen tippen, dann langsam durch die ersten Wasser-Beats scrollen`,
      "Bei der schwebenden Figur pausieren — Wellen, Himmel und Wetterstimmung beachten",
      `Wenn Audio in Ihrem Build aktiv ist, entmuten und erneut scrollen für das Crossfade`,
    ],
    requirements: [
      "**Browser:** moderner Chrome/Edge/Firefox mit WebGL",
      "**Motion:** Desktop-Scroll oder Trackpad gibt das beabsichtigte Pacing",
      "**Audio:** optional — manche Browser brauchen Klick vor Soundstart",
    ],
    viewA: {
      caption: "Startscreen — DREAM., ruhige Zeile und Play zum Scroll-Einstieg",
    },
    viewB: {
      caption: "Nach Play — schwebende Figur auf still dunklem Wasser",
    },
    alsoCan: [
      "Als Moodboard für einen längeren Multi-Kapitel-Launch nutzen",
      `Mit der [Three.js Ocean](/blog/threejs-ocean)-Studie für Oberflächentechnik-Kontrast paaren`,
      "Ein gebrandetes Kapitel mit Custom-Copy und Audio-Bed scopen",
    ],
    howWorks: `Die Experience ist ein [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)-Canvas, gesteuert durch Scroll-Position: shader-basiertes Wasser und atmosphärische Pässe aktualisieren sich mit dem Narrativ-Fortschrittswert. Wetter (Himmel, Wolken, Tag/Nacht) ist eine Parameter-Runtime statt gebackenem Video. Live unter [/demos/dreams-iom/](/demos/dreams-iom/).`,
    faq: [
      {
        q: "Ist das fertig?",
        a: `Kapitel 1 von 9 ist der öffentliche Beat — eine Work-in-Progress-Narrative, kein abgeschlossener Film.`,
      },
      {
        q: "Können wir unsere Brand-Story hier platzieren?",
        a: `Ja als scoped Adaptation: Copy, Pacing, Audio und visueller Grade. Kontaktieren Sie uns mit dem Kapitel-Outline.`,
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
        label: "IOM 3D-Bereich",
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
    pageTitle: "Three.js Ocean — Gerstner-Wellen, Himmel und Export",
    demoLabel: "Three.js Ocean",
    hook: `Brauchen Sie eine Hero-Wasserplatte, die Sie in Minuten branden können? Diese Ocean-Demo fährt Gerstner-Wave-Wasser mit prozeduralem Himmel und Sunset-Preset — Glass-3D-Text (Google Fonts) platzieren, dekorative Icons, Wallpaper-Screenshots oder bis zu 30 Sekunden WebGL-Video exportieren.`,
    coverNote: "Das Cover zeigt die Sunset-Ocean-Framing von der 3D-Karte.",
    whyBullets: [
      "- **Lesbares Wasser schnell** — Gerstner-Wellen und Himmel ohne Film-Renderfarm",
      "- **Typ auf dem Wasser** — Glass-3D-Text mit Google Fonts für Titel",
      "- **Sunset-Preset** — One-Click-Stimmung für Pitches und Lockups",
      "- **Takeaways** — Wallpaper-Stills oder kurzer WebGL-Video-Export",
    ],
    whyUses: `Landing-Heroes, Event-Key-Art-Plates, Social-Wallpapers und schnelle „Ocean-Brand-Moment“-Comps vor einem Custom-Water-R&D-Pass.`,
    beginner: `Gerstner-Wellen sind ein Klassiker, um Ozeanschwellen in Echtzeit zu faken — Gipfel und Täler, die mehr nach Wasser aussehen als eine flache Ripple-Textur. Hier liegen sie unter einem prozeduralen Himmel, damit Sie Titel oder Icon komponieren und capturen können.`,
    glossary: [
      {
        term: "Gerstner wave",
        def: "ein mathematisches Schwellenmodell für Echtzeit-Ozeane",
      },
      {
        term: "Procedural sky",
        def: "Himmelsfarbe und Sonne im Shader berechnet, nicht nur Foto-Dome",
      },
      {
        term: "Glass 3D text",
        def: "extrudierter Typ mit refraktivem/transparentem Shading",
      },
      {
        term: "WebGL video export",
        def: "Frames vom Canvas in einen kurzen Clip aufnehmen",
      },
    ],
    trySteps: [
      "Öffnen Sie die [Three.js Ocean Demo](/demos/ocean/)",
      "Orbitieren, bis Horizont und Sonne klar lesen (Sunset-Preset probieren)",
      "Glass-3D-Text / Icons hinzufügen oder bearbeiten, wenn die UI sie bietet",
      "Wallpaper-Screenshot capturen oder kurzen Video-Export starten (≤30s)",
    ],
    requirements: [
      "**Browser:** moderner Chrome/Edge empfohlen für Capture und Export",
      `**GPU:** integrierte Grafik meist ausreichend; Qualität senken, wenn Lüfter hochdrehen`,
      "**Export:** Video-Capture ist schwerer — andere Tabs schließen für sauberen Take",
    ],
    viewA: {
      caption: "Sunset-Ocean — Horizont und Schwellung",
    },
    viewB: {
      caption: "Titel-Lockup — Glass-Text über Wasser",
    },
    alsoCan: [
      "Social-/Wallpaper-Stills ohne Browser-Verlassen erzeugen",
      "Event-Titel prototypen vor Handoff an Motion Design",
      "Technik mit der Scroll-Narrative in [Dream](/blog/iom-three) vergleichen",
    ],
    howWorks: `Aufgebaut auf der three.js Ocean/Water-Linie ([webgl_shaders_ocean Beispielquelle](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html)) mit IOM-UI für Text, Presets, Screenshots und kurze Canvas-Aufnahme. [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) treibt Wasser und Himmel pro Frame; Export ist eine zeitgesteuerte Aufnahme desselben Canvas.`,
    faq: [
      {
        q: "Können wir den Clip kommerziell nutzen?",
        a: `Behandeln Sie die öffentliche Demo als Preview. Fragen Sie uns nach einem lizenzierten oder gebrandeten Export-Paket für Kampagnen.`,
      },
      {
        q: "Ist das dasselbe wie Dream — Ocean scroll?",
        a: `Nein. Das ist eine orbitierbare Ocean-Platte mit Export-Tools; Dream ist ein Scroll-Narrative-Kapitel unter [/demos/dreams-iom/](/demos/dreams-iom/).`,
      },
    ],
    reading: [
      {
        label: "Ocean Demo",
        url: "/demos/ocean/",
      },
      {
        label: "three.js Ocean Beispielquelle",
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
    pageTitle: "The Black Witness — 360° Besuchertour",
    demoLabel: "The Black Witness — 360° Tour",
    hook: `Derselbe Rabe, viele Welten — Stadt, Wald, Berg, Nebel. Diese Besuchervorschau öffnet The Black Witness Tour ohne Editor-Chrome, gerahmt bei Yaw −84,7° und Pitch −6°, mit Hotspots, geführten Schritten und optionaler WebGPU-Atmosphäre.`,
    coverNote: `Das Cover ist geführter Tour-Schritt 1 — The Black Witness Rabe-Hotspot mit geöffnetem Popup.`,
    whyBullets: [
      "- **Besucherorientierter Link** — keine Editor-UI; Gäste sehen nur die Tour",
      `- **Geführte Schritte** — ein Pfad durch die Geschichte, nicht nur freies Umsehen`,
      "- **Hotspots mit Bedeutung** — Info und Sprünge, die beim Erkunden lehren",
      `- **Teilbares Framing** — Deep-Link Yaw/Pitch, damit die erste Ansicht bewusst gesetzt ist`,
    ],
    whyUses: `Ausstellungsbegleiter, Fotoserien-Launches, Messe-Attract-Loops und Kundenproofs, wie eine fertige 360°-Story auf dem Handy oder Laptop wirkt.`,
    beginner: `Sie stehen in einem 360°-Foto. Ziehen zum Umsehen; tippen Sie Marker, um zu lernen oder zum nächsten Ort zu springen. Der Preview-Modus ist das „Gästeticket“ — der Editor ist, wie wir bauen; dieser Link ist, wie Publikum es erlebt.`,
    glossary: [
      {
        term: "Besuchervorschau",
        def: "Tour-Modus ohne Bearbeitungswerkzeuge (`mode=preview`)",
      },
      {
        term: "Yaw / Pitch",
        def: "horizontale und vertikale Blickwinkel für die Startansicht",
      },
      {
        term: "Geführte Tour",
        def: "geordnete Stopps, durch die die Experience voranschreiten kann",
      },
      {
        term: "Hotspot",
        def: "ein antippbarer Marker für Info oder die nächste Szene",
      },
    ],
    trySteps: [
      "Öffnen Sie die [Black Witness Besuchertour](/demos/panorama-360/?mode=preview)",
      "Klicken Sie **Play guided tour** — vier Kamera-Stopps mit Popups und Effekten",
      "Öffnen Sie nach dem Stoppen der Tour selbst einen Hotspot",
      "Teilen Sie die Preview-URL, damit Kollegen dieselbe Experience landen",
    ],
    requirements: [
      `**Browser:** moderner Mobile- oder Desktop-Browser; WebGPU-Effekte brauchen ein leistungsfähiges Gerät`,
      "**Netzwerk:** Panoramen sind bildlastig — Wi‑Fi für den ersten Load bevorzugen",
      "**Input:** Touch-Ziehen oder Maus; Headset nicht erforderlich",
    ],
    viewA: {
      caption: "Schritt 2 — animierter Feuer-Hotspot und Partikel-Popup",
    },
    viewB: {
      caption: "Schritt 3 — Wasser-/Spout-Beat auf dem Dach",
    },
    viewC: {
      caption: "Schritt 4 — Animierter Vögel-Popup mit der Schar gegen den Sturmhimmel",
    },
    alsoCan: [
      "Zum [Editor](/demos/panorama-360/) springen, wenn Sie Hotspots authorn müssen",
      `Das Deep-Link-Muster für gebrandete Erstansichten in anderen Projekten wiederverwenden`,
      `Dem Effekt-Stack folgen: [Particles](/blog/webgpu-particles) → [Spout](/blog/spout) → [Birds](/blog/webgpu-compute-birds)`,
    ],
    howWorks: `Preview nutzt dieselbe Panorama-Engine wie der [360° Tour Editor](/blog/panorama-360-tour), aber URL-Flags verbergen Authoring-Chrome und setzen die Startkamera (\`yaw\`, \`pitch\`). Hotspots und geführte Schritte sind Projektdaten über equirectangular Szenen — [Three.js](https://threejs.org/) für Kamera und Kugel, optionale [WebGPU](https://en.wikipedia.org/wiki/WebGPU)-Layer für Atmosphäre. Bei The Black Witness legt Schritt 2 [Particles](/blog/webgpu-particles), Schritt 3 [Spout](/blog/spout) und Schritt 4 [Birds](/blog/webgpu-compute-birds) — jeweils mit Hotspot+Popup, damit Gäste Bewegung zu einem klickbaren Story-Beat bekommen.`,
    faq: [
      {
        q: "Warum startet meine Ansicht in eine bestimmte Richtung?",
        a: `Der Link setzt Yaw −84,7° und Pitch −6°, damit alle dieselbe Eröffnungskomposition teilen.`,
      },
      {
        q: "Kann ich Hotspots über diese URL bearbeiten?",
        a: `Nicht in Preview. Nutzen Sie den [Tour Editor](/demos/panorama-360/) (oder fragen Sie uns nach einem Production-Authoring-Build).`,
      },
      {
        q: "Was sind die Effekt-Layer in Schritten 2–4?",
        a: `Schritt 2 Particles, Schritt 3 Spout/Wasser, Schritt 4 Birds — jeweils mit Hotspot-Popup. Die standalone Experiment-Seiten dokumentieren dieselbe Tech.`,
      },
    ],
    reading: [
      {
        label: "Besuchertour-Link",
        url: "/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6",
      },
      {
        label: "Tour Editor",
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
    pageTitle: "CSS3D Sprites — HTML im 3D-Raum",
    demoLabel: "CSS3D Sprites",
    hook: `Fünfhundertzwei HTML-Elemente schweben als Sprites — und morphen zwischen Ebene, Würfel, Wolke und Kugel. Das ist Three.js CSS3DRenderer: echte DOM-Knoten im Kameraraum, nicht nur texturierte Quads.`,
    coverNote: `Das Cover zeigt die Sprite-Wolke mitten im Morph — HTML-Kacheln lesen sich als 3D-Formation.`,
    whyBullets: [
      "- **DOM trifft Tiefe** — echte HTML/CSS-Inhalte, die trotzdem in 3D kreisen",
      `- **Morph-Storytelling** — Ebene → Würfel → Wolke → Kugel verkauft „Daten werden Form“`,
      `- **Bewegung ohne Game Engine** — pulsierende Skalierung und Übergänge im Browser`,
      "- **UI-Prototyp im Raum** — Karten, Labels oder Fotos als räumliche Layouts",
    ],
    whyUses: `räumliche UI-Sketches, Portfolio-„Partikel aus Karten“-Momente und Kundendemos, bei denen Inhalt lesbares HTML bleiben muss.`,
    beginner: `Stellen Sie sich Foto-Thumbnails oder farbige Kacheln in einem Raum vor, den Sie drehen können. Jede Kachel ist noch ein normales Webseiten-Element — nur im 3D positioniert. Wenn sich die Form ändert, fliegen die Kacheln wie ein choreografierter Schwarm an neue Plätze.`,
    glossary: [
      {
        term: "CSS3DRenderer",
        def: "Three.js-Pfad, der HTML-Elemente mit CSS-3D-Transforms positioniert",
      },
      {
        term: "Sprite",
        def: "ein flaches Element, das der Szene als billboard-artige Einheit zugewandt ist",
      },
      {
        term: "Morph",
        def: "animierter Übergang der Positionen von einer Formation zur nächsten",
      },
      {
        term: "WebGL camera",
        def: "dieselbe 3D-Kamera-Mathematik wie in WebGL-Szenen, die CSS-Transforms antreibt",
      },
    ],
    trySteps: [
      "Öffnen Sie die [CSS3D Sprites Demo](/demos/css3d-sprites/)",
      "Ziehen zum Orbitieren; beobachten Sie das pulsierende Formation",
      `Formwechsel auslösen (Ebene, Würfel, Random, Kugel), falls Buttons oder UI vorhanden`,
      "Hineinzoomen, bis einzelne HTML-Sprites scharf bleiben — das ist der DOM-Vorteil",
    ],
    requirements: [
      "**Browser:** moderner Chrome, Edge, Firefox oder Safari mit CSS-3D-Transforms",
      `**GPU:** leichte Last im Vergleich zu schwerem WebGPU-Compute — gut auf den meisten Laptops`,
      "**Hinweis:** CSS3D + Three.js-Kamera-Math, kein WebGPU-Compute-Demo",
    ],
    viewA: {
      caption: "Kugel- oder Würfelformation — Sprites lesen sich als solides Volumen",
    },
    viewB: {
      caption: "Wolke / Random-Streuung — Tiefe und Parallax der HTML-Kacheln",
    },
    alsoCan: [
      "Sprite-Inhalt gegen Bilder, Labels oder Markenfarben tauschen",
      "Morphs als Sektionsübergänge in einer Pitch-Site nutzen",
      `Mit dem upstream [three.js css3d_sprites](https://threejs.org/examples/#css3d_sprites)-Beispiel vergleichen`,
    ],
    howWorks: `Three.js treibt eine gemeinsame Kamera; [CSS3DRenderer](https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer) mappt Objektmatrizen auf CSS-\`transform\` an DOM-Knoten. Formationen sind Zielpositionen; Animation interpoliert jeden Sprite zur nächsten Anordnung. Upstream-Referenz: [css3d_sprites](https://threejs.org/examples/#css3d_sprites) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/css3d_sprites.html)). Anders als WebGPU-Partikelsysteme ist die Arbeit hier Layout + CSS-Compositing statt Compute Shaders.`,
    faq: [
      {
        q: "Ist das WebGL oder WebGPU?",
        a: `Weder als Hauptpfad — Sprites sind HTML via CSS3D. Three.js nutzt trotzdem 3D-Kamera-Math aus WebGL-Szenen.`,
      },
      {
        q: "Können wir echte Produktkarten in die Wolke legen?",
        a: `Ja prinzipiell — jeder Sprite kann reicheres HTML halten. Wir scopen Performance und Lesbarkeit für Kundenbuilds.`,
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
    pageTitle: "Shape Particles — WebGPU Compute Physics",
    demoLabel: "Shape Particles",
    hook: `Tausende Partikel schnappen in Würfel, Kugel, Torus, Herz — dann lässt Release sie unter GPU-Gravitation mit Boden-Bounce fallen. WebGPU Compute hält die Simulation auf der Grafikkarte.`,
    coverNote: "Das Cover zeigt ein Shape-Preset in Formation vor dem Drop.",
    whyBullets: [
      `- **Formation → Chaos → Reform** — eine klare Story für Produkt- oder Markenmotion`,
      "- **Compute auf der GPU** — Physik-Schritte ohne Blockieren des Main Threads",
      "- **Shape-Presets** — Würfel, Kugel, Torus, Kegel, Pyramide, Ring, Herz",
      "- **Interaktiver Proof** — Release und Reset verkaufen die Idee in einem Klick",
    ],
    whyUses: "Launch-Teaser, Messe-Loops und „unsere Daten werden diese Form“-Pitch-Momente.",
    beginner: `Stellen Sie sich magnetischen Sand vor, der eine logoartige Form halten kann, dann fällt, wenn Sie loslassen — und bei Reset zurück in die Form springt. Der Unterschied ist Geschwindigkeit: die GPU aktualisiert jedes Partikel, damit es flüssig bleibt.`,
    glossary: [
      {
        term: "WebGPU",
        def: "moderne Browser-GPU-API (neuer als WebGL) für Compute und Rendering",
      },
      {
        term: "Compute shader",
        def: `GPU-Programm, das Daten (Positionen, Geschwindigkeiten) ohne Dreiecke zu zeichnen aktualisiert`,
      },
      {
        term: "TSL",
        def: "Three.js Shading Language — knotenbasierte GPU-Logik in JS",
      },
      {
        term: "Formation",
        def: "Zielpositionen, die Partikel als solide Form lesen lassen",
      },
    ],
    trySteps: [
      "Öffnen Sie die [Shape Particles Demo](/demos/compute-particles/)",
      "Wählen Sie ein Shape-Preset und orbitieren Sie die Formation",
      "Drücken Sie Release — beobachten Sie Gravitation und Boden-Bounce",
      "Drücken Sie Reset zur Reform; probieren Sie eine andere Form",
    ],
    requirements: [
      "**Browser:** Chrome oder Edge mit WebGPU aktiviert (aktuelle Versionen)",
      "**GPU:** diskrete oder aktuelle integrierte GPU für dichte Counts empfohlen",
      "**Fallback:** ohne WebGPU sehen Sie eine Capability-Meldung — kein WebGL-Port",
    ],
    viewA: {
      caption: "Gehaltene Formation — Partikel lesen sich als solides Preset-Shape",
    },
    viewB: {
      caption: "Nach Release — Spray und Bounce auf der Bodenebene",
    },
    alsoCan: [
      "Presets für einen kurzen Brand-Loop durchwechseln",
      "Count / Look für Messe vs. Laptop-Performance tunen",
      `Mit [three.js webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles) vergleichen`,
    ],
    howWorks: `Ein [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)-Compute-Pass aktualisiert Partikel-State pro Frame; der Renderer zeichnet das Ergebnis. Three.js exponiert das über WebGPU Renderer und TSL Compute Nodes. Upstream: [webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_particles.html)). WebGL kann auch Partikel zeichnen, aber Gravitation und Reform-Loop dieser Demo sind für WebGPU Compute gebaut.`,
    faq: [
      {
        q: "Warum sagt mein Browser, WebGPU fehlt?",
        a: `Dieses Experiment braucht WebGPU. Nutzen Sie aktualisierten Chrome oder Edge; Safari/Firefox-Support variiert je Version.`,
      },
      {
        q: "Können die Partikel unser Logo formen?",
        a: `Custom Target Meshes oder Point Clouds sind ein natürlicher nächster Schritt — fragen Sie uns nach einem scoped Build.`,
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
    pageTitle: "WebGPU Spotlight — texturierte Strahlen und Schatten",
    demoLabel: "WebGPU Spotlight",
    hook: `Ein Spot Light wie ein theatralisches Fixture — Textur im Kegel projiziert, weiche Penumbra, Decay und fokussierte Schatten — auf Three.js WebGPU mit dem klassischen Lucy-Scan als Subjekt.`,
    coverNote: `Das Cover zeigt Lucy unter dem beweglichen Spotlight auf schattenempfangendem Boden.`,
    whyBullets: [
      "- **Showroom-Beleuchtungssprache** — Kegel, Falloff und gobo-artige Texture Maps",
      "- **Echte Schatten** — Kontakt am Boden verkauft Tiefe für Produkt und Skulptur",
      "- **WebGPU-Materialpfad** — moderne Three.js-Beleuchtung, kein gebackenes GIF",
      "- **Helpers on demand** — Licht visualisieren beim Tuning",
    ],
    whyUses: `Produkt-Turntables, Galerie-Studien und Beleuchtungs-Pitches vor einer vollen Production-Szene.`,
    beginner: `Ein Spotlight ist ein Lichtkegel, wie eine Bühnenlampe. Hier sehen Sie die weiche Kante des Kegels, wie Helligkeit mit der Entfernung abfällt und wie der Schatten der Skulptur auf dem Boden liegt — alles live im Browser.`,
    glossary: [
      {
        term: "Spotlight",
        def: "Licht mit Kegelwinkel, Ausrichtung und optionaler Textur im Strahl",
      },
      {
        term: "Penumbra",
        def: "die weiche Kante des Lichtkegels",
      },
      {
        term: "Decay",
        def: "wie schnell Intensität mit der Entfernung abfällt",
      },
      {
        term: "WebGPU",
        def: "die neuere Browser-GPU-API dieses Three.js-Renderer-Pfads",
      },
    ],
    trySteps: [
      "Öffnen Sie die [WebGPU Spotlight Demo](/demos/webgpu-spotlight/)",
      "Orbitieren Sie um Lucy; beobachten Sie den beweglichen Spot und Bodenschatten",
      "Licht-Helpers togglen, falls verfügbar, um den Kegel zu sehen",
      "Penumbra und Focus beachten — weiche Kante vs. scharfer Schatten als Trade-offs",
    ],
    requirements: [
      `**Browser:** Chrome oder Edge mit WebGPU (nicht das ältere WebGL-Lights-Beispiel)`,
      "**GPU:** jede aktuelle Laptop-GPU reicht meist für diese Szene",
      `**Model:** Lucy PLY ist enthalten — schwere Custom Meshes brauchen ggf. Optimierung`,
    ],
    viewA: {
      caption: "Dreiviertel — Kegellicht auf Lucy und Boden lesbar",
    },
    viewB: {
      caption: "Shadow Focus — Kontaktschatten und Penumbra am Boden",
    },
    alsoCan: [
      "Gobo-/Projektionstexturen für Markenmuster tauschen",
      "Mit volumetrischen Demos für „Strahl in der Luft“-Stimmung paaren",
      `Das upstream [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight)-Beispiel studieren`,
    ],
    howWorks: `Three.js \`WebGPURenderer\` evaluiert Spot Lights mit Maps, Penumbra, Decay und Shadow Maps in der WebGPU-Pipeline. Die Szene orbitiert einen animierten Spot über Lucy PLY auf einer empfangenden Ebene. Offizielles Beispiel: [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_lights_spotlight.html)). WebGL hat klassische Spotlight-Beispiele; diese Seite folgt speziell dem WebGPU-Lights-Pfad.`,
    faq: [
      {
        q: "Ist das dasselbe wie volumetrische God Rays?",
        a: `Nein — das ist Oberflächenbeleuchtung und Schatten. Für Strahlen in der Luft siehe unsere volumetrische Beleuchtung.`,
      },
      {
        q: "Können wir unser eigenes Produkt beleuchten?",
        a: `Ja. Lucy durch ein GLB ersetzen und Exposure matchen ist ein typischer Kunden-Nächstschritt.`,
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
    pageTitle: "WebGPU Compute Birds — GPU Flocking",
    demoLabel: "WebGPU Compute Birds",
    hook: `Achttausend Vögel flocken im Browser — Separation, Alignment und Cohesion auf der GPU berechnet. Bewegen Sie die Maus, um die Schar zu stören; Verhalten live tunen.`,
    coverNote: "Das Cover zeigt die instanzierte Schar als kohärente Murmuration.",
    whyBullets: [
      "- **Klassische Boids, moderne GPU** — Reynolds-Regeln in interaktivem Maßstab",
      "- **Instancing** — ein Mesh, tausende Vögel",
      "- **Pointer-Störung** — Stakeholder spüren Agency in Sekunden",
      "- **WebGPU Compute** — Simulation bleibt vom CPU Main Thread weg",
    ],
    whyUses: `naturinspirierte Markenmomente, Wissenschafts-Explainer-UIs und Stress-Tests für GPU-Compute-Pipelines.`,
    beginner: `Vögel in einer Schar folgen einfachen Regeln: nicht crashen, Nachbarn angleichen, bei der Gruppe bleiben. Multiplizieren Sie das mit Tausenden und Sie bekommen eine Murmuration. Hier laufen diese Regeln auf der Grafikkarte, damit die Bewegung flüssig bleibt.`,
    glossary: [
      {
        term: "Boids",
        def: "klassisches Flocking-Modell: Separation, Alignment, Cohesion",
      },
      {
        term: "Instancing",
        def: "viele Kopien eines Meshes effizient zeichnen",
      },
      {
        term: "Compute",
        def: "GPU-Arbeit, die Vogelpositionen/Geschwindigkeiten pro Frame aktualisiert",
      },
      {
        term: "WebGPU",
        def: "API hier statt älterer WebGL-only GPGPU-Tricks",
      },
    ],
    trySteps: [
      "Öffnen Sie die [WebGPU Compute Birds Demo](/demos/webgpu-compute-birds/)",
      "Beobachten Sie, wie die Schar in kohärente Bewegung übergeht",
      "Bewegen Sie die Maus durch die Schar, um sie zu stören",
      "Öffnen Sie Birds settings und tunen Sie Separation / Alignment / Cohesion",
    ],
    requirements: [
      "**Browser:** WebGPU-fähiger Chrome oder Edge empfohlen",
      "**GPU:** Mittelklasse oder besser für 8k Instanzen bei flüssigen Frame Rates",
      "**Not WebGL:** der Compute-Flocking-Pfad zielt auf WebGPU",
    ],
    viewA: {
      caption: "Weite Murmuration — Schar liest sich als ein Volumen",
    },
    viewB: {
      caption: "Näherer Pass — instanzierte Vögel und Flugrichtung",
    },
    alsoCan: [
      "Kräfte für ruhigere vs. chaotische Markenstimmungen retunen",
      "Als Hintergrund-Layer hinter UI nutzen (Kontrast beachten)",
      `Die Schar in einen [360° guided tour](/demos/panorama-360/) Himmel-Beat legen (Schritt 4)`,
      `Mit [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) auf threejs.org vergleichen`,
    ],
    howWorks: `Pro Frame wendet ein WebGPU-Compute-Pass Flocking-Kräfte an und schreibt neue Transforms; instanced drawing rendert die Vögel. Upstream: [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_birds.html)). Ältere WebGL-„GPGPU birds“-Beispiele existieren in three.js History; diese IOM-Seite folgt der WebGPU-Compute-Edition.`,
    tourBridge: {
      step: 4,
      stepLabel: "Geführte Tour Schritt 4 — Birds-Layer + Hotspot-Popup bei The Black Witness",
      body: `In der [360° Panorama Tour](/demos/panorama-360/) ist **Schritt 4** als \`cam · +birds · hotspot+popup\` authored: die Kamera kippt zum Himmel, der WebGPU Birds-Layer bringt die Atmosphäre zum Leben, und ein Hotspot/Popup hält die Story klickbar.

Standalone Flocking beweist die Tech; die Tour beweist das **Produktmuster** — lebendige GPU-Layer, getimed zu einem geführten Stopp, damit Gäste Bewegung *und* trotzdem Ziehen zum Umsehen und Tippen zum Lernen spüren. Frühere Beats nutzen [WebGPU Particles](/blog/webgpu-particles) (Schritt 2) und [Spout](/blog/spout) (Schritt 3) auf dieselbe Weise.`,
    },
    faq: [
      {
        q: "Warum so viele Vögel?",
        a: `Skala ist der Punkt — Compute + Instancing zeigen, was WebGPU interaktiv tragen kann.`,
      },
      {
        q: "Können Vögel einem Pfad oder Logo folgen?",
        a: "Guiding Fields und Attractors sind gängige Erweiterungen für Kundenstories.",
      },
      {
        q: "Wo erscheinen die Vögel in der 360° Tour?",
        a: `Geführter Tour-Schritt 4 bei The Black Witness — Birds-Layer mit Hotspot-Popup. Öffnen Sie /demos/panorama-360/ und Play guided tour.`,
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
    pageTitle: "WebGPU Parallax UV — Tiefe in einer flachen Textur",
    demoLabel: "WebGPU Parallax UV",
    hook: `Eis, das dicker wirkt als eine flache Ebene — TSL-Parallax-UV verschiebt geschichtete ambientCG-Maps mit Displacement, Normalen und Rauheit unter HDR-Licht.`,
    coverNote: `Das Cover zeigt den Eisboden mit Parallax-Tiefe, wenn die Kamera die Oberfläche streift.`,
    whyBullets: [
      `- **Scheinbare Tiefe, echte Einsparungen** — Tiefenwirkung ohne schweres skulptiertes Mesh`,
      "- **TSL-Materialien** — moderne Three.js-Node-Materialien auf WebGPU",
      "- **PBR-Stack** — Albedo, Normal, Rauheit und Displacement im Zusammenspiel",
      "- **HDR-Umgebung** — Reflexionen, die gefrorenes Material glaubwürdig machen",
    ],
    whyUses: `Materialstudien, Bodenebenen für Produktaufnahmen und „Liest sich dieser Shader?“-Reviews.`,
    beginner: `Ein normales Eisfoto ist flach. Parallax UV täuscht das Auge: Wenn Sie die Kamera bewegen, verschiebt sich die Textur leicht, als läge Tiefe unter der Oberfläche — wie ein Blick in klares Eis, ohne jede Risslinie zu modellieren.`,
    glossary: [
      {
        term: "Parallax mapping",
        def: "UV-Versatz basierend auf Blickwinkel und einer Höhen-/Displacement-Map",
      },
      {
        term: "TSL",
        def: "Three.js Shading Language für node-basierte GPU-Materialien",
      },
      {
        term: "PBR",
        def: "physically based rendering — Rauheit/Metalness-Materialmodell",
      },
      {
        term: "HDR environment",
        def: "High-Dynamic-Range-Bild, das die Szenenreflexionen beleuchtet",
      },
    ],
    trySteps: [
      "Öffnen Sie die [WebGPU Parallax UV Demo](/demos/webgpu-parallax-uv/)",
      `Orbitieren Sie flach über das Eis — beobachten Sie die Tiefenverschiebung mit dem Winkel`,
      "Vergleichen Sie Streif- mit Draufsicht",
      "Beachten Sie, wie Normalen und Rauheit den Gefrierlook unter HDR verändern",
    ],
    requirements: [
      "**Browser:** WebGPU (Chrome/Edge empfohlen)",
      "**Texturen:** ambientCG-Maps sind enthalten; Netzwerk hilft beim ersten Laden",
      `**GPU:** leicht bis moderat — schwerer als eine flache unbeleuchtete Ebene, leichter als vollständige Compute-Schwärme`,
    ],
    viewA: {
      caption: "Streifwinkel — Parallax-Tiefe in der Eisebene",
    },
    viewB: {
      caption: "Höhere Sicht — geschichtete Maps und HDR-Reflexion lesbar",
    },
    alsoCan: [
      "Maps auf Stein, Holz oder Markenmaterialien umzielen",
      "Als Boden unter einem Produkt-GLB nutzen",
      "[webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv) studieren",
    ],
    howWorks: `Ein TSL-Material sampelt Höhe/Displacement, um UVs nach Blickrichtung zu verschieben (Parallax), und schichtet Farbe, Normal und Rauheit. WebGPURenderer führt den Node-Graphen aus. Upstream: [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv) ([Quelle](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_parallax_uv.html)). Klassische WebGL-Parallax-Shader existieren; diese Demo folgt dem WebGPU- + TSL-Pfad.`,
    faq: [
      {
        q: "Ist das Eis ein echtes 3D-Volumen?",
        a: "Nein — es ist eine schattierte Ebene. Parallax täuscht Tiefe im Material vor.",
      },
      {
        q: "Können wir unser eigenes Texture-Set nutzen?",
        a: "Ja. Passende Map-Namen und Stärke sind ein Standard-Materialtausch.",
      },
    ],
    reading: [
      {
        label: "three.js — Parallax UV",
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
    pageTitle: "WebGPU TSL Raging Sea — prozedurale Wellen",
    demoLabel: "TSL Raging Sea",
    hook: `Ein stürmisches Meer ohne Ozeansimulator — geschichtete Sinuswellen und fraktale Noise verschieben eine dichte Ebene, mit berechneten Normalen und emissiven Kämmen, alles in TSL auf WebGPU.`,
    coverNote: "Das Cover zeigt hohe See mit hellen Kamm-Highlights.",
    whyBullets: [
      `- **Prozedurales Wasser** — kein gebackenes Flipbook; Parameter steuern die Stimmung`,
      "- **TSL-Displacement** — Wellen-Math lebt im Materialgraphen",
      `- **Kamm-Energie** — emissive Highlights verkaufen Schaum und Gischt ohne Partikel`,
      "- **WebGPU-Pfad** — moderne Three.js-Ozeanskizze für Pitches und F&E",
    ],
    whyUses: `Umgebungs-Hintergründe, maritimer Produktkontext und Shader-F&E vor FFT-Ozeansystemen.`,
    beginner: `Das „Meer“ ist ein flaches Gitter, das die GPU jeden Frame mit Mathematik hoch und runter schiebt — große rollende Wellen plus kleinere Chop. Beleuchtung an den Hängen lässt es wie Wasser statt wie ein faltiges Blatt wirken.`,
    glossary: [
      {
        term: "Displacement",
        def: "Verschiebung von Mesh-Vertices (oder Shading) mit einer Höhenfunktion",
      },
      {
        term: "Fractal noise",
        def: "geschichtetes Noise für natürlich wirkende Details",
      },
      {
        term: "TSL",
        def: "Three.js Shading Language zur Authoring des Wellengraphen",
      },
      {
        term: "Normals",
        def: "Oberflächenrichtungen für Beleuchtung; aus den Wellen neu berechnet",
      },
    ],
    trySteps: [
      "Öffnen Sie die [TSL Raging Sea Demo](/demos/webgpu-tsl-raging-sea/)",
      "Orbitieren und beobachten Sie große Dünungen gegen kleines Chop",
      "Suchen Sie emissive Kämme auf Wellengipfeln",
      "Vergleichen Sie die Stimmung mit unseren anderen Ozean-Experimenten auf der Site",
    ],
    requirements: [
      "**Browser:** WebGPU erforderlich für dieses TSL-WebGPU-Beispiel",
      "**GPU:** dichtere Ebenen kosten mehr — Pixel-Ratio senken bei Ruckeln",
      "**Kein WebGL-Ozean:** unterscheidet sich von klassischen WebGL-Wasser-/FFT-Demos",
    ],
    viewA: {
      caption: "Weite Sturmsee — geschichtete Dünungen lesbar in der Ferne",
    },
    viewB: {
      caption: "Kammdetail — Normalen und emissive Highlights",
    },
    alsoCan: [
      "Amplitude und Noise für ruhigen Hafen vs. Sturm neu einstellen",
      "Als skybox-naher Hintergrund unter einem Produkt nutzen",
      `[webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) upstream öffnen`,
    ],
    howWorks: `Vertex- (oder äquivalentes TSL-)Displacement summiert große Sinuswellen mit fraktalem Noise; Normalen werden abgeleitet, damit Beleuchtung auf Hängen reagiert; Kämme erhalten emissive Anhebung. Läuft auf Three.js WebGPU + TSL. Upstream: [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) ([Quelle](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_raging_sea.html)). Für spektrumbasierte Meere siehe dedizierte FFT-Ozean-Arbeit anderswo bei IOM — andere Technik, oft WebGL oder hybrid.`,
    faq: [
      {
        q: "Ist das eine vollständige Ozeansimulation?",
        a: "Nein — prozedurales Displacement. Ideal für Look Development; kein CFD.",
      },
      {
        q: "WebGL oder WebGPU?",
        a: `WebGPU via Three.js TSL. Breitere Geräteabdeckung bevorzugt ggf. noch WebGL-Ozeane.`,
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
    pageTitle: "WebGPU TSL Linked Particles — gezeichnete VFX-Spuren",
    demoLabel: "TSL Linked Particles",
    hook: `Bewegen Sie den Zeiger, um eine leuchtende Partikelspur zu erzeugen — GPU-Compute, Turbulenz, Nachbarschafts-Link-Bänder, Farbtonrotation und Bloom. Eine TSL-VFX-Skizze, die man spürt.`,
    coverNote: "Das Cover zeigt verknüpfte Partikelbänder mit Bloom.",
    whyBullets: [
      "- **Zeiger als Pinsel** — sofortiges „Probieren“ für Kunden im Call",
      "- **Links zwischen Nachbarn** — Netzwerk-/Synapsen-/Sternbild-Sprache",
      "- **Compute + TSL** — Spawn, Turbulenz und Lebensdauer auf der GPU",
      "- **Bloom-Finish** — weicher Glow, der auf dunklen UIs premium wirkt",
    ],
    whyUses: "Hero-Hintergründe, interaktive Messe-Momente und Tech-Marken-Visuelsysteme.",
    beginner: `Sie zeichnen mit Licht: Partikel erscheinen unter dem Cursor, treiben mit Turbulenz, und dünne Linien verbinden nahe Punkte — wie ein Sternbild, das Ihre Geste einen Moment lang behält.`,
    glossary: [
      {
        term: "Nearest-neighbor links",
        def: "Linien zwischen Partikeln, die im Raum nah beieinander liegen",
      },
      {
        term: "Turbulence",
        def: "rauschendes Kraftfeld, das Partikelbewegung wirbelt",
      },
      {
        term: "Bloom",
        def: "Post-Process-Glow um helle Pixel",
      },
      {
        term: "TSL VFX",
        def: "Effekte, autorisiert mit Three.js Shading Language Nodes",
      },
    ],
    trySteps: [
      "Öffnen Sie die [TSL Linked Particles Demo](/demos/webgpu-tsl-linked-particles/)",
      "Bewegen Sie den Zeiger über die Leinwand, um Spuren zu zeichnen",
      `Pausieren und beobachten Sie Links und Farbtonwechsel, während Partikel ausklingen`,
      "Orbitieren falls aktiv; Bloom bei hellen Clustern beachten",
    ],
    requirements: [
      "**Browser:** WebGPU (Chrome/Edge empfohlen)",
      `**GPU:** Bloom + Compute brauchen etwas Headroom — schwere Tabs schließen bei Bedarf`,
      "**Input:** Maus oder Trackpad; Touch variiert je nach Gerät",
    ],
    viewA: {
      caption: "Dichter linker Cluster — magenta Links mit cyan Akzenten",
    },
    viewB: {
      caption: "Näheres Mesh — geblühte Knoten und Nachbarbänder",
    },
    alsoCan: [
      "Zeiger auf Touch / Wand für Installationen mappen",
      "Farbtonzyklus auf Markenpalette umstellen",
      `[webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles) vergleichen`,
    ],
    howWorks: `WebGPU-Compute spawnt und advektiert Partikel; TSL-Materialien rendern Sprites/Bänder; ein Link-Pass verbindet nahe Partikel; Bloom post-prozessiert den Frame. Upstream: [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles) ([Quelle](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_vfx_linkedparticles.html)). WebGL-Liniennetze (siehe draw-range) sind eine verwandte visuelle Idee mit anderer, breiter unterstützter Pipeline.`,
    faq: [
      {
        q: "Ist das dasselbe wie die Shape-Particles-Demo?",
        a: `Nein — jene bildet solide Presets und Gravitation. Diese ist zeigergezeichnetes VFX mit Links und Bloom.`,
      },
      {
        q: "Können wir es für einen ruhigen Markenfilm verlangsamen?",
        a: "Ja — Spawn-Rate, Turbulenz und Bloom-Schwellen sind typische Regler.",
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
    pageTitle: "WebGPU Custom Fog Scattering — durch den Dunst gehen",
    demoLabel: "Custom Fog Scattering",
    hook: `Ein Spaziergang in Ego-Perspektive durch prozedurale Kiefernsilhouetten in kühlem exponentiellem Nebel — TSL-dichtebasiertes Streuungs-Blur, das die Ferne wie feuchte Luft weichzeichnet.`,
    coverNote: "Das Cover zeigt Kiefernformen, die im gestreuten Nebel auflösen.",
    whyBullets: [
      "- **Atmosphäre als Subjekt** — Stimmung zuerst, Geometrie zweitens",
      "- **Streuungs-Blur** — Ferne wird weicher wie feuchte Luft",
      "- **Einstellbare Dichte** — Nebel und Streuung als Designregler",
      `- **WebGPU + TSL** — individueller Nebel jenseits einer einzelnen scene.fog-Farbe`,
    ],
    whyUses: "Umgebungs-Pitches, spielartige Walkthroughs und „Wetter als Marke“-Studien.",
    beginner: `Nebel ist nicht nur ein grauer Farbton. In feuchter Luft wirken entfernte Bäume weicher und milchiger. Diese Demo führt Sie durch dieses Gefühl — Silhouetten von Kiefern, die in einen kühlen Dunst übergehen, den Sie verdicken oder verdünnen können.`,
    glossary: [
      {
        term: "Exponential fog",
        def: "Nebel, der mit der Entfernung gleichmäßig zunimmt",
      },
      {
        term: "Scattering",
        def: "Lichtstreuung im Medium — hier als Blur/Weichzeichnung approximiert",
      },
      {
        term: "First-person",
        def: "Kamera bewegt sich, als würden Sie durch die Szene gehen",
      },
      {
        term: "TSL",
        def: "Node-Shading zur Anpassung des Nebelverhaltens auf WebGPU",
      },
    ],
    trySteps: [
      `Öffnen Sie die [Custom Fog Scattering Demo](/demos/webgpu-custom-fog-scattering/)`,
      "Gehen oder schauen Sie sich im Kiefernfeld um",
      `Erhöhen Sie die Nebeldichte — beobachten Sie, wie die Ferne im Dunst verschwindet`,
      "Streuungsfaktor einstellen und scharfe vs. weiche ferne Bäume vergleichen",
    ],
    requirements: [
      "**Browser:** WebGPU-fähiger Chrome oder Edge",
      "**Steuerung:** Tastatur / Zeiger wie in der Demo-UI implementiert",
      "**GPU:** komfortabel auf modernen Laptops; Auflösung senken bei Motion Blur",
    ],
    viewA: {
      caption: "Tiefer gehen — dichtere Stämme, während der Dunst zunimmt",
    },
    viewB: {
      caption: "Nah am Stamm — Streuung weichzeichnet den Wald dahinter",
    },
    alsoCan: [
      "Nebel für Morgen-/Nacht-Markenstimmungen umfärben",
      "Silhouetten gegen Architekturmassen tauschen",
      `[webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering) lesen`,
    ],
    howWorks: `Prozedurale baumähnliche Silhouetten sitzen in einer WebGPU-Szene; TSL implementiert dichteabhängigen Nebel und ein Streuungs-Blur, damit entfernte Struktur weicher wird. Upstream: [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering) ([Quelle](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_custom_fog_scattering.html)). Standard-WebGL \`FogExp2\` ist einfacher; dieses Experiment zeigt eine individuelle Streuungsbehandlung auf dem WebGPU-Stack.`,
    faq: [
      {
        q: "Ist das volumetrische Beleuchtung?",
        a: `Verwandte Stimmung, andere Technik — hier liegt der Fokus auf Nebel/Streuung durch einen begehbaren Wald, nicht auf rect-area God Rays.`,
      },
      {
        q: "Können wir ein echtes Standortmodell nutzen?",
        a: `Ja als scoped Integration — Silhouetten durch vereinfachte Architektur-LODs ersetzen.`,
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
    pageTitle: "WebGPU Curve Modifier — Text entlang einer Spline",
    demoLabel: "WebGPU Curve Modifier",
    hook: `Extrudierter Text, der entlang einer geschlossenen Catmull-Rom-Spline fließt — ziehen Sie Kontrollpunkte und das Mesh deformiert mit dem Pfad. Ein WebGPU-Ansatz für Kurvenmodifikatoren bei Logos und Typografie.`,
    coverNote: "Das Cover zeigt Buchformen, die entlang der editierbaren Kurve gebogen sind.",
    whyBullets: [
      "- **Typografie als Geometrie** — Logos und Headlines, die auf einem Pfad leben",
      "- **Live-Handles** — die Story vor dem Kunden umformen",
      "- **Geschlossene Spline** — Loops für endlose Messe-Bewegung",
      `- **Passt zu Pfad-Tools** — dieselbe Familie wie Spline-Editoren und Kamera-Rails`,
    ],
    whyUses: "animierte Logos, Ausstellungstitel und pfadgeführte Produkt-Callouts.",
    beginner: `Stellen Sie sich flexible Kühlschrankmagnet-Buchstaben entlang eines gebogenen Drahts vor. Bewegen Sie die Kontrollpunkte des Drahts und die Buchstaben gleiten und biegen sich mit. Das ist ein Kurvenmodifikator — hier im Browser auf WebGPU.`,
    glossary: [
      {
        term: "Catmull-Rom spline",
        def: "eine glatte Kurve, die durch Kontrollpunkte verläuft",
      },
      {
        term: "Curve modifier",
        def: "deformiert ein Mesh, damit es einem Pfad folgt",
      },
      {
        term: "Extruded text",
        def: "3D-Buchstaben-Geometrie aus einer Font-Kontur",
      },
      {
        term: "Control handle",
        def: "ziehbarer Punkt, der die Spline umformt",
      },
    ],
    trySteps: [
      "Öffnen Sie die [WebGPU Curve Modifier Demo](/demos/webgpu-modifier-curve/)",
      "Klicken Sie einen Kontrollpunkt zur Auswahl",
      "Ziehen, um den geschlossenen Pfad umzuformen — beobachten Sie den Textfluss",
      "Orbitieren, um Buchstabenstärke und Silhouette zu prüfen",
    ],
    requirements: [
      "**Browser:** WebGPU (Chrome/Edge empfohlen)",
      "**Input:** Maus für Handle-Auswahl und -Ziehen",
      "**GPU:** bescheiden — schwerere Fonts / feinere Extrusion erhöhen Kosten",
    ],
    viewA: {
      caption: "Volle Schleife — extrudierter Text folgt der geschlossenen Spline",
    },
    viewB: {
      caption: "Handle-Edit — lokale Biegung der Buchformen auf dem Pfad",
    },
    alsoCan: [
      "Den String gegen ein Marken-Wortzeichen tauschen",
      "Pfadideen in Kamera-Rail-Workflows exportieren",
      `[webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve) vergleichen`,
    ],
    howWorks: `Eine geschlossene Catmull-Rom-Kurve definiert den Pfad; ein Modifikator sampelt die Kurve, um extrudierte Textgeometrie bei jedem Update zu transformieren. WebGPURenderer zeichnet das Ergebnis. Upstream: [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve) ([Quelle](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_modifier_curve.html)). Für reines Pfad-Editing ohne Modifikator siehe den WebGL [spline editor](https://threejs.org/examples/#webgl_geometry_spline_editor) — komplementäre Tools.`,
    faq: [
      {
        q: "Können wir unsere Schrift nutzen?",
        a: `In der Regel ja mit einer lizenzierten Schrift, die fürs Web gemesht werden kann — wir übernehmen die Konvertierung in Production Builds.`,
      },
      {
        q: "WebGPU erforderlich?",
        a: `Für diese Demo-Seite ja. Kurvenideen können je nach Projekt auch auf WebGL ausgeliefert werden.`,
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
    pageTitle: "WebGPU Particles — Feuer- und Rauch-Sprites",
    demoLabel: "WebGPU Particles",
    hook: `Instanzierte Feuer- und Rauch-Sprites mit TSL-Lebenszyklen — rotierende Rauch-UVs, additives Feuer und ein einfaches Bodengitter. Kompaktes WebGPU-VFX für Stimmung und Produktwärme.`,
    coverNote: `Das Cover zeigt dieselbe Feuer-/Rauch-Partikelsprache wie Guided Tour Step 2 auf The Black Witness — Dachwärme mit einem „Animated fire“-Hotspot-Popup in https://iobjectm.com/demos/panorama-360/.`,
    whyBullets: [
      "- **Lesbares elementares VFX** — Feuer + Rauch ohne volles FX-Paket",
      "- **Instanzierte Sprites** — viele Partikel, eine Draw-Strategie",
      "- **TSL-Lebenszyklen** — Spawn, Alter und Fade auf dem GPU-Pfad",
      "- **Additives Feuer** — Glow, der auf dunklen Szenen sauber kompositiert",
      `- **In 360°-Touren eingebunden** — Step 2 auf [Panorama 360](https://iobjectm.com/demos/panorama-360/) paart Partikel mit Hotspot-Popup`,
    ],
    whyUses: `Schmiede-/Launch-Stimmungen, Camp- und Industrie-Sketches, leichte Hero-Loops und Wärme-Beats in interaktiven 360°-Guided-Touren.`,
    beginner: `Feuer und Rauch sind hier viele kleine Bilder (Sprites), die über die Zeit verblassen und wirbeln. Additives Blending lässt Flammen hell wirken; Rauch nutzt weichere Texturen. Zusammen verkaufen sie Wärme ohne echte Verbrennung zu simulieren. In unserer [360°-Tour](https://iobjectm.com/demos/panorama-360/) wird dieselbe Partikelsprache zu Guided Tour Step 2 — ein Stopp, den Gäste umsehen und anklicken können.`,
    glossary: [
      {
        term: "Sprite particle",
        def: "texturiertes Quad, oft kamerageführt, für Rauch/Feuer",
      },
      {
        term: "Additive blending",
        def: "Farben addieren sich — hell für Feuer, leicht überzogen wenn unkontrolliert",
      },
      {
        term: "Life cycle",
        def: "Geburt, Altern und Tod jedes Partikels",
      },
      {
        term: "Instancing",
        def: "effizientes Zeichnen vieler Partikel aus einer Vorlage",
      },
      {
        term: "Guided tour Step 2",
        def: "auf /demos/panorama-360/ — cam · +particles · hotspot+popup",
      },
    ],
    trySteps: [
      "Öffnen Sie die [WebGPU Particles Demo](/demos/webgpu-particles/)",
      "Orbitieren Sie die Säule — trennen Sie Feuerkern von Rauchkörper",
      "Beobachten Sie Sprite-Rotation / UV-Bewegung im Rauch",
      `Öffnen Sie [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, und sehen Sie Step 2 (Partikel + Hotspot)`,
    ],
    requirements: [
      "**Browser:** WebGPU via Three.js (nicht nur die älteren WebGL-Partikelbeispiele)",
      "**GPU:** fein auf den meisten modernen Laptops bei Standard-Counts",
      "**Display:** dunklere UI-Hintergründe zeigen additives Feuer am besten",
    ],
    viewA: {
      caption: "Dach-Feuer-Walkthrough — animierte Fontäne über der Stadt",
    },
    viewB: {
      caption: "Nähere Wärme — Partikelfontäne über der Stadtsilhouette",
    },
    alsoCan: [
      "Flammen für markensichere Wärme umfärben",
      "Unter einer Produkt-Silhouette für Launch-Filme legen",
      `Dieselbe Partikelsprache in einen [360°-Guided-Tour](/demos/panorama-360/) Beat legen (Step 2)`,
      "[webgpu_particles](https://threejs.org/examples/#webgpu_particles) öffnen",
    ],
    howWorks: `Instanzierte Sprites sampeln Feuer-/Rauch-Texturen; TSL-Node-Materialien animieren Leben, Rotation und Blending; WebGPURenderer kompositiert den Frame. Upstream: [webgpu_particles](https://threejs.org/examples/#webgpu_particles) ([Quelle](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_particles.html)). WebGL-Partikelsysteme bleiben weit verbreitet für breitere Unterstützung — API passend zur Zielgruppe wählen.`,
    tourBridge: {
      step: 2,
      stepLabel: "Guided tour Step 2 — Partikel + Hotspot-Popup auf The Black Witness",
      body: `Standalone Feuer/Rauch ist nur die halbe Geschichte. In der [360° Panorama Tour](/demos/panorama-360/) ist **Step 2** autorisiert als \`cam · +particles · hotspot+popup\`: die Kamera landet auf einem Dach-Beat, eine Partikelschicht verkauft Wärme/Atmosphäre, und ein Hotspot öffnet ein Popup, damit Gäste Story + Agency in einem Stopp bekommen.

Diese Verbindung ist der Interaktivitätsvorteil — Partikel sind kein Hintergrund-Tapete; sie markieren einen **Moment, an dem man anhalten, umsehen und klicken kann**. Dasselbe VFX-Craft aus dieser Demo wird zu einem Guided Beat in einer teilbaren Tour. Siehe auch [Spout](/blog/spout) (Step 3) und [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4).`,
    },
    faq: [
      {
        q: "Ist das eine echte Fluidsimulation?",
        a: `Nein — Sprite-VFX mit autorisiertem Motion. Günstig, kontrollierbar, pitch-freundlich.`,
      },
      {
        q: "Wie unterscheidet sich das von linked particles?",
        a: `Das hier sind Feuer/Rauch-Sprites. Linked particles betonen Zeiger-Spuren und Nachbarbänder.`,
      },
      {
        q: "Wo erscheinen diese Partikel in der 360°-Tour?",
        a: `Guided-tour Step 2 auf The Black Witness — Partikel mit Hotspot-Popup. Öffnen Sie /demos/panorama-360/ und Play guided tour.`,
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
    pageTitle: "BufferGeometry Draw Range — Partikelnetzwerke auf WebGL",
    demoLabel: "BufferGeometry Draw Range",
    hook: `Ein lebendiges Partikelnetzwerk mit Nähe-Linien — \`BufferGeometry.setDrawRange()\` zeichnet nur die aktiven Punkte und Segmente. Klassisches Three.js WebGL, weiterhin ein Workhorse für Data-Look-Visuals.`,
    coverNote: "Das Cover zeigt die Knoten-Link-Partikelwolke mit aktiven Verbindungen.",
    whyBullets: [
      "- **Netzwerk-Ästhetik** — Knoten und Kanten, die sich wie Daten anfühlen",
      "- **Draw-Range-Kontrolle** — nur rendern, was diesen Frame lebt",
      "- **Einstellbarer Graph** — Count, Distanz und max. Verbindungen",
      "- **Breite Geräte-Reichweite** — WebGL, nicht WebGPU-only",
    ],
    whyUses: `Tech-Marken-Hintergründe, „verbundenes System“-Metaphern und leichte WebGL-Embeds.`,
    beginner: `Punkte schweben im Raum; wenn zwei nah kommen, erscheint eine dünne Linie — wie Menschen, die ein Netzwerk werden. Der clevere Teil ist Effizienz: die Engine zeichnet nur die gerade aktiven Punkte und Linien statt alles die ganze Zeit.`,
    glossary: [
      {
        term: "BufferGeometry",
        def: "Three.js-Mesh-Daten in GPU-Buffern gespeichert",
      },
      {
        term: "Draw range",
        def: "begrenzt, welcher Buffer-Abschnitt diesen Frame gezeichnet wird",
      },
      {
        term: "Proximity link",
        def: "Linie, wenn Partikel innerhalb einer Distanz sind",
      },
      {
        term: "WebGL",
        def: "die weit unterstützte Browser-3D-API dieser Demo",
      },
    ],
    trySteps: [
      `Öffnen Sie die [BufferGeometry Draw Range Demo](/demos/buffergeometry-drawrange/)`,
      "Orbitieren Sie die Partikelwolke",
      "Erhöhen oder senken Sie Partikel-Count und Link-Distanz in der UI",
      "Beobachten Sie Linien erscheinen/verschwinden, wenn sich Nachbarn ändern",
    ],
    requirements: [
      "**Browser:** jeder moderne Browser mit WebGL",
      `**GPU:** skaliert mit Partikel- und Verbindungs-Counts — auf schwachen Geräten runterdrehen`,
      "**API-Hinweis:** WebGL-Pfad — nützlich wenn WebGPU nicht verfügbar",
    ],
    viewA: {
      caption: "Volles Netzwerk — Partikel mit Nähe-Segmenten",
    },
    viewB: {
      caption: "Näherer Graph — draw-range-aktive Links klar lesbar",
    },
    alsoCan: [
      "Farben auf Kategorien oder Signalstärke mappen",
      "Als gedämpfter Hintergrund unter UI-Copy nutzen",
      `[webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange) studieren`,
    ],
    howWorks: `Partikel updaten in JS (oder einfachen GPU-freundlichen Buffern); Liniensegmente werden für nahe Paare neu gebaut oder geranged; \`setDrawRange\` limitiert Draws auf die aktive Teilmenge. Upstream: [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange) ([Quelle](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_buffergeometry_drawrange.html)). Für WebGPU-Compute-Schwärme und TSL-Link-Bänder siehe neuere Experimente — gleiche visuelle Familie, andere API.`,
    faq: [
      {
        q: "Warum nicht WebGPU hier?",
        a: `WebGL gewinnt noch für maximale Geräteabdeckung. WebGPU wählen wir, wenn Compute oder TSL-Materialien es brauchen.`,
      },
      {
        q: "Können Links echte Daten repräsentieren?",
        a: "Ja — Zufallsnähe in Production durch Ihre Graph-Kanten ersetzen.",
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
    pageTitle: "Catmull Spline Editor — Pfade zum Ziehen",
    demoLabel: "Catmull Spline Editor",
    hook: `Interaktive Catmull-Rom-Pfade mit Transform-Gizmos — uniform, zentripetal und chordal vergleichen, Spannung tunen und \`Vector3\`-Arrays für Kamera-Rails und Objektpfade exportieren.`,
    coverNote: `Das Cover zeigt die editierbare Spline mit Kontrollpunkten und Kurventyp-Kontrast.`,
    whyBullets: [
      `- **Pfade visuell authorisieren** — keine Koordinatenlisten zuerst von Hand tippen`,
      "- **Kurventyp-Vergleich** — uniform vs. zentripetal vs. chordal an einem Ort",
      "- **Export-ready** — Vector3-Arrays für Rails, Fly-throughs und Modifiers",
      "- **WebGL-Zuverlässigkeit** — funktioniert, wo WebGPU noch nicht verfügbar ist",
    ],
    whyUses: "Kamera-Pfad-Planung, Produkt-Turntable-Rails und Briefing-Tools für Motion.",
    beginner: `Eine Spline ist eine glatte Kurve, die von wenigen Kontrollpunkten geführt wird — wie ein flexibles Lineal. Ziehen Sie die Punkte, und der Pfad aktualisiert sich. Filmemacher und Games nutzen dieselbe Idee für Kamerafahrten; hier editieren Sie im Browser.`,
    glossary: [
      {
        term: "Catmull-Rom",
        def: "Spline-Familie, die durch Kontrollpunkte interpoliert",
      },
      {
        term: "Centripetal",
        def: "Parametrisierung, die meist besser als uniform Schleifen/Spitzen vermeidet",
      },
      {
        term: "Tension",
        def: "wie straff die Kurve zu den Kontrollen biegt",
      },
      {
        term: "Gizmo",
        def: "On-Screen-Translate/Rotate/Scale-Handle für einen Punkt",
      },
    ],
    trySteps: [
      "Öffnen Sie die [Spline Editor Demo](/demos/spline-editor/)",
      "Ziehen Sie Kontrollpunkte mit dem Gizmo",
      "Wechseln Sie uniform / centripetal / chordal und vergleichen Sie die Biegung",
      `Exportieren oder kopieren Sie Vector3-Daten falls die UI es bietet — als Kamera-Rail nutzen`,
    ],
    requirements: [
      "**Browser:** moderner WebGL-Browser (Chrome, Edge, Firefox, Safari)",
      "**Input:** Maus für Gizmo-Drags; Desktop am einfachsten",
      "**API:** WebGL Three.js-Beispielfamilie — nicht WebGPU",
    ],
    viewA: {
      caption: "Voller Pfad — Kontrollpunkte und glatte Catmull-Rom-Kurve",
    },
    viewB: {
      caption: "Gizmo-Edit — lokales Umformen der Rail",
    },
    alsoCan: [
      "Exporte in Fly-through-Kameras einspeisen",
      "Mit dem WebGPU Curve Modifier für Type-on-Path paaren",
      `Upstream [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor) nutzen`,
    ],
    howWorks: `Kontrollpunkte definieren eine \`CatmullRomCurve3\`; der Editor visualisiert Polyline/Kurve und lässt Punkte transformieren. Kurventyp und Spannung ändern Parametrisierung. Upstream: [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor) ([Quelle](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_geometry_spline_editor.html)). Exportierte Punkte verbinden zu IOM-Pfad-Tools und dem [WebGPU curve modifier](/demos/webgpu-modifier-curve/).`,
    faq: [
      {
        q: "Welchen Kurventyp soll ich wählen?",
        a: `Centripetal ist ein sicherer Default gegen scharfe Spitzen; im UI für Ihren Pfad vergleichen.`,
      },
      {
        q: "Kann das eine echte Kamera auf einer Client-Site steuern?",
        a: "Ja — wir verdrahten exportierte Punkte in einen Production-Kamera-Controller.",
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
    pageTitle: "Terrain Sandbox — eine Welt aus Noise malen",
    demoLabel: "Terrain Sandbox",
    hook: `Geschichtetes Noise wird zu Hügeln, die Sie orbitieren können — Bäume, Felsen und Marker platzieren, Seeds regenerieren, Höhe und Rauheit tunen. Ein IOM WebGL-Sandbox-MVP Richtung Brushes, GLTF und echte DEM-Daten.`,
    coverNote: "Das Cover zeigt ein geseedetes Terrain-Patch mit verstreuten Props.",
    whyBullets: [
      "- **Spielbare Landschaft** — Stakeholder verstehen Site-Mood schnell",
      "- **Seed + Knobs** — reproduzierbare Varianten für Art Direction",
      "- **Props auf der Oberfläche** — Bäume/Felsen/Marker für Scale-Stories",
      "- **Roadmap-freundlich** — MVP Richtung Sculpt, GLTF, MapTiler DEM",
    ],
    whyUses: `frühe Umgebungs-Pitches, game-ähnliche Previews und Workshop-Tools für Layout-Gespräche.`,
    beginner: `Der Boden ist noch nicht von Hand sculptiert — Mathematik (Noise) erfindet Hügel. Sie ändern, wie hoch und rau sie sind, pflanzen ein paar Objekte, damit die Skala real wirkt, und drehen sich, als würden Sie einen Standort erkunden.`,
    glossary: [
      {
        term: "Procedural terrain",
        def: "Landschaft aus Algorithmen statt gescanntem Mesh",
      },
      {
        term: "Seed",
        def: "Zahl, die dieselbe zufällige Landschaft reproduzierbar macht",
      },
      {
        term: "DEM",
        def: "digital elevation model — echte Höhendaten (Zukunftspfad)",
      },
      {
        term: "WebGL",
        def: "Browser-3D-API dieser Sandbox",
      },
    ],
    trySteps: [
      "Öffnen Sie die [Terrain Sandbox Demo](/demos/terrain-sandbox/)",
      "Orbitieren Sie das Terrain; regenerieren Sie Seed für neues Landform",
      "Höhe und Rauheit tunen",
      "Bäume, Felsen oder Marker platzieren und Silhouette neu prüfen",
    ],
    requirements: [
      "**Browser:** moderner WebGL-Browser",
      "**GPU:** größere Grids kosten mehr — Auflösung auf leichten Geräten senken",
      "**Netzwerk:** nicht nötig für Kern-Noise-Terrain (Props sind lokal zur Demo)",
    ],
    viewA: {
      caption: "Weite Landform — Noise-Hügel mit lesbaren Gratlinien",
    },
    viewB: {
      caption: "Prop-Pass — Bäume/Felsen geben menschliche Skala",
    },
    alsoCan: [
      "Lieblings-Seeds als Art-Direction-Referenzen speichern",
      "Follow-up mit Sculpt-Brushes oder GLTF-Props planen",
      "Mit echten Tiles in Procedural GL vergleichen",
    ],
    howWorks: `Geschichtete Noise-Samples bauen eine Heightmap; ein Mesh wird displaced und geschattet; Props raycasten oder height-samplen auf die Oberfläche. Der Stack ist Three.js auf **WebGL** für breite Unterstützung. Das ist ein IOM-Sandbox-MVP — kein three.js-Stock-Beispiel — mit Pfad zu Brushes, Asset-Import und optionalem MapTiler DEM für echte Sites.`,
    faq: [
      {
        q: "Ist das echte Geografie?",
        a: `Noch nicht — prozedurales Noise. Echtes DEM / MapTiler ist auf der Roadmap für site-true Arbeit.`,
      },
      {
        q: "WebGL oder WebGPU?",
        a: "WebGL für diese Sandbox, damit mehr Geräte den Link öffnen können.",
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
    pageTitle: "Procedural GL Terrain — echte Welt-Tiles in 3D",
    demoLabel: "Procedural GL Terrain",
    hook: `Echte Landschaften als GPU-LOD-Terrain gestreamt — unsere Seite embeddet die offizielle [procedural.eu](https://www.procedural.eu/map/) Map powered by procedural-gl.js (MPL-2.0). Erster Schritt: live upstream Demo; self-hosted MapTiler Build kann folgen.`,
    coverNote: `Das Cover ist ein Live-Still vom procedural.eu Map-Embed — echte MapTiler Elevation/Imagery-Tiles in 3D, keine Noise-Sandbox.`,
    whyBullets: [
      "- **Echte Orte** — Höhe aus Map-Tiles, nicht nur Noise",
      "- **GPU LOD** — Detail wo Sie hinschauen, leichtere Meshes weiter weg",
      "- **Open-Source-Kern** — procedural-gl.js unter MPL-2.0",
      "- **Brücke zur Production** — jetzt embedden; später self-hosten mit Ihrem Key",
    ],
    whyUses: "Site-Kontext für Architektur, Location-Pitches und Geo-Storytelling im Web.",
    beginner: `Statt Hügel zu erfinden, lädt dieser Viewer echte Terrain-Tiles, damit Sie tatsächliche Geografie in 3D überfliegen können — näher an einer leichten Earth-View als an einem aus Noise gebauten Game-Level.`,
    glossary: [
      {
        term: "LOD",
        def: "level of detail — mehr Mesh-Detail nahe der Kamera",
      },
      {
        term: "Map tiles",
        def: "Bild-/Elevation-Stücke für die aktuelle Ansicht gestreamt",
      },
      {
        term: "procedural-gl.js",
        def: "Open-Source-Bibliothek für GPU-Terrain aus Map-Daten",
      },
      {
        term: "MapTiler",
        def: "Tile-Provider, oft für Production-Keys (nicht im Repo)",
      },
    ],
    trySteps: [
      "Öffnen Sie die [Procedural GL Demo](/demos/procedural-gl/)",
      `Warten Sie, bis der embedded [procedural.eu map](https://www.procedural.eu/map/) lädt`,
      "Pan und Zoom über echtes Terrain",
      `Stellen Sie sich vor, ein Client-Gebäude oder Pfad auf einem bekannten Grat zu platzieren`,
    ],
    requirements: [
      `**Netzwerk:** erforderlich — Tiles und procedural.eu Embed brauchen Konnektivität`,
      "**Browser:** modernes Chromium für WebGL-Terrain empfohlen",
      "**Keys:** Production MapTiler Keys bleiben server-side / env — nie committed",
    ],
    viewA: {
      caption: "Regionalansicht — LOD-Terrain aus gestreamten Tiles",
    },
    viewB: {
      caption: "Näheres Relief — Grate und Täler lesbar in 3D",
    },
    alsoCan: [
      "Als Kontext neben einem geolokalisierten GLB nutzen",
      "Self-hosted MapTiler-Fork planen",
      "Docs auf [procedural.eu](https://www.procedural.eu/) lesen",
    ],
    howWorks: `Unsere \`/demos/procedural-gl/\` Seite embeddet die offizielle Map-Erfahrung unter [procedural.eu/map](https://www.procedural.eu/map/). Unter der Haube baut [procedural-gl-js](https://github.com/felixpalmer/procedural-gl-js) GPU-LOD-Meshes aus Elevation/Imagery-Tiles (WebGL). IOMs nächster Schritt kann ein self-hosted Build mit MapTiler sein — API-Keys bleiben aus dem Git-Repo. Das ist geografisches Terrain, komplementär zur prozeduralen Noise [Terrain Sandbox](/demos/terrain-sandbox/).`,
    faq: [
      {
        q: "Wird die Map von IOM gehostet?",
        a: `Dieser erste Schritt embeddet procedural.eu. Eine self-hosted Variante ist eine separate Production-Aufgabe.`,
      },
      {
        q: "WebGL oder WebGPU?",
        a: `WebGL-Terrain-Streaming via procedural-gl.js — gewählt für Stack und Tile-Ökosystem der Bibliothek.`,
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
    pageTitle: "Spout — raymarched Rohrwasser",
    demoLabel: "Spout",
    hook: `Ein Chromrohr mit raymarched Wasser — Brechung, Transparenz und Reflexionen in einem self-hosted WebGL2-Port von P_Malins klassischem Shadertoy. Ziehen zum Orbitieren der Flüssigkeitsskulptur — dann denselben Wasser-Beat in unserer [360° Panorama Tour](https://iobjectm.com/demos/panorama-360/) (Guided Step 3).`,
    coverNote: `Das Cover zeigt den Rohrauslauf mit refraktivem Wasser, das die Umgebung einfängt. Dieselbe Effektsprache erscheint als Step 3 (\`+particles/spout\`) in https://iobjectm.com/demos/panorama-360/.`,
    whyBullets: [
      "- **Shadertoy-Pedigree** — ein bekanntes Studienstück, jetzt auf iobjectm.com",
      `- **Raymarched Wasser** — kein Partikel-Splash-Mesh; Distance Fields leisten die Arbeit`,
      "- **Brechung & Reflexion** — Materialsprache, die Kunden aus Werbung kennen",
      "- **WebGL2-Port** — breite Echtzeit-Reichweite ohne WebGPU",
      `- **In 360°-Touren eingebunden** — Step 3 auf [Panorama 360](https://iobjectm.com/demos/panorama-360/) paart Spout/Wasser mit Hotspot-Popup`,
    ],
    whyUses: `Shader-Craft-Demos, Liquid-Branding-Moodboards, Raymarching-Look-Dev lehren und Wasser-Beats in interaktiven 360°-Guided-Touren.`,
    beginner: `Das Wasser ist kein gefilmter Splash. Die GPU läuft Strahlen durch eine mathematische Form, bis sie „Wasser“ oder „Metall“ trifft, und biegt die Sicht wie eine Linse. Deshalb wirken Rohr und Flüssigkeit aus jedem Winkel so sauber. In unserer [360°-Tour](https://iobjectm.com/demos/panorama-360/) wird dieselbe Flüssigkeitssprache zu einem Guided Stop, den Gäste umsehen und anklicken können.`,
    glossary: [
      {
        term: "Raymarching",
        def: `Schritte entlang eines Strahls durch ein Distance Field bis eine Oberfläche gefunden wird`,
      },
      {
        term: "SDF",
        def: "signed distance function — Mathematik, die Formen für Raymarcher beschreibt",
      },
      {
        term: "Refraction",
        def: "Biegung der Sicht durch transparentes Wasser",
      },
      {
        term: "Shadertoy",
        def: "Online-Playground für Pixel/Raymarch-Shader (Original von P_Malin)",
      },
      {
        term: "Guided tour Step 3",
        def: "auf /demos/panorama-360/ — cam · +particles/spout · hotspot+popup",
      },
    ],
    trySteps: [
      "Öffnen Sie die [Spout Demo](/demos/spout/)",
      "Ziehen zum Orbitieren von Rohr und Wasser",
      "Beobachten Sie Brechung, die den Hintergrund durch die Flüssigkeit verschiebt",
      `Öffnen Sie [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, und sehen Sie Step 3 (Spout / Wasser + Hotspot)`,
      `Vergleichen mit der originalen [Shadertoy-Ansicht](https://www.shadertoy.com/view/lsXGzH)`,
    ],
    requirements: [
      "**Browser:** WebGL2-fähiger Chrome, Edge, Firefox oder Safari",
      "**GPU:** leicht bis moderater Raymarch-Kosten — Auflösung senken bei Bedarf",
      "**API:** WebGL2-Shader-Port — kein WebGPU-Compute",
    ],
    viewA: {
      caption: "Hero-Spout — Rohrmetall und refraktive Wassersäule",
    },
    viewB: {
      caption: "Orbit-Detail — Reflexionen und Transparenz in der Flüssigkeit",
    },
    alsoCan: [
      "Palette für Markenmetalle und Flüssigkeitstint retunen",
      "Stills als Look-Dev-Referenzen für Produktflüssigkeiten nutzen",
      `Den Wasser-Beat in einen [360°-Guided-Tour](/demos/panorama-360/) Stop legen (Step 3)`,
      `P_Malins [Shadertoy](https://www.shadertoy.com/view/lsXGzH) crediten und studieren`,
    ],
    howWorks: `Ein Fullscreen- (oder mesh-gebundener) WebGL2-Fragment-Shader raymarched SDFs für Rohr und Wasser mit Brechung, Transparenz und Reflexionen. IOM hostet einen Port von P_Malins Shadertoy-Experiment [lsXGzH](https://www.shadertoy.com/view/lsXGzH) unter \`/demos/spout/\`. Das ist klassische Shader-Kunst auf **WebGL2**, komplementär zu Three.js-Szenen-Demos und distinct von WebGPU TSL-Wasser.`,
    tourBridge: {
      step: 3,
      stepLabel: `Guided tour Step 3 — Spout / Wasserpartikel + Hotspot-Popup auf The Black Witness`,
      body: `Spout ist nicht nur ein Standalone-Experiment. Auf [https://iobjectm.com/demos/panorama-360/](https://iobjectm.com/demos/panorama-360/) ist **Step 3** der The Black Witness Guided Tour autorisiert als \`cam · +particles/spout · hotspot+popup\`: die Kamera landet auf dem Dach-Wasser-Beat, die Spout/Wasser-Schicht verkauft Flüssigkeitsbewegung vor Ort, und ein Hotspot-Popup hält die Narrative interaktiv.

Das ist der Interaktivitätsvorteil — Gäste schauen nicht nur Brechung; sie kommen an einem **getimten Stop** an, können noch umsehen und den Hotspot für Bedeutung anklicken. Editor oder [Visitor Preview](https://iobjectm.com/demos/panorama-360/?mode=preview) öffnen, **Play guided tour** drücken und zu Step 3 gehen. Paaren mit [WebGPU Particles](/blog/webgpu-particles) (Step 2) und [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4) für den vollen Effects-Stack.`,
    },
    faq: [
      {
        q: "Wird das Wasser mit Physik simuliert?",
        a: "Nein — raymarched Shader-Geometrie/Animation, keine Fluid-Partikel-Sim.",
      },
      {
        q: "Kann das in einer Three.js-Produktszene laufen?",
        a: `Oft als Screen-Pass oder lokalisierter Effekt — Integration pro Projekt scoped. Die Panorama-Tour unter https://iobjectm.com/demos/panorama-360/ ist ein Production-Beispiel.`,
      },
      {
        q: "Wo erscheint Spout in der 360°-Tour?",
        a: `Guided-tour Step 3 auf The Black Witness — Spout/Wasser mit Hotspot-Popup. Öffnen Sie https://iobjectm.com/demos/panorama-360/ und Play guided tour.`,
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
