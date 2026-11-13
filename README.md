# IMSS Maps · UMAA 90

Página web de orientación para pacientes y visitantes de la UMAA 90 (IMSS, Torreón). Muestra un buscador de servicios, el mapa de cada piso y los pasos con fotos para llegar a cada área.

**Autor y responsable del contenido:** Ing. Luis Ángel Díaz Bernal
**Versión:** ver `version.json`

## Qué es (para TI)

- **Solo archivos estáticos:** HTML, CSS, JavaScript, imágenes y una tipografía. No hay base de datos ni programas en el servidor.
- **No guarda ni pide datos de nadie:** sin registro, sin contraseñas, sin cámara y sin conexión a sistemas del IMSS.
- **No usa internet:** la tipografía y las fotos van incluidas. No hace llamadas a servicios externos.
- **Funciona sin red** después de la primera carga (PWA con service worker).
- **Solo muestra áreas para pacientes.** Las áreas restringidas no aparecen como destino.

## Cómo se instala

Copie la carpeta completa en cualquier servidor web (Apache, Nginx, IIS) o publíquela con GitHub Pages. No requiere instalación ni compilación.

Cada tótem abre su propia dirección:

| Tótem | Dirección |
|---|---|
| Planta baja | `…/index.html?kiosco=pb` |
| 1er piso | `…/index.html?kiosco=pa` |

Para pruebas: agregue `&demo=1` a la dirección. Aparecen botones para cambiar de piso y el panel **Estado** con avisos de datos y errores.

## Cómo se actualiza

1. Cambie los archivos necesarios. Las áreas, nombres y números de puerta están en `data/areas.json`.
2. Suba el número de versión **en dos lugares, el mismo número:** `version.json` y la línea `VERSION` de `sw.js`.
3. Reemplace los archivos en el servidor. No hace falta borrar nada ni vaciar caché.

Los tótems revisan cada 15 minutos si hay versión nueva y se actualizan solos cuando nadie los está usando.

## Comportamiento en el tótem

- Regresa a la pantalla de inicio tras 1 minuto sin uso.
- Pantalla de reposo con movimiento tras 3 minutos sin uso, para no marcar la pantalla.
- Se recarga sola si detecta errores repetidos o la pantalla vacía, y cada madrugada a las 3:00.

## Estructura

```
index.html          Página principal
css/estilos.css     Diseño
js/app.js           Lógica: buscador, mapas, rutas, reposo, vigilante
data/areas.json     Áreas, pisos, números de puerta y plano del 1er piso
fotos/              Fotos de referencia (sin personas)
fonts/              Tipografía Atkinson Hyperlegible (licencia SIL OFL, ver fonts/OFL.txt)
sw.js               Copia local para funcionar sin red
version.json        Número de versión
manifest.json       Datos de la app instalable
```
