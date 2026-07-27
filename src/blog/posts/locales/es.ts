/* Auto-assembled by scripts/assemble-blog-locale-packs.mjs — do not hand-edit large blocks */
import type { DemoPostLocalePack } from './types'

export const esDemoBlogPosts: DemoPostLocalePack = {
  "3d-viewer": {
    pageTitle: "3D Viewer — modelos de producto en el navegador",
    demoLabel: "3D Viewer",
    heroVideoCaption: "Recorrido del producto — órbita, iluminación HDR y chrome del visor",
    excerpt: `Lanzamiento desktop v3.19.2: fiabilidad y calidad de textura Streets GL, restauración de textura en modo Product tras teardown City, cabeceras de panel unificadas — más revisión GLTF/FBX/OBJ/IFC con proyección de suelo HDR y Streets GL.`,
    seo_title: "3D Viewer v3.19.2 — texturas y fiabilidad Streets GL — IOM",
    seo_description: `3D Viewer v3.19.2 para Windows (Setup + Portable): correcciones vertex-budget/simplify Streets GL, texturas 4k preservando UV, restauración de textura modo Product y cabeceras FloatingPanelHeader unificadas. Revisión en navegador para GLTF/FBX/OBJ/IFC con HDR y Streets GL.`,
    hook: `Los clientes no deberían necesitar un puesto CAD para revisar un modelo. Nuestro 3D Viewer coloca GLTF, FBX, OBJ e IFC en una ventana de navegador (y escritorio) compartible — órbita, inspección de materiales, iluminación 360° HDR y proyección de suelo, o colocar el mesh en contexto urbano OSM / Streets GL cuando la ubicación cuenta la historia.`,
    coverNote: `Un breve recorrido abre el artículo; los stills siguientes muestran proyección de suelo HDR 360° y contexto urbano OSM 3D / Streets GL dentro del mismo visor.`,
    whatYouSeeIntro: `Dos capacidades que venden el modelo más allá del vacío gris — iluminación HDR cinematográfica, luego tejido urbano real:`,
    whyBullets: [
      `- **Comparte un enlace, no un ZIP** — los stakeholders abren el modelo en un portátil durante una llamada`,
      "- **Un visor para muchos formatos** — menos correos de «¿qué app abre esto?»",
      `- **360° HDR + proyección de suelo** — iluminación real y sombras de contacto para anclar el producto a la plate`,
      `- **OSM 3D / Streets GL dentro del visor** — combinar contexto urbano con tus modelos cuando la calle vende el pitch`,
    ],
    whyUses: `configuradores de producto, colocaciones de arquitectura y exteriores, tablets de feria, aprobaciones de cliente asíncronas y presentaciones web independientes exportadas desde la misma pipeline.`,
    beginner: `Un visor 3D es como una foto de tu producto que puedes girar. En lugar de imágenes planas, el modelo real está en la página — arrastra para girar, zoom en detalles, envuélvelo en luz HDR o colócalo en una ciudad OpenStreetMap real cuando necesites «¿dónde encaja?». Sin instalación para la build web; una build desktop Windows cubre offline o assets pesados.`,
    glossary: [
      {
        term: "GLTF / GLB",
        def: "formatos 3D web habituales ([Khronos glTF](https://www.khronos.org/gltf/))",
      },
      {
        term: "Orbit",
        def: "arrastrar para rotar la cámara alrededor del modelo",
      },
      {
        term: "Entorno HDR 360°",
        def: "envoltura de alto rango dinámico que ilumina el modelo desde cielo/escena real",
      },
      {
        term: "Proyección de suelo",
        def: "proyectar el HDR sobre el plano del suelo para sombras y reflejos coherentes",
      },
      {
        term: "OSM 3D / Streets GL",
        def: `contexto urbano 3D derivado de OpenStreetMap combinable con tus modelos en el visor ([streets.gl](https://streets.gl/))`,
      },
      {
        term: "Hotspot",
        def: "marcador clicable en el modelo con info o enlace",
      },
    ],
    trySteps: [
      `Abre el [sitio 3D Viewer](https://3dbviewer.com/) o descarga Setup / Portable Windows desde la [release v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)`,
      "Carga una muestra o tu propio GLTF/GLB si la build permite importación",
      `Prueba un entorno HDR 360° con proyección de suelo — observa cómo las sombras de contacto anclan el producto a la plate`,
      "Abre OSM 3D / Streets GL e imagina (o coloca) tu modelo en tejido urbano real",
    ],
    requirements: [
      "**Navegador:** Chrome, Edge o Firefox modernos para la build web",
      `**Desktop Windows:** Setup o Portable desde [GitHub Releases v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2) (Electron 41)`,
      `**Archivos:** preferir GLB/GLTF para web; CAD pesado puede requerir conversión previa`,
      `**GPU:** path tracing y capas urbanas densas quieren una GPU decente — modos ligeros en dispositivos modestos`,
    ],
    viewA: {
      caption: `HDR 360° con proyección de suelo — producto iluminado por la plate, sombras legibles en asfalto`,
    },
    viewB: {
      caption: `OSM 3D / Streets GL dentro del visor — contexto urbano combinable con tus modelos`,
    },
    alsoCan: [
      "Cambiar entornos HDR y hora del día para distintos ambientes",
      `Usar path tracing para stills cuando la calidad supera la velocidad en tiempo real`,
      `Mezclar modos Product / City / Hybrid al revisar colocaciones exteriores o urbanas`,
      "Exportar una presentación web independiente para entrega al cliente",
    ],
    howWorks: `El visor está construido sobre la familia [Three.js](https://threejs.org/) con foco en revisión práctica: cargar meshes, encuadrarlas, iluminarlas con HDR + proyección de suelo y — cuando el brief necesita una calle — abrir contexto urbano OSM 3D / Streets GL en el mismo chrome. Las builds desktop extienden la misma idea offline o con assets grandes. El soporte de formatos sigue pipelines reales de clientes — el objetivo es siempre «abrir, entender, decidir.» Producto live: [3dbviewer.com](https://3dbviewer.com/).`,
    whatsNew: {
      heading: "Novedades en v3.19.2",
      body: `Fiabilidad del bridge Streets GL y calidad de textura, más pulido del modo Product:

- **Sync Streets GL** — simplify vertex-budget que preserva UV para que coches y meshes grandes aterricen con fiabilidad en contexto urbano
- **Mejores texturas en City** — transferencia binaria de textura hasta 4k con ajuste automático de payload para mapas Meshy grandes
- **Restore modo Product** — las texturas ya no desaparecen tras teardown Streets GL / City
- **Cabeceras de panel unificadas** — chrome FloatingPanelHeader compartido en paneles del editor

**Descarga (Windows x64):** [Setup](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Setup-3.19.2-x64.exe) | [Portable](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Portable-3.19.2-x64.exe) | [Notas de release](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)`,
    },
    faq: [
      {
        q: "¿Los clientes necesitan software CAD?",
        a: "No para revisión — un enlace de navegador basta a la mayoría de stakeholders.",
      },
      {
        q: "¿Podemos mostrar el modelo en una calle real?",
        a: `Sí — OSM 3D / Streets GL corre dentro del visor para combinar contexto urbano con tu GLB/GLTF.`,
      },
      {
        q: "¿Dónde obtengo la build desktop Windows?",
        a: `Instaladores Setup y Portable están en la [release GitHub v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2), también enlazada desde [3dbviewer.com](https://3dbviewer.com/).`,
      },
      {
        q: "¿Podemos brandearlo?",
        a: "Sí. Chrome del visor, entornos y contenido hotspot pueden seguir tu marca.",
      },
    ],
    reading: [
      {
        label: "3D Viewer live",
        url: "https://3dbviewer.com/",
      },
      {
        label: "Descargas Windows v3.19.2",
        url: "https://github.com/basic-user-iom/3d/releases/tag/v3.19.2",
      },
      {
        label: "Resumen glTF — Khronos",
        url: "https://www.khronos.org/gltf/",
      },
      {
        label: "Mapa live Streets GL",
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
        label: "Iluminación volumétrica",
        url: "/blog/volume-lighting",
      },
    ],
  },
  "streets-gl-bridge": {
    pageTitle: "Streets GL Bridge — contexto urbano OSM para modelos 3D",
    demoLabel: "Streets GL Bridge",
    hook: `Un modelo bonito aún necesita un lugar donde apoyarse. Streets GL Bridge explora el contexto urbano 3D de OpenStreetMap como capa de suelo — para que assets geolocalizados queden en un paisaje urbano reconocible en lugar de un vacío.`,
    coverNote: "La portada muestra el encuadre mapa/bridge usado en la tarjeta del portfolio.",
    whyBullets: [
      `- **La ubicación vende la historia** — los clientes reconocen la manzana, no solo el mesh`,
      "- **Datos cartográficos abiertos** — OSM como capa urbana viva bajo tu asset",
      "- **Mentalidad bridge** — conectar tu pipeline de modelos a un suelo navegable",
      "- **ADN open source** — construido alrededor del ecosistema Streets GL",
    ],
    whyUses: `propuestas urbanas, slides de contexto de sitio, previews de producto o arquitectura geolocalizadas y conversaciones de «¿dónde encaja en la calle?» antes de un build GIS completo.`,
    beginner: `Piensa en vibes de Google Earth, pero orientado a colocar tu objeto 3D en una cuadrícula de calles real. El mapa es el escenario; el modelo el actor. Orbitas y exploras en lugar de mirar un suelo gris infinito.`,
    glossary: [
      {
        term: "OSM",
        def: `OpenStreetMap — datos cartográficos comunitarios ([openstreetmap.org](https://www.openstreetmap.org/))`,
      },
      {
        term: "Capa de suelo",
        def: "ciudad, carreteras y terreno bajo tu modelo",
      },
      {
        term: "Geolocalizado",
        def: "colocado en latitud/longitud real en la Tierra",
      },
      {
        term: "WebGL",
        def: `API GPU del navegador que dibuja el mapa 3D ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API))`,
      },
    ],
    trySteps: [
      "Abre la [demo Streets GL Bridge](/demos/streets-gl/)",
      "Espera a que el embed del mapa se estabilice",
      `Pan y zoom del contexto urbano (o compara con el [mapa live Streets GL](https://streets.gl/))`,
      "Imagina colocar un edificio de cliente o un quiosco en una esquina conocida",
    ],
    requirements: [
      "**Red:** tiles del mapa y el embed requieren conexión",
      "**Navegador:** Chromium moderno recomendado para vistas de mapa WebGL",
      `**Rendimiento:** ciudades densas son más pesadas — acerca zoom para exploración más fluida`,
    ],
    viewA: {
      caption: "Tejido urbano — calles y volumetría como contexto",
    },
    viewB: {
      caption: "Lectura urbana más cercana — dónde quedaría un modelo",
    },
    alsoCan: [
      "Usar como capa de referencia al colocar GLB geolocalizados",
      "Dirigir stakeholders al mapa live [streets.gl](https://streets.gl/)",
      "Emparejar con conceptos Simple 3D Buildings de OSM",
    ],
    howWorks: `Streets GL renderiza estructura urbana 3D derivada de OSM en el navegador. Nuestra página bridge aloja ese contexto para workflows IOM — una capa práctica de «¿dónde encaja?» en lugar de una suite GIS completa. Proyecto upstream: [StrandedKitty/streets-gl](https://github.com/StrandedKitty/streets-gl); mapa live en [streets.gl](https://streets.gl/).`,
    faq: [
      {
        q: "¿Es Google Maps?",
        a: "No — se basa en OpenStreetMap y las herramientas abiertas Streets GL.",
      },
      {
        q: "¿Podemos colocar nuestro edificio?",
        a: `Esa es la intención del bridge: modelos geolocalizados sobre contexto urbano. Pídenos una integración acotada.`,
      },
    ],
    reading: [
      {
        label: "Mapa live Streets GL",
        url: "https://streets.gl/",
      },
      {
        label: "streets-gl en GitHub",
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
    pageTitle: "360° Panorama Tour Editor — crear recorridos guiados en el navegador",
    demoLabel: "360° Panorama Tour Editor",
    hook: `Los visitantes de feria recuerdan experiencias. Este editor carga panoramas equirectangulares, coloca hotspots, encadena tours multi-escena y guarda un \`.360project\` — todo en el navegador, abriendo en The Black Witness por defecto.`,
    coverNote: `La portada es el paso 1 del tour guiado en The Black Witness — hotspot cuervo + popup.`,
    whyBullets: [
      `- **Editor + visitante en un stack** — construye el tour, luego comparte un enlace preview`,
      "- **Hotspots que explican** — info, enlaces de escena y popups iframe opcionales",
      "- **Tours multi-escena** — llevar invitados de stand a línea de producto a venue",
      `- **Archivos de proyecto que conservas** — guardar y recargar \`.360project\` entre sesiones`,
    ],
    whyUses: `acompañantes de feria, walkthroughs de venue, historias de línea de producto, soft launches de museo y aprobaciones de cliente antes de un build de tour de producción.`,
    beginner: `Un panorama 360° es una foto que te envuelve por completo — como estar en el centro de una habitación. El editor convierte esas fotos en un tour: marcadores clicables (hotspots), enlaces entre salas y un recorrido que los invitados siguen sin descargar una app.`,
    glossary: [
      {
        term: "Equirectangular",
        def: "disposición de imagen 360° habitual (esfera completa aplanada en rectángulo)",
      },
      {
        term: "Hotspot",
        def: "marcador clicable — info, salto de escena o URL/iframe",
      },
      {
        term: "Tour guiado",
        def: "secuencia scriptada de paradas de cámara, popups y efectos opcionales",
      },
      {
        term: ".360project",
        def: "archivo de guardado IOM para panoramas, hotspots y ajustes de tour",
      },
      {
        term: "WebGPU birds",
        def: "efecto de bandada opcional en el tour (respaldado por GPU)",
      },
    ],
    trySteps: [
      `Abre el [360° Panorama Tour Editor](/demos/panorama-360/) (o [preview visitante](/demos/panorama-360/?mode=preview))`,
      "Haz clic en **Play guided tour** y sigue los cuatro pasos Black Witness",
      "Detén el tour y haz clic en hotspots tú mismo — cuervo, fuego, agua, pájaros",
      "En el editor, selecciona cada fila STEPS para saltar la cámara y editar ese beat",
    ],
    requirements: [
      `**Navegador:** Chrome o Edge modernos recomendados; funciones WebGPU requieren GPU capaz`,
      `**Imágenes:** JPG, PNG, WebP equirectangulares; HDR/EXR/KTX2 cuando la pipeline los soporte`,
      "**Móvil:** la visualización funciona; la edición es más cómoda en desktop",
    ],
    viewA: {
      caption: "Paso 2 — hotspot de fuego animado y popup de partículas",
    },
    viewB: {
      caption: "Paso 3 — beat agua / spout en la azotea",
    },
    viewC: {
      caption: "Paso 4 — popup Animated birds con la bandada contra el cielo tormentoso",
    },
    alsoCan: [
      "Encadenar varios panoramas en un tour multi-escena guiado",
      "Añadir popups URL o iframe en hotspots para páginas de producto o embeds",
      `Superponer [partículas](/blog/webgpu-particles), [spout](/blog/spout) y [pájaros](/blog/webgpu-compute-birds) en pasos guiados 2–4`,
    ],
    howWorks: `Los panoramas se mapean sobre una esfera (o pipeline cube) para que la cámara quede en el centro — el enfoque web 360 clásico con [Three.js](https://threejs.org/) y APIs modernas del navegador ([WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) / [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) opcional). Los hotspots son metadatos de escena: posición, tipo y destino. Los pasos de tour guiado en The Black Witness conectan las mismas demos de efecto en beats interactivos — Paso 2 \`+particles\` ([WebGPU Particles](/blog/webgpu-particles)), Paso 3 \`+particles/spout\` ([Spout](/blog/spout)), Paso 4 \`+birds\` ([WebGPU Compute Birds](/blog/webgpu-compute-birds)) — cada uno con \`hotspot+popup\` para que movimiento e historia clicable lleguen juntos. Preview visitante es el mismo motor sin chrome del editor — ver [tour The Black Witness](/blog/panorama-suite).`,
    faq: [
      {
        q: "¿Los invitados necesitan una app?",
        a: `No. Comparte un enlace de navegador. El modo preview oculta el editor para que los visitantes solo vean el tour.`,
      },
      {
        q: "¿Podemos usar nuestros propios panoramas?",
        a: `Sí — carga stills equirectangulares en el editor y construye hotspots alrededor de tu venue o producto.`,
      },
      {
        q: "¿Cómo conectan partículas, spout y pájaros con el tour?",
        a: `Son capas de efecto opcionales en pasos guiados 2–4. Cada paso empareja parada de cámara, efecto y popup hotspot — explora las demos standalone, luego Play guided tour en /demos/panorama-360/.`,
      },
    ],
    reading: [
      {
        label: "Editor de tour live",
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
        label: "The Black Witness — Tour 360°",
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
    pageTitle: "CRM Demo — prueba el sandbox de cliente IOM",
    demoLabel: "CRM Demo",
    hook: `¿Quieres ver cómo IOM gestiona leads, proyectos y tiempo sin tocar datos de cliente live? La CRM Demo es un sandbox interactivo con empresas ficticias — pipeline, boards, ideas y borradores de blog que permanecen en esta pestaña del navegador.`,
    coverNote: "La portada muestra la UI sandbox CRM de la tarjeta del portfolio.",
    whyBullets: [
      `- **Seguro hacer clic en todo** — las ediciones nunca tocan bases de datos de producción`,
      `- **Sensación de workspace completo** — leads, proyectos, tiempo, ideas y posts de blog de ejemplo`,
      "- **Pitch en reunión** — abre `/crm-demo` y recorre el flujo en vivo",
      `- **Misma familia de producto** — refleja la CRM real de cliente en \`/client-login\``,
    ],
    whyUses: `demos comerciales, walkthroughs de onboarding, formación de stakeholders y conversaciones de «¿cómo se vería nuestro pipeline?» antes de provisionar un workspace real.`,
    beginner: `Un CRM (customer relationship management) es donde un estudio rastrea quién consultó, qué proyectos están activos y cómo se gasta el tiempo. Esta demo es una cocina de práctica: las recetas son reales, los ingredientes ficticios, y nada de lo que escribes sale de tu pestaña salvo que lo exportes tú.`,
    glossary: [
      {
        term: "Sandbox",
        def: "copia de práctica de la app con datos falsos que resetea con seguridad",
      },
      {
        term: "Pipeline",
        def: "etapas por las que pasa un lead antes de convertirse en proyecto",
      },
      {
        term: "In-memory",
        def: "los datos viven en esta sesión del navegador, no en el servidor live",
      },
      {
        term: "Client login",
        def: "la CRM real en `/client-login` con datos respaldados por Supabase",
      },
    ],
    trySteps: [
      "Abre la [CRM Demo](/crm-demo)",
      "Explora Leads o Projects — abre una ficha de empresa ficticia",
      "Haz una pequeña edición (estado, nota o tarjeta de board) para sentir el sandbox",
      "Opcional: abre Blog en la demo CRM y previsualiza un post de ejemplo",
    ],
    requirements: [
      `**Navegador:** cualquier navegador desktop moderno; ventana ancha ayuda para boards`,
      `**Privacidad:** datos sandbox locales a la pestaña — refresh puede resetear el store`,
      `**No producción:** nunca introduzcas secretos reales de cliente; usa \`/client-login\` para trabajo live`,
    ],
    viewA: {
      caption: "Vista pipeline — leads ficticios en columnas de etapa",
    },
    viewB: {
      caption: "Board de proyecto — tareas y contexto para una empresa demo",
    },
    alsoCan: [
      "Explorar seguimiento de tiempo y mapas de ideas con entradas de ejemplo",
      "Resetear el workspace demo para empezar limpio",
      "Comparar la sensación sandbox con la CRM real tras login",
    ],
    howWorks: `La [CRM demo](/crm-demo) pública usa un store in-memory para que cada clic sea desechable. La CRM de producción en \`/client-login\` habla con Supabase para datos reales de staff y clientes. Mismo lenguaje UI, backend distinto — así un pitch nunca arriesga un registro live.`,
    faq: [
      {
        q: "¿Mis ediciones aparecen para otros visitantes?",
        a: `No. El sandbox es por pestaña / sesión del navegador. Cada uno ve su propia copia de los datos ficticios.`,
      },
      {
        q: "¿Es lo mismo que client login?",
        a: `Misma familia de producto y pantallas, pero \`/crm-demo\` nunca toca bases live. El trabajo real ocurre en \`/client-login\`.`,
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
        label: "Inicio IOM",
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
    pageTitle: "Image Prep — redimensionar, comprimir y eliminar EXIF en el navegador",
    demoLabel: "Image Prep",
    hook: `Las imágenes de portfolio y web deben ser nítidas, ligeras y privadas. Image Prep redimensiona a presets habituales, comprime JPEG/WebP/PNG y elimina EXIF de cámara/GPS — los archivos permanecen en tu dispositivo hasta que descargues el resultado.`,
    coverNote: "La portada muestra la UI de la herramienta Image Prep de la tarjeta de software.",
    whyBullets: [
      `- **Permanecer on-device** — sin subir a un servidor desconocido para un resize rápido`,
      "- **Presets web-ready** — tamaños portfolio y sitio sin acrobacias de Photoshop",
      `- **Privacidad por defecto** — eliminar EXIF para que GPS y metadatos de cámara no filtren`,
      `- **Menos peso, misma historia** — comprimir para páginas más rápidas y facturas CDN más ligeras`,
    ],
    whyUses: `preparar stills hero, subidas de galería, portadas CRM/blog y paquetes de entrega al cliente antes de llegar a un CMS o página demo.`,
    beginner: `Antes de que una foto vaya a un sitio web, suele necesitar tres favores: el tamaño de píxeles correcto, un archivo más pequeño y menos datos personales en la cabecera. Image Prep los hace en el navegador — arrastra una imagen, elige un preset, descarga una versión más limpia.`,
    glossary: [
      {
        term: "EXIF",
        def: "metadatos que las cámaras incrustan (ajustes, marcas de tiempo, a veces GPS)",
      },
      {
        term: "Comprimir",
        def: "reducir tamaño de archivo, a menudo con control de calidad",
      },
      {
        term: "WebP",
        def: "formato de imagen moderno a menudo más pequeño que JPEG a calidad similar",
      },
      {
        term: "On-device",
        def: "el procesamiento ocurre en tu navegador; tú eliges cuándo descargar",
      },
    ],
    trySteps: [
      "Abre [Image Prep](/tools/image-prep)",
      "Suelta un JPG o PNG de tu máquina",
      "Elige un preset de resize y formato (JPEG / WebP / PNG)",
      "Activa eliminación EXIF si hace falta, luego descarga el resultado",
    ],
    requirements: [
      "**Navegador:** Chrome, Edge o Firefox modernos con soporte canvas",
      "**Privacidad:** procesamiento local — evita pegar secretos en otros campos",
      `**Límites:** RAW extremadamente grandes pueden necesitar un primer paso en editor desktop`,
    ],
    viewA: {
      caption: "Layout de herramienta — imagen fuente y controles prep",
    },
    viewB: {
      caption: "Tras prep — salida web-ready lista para descargar",
    },
    alsoCan: [
      "Procesar en lote algunos stills de portfolio al mismo preset",
      "Exportar WebP cuando el sitio destino lo soporte",
      "Usar antes de subir portadas para posts de blog o demo CRM",
    ],
    howWorks: `La herramienta usa APIs del navegador (canvas / decodificación de imagen) para redimensionar y recodificar en tu máquina. La eliminación EXIF quita metadatos incrustados para que los archivos publicados no lleven GPS o números de serie de cámara por accidente. Contexto de formatos: [MDN — Using files from web applications](https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications) y [EXIF — Wikipedia](https://en.wikipedia.org/wiki/Exif).`,
    faq: [
      {
        q: "¿Mis fotos se suben a servidores IOM?",
        a: `No en prep normal — el trabajo permanece en el navegador hasta que descargues. Usa esa descarga como el archivo que publicas en otro sitio.`,
      },
      {
        q: "¿Empeorará la calidad?",
        a: `La compresión siempre intercambia tamaño por fidelidad. Empieza con preset de alta calidad; baja solo si el archivo sigue pesado.`,
      },
    ],
    reading: [
      {
        label: "Herramienta Image Prep",
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
    pageTitle: "Raven Path Animation — vuelo spline en el navegador",
    demoLabel: "Raven Path Animation",
    hook: `A veces la historia es el movimiento, no la imagen fija. Raven Path coloca un GLB alado en una spline Catmull-Rom — arrastra puntos de control, ajusta velocidad y easing, invierte la ruta y mantén la animación de aleteo mientras el ave sigue el camino.`,
    excerpt: `Anima un cuervo (o tu propio GLB) a lo largo de una spline editable — exporta JSON del camino para otro software, reimporta en la próxima visita y ajusta el timing en el navegador.`,
    seo_title: "Raven Path Animation — vuelo spline y exportación de camino — IOM",
    seo_description: `Prueba la demo Raven Path de IOM: vuelo Catmull-Rom editable, importación GLB/GLTF/FBX, exportación/reimportación JSON del camino y guía para principiantes en la sección 3D.`,
    coverNote: "La portada muestra al cuervo en su trayectoria de vuelo editable.",
    whyBullets: [
      `- **Camino como herramienta de diseño** — remodela el vuelo con puntos de control visibles`,
      "- **Trae tu propio modelo** — importa GLB, GLTF o FBX al mismo camino",
      `- **Exporta y reimporta el camino** — JSON para otro software o tu próxima sesión`,
      `- **Timing que se siente** — velocidad, ease-in/out, reverse y tangente vs. rumbo fijo`,
    ],
    whyUses: `bucles hero para films de marca, attract loops de stand, capítulos web narrativos, prototipado de caminos de «viaje» de criatura o producto antes de un pase de animación completo, y entrega de JSON de camino reutilizable a otras pipelines.`,
    beginner: `Una spline es una curva suave definida por unos pocos handles — como un alambre flexible en el espacio. Aquí un cuervo (o tu modelo importado) recorre ese alambre. Tiras de los handles y el vuelo se actualiza en directo. Sin edición de vídeo; el camino es la edición. Cuando te guste la ruta, expórtala como JSON y cárgala después — o usa los puntos en otras herramientas.`,
    glossary: [
      {
        term: "Catmull-Rom spline",
        def: `una curva suave que pasa por los puntos de control ([Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline))`,
      },
      {
        term: "GLB / GLTF / FBX",
        def: "formatos de modelo 3D habituales importables al camino",
      },
      {
        term: "Path JSON",
        def: `puntos de control exportados (y opciones) reimportables en el sitio o usables en otro lugar`,
      },
      {
        term: "Tangent-aligned",
        def: "el modelo gira para mirar a lo largo de la dirección del camino",
      },
      {
        term: "Skeletal animation",
        def: `los huesos impulsan movimiento secundario (como el aleteo) mientras la raíz sigue la curva`,
      },
    ],
    trySteps: [
      "Abre la [demo Raven Path](/demos/raven-path/)",
      `Mira una vuelta, luego arrastra un punto de control de la spline y observa cómo se remodela la ruta`,
      `En **Path**: **Export path JSON**, luego **Import path JSON** (o arrastra el archivo a la escena)`,
      `Opcional: **Import GLB / GLTF / FBX**, luego ajusta velocidad, ease, reverse u orientación tangente`,
    ],
    requirements: [
      "**Navegador:** Chrome, Edge o Firefox moderno con WebGL",
      "**GPU:** gráficos integrados suelen bastar para esta escena",
      "**Entrada:** ratón o trackpad facilitan editar puntos frente al móvil",
      `**Archivos:** prefiere GLB autocontenido para modelos; los archivos de camino son JSON`,
    ],
    viewA: {
      caption: "Vista amplia del camino — curva y cuervo en un mismo frame",
    },
    viewB: {
      caption: "Vuelo más cercano — pose de ala a lo largo de la spline",
    },
    alsoCan: [
      "Copia el snippet THREE.Vector3 del panel Path para herramientas Three.js propias",
      "Compara con el experimento [spline editor](/demos/spline-editor/) relacionado",
      `Estudia modificadores de curva en la [demo WebGPU curve](/demos/webgpu-modifier-curve/)`,
      "Reutiliza la idea de camino para «tours» de producto o fly-throughs de cámara",
    ],
    howWorks: `La demo usa [Three.js](https://threejs.org/) para muestrear una curva Catmull-Rom cada frame, colocar la raíz del modelo en esa muestra y, opcionalmente, alinear su eje forward a la tangente de la curva mientras un clip esquelético (si existe) impulsa movimiento secundario. Path JSON almacena puntos de control, bucle cerrado y transform del camino para reimportar en la [demo en vivo](/demos/raven-path/) o alimentar otro software. Misma familia de ideas que los ejemplos de curvas y animación three.js — aquí afinada para un bucle de criatura legible con importación y exportación.`,
    faq: [
      {
        q: "¿Podemos cambiar el cuervo por nuestra mascota?",
        a: `Sí — usa **Import GLB / GLTF / FBX** en la demo para probar tu modelo en el camino al instante. Para una build de producción con marca, pídenos una versión scoped.`,
      },
      {
        q: "¿Cómo reutilizo un camino después o en otro software?",
        a: `Usa **Export path JSON** en el panel Path. Reimporta ese archivo la próxima vez en el sitio, o usa los campos \`points\` / \`threeJsSnippet\` en Blender, Three.js o tus propias herramientas.`,
      },
      {
        q: "¿Es vídeo o tiempo real?",
        a: `WebGL en tiempo real. Puedes grabar pantalla o exportar en otro sitio, pero la demo en sí es una escena en vivo.`,
      },
    ],
    reading: [
      {
        label: "Demo Raven Path",
        url: "/demos/raven-path/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "Spline Catmull–Rom — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline",
      },
      {
        label: "WebGL — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API",
      },
      {
        label: "Spline editor (relacionado)",
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
    pageTitle: "Artist Globe — un mapa vivo de la práctica creativa",
    demoLabel: "Artist Globe",
    hook: `Los portfolios se dispersan por la web; la geografía sigue importando. Artist Globe es una Tierra WebGL interactiva de fotógrafos, pintores, escultores, artistas sonoros y más — filtra por práctica, abre perfiles, resalta países y envía una ficha para revisión.`,
    coverNote: "La portada muestra el globo con marcadores de artistas de la tarjeta 3D.",
    whyBullets: [
      "- **Descubrir por lugar** — gira el mundo en lugar de scroll infinito de grids",
      "- **Filtrar por práctica** — fotógrafos, pintores, escultores, sonido y más",
      "- **Abrir portfolios reales** — salta de un marcador a los enlaces de un artista",
      "- **Bucle comunitario** — envía un perfil para revisión cuando quieras aparecer",
    ],
    whyUses: `descubrimiento cultural, scouting de residencias y festivales, networking de estudio, y features de portfolio que necesitan una capa espacial «¿quién está dónde?».`,
    beginner: `Piensa en un globo de escritorio con pins para artistas. Lo giras, filtras quién aparece y clicas un pin para saber más. Es un mapa de personas y prácticas, no un checkout de tienda.`,
    glossary: [
      {
        term: "WebGL globe",
        def: `una Tierra 3D dibujada en el navegador con gráficos tipo [Three.js](https://threejs.org/)`,
      },
      {
        term: "Practice filter",
        def: "muestra solo ciertas disciplinas (p. ej. fotografía)",
      },
      {
        term: "Profile",
        def: "una ficha de artista con enlaces y resaltado de país",
      },
      {
        term: "Submit for review",
        def: "solicitud de alta; editores aprueban antes de publicar",
      },
    ],
    trySteps: [
      "Abre [Artist Globe](/artist-globe)",
      "Arrastra para girar; scroll o pellizca para acercar a una región",
      "Usa filtros de práctica para acotar quién aparece",
      `Clic en un marcador para abrir un perfil, o sigue el flujo de envío si quieres solicitar`,
    ],
    requirements: [
      "**Navegador:** navegador desktop o móvil moderno con WebGL",
      "**Red:** perfiles y assets del mapa requieren conexión",
      `**Rendimiento:** reduce otras pestañas GPU si el globo pesa en portátiles antiguos`,
    ],
    viewA: {
      caption: "Globo completo — marcadores en continentes",
    },
    viewB: {
      caption: "Enfoque regional — resaltado de país y práctica seleccionada",
    },
    alsoCan: [
      "Resalta un país al presentar una cohorte regional",
      "Comparte `/artist-globe` como landing de descubrimiento",
      "Existe modo embed-friendly para marcos de portfolio más ajustados (`?embed=1`)",
    ],
    howWorks: `El globo es una escena [Three.js](https://threejs.org/) / [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API): una esfera texturizada, controles de cámara y sprites o meshes marcadores ligados a lat/lon. Datos de perfil y envíos pasan por el stack web IOM para que el mapa siga curado en lugar de un free-for-all sin moderar.`,
    faq: [
      {
        q: "¿Cualquiera puede aparecer en el globo?",
        a: "Las fichas pasan por envío y revisión para que el mapa siga útil y fiable.",
      },
      {
        q: "¿Es una red social?",
        a: `No — es un mapa de descubrimiento de prácticas creativas con enlaces a portfolios.`,
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
        label: "Sección 3D IOM",
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
    hook: `Suelos brillantes y cristal solo se sienten reales si los reflejos aguantan. Esta demo galería ejecuta screen-space reflections WebGPU con denoise espaciotemporal — importa GLTF/FBX, cambia cielos HDR/EXR, camina en third person y compara reflejos crudos vs. limpios.`,
    coverNote: "La portada muestra el espacio galería con reflejos denoised.",
    whyBullets: [
      "- **Reflejos que aguantan** — SSR con denoise en lugar de una mancha borrosa",
      "- **Trae tu propio modelo** — carga GLTF/FBX en la shell galería",
      "- **Cambia el cielo** — panoramas HDR/EXR cambian el mood en segundos",
      `- **Recorre el espacio** — exploración third person para lectura a escala cliente`,
    ],
    whyUses: `viz de producto interior, pitches de galería y showroom, revisiones de material, y conversaciones R&D WebGPU sobre calidad de reflejo vs. framerate.`,
    beginner: `Las screen-space reflections (SSR) simulan espejos y suelos brillantes reutilizando lo que la cámara ya ve, en lugar de renderizar un segundo mundo completo. Puede verse ruidoso. Denoise es el pase de limpieza que convierte ruido chispeante en reflejo estable — más cerca de la iluminación cinematográfica, aún en directo.`,
    glossary: [
      {
        term: "WebGPU",
        def: `API GPU moderna del navegador ([Wikipedia](https://en.wikipedia.org/wiki/WebGPU), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API))`,
      },
      {
        term: "SSR",
        def: "screen-space reflections — espejos brillantes a partir de lo que hay en pantalla",
      },
      {
        term: "Denoise",
        def: "un filtro que suaviza muestras de reflejo ruidosas en espacio/tiempo",
      },
      {
        term: "HDR / EXR",
        def: "mapas de entorno de alto rango dinámico para iluminación y cielo",
      },
      {
        term: "Third-person walk",
        def: "mueve un personaje por la galería en lugar de solo free-fly",
      },
    ],
    trySteps: [
      "Abre la [demo SSR + Denoise](/demos/ssr-denoise/) en Chrome o Edge",
      "Orbita o camina hasta ver un reflejo brillante en el suelo",
      "Activa o compara reflejos crudos vs. denoised si la UI expone el interruptor",
      "Opcional: importa un GLTF/FBX pequeño o cambia HDR para reiluminar la sala",
    ],
    requirements: [
      "**Navegador:** Chrome o Edge con WebGPU activado (113+ recomendado)",
      "**Hardware:** GPU discreta o integrada reciente; baja calidad si se traba",
      "**Móvil:** limitado — trata desktop como primera experiencia",
    ],
    viewA: {
      caption: "Galería amplia — paredes de arte y suelo reflectante",
    },
    viewB: {
      caption: "Detalle de reflejo — brillo denoised bajo las luces",
    },
    alsoCan: [
      "Carga modelos custom para ver cómo lee una pieza de cliente en la sala",
      "Compara calidad de reflejo en movimiento — denoise muestra su valor en directo",
      "Combina con otros estudios WebGPU como volumetric lighting en el mismo sitio",
    ],
    howWorks: `El punto de partida es el ejemplo oficial three.js [WebGPU SSR + denoise](https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise) ([fuente en GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html)). IOM envuelve esa pipeline en una shell galería con importación de modelo, swap HDR/EXR y modo walk para que el efecto sea legible para clientes, no solo una muestra técnica.`,
    faq: [
      {
        q: "¿Por qué la página está en blanco o me avisa?",
        a: `Esta demo necesita WebGPU. Usa una build reciente de Chrome o Edge; Safari y Firefox antiguos pueden no exponer aún la API.`,
      },
      {
        q: "¿SSR es lo mismo que ray tracing?",
        a: `No. SSR reutiliza la imagen de pantalla; reflejos path-traced o ray-traced por hardware son un camino más pesado. Denoise hace SSR más presentable en tiempo real.`,
      },
    ],
    reading: [
      {
        label: "Demo live SSR + Denoise",
        url: "/demos/ssr-denoise/",
      },
      {
        label: "Ejemplo three.js SSR denoise",
        url: "https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise",
      },
      {
        label: "Fuente del ejemplo en GitHub",
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
    pageTitle: "Dream — narrativa scroll océano",
    demoLabel: "Dream — Ocean scroll",
    hook: `No toda pieza 3D debe ser un cubo en órbita. Dream es una narrativa scroll a través de agua oscura y quieta, lluvia, tierra lejana y orilla — distorsión procedural, audio ambient opcional y runtime meteorológico con cielo, nubes y sync día/noche. Capítulo 1 de 9; work in progress.`,
    coverNote: `La portada es la pantalla de inicio Dream — título, línea calmada y control play antes de que empiece el scroll.`,
    whyBullets: [
      `- **Scroll como cámara** — el movimiento de página cuenta el capítulo, no solo drag en órbita`,
      "- **Atmósfera primero** — agua, lluvia y clima marcan el beat emocional",
      "- **Audio que sigue** — crossfade ambient opcional con los capítulos visuales",
      "- **Mentalidad de serie** — capítulo 1 de 9 señala un arco narrativo más largo",
    ],
    whyUses: `landings de brand story, companions web de exposición, aperturas de folio, y experimentos donde mood y pacing importan tanto como la fidelidad del modelo.`,
    beginner: `En lugar de una cámara libre que pilotas tú, haces scroll — y la escena avanza como páginas en un libro ilustrado. Shaders de agua y clima hacen el grueso visual; lees con pulgar o rueda del ratón.`,
    glossary: [
      {
        term: "Scroll narrative",
        def: "beats narrativos ligados a la posición de scroll",
      },
      {
        term: "Procedural distortion",
        def: "movimiento shader que deforma la superficie sin archivo de vídeo",
      },
      {
        term: "Weather runtime",
        def: "cielo, nubes y día/noche impulsados por parámetros",
      },
      {
        term: "Crossfade audio",
        def: "capas ambient se mezclan al cambiar capítulo",
      },
    ],
    trySteps: [
      "Abre la [demo Dream — Ocean scroll](/demos/dreams-iom/)",
      `Pulsa play en la pantalla de inicio, luego scroll lento por los primeros beats de agua`,
      "Pausa en la figura flotante — observa ondas, cielo y mood meteorológico",
      "Si el audio está activo en tu build, unmute y scroll de nuevo para el crossfade",
    ],
    requirements: [
      "**Navegador:** Chrome/Edge/Firefox moderno con WebGL",
      "**Motion:** scroll desktop o trackpad da el pacing previsto",
      "**Audio:** opcional — algunos navegadores requieren clic antes del sonido",
    ],
    viewA: {
      caption: "Pantalla de inicio — DREAM., línea calmada y play para entrar al scroll",
    },
    viewB: {
      caption: "Tras play — figura flotante sobre agua oscura y quieta",
    },
    alsoCan: [
      "Úsalo como mood board para un lanzamiento multi-capitulo más largo",
      `Combina con el estudio [Three.js Ocean](/blog/threejs-ocean) para contraste de técnica de superficie`,
      "Scopea un capítulo con marca con copy y audio bed custom",
    ],
    howWorks: `La experiencia es un canvas [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) guiado por posición de scroll: agua shader y pases atmosféricos se actualizan con el valor de progreso narrativo. Clima (cielo, nubes, día/noche) es un runtime de parámetros en lugar de vídeo baked. Live en [/demos/dreams-iom/](/demos/dreams-iom/).`,
    faq: [
      {
        q: "¿Está terminado?",
        a: `Capítulo 1 de 9 es el beat público — una narrativa work-in-progress, no una película cerrada.`,
      },
      {
        q: "¿Podemos poner nuestra brand story aquí?",
        a: `Sí como adaptación scoped: copy, pacing, audio y grade visual. Contáctanos con el outline del capítulo.`,
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
        label: "Sección 3D IOM",
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
    pageTitle: "Three.js Ocean — olas Gerstner, cielo y exportación",
    demoLabel: "Three.js Ocean",
    hook: `¿Necesitas una placa de agua hero que puedas brandear en minutos? Esta demo océano ejecuta agua Gerstner-wave con cielo procedural y preset sunset — coloca texto 3D de vidrio (Google Fonts), iconos decorativos, captura wallpapers o exporta hasta 30 segundos de vídeo WebGL.`,
    coverNote: "La portada muestra el encuadre océano sunset de la tarjeta 3D.",
    whyBullets: [
      "- **Agua legible rápido** — olas Gerstner y cielo sin granja de render de cine",
      `- **Tipografía sobre el agua** — texto 3D de vidrio con Google Fonts para títulos`,
      "- **Preset sunset** — mood one-click para pitches y lockups",
      "- **Entregables** — stills wallpaper o exportación corta de vídeo WebGL",
    ],
    whyUses: `heroes de landing, placas key art de eventos, wallpapers sociales, y comps rápidas de «momento marca océano» antes de un pase R&D de agua custom.`,
    beginner: `Las olas Gerstner son un clásico para simular oleaje oceánico en tiempo real — picos y valles que parecen más agua que una textura ripple plana. Aquí están bajo un cielo procedural para componer título o icono y capturarlo.`,
    glossary: [
      {
        term: "Gerstner wave",
        def: "un modelo matemático de oleaje usado en océanos en tiempo real",
      },
      {
        term: "Procedural sky",
        def: "color de cielo y sol calculados en shader, no solo cúpula foto",
      },
      {
        term: "Glass 3D text",
        def: "tipografía extruida con shading refractivo/transparente",
      },
      {
        term: "WebGL video export",
        def: "grabación de frames del canvas en clip corto",
      },
    ],
    trySteps: [
      "Abre la [demo Three.js Ocean](/demos/ocean/)",
      "Orbita hasta que horizonte y sol se lean claramente (prueba preset sunset)",
      "Añade o edita texto 3D de vidrio / iconos si la UI los ofrece",
      "Captura screenshot wallpaper o inicia exportación corta de vídeo (≤30s)",
    ],
    requirements: [
      "**Navegador:** Chrome/Edge moderno recomendado para captura y exportación",
      "**GPU:** gráficos integrados suelen bastar; baja calidad si suben ventiladores",
      `**Exportación:** captura de vídeo pesa más — cierra otras pestañas para take limpio`,
    ],
    viewA: {
      caption: "Océano sunset — horizonte y oleaje",
    },
    viewB: {
      caption: "Lockup de título — texto de vidrio sobre el agua",
    },
    alsoCan: [
      "Genera stills social/wallpaper sin salir del navegador",
      "Prototipa títulos de evento antes del handoff a motion design",
      "Compara técnica con la narrativa scroll en [Dream](/blog/iom-three)",
    ],
    howWorks: `Construido sobre la línea ocean/water three.js ([fuente ejemplo webgl_shaders_ocean](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html)) con UI IOM para texto, presets, screenshots y captura corta de canvas. [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) impulsa agua y cielo cada frame; la exportación es una captura temporizada del mismo canvas.`,
    faq: [
      {
        q: "¿Podemos usar el clip comercialmente?",
        a: `Trata la demo pública como preview. Pídenos un paquete de exportación licenciado o con marca para campañas.`,
      },
      {
        q: "¿Es lo mismo que Dream — Ocean scroll?",
        a: `No. Esta es una placa océano orbitable con herramientas de exportación; Dream es un capítulo narrativo scroll en [/demos/dreams-iom/](/demos/dreams-iom/).`,
      },
    ],
    reading: [
      {
        label: "Demo Ocean",
        url: "/demos/ocean/",
      },
      {
        label: "Fuente ejemplo ocean three.js",
        url: "https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "Ola Gerstner — Wikipedia",
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
    pageTitle: "The Black Witness — tour visitante 360°",
    demoLabel: "The Black Witness — Tour 360°",
    hook: `El mismo cuervo, muchos mundos — ciudad, bosque, montaña, niebla. Esta vista previa para visitantes abre el tour The Black Witness sin chrome del editor, enmarcado en yaw −84,7° y pitch −6°, con hotspots, pasos guiados y atmósfera WebGPU opcional.`,
    coverNote: `La portada es el paso 1 del tour guiado — hotspot del cuervo The Black Witness con popup abierto.`,
    whyBullets: [
      `- **Enlace visitante primero** — sin UI del editor; los invitados solo ven el tour`,
      "- **Pasos guiados** — un recorrido por la historia, no solo mirada libre",
      "- **Hotspots con significado** — info y saltos que enseñan mientras exploras",
      `- **Encuadre compartible** — deep-link yaw/pitch para que la primera vista sea intencional`,
    ],
    whyUses: `compañeros de exposición, lanzamientos de series fotográficas, bucles attract de stand y pruebas para clientes de cómo se siente una historia 360° terminada en móvil o portátil.`,
    beginner: `Está de pie dentro de una fotografía 360°. Arrastre para mirar alrededor; toque marcadores para aprender o ir al siguiente lugar. El modo preview es el „boleto de invitado“ — el editor es cómo construimos; este enlace es cómo el público lo vive.`,
    glossary: [
      {
        term: "Vista previa visitante",
        def: "modo tour sin herramientas de edición (`mode=preview`)",
      },
      {
        term: "Yaw / pitch",
        def: "ángulos de mirada horizontal y vertical para la vista inicial",
      },
      {
        term: "Tour guiado",
        def: "paradas ordenadas por las que la experiencia puede avanzar",
      },
      {
        term: "Hotspot",
        def: "un marcador pulsable para info o la siguiente escena",
      },
    ],
    trySteps: [
      "Abrir el [tour visitante Black Witness](/demos/panorama-360/?mode=preview)",
      `Hacer clic en **Play guided tour** — cuatro paradas de cámara con popups y efectos`,
      "Abrir un hotspot usted mismo tras detener el tour",
      "Compartir la URL preview para que colegas lleguen a la misma experiencia",
    ],
    requirements: [
      `**Navegador:** navegador móvil o de escritorio moderno; los efectos WebGPU requieren un dispositivo capaz`,
      `**Red:** los panoramas son pesados en imágenes — preferir Wi‑Fi en la primera carga`,
      "**Entrada:** arrastre táctil o ratón; auriculares no requeridos",
    ],
    viewA: {
      caption: "Paso 2 — hotspot de fuego animado y popup de partículas",
    },
    viewB: {
      caption: "Paso 3 — beat agua / spout en la azotea",
    },
    viewC: {
      caption: "Paso 4 — Popup de aves animadas con la bandada contra el cielo tormentoso",
    },
    alsoCan: [
      "Ir al [editor](/demos/panorama-360/) cuando necesite authorar hotspots",
      "Reutilizar el patrón deep-link para primeras vistas de marca en otros proyectos",
      `Seguir la pila de efectos: [particles](/blog/webgpu-particles) → [spout](/blog/spout) → [birds](/blog/webgpu-compute-birds)`,
    ],
    howWorks: `Preview reutiliza el mismo motor panorama que el [Editor de tour 360°](/blog/panorama-360-tour), pero los flags URL ocultan el chrome de authoring y fijan la cámara inicial (\`yaw\`, \`pitch\`). Hotspots y pasos guiados son datos de proyecto sobre escenas equirectangulares — [Three.js](https://threejs.org/) para esfera y cámara, capas [WebGPU](https://en.wikipedia.org/wiki/WebGPU) opcionales para atmósfera. En The Black Witness, el Paso 2 superpone [particles](/blog/webgpu-particles), el Paso 3 [spout](/blog/spout) y el Paso 4 [birds](/blog/webgpu-compute-birds) — cada uno con hotspot+popup para que los invitados tengan movimiento sincronizado a un beat narrativo clicable.`,
    faq: [
      {
        q: "¿Por qué mi vista empieza en una dirección concreta?",
        a: `El enlace fija yaw −84,7° y pitch −6° para que todos compartan la misma composición de apertura.`,
      },
      {
        q: "¿Puedo editar hotspots desde esta URL?",
        a: `No en preview. Use el [editor de tour](/demos/panorama-360/) (o pídanos un build de authoring de producción).`,
      },
      {
        q: "¿Cuáles son las capas de efecto en los pasos 2–4?",
        a: `Paso 2 particles, Paso 3 spout/agua, Paso 4 birds — cada uno con popup hotspot. Las páginas de experimento standalone documentan la misma tech.`,
      },
    ],
    reading: [
      {
        label: "Enlace tour visitante",
        url: "/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6",
      },
      {
        label: "Editor de tour",
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
    pageTitle: "CSS3D Sprites — HTML en espacio 3D",
    demoLabel: "CSS3D Sprites",
    hook: `Quinientas doce elementos HTML flotando como sprites — luego morph entre plano, cubo, nube y esfera. Es Three.js CSS3DRenderer: nodos DOM reales en espacio cámara, no solo quads texturizados.`,
    coverNote: `La portada muestra la nube de sprites a mitad de morph — mosaicos HTML leyéndose como formación 3D.`,
    whyBullets: [
      "- **DOM encuentra profundidad** — contenido HTML/CSS real que aún orbita en 3D",
      `- **Storytelling morph** — plano → cubo → nube → esfera vende „datos que se vuelven forma“`,
      `- **Movimiento sin motor de juego** — escala pulsante y transiciones en el navegador`,
      `- **Prototipo UI en espacio** — tarjetas, etiquetas o fotos como layouts espaciales`,
    ],
    whyUses: `bocetos UI espaciales, momentos portfolio „partícula de tarjetas“ y demos cliente donde el contenido debe seguir siendo HTML legible.`,
    beginner: `Imagine miniaturas de foto o mosaicos de color dispuestos en una habitación que puede girar. Cada mosaico sigue siendo un elemento web normal — solo posicionado en 3D. Cuando la forma cambia, los mosaicos vuelan a nuevos sitios como una bandada coreografiada.`,
    glossary: [
      {
        term: "CSS3DRenderer",
        def: "ruta Three.js que posiciona elementos HTML con transforms CSS 3D",
      },
      {
        term: "Sprite",
        def: "un elemento plano que está en la escena como unidad tipo billboard",
      },
      {
        term: "Morph",
        def: "transición animada de posiciones de una formación a otra",
      },
      {
        term: "WebGL camera",
        def: "la misma matemática de cámara 3D que escenas WebGL, que impulsa transforms CSS",
      },
    ],
    trySteps: [
      "Abrir la [demo CSS3D Sprites](/demos/css3d-sprites/)",
      "Arrastrar para orbitar; ver la formación pulsar",
      "Activar cambios de forma (plano, cubo, aleatorio, esfera) si hay botones o UI",
      `Acercar hasta que sprites HTML individuales sigan nítidos — esa es la ventaja DOM`,
    ],
    requirements: [
      "**Navegador:** Chrome, Edge, Firefox o Safari moderno con transforms CSS 3D",
      `**GPU:** carga ligera comparada con compute WebGPU pesado — bien en la mayoría de portátiles`,
      "**Nota:** CSS3D + matemática cámara Three.js, no una demo compute WebGPU",
    ],
    viewA: {
      caption: "Formación esfera o cubo — sprites leyéndose como volumen sólido",
    },
    viewB: {
      caption: "Nube / dispersión aleatoria — profundidad y parallax de mosaicos HTML",
    },
    alsoCan: [
      "Cambiar contenido sprite por imágenes, etiquetas o colores de marca",
      "Usar morphs como transiciones de sección en un sitio pitch",
      `Comparar con el ejemplo upstream [three.js css3d_sprites](https://threejs.org/examples/#css3d_sprites)`,
    ],
    howWorks: `Three.js impulsa una cámara compartida; [CSS3DRenderer](https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer) mapea matrices de objeto a \`transform\` CSS en nodos DOM. Las formaciones son posiciones objetivo; la animación interpola cada sprite hacia el siguiente layout. Referencia upstream: [css3d_sprites](https://threejs.org/examples/#css3d_sprites) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/css3d_sprites.html)). A diferencia de sistemas de partículas WebGPU, aquí el trabajo es layout + compositing CSS en lugar de compute shaders.`,
    faq: [
      {
        q: "¿Es WebGL o WebGPU?",
        a: `Ninguno como ruta principal — los sprites son HTML vía CSS3D. Three.js sigue usando matemática cámara 3D familiar de escenas WebGL.`,
      },
      {
        q: "¿Podemos poner tarjetas de producto reales en la nube?",
        a: `Sí en principio — cada sprite puede contener HTML más rico. Definimos rendimiento y legibilidad para builds cliente.`,
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
    pageTitle: "Shape Particles — física compute WebGPU",
    demoLabel: "Shape Particles",
    hook: `Miles de partículas encajan en cubo, esfera, toro, corazón — luego Release las suelta bajo gravedad GPU con rebote en el suelo. WebGPU compute mantiene la simulación en la tarjeta gráfica.`,
    coverNote: "La portada muestra un preset de forma mantenido en formación antes del drop.",
    whyBullets: [
      `- **Formación → caos → reforma** — una historia clara para motion de producto o marca`,
      "- **Compute en GPU** — pasos de física sin bloquear el main thread",
      "- **Presets de forma** — cubo, esfera, toro, cono, pirámide, anillo, corazón",
      "- **Prueba interactiva** — Release y Reset venden la idea en un clic",
    ],
    whyUses: `teasers de lanzamiento, bucles de stand y momentos pitch „nuestros datos se vuelven esta forma“.`,
    beginner: `Piense en arena magnética que puede mantener una forma tipo logo, luego cae al soltar — y vuelve a la forma al reset. La diferencia es velocidad: la GPU actualiza cada partícula para que siga fluida.`,
    glossary: [
      {
        term: "WebGPU",
        def: "API GPU de navegador moderna (más reciente que WebGL) para compute y rendering",
      },
      {
        term: "Compute shader",
        def: `programa GPU que actualiza datos (posiciones, velocidades) sin dibujar triángulos`,
      },
      {
        term: "TSL",
        def: "Three.js Shading Language — lógica GPU basada en nodos en JS",
      },
      {
        term: "Formación",
        def: "posiciones objetivo que hacen leer las partículas como forma sólida",
      },
    ],
    trySteps: [
      "Abrir la [demo Shape Particles](/demos/compute-particles/)",
      "Elegir un preset de forma y orbitar la formación",
      "Pulsar Release — ver gravedad y rebote en el suelo",
      "Pulsar Reset para reformar; probar otra forma",
    ],
    requirements: [
      "**Navegador:** Chrome o Edge con WebGPU habilitado (versiones recientes)",
      "**GPU:** GPU discreta o integrada reciente recomendada para counts densos",
      "**Fallback:** sin WebGPU verá un mensaje de capacidad — no es un port WebGL",
    ],
    viewA: {
      caption: "Formación mantenida — partículas leyéndose como preset sólido",
    },
    viewB: {
      caption: "Tras Release — spray y rebote en el plano del suelo",
    },
    alsoCan: [
      "Ciclar presets para un bucle de marca corto",
      "Ajustar count / look para rendimiento stand vs portátil",
      `Comparar con [three.js webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles)`,
    ],
    howWorks: `Un pass compute [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) actualiza el estado de partículas cada frame; el renderer dibuja el resultado. Three.js expone esto vía WebGPU renderer y nodos compute TSL. Upstream: [webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_particles.html)). WebGL también puede dibujar partículas, pero el loop gravedad/reforma de esta demo está construido para compute WebGPU.`,
    faq: [
      {
        q: "¿Por qué mi navegador dice que falta WebGPU?",
        a: `Este experimento necesita WebGPU. Use Chrome o Edge actualizado; el soporte Safari/Firefox varía por versión.`,
      },
      {
        q: "¿Pueden las partículas formar nuestro logo?",
        a: `Meshes objetivo o point clouds custom son un paso natural — pídanos un build acotado.`,
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
    pageTitle: "WebGPU Spotlight — haces texturizados y sombras",
    demoLabel: "WebGPU Spotlight",
    hook: `Un spot light que se comporta como un foco teatral — textura proyectada en el cono, penumbra suave, decay y sombras enfocadas — en Three.js WebGPU con el clásico escaneo Lucy como sujeto.`,
    coverNote: "La portada muestra Lucy bajo el spotlight móvil en suelo que recibe sombras.",
    whyBullets: [
      "- **Lenguaje de luz showroom** — cono, falloff y texture maps tipo gobo",
      `- **Sombras reales** — contacto en el suelo vende profundidad para producto y escultura`,
      `- **Ruta materiales WebGPU** — iluminación Three.js moderna, no GIF pre-renderizado`,
      "- **Helpers on demand** — visualizar la luz al ajustar",
    ],
    whyUses: `turntables de producto, estudios de galería y pitches de iluminación antes de una escena production completa.`,
    beginner: `Un spotlight es un cono de luz, como una lámpara de escenario. Aquí ve el borde suave del cono, cómo el brillo cae con la distancia y cómo la sombra de la escultura reposa en el suelo — todo en vivo en el navegador.`,
    glossary: [
      {
        term: "Spotlight",
        def: "luz con ángulo de cono, dirección y textura opcional en el haz",
      },
      {
        term: "Penumbra",
        def: "el borde suave del cono de luz",
      },
      {
        term: "Decay",
        def: "qué tan rápido cae la intensidad con la distancia",
      },
      {
        term: "WebGPU",
        def: "la API GPU de navegador más reciente usada por esta ruta renderer Three.js",
      },
    ],
    trySteps: [
      "Abrir la [demo WebGPU Spotlight](/demos/webgpu-spotlight/)",
      "Orbitar alrededor de Lucy; ver el spot móvil y la sombra en el suelo",
      "Alternar helpers de luz si están disponibles para ver el cono",
      "Notar penumbra y focus — borde suave vs sombra nítida como trade-offs",
    ],
    requirements: [
      "**Navegador:** Chrome o Edge con WebGPU (no el ejemplo lights WebGL más antiguo)",
      "**GPU:** cualquier GPU de portátil reciente suele bastar para esta escena",
      `**Modelo:** Lucy PLY incluido — meshes custom pesados pueden necesitar optimización`,
    ],
    viewA: {
      caption: "Tres cuartos — cono de luz legible sobre Lucy y suelo",
    },
    viewB: {
      caption: "Focus sombra — sombra de contacto y penumbra en el suelo",
    },
    alsoCan: [
      "Cambiar texturas gobo / proyección por patrones de marca",
      "Emparejar con demos volumétricas para mood „haz en el aire“",
      `Estudiar el ejemplo upstream [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight)`,
    ],
    howWorks: `Three.js \`WebGPURenderer\` evalúa spot lights con maps, penumbra, decay y shadow maps en la pipeline WebGPU. La escena orbita un spot animado sobre Lucy PLY en un plano receptor. Ejemplo oficial: [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_lights_spotlight.html)). WebGL tiene ejemplos spotlight clásicos; esta página sigue específicamente la ruta lights WebGPU.`,
    faq: [
      {
        q: "¿Es lo mismo que god rays volumétricos?",
        a: `No — es iluminación de superficie y sombras. Para haces en el aire, vea nuestro trabajo de iluminación volumétrica.`,
      },
      {
        q: "¿Podemos iluminar nuestro propio producto?",
        a: "Sí. Reemplazar Lucy por un GLB y emparejar exposición es un paso cliente típico.",
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
    pageTitle: "WebGPU Compute Birds — flocking GPU",
    demoLabel: "WebGPU Compute Birds",
    hook: `Ocho mil aves en bandada en el navegador — separation, alignment y cohesion calculados en GPU. Mueva el ratón para perturbar la bandada; ajuste el comportamiento en vivo.`,
    coverNote: "La portada muestra la bandada instanciada como murmuration coherente.",
    whyBullets: [
      "- **Boids clásicos, GPU moderna** — reglas estilo Reynolds a escala interactiva",
      "- **Instancing** — un mesh, miles de aves",
      "- **Perturbación por puntero** — stakeholders sienten agency en segundos",
      "- **WebGPU compute** — simulación fuera del main thread CPU",
    ],
    whyUses: `momentos de marca inspirados en la naturaleza, UI explicativas científicas y stress tests para pipelines compute GPU.`,
    beginner: `Las aves en bandada siguen reglas simples: no chocar, igualar vecinos, quedarse con el grupo. Multiplique por miles y obtiene una murmuration. Aquí esas reglas corren en la tarjeta gráfica para que el movimiento siga fluido.`,
    glossary: [
      {
        term: "Boids",
        def: "modelo flocking clásico: separation, alignment, cohesion",
      },
      {
        term: "Instancing",
        def: "dibujar eficientemente muchas copias de un mesh",
      },
      {
        term: "Compute",
        def: "trabajo GPU que actualiza posiciones/velocidades de aves cada frame",
      },
      {
        term: "WebGPU",
        def: "API usada aquí en lugar de trucos GPGPU solo WebGL más antiguos",
      },
    ],
    trySteps: [
      "Abrir la [demo WebGPU Compute Birds](/demos/webgpu-compute-birds/)",
      "Ver la bandada estabilizarse en movimiento coherente",
      "Mover el ratón por la bandada para perturbarla",
      "Abrir Birds settings y ajustar separation / alignment / cohesion",
    ],
    requirements: [
      "**Navegador:** Chrome o Edge WebGPU-capable recomendado",
      "**GPU:** gama media o superior para 8k instancias a frame rates fluidos",
      "**Not WebGL:** la ruta flocking compute apunta a WebGPU",
    ],
    viewA: {
      caption: "Murmuration amplia — bandada leyéndose como un volumen",
    },
    viewB: {
      caption: "Pase más cercano — aves instanciadas y dirección de vuelo",
    },
    alsoCan: [
      "Retunear fuerzas para moods de marca más calmados vs caóticos",
      "Usar como capa de fondo detrás de UI (cuidado con el contraste)",
      `Integrar la bandada en un beat cielo de [360° guided tour](/demos/panorama-360/) (Paso 4)`,
      `Comparar [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) en threejs.org`,
    ],
    howWorks: `Cada frame un pass compute WebGPU aplica fuerzas flocking y escribe nuevos transforms; el dibujo instanciado renderiza las aves. Upstream: [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_birds.html)). Existen ejemplos WebGL „GPGPU birds“ más antiguos en la historia de three.js; esta página IOM sigue la edición compute WebGPU.`,
    tourBridge: {
      step: 4,
      stepLabel: "Tour guiado Paso 4 — capa birds + popup hotspot en The Black Witness",
      body: `En la [360° Panorama Tour](/demos/panorama-360/), **Paso 4** está authorado como \`cam · +birds · hotspot+popup\`: la cámara inclina hacia el cielo, la capa WebGPU birds da vida a la atmósfera, y un hotspot/popup mantiene la historia clicable.

El flocking standalone prueba la tech; el tour prueba el **patrón producto** — capas GPU vivas sincronizadas a una parada guiada para que los invitados sientan movimiento *y* aún puedan arrastrar para mirar y tocar para aprender. Los beats anteriores usan [WebGPU Particles](/blog/webgpu-particles) (Paso 2) y [Spout](/blog/spout) (Paso 3) de la misma forma.`,
    },
    faq: [
      {
        q: "¿Por qué tantas aves?",
        a: `La escala es el punto — compute + instancing muestran qué puede sostener WebGPU de forma interactiva.`,
      },
      {
        q: "¿Pueden las aves seguir un camino o logo?",
        a: "Campos guía y attractors son extensiones comunes para historias cliente.",
      },
      {
        q: "¿Dónde aparecen las aves en el tour 360?",
        a: `Paso 4 tour guiado en The Black Witness — capa birds con popup hotspot. Abrir /demos/panorama-360/ y Play guided tour.`,
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
    pageTitle: "WebGPU Parallax UV — profundidad en una textura plana",
    demoLabel: "WebGPU Parallax UV",
    hook: `Hielo que se siente más grueso que un plano plano — parallax UV TSL desplaza mapas ambientCG en capas con displacement, normales y rugosidad bajo luz HDR.`,
    coverNote: `La portada muestra el suelo de hielo con profundidad parallax mientras la cámara roza la superficie.`,
    whyBullets: [
      `- **Grosor simulado, ahorro real** — señal de profundidad sin malla esculpida pesada`,
      "- **Materiales TSL** — materiales nodo Three.js modernos en WebGPU",
      "- **Stack PBR** — albedo, normal, rugosidad y displacement trabajando juntos",
      "- **Entorno HDR** — reflejos que venden material congelado",
    ],
    whyUses: `estudios de materiales, planos de suelo para product shots y revisiones « ¿se lee este shader? ».`,
    beginner: `Una foto normal de hielo es plana. Parallax UV engaña al ojo: al mover la cámara, la textura se desplaza un poco como si hubiera profundidad bajo la superficie — como mirar dentro de hielo claro sin modelar cada grieta.`,
    glossary: [
      {
        term: "Parallax mapping",
        def: "desplazamiento UV basado en ángulo de vista y mapa altura/displacement",
      },
      {
        term: "TSL",
        def: "Three.js Shading Language para materiales GPU basados en nodos",
      },
      {
        term: "PBR",
        def: "physically based rendering — modelo material rugosidad/metalness",
      },
      {
        term: "HDR environment",
        def: "imagen de alto rango dinámico que ilumina reflejos de escena",
      },
    ],
    trySteps: [
      "Abre la [demo WebGPU Parallax UV](/demos/webgpu-parallax-uv/)",
      `Orbita bajo sobre el hielo — observa el desplazamiento de profundidad con el ángulo`,
      "Compara vistas rasantes vs. cenitales",
      "Nota cómo normales y rugosidad cambian el look helado bajo HDR",
    ],
    requirements: [
      "**Navegador:** WebGPU (Chrome/Edge recomendado)",
      "**Texturas:** mapas estilo ambientCG incluidos; red ayuda en la primera carga",
      `**GPU:** ligero a moderado — más pesado que un plano plano sin luz, más ligero que bandadas compute completas`,
    ],
    viewA: {
      caption: "Ángulo rasante — profundidad parallax en el plano de hielo",
    },
    viewB: {
      caption: "Vista más alta — mapas en capas y reflejo HDR legibles",
    },
    alsoCan: [
      "Retargetear mapas a piedra, madera o materiales de marca",
      "Usar como suelo bajo un GLB de producto",
      "Estudiar [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv)",
    ],
    howWorks: `Un material TSL samplea altura/displacement para desplazar UVs según dirección de vista (parallax), luego estratifica color, normal y rugosidad. WebGPURenderer ejecuta el grafo de nodos. Upstream: [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv) ([fuente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_parallax_uv.html)). Shaders parallax WebGL clásicos existen; esta demo sigue la ruta WebGPU + TSL.`,
    faq: [
      {
        q: "¿El hielo es un volumen 3D real?",
        a: "No — es un plano sombreado. Parallax simula profundidad en el material.",
      },
      {
        q: "¿Podemos usar nuestro propio set de texturas?",
        a: "Sí. Nombres de mapas e intensidad coincidentes = swap de material estándar.",
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
    pageTitle: "WebGPU TSL Raging Sea — olas procedurales",
    demoLabel: "TSL Raging Sea",
    hook: `Un mar tormentoso sin simulador oceánico — senos en capas y ruido fractal desplazan un plano denso, con normales calculadas y crestas emisivas, todo en TSL sobre WebGPU.`,
    coverNote: "La portada muestra alta mar con highlights brillantes en las crestas.",
    whyBullets: [
      "- **Agua procedural** — sin flipbook pre-baked; parámetros dirigen el mood",
      "- **Displacement TSL** — la matemática de olas vive en el grafo material",
      `- **Energía de crestas** — highlights emisivos venden espuma y spray sin partículas`,
      "- **Ruta WebGPU** — sketch océano Three.js moderno para pitches y I+D",
    ],
    whyUses: `fondos de entorno, contexto producto marino e I+D shader antes de sistemas océano FFT.`,
    beginner: `El « mar » es una malla plana que la GPU empuja arriba y abajo cada frame con matemáticas — grandes oleajes más chop pequeño. La iluminación en las pendientes lo hace parecer agua en lugar de una hoja arrugada.`,
    glossary: [
      {
        term: "Displacement",
        def: "mover vértices de malla (o shading) con una función de altura",
      },
      {
        term: "Fractal noise",
        def: "ruido en capas para detalle natural",
      },
      {
        term: "TSL",
        def: "Three.js Shading Language para authorar el grafo de olas",
      },
      {
        term: "Normals",
        def: "direcciones de superficie para iluminación; recalculadas desde las olas",
      },
    ],
    trySteps: [
      "Abre la [demo TSL Raging Sea](/demos/webgpu-tsl-raging-sea/)",
      "Orbita y observa grandes oleadas vs. chop pequeño",
      "Busca crestas emisivas en los picos de ola",
      "Compara el mood con otros experimentos océano en el sitio",
    ],
    requirements: [
      "**Navegador:** WebGPU requerido para este ejemplo TSL WebGPU",
      "**GPU:** planos más densos cuestan más — baja pixel ratio si hay stutter",
      "**No océano WebGL:** distinto de demos clásicas agua/FFT WebGL",
    ],
    viewA: {
      caption: "Mar tormentoso amplio — oleadas en capas legibles a distancia",
    },
    viewB: {
      caption: "Detalle de cresta — normales y highlights emisivos",
    },
    alsoCan: [
      "Retunear amplitud y ruido para puerto calmado vs. tormenta",
      "Usar como fondo adyacente a skybox bajo un producto",
      `Abrir [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) upstream`,
    ],
    howWorks: `Displacement vertex (o TSL equivalente) suma senos grandes con ruido fractal; normales se derivan para que la iluminación reaccione a pendientes; crestas reciben lift emisivo. Corre en Three.js WebGPU + TSL. Upstream: [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) ([fuente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_raging_sea.html)). Para mares basados en espectro, ver trabajo océano FFT dedicado en otro lugar de IOM — técnica distinta, a menudo WebGL o híbrida.`,
    faq: [
      {
        q: "¿Es una simulación oceánica completa?",
        a: "No — displacement procedural. Ideal para look development; no CFD.",
      },
      {
        q: "¿WebGL o WebGPU?",
        a: `WebGPU vía Three.js TSL. Cobertura de dispositivos más amplia puede preferir océanos WebGL.`,
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
    pageTitle: "WebGPU TSL Linked Particles — estelas VFX dibujadas",
    demoLabel: "TSL Linked Particles",
    hook: `Mueve el puntero para generar una estela de partículas luminosas — compute GPU, turbulencia, cintas de enlaces entre vecinos, rotación de tono y bloom. Un sketch VFX TSL que se siente.`,
    coverNote: "La portada muestra cintas de partículas enlazadas con bloom.",
    whyBullets: [
      "- **Puntero como pincel** — « pruébalo » instantáneo para clientes en llamada",
      "- **Enlaces entre vecinos** — lenguaje red / sinapsis / constelación",
      "- **Compute + TSL** — spawn, turbulencia y vida en la GPU",
      "- **Acabado bloom** — glow suave premium en UI oscuras",
    ],
    whyUses: "fondos hero, momentos interactivos en stand y sistemas visuales de marca tech.",
    beginner: `Dibujas con luz: partículas aparecen bajo el cursor, derivan con turbulencia, y líneas finas conectan puntos cercanos — como una constelación que recuerda tu gesto un momento.`,
    glossary: [
      {
        term: "Nearest-neighbor links",
        def: "líneas dibujadas entre partículas cercanas en el espacio",
      },
      {
        term: "Turbulence",
        def: "campo de fuerza ruidoso que arremolina el movimiento de partículas",
      },
      {
        term: "Bloom",
        def: "glow post-process alrededor de píxeles brillantes",
      },
      {
        term: "TSL VFX",
        def: "efectos authorados con nodos Three.js Shading Language",
      },
    ],
    trySteps: [
      "Abre la [demo TSL Linked Particles](/demos/webgpu-tsl-linked-particles/)",
      "Mueve el puntero por el canvas para dibujar estelas",
      "Pausa y observa enlaces y cambio de tono mientras las partículas mueren",
      "Orbita si está activo; nota bloom en clusters brillantes",
    ],
    requirements: [
      "**Navegador:** WebGPU (Chrome/Edge recomendado)",
      `**GPU:** bloom + compute quieren algo de margen — cierra pestañas pesadas si hace falta`,
      "**Input:** ratón o trackpad; touch varía por dispositivo",
    ],
    viewA: {
      caption: "Cluster denso a la izquierda — enlaces magenta con acentos cyan",
    },
    viewB: {
      caption: "Malla más cercana — nodos con bloom y cintas vecinas",
    },
    alsoCan: [
      "Mapear puntero a touch / varita para instalaciones",
      "Recolorear ciclo de tono hacia paleta de marca",
      `Comparar [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles)`,
    ],
    howWorks: `Compute WebGPU spawna y advecta partículas; materiales TSL renderizan sprites/cintas; un pass de enlaces conecta partículas cercanas; bloom post-procesa el frame. Upstream: [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles) ([fuente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_vfx_linkedparticles.html)). Redes de líneas WebGL (ver draw-range) son idea visual relacionada con pipeline distinta más ampliamente soportada.`,
    faq: [
      {
        q: "¿Es lo mismo que la demo shape particles?",
        a: `No — esa forma presets sólidos y gravedad. Esta es VFX dibujado con puntero, enlaces y bloom.`,
      },
      {
        q: "¿Podemos ralentizarlo para un film de marca calmado?",
        a: "Sí — spawn rate, turbulencia y umbrales bloom son perillas típicas.",
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
    pageTitle: "WebGPU Custom Fog Scattering — caminar en la bruma",
    demoLabel: "Custom Fog Scattering",
    hook: `Un paseo en primera persona entre siluetas de pinos procedurales en niebla exponencial fresca — blur de scattering TSL basado en densidad que suaviza la distancia como aire húmedo.`,
    coverNote: "La portada muestra formas de pino disolviéndose en niebla dispersa.",
    whyBullets: [
      "- **Atmósfera como sujeto** — mood primero, geometría después",
      "- **Blur de scattering** — la distancia se suaviza como aire húmedo",
      "- **Densidad ajustable** — niebla y scattering como diales de diseño",
      "- **WebGPU + TSL** — niebla custom más allá de un solo color scene.fog",
    ],
    whyUses: "pitches de entorno, walkthroughs tipo juego y estudios « clima como marca ».",
    beginner: `La niebla no es solo un tinte gris. En aire húmedo, los árboles lejanos se ven más suaves y lechosos. Esta demo te lleva por esa sensación — siluetas de pinos desvaneciéndose en bruma fresca que puedes espesar o aclarar.`,
    glossary: [
      {
        term: "Exponential fog",
        def: "niebla que se espesa gradualmente con la distancia",
      },
      {
        term: "Scattering",
        def: "luz rebotando en el medio — aquí aproximada como blur/suavizado",
      },
      {
        term: "First-person",
        def: "cámara se mueve como si caminaras la escena",
      },
      {
        term: "TSL",
        def: "node shading para personalizar comportamiento de niebla en WebGPU",
      },
    ],
    trySteps: [
      "Abre la [demo Custom Fog Scattering](/demos/webgpu-custom-fog-scattering/)",
      "Camina o mira alrededor del campo de pinos",
      "Sube densidad de niebla — observa la distancia colapsar en bruma",
      "Ajusta factor de scattering y compara pinos lejanos nítidos vs. suaves",
    ],
    requirements: [
      "**Navegador:** Chrome o Edge compatible WebGPU",
      "**Controles:** teclado / puntero como implementado en la UI demo",
      "**GPU:** cómodo en laptops modernas; baja resolución si hay motion blur",
    ],
    viewA: {
      caption: "Camina más hondo — troncos más densos mientras la bruma cierra",
    },
    viewB: {
      caption: "Tronco cercano — scattering suaviza el bosque detrás",
    },
    alsoCan: [
      "Retintar niebla para moods de marca amanecer / noche",
      "Cambiar siluetas por masas arquitectónicas",
      `Lee [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering)`,
    ],
    howWorks: `Siluetas procedurales tipo árbol en escena WebGPU; TSL implementa niebla consciente de densidad y blur scattering para suavizar estructura lejana. Upstream: [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering) ([fuente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_custom_fog_scattering.html)). WebGL \`FogExp2\` estándar es más simple; este experimento muestra tratamiento scattering custom en la stack WebGPU.`,
    faq: [
      {
        q: "¿Es iluminación volumétrica?",
        a: `Mood relacionado, técnica distinta — aquí foco niebla/scattering en bosque transitable, no god rays rect-area.`,
      },
      {
        q: "¿Podemos usar un modelo de sitio real?",
        a: `Sí como integración acotada — reemplazar siluetas con LODs arquitectura simplificados.`,
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
    pageTitle: "WebGPU Curve Modifier — texto a lo largo de una spline",
    demoLabel: "WebGPU Curve Modifier",
    hook: `Texto extruido que fluye a lo largo de una spline Catmull-Rom cerrada — arrastra manijas de control y la malla se deforma con el camino. Un enfoque WebGPU de curve modifiers para logos y tipografía.`,
    coverNote: "La portada muestra letras curvadas a lo largo de la curva editable.",
    whyBullets: [
      "- **Tipo como geometría** — logos y titulares que viven en un camino",
      "- **Manijas live** — remodelar la historia frente al cliente",
      "- **Spline cerrada** — loops para movimiento infinito en stand",
      `- **Combina con herramientas de camino** — misma familia que editores spline y rails de cámara`,
    ],
    whyUses: "logos animados, títulos de exposición y callouts de producto guiados por camino.",
    beginner: `Imagina letras magnéticas flexibles pegadas a un alambre curvo. Mueve los puntos de control del alambre y las letras se deslizan y doblan en consecuencia. Eso es un curve modifier — aquí en el navegador sobre WebGPU.`,
    glossary: [
      {
        term: "Catmull-Rom spline",
        def: "curva suave que pasa por puntos de control",
      },
      {
        term: "Curve modifier",
        def: "deforma una malla para seguir un camino",
      },
      {
        term: "Extruded text",
        def: "geometría de letras 3D construida desde contorno de fuente",
      },
      {
        term: "Control handle",
        def: "punto arrastrable que remodela la spline",
      },
    ],
    trySteps: [
      "Abre la [demo WebGPU Curve Modifier](/demos/webgpu-modifier-curve/)",
      "Haz clic en una manija de control para seleccionarla",
      "Arrastra para remodelar el camino cerrado — observa el flujo del texto",
      "Orbita para revisar grosor de letras y silueta",
    ],
    requirements: [
      "**Navegador:** WebGPU (Chrome/Edge recomendado)",
      "**Input:** ratón para picking y arrastre de manijas",
      "**GPU:** modesto — fuentes más pesadas / extrusión fina suben coste",
    ],
    viewA: {
      caption: "Loop completo — texto extruido siguiendo la spline cerrada",
    },
    viewB: {
      caption: "Edición de manija — curvatura local de letras en el camino",
    },
    alsoCan: [
      "Cambiar la cadena por un wordmark de marca",
      "Exportar ideas de camino a workflows de rails de cámara",
      `Comparar [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve)`,
    ],
    howWorks: `Una curva Catmull-Rom cerrada define el camino; un modifier samplea la curva para transformar geometría de texto extruido en cada update. WebGPURenderer dibuja el resultado. Upstream: [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve) ([fuente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_modifier_curve.html)). Para edición pura de camino sin modifier, ver el [editor spline](https://threejs.org/examples/#webgl_geometry_spline_editor) WebGL — herramientas complementarias.`,
    faq: [
      {
        q: "¿Podemos usar nuestra fuente?",
        a: `Normalmente sí con fuente licenciada meshable para web — gestionamos conversión en builds de producción.`,
      },
      {
        q: "¿WebGPU requerido?",
        a: `Para esta página demo, sí. Ideas de curva también pueden ir en WebGL según el proyecto.`,
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
    pageTitle: "WebGPU Particles — sprites de fuego y humo",
    demoLabel: "WebGPU Particles",
    hook: `Sprites de fuego y humo instanciados con ciclos de vida TSL — UV de humo rotativas, fuego aditivo y una cuadrícula de suelo simple. VFX WebGPU compacto para ambiente y calor de producto.`,
    coverNote: `La portada muestra el mismo lenguaje de partículas fuego/humo que Guided Tour Step 2 en The Black Witness — calor en azotea con popup hotspot « Animated fire » en https://iobjectm.com/demos/panorama-360/.`,
    whyBullets: [
      "- **VFX elemental legible** — fuego + humo sin paquete FX completo",
      "- **Sprites instanciados** — muchas partículas, una estrategia de draw",
      "- **Ciclos de vida TSL** — spawn, envejecimiento y fade en la ruta GPU",
      "- **Fuego aditivo** — glow que compone limpio en escenas oscuras",
      `- **Integrado en tours 360°** — Step 2 en [Panorama 360](https://iobjectm.com/demos/panorama-360/) empareja partículas con popup hotspot`,
    ],
    whyUses: `ambientes de forja/lanzamiento, bocetos camp e industriales, loops hero ligeros y beats de calor en tours guiados 360° interactivos.`,
    beginner: `Fuego y humo aquí son muchas imágenes pequeñas (sprites) que se desvanecen y arremolinan con el tiempo. Blending aditivo hace las llamas brillantes; el humo usa texturas más suaves. Juntos venden calor sin simular combustión real. En nuestro [tour 360°](https://iobjectm.com/demos/panorama-360/), ese mismo lenguaje se convierte en Guided Tour Step 2 — una parada donde los invitados pueden mirar alrededor y clicar.`,
    glossary: [
      {
        term: "Sprite particle",
        def: "quad texturizado, a menudo camera-facing, para humo/fuego",
      },
      {
        term: "Additive blending",
        def: "los colores se suman — brillante para fuego, fácil de sobreexponer",
      },
      {
        term: "Life cycle",
        def: "nacimiento, envejecimiento y muerte de cada partícula",
      },
      {
        term: "Instancing",
        def: "dibujar eficientemente muchas partículas desde una plantilla",
      },
      {
        term: "Guided tour Step 2",
        def: "en /demos/panorama-360/ — cam · +particles · hotspot+popup",
      },
    ],
    trySteps: [
      "Abre la [demo WebGPU Particles](/demos/webgpu-particles/)",
      "Orbita la columna — separa núcleo de fuego del cuerpo de humo",
      "Observa rotación de sprite / movimiento UV en el humo",
      `Abre [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, y mira Step 2 (partículas + hotspot)`,
    ],
    requirements: [
      `**Navegador:** WebGPU vía Three.js (no solo ejemplos antiguos de partículas WebGL)`,
      "**GPU:** bien en la mayoría de laptops modernas con counts por defecto",
      "**Pantalla:** fondos UI oscuros muestran mejor el fuego aditivo",
    ],
    viewA: {
      caption: "Walkthrough fuego en azotea — penacho animado sobre la ciudad",
    },
    viewB: {
      caption: "Calor cercano — penacho de partículas sobre el skyline",
    },
    alsoCan: [
      "Recolorear llamas para calor brand-safe",
      "Capa bajo silueta de producto para films de lanzamiento",
      `Insertar el mismo lenguaje de partículas en un beat de [tour guiado 360°](/demos/panorama-360/) (Step 2)`,
      "Abrir [webgpu_particles](https://threejs.org/examples/#webgpu_particles)",
    ],
    howWorks: `Sprites instanciados samplean texturas fuego/humo; materiales nodo TSL animan vida, rotación y blending; WebGPURenderer compone el frame. Upstream: [webgpu_particles](https://threejs.org/examples/#webgpu_particles) ([fuente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_particles.html)). Sistemas de partículas WebGL siguen muy usados para soporte más amplio — elige API según dispositivos de la audiencia.`,
    tourBridge: {
      step: 2,
      stepLabel: "Guided tour Step 2 — partículas + popup hotspot en The Black Witness",
      body: `Fuego/humo standalone es solo la mitad de la historia. En el [360° Panorama Tour](/demos/panorama-360/), **Step 2** está authorado como \`cam · +particles · hotspot+popup\`: la cámara aterriza en un beat de azotea, una capa de partículas vende calor/atmósfera, y un hotspot abre un popup para que los invitados tengan historia + agency en una parada.

Esa conexión es el beneficio de interactividad — las partículas no son wallpaper de fondo; marcan un **momento donde puedes parar, mirar alrededor y clicar**. El mismo craft VFX que exploras aquí se convierte en un beat guiado dentro de un tour compartible. Ver también [Spout](/blog/spout) (Step 3) y [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4).`,
    },
    faq: [
      {
        q: "¿Es simulación de fluidos real?",
        a: "No — VFX sprite con motion authorado. Barato, controlable, pitch-friendly.",
      },
      {
        q: "¿En qué difiere de linked particles?",
        a: `Estos son sprites fuego/humo. Linked particles enfatizan estelas de puntero y cintas vecinas.`,
      },
      {
        q: "¿Dónde aparecen estas partículas en el tour 360?",
        a: `Guided-tour Step 2 en The Black Witness — partículas con popup hotspot. Abre /demos/panorama-360/ y Play guided tour.`,
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
    pageTitle: "BufferGeometry Draw Range — redes de partículas en WebGL",
    demoLabel: "BufferGeometry Draw Range",
    hook: `Una red de partículas viva con líneas de proximidad — \`BufferGeometry.setDrawRange()\` dibuja solo puntos y segmentos activos. Three.js WebGL clásico, aún un workhorse para visuales tipo data.`,
    coverNote: "La portada muestra la nube de partículas nodo-enlace con conexiones activas.",
    whyBullets: [
      "- **Estética de red** — nodos y aristas que se sienten como datos",
      "- **Control draw range** — render solo lo vivo este frame",
      "- **Grafo ajustable** — count, distancia y conexiones máx.",
      "- **Amplio alcance de dispositivos** — WebGL, no solo WebGPU",
    ],
    whyUses: "fondos de marca tech, metáforas de « sistema conectado » y embeds WebGL ligeros.",
    beginner: `Puntos flotan; cuando dos se acercan, aparece una línea fina — como personas convirtiéndose en red. Lo ingenioso es eficiencia: el motor solo dibuja puntos y líneas activos en lugar de todo todo el tiempo.`,
    glossary: [
      {
        term: "BufferGeometry",
        def: "datos mesh Three.js almacenados en buffers GPU",
      },
      {
        term: "Draw range",
        def: "limita qué porción de buffer se dibuja este frame",
      },
      {
        term: "Proximity link",
        def: "línea cuando partículas están dentro de una distancia",
      },
      {
        term: "WebGL",
        def: "API 3D de navegador ampliamente soportada usada por esta demo",
      },
    ],
    trySteps: [
      "Abre la [demo BufferGeometry Draw Range](/demos/buffergeometry-drawrange/)",
      "Orbita la nube de partículas",
      "Sube o baja count de partículas y distancia de enlaces en la UI",
      "Observa líneas aparecer/desaparecer cuando cambian vecinos",
    ],
    requirements: [
      "**Navegador:** cualquier navegador moderno con WebGL",
      `**GPU:** escala con counts de partículas y conexiones — baja en dispositivos débiles`,
      "**Nota API:** ruta WebGL — útil cuando WebGPU no está disponible",
    ],
    viewA: {
      caption: "Red completa — partículas con segmentos de proximidad",
    },
    viewB: {
      caption: "Grafo cercano — enlaces activos draw-range claramente legibles",
    },
    alsoCan: [
      "Mapear colores a categorías o fuerza de señal",
      "Usar como fondo atenuado bajo copy UI",
      `Estudiar [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange)`,
    ],
    howWorks: `Partículas actualizan en JS (o buffers GPU-friendly simples); segmentos de línea se reconstruyen o rangen para pares cercanos; \`setDrawRange\` limita draws al subconjunto activo. Upstream: [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange) ([fuente](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_buffergeometry_drawrange.html)). Para bandadas compute WebGPU y cintas link TSL, ver experimentos más nuevos — misma familia visual, API distinta.`,
    faq: [
      {
        q: "¿Por qué no WebGPU aquí?",
        a: `WebGL aún gana para máxima cobertura de dispositivos. WebGPU cuando compute o materiales TSL lo necesitan.`,
      },
      {
        q: "¿Los enlaces pueden representar datos reales?",
        a: `Sí — reemplazar proximidad aleatoria con tus aristas de grafo en build de producción.`,
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
    pageTitle: "Catmull Spline Editor — caminos que puedes arrastrar",
    demoLabel: "Catmull Spline Editor",
    hook: `Caminos Catmull-Rom interactivos con gizmos transform — compara uniform, centripetal y chordal, ajusta tensión y exporta arrays \`Vector3\` para rails de cámara y caminos de objetos.`,
    coverNote: `La portada muestra la spline editable con puntos de control y contraste de tipo de curva.`,
    whyBullets: [
      "- **Authorar caminos visualmente** — sin teclear listas de coordenadas primero",
      `- **Comparación de tipo de curva** — uniform vs centripetal vs chordal en un lugar`,
      "- **Listo para export** — arrays Vector3 para rails, fly-throughs y modifiers",
      "- **Fiabilidad WebGL** — funciona donde WebGPU aún no está disponible",
    ],
    whyUses: `planificación de caminos de cámara, rails turntable de producto y herramientas briefing de motion.`,
    beginner: `Una spline es una curva suave guiada por pocos puntos de control — como una regla flexible. Arrastra los puntos y el camino se actualiza. Cine y juegos usan la misma idea para movimientos de cámara; aquí lo editas en el navegador.`,
    glossary: [
      {
        term: "Catmull-Rom",
        def: "familia spline que interpola a través de puntos de control",
      },
      {
        term: "Centripetal",
        def: "parametrización que suele evitar mejor bucles/cúspides que uniform",
      },
      {
        term: "Tension",
        def: "qué tan fuerte la curva se curva hacia los controles",
      },
      {
        term: "Gizmo",
        def: "manija translate/rotate/scale en pantalla para un punto",
      },
    ],
    trySteps: [
      "Abre la [demo Spline Editor](/demos/spline-editor/)",
      "Arrastra puntos de control con el gizmo",
      "Cambia uniform / centripetal / chordal y compara la curvatura",
      "Exporta o copia datos Vector3 si la UI lo ofrece — rail de cámara",
    ],
    requirements: [
      "**Navegador:** navegador WebGL moderno (Chrome, Edge, Firefox, Safari)",
      "**Input:** ratón para drags de gizmo; desktop es más fácil",
      "**API:** familia ejemplo Three.js WebGL — no WebGPU",
    ],
    viewA: {
      caption: "Camino completo — puntos de control y curva Catmull-Rom suave",
    },
    viewB: {
      caption: "Edición gizmo — reforma local del rail",
    },
    alsoCan: [
      "Alimentar exports en cámaras fly-through",
      "Emparejar con WebGPU curve modifier para type-on-path",
      `Usar upstream [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor)`,
    ],
    howWorks: `Puntos de control definen una \`CatmullRomCurve3\`; el editor visualiza polilínea/curva y permite transformar puntos. Tipo de curva y tensión cambian parametrización. Upstream: [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor) ([fuente](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_geometry_spline_editor.html)). Exportar puntos conecta con herramientas de camino IOM y el [WebGPU curve modifier](/demos/webgpu-modifier-curve/).`,
    faq: [
      {
        q: "¿Qué tipo de curva elegir?",
        a: "Centripetal es default seguro contra cúspides; compara en la UI para tu camino.",
      },
      {
        q: "¿Puede conducir una cámara real en sitio cliente?",
        a: "Sí — conectamos puntos exportados a un controlador de cámara de producción.",
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
    pageTitle: "Terrain Sandbox — pintar un mundo desde noise",
    demoLabel: "Terrain Sandbox",
    hook: `Noise en capas se convierte en colinas que puedes orbitar — coloca árboles, rocas y marcadores, regenera seeds, ajusta altura y rugosidad. Un MVP sandbox WebGL IOM hacia brushes, GLTF y datos DEM reales.`,
    coverNote: "La portada muestra un parche de terreno con seed y props dispersos.",
    whyBullets: [
      "- **Paisaje jugable** — stakeholders entienden mood del sitio rápido",
      "- **Seed + perillas** — variantes reproducibles para dirección artística",
      "- **Props en superficie** — árboles/rocas/marcadores para historias de escala",
      "- **Roadmap-friendly** — MVP hacia sculpt, GLTF, MapTiler DEM",
    ],
    whyUses: `pitches de entorno tempranos, previews tipo juego y herramientas workshop para charlas de layout.`,
    beginner: `El suelo aún no está esculpido a mano — matemáticas (noise) inventan colinas. Cambias qué tan altas y rugosas son, plantas algunos objetos para que la escala se sienta real, y giras como explorando un sitio.`,
    glossary: [
      {
        term: "Procedural terrain",
        def: "paisaje generado por algoritmos en lugar de malla escaneada",
      },
      {
        term: "Seed",
        def: "número que hace reproducible el mismo paisaje aleatorio",
      },
      {
        term: "DEM",
        def: "digital elevation model — datos de altura reales (ruta futura)",
      },
      {
        term: "WebGL",
        def: "API 3D de navegador usada por este sandbox",
      },
    ],
    trySteps: [
      "Abre la [demo Terrain Sandbox](/demos/terrain-sandbox/)",
      "Orbita el terreno; regenera seed para nueva landform",
      "Ajusta altura y rugosidad",
      "Coloca árboles, rocas o marcadores y revisa silueta",
    ],
    requirements: [
      "**Navegador:** navegador WebGL moderno",
      `**GPU:** grids más grandes cuestan más — reduce resolución en dispositivos ligeros`,
      "**Red:** no requerida para terreno noise core (props locales a la demo)",
    ],
    viewA: {
      caption: "Landform amplia — colinas noise con crestas legibles",
    },
    viewB: {
      caption: "Pass props — árboles/rocas dando escala humana",
    },
    alsoCan: [
      "Guardar seeds favoritos como referencias de dirección artística",
      "Planear follow-up con brushes sculpt o props GLTF",
      "Comparar con tiles reales en Procedural GL",
    ],
    howWorks: `Muestras noise en capas construyen heightmap; malla displaced y sombreada; props raycast o height-sample en superficie. Stack Three.js en **WebGL** para soporte amplio. MVP sandbox IOM — no ejemplo stock three.js — con ruta hacia brushes, import de assets y MapTiler DEM opcional para sitios reales.`,
    faq: [
      {
        q: "¿Es geografía real?",
        a: `Aún no — noise procedural. DEM / MapTiler real en roadmap para trabajo site-true.`,
      },
      {
        q: "¿WebGL o WebGPU?",
        a: "WebGL para este sandbox para que más dispositivos abran el enlace.",
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
    pageTitle: "Procedural GL Terrain — tiles del mundo real en 3D",
    demoLabel: "Procedural GL Terrain",
    hook: `Paisajes reales streamados como terreno GPU LOD — nuestra página embedda el [procedural.eu](https://www.procedural.eu/map/) map oficial powered by procedural-gl.js (MPL-2.0). Primer paso: demo upstream live; build MapTiler self-hosted puede seguir.`,
    coverNote: `La portada es un still live del embed procedural.eu — tiles elevación/imagen MapTiler reales en 3D, no sandbox noise.`,
    whyBullets: [
      "- **Lugares reales** — elevación desde tiles map, no solo noise",
      "- **GPU LOD** — detalle donde miras, mallas más ligeras lejos",
      "- **Core open-source** — procedural-gl.js bajo MPL-2.0",
      "- **Puente a producción** — embed ahora; self-host después con tu key",
    ],
    whyUses: `contexto de sitio para arquitectura, pitches de ubicación y geo storytelling web.`,
    beginner: `En lugar de inventar colinas, este viewer carga tiles de terreno reales para sobrevolar geografía actual en 3D — más cerca de una Earth view ligera que un nivel de juego hecho de noise.`,
    glossary: [
      {
        term: "LOD",
        def: "level of detail — más detalle mesh cerca de cámara",
      },
      {
        term: "Map tiles",
        def: "piezas imagen/elevación streamadas para vista actual",
      },
      {
        term: "procedural-gl.js",
        def: "librería open-source terreno GPU desde datos map",
      },
      {
        term: "MapTiler",
        def: "proveedor tiles usado a menudo para keys producción (fuera del repo)",
      },
    ],
    trySteps: [
      "Abre la [demo Procedural GL](/demos/procedural-gl/)",
      "Espera a que cargue el embed [procedural.eu map](https://www.procedural.eu/map/)",
      "Pan y zoom sobre terreno real",
      "Imagina colocar edificio cliente o camino en una cresta conocida",
    ],
    requirements: [
      "**Red:** requerida — tiles y embed procedural.eu necesitan conectividad",
      "**Navegador:** Chromium moderno recomendado para terreno WebGL",
      "**Keys:** keys MapTiler producción quedan server-side / env — nunca commiteadas",
    ],
    viewA: {
      caption: "Vista regional — terreno LOD desde tiles streamadas",
    },
    viewB: {
      caption: "Relieve cercano — crestas y valles legibles en 3D",
    },
    alsoCan: [
      "Usar como contexto junto a GLB geolocalizado",
      "Planear fork MapTiler self-hosted",
      "Leer docs en [procedural.eu](https://www.procedural.eu/)",
    ],
    howWorks: `Nuestra página \`/demos/procedural-gl/\` embedda la experiencia map oficial en [procedural.eu/map](https://www.procedural.eu/map/). Bajo el capó, [procedural-gl-js](https://github.com/felixpalmer/procedural-gl-js) construye mallas GPU LOD desde tiles elevación/imagen (WebGL). Siguiente paso IOM: build self-hosted con MapTiler — API keys fuera del git repo. Terreno geográfico, complementario al noise procedural [Terrain Sandbox](/demos/terrain-sandbox/).`,
    faq: [
      {
        q: "¿El map está hosteado por IOM?",
        a: `Este primer paso embedda procedural.eu. Variante self-hosted = tarea producción separada.`,
      },
      {
        q: "¿WebGL o WebGPU?",
        a: `Streaming terreno WebGL vía procedural-gl.js — elegido por stack de librería y ecosistema tiles.`,
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
    pageTitle: "Spout — agua de tubería raymarched",
    demoLabel: "Spout",
    hook: `Una tubería cromada vertiendo agua raymarched — refracción, transparencia y reflexiones en un port WebGL2 self-hosted del Shadertoy clásico de P_Malin. Arrastra para orbitar la escultura fluida — luego el mismo beat de agua integrado en nuestro [360° Panorama Tour](https://iobjectm.com/demos/panorama-360/) (guided Step 3).`,
    coverNote: `La portada muestra el caño con agua refractiva capturando el entorno. El mismo lenguaje de efecto aparece como Step 3 (\`+particles/spout\`) en https://iobjectm.com/demos/panorama-360/.`,
    whyBullets: [
      "- **Pedigree Shadertoy** — pieza de estudio conocida, ahora en iobjectm.com",
      `- **Agua raymarched** — sin malla splash de partículas; distance fields hacen el trabajo`,
      `- **Refracción y reflexión** — lenguaje material que clientes reconocen de anuncios`,
      "- **Port WebGL2** — alcance en tiempo real amplio sin WebGPU",
      `- **Integrado en tours 360°** — Step 3 en [Panorama 360](https://iobjectm.com/demos/panorama-360/) empareja spout/agua con popup hotspot`,
    ],
    whyUses: `demos craft shader, moodboards branding líquido, enseñar look-dev raymarching y beats de agua en tours guiados 360° interactivos.`,
    beginner: `El agua no es un splash filmado. La GPU avanza rayos a través de una forma matemática hasta golpear « agua » o « metal », y curva la vista como una lente. Por eso tubo y fluido se ven tan limpios desde cualquier ángulo. En nuestro [tour 360°](https://iobjectm.com/demos/panorama-360/), ese mismo lenguaje líquido se convierte en una parada guiada donde invitados pueden mirar alrededor y clicar.`,
    glossary: [
      {
        term: "Raymarching",
        def: `pasos a lo largo de un rayo a través de un distance field hasta encontrar superficie`,
      },
      {
        term: "SDF",
        def: "signed distance function — matemática que describe formas para raymarchers",
      },
      {
        term: "Refraction",
        def: "curvatura de la vista a través de agua transparente",
      },
      {
        term: "Shadertoy",
        def: "playground online de shaders pixel/raymarch (original de P_Malin)",
      },
      {
        term: "Guided tour Step 3",
        def: "en /demos/panorama-360/ — cam · +particles/spout · hotspot+popup",
      },
    ],
    trySteps: [
      "Abre la [demo Spout](/demos/spout/)",
      "Arrastra para orbitar tubo y agua",
      "Observa la refracción desplazar el fondo a través del fluido",
      `Abre [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, y mira Step 3 (spout / agua + hotspot)`,
      "Compara con la [vista Shadertoy](https://www.shadertoy.com/view/lsXGzH) original",
    ],
    requirements: [
      "**Navegador:** Chrome, Edge, Firefox o Safari compatible WebGL2",
      "**GPU:** coste raymarch ligero a moderado — reduce resolución si hace falta",
      "**API:** port shader WebGL2 — no compute WebGPU",
    ],
    viewA: {
      caption: "Spout hero — metal de tubo y columna de agua refractiva",
    },
    viewB: {
      caption: "Detalle orbit — reflexiones y transparencia en el fluido",
    },
    alsoCan: [
      "Retunear paleta para metales de marca y tinte de fluido",
      "Usar stills como referencias look-dev de líquidos de producto",
      `Insertar el beat de agua en una parada de [tour guiado 360°](/demos/panorama-360/) (Step 3)`,
      `Creditar y estudiar el [Shadertoy](https://www.shadertoy.com/view/lsXGzH) de P_Malin`,
    ],
    howWorks: `Un fragment shader WebGL2 fullscreen (o ligado a mesh) raymarched SDFs para tubo y agua, aplicando refracción, transparencia y reflexiones. IOM aloja un port del experimento Shadertoy [lsXGzH](https://www.shadertoy.com/view/lsXGzH) de P_Malin bajo \`/demos/spout/\`. Es shader art clásico en **WebGL2**, complementario a demos escena Three.js y distinto del agua WebGPU TSL.`,
    tourBridge: {
      step: 3,
      stepLabel: `Guided tour Step 3 — spout / partículas agua + popup hotspot en The Black Witness`,
      body: `Spout no es solo un experimento standalone. En [https://iobjectm.com/demos/panorama-360/](https://iobjectm.com/demos/panorama-360/), **Step 3** del tour guiado The Black Witness está authorado como \`cam · +particles/spout · hotspot+popup\`: la cámara aterriza en el beat agua rooftop, la capa spout/agua vende movimiento líquido in situ, y un popup hotspot mantiene la narrativa interactiva.

Ese es el beneficio de interactividad — invitados no solo miran refracción; llegan a una **parada temporizada**, aún pueden mirar alrededor y clicar el hotspot por significado. Abre el editor o [vista previa visitante](https://iobjectm.com/demos/panorama-360/?mode=preview), pulsa **Play guided tour**, y ve a Step 3. Empareja con [WebGPU Particles](/blog/webgpu-particles) (Step 2) y [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4) para el stack de efectos completo.`,
    },
    faq: [
      {
        q: "¿El agua se simula con física?",
        a: "No — geometría/animación shader raymarched, no sim de partículas fluido.",
      },
      {
        q: "¿Puede correr dentro de una escena producto Three.js?",
        a: `A menudo como screen pass o efecto localizado — integración acotada por proyecto. El tour panorama en https://iobjectm.com/demos/panorama-360/ es un ejemplo de producción.`,
      },
      {
        q: "¿Dónde aparece Spout en el tour 360?",
        a: `Guided-tour Step 3 en The Black Witness — spout/agua con popup hotspot. Abre https://iobjectm.com/demos/panorama-360/ y Play guided tour.`,
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
