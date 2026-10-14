# =====================================================================
# Imagen "sifce-web": la interfaz (view/) compilada y servida con nginx.
# Ciclo de vida, etapa 6 · DEPLOY. Se construye desde la raíz del proyecto:
#   docker build -f view/Dockerfile -t sifce-web:1.0.0 .
# =====================================================================

# --- Etapa 1: compilar React + Vite -----------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY model/package.json model/
COPY whatever/package.json whatever/
COPY view/package.json view/
RUN npm ci -w view --no-audit --no-fund

COPY view view
# Ruta relativa: el navegador llama a /api/v1 en el mismo sitio y nginx lo
# reenvía a la API. Mismo origen = sin problemas de CORS.
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w view

# --- Etapa 2: servir los archivos estáticos ---------------------------
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/view/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
