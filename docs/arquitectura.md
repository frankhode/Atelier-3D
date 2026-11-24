# Arquitectura · Atelier 3D 0.1

## Responsabilidades

| Módulo | Responsabilidad |
| --- | --- |
| `src/core/defaults.js` | Escena inicial, límites y proporciones admitidas. |
| `src/core/project.js` | Contrato JSON v1, validación estricta y serialización portable o solo de parámetros. |
| `src/core/storage.js` | Guardado local con alternativa ante falta de cuota, recuperación y descargas. |
| `src/scene/renderer.js` | WebGL, espacio de encuadre, resolución y renderizado bajo demanda. |
| `src/scene/camera-rig.js` | Dos cámaras, navegación, vistas ortogonales, conservación de escala al cambiar de proyección, encuadre y bloqueo. |
| `src/scene/lighting.js` | Tres focos, sombras, ambiente y guías. |
| `src/scene/models.js` | Importación OBJ/GLB, material neutro, piezas, transformaciones, descarte de recursos y preparación transaccional de un proyecto. |
| `src/ui/interface.js` | Paneles, controles accesibles, búsqueda, estado y notificaciones; emite acciones sobre el dominio. |
| `src/ui/styles.css` | Interfaz sobre la escena, hoja inferior en móvil, espacios seguros y orientación horizontal. |
| `src/main.js` | Coordinación de módulos y ciclo de vida. |

## Estado de composición

`defaultProject()` crea un documento nuevo sin compartir referencias con otros documentos. El estado contiene `format`, `version`, título, cámara, encuadre, apariencia, tres luces y una lista de modelos.

Cada modelo tiene un identificador estable, origen (`builtin`, `obj`, `glb`), fuente, transformación positiva, visibilidad general y claves de piezas ocultas. Los OBJ se incluyen como texto; los GLB como base64. La sala incorporada se resuelve por su identificador versionado `sala-v04`, usando el recurso de la aplicación. UUID de Three.js no se serializan: las piezas usan el recorrido estable del árbol de importación. Dos modelos con el mismo contenido no se duplican al reimportarlos.

`validateProject()` reconstruye exclusivamente el contrato conocido. Rechaza versiones desconocidas, valores no finitos, cámaras degeneradas, escalas cero/negativas, IDs duplicados, proporciones desconocidas y parámetros fuera de rango. No ejecuta código ni aplica directamente propiedades arbitrarias del JSON sobre objetos Three.js. Los textos de archivos se escapan antes de insertarlos en la interfaz.

Abrir una composición analiza primero todos los modelos en una escena de preparación. Solo cuando termina correctamente sustituye la composición activa. Si falla, descarta los recursos preparados y conserva la escena actual. La importación múltiple de archivos sueltos es por archivo: un error conserva los que ya se importaron correctamente.

## Renderizado y dispositivo móvil

El renderer solicita un frame cuando cambia la escena, la cámara, el encuadre o el tamaño. No hay un bucle permanente de animación. OrbitControls no usa inercia, por lo que tampoco hay trabajo continuo en reposo. DPR limitado a 1,5 en calidad equilibrada y 2 en alta; sombras de 1024 / 2048 por foco. Los materiales neutros se comparten y las geometrías retiradas se liberan.

El encuadre es un área de render real con proporción fija, centrada en el viewport. Las franjas exteriores no cambian la composición. La cámara usa exactamente la proporción de esa área, también al exportar PNG. Los paneles se superponen; abrirlos no altera el encuadre ni mueve la cámara.

La pérdida del contexto WebGL se comunica y se intenta continuar cuando el navegador emite la restauración. Si no se puede crear WebGL 2, se muestra una pantalla de recuperación, sin representar una escena falsa.

## Ampliaciones previstas

- **Bibliotecas:** agregar un manifiesto estático de recursos versionados. Sus entradas pueden producir registros con el mismo contrato del importador, sin acoplar catálogos a los controles.
- **Figuras y mobiliario:** reutilizar grupos y transformaciones de modelos; agregar instanciación con IDs de instancia distintos si se necesitan copias del mismo recurso. Para poses, sumar un módulo de esqueletos/animación y una versión de esquema compatible.
- **Varias composiciones:** incorporar un índice de documentos y selección de documento activo sobre el adaptador de almacenamiento. Cada composición mantiene su propio estado; no es necesario cambiar renderer, cámaras ni luces.
- **Historial:** las acciones de coordinación son el punto para agregar undo/redo; el formato persistido no depende de los eventos DOM.
- **Nuevos formatos o compresión:** ampliar el importador con decodificadores distribuidos localmente. La versión actual no obtiene decodificadores ni archivos externos desde servicios.

## Límites deliberados

La iluminación usa focos y mapas de sombra; no es un trazador de rayos ni calcula iluminación global o rebotes. “Borde suave” controla la penumbra del cono, no la difusión física de una fuente de área. La luz ambiente es uniforme y no proyecta sombras. Las vistas ortogonales son puntos de partida que pueden girarse nuevamente al navegar. No hay edición de mallas, poses, animación, texturas ni sincronización entre dispositivos.
