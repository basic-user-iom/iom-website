**[Abrir Solar System — Living Observatory](/demos/solar-system/)**

¿Cómo se ve el Sistema Solar cuando las distancias siguen siendo lineales, los tamaños planetarios respetan la escala y el tiempo puede avanzar o retroceder? Living Observatory reúne efemérides, imágenes planetarias, lunas, sondas y experimentos educativos en un entorno 3D interactivo dentro del navegador. Para quien se interesa por la astronomía, su mayor utilidad está en conectar un objeto visible con su estado numérico y la procedencia de esos datos.

La portada muestra la Tierra en la demo. Las ocho imágenes del artículo son capturas reales de la aplicación, realizadas para esta guía; no son observaciones telescópicas. Los nombres de los controles corresponden a la interfaz inglesa de la demo.

## 1. Leer el Sistema Solar a través de los datos

En el observatorio normal, el movimiento procede de **efemérides de [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html) incluidas en la aplicación**. El navegador interpola posiciones y velocidades muestreadas mediante interpolación cúbica de Hermite. Lee una descripción del movimiento calculada previamente, en lugar de resolver un nuevo problema de N cuerpos cada vez que se pulsa Run.

El conjunto planetario principal cubre **2000–2100**. El reloj acepta UTC, convierte internamente a la escala TDB y permite pausa, marcha atrás y reproducción acelerada. Las posiciones son geométricas y se expresan en el marco eclíptico J2000 del proyecto. No es una carta celeste aparente y topocéntrica para apuntar un telescopio: el tiempo de viaje de la luz, el horizonte local y la refracción atmosférica no forman parte del modelo de coordenadas mostrado.

Seleccione un cuerpo para consultar radio, masa, período de rotación, distancia al Sol, velocidad heliocéntrica e irradiancia solar. Puede comparar la variación de velocidad a lo largo de una órbita o la disminución de la radiación solar con el cuadrado de la distancia, desde la Tierra hasta los planetas exteriores.

![La vista de la eclíptica relaciona las posiciones con trayectorias muestreadas de las efemérides. Una cobertura limitada produce un arco incompleto, no una elipse cerrada inventada.](/assets/blog/solar-system/orbits.webp)

## 2. Escala, órbitas y cámara

**True scale** es el modo inicial. Las distancias son lineales: una unidad de escena representa una unidad astronómica. Los radios físicos son, por tanto, muy pequeños. A escala de todo el sistema, etiquetas y marcadores ayudan a localizar objetos que pueden ocupar menos de un píxel. Esos símbolos no representan el diámetro físico del planeta.

**Presentation** agranda los cuerpos para facilitar su lectura, conservando sus posiciones orbitales. Compare ambos modos antes de juzgar separaciones a partir de una captura. Las líneas orbitales siguen las efemérides, no una colección de elipses ideales. Un siglo de datos no contiene la revolución completa de Neptuno, de unos 165 años: de ahí la importancia del aviso de cobertura. Las sondas y ciertos objetos del catálogo pueden tener otras ventanas temporales.

Elija un cuerpo en el navegador de objetos, arrastre para girar y utilice la rueda para acercarse o alejarse. Las cámaras incluyen vista cenital de la eclíptica, seguimiento de un cuerpo y seguimiento según su velocidad. Hay encuadres predefinidos para Tierra y Luna, la Gran Mancha Roja de Júpiter y los anillos de Saturno. La cámara cambia el punto de vista, no la escala de distancias.

## 3. Los mapas planetarios tienen su propia historia

La Tierra combina mapas de tierra y océano, nubes y luces nocturnas con dispersión atmosférica. Marte utiliza imágenes en color de Viking y detalles de normales derivados de MOLA. Júpiter y Saturno emplean imágenes fechadas, incluidos productos de Hubble OPAL. Los anillos de Saturno añaden estructura radial, divisiones y sombras mutuas entre planeta y anillos. Los mapas de normales sugieren relieve mediante la iluminación; no equivalen a terreno geométricamente resuelto en todas partes.

![El encuadre de los anillos de Saturno muestra las divisiones radiales y la relación entre planeta, plano de los anillos e iluminación. Es una representación del modelo, no una fotografía de Cassini.](/assets/blog/solar-system/saturn.webp)

**La fecha del reloj no convierte estos mapas en meteorología histórica.** Los compuestos de nubes, mosaicos de superficie y detalles de tormentas tienen sus propias fechas de adquisición. Urano y Neptuno usan cimas nubosas procedurales con [colores visibles moderados](https://www.ox.ac.uk/news/2024-01-05-new-images-reveal-what-neptune-and-uranus-really-look-0), no mapas meteorológicos globales medidos. Su aspecto sutil debe distinguirse de los fuertes contrastes de imágenes infrarrojas procesadas. El Sol también combina fotosfera y corona procedurales con detalles de imágenes fechadas; no es una transmisión solar en directo.

Abra **Data & provenance** para revisar atribuciones y límites de los modelos. Esta distinción es esencial al usar un bonito primer plano para explicar astronomía real.

## 4. Lunas, cometas y sondas

Los catálogos consultables van más allá de los ocho planetas: satélites naturales, satélites terrestres, cometas con nombre y sondas interplanetarias. Figurar en el catálogo, tener un cuerpo detallado representado y disponer de cobertura de efemérides son cosas distintas. Una entrada no significa que cada luna tenga un mapa superficial observado.

Voyager 1 y 2 usan un modelo detallado de la NASA que puede examinarse acercando o alejando la cámara. Sus trayectorias remiten a posiciones; la orientación de la antena es ilustrativa, no una reconstrucción de telemetría de actitud. Los satélites terrestres se propagan con elementos OMM incluidos y SGP4/SDP4 dentro de la ventana de validez declarada, no mediante seguimiento en directo.

![Voyager 1 en el observatorio: un modelo detallado, una posición en su trayectoria y una cámara que permite pasar del contexto de la misión a una inspección cercana.](/assets/blog/solar-system/voyager.webp)

Los cinco cometas son Halley, Encke, 67P, Hale–Bopp y NEOWISE. La cola iónica apunta en dirección opuesta al Sol; la cola de polvo se curva según un historial ilustrativo de emisión. Los efectos explican geometría, no un pronóstico medido de actividad cometaria. Del mismo modo, las partículas del cinturón de asteroides y de Kuiper son contexto estadístico, no pequeños cuerpos seguidos individualmente. El cielo de fondo aporta contexto visual, no un campo estelar astrométrico dependiente de la fecha.

## 5. Impact Lab: comparar causas y resultados

Impact Lab separa un evento del reloj del observatorio. Elija objetivo, diámetro, densidad, velocidad, ángulo de entrada, dirección y lugar del impacto; examine después entrada atmosférica, fragmentación o explosión en altura y efectos superficiales. La Tierra distingue tierra firme y océano, con modelos simplificados de cráter, penacho, cavidad en el agua y olas.

Un experimento útil cambia **un solo parámetro cada vez**. Con densidad constante, duplicar el diámetro de un impactor esférico multiplica su masa inicial por ocho. Duplicar su velocidad cuadruplica su energía cinética inicial: **E = ½mv²**. Las pérdidas atmosféricas y la fragmentación impiden equiparar la energía inicial con la que llega a la superficie.

![Un experimento de impacto oceánico en Impact Lab. El penacho y la respuesta del agua son aproximaciones educativas; la visibilidad reforzada de los efectos debe distinguirse de los valores físicos calculados.](/assets/blog/solar-system/impact.webp)

Compare las cifras con el ajuste de visibilidad: agrandar un efecto dibujado no aumenta el evento calculado. No es una evaluación de defensa planetaria, un modelo de víctimas ni una predicción de tsunami. Pausa, repetición y reinicio permiten discutir mecanismos y sensibilidad sin presentar estas simplificaciones como pronósticos.

## 6. Solar Fate: distinguir el futuro del Sol de la ficción

La secuencia científica comprime varias etapas: Sol actual, expansión en gigante roja, calentamiento del sistema interior, pérdida de capas externas y una enana blanca que se enfría. La navegación por fases y las opciones de cámara permiten comparar la estrella con el material circundante.

![La etapa de gigante roja en Solar Fate. La evolución se comprime en el tiempo; los planetas aportan contexto, no trayectorias futuras predichas.](/assets/blog/solar-system/solar-red-giant.webp)

Es una secuencia evolutiva ilustrada, no un cálculo de estructura estelar. Tiempos, cambios de tamaño y transiciones están simplificados; la demo no resuelve la supervivencia final de la Tierra ni calcula todas las órbitas futuras. La distinción astrofísica fundamental es que **el Sol no tiene masa suficiente para terminar como supernova de colapso del núcleo**.

![Capas externas expulsadas en la secuencia científica. La cámara amplia muestra la estructura nebular alrededor del núcleo estelar expuesto.](/assets/blog/solar-system/solar-nebula.webp)

La opción independiente **Fictional Solar Supernova** es explícitamente imposible para nuestro Sol. Es un experimento cinematográfico y debe seguir identificado como tal al compartir imágenes o utilizar la demo en una presentación.

## 7. Black-Hole Encounter: gravedad y captura cinematográfica

**Physics Flyby** copia los estados actuales del Sol, la Luna y los planetas en una simulación newtoniana de N cuerpos independiente. Posición inicial, velocidad y masa pueden producir resultados distintos; la captura no está garantizada. Los diagnósticos numéricos ayudan a examinar el experimento, pero no ofrecen una estimación de incertidumbre de nivel investigador.

![Controles y vista del encuentro en Physics Flyby. Las trayectorias utilizan un modelo docente newtoniano; lente gravitatoria, disco e indicios de disrupción son aproximaciones visuales.](/assets/blog/solar-system/black-hole.webp)

El modelo no es un cálculo de relatividad general ni de hidrodinámica. El efecto visual de lente no modifica el integrador de trayectorias. El modo independiente **Complete Consumption — Cinematic** añade deliberadamente amortiguamiento artificial para forzar la caída. Un agujero negro no aspira automáticamente planetas distantes: masa, distancia y estado orbital inicial siguen importando.

## 8. Una primera exploración útil

1. Empiece con Tierra y Luna en True scale y compare Presentation. Observe cómo el cambio de radios altera la impresión de espacio vacío.
2. Elija un planeta exterior, lea la cobertura temporal e invierta el reloj. Distinga un arco de datos incompleto de una anomalía orbital.
3. Encuadre Voyager, acérquese al modelo y vuelva a su trayectoria. Compruebe fuente y ventana temporal antes de interpretar la posición.
4. Compare los resultados numéricos de dos experimentos Impact Lab que difieran en una sola entrada.
5. Explore las etapas científicas de Solar Fate antes de abrir la alternativa ficticia.

Un navegador de escritorio ofrece más espacio para controles y gráficos. Reduzca la calidad visual si hace falta: detalle gráfico y datos de efemérides son aspectos separados. Los escenarios tienen relojes propios y el reinicio devuelve al observatorio. El uso más instructivo consiste en alternar entre la imagen, las cifras y los supuestos declarados.

## Fuentes y lecturas adicionales

- [Manual de JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html): marcos de referencia, escalas temporales y magnitudes geométricas o aparentes.
- [NASA: tipos de estrellas](https://science.nasa.gov/universe/stars/types/): contexto evolutivo de gigantes rojas, enanas blancas y supernovas.
- [Universidad de Oxford: los colores de Urano y Neptuno](https://www.ox.ac.uk/news/2024-01-05-new-images-reveal-what-neptune-and-uranus-really-look-0): por qué las imágenes procesadas habituales pueden distorsionar comparaciones de color.
- **Data & provenance** dentro de la demo: fuentes y limitaciones de esta implementación.

Capturas: IOM, realizadas en la demo publicada el 27 de septiembre de 2026. Las imágenes y modelos subyacentes conservan los créditos indicados en la demo. Esta guía describe esa versión; los datos incluidos y modelos visuales pueden cambiar en futuras publicaciones.

**[Explorar Living Observatory](/demos/solar-system/)**
