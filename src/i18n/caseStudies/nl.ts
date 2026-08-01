import type { CaseStudiesLocalePack } from './types'

export const nlCaseStudies: CaseStudiesLocalePack = {
  studies: {
    '3d-viewer': {
      eyebrow: 'Case study · Software',
      title: '3D Viewer — van brief tot WebGL',
      lead: 'Hoe IOM een reviewprobleem omzet in een verscheepbaar product: de chrome bedraden, de pipeline harden, en klanten een link geven die ze in een call kunnen openen.',
      impact:
        'Stakeholders reviewen complexe modellen in de browser — zonder CAD-licentie — zodat design- en salesbeslissingen in gedeelde calls vooruitgaan in plaats van vast te lopen op bestandsuitwisseling.',
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
      impact:
        'Klanten delen een geleide 360°-walkthrough via URL — zonder installatie — zodat stakeholders het verhaal op elk apparaat ervaren en feedback geven vóór de volgende shoot of launch.',
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
    'message-in-a-bottle': {
      eyebrow: 'Case study · WebGPU',
      title: 'Message in a Bottle — van brief tot open zee',
      lead: 'Hoe IOM een browser-keepsake op levend water bouwt: fles en perkament ensceneren, WebGPU-oceaan en hemel harden, dan een demo leveren die gasten zonder installatie openen.',
      impact:
        'Klanten en gasten beleven een interactief keepsake in de browser — dag/nacht-zee, verzegelde notities en apparaatbewuste kwaliteit — zodat narratieve demo’s echt genoeg zijn om te presenteren, niet alleen te beschrijven.',
      primaryCtaLabel: 'Live demo openen',
      secondaryCtaLabel: 'Experimenten bekijken',
      deliverables: [
        'Deelbare WebGPU open-zee-demo (geen installatie)',
        'Fles- + perkamentcomposer met verzegelde / versleutelde notities',
        'TSL Gerstner-oceaan met schuim, drijfvermogen en zeeleven',
        'Dag/nacht-hemel met kwaliteitsbewuste volumetrische wolken',
        'Low- / Medium- / High-presets voor echte apparaten',
      ],
      stages: {
        brief: {
          title: 'Brief',
          summary: 'Een keepsake dat als open water moet voelen — geen platte skybox.',
          detail:
            'Message in a Bottle vroeg om een browserervaring waarin schrijven en verzegelen van een notitie in een geloofwaardige zee zit: dag/nacht-licht, weer en een fles om te vinden en te openen — zonder installatie.',
          mediaAlt: 'Open-zee-horizontsfeer — de atmosferische brief voor Message in a Bottle',
        },
        wire: {
          title: 'Ervaringslayout',
          summary: 'Fles, perkament en hemelbediening in één kalme compositie.',
          detail:
            'We ensceneren het eerste viewport rond fles en horizon, en leggen daarna composer-UI, kwaliteitsniveaus en tijdsturingen zo dat het verhaal primair blijft.',
          mediaAlt: 'Berichtlayout — perkamentbrief boven de open zee met zee- en hemelbediening naast',
        },
        engineering: {
          title: 'Engineering',
          summary: 'WebGPU-TSL-oceaan, hemelradiatie en kwaliteitsbewuste wolken.',
          detail:
            'Gerstner-swell, domain-warped chop en een TSL-hemel met volumetrische cloud-lods die op Medium/Low terugschalen. Drijfvermogen, zeeleven en versleutelde berichten blijven in hetzelfde framebudget als het water.',
          mediaAlt: 'WebGPU open-zee-render — Gerstner-water, nevel en wolkendichtheid',
        },
        final: {
          title: 'Finale open zee',
          summary: 'Een deelbare WebGPU-demo die gasten in de browser openen.',
          detail:
            'Live onder /demos/message-in-a-bottle/ — schrijf of ontvang een verzegelde notitie op open zee, met dag/nacht-hemel, kwaliteitspresets voor echte apparaten, en de craft-taal van onze experimenten als keepsake.',
          mediaAlt: 'Message in a Bottle — finale open-zee-scène met schuim, nevel en hemel',
        },
      },
    },
  },
}
