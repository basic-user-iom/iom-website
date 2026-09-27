Un proceso industrial se entiende mejor cuando se pueden seguir las transiciones entre máquinas. Robot Cell 01 presenta esa secuencia en una escena 3D que puedes explorar: las cajas llegan por un transportador, un robot forma una carga sobre el palé y una carretilla autónoma se encarga del intercambio.

[Abre Robot Cell 01](/demos/robot-cell/?lang=es)

## Sigue el ciclo completo

El transportador lleva cada caja al punto de recogida. La herramienta de ventosas se aproxima, recoge la caja y la traslada al palé. Las colocaciones sucesivas forman la carga. Después, el transporte conecta este trabajo con el resto de la nave: sale el palé lleno y llega uno vacío para el siguiente ciclo.

Lo importante es la coordinación. La herramienta solo puede transportar una caja después de recogerla, las horquillas necesitan espacio para entrar en el palé y la apertura de la puerta modifica el paso disponible. Ver estas transiciones juntas explica el proceso mejor que una colección de imágenes fijas.

La escena utiliza una posición de paletización activa, un robot y una carretilla autónoma. Así, el recorrido resulta claro y cada máquina tiene una función definida.

## Tres controles y una vista libre

**Iniciar** pone en marcha la secuencia. **Pausa** mantiene la postura actual mientras giras la vista o amplías un detalle. **Reiniciar** vuelve al principio y reproduce la animación de nuevo.

Arrastra para girar alrededor de la escena; usa la rueda del ratón o un gesto de pellizco para acercarte. La animación comienza en pausa, de modo que puedes elegir primero el punto de vista. Al terminar, el ciclo se repite.

La animación exportada se comprobó comparando las transformaciones de objetos y huesos al principio y al final. Las posturas coinciden. Esta prueba confirma la continuidad de las posiciones en la unión; no convierte la escena en una simulación física.

## De Blender al navegador

La escena se crea en Blender y se exporta como GLB, la forma binaria de glTF. Geometría, materiales y animación se reúnen en un solo archivo. El visor web utiliza Three.js para cargarlo y reproducir la secuencia coordinada.

La iluminación también debe conservarse. Esta versión exporta seis focos de techo y dos luces direccionales. El navegador añade iluminación de entorno para que los metales, las superficies pintadas y las piezas oscuras se distingan desde distintos ángulos.

Las piezas rígidas pequeñas se agrupan para el renderizado cuando lo permite su jerarquía de animación. Los conjuntos móviles conservan sus propias transformaciones. Esto reduce las llamadas de dibujo y mantiene un control común para todo el proceso.

## Hacer comprensible el movimiento industrial

Robot Cell 01 sirve para presentar y comentar un proceso: relaciones entre máquinas, secuencias de movimiento, accesos y distribución del espacio. Puedes detener un momento relevante y examinarlo desde varios lados.

Es una animación 3D ilustrativa, sin conexión en directo con maquinaria ni validación como modelo de ingeniería. La selección de equipos, los alcances, las cargas, las distancias y las protecciones de una instalación real requieren comprobaciones técnicas específicas.

[Explora la escena interactiva](/demos/robot-cell/?lang=es) o descubre más proyectos en [la sección 3D de IOM](/es/#3d).

## Referencias técnicas

- [Documentación de exportación glTF de Blender](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)
- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [Three.js AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html)
