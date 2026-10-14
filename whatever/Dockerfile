# =====================================================================
# Imagen "sifce-api": la API (whatever/) con sus modelos (model/).
# Ciclo de vida, etapa 6 · DEPLOY. Se construye desde la raíz del proyecto:
#   docker build -f whatever/Dockerfile -t sifce-api:1.0.0 .
# =====================================================================
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# 1) Dependencias primero (Docker las reutiliza en caché si no cambian).
#    Los workspaces exigen que existan los tres package.json.
COPY package.json package-lock.json ./
COPY model/package.json model/
COPY whatever/package.json whatever/
COPY view/package.json view/
RUN npm ci --omit=dev -w model -w whatever --no-audit --no-fund && npm cache clean --force

# 2) Código de la API y de los modelos.
COPY model model
COPY whatever whatever

# Carpeta de hojas de vida (en el stack se monta un volumen persistente aquí).
# Se prepara con dueño "node" para que el volumen nazca con esos permisos.
RUN mkdir -p /data/uploads/resumes && chown -R node:node /data
ENV RESUME_UPLOAD_DIR=/data/uploads/resumes

# La API no corre como root dentro del contenedor.
USER node

EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health >/dev/null || exit 1

CMD ["node", "whatever/server.js"]
