import {
  LEGAL_CONTACT,
  LEGAL_LAST_UPDATED,
  type LegalLocalePack,
} from '../legalPages'

const disclosure =
  'IOM (Interactive Object Media) est une marque de studio indépendante. Les contrats pour le travail client sont émis par la partie contractante.'

export const frLegal: LegalLocalePack = {
  privacy: {
    slug: 'privacy',
    title: 'Politique de confidentialité',
    description:
      'Comment Interactive Object Media collecte, utilise et protège les informations lorsque vous utilisez iobjectm.com.',
    lastUpdated: LEGAL_LAST_UPDATED,
    disclosure,
    sections: [
      {
        id: 'who',
        heading: 'Qui nous sommes',
        paragraphs: [
          disclosure,
          `Ce site est exploité sous la marque de studio Interactive Object Media (IOM). Pour toute question de confidentialité, écrivez à ${LEGAL_CONTACT}.`,
        ],
      },
      {
        id: 'collect',
        heading: 'Informations que nous collectons',
        paragraphs: [
          'Nous ne collectons que ce dont nous avons besoin pour vous répondre et comprendre comment le site public est utilisé.',
        ],
        bullets: [
          'Formulaire de contact : nom, adresse e-mail et contenu du message que vous envoyez.',
          'Métadonnées techniques optionnelles du fournisseur de formulaire (par ex. heure approximative d’envoi).',
          'Analytics respectueux de la vie privée : chemin de page, référent, type d’appareil et un identifiant de session de courte durée dans sessionStorage — pas de cookie publicitaire persistant.',
          'Portail client (/client-login) : données de compte et de projet pour le personnel authentifié et les clients actifs uniquement ; cet espace est distinct du site marketing public.',
        ],
      },
      {
        id: 'use',
        heading: 'Comment nous utilisons les informations',
        paragraphs: [
          'Les messages de contact servent à répondre aux demandes et, le cas échéant, à préparer une proposition ou une discussion de projet.',
          'Les événements d’analytics nous aident à améliorer la navigation, le contenu et les performances. Ils ne sont pas vendus à des tiers à des fins publicitaires.',
        ],
      },
      {
        id: 'processors',
        heading: 'Prestataires',
        paragraphs: [
          'Les messages de contact publics sont transmis via Web3Forms (web3forms.com), qui traite les champs du formulaire afin que nous les recevions par e-mail.',
          'L’hébergement et la diffusion passent par Vercel. Les données CRM authentifiées (le cas échéant) sont stockées avec Supabase selon notre configuration de projet.',
          'Ces prestataires ne traitent les données que dans la mesure nécessaire à leurs services pour nous.',
        ],
      },
      {
        id: 'retention',
        heading: 'Conservation',
        paragraphs: [
          'Les e-mails de contact sont conservés aussi longtemps que nécessaire pour traiter votre demande et tenir un dossier de correspondance professionnel raisonnable.',
          'Les identifiants de session analytics vivent dans sessionStorage et sont effacés à la fin de la session du navigateur.',
          'Les enregistrements du portail client suivent les pratiques de conservation de la partie contractante pour ce projet.',
        ],
      },
      {
        id: 'rights',
        heading: 'Vos choix',
        paragraphs: [
          `Vous pouvez écrire à ${LEGAL_CONTACT} pour demander quelles informations de contact nous détenons à votre sujet via ce site, ou pour demander une correction ou une suppression des dossiers de demande lorsque cela est raisonnablement possible.`,
          'Vous pouvez effacer les données du site dans votre navigateur (y compris sessionStorage) à tout moment.',
        ],
      },
      {
        id: 'updates',
        heading: 'Mises à jour',
        paragraphs: [
          'Nous pouvons mettre à jour cette politique lorsque nos pratiques ou outils évoluent. La date « Dernière mise à jour » en haut de cette page changera alors.',
        ],
      },
    ],
  },
  terms: {
    slug: 'terms',
    title: 'Conditions d’utilisation',
    description:
      'Conditions d’utilisation du site Interactive Object Media et des outils publics associés.',
    lastUpdated: LEGAL_LAST_UPDATED,
    disclosure,
    sections: [
      {
        id: 'brand',
        heading: 'Marque de studio',
        paragraphs: [
          disclosure,
          'Les références à « IOM », « nous » ou « notre » sur ce site désignent la marque de studio Interactive Object Media, sauf accord signé contraire.',
        ],
      },
      {
        id: 'site',
        heading: 'Utilisation de ce site',
        paragraphs: [
          'Vous pouvez consulter le site public, les démos et les contenus publiés à des fins d’évaluation et d’information.',
          'N’utilisez pas le site de manière abusive (y compris tenter de perturber les services, scraper des zones privées ou accéder à /client-login sans autorisation).',
        ],
      },
      {
        id: 'projects',
        heading: 'Travail client',
        paragraphs: [
          'Le travail de projet payant, les livrables, les délais, les honoraires et la propriété intellectuelle sont régis par un accord écrit distinct avec la partie contractante — pas par ces seules conditions du site.',
          'Un portail client sécurisé peut être fourni pour les projets actifs ; l’accès est limité aux utilisateurs invités et reste confidentiel.',
        ],
      },
      {
        id: 'demos',
        heading: 'Démos et expériences',
        paragraphs: [
          'Les démos publiques, expériences et outils sandbox (y compris /crm-demo) sont fournis en l’état à titre d’illustration. Ils peuvent changer, tomber en panne ou être retirés sans préavis, et ne doivent pas être utilisés comme systèmes de production.',
        ],
      },
      {
        id: 'ip',
        heading: 'Contenus et marques',
        paragraphs: [
          'Les textes du site, le branding et les médias originaux restent la propriété de leurs titulaires de droits. Les actifs de projet client restent soumis au contrat concerné.',
          'Les bibliothèques tierces, polices et sources de démo conservent leurs propres licences.',
        ],
      },
      {
        id: 'liability',
        heading: 'Avertissement',
        paragraphs: [
          'Le site public et les démos sont fournis sans garantie de disponibilité ininterrompue ni d’adéquation à un usage particulier.',
          'Dans la mesure permise par la loi, IOM n’est pas responsable des pertes indirectes ou consécutives résultant de l’usage du site public seul. La responsabilité contractuelle de projet est définie dans l’accord signé avec la partie contractante.',
        ],
      },
      {
        id: 'contact',
        heading: 'Contact',
        paragraphs: [`Questions sur ces conditions : ${LEGAL_CONTACT}.`],
      },
    ],
  },
  cookies: {
    slug: 'cookies',
    title: 'Politique de cookies',
    description:
      'Comment Interactive Object Media utilise les cookies et le stockage similaire sur iobjectm.com.',
    lastUpdated: LEGAL_LAST_UPDATED,
    disclosure,
    sections: [
      {
        id: 'summary',
        heading: 'Résumé',
        paragraphs: [
          disclosure,
          'Ce site n’utilise pas de cookies publicitaires tiers. Nous utilisons un stockage local et de session limité pour les préférences et des analytics respectueux de la vie privée.',
        ],
      },
      {
        id: 'what',
        heading: 'Ce que nous stockons',
        paragraphs: ['Selon ce que vous utilisez, le navigateur peut conserver :'],
        bullets: [
          'Identifiant d’analytics de session (sessionStorage) — relie les pages vues d’une visite ; effacé à la fin de l’onglet/session.',
          'Préférence mute / audio — pour que le son d’ambiance reste coupé si vous l’avez désactivé.',
          'Préférence de langue le cas échéant — pour que le routage de locale reste cohérent.',
          'Cookies ou jetons de session du portail authentifié sur /client-login — uniquement après connexion ; nécessaires à l’espace de travail privé.',
        ],
      },
      {
        id: 'why',
        heading: 'Pourquoi',
        paragraphs: [
          'Les analytics nous aident à voir quelles pages publiques sont utiles. Les préférences évitent de réinitialiser l’interface à chaque visite. Les identifiants du portail sécurisent le travail client.',
        ],
      },
      {
        id: 'control',
        heading: 'Votre contrôle',
        paragraphs: [
          'Vous pouvez effacer les cookies et les données du site dans les paramètres du navigateur. Bloquer tout stockage peut empêcher la connexion au portail client et certaines démos.',
          `Pour toute question : ${LEGAL_CONTACT}.`,
        ],
      },
      {
        id: 'more',
        heading: 'Voir aussi',
        paragraphs: [
          'Consultez aussi notre Politique de confidentialité pour le traitement des données de contact et d’analytics.',
        ],
      },
    ],
  },
}
