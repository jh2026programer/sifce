// VIEW — colores de las gráficas (Recharts). Recharts recibe los colores
// como atributos SVG, que no entienden variables CSS (var(--x)); por eso se
// repiten aquí los mismos valores de la paleta de index.css.
export const CHART_COLORS = {
  primary: '#b4530c', // cobre
  accent: '#0e7c72', // verde azulado
  axis: '#6f6457',
  grid: '#e8e0d4',
};

export const axisTick = (fontSize = 11) => ({ fontSize, fill: CHART_COLORS.axis });
