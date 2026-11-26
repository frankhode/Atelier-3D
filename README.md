# Atelier 3D

Un taller web para preparar composiciones pictóricas figurativas: estudiar el encuadre, la perspectiva, la iluminación y el claroscuro sobre una escena neutra.

Versión **0.4**, con una primera prueba de claroscuro pictórico además de los focos. HTML, CSS y JavaScript modular con Three.js. Sitio estático, compatible con GitHub Pages, sin cuentas, backend, bases de datos, tokens de aplicación ni servicios pagos. Las dependencias quedan incluidas en el build; el navegador no carga bibliotecas desde un CDN.

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

## Ubicar el origen antes de apuntar

Cada luz tiene dos puntos independientes:

- **Origen · desde dónde sale:** coordenadas X (lateral), Y (altura) y Z (profundidad), visibles al principio de su panel.
- **Destino · hacia dónde apunta:** el punto elegido sobre una superficie de la escena.

El **plano visto desde arriba** muestra el origen en dorado, el destino como una cruz y la dirección entre ambos. Tocar el plano mueve X y Z del origen; la altura Y se mantiene y se cambia en su campo. Arrastrar para desplazar el panel no coloca la luz por accidente. También se puede enfocar el plano con Tab y moverlo con las teclas de dirección (0,25 m; Shift = 1 m).

**Ubicación rápida** ofrece Frente de la sala, Abertura superior derecha, Puerta ventana izquierda y Aberturas inferiores derechas. Los presets respetan el desplazamiento, rotación y escala de la sala de referencia. Cambian el origen, conservando destino y ángulo. Los nombres Principal / Relleno / Residual identifican las luces; no afirman que sigan en su abertura original después de moverlas.

Con el panel de Luces abierto se muestran en la escena el marcador del origen, el del destino y una línea de dirección. **Ver origen y destino** despeja el panel y los muestra unos segundos. Si el origen está fuera del encuadre, o coincide con la cámara, se informa en vez de dibujar un marcador en una posición falsa. Son guías de interfaz y no aparecen en el PNG. No representan luz atravesando obstáculos.

El movimiento desde el plano y los campos funciona con la cámara bloqueada. La posición se guarda en los mismos parámetros y JSON anteriores; las composiciones existentes no se reinician.

## Apuntar las luces

1. Abrir **Luces**, desplegar la luz y determinar primero su **Origen**. Para una luz frontal de prueba, elegir **Ubicación rápida → Frente de la sala**.
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

## Prueba pictórica 0.4

Abrir [el estudio de claroscuro](https://frankhode.github.io/Atelier-3D/?pictorico=1). Este enlace usa un guardado distinto (`atelier3d:pictorial-study:v1`) y una sala de prueba frontal: conserva la composición física del navegador. También está disponible en **Luces → Pictórico** dentro de cualquier composición.

La mancha es un volumen elipsoidal suave en coordenadas de la escena; se puede centrar tocando superficies y ajustar ancho, alto, profundidad, inclinación y borde. No depende de posiciones de focos, distancia inversa al cuadrado ni mapas de sombra. Por defecto participan fondo y escalera; la pared izquierda y el piso conservan valores separados. Los controles “Recibe mancha” permiten decidir qué zonas participan. Los barrotes mantienen un valor oscuro para conservar la lectura de la escalera.

“Valor general de las sombras” desplaza los valores base; “Modelado del volumen” añade una modulación suave por orientación que puede llevarse a cero para trabajar con valores planos. La iluminación pictórica ignora exposición y color del material físico; sus valores son perceptuales y no se recortan con el tone mapping de los focos. Fondo y calidad continúan disponibles en Encuadre. Los parámetros y el modo se guardan y exportan en JSON. Los documentos antiguos se abren en modo Focos.

Esta primera prueba ofrece una mancha y valores por grupos de superficies. No incluye pincel libre, varias capas, sombras pintadas ni edición individual de figuras. Es una herramienta de composición tonal, no una simulación de luz rebotada.

### Verificación gráfica

El workflow de CI instala Playwright únicamente para pruebas, compila la aplicación y ejecuta Chromium con render WebGL por software en el runner. Lee los píxeles de la escena después de renderizar: verifica la jerarquía fondo / izquierda / piso, cambia el valor de la izquierda y comprueba que los otros planos se conservan. Los shaders deben compilar sin errores. Se guardan capturas de escritorio y móvil como artefactos de QA por siete días. Esta verificación reemplaza la limitación anterior de comprobar solamente los parámetros del render. No equivale a una prueba de rendimiento en Android.

Para repetirla tras `npm ci` y `npm run build`:

```sh
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install --with-deps chromium
npm run test:render
```


## Prueba de paredes luminosas

Abrir [el estudio de superficies](https://frankhode.github.io/Atelier-3D/?superficies=1), con guardado separado de la composición habitual y del estudio pictórico. En cualquier proyecto también se puede elegir **Luces → Superficies**; al cambiar de modo no se pierden las configuraciones de los otros dos.

Tres intensidades independientes (0–200%, 0% = apagado):
- **Planta alta**: dos paredes del ambiente superior, cerca de la abertura de la escalera.
- **Exterior izquierdo**: detrás de la puerta ventana.
- **Exterior frontal**: fuera del encuadre, hacia las figuras.

Las posiciones están fijadas a la sala de referencia; no hay que ajustar origen, dirección o apertura. Ocho emisores discretos con sombras, repartidos por las superficies, aproximan una fuente extensa sin renderizar un panel visible. La geometría sigue interceptando la luz. No es iluminación global ni una integración continua de toda la superficie: pueden resultar transiciones de sombra escalonadas. Focos y ambiente se desactivan temporalmente en este modo. Sus valores permanecen guardados y el JSON conserva también las intensidades del nuevo modo.
