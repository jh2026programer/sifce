// Arranca los dos microservicios a la vez, cada uno en su propio proceso de
// Node.js (no en Docker). Uso, desde la raíz del proyecto:
//   npm run microservicios
// Ctrl + C detiene ambos.
const { spawn } = require('child_process');
const path = require('path');

const servicios = ['compatibilidad', 'validador-cv'];

const procesos = servicios.map((nombre) =>
  spawn(process.execPath, [path.join(__dirname, nombre, 'server.js')], { stdio: 'inherit' })
);

procesos.forEach((proc, i) => {
  proc.on('exit', (codigo) => {
    console.log(`[${servicios[i]}] se detuvo (código ${codigo}).`);
  });
});

function detenerTodo() {
  procesos.forEach((proc) => proc.kill());
  process.exit(0);
}
process.on('SIGINT', detenerTodo);
process.on('SIGTERM', detenerTodo);
