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
