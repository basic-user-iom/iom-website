import {
  LEGAL_CONTACT,
  LEGAL_LAST_UPDATED,
  type LegalLocalePack,
} from '../legalPages'

const disclosure =
  'IOM (Interactive Object Media) es una marca de estudio independiente. Los contratos para el trabajo con clientes los emite la parte contratante.'

export const esLegal: LegalLocalePack = {
  privacy: {
    slug: 'privacy',
    title: 'Política de privacidad',
    description:
      'Cómo Interactive Object Media recopila, usa y protege la información cuando usas iobjectm.com.',
    lastUpdated: LEGAL_LAST_UPDATED,
    disclosure,
    sections: [
      {
        id: 'who',
        heading: 'Quiénes somos',
        paragraphs: [
          disclosure,
          `Este sitio se opera bajo la marca de estudio Interactive Object Media (IOM). Para preguntas de privacidad, escribe a ${LEGAL_CONTACT}.`,
        ],
      },
      {
        id: 'collect',
        heading: 'Información que recopilamos',
        paragraphs: [
          'Recopilamos solo lo necesario para responderte y entender cómo se usa el sitio público.',
        ],
        bullets: [
          'Formulario de contacto: nombre, correo electrónico y contenido del mensaje que envías.',
          'Metadatos técnicos opcionales del proveedor del formulario (p. ej. hora aproximada de envío).',
          'Analytics respetuosas con la privacidad: ruta de página, referrer, clase de dispositivo y un id de sesión de corta duración en sessionStorage — no una cookie publicitaria persistente.',
          'Portal de cliente (/client-login): datos de cuenta y proyecto solo para personal autenticado y clientes activos; ese espacio está separado del sitio de marketing público.',
        ],
      },
      {
        id: 'use',
        heading: 'Cómo usamos la información',
        paragraphs: [
          'Los mensajes de contacto se usan para responder consultas y, cuando corresponda, preparar una propuesta o conversación de proyecto.',
          'Los eventos de analytics nos ayudan a mejorar la navegación, el contenido y el rendimiento. No se venden a terceros con fines publicitarios.',
        ],
      },
      {
        id: 'processors',
        heading: 'Proveedores de servicios',
        paragraphs: [
          'Los mensajes de contacto públicos se entregan a través de Web3Forms (web3forms.com), que procesa los campos del formulario para que los recibamos por correo.',
          'El hosting y la entrega corren en Vercel. Los datos CRM autenticados (si se usan) se almacenan con Supabase en nuestra configuración de proyecto.',
          'Esos proveedores procesan datos solo en la medida necesaria para prestar sus servicios para nosotros.',
        ],
      },
      {
        id: 'retention',
        heading: 'Conservación',
        paragraphs: [
          'Los correos de contacto se conservan el tiempo necesario para atender tu solicitud y mantener un registro comercial razonable de la correspondencia.',
          'Los identificadores de sesión de analytics viven en sessionStorage y se borran al terminar la sesión del navegador.',
          'Los registros del portal de cliente siguen las prácticas de conservación de la parte contratante para ese proyecto.',
        ],
      },
      {
        id: 'rights',
        heading: 'Tus opciones',
        paragraphs: [
          `Puedes escribir a ${LEGAL_CONTACT} para preguntar qué datos de contacto tenemos sobre ti desde este sitio, o para solicitar corrección o eliminación de expedientes de consulta cuando sea razonablemente posible.`,
          'Puedes borrar los datos del sitio en tu navegador (incluido sessionStorage) en cualquier momento.',
        ],
      },
      {
        id: 'updates',
        heading: 'Actualizaciones',
        paragraphs: [
          'Podemos actualizar esta política cuando cambien nuestras prácticas o herramientas. La fecha «Última actualización» al inicio de esta página cambiará entonces.',
        ],
      },
    ],
  },
  terms: {
    slug: 'terms',
    title: 'Términos de servicio',
    description:
      'Términos para usar el sitio de Interactive Object Media y las herramientas públicas relacionadas.',
    lastUpdated: LEGAL_LAST_UPDATED,
    disclosure,
    sections: [
      {
        id: 'brand',
        heading: 'Marca de estudio',
        paragraphs: [
          disclosure,
          'Las referencias a «IOM», «nosotros» o «nos» en este sitio significan la marca de estudio Interactive Object Media, salvo que un acuerdo firmado diga lo contrario.',
        ],
      },
      {
        id: 'site',
        heading: 'Uso de este sitio',
        paragraphs: [
          'Puedes consultar el sitio público, demos y materiales publicados para evaluación e información.',
          'No uses el sitio de forma indebida (incluidos intentos de interrumpir servicios, hacer scraping de áreas privadas o acceder a /client-login sin autorización).',
        ],
      },
      {
        id: 'projects',
        heading: 'Trabajo con clientes',
        paragraphs: [
          'El trabajo de proyecto de pago, entregables, plazos, honorarios y propiedad intelectual se rigen por un acuerdo escrito aparte con la parte contratante — no solo por estos términos del sitio.',
          'Puede proporcionarse un portal de cliente seguro para proyectos activos; el acceso se limita a usuarios invitados y permanece confidencial.',
        ],
      },
      {
        id: 'demos',
        heading: 'Demos y experimentos',
        paragraphs: [
          'Las demos públicas, experimentos y herramientas sandbox (incluido /crm-demo) se ofrecen tal cual con fines ilustrativos. Pueden cambiar, fallar o eliminarse sin aviso, y no deben usarse como sistemas de producción.',
        ],
      },
      {
        id: 'ip',
        heading: 'Contenido y marcas',
        paragraphs: [
          'El texto del sitio, el branding y los medios originales siguen perteneciendo a sus respectivos titulares. Los activos de proyecto de cliente siguen sujetos al contrato correspondiente.',
          'Las bibliotecas de terceros, tipografías y fuentes de demos conservan sus propias licencias.',
        ],
      },
      {
        id: 'liability',
        heading: 'Descargo de responsabilidad',
        paragraphs: [
          'El sitio público y las demos se ofrecen sin garantías de disponibilidad ininterrumpida ni de idoneidad para un fin concreto.',
          'En la medida permitida por la ley, IOM no responde de pérdidas indirectas o consecuentes derivadas solo del uso del sitio público. La responsabilidad contractual del proyecto se define en el acuerdo firmado con la parte contratante.',
        ],
      },
      {
        id: 'contact',
        heading: 'Contacto',
        paragraphs: [`Preguntas sobre estos términos: ${LEGAL_CONTACT}.`],
      },
    ],
  },
  cookies: {
    slug: 'cookies',
    title: 'Política de cookies',
    description:
      'Cómo Interactive Object Media usa cookies y almacenamiento similar en iobjectm.com.',
    lastUpdated: LEGAL_LAST_UPDATED,
    disclosure,
    sections: [
      {
        id: 'summary',
        heading: 'Resumen',
        paragraphs: [
          disclosure,
          'Este sitio no usa cookies publicitarias de terceros. Usamos almacenamiento local y de sesión limitado para preferencias y analytics respetuosas con la privacidad.',
        ],
      },
      {
        id: 'what',
        heading: 'Qué almacenamos',
        paragraphs: ['Según lo que uses, el navegador puede guardar:'],
        bullets: [
          'Id de analytics de sesión (sessionStorage) — vincula pageviews en una visita; se borra al cerrar pestaña/sesión.',
          'Preferencia de silencio / audio — para que el sonido ambiental siga apagado si lo silenciaste.',
          'Preferencia de idioma cuando aplique — para que el enrutado de locale sea coherente.',
          'Cookies o tokens de sesión del portal autenticado en /client-login — solo al iniciar sesión; necesarios para el espacio de trabajo privado.',
        ],
      },
      {
        id: 'why',
        heading: 'Por qué',
        paragraphs: [
          'Las analytics muestran qué páginas públicas son útiles. Las preferencias evitan reiniciar la interfaz en cada visita. Las credenciales del portal protegen el trabajo del cliente.',
        ],
      },
      {
        id: 'control',
        heading: 'Tu control',
        paragraphs: [
          'Puedes borrar cookies y datos del sitio en la configuración del navegador. Bloquear todo el almacenamiento puede romper el inicio de sesión del portal de cliente y algunas demos.',
          `Para preguntas: ${LEGAL_CONTACT}.`,
        ],
      },
      {
        id: 'more',
        heading: 'Relacionado',
        paragraphs: [
          'Consulta también nuestra Política de privacidad sobre cómo se tratan los datos de contacto y analytics.',
        ],
      },
    ],
  },
}
