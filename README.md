# Atelier 3D

Un taller web para preparar composiciones pictóricas figurativas: estudiar el encuadre, la perspectiva, la iluminación y el claroscuro sobre una escena neutra.

Versión **0.2.1**, con selección del destino de cada luz directamente en la escena. HTML, CSS y JavaScript modular con Three.js. Sitio estático, compatible con GitHub Pages, sin cuentas, backend, bases de datos, tokens de aplicación ni servicios pagos. Las dependencias quedan incluidas en el build; el navegador no carga bibliotecas desde un CDN.

## Uso

La escena ocupa la pantalla. La barra inferior abre **un panel por vez**; tocá nuevamente su botón, la cruz, la escena o Escape para cerrarlo. En teléfonos los paneles aparecen como una hoja inferior desplazable.

- **Navegar:** un dedo gira; dos dedos desplazan y acercan. Mouse: izquierdo gira, rueda acerca y derecho desplaza.
- **Objetos:** importar uno o varios OBJ / GLB; mostrar y ocultar cada pieza o un modelo completo; buscar por nombre; ajustar posición, rotación, escala y unidades. Los archivos se **agregan** a la escena. No se centran, reescalan ni reflejan automáticamente. El botón Encuadrar muestra el modelo cuando sus coordenadas están lejos de la sala.
- **Cámara:** perspectiva y ortogonal; frente, dorso, izquierda, derecha, superior e inferior; campo de visión, zoom, posición y objetivo. El candado bloquea navegación, óptica y comandos de vista. Desbloquear permite continuar. “Volver a la sala” recupera la cámara inicial y adapta la distancia al ancho de pantalla.
- **Luces:** tres focos blancos independientes. “Apuntar en la escena” oculta los paneles y permite tocar una pared, un peldaño o cualquier modelo visible para elegir el destino. Una cruz indica el punto; “Ver punto” lo muestra nuevamente. Funciona con la cámara bloqueada; Cancelar / Escape conserva el destino anterior. El ancho del haz se ajusta por separado con Concentrado / Medio / Amplio o ingresando metros. El ángulo numérico queda en opciones avanzadas (0,5°–85° de semiángulo). Mantiene intensidad, borde suave, posición del origen, sombras, ambiente y exposición.
- **Encuadre:** pantalla, 4:5, 5:4, 1:1, 3:2, 2:3 y 16:9; tercios opcionales; grises neutros, fondo y calidad. 4:5 equivale a un estudio vertical de 40 × 50 cm. Exporta PNG del encuadre a la resolución actual, sin interfaz ni guías.
- **Archivo:** nombre, guardado local, exportación e importación de una composición JSON que contiene parámetros **y los modelos importados**. Abrir JSON reemplaza la composición actual solamente cuando todos sus modelos se pudieron procesar.

### Guardado

Los cambios se guardan en `localStorage`, después de 650 ms sin modificaciones, al ocultar la pestaña y al salir. No se envían archivos a ningún servidor.

Si el navegador tiene espacio, se conservan parámetros y modelos. Si excede la cuota, se guardan los parámetros y referencias de los archivos, se informa en pantalla y hay que **exportar JSON antes de cerrar**. Al volver, reimportar el mismo archivo recupera su transformación y visibilidad mediante un identificador SHA-256. Si el almacenamiento está bloqueado se informa y queda disponible la exportación JSON. No se usa IndexedDB ni una base de datos.

Los datos pertenecen a ese navegador y al origen del sitio. No se sincronizan entre teléfonos. Borrar los datos del navegador también borra el guardado. Conservá copias JSON de los estudios importantes.

### Archivos admitidos

- **OBJ:** geometría con grupos/objetos nombrados. Se ignoran MTL y texturas; no hace falta adjuntarlos.
- **GLB:** binario glTF 2.0 autocontenido, sin compresión Draco / Meshopt / KTX2. Las superficies reciben el material neutro del taller; las cámaras y luces del archivo no reemplazan las del estudio. No se reproducen animaciones ni se editan poses. Evitá modelos con texturas grandes aunque luego no se utilicen: el cargador debe leerlas antes de descartarlas.
- Límite de **32 MB por modelo**, **96 MB por proyecto JSON** y **100 modelos por composición**. El rendimiento depende de polígonos, texturas originales y memoria del dispositivo; estas cifras son límites de entrada, no una garantía de fluidez.
- La unidad de trabajo es el metro. Los botones m / cm / mm establecen la conversión de escala. “Z arriba” rota −90° sobre X; no cambia la lateralidad.

## Apuntar las luces

1. Abrir **Luces** y desplegar la luz que quieras dirigir.
2. Pulsar **Apuntar en la escena**. Se despeja la escena y la cámara queda temporalmente inmóvil.
3. Dejar activado **Concentrar al apuntar** y tocar una superficie visible. El destino se actualiza, se muestra una cruz y vuelve el panel de esa misma luz. La apertura se reduce para distinguir la mancha; también se compensa la incidencia oblicua sobre la superficie. Desactivar Concentrar conserva el ancho existente. Tocar el fondo vacío no cambia nada; arrastrar o usar varios dedos tampoco elige un punto.
4. Usar **Concentrado / Medio / Amplio** o **Ancho a esa distancia (m)** para variar el tamaño del haz. La dirección no cambia al modificar su ancho.

**Ver solo esta luz** permite comparar su efecto sin las otras fuentes ni el ambiente. Es una vista temporal: no cambia qué luces quedaron encendidas en el proyecto. El botón superior **Solo luz … · Salir** vuelve a la iluminación completa. El PNG reproduce la vista actual; el JSON conserva los parámetros del proyecto, sin el modo de comparación.

**Luz desde esta vista** coloca el origen en la posición actual de la cámara, conserva el destino y mantiene aproximadamente el ancho a esa distancia. Sirve para dirigir una luz desde el frente de la composición. No mueve la cámara, incluso si está bloqueada. Si el recorrido hasta el destino está obstruido, se informa el objeto que lo bloquea.

Cambiar el destino orienta el cono, pero **la dirección de las sombras depende de dónde está la fuente**. Con un haz amplio, cambiar el destino puede dejar iluminada casi toda la misma pared. Concentrar, aislar la luz y mover su origen permiten distinguir esas tres cosas.

El ancho se mide en un plano perpendicular al haz, a la distancia del destino; una pared oblicua recibe una mancha más alargada. Elegir un punto no elimina obstáculos: las sombras siguen dependiendo de la geometría entre la fuente y ese lugar. La luz apagada conserva el destino elegido y sigue apagada hasta que la actives.

Para mayor precisión están **Ajuste preciso del punto** (XYZ en metros) y **Origen de la luz y ángulo preciso**. La cruz es una guía de interfaz: no aparece en el PNG. El destino y el ancho se conservan con el guardado local y los JSON existentes siguen siendo compatibles.

## Sala de referencia y orientación

Se incluye el archivo del proyecto `arquitectura_v04_orientacion_corregida.obj`, sin modificar sus vértices, como [`public/models/sala-v04.obj`](public/models/sala-v04.obj). Contiene **64 piezas** y una sala interior de **8,20 × 6,50 × 5,60 m**, además de ambientes contiguos a la derecha; las dimensiones exteriores totales son mayores.

Sistema de coordenadas diestro: **X hacia la derecha, Y arriba, +Z hacia el observador** en la vista frontal. La cámara inicial está delante, mirando hacia −Z; el primer peldaño está a la izquierda y el último a la derecha. Las transformaciones del taller usan escala uniforme positiva. Los tests comprueban tanto la geometría como la proyección de los peldaños para evitar inversiones especulares.

La luz principal apunta desde el ambiente superior derecho a través de la abertura alta. Las otras dos ingresan por la puerta ventana izquierda y las aberturas bajas derechas. El techo está presente y cada pieza puede ocultarse para inspeccionar el interior. Las sombras usan mapas PCF de 1024; calidad alta usa 2048.

## Ejecutar y verificar

Se necesita **Node.js 22** y npm para desarrollar o compilar. La aplicación publicada solo necesita un navegador actualizado con **WebGL 2** y aceleración gráfica: Chrome/Android es el objetivo principal.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

`dist/` es la aplicación estática lista para publicar. No abrir `index.html` directamente con `file://`: los módulos y la carga del OBJ necesitan HTTP. Vite es una herramienta de desarrollo y compilación, no un backend de la aplicación. `base: './'` hace que los recursos funcionen en `/Atelier-3D/` y otros subdirectorios.

Ver [arquitectura](docs/arquitectura.md) y [verificación y límites de esta entrega](docs/verificacion.md).

## Publicar con GitHub Pages

La publicación está **preparada**, no se configura automáticamente la administración del repositorio.

1. Integrar esta implementación en `main`.
2. En el repositorio, abrir **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Abrir **Actions → Publicar Atelier 3D en GitHub Pages → Run workflow** sobre `main`. Los siguientes cambios en `main` disparan la publicación automáticamente.
4. Esperar que `build` y `deploy` terminen correctamente. La dirección definitiva aparece en el entorno `github-pages` y en el resultado de `deploy-pages`.

Para este repositorio, la dirección esperada luego de publicar es `https://frankhode.github.io/Atelier-3D/`. No se considera publicada hasta que GitHub confirme el despliegue. No hay secretos que configurar. Las autorizaciones de `GITHUB_TOKEN` las emite GitHub para el workflow; no se solicitan tokens al usuario ni se incorporan a la aplicación.

El workflow de CI corre tests y build en cada pull request. El workflow de Pages vuelve a verificar antes de subir únicamente `dist/`.

## Referencias técnicas

- [Three.js · OrbitControls](https://threejs.org/docs/pages/OrbitControls.html)
- [Three.js · GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [GitHub Pages · workflows propios](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
