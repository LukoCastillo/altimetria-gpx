# Cumbre → Rebranding + Roadmap Ultra-Trail

Documento de planeación de producto. Consolida: (1) propuesta de branding, (2) 5
features nuevas para ultra-trail propuestas para Cumbre, y (3) análisis del backlog
público de ultraPacer (competidor directo) para validar dolores reales del usuario.

Fecha: 2026-07-29 · Rol: PM + brand strategy.

---

## 1. Branding

### Candidatos

| # | Nombre | Qué evoca | Riesgo principal |
|---|--------|-----------|-------------------|
| **1** | **Cumbral** (cumbre + umbral) | El compromiso de cruzar la salida con un plan; conserva el equity de "Cumbre" | Hay que explicar el juego de palabras una vez |
| 2 | **Filo** | La arista de la montaña y el borde: cortes, margen, riesgo; el perfil de altimetría *es* un filo | App homónima en otro sector; `filo.run` disponible |
| 3 | **Vereda** | El sendero mexicano real; autenticidad terrosa y local | Genérica; `.com` imposible (usar `vereda.run`) |
| 4 | **Monterra** (monte + terra) | Bilingüe transparente, escalable fuera de México | Muchos homónimos comerciales; menos "ultra" |
| 5 | **Rumbo** | Dirección con intención — nombra la estrategia | Colisión directa con Rumbo (agencia de viajes) |

**Recomendación: Cumbral.** Conserva el capital de marca actual (logo de cresta, tono
"entiende tu montaña"), añade el significado del pivote a ultra, y tiene la mejor
probabilidad de dominio limpio (`cumbral.com` / `.mx` / `.run`).

Tagline: *"Cruza el umbral. La cumbre ya tiene plan."*
Alternativa si se quiere romper del todo con el pasado: **Filo**.

### Identidad visual

Mantener la base terrosa verde/café (`--area-top`, `--area-mid`, `--area-bot`,
`--ridge`), pero ascender el ámbar existente (`#ffdca0`) de detalle decorativo a
**color de estrategia**: todo lo que sea decisión del corredor (nutrición, cortes,
abastos) en ámbar-amanecer; todo lo que sea terreno en verdes/cafés. Cuenta la
historia del ultra — sales de noche, el plan te lleva al amanecer — sin violar la
regla de "solo tema claro" del proyecto (no es dark mode, es un acento cálido con más
peso dentro del tema claro).

---

## 2. Features propuestas para Cumbre (propuesta interna, pre-benchmark)

Orden de construcción recomendado: **2 → 1 → 3 → 4 → 5** (la #2 es el motor del que
dependen las demás).

| # | Feature | Resumen | Esfuerzo |
|---|---------|---------|----------|
| 1 | **Plan de Carrera por Segmentos** | Convierte los marcadores en una tabla de tramos: distancia, D+/D−, tiempo estimado, notas de nutrición. Exportable a PDF. | M |
| 2 | **Tiempo Estimado por Punto (GAP)** | Con ritmo base + factor de fatiga progresivo, calcula tiempo de paso por km ajustado por pendiente. Motor del resto. | M |
| 3 | **Calculadora de Cortes (cutoffs)** | Puntos de corte del reglamento dibujados en el perfil; margen proyectado con semáforo verde/ámbar/rojo. | S |
| 4 | **Plan de Nutrición/Hidratación por hora** | Objetivos de consumo (g CH/h, ml/h, sodio) traducidos a necesidades por tramo entre abastos. | M |
| 5 | **Sombreado de Secciones Nocturnas** | Cálculo solar client-side para marcar en el perfil dónde te agarra la noche/amanecer. | S–M |

---

## 3. Benchmark: backlog público de ultraPacer

Fuente: [feedback.ultrapacer.com/roadmap](https://feedback.ultrapacer.com/roadmap?sort=trend_score)
(consultado 2026-07-29). ultraPacer es la referencia directa más madura del nicho de
pacing/estrategia para ultra-trail — su backlog público de usuarios reales es la
mejor señal de dolor de mercado disponible sin hacer entrevistas propias.

### Los 7 dolores identificados (ordenados por votos agregados del cluster)

1. **El modelo de ritmo no refleja el terreno real (~74 votos)** — terreno técnico
   (25 votos, "In Progress"), escala de habilidad subida/bajada (15), ajuste en
   bajadas técnicas (9), ritmo custom entre waypoints (14), correr/caminar (5),
   escalas por evento p. ej. altitud (2). El GAP por pendiente sola no basta: rocas,
   raíces y altitud cambian el costo real. Cuando el estimado falla, se pierde
   confianza en todo el plan.
2. **El plan es estático, la carrera no (~29 votos)** — apps offline iOS/Android (21),
   re-pronóstico dinámico de ETA a partir del atraso real observado (caso citado:
   corredor llegó 6–13% tarde consistentemente y el plan original quedó roto desde
   temprano). El dolor no es "quiero una app", es recalcular el resto del plan con
   la señal real de progreso, sin conexión.
3. **El plan se consume en papel, por gente distinta al corredor (~49 votos)** — print
   options (12), race cards para crew con solo lo esencial (10), crew puede editar
   notas (10), cheat sheets por segmento (7), tarjetas para drop bags con letra
   grande (6), cuaderno por etapa (4). El "usuario" real incluye al crew y al pacer.
4. **El plan tiene que llegar a la muñeca (~33 votos)** — conexión directa con Garmin
   (15), export a Garmin PacePro (13), subida de archivos .fit (5).
5. **Nutrición cuantificada por tramo (19 votos, "Planned" en ultraPacer)** — calorías
   quemadas por segmento para guiar el plan de comida. Nadie lo tiene resuelto aún;
   valida directamente nuestra feature #4.
6. **Preparación del curso / limpieza de GPX (~18 votos)** — merge de GPX, loops y
   secciones repetidas, waypoints por lat/lon, corregir kilometraje oficial vs. GPS,
   tracks desconectados/shuttles.
7. **Aprender del esfuerzo — análisis post-carrera (~14 votos)** — comparar
   rendimientos entre vueltas/años, calibrar el objetivo con un entreno real, segmentos
   de entrenamiento del curso.

### Lectura estratégica

- La jerarquía de dolor es clara: **confianza en el modelo (1) > plan vivo el día de
  carrera (2) > outputs para crew/papel (3)**. ultraPacer tiene el #1 "in progress"
  pero el #2 y #3 apenas están en discusión — ahí hay espacio para diferenciarse.
- **La oportunidad más grande sin dueño es el #2**: una app offline-first donde el
  crew registra la hora real de paso y todo se re-pronostica (ETAs, margen de cortes,
  hora de llegada a secciones nocturnas). El atraso real observado *es* el factor de
  terreno aprendido en vivo — resuelve de un golpe los dolores 1, 2 y 3 a la vez.
- Nuestras 5 features (sección 2) quedan validadas por votos reales de otro producto:
  motor de tiempos (dolor 1), plan por segmentos + hoja para crew (dolor 3), cortes
  (dolor 2), nutrición (dolor 5).
- Ajuste que sugiere el benchmark: el motor GAP (feature 2) debe incluir desde el
  día uno un **factor de runnability por segmento** (no solo pendiente), y el output
  estrella no es la pantalla sino **tarjetas imprimibles segmentadas por audiencia**
  (corredor / crew / drop bag).
- Con backend ahora permitido para Cumbre, esto desbloquea: cuentas ligeras para
  compartir el plan con el crew (edición colaborativa de notas), sync con
  Garmin/Strava, push del plan al reloj (PacePro). El offline-first sigue siendo un
  requisito duro — la sierra no tiene señal.

---

## 4. Backlog consolidado — accionables priorizados

Fusiona la propuesta interna (sección 2) con los dolores validados por ultraPacer
(sección 3). `P0` = bloqueante de todo lo demás, `P1` = alto impacto validado por
mercado, `P2` = diferenciador competitivo, `P3` = importante pero no urgente.

| Prioridad | Feature | Dolor que resuelve | Esfuerzo | Notas |
|-----------|---------|---------------------|----------|-------|
| **P0** | Motor de tiempo estimado por punto (GAP) **+ factor de runnability por segmento** | Dolor 1 (ultraPacer, ~74 votos) | M | Ajustado post-benchmark: no basta con pendiente, sumar slowdown factor manual por tramo técnico |
| **P0** | Plan de Carrera por Segmentos | Dolor 3 (ultraPacer, ~49 votos) + feature interna #1 | M | Base de datos para cortes, nutrición y tarjetas |
| **P1** | Tarjetas imprimibles por audiencia (corredor / crew / drop bag) | Dolor 3 | S–M | Diferenciador: ultraPacer solo tiene "print options" genérico en Planned |
| **P1** | Calculadora de Cortes | Dolor 2 parcial + feature interna #3 | S | Depende de P0 |
| **P1** | Plan de Nutrición/Hidratación por hora | Dolor 5 (Planned en ultraPacer, sin resolver aún) | M | Ventana de oportunidad: nadie lo ha lanzado todavía |
| **P2** | Plan vivo offline-first (recalcular ETA con hora real de paso) | Dolor 2 (~29 votos) | L | Requiere backend + PWA offline; mayor oportunidad sin dueño en el nicho |
| **P2** | Sombreado de Secciones Nocturnas | — (feature interna #5) | S–M | Se integra bien con el plan vivo (P2 anterior) |
| **P3** | Integración Garmin (import activities + export PacePro) | Dolor 4 (~33 votos) | L | Requiere OAuth/backend; evaluar tras validar P0–P1 |
| **P3** | Editor de curso (merge GPX, loops, corrección de kilometraje) | Dolor 6 (~18 votos) | M | Necesario si se abre carga de GPX de terceros no oficiales |
| **P3** | Análisis post-carrera / comparación entre vueltas o años | Dolor 7 (~14 votos) | M | Requiere guardar historial por usuario (backend) |

### Siguiente paso sugerido

Arrancar por **P0**: el motor de tiempos con runnability, y la tabla de segmentos.
Son la base técnica de la que depende todo lo demás (cortes, nutrición, tarjetas,
plan vivo).
