# Minería de datos de SIFCE

Proceso completo de minería de datos sobre las **postulaciones** que gestiona
SIFCE, con la herramienta **Orange Data Mining**.

| Paso | Estado |
|---|---|
| 1. Recolección de datos | ✅ Dataset sintético de 100.000 registros (este documento) |
| 2. Depuración de datos | ✅ Guía de Orange (abajo) y en código (`entrenar_modelo.js`) |
| 3. Análisis de datos | ✅ Modelos, predicción y patrones, en Orange y en SIFCE |
| 4. Interpretación y resultados (gráficas) | ✅ Gráficas en Orange y en la página **Minería de datos** de SIFCE |

## Objetivos de la minería

| | Pregunta | Técnica en Orange |
|---|---|---|
| **Objetivo** | ¿Qué factores hacen que un candidato sea seleccionado en un proceso de SIFCE? | Todo el proceso |
| **Predicción** | Con los datos de la postulación, ¿se puede predecir si el candidato será seleccionado (`seleccionado` = Sí/No)? | Clasificación: Tree, Random Forest, Logistic Regression → Test and Score, Confusion Matrix, ROC Analysis |
| **Análisis** | ¿Cómo se comportan la compatibilidad, la experiencia, el inglés y el salario según el sector, el cargo y la ciudad? ¿Dónde se pierden los candidatos en el embudo de selección? | Distributions, Box Plot, Scatter Plot, Correlations, Pivot Table |
| **Patrón de comportamiento** | ¿Qué perfiles de candidato existen? ¿Quiénes se retiran del proceso y por qué? ¿En qué meses llegan más postulaciones? | Clustering (k-Means), Silhouette Plot, Line Plot por fecha |

## 1. Recolección de datos

### Por qué un dataset sintético

SIFCE es un prototipo: su base de datos solo tiene unas pocas postulaciones de
demostración. Para tener volumen suficiente se generó un dataset **sintético**
con la misma forma que los datos reales de SIFCE: los datos del candidato, la
vacante, los cuatro puntajes de la IA, la compatibilidad ponderada (con los
pesos de cada empresa, como hace el microservicio de compatibilidad) y el
resultado del proceso de selección.

Las reglas del generador imitan el negocio. Por ejemplo, a mayor compatibilidad
más probabilidad de ser seleccionado, y pedir mucho más salario del ofrecido la
reduce. Esas reglas son las que la minería debe **descubrir** en los pasos 3 y 4.

### Archivos

| Archivo | Para qué |
|---|---|
| `datos/postulaciones_sifce.csv` | **El dataset.** Es el que se abre en Orange (100.000 filas, 30 columnas, UTF-8, separado por comas) |
| `datos/control_calidad.csv` | Qué anomalía tiene cada fila y el perfil real del candidato. **No se usa en la minería**: sirve para comprobar después que la depuración y el clustering funcionaron |
| `datos/candidatos_nuevos.csv` | 30 postulaciones nuevas **sin resultado**, para que Orange las prediga (widget Predictions) |
| `datos/candidatos_nuevos_resultado_real.csv` | Lo que de verdad pasó con esos 30, para comparar la predicción |
| `generar_dataset.js` | El programa que genera los archivos de `datos/`. Con la misma semilla produce siempre los mismos datos |
| `entrenar_modelo.js` | Depura, analiza, entrena el modelo y encuentra los perfiles; deja el resultado para la página de SIFCE |

Para volver a generarlos, desde la raíz del proyecto:

```powershell
node mineria-datos/generar_dataset.js
```

Los CSV no se suben a GitHub (pesan 24 MB); cada integrante los genera con
ese comando en un segundo.

### Ficha técnica

| Dato | Valor |
|---|---|
| Registros | 100.000 |
| Columnas | 30 |
| Período | enero de 2025 a septiembre de 2026 |
| Empresas | 8, de 7 sectores |
| Cargos | 22 |
| Ciudades | 6 (Bogotá, Medellín, Cali, Bucaramanga, Barranquilla, Cartagena) |
| Variable objetivo | `seleccionado` (Sí / No), cerca del 21 % son Sí |

### Calidad: la suciedad sembrada

| Tipo | Filas | % | Ejemplos |
|---|---:|---:|---|
| Limpias | 70.000 | 70 % | — |
| **Valores atípicos (outliers)** | 10.000 | **10 %** | Salario aspirado 3 a 8 veces el ofrecido, 38 a 50 años de experiencia, CV de 20.000 palabras, análisis de IA de 300 s, 400 días en proceso |
| **Celdas vacías** | 8.000 | 8 % | Entre 1 y 3 celdas sin dato por fila (edad, ciudad, compatibilidad, seleccionado…) |
| **Datos erróneos** | 7.000 | 7 % | Edad −5 o 999, compatibilidad de 180, experiencia mayor que la edad, salario negativo, "bogota" / "BOGOTÁ" / "Medellin", "Remotoo", inglés "B1", fechas en 2030 o 1900, seleccionado = Sí con estado Rechazado |
| **Duplicados** | 5.000 | 5 % | Copias exactas de otra fila, con el mismo `id_postulacion` |
| **Total sucio** | 20.000 | **20 %** | vacías + erróneas + duplicadas |

Diferencia clave para la depuración: un **atípico** es un valor extremo pero
posible (alguien sí puede pedir un salario muy alto), así que se analiza antes
de borrarlo. Un **erróneo** es imposible o está mal escrito, y se corrige o se
elimina.

### Diccionario de datos

| Columna | Tipo | Descripción |
|---|---|---|
| `id_postulacion` | texto | Identificador de la postulación (P000001…). Rol en Orange: **meta** |
| `fecha_postulacion` | fecha | Día en que el candidato se postuló (AAAA-MM-DD) |
| `empresa` | categórica | Empresa dueña de la vacante |
| `sector` | categórica | Tecnología, Retail, Salud, Finanzas, Manufactura, Educación, Logística |
| `cargo` | categórica | Cargo de la vacante |
| `modalidad` | categórica | Remoto, Híbrido, Presencial |
| `ciudad` | categórica | Ciudad del candidato |
| `edad` | numérica | Edad del candidato (años) |
| `nivel_educativo` | categórica | Bachiller, Técnico, Tecnólogo, Profesional, Especialización, Maestría |
| `anios_experiencia` | numérica | Años de experiencia laboral del candidato |
| `experiencia_requerida` | numérica | Años de experiencia que pide la vacante |
| `habilidades_requeridas` | numérica | Cantidad de habilidades que pide la vacante |
| `habilidades_cumplidas` | numérica | Cuántas de esas habilidades tiene el candidato |
| `nivel_ingles` | categórica | Ninguno, Básico, Intermedio, Avanzado, Nativo |
| `certificaciones` | numérica | Certificaciones del candidato |
| `salario_ofrecido` | numérica | Salario mensual de la vacante (COP) |
| `salario_aspirado` | numérica | Salario mensual que pide el candidato (COP) |
| `paginas_cv` | numérica | Páginas de la hoja de vida en PDF |
| `palabras_cv` | numérica | Palabras extraídas por el validador de CV |
| `puntaje_formacion` | numérica | Puntaje de la IA en formación (0-100) |
| `puntaje_experiencia` | numérica | Puntaje de la IA en experiencia (0-100) |
| `puntaje_habilidades` | numérica | Puntaje de la IA en habilidades (0-100) |
| `puntaje_idiomas` | numérica | Puntaje de la IA en idiomas (0-100) |
| `compatibilidad` | numérica | Promedio ponderado de los cuatro puntajes con los pesos de la empresa (0-100) |
| `nivel_compatibilidad` | categórica | Alta (≥ 75), Media (≥ 50), Baja |
| `tiempo_analisis_ia_seg` | numérica | Segundos que tardó el análisis de IA |
| `dias_en_proceso` | numérica | Días desde la postulación hasta el cierre |
| `etapa_maxima` | categórica | Hasta dónde llegó: Postulado, Revisión, Entrevista, Prueba técnica, Oferta |
| `estado_final` | categórica | Seleccionado, Rechazado, Retirado |
| `seleccionado` | categórica | **Variable objetivo**: Sí / No |

**Ojo al predecir:** `estado_final`, `etapa_maxima` y `dias_en_proceso` se
conocen **al final** del proceso y delatan la respuesta (si `estado_final` es
Seleccionado, `seleccionado` es Sí). Para la predicción se excluyen; sí sirven
para el análisis del embudo y de los retiros.

## Orange: instalación y primer uso

Orange es gratuito, de código abierto y **no necesita cuenta ni iniciar
sesión**. Se usa arrastrando bloques ("widgets") y uniéndolos con líneas.

1. Entrar a [orangedatamining.com/download](https://orangedatamining.com/download/).
2. En la pestaña **Windows**, descargar el instalador (*Standalone installer*,
   unos 400 MB; ya trae Python incluido).
3. Ejecutarlo con las opciones por defecto y abrir **Orange** desde el menú inicio.
   La primera vez tarda en abrir.
4. En el lienzo, arrastrar el widget **File** (grupo *Data*), hacer doble clic
   y buscar `mineria-datos\datos\postulaciones_sifce.csv`.
5. En la tabla de columnas del widget File, revisar los roles:
   - `id_postulacion` → **meta**
   - `seleccionado` → **target**
   - Si alguna columna numérica con pocos valores (por ejemplo `certificaciones`)
     aparece como *categorical*, cambiarla a *numeric*.
   - Presionar **Apply**.
6. Conectar File a **Data Table** para ver los datos y a **Feature Statistics**
   para ver, por columna, los valores faltantes, mínimos y máximos. Ahí ya se
   nota la suciedad: edades negativas, compatibilidades mayores que 100 y
   celdas vacías.

Con eso el paso 1 queda listo y comprobado en Orange.

## 2. Depuración de datos (en Orange)

El diagrama completo ya armado está en **`diagrama_mineria_sifce.ows`** (abrirlo
con *File → Open* en Orange) y su captura en `diagrama_orange.jpg`.

Cadena de widgets, cada uno conectado al anterior:

```
File → Unique → Edit Domain → Formula → Select Rows → Select Columns → Impute → Unique (1) → Save Data
```

| # | Widget (grupo) | Qué hace | Configuración |
|---|---|---|---|
| 1 | **Unique** (Transform) | Quita los duplicados | Dejar todo por defecto: agrupa por todas las columnas y se queda con la primera |
| 2 | **Edit Domain** (Data) | Corrige categorías mal escritas | `ciudad`: BOGOTÁ y bogota → Bogotá; Medellin y medellín → Medellín; Cali. → Cali; Barranquila → Barranquilla. `modalidad`: PRESENCIAL → Presencial; Remotoo y remoto → Remoto; hibrido → Híbrido. `nivel_ingles`: Avanzdo → Avanzado; basico → Básico; intermedio y B1 → Intermedio. Escribir el nombre correcto une los valores |
| 3 | **Formula** (Transform) | Marca los errores y los atípicos con dos columnas nuevas | Las dos expresiones de abajo |
| 4 | **Select Rows** (Transform) | Elimina lo marcado | `dato_erroneo` is 0 · `valor_atipico` is 0 · `seleccionado` is defined |
| 5 | **Select Columns** (Transform) | Quita las dos columnas auxiliares | Pasar `dato_erroneo` y `valor_atipico` a *Ignored* |
| 6 | **Impute** (Transform) | Rellena los vacíos que quedan | Marcar *Average/Most frequent* (promedio en números, valor más frecuente en categorías). **Ojo:** el widget trae marcado *Don't impute* por defecto |
| 7 | **Unique (1)** (Transform) | Quita los duplicados que quedaban | Por defecto. Hace falta porque Orange no considera iguales dos celdas vacías: los duplicados de filas con vacíos pasan el primer Unique y solo se pueden quitar después de imputar |
| 8 | **Save Data** (Data) | Guarda el dataset limpio | `datos/postulaciones_limpias.csv`, con *Autosave* |

Expresión de `dato_erroneo` (Numeric):

```
1 if (edad < 18 or edad > 75 or anios_experiencia < 0 or anios_experiencia > edad - 14 or compatibilidad < 0 or compatibilidad > 100 or puntaje_habilidades > 100 or salario_aspirado < 500000 or habilidades_cumplidas > habilidades_requeridas or fecha_postulacion < 1735689600 or fecha_postulacion > 1790726400 or (seleccionado == 'Sí' and estado_final != 'Seleccionado') or (seleccionado == 'No' and estado_final == 'Seleccionado')) else 0
```

Expresión de `valor_atipico` (Numeric):

```
1 if (anios_experiencia > 35 or palabras_cv > 5000 or paginas_cv > 8 or certificaciones > 12 or tiempo_analisis_ia_seg > 40 or dias_en_proceso > 60 or salario_aspirado > 2.5 * salario_ofrecido) else 0
```

Las fechas se comparan en segundos: 1735689600 = 1 de enero de 2025 y
1790726400 = 30 de septiembre de 2026. Los límites de los atípicos se eligieron
mirando el Box Plot de cada columna.

Resultado esperado (comprobado con el motor de Orange 3.40 contra
`control_calidad.csv`):

| Después de | Filas | Qué salió |
|---|---:|---|
| File | 100.000 | — |
| Unique | 95.410 | 4.590 duplicados (los que no tienen celdas vacías) |
| Select Rows | 78.774 | errores numéricos y lógicos, atípicos, filas sin fecha y sin `seleccionado` |
| Impute | 78.774 | ninguna fila; se rellenan unos 650 vacíos por columna |
| Unique (1) | **78.447** | los 327 duplicados que tenían celdas vacías |

Ninguna fila limpia se pierde por error: las 68.161 limpias únicas llegan al final.

## 3. Análisis de datos (en Orange)

Se sigue en el mismo lienzo, a partir de la salida de **Impute**.

### 3.1 Preparar los datos para predecir

```
Impute → Select Columns → Preprocess
```

- **Select Columns**: pasar a *Ignored* `estado_final`, `etapa_maxima`,
  `dias_en_proceso` y `fecha_postulacion`. Las tres primeras solo se conocen al
  final del proceso y delatan la respuesta: si se dejan, el modelo "acierta"
  haciendo trampa. `seleccionado` queda como *Target*.
- **Preprocess**: agregar **Normalize Features**. Los salarios están en
  millones y la edad en decenas; sin normalizar, la regresión logística no
  converge y rinde mucho peor (AUC 0,70 en vez de 0,83).

### 3.2 Predicción: entrenar y comparar modelos

```
Preprocess ──→ Test and Score ──→ Confusion Matrix
     │              ↑        └──→ ROC Analysis
     │   Logistic Regression ─┤
     │   Tree ────────────────┤
     │   Random Forest ───────┘
     └──→ Tree ──→ Tree Viewer
```

| Widget (grupo) | Cómo se conecta | Qué muestra |
|---|---|---|
| **Logistic Regression**, **Tree**, **Random Forest** (Model) | Cada uno recibe *Preprocessed Data → Data* de Preprocess (si Orange propone *Preprocessor*, corregir el enlace) y se conecta a **Test and Score** | Los tres modelos a comparar. En **Tree** desmarcar *Induce binary tree* (`cargo` tiene 22 valores y el árbol binario acepta máximo 16) y limitar la profundidad a 6 |
| **Test and Score** (Evaluate) | Data ← Preprocess | Exactitud (CA), AUC, precisión y recall con validación cruzada de 5 particiones |
| **Confusion Matrix** (Evaluate) | ← Test and Score | Aciertos y errores del modelo elegido |
| **ROC Analysis** (Evaluate) | ← Test and Score | Curva ROC de los tres modelos, target `Sí` |
| **Tree Viewer** (Visualize) | Preprocess → Tree → Tree Viewer | Las reglas que sigue el árbol |

Resultado esperado (comprobado con Orange 3.40):

| Modelo | Exactitud (CA) | AUC |
|---|---:|---:|
| Logistic Regression | 82,4 % | 0,844 |
| Tree | 81,5 % | 0,815 |
| Random Forest | 80,8 % | 0,803 |

Con *target* = `Sí`, la regresión logística tiene precisión 61,7 % y recall
36,1 %.

Sin modelo (decir siempre "No") se acierta el 79 %, así que los modelos sí
aprenden. El mejor es la regresión logística, el mismo tipo de modelo que usa
la página de SIFCE.

### 3.3 Predecir candidatos nuevos

```
File (candidatos_nuevos.csv) ──→ Predictions ──→ Data Table
Preprocess → Random Forest ─────────↗
Preprocess → Logistic Regression ───↗
```

1. Agregar un **segundo File** con `datos/candidatos_nuevos.csv`
   (`id_postulacion` como *meta*; `cargo` llega como *text/meta* por ser solo
   30 filas: cambiarlo a *categorical / feature*).
2. Conectarlo a **Predictions** (Evaluate) como *Data*.
3. Conectar **Random Forest** y **Logistic Regression** (los que reciben datos de
   Preprocess) a **Predictions**: Orange los entrena con las postulaciones
   limpias y predice a los 30 nuevos.
4. Predictions muestra, para cada candidato, si sería seleccionado y con qué
   probabilidad. Comparar con `candidatos_nuevos_resultado_real.csv`: el Random
   Forest acierta **27 de 30** y la regresión logística **26 de 30**. En
   *Show probabilities for* elegir *Classes known to the model* para ver la
   probabilidad de cada uno.

### 3.4 Gráficas del análisis

| Widget (Visualize) | Configuración | Qué se ve |
|---|---|---|
| **Distributions** | Variable `nivel_compatibilidad`, *Split by* `seleccionado` | Con compatibilidad alta se selecciona al 37 %; con baja, casi a nadie |
| **Box Plot** | Variable `compatibilidad`, *Subgroups* `seleccionado` | Los seleccionados tienen compatibilidad mucho más alta |
| **Scatter Plot** | X `anios_experiencia`, Y `compatibilidad`, color `seleccionado` | Dónde se concentran los seleccionados |
| **Distributions** | Variable `nivel_ingles`, *Split by* `seleccionado` (antes, Select Rows con sector = Tecnología) | En tecnología el inglés avanzado multiplica la selección |
| **Pivot Table** (Transform) | Filas `sector`, columnas `seleccionado` | Selección por sector |

### 3.5 Patrones de comportamiento: perfiles de candidato

```
Impute → Select Columns → k-Means → Scatter Plot / Distributions
```

- **Select Columns**: dejar como *Features* solo `edad`, `anios_experiencia`,
  `nivel_educativo`, `nivel_ingles` y `certificaciones`, y `seleccionado` como
  *Target* (k-Means no lo usa, pero sirve para colorear).
- **k-Means** (Unsupervised): **k = 4**, con normalización.
- **Scatter Plot**: X `edad`, Y `anios_experiencia`, color `Cluster`.
- **Distributions**: variable `seleccionado`, *Split by* `Cluster`.

Salen cuatro perfiles: recién egresados, en crecimiento, experimentados y
personas en cambio de carrera (mucha edad, poca experiencia). Los
experimentados son los más seleccionados (32 %) y los de cambio de carrera los
que menos (6 %).

## 4. Interpretación y resultados

| Hallazgo | Evidencia |
|---|---|
| La **compatibilidad** que calcula SIFCE es lo que más decide | 37,5 % de selección con compatibilidad alta frente a 0,5 % con baja; es la variable de mayor peso |
| Pedir **más del 30 %** sobre el salario ofrecido castiga | La selección baja de 23 % a 9 % y el retiro sube de 4 % a 43 % |
| En **tecnología** el inglés avanzado pesa mucho | 41 % de selección con inglés avanzado frente a 11 % con básico |
| Las **certificaciones** ayudan | 29 % de selección con 3 o más, frente a 16 % con menos |
| Hay **temporadas** de postulación | Enero a marzo y julio-agosto concentran la demanda |
| Existen **4 perfiles** de candidato | k-Means los separa sin conocerlos; los experimentados coinciden en 99,6 % con los seniors reales |
| Se puede **predecir** la selección | Regresión logística con AUC entre 0,83 (Orange) y 0,87 (SIFCE); Random Forest acierta 27 de 30 candidatos nuevos |

La predicción es una ayuda: acierta mucho al decir "No", pero se le escapan
algunos seleccionados. Por eso en SIFCE la decisión final sigue siendo del
reclutador.

## La minería dentro de SIFCE

La página **Minería de datos** (menú lateral del superadministrador, del
administrador de empresa y del reclutador) muestra el proceso con gráficas y
**predice** si un candidato sería seleccionado:

| Pestaña | Contenido |
|---|---|
| 1. Depuración | Filas después de cada paso y qué se limpió |
| 2. Análisis | Selección por compatibilidad, inglés por sector, aspiración salarial, embudo, postulaciones por mes y por sector; cada gráfica con su interpretación |
| 3. Modelo y perfiles | Exactitud, AUC, curva ROC, matriz de confusión, peso de cada variable y los 4 perfiles de k-Means |
| 4. Predecir candidato | Formulario con los datos del candidato → probabilidad de ser seleccionado y los factores que la suben o la bajan |

Cómo funciona:

- `entrenar_modelo.js` depura los datos con las mismas reglas de Orange,
  entrena una **regresión logística** (70 % entrenamiento, 30 % prueba), hace
  el **k-Means** y guarda todo en `whatever/services/mineria/modelo_seleccion.json`.
- La API lo publica en `GET /api/v1/mineria/resumen` y predice en
  `POST /api/v1/mineria/prediccion` (código en `whatever/services/mineria/`).
- Para volver a entrenar después de cambiar los datos:

```powershell
node mineria-datos/generar_dataset.js
node mineria-datos/entrenar_modelo.js
```
