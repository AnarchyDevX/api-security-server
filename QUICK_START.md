# ⚡ Démarrage Rapide

## Installation en 5 minutes

```bash
# 1. Installer les dépendances
cd api-security-server
npm install

# 2. Configurer
cp .env.example .env
# Éditez .env avec vos paramètres

# 3. Démarrer
npm start
```

## Configuration minimale

Dans `.env`:
```
PORT=3000
JWT_SECRET=votre-clé-secrète-forte
ADMIN_PASSWORD=votre-mot-de-passe
```

## Test rapide

### Sur le VPS (localhost)

```bash
# Connexion
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"votre-mot-de-passe"}'
```

### Depuis l'extérieur (IP publique ou domaine)

```bash
# Trouvez l'IP de votre VPS
curl ifconfig.me

# Connexion avec IP
curl -X POST http://VOTRE_IP_VPS:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"votre-mot-de-passe"}'

# Ou avec domaine (si configuré)
curl -X POST https://api.yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"votre-mot-de-passe"}'
```

**Important:** Assurez-vous que le port 3000 est ouvert dans le firewall OVH.

## Intégration Roblox

1. Copiez `roblox-integration/SecurityAPIClient.ts` dans votre projet Roblox
2. Configurez `SECURITY_API_URL` et `SECURITY_API_TOKEN` dans le fichier
3. Le script écoutera les commandes depuis l'API

## Déploiement VPS

Voir `DEPLOYMENT.md` pour les instructions complètes.
