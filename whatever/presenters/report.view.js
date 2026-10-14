// PRESENTADOR (whatever/presenters) — arma el resumen de reportes a partir de las filas de report.model.js.
// Rellena con 0 los estados sin registros para que las gráficas del frontend
// siempre reciban todas las barras.

function summary(data) {
  const byStatus = { draft: 0, active: 0, closed: 0 };
  data.vacancyCounts.forEach((r) => { byStatus[r.status] = r.count; });

  const funnel = { postulado: 0, en_revision: 0, preseleccionado: 0, entrevista: 0, seleccionado: 0, rechazado: 0 };
  data.stageFunnel.forEach((r) => { funnel[r.status] = r.count; });

  return {
    vacancies: {
      total: byStatus.draft + byStatus.active + byStatus.closed,
      byStatus,
    },
    applications: {
      total: data.applicationTotal,
      funnel,
    },
    averageCompatibility: data.avgScore ? Number(data.avgScore) : null,
    topVacancies: data.topVacancies,
    dailyApplications: data.dailySeries,
    recentApplications: data.recentApplications,
  };
}

module.exports = { summary };
