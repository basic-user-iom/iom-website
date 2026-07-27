import type { CaseStudiesLocalePack } from './types'

export const nlCaseStudies: CaseStudiesLocalePack = {
  studies: {
    '3d-viewer': {
      eyebrow: 'Case study · Software',
      title: '3D Viewer — van brief tot WebGL',
      lead: 'Hoe IOM een reviewprobleem omzet in een verscheepbaar product: de chrome bedraden, de pipeline harden, en klanten een link geven die ze in een call kunnen openen.',
      primaryCtaLabel: 'Live viewer openen',
      secondaryCtaLabel: 'Technische write-up',
      stages: {
        brief: {
          title: 'Brief',
          summary: 'Stakeholders moeten 3D reviewen zonder CAD-licentie.',
          detail:
            'Het kernprobleem: een model delen in een call, geen ZIP. Formaten variëren (GLTF, FBX, OBJ, IFC), en belichting of stadscontext verkoopt de pitch vaak net zo hard als de mesh zelf.',
          mediaAlt: '3D Viewer-productposter — orbit-chrome rond een belicht model',
        },
        wire: {
          title: 'Layout & review-chrome',
          summary: 'Panels, orbit en een pad van openen → begrijpen → beslissen.',
          detail:
            'We vormgeven de interface rond review, niet authorship: frame het asset, wissel omgevingen, houd hotspots en exportpaden vanzelfsprekend. Desktop en web delen hetzelfde mentale model.',
          mediaAlt: 'Productwalkthrough — orbit, HDR-belichting en viewer-chrome',
        },
        engineering: {
          title: 'Engineering',
          summary: 'Three.js-pipeline, HDR-grondprojectie, Streets GL-brug.',
          detail:
            'Echte klantpipelines vragen formaatdekking, betrouwbare stadscontext-sync en texture-restore bij het verlaten van Product ↔ City. Het engineeringverhaal is betrouwbaarheid bij rommelige assets — geen demoleegte.',
          mediaAlt: 'OSM 3D- / Streets GL-stadscontext in de viewer',
        },
        final: {
          title: 'Finale WebGL',
          summary: 'Deelbare browserreview en Windows-desktopbuilds.',
          detail:
            'Live op 3dbviewer.com — orbit onder 360°-HDR met grondprojectie, of Streets GL wanneer de locatie het verhaal is. Dezelfde craft-taal als onze experimenten, verpakt voor beslissingen.',
          mediaAlt: '360°-HDR met grondprojectie — product belicht door de environment plate',
        },
      },
    },
    'black-witness': {
      eyebrow: 'Case study · 360°',
      title: 'The Black Witness — van brief tot 360°',
      lead: 'Hoe een fotografiereeks een geleide WebGPU-panoramatour wordt — hotspots, effectlagen en een visitor-preview die klanten kunnen delen.',
      primaryCtaLabel: 'Visitor-tour openen',
      secondaryCtaLabel: 'Technische write-up',
      stages: {
        brief: {
          title: 'Brief',
          summary: 'Een ravenverhaal dat gasten kunnen bewandelen, niet alleen bekijken.',
          detail:
            'The Black Witness begon als fotografiereeks. Het klantgerichte probleem: die sfeer omzetten in een geleide 360°-ervaring — rondkijken, klikken om te leren, een link delen zonder app te installeren.',
          mediaAlt: 'The Black Witness — dakraaf-still die het 360°-narratief zaait',
        },
        wire: {
          title: 'Tourstructuur',
          summary: 'Hotspots, geleide stops en een visitor-previewpad.',
          detail:
            'We ontwerpen camerabeats en hotspottypes (info, scènelinks, popups) zodat de tour als storyboard leest. Editor en visitor-preview delen één projectbestand — één keer bouwen, een schone preview-URL delen.',
          mediaAlt: 'Geleide tour stap 1 — ravenhotspot en popup op The Black Witness',
        },
        engineering: {
          title: 'Engineering',
          summary: 'Equirectangular bol, WebGPU-effectlagen, projectopslagformaat.',
          detail:
            'Panorama’s liggen op een bolcamera; geleide stappen stapelen particles, spout/water en compute-vogels getimed op hotspots. `.360project` houdt scènes, stops en effecten portable tussen sessies.',
          mediaAlt: 'Stap 2 — particle-/vuurhotspot-beat in de panoramatour',
        },
        final: {
          title: 'Finale 360°',
          summary: 'Deelbare visitor-preview — zonder editor-chrome.',
          detail:
            'Klanten openen een deep-linked preview (yaw / pitch vergrendeld voor een gedeeld eerste frame), spelen de geleide tour of verkennen hotspots vrij. Dezelfde engine als de editor — verpakt voor gasten.',
          mediaAlt: 'Stap 4 — vogellaag en stormhemel-beat op The Black Witness',
        },
      },
    },
  },
}
