# Minería de datos de SIFCE

Proceso completo de minería de datos sobre las **postulaciones** que gestiona
SIFCE, con la herramienta **Orange Data Mining**.

| Paso | Estado |
|---|---|
| 1. Recolección de datos | ✅ Dataset sintético de 100.000 registros (este documento) |
| 2. Depuración de datos | Pendiente |
| 3. Análisis de datos | Pendiente |
| 4. Interpretación y resultados (gráficas) | Pendiente |

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
| `generar_dataset.js` | El programa que genera los dos archivos. Con la misma semilla produce siempre los mismos datos |

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
