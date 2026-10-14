# Módulo de Inteligencia Artificial (RF09, RF10, RF11, RNF-M3)

## Flujo implementado

```
Candidato carga hoja de vida (RF07)
  → backend almacena el PDF y extrae su texto (pdf-parse)
Candidato se postula a una vacante (RF08)
  → se crea la postulación y un registro ai_analysis_results en estado "pending"
  → se dispara el análisis en segundo plano (no bloquea la respuesta HTTP, RNF-R1)
El proveedor de IA configurado analiza:
  → texto del CV + perfil estructurado del candidato + requisitos de la vacante
  → devuelve puntajes 0-100 por categoría (formación, experiencia, habilidades, idiomas)
compatibilityService combina esos puntajes con los pesos configurados por la
empresa (RF14) → obtiene el porcentaje de compatibilidad global
El resultado se persiste (RNF-F3) con fortalezas, brechas y una explicación
Reclutador consulta el resultado (RF10 ranking, RF11 explicación, RF12 comparación)
Reclutador decide manualmente la siguiente etapa (RF13) — la IA NUNCA decide
```

## Independencia del proveedor (RNF-M3)

Ningún controlador llama directamente a un proveedor de IA. Todos pasan por
`whatever/services/ai/aiProvider.js`, que expone una única función:

```js
analyze({ resumeText, candidateProfile, vacancy }) 
  → { educationScore, experienceScore, skillsScore, languagesScore,
      strengths, gaps, explanation, extractedProfile }
```

El proveedor activo se elige con la variable de entorno `AI_PROVIDER`:

| Valor | Archivo | Descripción |
|---|---|---|
| `mock` (por defecto) | `mockProvider.js` | Análisis determinístico por coincidencia de palabras clave entre el CV/perfil y los requisitos de la vacante. No usa ningún modelo de lenguaje ni servicio externo. Pensado para demostrar el flujo completo sin depender de credenciales pagas. Cada resultado queda marcado con `provider: "mock"` en la base de datos para nunca presentarlo como un análisis de IA real. |
| `groq` | `groqProvider.js` | IA real, **gratis** mientras te mantengas dentro de los límites de velocidad de Groq (sin tarjeta de crédito, sin crédito de prueba que se agote). Ejecuta modelos de pesos abiertos (Llama, etc.) sobre una API compatible con OpenAI. |
| `anthropic` | `anthropicProvider.js` | IA real vía la API de Claude (Anthropic). Usa "tool use" (llamada a herramienta forzada) para obtener una respuesta estructurada confiable, en vez de parsear texto libre. Solo un crédito de prueba pequeño para cuentas nuevas, sin plan gratuito permanente. |
| `openai` | `openaiProvider.js` | IA real vía la API de OpenAI. Mismo enfoque, usando "function calling". Mismo esquema de crédito de prueba que Anthropic. |
| `http` | `httpProvider.js` | Reenvía la solicitud a un servicio externo **propio** (si ya tienes uno desplegado aparte). |

## Cómo activar un proveedor de IA real

### Opción A: Groq (gratis, recomendada si no quieres pagar nada)

Groq mantiene un nivel gratuito **permanente** para este volumen de uso (a
diferencia de Anthropic/OpenAI, que solo dan un crédito de prueba que se
agota) — sin tarjeta de crédito. El límite es de velocidad, no de tiempo: a
la fecha, 30 solicitudes por minuto y 14.400 por día por cuenta, más que
suficiente para un proyecto académico o una demo (verifica los límites
vigentes en [console.groq.com/docs/rate-limits](https://console.groq.com/docs/rate-limits),
porque los ajustan de vez en cuando).

1. Crea una cuenta en [console.groq.com](https://console.groq.com) (con correo, GitHub o Google) y genera una clave en **API Keys**.
2. En `whatever/.env`:
   ```
   AI_PROVIDER=groq
   AI_API_KEY=gsk_...
   AI_MODEL=openai/gpt-oss-20b
   ```
3. Reinicia el backend. No hay que tocar ningún controlador ni ruta.

Si en algún momento el sistema responde "Se alcanzó el límite de la capa
gratuita de Groq", es el límite de velocidad, no que se te acabó un saldo —
simplemente espera unos minutos y vuelve a intentar (o reintenta el análisis
desde el detalle de la postulación).

**Si el análisis falla con un error de "modelo no encontrado" (`model_not_found`)**:
Groq mueve modelos entre planes con cierta frecuencia — esto ya nos pasó
en este proyecto con `llama-3.3-70b-versatile`, que pasó a ser exclusivo del
plan Enterprise. En vez de adivinar otro nombre, consulta el catálogo vigente
**para tu propia cuenta** (puede variar según tu plan):
```
curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer TU_CLAVE"
```
Elige de ahí un modelo de chat/texto (evita los de audio como `whisper-*` o
de moderación como `llama-guard-*`, que no sirven para esta tarea) y
actualiza `AI_MODEL` en `whatever/.env`.

### Opción B: Anthropic (Claude)

1. Crea una cuenta en [console.anthropic.com](https://console.anthropic.com) y genera una clave en **API Keys**. Las cuentas nuevas reciben un pequeño crédito de prueba (no hay un plan gratuito permanente para uso en producción — esto puede cambiar, confírmalo en la consola).
2. En `whatever/.env`:
   ```
   AI_PROVIDER=anthropic
   AI_API_KEY=sk-ant-...
   AI_MODEL=claude-haiku-4-5-20251001
   ```
3. Reinicia el backend (`npm run dev` o `npm start`). No hay que tocar ningún controlador ni ruta.

Modelo recomendado: **Haiku** (el más económico de la familia Claude). Esta tarea es de clasificación/extracción sobre un CV corto, no requiere el modelo más potente — usar un modelo más caro aquí sería gastar de más sin mejorar el resultado de forma perceptible.

### Opción C: OpenAI

1. Crea una cuenta en [platform.openai.com](https://platform.openai.com) y genera una clave en **API keys**. Igual que Anthropic: crédito de prueba pequeño para cuentas nuevas, sin plan gratuito permanente para producción.
2. En `whatever/.env`:
   ```
   AI_PROVIDER=openai
   AI_API_KEY=sk-...
   AI_MODEL=gpt-5.6-luna
   ```
   Verifica el nombre de modelo vigente en la documentación de OpenAI si `gpt-5.6-luna` ya no aparece disponible — los nombres de modelo de los proveedores cambian con cierta frecuencia.
3. Reinicia el backend.

### Cuál elegir

Las tres funcionan igual de bien para esta tarea (comparar un CV corto contra los requisitos de una vacante y devolver puntajes 0-100 por categoría); todas usan el mismo mecanismo (salida estructurada forzada, no texto libre parseado) y el mismo contrato de respuesta interno, así que cambiar de una a otra es solo cambiar `AI_PROVIDER`, `AI_API_KEY` y `AI_MODEL` en el `.env` — nada de código. Si el criterio es "no gastar nada", Groq es la respuesta directa. Si ya tienes crédito o facturación en Anthropic u OpenAI, cualquiera de las dos es una alternativa igual de válida; la diferencia práctica es principalmente el precio por token y la calidad del modelo elegido (los modelos abiertos de Groq son más que suficientes para esta clasificación simple, pero no son el estado del arte en tareas de razonamiento complejo — irrelevante aquí, pero vale saberlo).

### Verificar que quedó bien conectado

Postúlate a una vacante de prueba con un CV cargado y revisa el detalle de esa postulación: si el análisis pasa de "Procesando" a mostrar puntajes y una explicación, quedó funcionando. Si pasa a "Falló", revisa `error_message` en la tabla `ai_analysis_results` (o los logs del backend) — normalmente indica una clave inválida, saldo agotado, o el nombre de modelo mal escrito.

## Contrato del proveedor `http` (servicio externo propio)

```
POST {AI_API_URL}
Headers:
  Content-Type: application/json
  Authorization: Bearer {AI_API_KEY}
Body:
{
  "resumeText": "texto extraído del CV",
  "candidateProfile": { "education": [...], "experience": [...], "skills": [...], "languages": [...] },
  "vacancy": { "required_education": "...", "min_experience_years": 2, "required_skills": [...], "required_languages": [...] }
}

Respuesta 200 esperada:
{
  "educationScore": 0-100,
  "experienceScore": 0-100,
  "skillsScore": 0-100,
  "languagesScore": 0-100,
  "strengths": ["..."],
  "gaps": ["..."],
  "explanation": "texto legible para el reclutador",
  "extractedProfile": { ... }
}
```

La clave (`AI_API_KEY`) solo vive en el `.env` del servidor — nunca en el
código fuente ni en el frontend (RNF-S3, Sección 9 del prompt).

## Cálculo de compatibilidad global (RF14, Sección 11)

`whatever/services/compatibilityService.js` calcula:

```
global = (educationScore·Wf + experienceScore·We + skillsScore·Wh + languagesScore·Wi) / 100
```

Donde `Wf, We, Wh, Wi` son los pesos (%) configurados por la empresa en
`evaluation_criteria` (RF14), normalizados para sumar 100. Si la empresa no
configuró criterios propios, se usa 25% para cada categoría por defecto. La
fórmula y los pesos usados quedan documentados aquí para que el porcentaje
mostrado nunca sea "arbitrario" (requisito explícito de la Sección 11).

## Manejo de fallos (RNF-F4)

Si el proveedor falla (servicio no disponible, error HTTP, timeout), el
registro `ai_analysis_results` pasa a `status = "failed"` con el mensaje de
error guardado en `error_message`. El reclutador puede reintentar el análisis
desde la vista de detalle de la postulación (`POST /applications/:id/retry-analysis`)
sin perder la postulación ni tener que repetirla desde cero.
