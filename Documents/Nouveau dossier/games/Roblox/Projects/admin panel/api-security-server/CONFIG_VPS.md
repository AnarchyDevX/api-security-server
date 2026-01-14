# ✅ Configuration pour votre VPS OVH

## 📍 Informations de votre serveur

- **IP Publique:** `51.91.100.208`
- **Interface:** `ens3`
- **URL API:** `http://51.91.100.208:3000`

## 🔧 Configuration rapide

### 1. Dans `roblox-integration/SecurityAPIClient.ts`

```typescript
const SECURITY_API_URL = "http://51.91.100.208:3000";
const SECURITY_API_TOKEN = "votre-token-securise"; // Générez un token fort
```

### 2. Ouvrir le port 3000 dans le firewall

```bash
# Sur le VPS
sudo ufw allow 3000/tcp
sudo ufw status
```

### 3. Dans l'espace client OVH

1. Allez sur https://www.ovh.com/manager/
2. **IP** → **Firewall**
3. Sélectionnez l'IP `51.91.100.208`
4. Ajoutez une règle:
   - **Protocole:** TCP
   - **Port:** 3000
   - **Action:** Autoriser

### 4. Tester la connexion

```bash
# Depuis votre machine locale
curl http://51.91.100.208:3000/health

# Devrait retourner:
# {"status":"ok","timestamp":"2024-..."}
```

### 5. Test de connexion API

```bash
# Connexion
curl -X POST http://51.91.100.208:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"votre-mot-de-passe"}'
```

## 🔐 Sécurité recommandée

### Option 1: Limiter l'accès par IP (dans Nginx)

Si vous configurez Nginx, vous pouvez limiter l'accès:

```nginx
location /api {
    # Autoriser uniquement votre IP
    allow VOTRE_IP_PERSONNELLE;
    deny all;
    
    proxy_pass http://localhost:3000;
}
```

### Option 2: Utiliser HTTPS (avec domaine)

1. Configurez un sous-domaine (ex: `api.votredomaine.com`) pointant vers `51.91.100.208`
2. Installez Nginx + Let's Encrypt
3. L'API sera accessible sur `https://api.votredomaine.com`

## 📝 Commandes utiles

```bash
# Vérifier que l'API écoute sur toutes les interfaces
netstat -tlnp | grep 3000
# Devrait afficher: 0.0.0.0:3000

# Voir les logs PM2
pm2 logs security-api

# Redémarrer l'API
pm2 restart security-api
```

## 🆘 Dépannage

### L'API ne répond pas depuis l'extérieur

1. Vérifier que le service tourne:
   ```bash
   pm2 status
   ```

2. Vérifier le firewall local:
   ```bash
   sudo ufw status
   ```

3. Vérifier le firewall OVH (espace client)

4. Tester depuis le VPS:
   ```bash
   curl http://localhost:3000/health
   ```

### Erreur "Connection refused"

- Le port 3000 n'est pas ouvert dans le firewall OVH
- Le firewall local bloque le port
- Le service n'écoute pas sur 0.0.0.0
