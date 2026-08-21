import type { LocalizedString } from '../i18n/locale'
import { img } from './media'
import type { SystemId } from './systems'

export type ProjectApplication =
  | 'walls'
  | 'ceilings'
  | 'acoustics'
  | 'partitions'
  | 'furniture'
  | 'lighting'

export type Project = {
  slug: string
  title: string
  location: string
  year?: string
  system: SystemId
  application: ProjectApplication
  material: LocalizedString
  architect?: string
  designer?: string
  photos?: string
  partner?: string
  intro: LocalizedString
  image: string
  featured: boolean
  span: 'full' | 'large' | 'medium' | 'tall'
}

export const PROJECTS: Project[] = [
  {
    slug: 'kosmos',
    title: 'Kosmos',
    location: 'Zürich',
    year: '2018',
    system: 'linar',
    application: 'furniture',
    material: {
      en: 'LINAR, See-Kiefer plywood',
      de: 'LINAR, Sperrholz See-Kiefer',
    },
    architect: 'Burkhard & Lüthi Architektur GmbH',
    partner: 'Creatop',
    intro: {
      en: 'The foyer bar of the new cultural centre Kosmos in Zürich was built with dukta – flexible wood thanks to its specific qualities. The flexibility allows a unique curved shaped counter and thanks to the partial transparency it can be illuminated from within. The absorption properties of the material leads to a comfortable acoustic level for guests and employees even on busy nights.',
      de: 'Dank seiner einzigartigen Eigenschaften wurde dukta – flexible wood für die Foyerbar des Kulturhauses Kosmos in Zürich ausgewählt. Die Flexibilität ermöglicht die wunderbar geschwungene Form, die Transparenz wird durch die Hinterleuchtung hervorgehoben und gibt dem Objekt seine Leichtigkeit. Die schallabsorbierende Wirkung führt zu einer angenehmen Akustik, sowohl für die Besucher wie auch für das Barpersonal.',
    },
    image: img.projects.kosmos,
    featured: true,
    span: 'large',
  },
  {
    slug: 'concert-hall',
    title: 'Concert Hall',
    location: 'Toni-Areal, Zürich',
    year: '2015',
    system: 'linar',
    application: 'acoustics',
    material: {
      en: 'LINAR, MDF coated',
      de: 'LINAR, MDF gespritzt',
    },
    architect: 'EM2N, Zürich — ZHdK Toni-Areal',
    intro: {
      en: 'The wall panelling of the large concert hall of the Zurich University of the Arts (ZHdK) was realised using dukta LINAR. The architects chose the dukta panels because they offer unique design possibilities and excellent properties in terms of sound absorption and diffusion.',
      de: 'Die Wandverkleidung des grossen Konzertsaals der Zürcher Hochschule der Künste (ZHdK) im Toni-Areal wurde mit dukta-LINAR umgesetzt. Die Architekten wählten die dukta-Paneele, weil diese einzigartige Gestaltungsmöglichkeiten und ausgezeichnete Eigenschaften bezüglich Schalldiffusion und -absorption bieten.',
    },
    image: img.projects.concertHall,
    featured: true,
    span: 'full',
  },
  {
    slug: 'planetarium',
    title: 'Planetarium',
    location: 'ESO Supernova',
    year: '2018',
    system: 'sonar',
    application: 'acoustics',
    material: {
      en: 'SONAR, MDF black, coated, flame retardant',
      de: 'SONAR, MDF schwarz, lackiert, schwer entflammbar',
    },
    architect: 'Bernhardt + Partner',
    partner: 'paraSilencio',
    intro: {
      en: 'In keeping with the spatial conditions in the planetarium, dukta SONAR was not only installed on the wall in an arched shape following the course of the wall, but was also mounted on the inner wall in a wave-like manner with the help of a specially made substructure. Due to the wave-like geometry of the acoustic wall cladding, the sound waves are optimally directed towards the openings and absorbed behind them.',
      de: 'Passend zu den Raumgegebenheiten im Planetarium wurde dukta SONAR nicht nur dem Wandverlauf folgend bogenförmig an die Wand gebracht, sondern an der Innenwand zusätzlich mit Hilfe einer speziell angefertigten Unterkonstruktion wellenartig montiert. Durch die wellenförmige Geometrie der Akustikwandverkleidung werden die Schallwellen optimal in Richtung der Öffnungen geleitet und dahinter absorbiert.',
    },
    image: img.projects.planetarium,
    featured: true,
    span: 'medium',
  },
  {
    slug: 'upf-bsm-barcelona',
    title: 'UPF-BSM Barcelona',
    location: 'Barcelona',
    year: '2022',
    system: 'janus',
    application: 'walls',
    material: {
      en: 'JANUS, MDF, varnished',
      de: 'JANUS, MDF lackiert',
    },
    designer: 'deardesign studio',
    photos: 'Aitor Estevez',
    partner: 'decustik',
    intro: {
      en: 'Barcelona-based studio deardesign has redesigned the entrance spaces of Pompeu Fabra University in Barcelona. The main idea behind the redesign was to get more out of the usable space and make it more inviting, dynamic, active, bright and comfortable. The wall cladding made of dukta – flexible wood contributed significantly to the new feeling within the space.',
      de: 'Das Studio deardesign aus Barcelona hat die Eingangsräumlichkeiten der Pompeu Fabra Universität in Barcelona neu gestaltet. Der Hauptgedanke bei der Neugestaltung war, mehr aus dem Nutzraum herauszuholen und ihn einladender, dynamischer, aktiver, heller und komfortabler zu gestalten. Massgeblich zum neuen Raumgefühl beigetragen hat die Wandverkleidung aus dukta – flexible wood.',
    },
    image: img.projects.barcelona,
    featured: true,
    span: 'medium',
  },
  {
    slug: 'givaudan',
    title: 'Givaudan',
    location: 'Zürich Innovation Center',
    year: '2022',
    system: 'linar',
    application: 'walls',
    // Material field lists LINAR; dukta.com body text says SONAR — confirm with dukta.
    material: {
      en: 'LINAR, oak, dark stained',
      de: 'LINAR, Eiche, dunkel gebeizt',
    },
    architect: 'Bauart',
    photos: 'Filipa Peixeiro | Georg Aerni',
    partner: 'Creatop',
    intro: {
      en: 'A total of 361 linear meters of the balustrade in the atrium of Givaudan’s Zürich Innovation Centre were clad continuously with dukta. In solid oak, stained dark, the balustrade frames the atrium, in which vertically planted columns ascend through the floor levels. The dark and textured wood provides a warm contrast to the otherwise light-colored and smooth surfaces.',
      de: 'Total 361 Laufmeter der Brüstungsverkleidung im Atrium des Zürich Innovation Zentrums von Givaudan wurden mit dukta verkleidet. In solider Eiche, dunkel gebeizt, umrahmt die Brüstung den mit vertikal bepflanzten Säulen bespielten Lichthof. Das dunkle, strukturierte Holz bildet einen warmen Kontrast zu den ansonsten hellen und glatten Oberflächen.',
    },
    image: img.projects.givaudan,
    featured: true,
    span: 'tall',
  },
  {
    slug: 'allemannenschule',
    title: 'Allemannenschule',
    location: 'Wutöschingen',
    year: '2022',
    system: 'linar',
    application: 'furniture',
    material: {
      en: 'LINAR, MDF colour/varnished',
      de: 'LINAR, MDF color/lackiert',
    },
    designer: 'raumreaktion',
    photos: 'Valentina Verdesca',
    partner: 'Creatop',
    intro: {
      en: 'The entire interior design for the new school building was created by the company Raumreaktion from Zürich. It supports the educational concept by stimulating the purpose of the different rooms and zones. The centre is a large co-working space in which the defining seating furniture, built with dukta – flexible wood, structures the room.',
      de: 'Die gesamte Innenarchitektur für das neue Schulgebäude wurde von der Firma Raumreaktion aus Zürich gestaltet. Sie unterstützt das pädagogische Konzept, indem sie das fördert, was in den verschiedenen Räumen und Zonen geschehen soll. Zentrum bildet ein grosser Co-Working-Space, in dem die mit dukta – flexible wood verkleideten Sitzmöbel den Raum strukturieren.',
    },
    image: img.projects.allemannenschule,
    featured: true,
    span: 'medium',
  },
  {
    slug: 'medical-practice',
    title: 'Medical Practice',
    location: 'Zürich',
    year: '2018',
    system: 'linar',
    application: 'lighting',
    material: {
      en: 'LINAR, multiplex with oak veneer',
      de: 'LINAR, Multiplex mit Eichenfurnier',
    },
    architect: 'ADP Architekten, Zürich',
    intro: {
      en: 'For the renovation of a medical practice in Zürich dukta – flexible wood was selected for several applications. The flexible wood base gives the reception counter an elegant lightness and the oval pendant lamp above provides a welcoming atmosphere. In the waiting area an arrangement of cylindrical ceiling lights provide a soft and warm light.',
      de: 'Für die Neugestaltung einer Arztpraxis in Zürich wurde dukta – flexible wood für mehrere Anwendungen ausgewählt. Der flexible Holzsockel lässt den Empfangstresen leichter wirken, und die ovale Pendelleuchte darüber sorgt für eine einladende Atmosphäre. Im Wartebereich erzeugen zylindrische Deckenleuchten ein weiches, warmes Licht.',
    },
    image: img.projects.practice,
    featured: true,
    span: 'medium',
  },
  {
    slug: 'euroshop',
    title: 'Euroshop',
    location: 'Düsseldorf',
    year: '2017',
    system: 'linar',
    application: 'walls',
    material: {
      en: 'LINAR, MDF colour',
      de: 'LINAR, MDF color',
    },
    designer: 'dukta GmbH, Zürich',
    intro: {
      en: 'The booth of partner Kolar at Euroshop 2017 in Düsseldorf received a lot of attention. The waved wall panels merged fluently into the reception desk and demonstrate the versatility of the material.',
      de: 'Der Messestand von Partner Kolar an der Euroshop 2017 in Düsseldorf hat viel Aufmerksamkeit auf sich gezogen. Die geschwungenen Wandpaneele gingen fliessend in die Theke über und zeigen eindrücklich die Vielseitigkeit des Materials.',
    },
    image: img.projects.euroshop,
    featured: false,
    span: 'medium',
  },
  {
    slug: 'boutique',
    title: 'Boutique',
    location: 'Cheb',
    year: '2017',
    system: 'foli',
    application: 'walls',
    material: {
      en: 'FOLI, MDF natur',
      de: 'FOLI, MDF natur',
    },
    designer: 'Marketa Cermanova, Interior Design',
    partner: 'Franz Kolar GmbH',
    intro: {
      en: 'dukta – flexible wood was applied generously in the new Boutique of «Energy Club» in Cheb (CZ). The incision type FOLI in MDF was chosen for the wall covering, waved furniture surface, partition screens and ceiling panels.',
      de: 'dukta – flexible wood kam in der neuen Boutique von «Energy Club» in Cheb (CZ) grossflächig zum Einsatz. Als Wandverkleidung, geschwungene Möbelfront, Trennwand und Deckenpaneele wurde der Schnitt-Typ FOLI in MDF eingesetzt.',
    },
    image: img.projects.boutique,
    featured: false,
    span: 'medium',
  },
  {
    slug: 'cinema',
    title: 'Cinema Mock-Up',
    location: 'Zürich',
    year: '2015',
    system: 'sonar',
    application: 'acoustics',
    material: {
      en: 'SONAR, MDF black',
      de: 'SONAR, MDF schwarz',
    },
    architect: 'EM2N, Zürich — ZHdK',
    intro: {
      en: 'The cinema at the University of the Arts in Zürich was designed by the architects at EM2N using dukta acoustic panels. Tests were carried out using 1:1 models for evaluation purposes. However, due to financial constraints, the building owner opted for a cheaper solution.',
      de: 'Der Kinosaal der Zürcher Hochschule der Künste wurde von den Architekten EM2N mit dukta-Akustikpaneelen konzipiert. Optik und Wirkung wurden anhand von 1:1-Modellen getestet und beurteilt. Aus finanziellen Gründen entschied sich der Bauherr jedoch für eine günstigere Lösung.',
    },
    image: img.projects.cinema,
    featured: false,
    span: 'medium',
  },
  {
    slug: 'wood-loop',
    title: 'Wood Loop',
    location: 'Winterthur / Andelsbuch',
    year: '2013',
    system: 'linar',
    application: 'furniture',
    material: {
      en: 'dukta process, exhibition pieces',
      de: 'dukta-Verfahren, Ausstellungsstücke',
    },
    intro: {
      en: 'The dukta process took a prominent place within the «Wood Loop» exhibition, which showcases everything from the world of wood shaping. This exhibition was founded by Serge Lunin, Roland Eberle, Mario Pellin and Martin Bereuter and was held in the Winterthur Museum of Commerce (2013) and the Bregenzerwald workshop (2014).',
      de: 'Innerhalb der Ausstellung «Wood Loop» zum Thema Holzbearbeitung nahm das dukta-Verfahren einen prominenten Platz ein. Die von Serge Lunin, Roland Eberle, Mario Pellin und Martin Bereuter konzipierte Ausstellung wurde im Gewerbemuseum Winterthur (2013) und im Werkraum Bregenzerwald (2014) gezeigt.',
    },
    image: img.projects.woodloop,
    featured: false,
    span: 'medium',
  },
  {
    slug: 'bernerhofsaal',
    title: 'Partitions Bernerhofsaal',
    location: 'Bern',
    year: '2015',
    system: 'janus',
    application: 'partitions',
    material: {
      en: 'JANUS, 3-layer maple',
      de: 'JANUS, Ahorn 3-Schicht',
    },
    designer: 'Greutmann Bolzern, Zürich',
    intro: {
      en: 'This prestigious hall was decorated with walnut floors and copper curtains. The bright maple partition walls truly came into their own. The individual elements are modular and can be placed alongside each other to create unique variations. The JANUS panels made of 3-layer maple are attached with milled solid wood frames that give the elements a firm and stable shape.',
      de: 'In diesem repräsentativen Saal mit Nussbaumboden und Kupfervorhängen kommen die hellen Ahorn-Raumtrenner besonders gut zur Geltung. Die einzelnen Elemente sind modular und lassen sich in Variationen aneinanderreihen. Die JANUS-Platten aus Ahorn-Dreischicht sind mit gefrästen Massivholzrahmen gefasst, die den Elementen Festigkeit und Stabilität geben.',
    },
    image: img.projects.maple,
    featured: true,
    span: 'tall',
  },
]
