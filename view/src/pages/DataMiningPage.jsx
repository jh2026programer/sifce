import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, Cell, ReferenceLine,
} from 'recharts';
import * as mineriaApi from '../api/mineria';
import Loading from '../components/Loading.jsx';
import Alert from '../components/Alert.jsx';
import { IconUsers, IconTarget, IconTrendingUp, IconLayers } from '../components/Icons.jsx';
import { CHART_COLORS, axisTick } from '../styles/chartTheme.js';

// ============================================================================
// Minería de datos: lo encontrado al analizar 100.000 postulaciones (dataset
// sintético) y la predicción de selección con el modelo entrenado.
// ============================================================================

const miles = (n) => Number(n).toLocaleString('es-CO');
const COLOR_NEGATIVO = '#b42318';

function StatCard({ icon, color, value, label }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

function ChartCard({ title, children, conclusion }) {
  return (
    <div className="chart-card">
      <h3>{title}</h3>
      {children}
      {conclusion && <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}><strong>Interpretación:</strong> {conclusion}</p>}
    </div>
  );
}

const pctTick = (v) => `${v}%`;

// --- Pestaña 1: depuración --------------------------------------------------------
function Depuracion({ d }) {
  const dep = d.depuracion;
  const descartadas = dep.pasos[0].filas - d.resumen.postulaciones_analizadas;
  const detalle = [
    ['Duplicados eliminados', dep.duplicados],
    ['Filas con datos erróneos eliminadas', dep.erroneos_eliminados],
    ['Filas con valores atípicos eliminadas', dep.atipicos_eliminados],
    ['Filas sin variable objetivo eliminadas', dep.sin_objetivo_eliminados],
    ['Categorías mal escritas corregidas', dep.categorias_corregidas],
    ['Celdas vacías imputadas', dep.valores_imputados],
  ];
  return (
    <>
      <div className="stat-row" style={{ marginBottom: 22 }}>
        <StatCard icon={<IconLayers size={20} />} color="blue" value={miles(dep.pasos[0].filas)} label="Postulaciones recolectadas" />
        <StatCard icon={<IconUsers size={20} />} color="teal" value={miles(d.resumen.postulaciones_analizadas)} label="Postulaciones limpias analizadas" />
        <StatCard icon={<IconTarget size={20} />} color="amber" value={miles(descartadas)} label="Descartadas en la depuración" />
        <StatCard icon={<IconTrendingUp size={20} />} color="violet" value={`${d.resumen.tasa_seleccion}%`} label="Tasa de selección" />
      </div>
      <div className="grid-2">
        <ChartCard
          title="Filas después de cada paso de depuración"
          conclusion={`De ${miles(dep.pasos[0].filas)} registros quedaron ${miles(d.resumen.postulaciones_analizadas)} confiables (${Math.round((d.resumen.postulaciones_analizadas / dep.pasos[0].filas) * 100)} %). Los vacíos restantes se rellenaron sin perder filas.`}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dep.pasos}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="paso" tick={axisTick(11)} interval={0} />
              <YAxis tick={axisTick(11)} tickFormatter={miles} width={60} />
              <Tooltip formatter={(v) => miles(v)} />
              <Bar dataKey="filas" name="Filas" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <div className="card">
          <h3>Qué se limpió</h3>
          <div className="table-wrap">
            <table className="data-table">
              <tbody>
                {detalle.map(([texto, valor]) => (
                  <tr key={texto}><td>{texto}</td><td style={{ textAlign: 'right' }}><strong>{miles(valor)}</strong></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
            Mismas reglas que el diagrama de Orange: Unique, Edit Domain, Formula, Select Rows e Impute.
          </p>
        </div>
      </div>
    </>
  );
}

// --- Pestaña 2: análisis ---------------------------------------------------------
function Analisis({ d }) {
  const a = d.analisis;
  const alta = a.por_compatibilidad.find((g) => g.grupo === 'Alta');
  const baja = a.por_compatibilidad.find((g) => g.grupo === 'Baja');
  const avz = a.ingles_por_sector.find((g) => g.nivel_ingles === 'Avanzado');
  const bas = a.ingles_por_sector.find((g) => g.nivel_ingles === 'Básico');
  const [hasta, mas] = a.por_brecha_salarial;
  const sectores = [...a.por_sector].sort((x, y) => y.tasa_seleccion - x.tasa_seleccion);
  const meses = a.por_mes.map((m) => ({ ...m, etiqueta: new Date(`${m.mes}-15`).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }) }));
  const pico = [...a.por_mes].sort((x, y) => y.postulaciones - x.postulaciones).slice(0, 3)
    .map((m) => new Date(`${m.mes}-15`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }));
  const embudo = a.embudo;

  return (
    <>
      <div className="grid-2">
        <ChartCard
          title="Tasa de selección según la compatibilidad"
          conclusion={`Con compatibilidad alta se selecciona al ${alta.tasa_seleccion} % de los candidatos; con baja, solo al ${baja.tasa_seleccion} %. Es el factor que más decide.`}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={a.por_compatibilidad}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="grupo" tick={axisTick(12)} />
              <YAxis tick={axisTick(11)} tickFormatter={pctTick} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="tasa_seleccion" name="Seleccionados" fill={CHART_COLORS.accent} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Inglés y selección: tecnología frente a otros sectores"
          conclusion={`En tecnología, el inglés avanzado lleva la selección al ${avz.tecnologia} % (frente a ${bas.tecnologia} % con inglés básico). En los demás sectores la diferencia es menor.`}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={a.ingles_por_sector}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="nivel_ingles" tick={axisTick(11)} />
              <YAxis tick={axisTick(11)} tickFormatter={pctTick} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend />
              <Bar dataKey="tecnologia" name="Tecnología" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} />
              <Bar dataKey="otros_sectores" name="Otros sectores" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Aspiración salarial: selección y retiro"
          conclusion={`Quien pide más del 30 % sobre lo ofrecido es seleccionado el ${mas.tasa_seleccion} % de las veces (vs. ${hasta.tasa_seleccion} %) y se retira del proceso el ${mas.tasa_retiro} % (vs. ${hasta.tasa_retiro} %).`}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={a.por_brecha_salarial}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="grupo" tick={axisTick(12)} />
              <YAxis tick={axisTick(11)} tickFormatter={pctTick} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend />
              <Bar dataKey="tasa_seleccion" name="Seleccionados" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} />
              <Bar dataKey="tasa_retiro" name="Se retiraron" fill={COLOR_NEGATIVO} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Embudo del proceso de selección"
          conclusion={`De ${miles(embudo[0].candidatos)} postulaciones, ${miles(embudo[2].candidatos)} llegan a entrevista y ${miles(embudo[4].candidatos)} reciben una oferta (${Math.round((embudo[4].candidatos / embudo[0].candidatos) * 100)} %).`}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={embudo} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis type="number" tick={axisTick(11)} tickFormatter={miles} />
              <YAxis type="category" dataKey="etapa" tick={axisTick(11)} width={100} />
              <Tooltip formatter={(v) => miles(v)} />
              <Bar dataKey="candidatos" name="Candidatos" fill={CHART_COLORS.primary} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard
        title="Postulaciones por mes"
        conclusion={`Hay temporadas: los meses con más postulaciones fueron ${pico.join(', ')}. Enero a marzo y julio-agosto concentran la demanda.`}
      >
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={meses}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis dataKey="etiqueta" tick={axisTick(11)} />
            <YAxis tick={axisTick(11)} tickFormatter={miles} width={55} />
            <Tooltip formatter={(v) => miles(v)} />
            <Line type="monotone" dataKey="postulaciones" name="Postulaciones" stroke={CHART_COLORS.accent} strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Tasa de selección por sector"
        conclusion={`${sectores[0].grupo} tiene la tasa más alta (${sectores[0].tasa_seleccion} %) y ${sectores.at(-1).grupo} la más baja (${sectores.at(-1).tasa_seleccion} %).`}
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={sectores}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis dataKey="grupo" tick={axisTick(11)} interval={0} />
            <YAxis tick={axisTick(11)} tickFormatter={pctTick} />
            <Tooltip formatter={(v) => `${v}%`} />
            <Bar dataKey="tasa_seleccion" name="Seleccionados" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  );
}

// --- Pestaña 3: modelo y perfiles -------------------------------------------------
function ModeloYPerfiles({ d }) {
  const m = d.modelo;
  const mc = m.matriz_confusion;
  const importancia = m.importancia.slice(0, 10).reverse();
  const masProbable = [...d.perfiles].sort((a, b) => b.tasa_seleccion - a.tasa_seleccion);

  return (
    <>
      <div className="stat-row" style={{ marginBottom: 22 }}>
        <StatCard icon={<IconTarget size={20} />} color="teal" value={`${m.metricas.exactitud}%`} label={`Exactitud (sin modelo: ${m.metricas.exactitud_sin_modelo}%)`} />
        <StatCard icon={<IconTrendingUp size={20} />} color="violet" value={m.metricas.auc} label="Área bajo la curva ROC (AUC)" />
        <StatCard icon={<IconUsers size={20} />} color="blue" value={`${m.metricas.precision}%`} label="Precisión: aciertos al decir Sí" />
        <StatCard icon={<IconLayers size={20} />} color="amber" value={`${m.metricas.sensibilidad}%`} label="Sensibilidad: seleccionados detectados" />
      </div>

      <div className="grid-2">
        <ChartCard
          title="Curva ROC del modelo"
          conclusion={`El AUC de ${m.metricas.auc} indica que el modelo distingue bien a quién seleccionan: la línea punteada es lo que lograría adivinar al azar (0,5).`}
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={m.roc}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="tasa_falsos_positivos" type="number" domain={[0, 1]} tick={axisTick(11)} label={{ value: 'Falsos positivos', position: 'insideBottom', offset: -2, fontSize: 11 }} />
              <YAxis dataKey="tasa_verdaderos_positivos" type="number" domain={[0, 1]} tick={axisTick(11)} />
              <Tooltip formatter={(v) => `${Math.round(v * 100)}%`} labelFormatter={(v) => `Falsos positivos: ${Math.round(v * 100)}%`} />
              <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke={CHART_COLORS.axis} strokeDasharray="4 4" />
              <Line dataKey="tasa_verdaderos_positivos" name="Verdaderos positivos" stroke={CHART_COLORS.accent} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="card">
          <h3>Matriz de confusión</h3>
          <p className="muted">Sobre {miles(m.prueba)} postulaciones de prueba que el modelo nunca vio (entrenado con {miles(m.entrenamiento)}).</p>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th></th><th>Predijo Sí</th><th>Predijo No</th></tr></thead>
              <tbody>
                <tr><td><strong>Fue seleccionado</strong></td><td>{miles(mc.vp)} aciertos</td><td>{miles(mc.fn)} no detectados</td></tr>
                <tr><td><strong>No fue seleccionado</strong></td><td>{miles(mc.fp)} falsas alarmas</td><td>{miles(mc.vn)} aciertos</td></tr>
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
            <strong>Interpretación:</strong> acierta en {m.metricas.exactitud} % de los casos. Es prudente: cuando dice
            Sí, acierta el {m.metricas.precision} % de las veces, pero se le escapan algunos seleccionados. Por eso la
            decisión final sigue siendo del reclutador.
          </p>
        </div>
      </div>

      <ChartCard
        title="Qué variables pesan más en la predicción"
        conclusion={`Las barras verdes suben la probabilidad de ser seleccionado; las rojas la bajan. Las tres que más pesan: ${m.importancia.slice(0, 3).map((v) => `${v.variable.toLowerCase()} (${v.peso > 0 ? 'sube' : 'baja'})`).join(', ')}.`}
      >
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={importancia} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis type="number" tick={axisTick(11)} />
            <YAxis type="category" dataKey="variable" tick={axisTick(11)} width={230} />
            <Tooltip />
            <ReferenceLine x={0} stroke={CHART_COLORS.axis} />
            <Bar dataKey="peso" name="Peso en el modelo">
              {importancia.map((v) => <Cell key={v.variable} fill={v.peso >= 0 ? CHART_COLORS.accent : COLOR_NEGATIVO} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="card">
        <h3>Patrones de comportamiento: perfiles de candidato (k-Means)</h3>
        <p className="muted">
          El algoritmo agrupó a los candidatos según edad, experiencia, educación, inglés y certificaciones, sin
          saber a qué perfil pertenecía cada uno.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Perfil</th><th>Postulaciones</th><th>Edad</th><th>Experiencia</th><th>Educación típica</th>
                <th>Inglés típico</th><th>Seleccionados</th><th>Se retiran</th>
              </tr>
            </thead>
            <tbody>
              {d.perfiles.map((p) => (
                <tr key={p.perfil}>
                  <td><strong>{p.perfil}</strong></td>
                  <td>{miles(p.postulaciones)}</td>
                  <td>{p.edad_promedio} años</td>
                  <td>{p.experiencia_promedio} años</td>
                  <td>{p.educacion_frecuente}</td>
                  <td>{p.ingles_frecuente}</td>
                  <td>{p.tasa_seleccion}%</td>
                  <td>{p.tasa_retiro}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
          <strong>Interpretación:</strong> los <strong>{masProbable[0].perfil}</strong> son los más seleccionados
          ({masProbable[0].tasa_seleccion} %) y los de <strong>{masProbable.at(-1).perfil}</strong> los que menos
          ({masProbable.at(-1).tasa_seleccion} %): llegan con experiencia corta para su edad.
        </p>
      </div>
    </>
  );
}

// --- Pestaña 4: predecir un candidato ---------------------------------------------
const OPCIONES = {
  sector: ['Tecnología', 'Retail', 'Salud', 'Finanzas', 'Manufactura', 'Educación', 'Logística'],
  modalidad: ['Remoto', 'Híbrido', 'Presencial'],
  nivel_educativo: ['Bachiller', 'Técnico', 'Tecnólogo', 'Profesional', 'Especialización', 'Maestría'],
  nivel_ingles: ['Ninguno', 'Básico', 'Intermedio', 'Avanzado', 'Nativo'],
};
const EJEMPLOS = {
  fuerte: {
    sector: 'Tecnología', modalidad: 'Remoto', edad: 30, nivel_educativo: 'Profesional', anios_experiencia: 6,
    experiencia_requerida: 3, habilidades_requeridas: 6, habilidades_cumplidas: 6, nivel_ingles: 'Avanzado',
    certificaciones: 4, salario_ofrecido: 6500000, salario_aspirado: 6800000, compatibilidad: 92,
  },
  debil: {
    sector: 'Retail', modalidad: 'Presencial', edad: 45, nivel_educativo: 'Bachiller', anios_experiencia: 1,
    experiencia_requerida: 4, habilidades_requeridas: 5, habilidades_cumplidas: 1, nivel_ingles: 'Básico',
    certificaciones: 0, salario_ofrecido: 3800000, salario_aspirado: 5500000, compatibilidad: 38,
  },
};
const CAMPOS_NUM = [
  ['edad', 'Edad (años)'],
  ['anios_experiencia', 'Años de experiencia'],
  ['experiencia_requerida', 'Experiencia que pide la vacante (años)'],
  ['habilidades_requeridas', 'Habilidades que pide la vacante'],
  ['habilidades_cumplidas', 'Habilidades que cumple'],
  ['certificaciones', 'Certificaciones'],
  ['salario_ofrecido', 'Salario ofrecido (COP)'],
  ['salario_aspirado', 'Salario aspirado (COP)'],
  ['compatibilidad', 'Compatibilidad calculada por SIFCE (0-100)'],
];
const ETIQUETAS_SEL = { sector: 'Sector de la vacante', modalidad: 'Modalidad', nivel_educativo: 'Nivel educativo', nivel_ingles: 'Nivel de inglés' };

function Predecir() {
  const [form, setForm] = useState(EJEMPLOS.fuerte);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const enviar = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      setResultado(await mineriaApi.predecirSeleccion(form));
    } catch (err) {
      setResultado(null);
      setError(err);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="grid-2">
      <form className="card" onSubmit={enviar}>
        <div className="section-title-row">
          <h3>Datos del candidato</h3>
          <div className="row-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setForm(EJEMPLOS.fuerte)}>Ejemplo fuerte</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setForm(EJEMPLOS.debil)}>Ejemplo débil</button>
          </div>
        </div>
        <div className="form-row">
          {Object.entries(ETIQUETAS_SEL).map(([campo, etiqueta]) => (
            <div className="form-group" key={campo}>
              <label className="form-label" htmlFor={campo}>{etiqueta}</label>
              <select id={campo} className="form-control" value={form[campo]} onChange={(e) => cambiar(campo, e.target.value)}>
                {OPCIONES[campo].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="form-row">
          {CAMPOS_NUM.map(([campo, etiqueta]) => (
            <div className="form-group" key={campo}>
              <label className="form-label" htmlFor={campo}>{etiqueta}</label>
              <input id={campo} className="form-control" type="number" step="any" value={form[campo]} onChange={(e) => cambiar(campo, e.target.value)} />
            </div>
          ))}
        </div>
        <button className="btn btn-primary" type="submit" disabled={cargando}>{cargando ? 'Calculando...' : 'Predecir'}</button>
      </form>

      <div className="card">
        <h3>Predicción</h3>
        {error && (
          <Alert type="error">
            {error.message}
            {error.details && <ul style={{ margin: '6px 0 0 18px' }}>{error.details.map((d) => <li key={d}>{d}</li>)}</ul>}
          </Alert>
        )}
        {!resultado && !error && <p className="empty-state">Llena los datos (o carga un ejemplo) y presiona Predecir.</p>}
        {resultado && (
          <>
            <div style={{ textAlign: 'center', margin: '10px 0 18px' }}>
              <div style={{ fontSize: '3rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: resultado.seleccionado === 'Sí' ? 'var(--color-accent)' : 'var(--color-danger)' }}>
                {resultado.probabilidad < 1 ? '< 1%' : `${resultado.probabilidad}%`}
              </div>
              <div className="muted">probabilidad de ser seleccionado</div>
              <span className={`badge ${resultado.seleccionado === 'Sí' ? 'badge-active' : 'badge-inactive'}`} style={{ marginTop: 8, display: 'inline-block' }}>
                Predicción: {resultado.seleccionado === 'Sí' ? 'sería seleccionado' : 'no sería seleccionado'}
              </span>
            </div>
            <div className="grid-2">
              <div>
                <h4 style={{ color: 'var(--color-accent)' }}>Lo que la sube</h4>
                {resultado.suben.length === 0 ? <p className="muted">Nada destacable.</p> : (
                  <ul style={{ paddingLeft: 18, margin: 0 }}>{resultado.suben.map((f) => <li key={f.factor}>{f.factor}</li>)}</ul>
                )}
              </div>
              <div>
                <h4 style={{ color: 'var(--color-danger)' }}>Lo que la baja</h4>
                {resultado.bajan.length === 0 ? <p className="muted">Nada destacable.</p> : (
                  <ul style={{ paddingLeft: 18, margin: 0 }}>{resultado.bajan.map((f) => <li key={f.factor}>{f.factor}</li>)}</ul>
                )}
              </div>
            </div>
            <p className="muted" style={{ marginTop: 16, marginBottom: 0 }}>
              Modelo: {resultado.modelo.tipo}, exactitud {resultado.modelo.exactitud} %, AUC {resultado.modelo.auc}.
              Es una recomendación: la decisión final la toma el reclutador.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// --- Página ---------------------------------------------------------------------
const PESTANAS = [
  ['depuracion', '1. Depuración'],
  ['analisis', '2. Análisis'],
  ['modelo', '3. Modelo y perfiles'],
  ['predecir', '4. Predecir candidato'],
];

export default function DataMiningPage() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [pestana, setPestana] = useState('depuracion');

  useEffect(() => {
    mineriaApi.getMineriaResumen().then(setDatos).catch((e) => setError(e.message));
  }, []);

  if (error) return <Alert type="error">{error}</Alert>;
  if (!datos) return <Loading />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Minería de datos</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            Qué hace que un candidato sea seleccionado: análisis de {miles(datos.depuracion.pasos[0].filas)} postulaciones
            (dataset sintético) y predicción con el modelo entrenado.
          </p>
        </div>
      </div>

      <div className="tabs-row">
        {PESTANAS.map(([clave, texto]) => (
          <button key={clave} type="button" className={`tab-btn ${pestana === clave ? 'active' : ''}`} onClick={() => setPestana(clave)}>
            {texto}
          </button>
        ))}
      </div>

      {pestana === 'depuracion' && <Depuracion d={datos} />}
      {pestana === 'analisis' && <Analisis d={datos} />}
      {pestana === 'modelo' && <ModeloYPerfiles d={datos} />}
      {pestana === 'predecir' && <Predecir />}
    </div>
  );
}
