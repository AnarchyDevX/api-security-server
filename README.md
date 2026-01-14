# 🔒 API de Gestion de Sécurité - Admin Panel Roblox

API REST pour gérer la sécurité du panel admin à distance, sans accès à Studio.

## 🚀 Installation

### 1. Prérequis
- Node.js 18+ 
- npm ou yarn
- VPS avec accès SSH

### 2. Installation

```bash
cd api-security-server
npm install
```

### 3. Configuration

```bash
cp .env.example .env
# Éditez .env avec vos paramètres
```

**Important:** Générez un JWT_SECRET fort:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Premier démarrage

```bash
npm start
```

Au premier démarrage, le script va hasher votre mot de passe. Copiez le hash affiché dans `.env` comme `ADMIN_PASSWORD_HASH` et supprimez `ADMIN_PASSWORD`.

## 📡 Endpoints

### Authentification

**POST** `/api/auth/login`
```json
{
  "password": "votre-mot-de-passe"
}
```
Réponse:
```json
{
  "token": "jwt-token-here"
}
```

### Gestion des Place IDs

**GET** `/api/security/places`
Headers: `Authorization: Bearer <token>`
```json
{
  "places": [130305949126944, 123456789]
}
```

**POST** `/api/security/places/add`
```json
{
  "placeId": 123456789
}
```

**POST** `/api/security/places/remove`
```json
{
  "placeId": 123456789
}
```

### Kill Switch

**GET** `/api/security/killswitch`
```json
{
  "enabled": false
}
```

**POST** `/api/security/killswitch`
```json
{
  "enabled": true
}
```

## 🔧 Déploiement sur VPS

### Avec PM2 (recommandé)

```bash
npm install -g pm2
pm2 start server.js --name security-api
pm2 save
pm2 startup  # Suivez les instructions
```

### Avec systemd

Créez `/etc/systemd/system/security-api.service`:

```ini
[Unit]
Description=Security API for Admin Panel
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/api-security-server
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Puis:
```bash
sudo systemctl enable security-api
sudo systemctl start security-api
```

### Avec Nginx (reverse proxy)

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔐 Sécurité

1. **Changez le JWT_SECRET** dans `.env`
2. **Utilisez HTTPS** en production (Let's Encrypt)
3. **Limitez les IPs** autorisées si possible
4. **Surveillez les logs** pour détecter les tentatives d'accès

## 📝 Intégration avec Roblox

Vous devez créer un script Roblox qui:
1. Écoute les requêtes HTTP (via HttpService)
2. Met à jour le DataStore selon les commandes
3. Vérifie l'authentification (token JWT)

Voir `roblox-integration/` pour le script Roblox.

## 🆘 Support

En cas de problème, vérifiez:
- Les logs du serveur
- La configuration `.env`
- Les permissions du DataStore Roblox
