import type { CaseStudiesLocalePack } from './types'

export const deCaseStudies: CaseStudiesLocalePack = {
  studies: {
    '3d-viewer': {
      eyebrow: 'Case Study · Software',
      title: '3D Viewer — vom Briefing zu WebGL',
      lead: 'Wie IOM ein Review-Problem in ein auslieferbares Produkt verwandelt: Chrome verdrahten, Pipeline härten, dann Kunden einen Link geben, den sie im Call öffnen können.',
      impact:
        'Stakeholder prüfen komplexe Modelle im Browser — ohne CAD-Lizenz — damit Design- und Sales-Entscheidungen in gemeinsamen Calls vorangehen statt an Datei-Übergaben zu hängen.',
      primaryCtaLabel: 'Live-Viewer öffnen',
      secondaryCtaLabel: 'Technischer Beitrag',
      stages: {
        brief: {
          title: 'Briefing',
          summary: 'Stakeholder müssen 3D prüfen — ohne CAD-Lizenz.',
          detail:
            'Das Kernproblem: ein Modell im Call teilen, kein ZIP. Formate variieren (GLTF, FBX, OBJ, IFC), und Beleuchtung oder Stadt-Kontext verkaufen den Pitch oft genauso wie das Mesh selbst.',
          mediaAlt: '3D-Viewer-Produktposter — Orbit-Chrome um ein beleuchtetes Modell',
        },
        wire: {
          title: 'Layout & Review-Chrome',
          summary: 'Panels, Orbit und ein Pfad von öffnen → verstehen → entscheiden.',
          detail:
            'Wir gestalten die Oberfläche um Review, nicht um Authoring: Asset rahmen, Umgebungen wechseln, Hotspots und Export-Pfade klar halten. Desktop und Web teilen dasselbe mentale Modell.',
          mediaAlt: 'Produkt-Walkthrough — Orbit, HDR-Beleuchtung und Viewer-Chrome',
        },
        engineering: {
          title: 'Engineering',
          summary: 'Three.js-Pipeline, HDR-Bodenprojektion, Streets-GL-Brücke.',
          detail:
            'Echte Kunden-Pipelines brauchen Formatabdeckung, zuverlässige Stadt-Kontext-Sync und Texture-Restore beim Wechsel zwischen Product ↔ City. Die Engineering-Story ist Zuverlässigkeit bei chaotischen Assets — keine Demo-Leere.',
          mediaAlt: 'OSM-3D- / Streets-GL-Stadt-Kontext im Viewer',
        },
        final: {
          title: 'Finales WebGL',
          summary: 'Teilbares Browser-Review und Windows-Desktop-Builds.',
          detail:
            'Live auf 3dbviewer.com — Orbit unter 360°-HDR mit Bodenprojektion, oder Streets GL, wenn der Ort die Geschichte ist. Dieselbe Craft-Sprache wie unsere Experimente, verpackt für Entscheidungen.',
          mediaAlt: '360°-HDR mit Bodenprojektion — Produkt beleuchtet durch die Environment-Plate',
        },
      },
    },
    'black-witness': {
      eyebrow: 'Case Study · 360°',
      title: 'The Black Witness — vom Briefing zu 360°',
      lead: 'Wie eine Fotoserie zu einer geführten WebGPU-Panorama-Tour wird — Hotspots, Effekt-Layer und eine Visitor-Preview, die Kunden teilen können.',
      impact:
        'Kunden teilen einen geführten 360°-Walkthrough per URL — ohne Installation — damit Stakeholder die Erzählung auf jedem Gerät erleben und Feedback geben, bevor der nächste Shoot oder Launch kommt.',
      primaryCtaLabel: 'Visitor-Tour öffnen',
      secondaryCtaLabel: 'Technischer Beitrag',
      stages: {
        brief: {
          title: 'Briefing',
          summary: 'Eine Raben-Geschichte, die Gäste begehen — nicht nur ansehen.',
          detail:
            'The Black Witness begann als Fotoserie. Das kundennahe Problem: diese Atmosphäre in ein geführtes 360°-Erlebnis verwandeln — umschauen, klicken zum Lernen, einen Link teilen ohne App-Installation.',
          mediaAlt: 'The Black Witness — Dach-Raben-Still, der die 360°-Erzählung anstößt',
        },
        wire: {
          title: 'Tour-Struktur',
          summary: 'Hotspots, geführte Stops und ein Visitor-Preview-Pfad.',
          detail:
            'Wir gestalten Kamera-Beats und Hotspot-Typen (Info, Szenen-Links, Popups), damit die Tour wie ein Storyboard lesbar ist. Editor und Visitor-Preview teilen eine Projektdatei — einmal bauen, saubere Preview-URL teilen.',
          mediaAlt: 'Geführte Tour Schritt 1 — Raben-Hotspot und Popup auf The Black Witness',
        },
        engineering: {
          title: 'Engineering',
          summary: 'Equirektanguläre Kugel, WebGPU-Effekt-Layer, Projekt-Speicherformat.',
          detail:
            'Panoramen liegen auf einer Kugelkamera; geführte Schritte legen Partikel, Spout/Wasser und Compute-Vögel auf Hotspots getimed. `.360project` hält Szenen, Stops und Effekte zwischen Sessions portabel.',
          mediaAlt: 'Schritt 2 — Partikel-/Feuer-Hotspot-Beat in der Panorama-Tour',
        },
        final: {
          title: 'Finales 360°',
          summary: 'Teilbare Visitor-Preview — ohne Editor-Chrome.',
          detail:
            'Kunden öffnen eine Deep-Link-Preview (Yaw / Pitch für einen gemeinsamen ersten Frame gesperrt), spielen die geführte Tour oder erkunden Hotspots frei. Dieselbe Engine wie der Editor — verpackt für Gäste.',
          mediaAlt: 'Schritt 4 — Vogel-Layer und Sturmhimmel-Beat auf The Black Witness',
        },
      },
    },
    'message-in-a-bottle': {
      eyebrow: 'Case Study · WebGPU',
      title: 'Message in a Bottle — vom Briefing zur offenen See',
      lead: 'Wie IOM ein Browser-Keepsake auf lebendigem Wasser baut: Flasche und Pergament inszenieren, WebGPU-Ozean und Himmel härten, dann eine Demo ausliefern, die Gäste ohne Installation öffnen.',
      impact:
        'Kunden und Gäste erleben ein interaktives Keepsake im Browser — Tag/Nacht-See, versiegelte Notizen und gerätebewusste Qualität — damit narrative Demos real genug zum Präsentieren wirken, nicht nur zum Beschreiben.',
      primaryCtaLabel: 'Live-Demo öffnen',
      secondaryCtaLabel: 'Experimente durchstöbern',
      deliverables: [
        'Teilbare WebGPU-Open-Sea-Demo (ohne Installation)',
        'Flaschen- und Pergament-Composer mit versiegelten / verschlüsselten Notizen',
        'TSL-Gerstner-Ozean mit Schaum, Auftrieb und Meeresleben',
        'Tag/Nacht-Himmel mit qualitätsbewussten volumetrischen Wolken',
        'Low- / Medium- / High-Presets für echte Geräte',
      ],
      stages: {
        brief: {
          title: 'Briefing',
          summary: 'Ein Keepsake, das sich wie offenes Wasser anfühlen muss — kein flaches Skybox.',
          detail:
            'Message in a Bottle brauchte ein Browser-Erlebnis, in dem Schreiben und Versiegeln einer Notiz in einer glaubwürdigen See sitzt: Tag/Nacht-Licht, Wetter und eine Flasche zum Finden und Öffnen — ohne dass Gäste etwas installieren.',
          mediaAlt: 'Offene-See-Horizontstimmung — das atmosphärische Briefing für Message in a Bottle',
        },
        wire: {
          title: 'Erlebnis-Layout',
          summary: 'Flasche, Pergament und Himmelsteuerungen in einer ruhigen Komposition.',
          detail:
            'Wir inszenieren den ersten Viewport um Flasche und Horizont, dann legen wir Composer-UI, Qualitätsstufen und Tageszeit-Steuerungen so, dass die Erzählung primär bleibt und die Technik erst dann sichtbar wird, wenn jemand erkunden will.',
          mediaAlt: 'Nachrichten-Layout — Pergamentbrief über der offenen See mit Sea- und Sky-Steuerungen seitlich',
        },
        engineering: {
          title: 'Engineering',
          summary: 'WebGPU-TSL-Ozean, Himmelsstrahlung und qualitätsbewusste Wolken.',
          detail:
            'Gerstner-Swell, domain-warped Chop und ein TSL-Himmel mit volumetrischen Cloud-Lods, die auf Medium/Low zurückfahren. Auftrieb, Meeresleben und verschlüsselte Nachrichten bleiben im selben Frame-Budget wie das Wasser.',
          mediaAlt: 'WebGPU-Open-Sea-Render — Gerstner-Wasser, Dunst und Wolken-Dichte-Steuerungen',
        },
        final: {
          title: 'Finale offene See',
          summary: 'Eine teilbare WebGPU-Demo, die Gäste im Browser öffnen.',
          detail:
            'Live unter /demos/message-in-a-bottle/ — eine versiegelte Notiz auf offener See schreiben oder empfangen, mit Tag/Nacht-Himmel, Qualitäts-Presets für echte Geräte und der Craft-Sprache unserer Experimente als Keepsake.',
          mediaAlt: 'Message in a Bottle — finale Open-Sea-Szene mit Schaum, Dunst und Himmel',
        },
      },
    },
    'labelled-custom-cursor': {
      eyebrow: 'Case Study · Interaktion',
      title: 'Labelled Custom Cursor — vom Briefing zum Lab',
      lead: 'Wie IOM einen kontextsensitiven Zeiger gestaltet: Intent im Markup deklarieren, Tip und Ring mit leichtem rAF-Loop animieren, dann ein labelled Lab parken, während die Live-Site ruhig bleibt.',
      impact:
        'Besucher erhalten klare Hover-Hinweise bei interaktiven Medien — VIEW, PLAY, LOOK, ENTER 3D — damit Demos und CTAs vor dem Klick kommunizieren, ohne native Textfelder oder Touch-Geräte zu stören.',
      primaryCtaLabel: 'Live-Lab öffnen',
      secondaryCtaLabel: 'Experimente durchstöbern',
      deliverables: [
        'Teilbares labelled Cursor-Lab (Playground + Live-Usage-Panel)',
        'data-cursor / data-cursor-label Markup-Vokabular',
        'Präzisions-Tip + träges Ring (rAF-Lerp, ohne GSAP)',
        'Native Fallback für Touch, Formulare und grobe Pointer',
        'Ruhige Focus-Orb auf Homepage-Karten; labelled Modi für CTAs & Medien',
      ],
      stages: {
        brief: {
          title: 'Briefing',
          summary: 'Interaktive Medien brauchen einen Zeiger mit Intent — keinen generischen Pfeil.',
          detail:
            'Bei einem Portfolio aus 3D, Video und 360° soll Hover andeuten, was als Nächstes passiert: VIEW für Projekte, PLAY für Medien, LOOK für Panoramen, ENTER 3D für Immersion. Der Systemcursor trägt dieses Vokabular nicht ohne Labels und Motion, die zur Marke passen.',
          mediaAlt: 'Labelled-Cursor-Lab — Playground-Targets und Idle-Usage-Panel',
        },
        wire: {
          title: 'Interaktionsdesign',
          summary: 'Markup-gesteuerte Modi: data-cursor plus optionale Labels.',
          detail:
            'Targets deklarieren Intent in HTML — explore, view, play, look, drag, start, external, link, native. Custom Labels (ENTER 3D) überschreiben Defaults. Das Lab spiegelt Produktions-Markup: Hover aktualisiert ein Live-Usage-Panel mit dem passenden Snippet.',
          mediaAlt: 'ENTER-3D-Hover — Usage-Panel zeigt data-cursor-explore-Markup',
        },
        engineering: {
          title: 'Engineering',
          summary: 'Präzisions-Tip, träges Ring, rAF-Lerp — ohne GSAP.',
          detail:
            'Ein leichter requestAnimationFrame-Loop folgt dem Pointer mit schnellem Tip (~0.55) und weicherem Ring (~0.16). Target-Auflösung läuft den DOM für data-cursor / Anchors / Inputs ab; Touch und Formularfelder fallen auf den nativen Cursor zurück.',
          mediaAlt: 'LOOK-Modus aktiv — Code-Panel synchronisiert zum Panorama-data-cursor-Markup',
        },
        final: {
          title: 'Deliverables',
          summary: 'Ein teilbares labelled Lab — und eine ruhigere Focus-Orb auf der Live-Site.',
          detail:
            'Live unter /demos/custom-cursor-labelled/ mit geparktem Source-Snapshot. Homepage-Karten nutzen eine ruhige cyan Focus-Orb; das labelled Set bleibt für Demos, CTAs, Transport-Controls und externe Links verfügbar.',
          mediaAlt: 'Labelled-Custom-Cursor-Demo — Playground und Live-Usage-Code-Panel',
        },
      },
    },
  },
}
