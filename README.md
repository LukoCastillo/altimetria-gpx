# Visor de Altimetría · Perfil GPX

Web app estática (sin build, sin dependencias) que genera un **perfil de altimetría y distancia** a partir de un archivo **GPX**. Dibuja la montaña con tonos terrosos, coloca los **waypoints** del recorrido como banderas y muestra estadísticas del track. Todo se procesa en el navegador: **no se sube ningún archivo a ningún servidor**.

## Características

- Importa GPX (botón o arrastrar y soltar). Lee tracks (`<trkpt>`), rutas (`<rtept>`) y waypoints (`<wpt>`).
- Calcula distancia (Haversine), desnivel positivo/negativo y altitud mín./máx.
- Coloca los waypoints por kilómetro (detectado del nombre `KMxx`) o por cercanía al track.
- Punto de color sobre la curva en cada waypoint; al pasar el cursor muestra km, altitud, tipo y nota.
- Añadir/editar/borrar puntos de interés desde la lista.
- Tema claro con montaña verde/café terroso.

## Estructura

```
altimetria-gpx/
├── index.html      # toda la app (HTML + CSS + JS en un archivo)
├── vercel.json     # configuración de despliegue (sitio estático)
├── .gitignore
└── README.md
```

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
