# Guía de la presentación · Minería de datos en SIFCE

Duración: unos 10 minutos. Todo se muestra **en vivo**: Orange procesando
los 100.000 registros, las gráficas y la predicción automática dentro de SIFCE.

## Antes de empezar (5 minutos antes)

1. Abrir **Orange** → *File → Open* → `mineria-datos\diagrama_mineria_sifce.ows`.
2. Abrir dos terminales de PowerShell en la carpeta `sifce`:
   - `npm run dev:api`
   - `npm run dev:web`
3. En el navegador, entrar a http://localhost:5173 con
   `reclutador@technova.demo` / `Demo1234!`.
4. En otra ventana del navegador (modo incógnito), dejar lista la sesión de
   `laura.torres@correo.demo` / `Demo1234!` (candidata que se va a postular).

## El guion

### 1. Qué es el proyecto (1 minuto)

> "SIFCE es una plataforma donde las empresas publican vacantes y los
> candidatos se postulan. La IA compara cada hoja de vida con la vacante y
> calcula una compatibilidad. Nuestra pregunta de minería de datos fue: **¿qué
> hace que un candidato sea seleccionado, y se puede predecir?**"

### 2. Recolección: los 100.000 datos (1 minuto) · Orange

- Doble clic en **File** → se ven las 100.000 postulaciones y sus 30 columnas.
- Clic derecho en **Column Statistics** → *Open*: edades de −30 y 998,
  compatibilidades de 180, celdas vacías.

> "Generamos 100.000 postulaciones con la forma de los datos de SIFCE, con un
> 10 % de valores atípicos y un 20 % de datos vacíos, erróneos o duplicados,
> para practicar la depuración."

### 3. Depuración en vivo (2 minutos) · Orange

- En **File** presionar **Reload**: los 100.000 registros vuelven a recorrer el
  diagrama.
- Pasar el mouse por cada widget y mostrar la cantidad de filas:

| Widget | Filas | Qué hizo |
|---|---:|---|
| File | 100.000 | Datos recolectados |
| Unique | 95.410 | Quitó duplicados |
| Edit Domain | 95.410 | Corrigió "bogota", "Remotoo", "B1"… |
| Formula + Select Rows | 78.774 | Quitó errores y atípicos |
| Impute | 78.774 | Rellenó los vacíos |
| Unique (1) | **78.447** | Quitó los duplicados que tenían vacíos |

### 4. Análisis y gráficas (2 minutos) · Orange

Abrir cada widget con clic derecho → *Open*:

| Widget | Qué decir |
|---|---|
| **Distributions** | "Con compatibilidad alta se selecciona al 37 %; con baja, casi a nadie." |
| **Box Plot** | "Los seleccionados tienen compatibilidad promedio de 84,8 frente a 65,9." |
| **Scatter Plot** | "Los seleccionados (rojo) se concentran arriba: alta compatibilidad." |
| **k-Means → Scatter Plot (1)** | "El algoritmo encontró 4 perfiles sin que se los dijéramos: experimentados, jóvenes, cambio de carrera e intermedios." |

### 5. Predicción (2 minutos) · Orange

| Widget | Qué decir |
|---|---|
| **Test and Score** | "Comparamos 3 modelos. El mejor es la regresión logística: acierta el 82 % (AUC 0,84)." |
| **Confusion Matrix / ROC Analysis** | "Así se equivoca y así distingue entre seleccionados y no seleccionados." |
| **Predictions** | "Con 30 candidatos nuevos, que el modelo nunca vio, Random Forest acertó 27." |

### 6. La predicción automática dentro de SIFCE (2 minutos) · navegador

1. Como reclutador, ir a **Minería de datos** y presionar **Ejecutar minería en
   vivo**.
   > "SIFCE procesa ahora mismo los 100.000 registros: los genera, los depura y
   > vuelve a entrenar el modelo, en unos 15 segundos."
2. Mostrar las pestañas **Análisis** y **Modelo y perfiles** (las gráficas se
   actualizaron).
3. En la ventana de **Laura**: *Explorar vacantes* → postularse a
   *Desarrollador Backend Node.js* con su hoja de vida.
4. Volver al reclutador: **Vacantes → Desarrollador Backend Node.js → Ranking**.
   > "Nadie llenó nada: cuando SIFCE terminó de analizar la hoja de vida, el
   > modelo calculó solo la probabilidad de que sea seleccionada."
5. Clic en el nombre del candidato → tarjeta **Predicción automática de
   selección**: la probabilidad, lo que la sube y lo que la baja.

### 7. Cierre (30 segundos)

> "Lo que más decide es la compatibilidad. Pedir más del 30 % sobre el salario
> ofrecido castiga, y en tecnología el inglés avanzado ayuda mucho. La
> predicción es una ayuda: la decisión final siempre es del reclutador."

## Si algo falla

| Problema | Solución |
|---|---|
| Una ventana de Orange no aparece con doble clic | Clic derecho sobre el widget → *Open* |
| "Ejecutar minería en vivo" dice que no está disponible | La API se está ejecutando en Docker; usar `npm run dev:api` |
| El ranking dice "Predicción pendiente" | El análisis de IA aún no termina; esperar unos segundos y recargar |
| Laura ya está postulada a esa vacante (por un ensayo) | En *Mis postulaciones* presionar **Retirar** y volver a postularse: SIFCE analiza de nuevo y recalcula la predicción. O usar `carlos.ruiz@correo.demo` con *Analista de Datos* |
| El análisis queda en error | En `whatever\.env` está `AI_PROVIDER=groq`; si la clave de Groq no funciona, cambiar a `AI_PROVIDER=mock` y reiniciar `npm run dev:api` |
