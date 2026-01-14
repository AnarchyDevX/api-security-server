# Commandes d'installation VPS

# 1. Aller dans /opt
cd /opt

# 2. Cloner le dépôt
sudo git clone https://github.com/AnarchyDevX/api-security-server.git security-api

# 3. Aller dans le dossier
cd security-api

# 4. Installer les dépendances
npm install --production

# 5. Configurer .env
cp .env.example .env
nano .env

# 6. Démarrer avec PM2
pm2 start server.js --name security-api

# 7. Sauvegarder la configuration PM2
pm2 save

# 8. Configurer le démarrage automatique
pm2 startup
