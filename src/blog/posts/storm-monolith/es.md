Un estudio ambiental independiente de IOM reúne monolitos oscuros, mar y nubes en una escena que se puede explorar y ajustar en tiempo real.

## Reto — mantener la escena editable

Los monolitos se alzan sobre el agua en movimiento mientras los bancos de nubes cruzan las estructuras. El objetivo era conservar esa sensación de escala y permitir que el visitante cambiara la cámara, la iluminación y el tiempo. Se trata de un estudio visual independiente, no de un encargo de cliente.

## Solución — nubes con un alcance definido

Un radio en el espacio de la escena centra las nubes en la zona de los monolitos, con un borde suave. Las nubes cercanas usan un muestreo volumétrico más fino que se vuelve gradualmente más grueso a distancia. Esto modifica el detalle del ray marching; el ajuste de calidad controla la resolución del renderizado. Las nubes visibles y el cálculo de sus sombras comparten el mismo límite espacial.

## Solución — añadir detalles conservando los originales

Los monolitos mantienen sus mapas originales de color, normales y metalicidad/rugosidad. Una capa Dark Concrete compartida, con mapas de normales y rugosidad de 1K, añade detalles ajustables. El patrón de normales se repite al doble de frecuencia que antes: las formas son más pequeñas y mantienen su intensidad. Un interruptor de comparación recupera la superficie original.

![Primer plano de la superficie de un monolito y del detalle de su mapa de normales](/assets/blog/storm-monolith-studio/detail.webp)

## Resultado — un estudio independiente en el navegador

La aplicación independiente incluye cámaras orbital y libre, controles meteorológicos y exportación de la escena en JSON o como paquete portátil. Los modelos optimizados comparten recursos; las transformaciones estáticas y la planificación de sombras de nubes reducen cálculos repetidos. La fluidez sigue dependiendo del dispositivo, la vista y la calidad. Una imagen estática en la portada enlaza al estudio sin iniciar otro renderizador 3D en esa página.

## Prueba la escena

Empieza con la vista preparada y abre WEATHER → VOLUMETRIC CLOUDS para cambiar Cloud radius o Near detail distance. Selecciona Near left monolith y abre MATERIALS para comparar Dark Concrete detail. Cambia un ajuste cada vez: una cobertura mayor o más detalle puede exigir más trabajo a la GPU. Scene JSON guarda los ajustes; un paquete incluye también los recursos necesarios para la escena.

[Abrir el estudio](https://storm-monolith-studio.vercel.app/) · [Ver el caso de estudio](/es/case-studies/storm-monolith-studio)
