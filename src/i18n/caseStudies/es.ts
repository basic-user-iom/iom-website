import type { CaseStudiesLocalePack } from './types'

export const esCaseStudies: CaseStudiesLocalePack = {
  studies: {
    '3d-viewer': {
      eyebrow: 'Caso de estudio · Software',
      title: '3D Viewer — del brief al WebGL',
      lead: 'Cómo IOM convierte un problema de review en un producto entregable: cablear el chrome, endurecer el pipeline y dar a los clientes un enlace que puedan abrir en una llamada.',
      impact:
        'Los stakeholders revisan modelos complejos en el navegador — sin licencia CAD — para que las decisiones de diseño y ventas avancen en llamadas compartidas en lugar de atascarse en intercambios de archivos.',
      primaryCtaLabel: 'Abrir el viewer en vivo',
      secondaryCtaLabel: 'Artículo técnico',
      stages: {
        brief: {
          title: 'Brief',
          summary: 'Los stakeholders necesitan revisar 3D sin una licencia CAD.',
          detail:
            'El problema central: compartir un modelo en una llamada, no un ZIP. Los formatos varían (GLTF, FBX, OBJ, IFC), y la iluminación o el contexto urbano venden el pitch tanto como la malla misma.',
          mediaAlt: 'Póster del producto 3D Viewer — chrome de órbita alrededor de un modelo iluminado',
        },
        wire: {
          title: 'Layout y chrome de review',
          summary: 'Paneles, órbita y un camino de abrir → entender → decidir.',
          detail:
            'Diseñamos la interfaz alrededor del review, no del authoring: enmarcar el asset, cambiar entornos y mantener hotspots y rutas de exportación evidentes. Desktop y web comparten el mismo modelo mental.',
          mediaAlt: 'Recorrido del producto — órbita, iluminación HDR y chrome del viewer',
        },
        engineering: {
          title: 'Ingeniería',
          summary: 'Pipeline Three.js, proyección de suelo HDR, puente Streets GL.',
          detail:
            'Los pipelines reales de clientes necesitan cobertura de formatos, sync fiable del contexto urbano y restauración de texturas al salir de Product ↔ City. La historia de ingeniería es fiabilidad ante assets desordenados — no un vacío de demo.',
          mediaAlt: 'Contexto urbano OSM 3D / Streets GL dentro del viewer',
        },
        final: {
          title: 'WebGL final',
          summary: 'Review en navegador compartible y builds de escritorio Windows.',
          detail:
            'En vivo en 3dbviewer.com — órbita bajo HDR 360° con proyección de suelo, o Streets GL cuando la ubicación es la historia. El mismo lenguaje craft que nuestros experimentos, empaquetado para decidir.',
          mediaAlt: 'HDR 360° con proyección de suelo — producto iluminado por la environment plate',
        },
      },
    },
    'black-witness': {
      eyebrow: 'Caso de estudio · 360°',
      title: 'The Black Witness — del brief al 360°',
      lead: 'Cómo una serie fotográfica se convierte en un tour panorama WebGPU guiado — hotspots, capas de efectos y una preview de visitante que los clientes pueden compartir.',
      impact:
        'Los clientes comparten un walkthrough 360° guiado por URL — sin instalación — para que los stakeholders vivan la narrativa en cualquier dispositivo y den feedback antes del siguiente rodaje o lanzamiento.',
      primaryCtaLabel: 'Abrir el tour de visitante',
      secondaryCtaLabel: 'Artículo técnico',
      stages: {
        brief: {
          title: 'Brief',
          summary: 'Una historia de cuervo que los invitados pueden recorrer, no solo mirar.',
          detail:
            'The Black Witness empezó como una serie fotográfica. El problema orientado al cliente: convertir esa atmósfera en una experiencia 360° guiada — mirar alrededor, hacer clic para aprender, compartir un enlace sin instalar una app.',
          mediaAlt: 'The Black Witness — still del cuervo en la azotea que siembra la narrativa 360°',
        },
        wire: {
          title: 'Estructura del tour',
          summary: 'Hotspots, paradas guiadas y un camino de preview de visitante.',
          detail:
            'Diseñamos beats de cámara y tipos de hotspot (info, enlaces de escena, popups) para que el tour se lea como un storyboard. Editor y preview de visitante comparten un mismo archivo de proyecto — construir una vez, compartir una URL de preview limpia.',
          mediaAlt: 'Tour guiado paso 1 — hotspot de cuervo y popup en The Black Witness',
        },
        engineering: {
          title: 'Ingeniería',
          summary: 'Esfera equirectangular, capas de efectos WebGPU, formato de guardado del proyecto.',
          detail:
            'Los panoramas se mapean sobre una cámara esférica; los pasos guiados apilan partículas, spout/agua y pájaros compute sincronizados con hotspots. `.360project` mantiene escenas, paradas y efectos portables entre sesiones.',
          mediaAlt: 'Paso 2 — beat de hotspot de partículas / fuego en el tour panorama',
        },
        final: {
          title: '360° final',
          summary: 'Preview de visitante compartible — sin chrome del editor.',
          detail:
            'Los clientes abren una preview con deep link (yaw / pitch bloqueados para un primer frame compartido), reproducen el tour guiado o exploran hotspots libremente. El mismo motor que el editor — empaquetado para invitados.',
          mediaAlt: 'Paso 4 — capa de pájaros y beat de cielo de tormenta en The Black Witness',
        },
      },
    },
    'message-in-a-bottle': {
      eyebrow: 'Caso de estudio · WebGPU',
      title: 'Message in a Bottle — del brief al mar abierto',
      lead: 'Cómo IOM construye un recuerdo en el navegador sobre agua viva: escenificar botella y pergamino, endurecer océano y cielo WebGPU, y entregar una demo que los invitados abren sin instalar nada.',
      impact:
        'Clientes e invitados viven un recuerdo interactivo en el navegador — mar día/noche, notas selladas y calidad según el dispositivo — para que las demos narrativas se sientan lo bastante reales para presentar, no solo describir.',
      primaryCtaLabel: 'Abrir demo en vivo',
      secondaryCtaLabel: 'Explorar experimentos',
      deliverables: [
        'Demo WebGPU de mar abierto compartible (sin instalación)',
        'Composer de botella + pergamino con notas selladas / cifradas',
        'Océano Gerstner TSL con espuma, flotabilidad y vida marina',
        'Cielo día/noche con nubes volumétricas según la calidad',
        'Presets Low / Medium / High para dispositivos reales',
      ],
      stages: {
        brief: {
          title: 'Brief',
          summary: 'Un recuerdo que debe sentirse como mar abierto — no un skybox plano.',
          detail:
            'Message in a Bottle necesitaba una experiencia en el navegador donde escribir y sellar una nota viva dentro de un mar creíble: luz día/noche, clima y una botella para encontrar y abrir — sin instalación.',
          mediaAlt: 'Ambiente de horizonte en mar abierto — el brief atmosférico de Message in a Bottle',
        },
        wire: {
          title: 'Diseño de la experiencia',
          summary: 'Botella, pergamino y controles del cielo en una composición calmada.',
          detail:
            'Escenificamos el primer viewport alrededor de la botella y el horizonte, luego apilamos la UI del composer, niveles de calidad y controles de hora para que la narrativa siga siendo primaria.',
          mediaAlt: 'Diseño del mensaje — carta en pergamino sobre el mar abierto con controles de mar y cielo al lado',
        },
        engineering: {
          title: 'Ingeniería',
          summary: 'Océano WebGPU TSL, radiancia del cielo y nubes según la calidad.',
          detail:
            'Oleaje Gerstner, chop domain-warped y cielo TSL con lods de nubes volumétricas que bajan en Medium/Low. Flotabilidad, vida marina y mensajes cifrados se quedan en el mismo presupuesto de frame que el agua.',
          mediaAlt: 'Render WebGPU de mar abierto — agua Gerstner, neblina y controles de densidad de nubes',
        },
        final: {
          title: 'Mar abierto final',
          summary: 'Una demo WebGPU compartible que los invitados abren en el navegador.',
          detail:
            'En vivo en /demos/message-in-a-bottle/ — escribe o recibe una nota sellada en mar abierto, con cielo día/noche, presets de calidad para dispositivos reales y el lenguaje craft de nuestros experimentos empaquetado como recuerdo.',
          mediaAlt: 'Message in a Bottle — escena final de mar abierto con espuma, neblina y cielo',
        },
      },
    },
    'labelled-custom-cursor': {
      eyebrow: 'Caso de estudio · Interacción',
      title: 'Cursor personalizado etiquetado — del brief al lab',
      lead: 'Cómo IOM diseña un puntero contextual: declarar intención en markup, animar tip y anillo con un loop rAF ligero, luego aparcar un lab etiquetado mientras el sitio live se mantiene sereno.',
      impact:
        'Los visitantes reciben affordances hover claras en medios interactivos — VIEW, PLAY, LOOK, ENTER 3D — para que demos y CTA comuniquen antes del clic, sin interferir con campos de texto nativos ni touch.',
      primaryCtaLabel: 'Abrir el lab en vivo',
      secondaryCtaLabel: 'Explorar experimentos',
      deliverables: [
        'Lab de cursor etiquetado compartible (playground + panel de uso en vivo)',
        'Vocabulario markup data-cursor / data-cursor-label',
        'Tip de precisión + anillo inercial (lerp rAF, sin GSAP)',
        'Fallback nativo para touch, formularios y punteros gruesos',
        'Orbe focus serena en tarjetas de inicio; modos etiquetados para CTA y medios',
      ],
      stages: {
        brief: {
          title: 'Brief',
          summary: 'Los medios interactivos necesitan un puntero que hable intención — no una flecha genérica.',
          detail:
            'En un portfolio de 3D, vídeo y 360°, el hover debe sugerir qué sigue: VIEW un proyecto, PLAY un medio, LOOK un panorama, ENTER 3D. El cursor del sistema no lleva ese vocabulario sin labels y motion alineados a la marca.',
          mediaAlt: 'Lab de cursor etiquetado — objetivos del playground y panel de uso idle',
        },
        wire: {
          title: 'Diseño de interacción',
          summary: 'Modos impulsados por markup: data-cursor más labels opcionales.',
          detail:
            'Los objetivos declaran intención en HTML — explore, view, play, look, drag, start, external, link, native. Labels custom (ENTER 3D) sustituyen los defaults. El lab refleja el markup de producción: al pasar el cursor se actualiza un panel de uso en vivo con el snippet correspondiente.',
          mediaAlt: 'Hover ENTER 3D — el panel de uso muestra el markup data-cursor explore',
        },
        engineering: {
          title: 'Ingeniería',
          summary: 'Tip de precisión, anillo inercial, lerp rAF — sin GSAP.',
          detail:
            'Un loop requestAnimationFrame ligero sigue al puntero con tip rápido (~0.55) y anillo más suave (~0.16). La resolución de objetivo recorre el DOM por data-cursor / anclas / inputs; touch y formularios vuelven al cursor nativo.',
          mediaAlt: 'Modo LOOK activo — el panel de código se sincroniza al markup del panorama',
        },
        final: {
          title: 'Entregables',
          summary: 'Un lab etiquetado compartible — y una orbe focus más serena en el sitio live.',
          detail:
            'En vivo en /demos/custom-cursor-labelled/ con snapshot de fuente aparcado. Las tarjetas de inicio usan una orbe focus cyan serena; el set etiquetado queda para demos, CTA, transporte y enlaces externos.',
          mediaAlt: 'Demo de cursor etiquetado — playground y panel de código de uso en vivo',
        },
      },
    },
  },
}
