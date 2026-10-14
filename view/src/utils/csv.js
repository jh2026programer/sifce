// Genera y descarga un CSV a partir de un arreglo de objetos planos.
// No requiere ninguna librería adicional: suficiente para "generar reportes"
// descargables sin necesidad de un backend de generación de archivos.
export function downloadCsv(filename, rows) {
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ];

  const csvContent = '\uFEFF' + lines.join('\n'); // BOM para que Excel abra bien los acentos
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
