# Dockerfile
FROM node:20-slim

# Installer chromium + dépendances nécessaires pour Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

# Dire à Puppeteer de NE PAS retélécharger Chromium (on utilisera l'exécutable système)
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

# Copier les fichiers package pour installer les dépendances en couche
COPY package*.json ./

# Installer deps (utilise package-lock pour reproductibilité)
RUN npm ci --only=production

# Copier le reste du code
COPY . .

# Exposer le port (ton server.js écoute process.env.PORT || 10000)
EXPOSE 10000

# Commande de démarrage
CMD ["npm", "start"]
