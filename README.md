# Cumbre · Visor de Altimetría GPX

Web app estática (sin build, sin dependencias) que convierte el **GPX** de una carrera de trail en su **perfil de altimetría y distancia**, como punto de partida de una estrategia de nutrición e hidratación. Dibuja la montaña con tonos terrosos, coloca los **waypoints** del recorrido como banderas y muestra estadísticas del track. Todo se procesa en el navegador: **no se sube ningún archivo a ningún servidor**.

## Características

- Homepage con selector de carrera/distancia (catálogo Ultra Coahuila 2026) o carga de un GPX propio.
- Importa GPX (botón o arrastrar y soltar). Lee tracks (`<trkpt>`), rutas (`<rtept>`) y waypoints (`<wpt>`).
- Calcula distancia (Haversine), desnivel positivo/negativo y altitud mín./máx.
- Coloca los waypoints por kilómetro (detectado del nombre `KMxx`) o por cercanía al track.
- Punto de color sobre la curva en cada waypoint; al pasar el cursor muestra km, altitud, tipo y nota.
- Añadir/editar/borrar puntos de interés desde la lista.
- Tema claro con montaña verde/café terroso.

## Estructura

```
altimetria-gpx/
├── index.html          # Homepage: hero + selector de carrera/distancia + subir GPX
├── visor.html           # Visor: perfil de altimetría desde un GPX
├── assets/
│   ├── css/              # index.css, visor.css
│   └── js/                # index.js, visor.js
├── data/                 # Tracks GPX oficiales de Ultra Coahuila 2026 (30K, 50K, 80K, 100 Millas)
├── vercel.json          # Configuración de despliegue (sitio estático, cabeceras de seguridad)
├── .gitignore
└── README.md
```

Cada página HTML enlaza su propio CSS/JS (sin bundler, sin dependencias). El **CSP** en `vercel.json` exige que el JS viva en archivos `.js` (no scripts inline) — ver `CLAUDE.md` para detalles.

## Probar en local

Al ser HTML puro, basta con abrir `index.html` en el navegador. Si prefieres un servidor local:

```bash
# Python 3
python3 -m http.server 5173
# luego abre http://localhost:5173
```

## Desplegar en Vercel

No hay paso de build: Vercel lo sirve como sitio estático.

### Opción A — CLI

```bash
npm i -g vercel        # si aún no lo tienes
cd altimetria-gpx
vercel                 # despliegue de previsualización (te pedirá login la 1ª vez)
vercel --prod          # despliegue a producción
```

### Opción B — Git + panel de Vercel

1. Crea un repositorio y sube esta carpeta:
   ```bash
   cd altimetria-gpx
   git init
   git add .
   git commit -m "Visor de altimetría GPX"
   git branch -M main
   git remote add origin <URL-de-tu-repo>
   git push -u origin main
   ```
2. En [vercel.com](https://vercel.com) → **Add New… → Project** → importa el repo.
3. Framework Preset: **Other**. Build Command: *(vacío)*. Output Directory: *(raíz)*.
4. **Deploy**. Cada push a `main` volverá a desplegar automáticamente.
