import type { CaseStudiesLocalePack } from './types'

export const deCaseStudies: CaseStudiesLocalePack = {
  studies: {
    '3d-viewer': {
      eyebrow: 'Case Study · Software',
      title: '3D Viewer — vom Briefing zu WebGL',
      lead: 'Wie IOM ein Review-Problem in ein auslieferbares Produkt verwandelt: Chrome verdrahten, Pipeline härten, dann Kunden einen Link geben, den sie im Call öffnen können.',
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
  },
}
