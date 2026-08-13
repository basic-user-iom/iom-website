import { PROJECT_COSTS_META } from '../../project-costs/data'
import type { ProjectCostsCopy } from './types'

const specialist = PROJECT_COSTS_META.specialistDayRate
const intro = PROJECT_COSTS_META.specialistIntroDayRate
const studioFrom = PROJECT_COSTS_META.studioTeamFromDayRate
const deadline = PROJECT_COSTS_META.augustOfferDeadline

export const esProjectCosts: ProjectCostsCopy = {
  page: {
    print: 'Imprimir / Guardar como PDF',
    engageHeading: 'Cómo puedes contratar a IOM',
    engageLead:
      'Elige el nivel de apoyo a la producción que encaje con el proyecto. Empieza con un especialista, añade capacidad de estudio cuando el trabajo en paralelo sea útil, o acota un proyecto mayor con nosotros.',
    refsHeading: 'Proyectos de referencia detallados',
    refsLead:
      'Qué incluía cada ejemplo, rangos de producción típicos y por qué la referencia puede — o no — ser comparable a una nueva solicitud. No son precios de paquete fijos.',
    factorsHeading: 'Qué influye en el coste y el plazo',
    factorsLearnLabel: 'Más sobre los factores de precio',
    factorsLearnTitle: 'Factores técnicos que cambian el esfuerzo de producción',
    glanceAria: 'Comparación rápida de proyectos',
    glanceProject: 'Proyecto',
    glanceEffort: 'Esfuerzo comparable típico',
    glanceDelivery: 'Entrega típica',
    glanceBudget: 'Presupuesto indicativo',
    glanceReference: 'Referencia: {title}',
    typicallyIncludes: 'Suele incluir',
    priceDrivers: 'El precio suele cambiar por',
    productAdditions: 'Posibles añadidos a nivel de producto',
    viewCaseStudy: 'Ver estudio de caso →',
    protoHeading: 'Empezar con un prototipo centrado',
    protoLead:
      'La mayoría de los proyectos no necesitan empezar con la construcción de referencia completa. Un prototipo más pequeño y claramente definido puede validar la interacción central, la dirección visual y el flujo técnico antes de aprobar el alcance de producción completo.',
    protoNote:
      'El trabajo de prototipo se estructura para que el código, los assets y las decisiones de diseño útiles puedan continuar en la siguiente etapa de producción cuando sea práctico — a través de Research (Raven), Form (Fox) y Output (Octopus).',
    protoAria: 'Etapas de prototipo · Research Form Output',
    howHeading: 'Equipo núcleo pequeño, producción escalable',
    howLead:
      'IOM escala la capacidad de producción según las necesidades del proyecto. Algunas fases las puede cubrir un especialista sénior, mientras que las fases intensivas de producción pueden ampliarse cuando el trabajo en paralelo es realmente útil.',
    estimateHeading: 'Sobre estas estimaciones',
    estimateIntro:
      'Todas las cifras de esta página son rangos de planificación indicativos para trabajo comparable a los estudios de caso. No son precios de paquete fijos, presupuestos contractuales ni el coste histórico exacto de los proyectos originales.',
    estimateQuotes:
      'Los presupuestos de alcances mayores se preparan por separado tras una consulta. Salvo inclusión explícita en un presupuesto, los conceptos listados al lado se estiman normalmente por separado.',
    estimateHighlightsAria: 'Tarifas clave',
    estimateHighlightsEyebrow: 'Rangos de planificación',
    estimateExcludes: 'Normalmente presupuestados por separado',
    checklistLabel: 'Información útil que incluir:',
    viewCaseStudies: 'Ver todos los estudios de caso',
    bookConsult: 'Reservar una consulta gratuita',
    requestEstimate: 'Solicitar una estimación de proyecto',
    compareOptions: 'Comparar opciones de contratación',
    startsPanelEyebrow: 'Consulta gratuita de 30 minutos',
    startsPanelAria: 'Próximos pasos',
    scopedAfterConsultation: 'Acotado tras consulta',
    productionDay: '€{rate} / día de producción',
    fromProductionDay: 'Desde €{rate} / día de producción',
  },
  hero: {
    eyebrow: 'Alcance · Tiempo · Presupuesto',
    title: 'Capacidad de producción flexible',
    lead:
      'IOM puede contratarse para producción sénior centrada, capacidad adicional de estudio, o un proyecto de mayor alcance. El encaje correcto depende del trabajo que realmente pueda avanzar en paralelo.',
    sub:
      'Esta página es orientación transparente, no un catálogo de paquetes fijos. Las tarifas diarias cualifican un punto de partida; el trabajo mayor se acota tras una consulta breve.',
    ctaPrimary: 'Hablar de un proyecto',
    ctaSecondary: 'Ver proyectos de referencia',
  },
  engagement: {
    specialist: {
      title: 'Capacidad de especialista sénior',
      question: '¿Necesitas un especialista experimentado?',
      summary:
        'Incorpora capacidad de producción sénior para un flujo técnico o 3D claramente definido dentro de tu proyecto existente.',
      rateLine: `€${specialist} / día de producción`,
      rateNote: 'Producción sénior centrada para un flujo de trabajo definido.',
      learnMoreLabel: 'Más sobre la capacidad de especialista sénior',
      learnMoreTitle: 'Capacidad de especialista sénior — detalle técnico',
      learnMoreParagraphs: [
        'Adecuado para trabajo claramente definido como desarrollo 3D en tiempo real, componentes interactivos en el navegador, preparación y optimización de assets 3D, producción en Blender o Unreal, flujos CAD/BIM a tiempo real, fotogrametría, producción 360, prototipado, resolución de problemas e I+D técnica.',
        'Un solo especialista mantiene más bajo el coste diario de producción, pero ofrece menos capacidad en paralelo. Los paquetes mayores pueden por tanto requerir un plazo de entrega más largo.',
        'La pila técnica exacta se elige según el proyecto y no se trata como el producto en sí.',
        'Herramientas y formatos típicos cuando son útiles: Three.js · WebGL / WebGPU · Blender · Unreal Engine · CAD / BIM · GLB / FBX / OBJ · fotogrametría · producción 360°.',
      ],
    },
    'studio-capacity': {
      title: 'Capacidad adicional de estudio',
      question: '¿Necesitas más capacidad de producción?',
      summary:
        'IOM puede hacerse cargo de una parte definida del proyecto y añadir producción en paralelo cuando realmente ayuda al calendario.',
      rateLine: `Desde €${studioFrom} / día de producción`,
      rateNote: 'Capacidad paralela extra cuando el proyecto se beneficia de verdad.',
      learnMoreLabel: 'Más sobre la capacidad adicional de estudio',
      learnMoreTitle: 'Capacidad adicional de estudio — detalle técnico',
      learnMoreParagraphs: [
        'Para trabajo que se beneficia de producción en paralelo, IOM puede añadir capacidad en producción 3D, desarrollo en tiempo real, preparación de assets, integración de contenido, optimización y pruebas.',
        'Más personas no hacen automáticamente cada tarea proporcionalmente más rápida. Algunas fases son secuenciales; otras pueden avanzar en paralelo. La configuración de producción debe seguir las dependencias reales del proyecto.',
        'La capacidad también puede cambiar por fase: un especialista durante la preparación, capacidad adicional durante la producción, y de nuevo un equipo más pequeño para la integración y entrega finales.',
      ],
    },
    'project-scoping': {
      title: 'Proyecto completo / mayor',
      question: '¿Necesitas que llevemos el proyecto más lejos?',
      summary:
        'En proyectos interactivos, 3D o espaciales de mayor tamaño, primero revisamos los objetivos, el material de origen, los requisitos de entrega y el calendario, y después recomendamos la configuración de producción adecuada.',
      rateLine: 'Acotado tras consulta',
      rateNote: 'La estructura de producción y el precio siguen el alcance real, el material, el calendario y las dependencias.',
      learnMoreLabel: 'Más sobre proyectos completos y mayores',
      learnMoreTitle: 'Proyecto completo / mayor — detalle técnico',
      learnMoreParagraphs: [
        'Antes de presupuestar un proyecto mayor, IOM revisa el material de origen disponible, los requisitos técnicos, los entregables, el plazo, las responsabilidades de integración, el proceso de revisión y cualquier dependencia externa.',
        'El objetivo es recomendar solo el nivel de capacidad de estudio que sea realmente útil. Los alcances mayores pueden estructurarse como hitos, fases o paquetes de producción definidos, no como una plantilla fija durante toda la duración.',
      ],
    },
  },
  capacity: {
    title: 'Precio y tiempo se conectan a través de la capacidad de producción',
    summary:
      'Un especialista tiene un coste diario más bajo. Un equipo pequeño cuesta más al día pero a menudo puede avanzar varias partes del trabajo a la vez. Los proyectos mayores pueden usar una persona en algunas fases y dos o tres solo cuando la producción en paralelo es útil.',
    learnMoreLabel: 'Más sobre plazos y capacidad',
    learnMoreTitle: 'Plazos, capacidad y producción en paralelo',
    learnMoreParagraphs: [
      'Las tarifas diarias describen capacidad de producción, no una garantía de que cada tarea termine proporcionalmente más rápido con más personas. Parte del trabajo debe ser secuencial; otros flujos — preparación de assets, desarrollo, integración, pruebas — pueden ir en paralelo si se planifican con cuidado.',
      'Un solo especialista suele ser el punto de partida más eficiente para una tarea centrada, o cuando tu equipo ya cubre parte del pipeline. La capacidad de estudio se añade cuando el calendario o el alcance se benefician de verdad de la producción en paralelo.',
      'Los presupuestos de alcances mayores siguen separados de las tarifas diarias. La consulta establece entregables, estado del material de origen, enfoque técnico y el plan de capacidad más pequeño que sea útil antes de empezar.',
    ],
  },
  august: {
    eyebrow: 'Agosto 2026 — disponibilidad introductoria',
    title: 'Capacidad limitada de especialista sénior para nuevas colaboraciones',
    lines: [
      `Para nuevas colaboraciones confirmadas a más tardar el ${deadline}, hay una cantidad limitada de capacidad de especialista sénior disponible a €${intro} / día de producción en lugar de la tarifa estándar de €${specialist} / día de producción.`,
      'La tarifa introductoria acordada puede continuar más allá de agosto para el alcance inicial confirmado.',
    ],
    cta: 'Preguntar por disponibilidad en agosto',
  },
  examples: {
    title: 'Proyectos de referencia',
    lead:
      'Estos ejemplos muestran la escala aproximada de trabajo anterior. No son paquetes fijos; el alcance final, el calendario y la capacidad de producción dependen del material de origen, los requisitos de interacción y el contexto de entrega.',
    glanceNote:
      'Selecciona una fila para desplazarte a la ficha de referencia detallada. Las cifras son rangos de planificación, no precios de catálogo.',
    rangeNote:
      'El extremo inferior suele asumir un alcance claramente definido, assets bien preparados, un calendario de producción estándar y poca incertidumbre técnica. Integraciones complejas, desarrollo especializado, material de origen incompleto o entrega acelerada pueden aumentar el presupuesto final.',
  },
  factorsSimple:
    'La estimación depende de qué hay que construir, el estado de tu material de origen, cuán complejas deben ser la interacción y las imágenes, y con qué rapidez hay que entregarlo.',
  factors: [
    { title: 'Calidad y estado del material de origen', text: 'Assets limpios y listos para producción frente a datos CAD/BIM/3D incompletos o difíciles.' },
    { title: 'Complejidad de la interacción', text: 'Presentación simple frente a lógica en tiempo real a medida, herramientas, configuración o comportamientos en varios pasos.' },
    { title: 'Complejidad visual', text: 'Número de entornos, objetos, materiales, requisitos de iluminación, animación y estados de contenido.' },
    { title: 'Requisitos de integración', text: 'Módulo autónomo frente a integración en un sitio existente, producto de software o cadena del cliente.' },
    { title: 'Rendimiento y QA', text: 'Navegadores admitidos, dispositivos, objetivos móviles, límites de GPU y metas de optimización.' },
    { title: 'Calendario', text: 'Los plazos comprimidos pueden exigir más capacidad de producción en paralelo.' },
    { title: 'Estructura de feedback y revisiones', text: 'Un decisor y rondas de revisión definidas difieren de cambios continuos con muchos interesados.' },
    { title: 'Costes de terceros', text: 'Assets de pago, licencias, hosting especial, servicios externos, viajes o hardware deben presupuestarse por separado cuando corresponda.' },
    { title: 'Soporte continuo', text: 'El mantenimiento, las actualizaciones de contenido o el soporte posterior al lanzamiento pueden organizarse por separado si hace falta.' },
  ],
  starts: {
    title: 'Cómo empieza un proyecto',
    lead: 'Cuatro pasos claros desde la primera conversación hasta una estimación acotada. Sin compromiso hasta que apruebes el enfoque y el presupuesto.',
    steps: [
      { title: 'Comparte la idea', text: 'Cuéntanos qué quieres construir — incluso si el brief aún es aproximado.' },
      { title: 'Revisarlo juntos', text: 'Revisamos el objetivo, el material de origen disponible, el formato de entrega y la fecha límite.' },
      { title: 'Ajustar la capacidad', text: 'Recomendamos si el trabajo encaja mejor con un especialista, capacidad adicional de estudio, o un equipo de proyecto acotado.' },
      { title: 'Recibe una estimación clara', text: 'Recibes alcance, enfoque de producción y estimación antes de que empiece el trabajo.' },
    ],
    footer:
      'En proyectos mayores, la capacidad puede cambiar durante la producción, para que no pagues un equipo más grande en fases que no lo necesitan.',
    consultationNote:
      'Cualquier proyecto potencial puede empezar con una consulta gratuita de 30 minutos. La investigación técnica, la inspección de archivos, las pruebas de flujo, el trabajo de diseño y el desarrollo de prototipos se presupuestan por separado cuando es necesario.',
    cta: 'Reservar una consulta gratuita',
  },
  prototype: [
    { title: 'Definir el reto', text: 'Define el objetivo central, la interacción principal y el resultado más importante del proyecto.', stage: 'Research', stageLine: 'Comprende al cliente, al público, la historia y el reto técnico antes de construir nada.' },
    { title: 'Dar forma a la solución', text: 'Construye y prueba una versión de trabajo centrada con contenido representativo y condiciones técnicas realistas.', stage: 'Form', stageLine: 'Convierte la investigación en un lenguaje visual claro, una estructura de interacción y un enfoque técnico.' },
    { title: 'Entregar el resultado', text: 'Amplía la solución aprobada a la experiencia completa, contenido adicional y despliegue de producción.', stage: 'Output', stageLine: 'Refina y entrega el resultado final como una experiencia que la gente puede abrir, comprender y usar.' },
  ],
  howIomWorks: [
    { title: 'La capacidad sigue al trabajo', text: 'IOM escala la capacidad de producción según las necesidades del proyecto. Algunas fases las puede cubrir un especialista sénior, mientras que las fases intensivas pueden ampliarse cuando el trabajo en paralelo es realmente útil.' },
    { title: 'Configuración de producción clara', text: 'En encargos mayores, la configuración de producción se acuerda de antemano, para que las responsabilidades, la capacidad y la comunicación sigan claras.' },
    { title: 'Pasos claros', text: 'Investigación, prototipo, producción y entrega pueden presupuestarse como pasos separados, de modo que el alcance pueda revisarse antes de cada compromiso mayor.' },
  ],
  finalCta: {
    title: 'Cuéntanos qué estás intentando construir',
    lead: 'No necesitas un brief técnico. Envía el objetivo, lo que ya tienes y la fecha hacia la que trabajas. Te ayudamos a determinar la configuración de producción adecuada.',
    cta: 'Hablar de un proyecto',
  },
  contactChecklist: [
    'Objetivo principal del proyecto',
    'Público previsto',
    'Assets 3D, 360° o de medios existentes',
    'Entrega deseada: web, escritorio, móvil, VR o instalación',
    'Fecha de finalización preferida',
    'Presupuesto aproximado disponible, si se conoce',
  ],
  selectedSupport: {
    title: 'Apoyo selectivo a proyectos',
    lead:
      'Los proyectos con un valor creativo, técnico, cultural, educativo o social especialmente fuerte pueden recibir ocasionalmente apoyo adicional de IOM. Si el proyecto encaja y el calendario de producción lo permite, eso puede ser una tarifa de proyecto reducida o un número definido de horas de producción sin coste.',
    footer: 'Cualquier apoyo de este tipo se evalúa individualmente y se acuerda por escrito antes de que empiece la producción.',
  },
  estimate: {
    productionTime:
      'Los calendarios mostrados describen periodos de producción activa aproximados. La entrega en calendario también puede depender de la disponibilidad del material del cliente, el feedback agrupado, las aprobaciones externas, los servicios de terceros y el momento de las decisiones del proyecto.',
    blended:
      'La tarifa de producción típica de IOM está entre 75 € y 110 € por hora, según la complejidad técnica, los requisitos especializados, la preparación de assets y el plazo de entrega. Los proyectos definidos pueden presupuestarse como pasos de producción fijos o con una tarifa de proyecto mixta. Por eso los presupuestos de referencia siguientes son rangos de planificación, no una multiplicación directa de cada hora estimada por la tarifa horaria más alta.',
    highlights: [
      { label: 'Capacidad de especialista sénior', value: `€${specialist} / día de producción` },
      { label: 'Capacidad adicional de estudio', value: `desde €${studioFrom} / día de producción` },
      { label: 'Proyectos mayores / completos', value: 'Acotado tras consulta' },
    ],
    exclusions: ['Viajes', 'Fotografía in situ', 'Escaneado', 'Assets de pago', 'Licencias de software de terceros', 'Costes de hosting', 'Impuestos', 'Mantenimiento continuo'],
  },
  references: {
    cursor: {
      category: 'UI · Cursor · Interacción',
      glanceCategory: 'Interacción web a medida',
      title: 'Labelled Custom Cursor',
      description:
        'Un cursor contextual para un sitio existente, con estados de interacción etiquetados, comportamiento al pasar el ratón, transiciones animadas del puntero y un fallback móvil estándar.',
      imageAlt: 'Estudio de caso Labelled Custom Cursor',
      learnMoreLabel: 'Más sobre alcance y precio',
      tiers: [{ label: 'Esfuerzo comparable típico', hours: '4–7 horas de producción', delivery: 'Aproximadamente 1 día laborable' }],
      includes: ['Concepto visual del cursor', 'Estilo a medida del puntero y las etiquetas', 'Estados hover para enlaces, botones y elementos seleccionados', 'Animación básica del puntero', 'Integración en un sitio existente y funcional', 'Pruebas en navegadores de escritorio', 'Fallback móvil estándar'],
      priceDrivers: ['Número de estados del cursor', 'Complejidad de la animación', 'Framework del sitio existente', 'Estado y estructura del código del sitio', 'Comportamiento adicional específico de página', 'Controles de configuración o edición', 'Entrega urgente'],
      assumption:
        'Este rango aplica cuando el cursor se añade a un sitio existente y funcional y los estados de interacción requeridos están claros. Rediseños de interfaz más amplios, sistemas de animación extensos, integración CMS compleja o entrega acelerada se estiman por separado.',
    },
    'black-witness': {
      category: '360° · Narrativa · WebGPU',
      glanceCategory: 'Experiencia 360° guiada',
      title: 'The Black Witness',
      description:
        'Una experiencia narrativa 360° guiada con escenas equirectangulares, navegación estructurada, hotspots, diseño de interfaz, capas de efectos visuales y una presentación compartible en el navegador.',
      imageAlt: 'Estudio de caso The Black Witness 360°',
      learnMoreLabel: 'Más sobre alcance y precio',
      tiers: [
        { label: 'Versión centrada', hours: '40–80 horas de producción', delivery: '1–2 semanas' },
        { label: 'Nivel de estudio de caso', hours: '80–160 horas de producción', delivery: '2–4 semanas' },
      ],
      includes: ['Una o más escenas 360° aportadas', 'Sistema de hotspots y anotaciones', 'Movimiento de cámara guiado', 'Diseño de interfaz y navegación', 'Presentación responsive en el navegador', 'Capas de efectos visuales', 'Despliegue y pruebas'],
      priceDrivers: ['Número de panoramas', 'Número y complejidad de hotspots', 'Si el material visual final ya está disponible', 'Animación propia o efectos WebGPU', 'Audio, narración y accesibilidad', 'Preparación de contenido y redacción', 'Plazo de entrega deseado'],
      assumption:
        'El rango asume que el material 360° definitivo y el contenido narrativo aprobado los aporta el cliente. Fotografía, escaneado, viajes y producción de contenido se presupuestan por separado.',
    },
    miab: {
      category: 'WebGPU · Océano · Interacción',
      glanceCategory: 'Experiencia en tiempo real en el navegador',
      title: 'Message in a Bottle',
      description:
        'Una experiencia original en tiempo real en el navegador con agua y cielo procedurales, objetos animados, diseño de interfaz, condiciones de día y noche, un flujo para escribir mensajes y una salida interactiva compartible.',
      imageAlt: 'Estudio de caso Message in a Bottle',
      learnMoreLabel: 'Más sobre alcance y precio',
      tiers: [
        { label: 'Prototipo centrado', hours: '80–160 horas de producción', delivery: '2–4 semanas' },
        { label: 'Nivel de estudio de caso', hours: '160–320 horas de producción', delivery: '4–7 semanas' },
      ],
      includes: ['Concepto creativo y técnico', 'Entorno oceánico y de cielo en tiempo real', 'Animación e interacción de objetos', 'Interfaz para escribir mensajes', 'Estados de día, noche o clima', 'Entrega responsive en el navegador', 'Optimización de rendimiento', 'Pruebas entre navegadores'],
      priceDrivers: ['Realismo visual deseado', 'Número de estados de entorno', 'Compartir, almacenamiento o backend', 'Producción propia de assets 3D', 'Requisitos de rendimiento móvil', 'Diseño de sonido y animación adicional', 'Entrega acelerada o plazos de lanzamiento'],
    },
    viewer: {
      category: 'Three.js · WebGL · Producto',
      glanceCategory: 'Software 3D a medida',
      title: 'Custom 3D Viewer',
      description:
        'Un visor 3D a medida para navegador o escritorio con carga de modelos, arquitectura de interfaz, herramientas de cámara y navegación, iluminación, contexto de entorno, optimización, pruebas y despliegue.',
      imageAlt: 'Estudio de caso 3D Viewer',
      learnMoreLabel: 'Más sobre alcance y precio',
      tiers: [
        { label: 'Adaptación centrada', hours: '120–240 horas de producción', delivery: '3–6 semanas' },
        { label: 'Plataforma de producto nueva', hours: '320–640 horas de producción', delivery: '8–16 semanas' },
      ],
      includes: ['Interfaz de visor específica del proyecto', 'Flujo de importación y preparación de modelos', 'Controles de cámara y navegación', 'Selección de objetos e información', 'Configuración de iluminación y entorno', 'Optimización de rendimiento', 'Interfaz responsive', 'Despliegue y pruebas técnicas'],
      productAdditions: ['Varios formatos de modelo', 'Puntos de vista guardados', 'Mediciones', 'Anotaciones y hotspots', 'Planos de recorte', 'Controles de visibilidad', 'Almacenamiento de proyecto', 'Cuentas de usuario', 'Marca específica del cliente', 'Entrega de escritorio Electron', 'Integración de backend o base de datos'],
      explainer:
        'Un visor específico del proyecto basado en un framework IOM existente puede entregarse mucho más rápido que una plataforma de software nueva. El rango superior aplica cuando el visor requiere arquitectura de interfaz nueva, herramientas propias, manejo de datos, integraciones, entrega acelerada y pruebas a nivel de producto.',
    },
  },
  inquiry: {
    requestType: 'Tipo de solicitud',
    consultation: 'Consulta gratuita',
    estimate: 'Estimación de proyecto',
    name: 'Nombre',
    email: 'Correo electrónico',
    company: 'Empresa u organización',
    timeframe: 'Plazo de entrega deseado',
    budget: 'Presupuesto aproximado',
    message: 'Añade una breve descripción del proyecto.',
    optional: '(opcional)',
    timeframePh: 'p. ej. en 6 semanas, Q4, flexible',
    budgetPh: 'p. ej. 5.000–15.000 €',
    messagePh: 'Describe la idea principal, el público previsto, el material disponible y lo que la experiencia debe lograr.',
    sending: 'Enviando…',
    success: 'Mensaje enviado a projects@iobjectm.com — responderemos en dos días laborables.',
    error: 'No se pudo enviar el mensaje. Escribe directamente a projects@iobjectm.com.',
    required: 'Completa este campo.',
    invalidEmail: 'Introduce una dirección de correo válida.',
    messageShort: 'Añade una breve descripción del proyecto.',
    emailDirect: 'escribir directamente a projects@iobjectm.com',
  },
}
