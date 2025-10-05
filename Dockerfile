# Utiliser l'image officielle de Node.js comme base
FROM node:20-slim

# Créer et définir le répertoire de travail dans le conteneur
WORKDIR /usr/src/app

# Copier les fichiers de dépendances et les installer
# Les fichiers package.json et package-lock.json doivent exister dans le fork
COPY package*.json ./
RUN npm install --omit=dev

# Copier le reste du code de l'application (y compris index.js, opensubtitles.js, configure.html, etc.)
COPY . .

# L'add-on écoute sur le port 7000 par défaut (défini dans index.js)
EXPOSE 7000

# Définir la commande pour lancer l'application
CMD ["node", "index.js"]
