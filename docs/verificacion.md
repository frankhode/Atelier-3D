# Verificación de la primera versión

Fecha: 24 de noviembre de 2026.

## Evidencia automatizada

Ejecutar `npm test` y `npm run build`.

Las pruebas del dominio procesan el **OBJ original** y un **GLB binario válido** utilizando los cargadores reales de Three.js. Cubren:

- 64 piezas con nombre, altura y dimensiones de referencia.
- Primer y último peldaño ordenados en +X/+Y y proyectados a izquierda/derecha correctamente desde la cámara frontal; determinante positivo.
- Material neutro compartido, ocultamiento por pieza, rotación Z→Y y escala positiva.
- GLB base64 reversible, importación binaria real y rechazo de geometría vacía.
- Preparación de proyectos que mantiene la escena activa ante un error.
- Ida y vuelta JSON de cámara, bloqueo, encuadre, luces, modelos y piezas ocultas.
- Rechazo de estado inválido, campos desconocidos, escalas negativas, valores no finitos y cámaras degeneradas.
- Ajuste del encuadre en pantallas verticales y horizontales.
- Guardado local completo, alternativa de solo parámetros por cuota insuficiente y almacenamiento bloqueado/corrupto.

Las pruebas de interfaz utilizan un DOM de prueba y los módulos reales de interfaz/cámara/modelos. Comprueban apertura y cierre de paneles, cambio de nombre sin perder el foco, bloqueo, vistas, controles y visibilidad. No sustituyen una prueba gráfica WebGL.

## Límite de la verificación visual

La aplicación se sirvió y abrió en el navegador de pruebas. Ese navegador informa `GL_VENDOR = Disabled`, `GL_RENDERER = Disabled` y `Error creating WebGL context`. El error persiste tras recargar. Por ello **no se pudo verificar visualmente el render, la calidad de las sombras ni los gestos táctiles reales** en ese entorno. La aplicación muestra correctamente su pantalla de error y recuperación. No se cambió la configuración de seguridad del navegador.

La compilación y las pruebas de datos, cargadores, orientación y controles son independientes de esa limitación. La inspección visual y el rendimiento Android quedan pendientes en un dispositivo con WebGL 2.

## Prueba de aceptación en Android / escritorio

1. Abrir la aplicación publicada en Chrome/Android y en un navegador de escritorio actualizado. Comprobar que no aparece la pantalla de error WebGL.
2. Confirmar la escalera de izquierda a derecha y la iluminación desde la abertura superior derecha. Cambiar a vista Frente para revisar lateralidad. Inspeccionar sombras de los barrotes y peldaños.
3. Girar con un dedo; acercar y desplazar con dos. Repetir con mouse. Bloquear cámara y comprobar que los gestos, las vistas y el campo de visión quedan bloqueados; desbloquear.
4. Abrir cada panel; cerrar con su botón, la cruz y tocando fuera. Verificar vertical/horizontal y que los paneles no cambien la proyección ni la proporción.
5. Ocultar y mostrar un peldaño y un muro; buscar por nombre; ocultar y restaurar todas las piezas de un modelo.
6. Apagar cada luz por separado, cambiar su intensidad y observar el efecto. Desactivar sus sombras. Ajustar ambiente y exposición.
7. Elegir 4:5 y activar tercios. Exportar PNG y comprobar proporción y ausencia de controles.
8. Importar un OBJ y un GLB. Ajustar m/cm/mm y Y/Z arriba cuando corresponda. Encuadrarlos y quitarlos.
9. Exportar JSON, cambiar la escena y abrir el JSON: recuperar cámara, bloqueo, luces, encuadre, objetos y visibilidad.
10. Recargar y comprobar el guardado local. Con almacenamiento insuficiente, comprobar la advertencia y reimportar el mismo modelo para recuperar sus parámetros.

## Publicación

Los workflows verifican tests/build y preparan `dist/` para Pages. La configuración administrativa de Pages y el despliegue efectivo no forman parte de la comprobación gráfica local: confirmar el estado del workflow y la URL devuelta por GitHub antes de considerar el sitio publicado.

## Actualización 0.2: apuntar luces con un toque

Se agregan pruebas de selección real por rayos con cámaras perspectiva y ortogonal; coordenadas del canvas desplazado; exclusión de mallas, ancestros y modelos ocultos; intersección más cercana; marcador dentro/fuera del encuadre; tap, fondo vacío, arrastre, multitoque, pointercancel y Escape; preservación del bloqueo de cámara; rechazo de un destino no aplicable; equivalencia entre diámetro y ángulo; persistencia JSON de los nuevos ajustes; botón de selección y presets para cada luz; retorno al panel de la luz seleccionada. Se mantiene la limitación de WebGL del navegador de QA indicada arriba.

Prueba en el dispositivo: abrir Luces, seleccionar la segunda luz, pulsar Apuntar en la escena y tocar la pared. Confirmar cambio de iluminación y retorno a la segunda luz. Repetir con cámara bloqueada, cancelar sin elegir y tocar fondo vacío. Elegir Concentrado / Medio / Amplio y un ancho en metros; comprobar que solo cambia la apertura y el destino permanece fijo. Exportar y reabrir JSON.

## Regresión 0.2.1: aparente dirección fija hacia la pared del fondo

El OBJ real reproduce que distintos puntos de la pared ya están dentro del cono inicial ancho. La orientación del foco cambia correctamente, pero se ilumina una región similar; además las sombras conservan las direcciones geométricas propias del origen fijo. A incidencia rasante, el preset de 8° todavía puede abarcar gran parte de la pared.

Se prueba el recorrido completo de geometría y parámetros con varios puntos reales de `Muro_fondo`, normales mundiales, el módulo `WebGLLights` de Three.js usado por el renderer y las matrices reales de las cámaras de sombra. Las pruebas comprueban que el destino llega a los uniforms correctos, que la concentración excluye otros puntos separados de la misma pared y que el origen no cambia al apuntar. Esta prueba no requiere contexto gráfico y no equivale a inspeccionar píxeles renderizados.

También se verifica Solo temporal sin mutaciones en el JSON, restauración del ambiente y de fuentes desactivadas, colocación del origen desde la cámara, conservación del ancho, detección de obstáculos reales, exclusión de obstáculos ocultos y opción visible para conservar el ancho al apuntar.

Aceptación en Android: elegir la luz principal, activar Ver solo esta luz, mantener Concentrar al apuntar y tocar dos zonas distintas de la pared. Comprobar desplazamiento de la mancha. Pulsar Luz desde esta vista para cambiar la incidencia y la dirección de las sombras. Salir de Solo con el botón superior. No borrar datos del navegador para actualizar: basta recargar la página.

## Actualización 0.3: origen explícito

Se agregan pruebas de origen independiente de destino/ángulo/cámara, persistencia JSON de posición, rechazo atómico de un origen coincidente con destino, presets en coordenadas transformadas, huellas de los pisos del OBJ, mapeo de taps con bandas SVG horizontales/verticales, coordenadas visibles antes del destino, foco conservado al editar altura, colocación por un tap y descarte de arrastre, movimiento por teclado, salida visual de origen fuera de encuadre y guías DOM/SVG que se ocultan completamente. Se mantiene la limitación de inspección WebGL del entorno de QA.

Aceptación: abrir Luces y seleccionar Frente de la sala como origen; verificar X=4,10, Y=3,20 y Z=6,20 en la sala sin transformaciones. Tocar otro punto del plano: cambian X/Z y se conserva Y y el destino. Cambiar Y para subir la fuente. Elegir luego un destino en la pared del fondo. Confirmar que las sombras corresponden al origen elegido. Repetir con cámara bloqueada y reabrir JSON.
