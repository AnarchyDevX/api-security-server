# 🖥️ Configuration Spécifique OVH

## 🔧 Configuration du Firewall OVH

### 1. Ouvrir le port dans le firewall OVH

1. Connectez-vous à votre [espace client OVH](https://www.ovh.com/manager/)
2. Allez dans **IP** → **Firewall**
3. Sélectionnez l'IP de votre VPS
4. Ajoutez une règle pour le port **3000** (ou le port que vous utilisez)
   - Protocole: **TCP**
   - Port: **3000**
   - Action: **Autoriser**

### 2. Configuration du firewall sur le VPS

```bash
# Vérifier le statut
sudo ufw status

# Autoriser le port 3000
sudo ufw allow 3000/tcp

# Si vous utilisez Nginx (port 80/443)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Activer le firewall
sudo ufw enable
```

## 🌐 IP publique de votre VPS

**Votre IP:** `51.91.100.208`

Pour vérifier:
```bash
# Depuis le VPS
ifconfig ens3 | grep inet
# ou
curl ifconfig.me
```

## 🔒 Configuration de sécurité

### Option 1: Accès direct par IP (simple mais moins sécurisé)

```bash
# Dans .env
PORT=3000

# L'API sera accessible sur http://VOTRE_IP:3000
```

**⚠️ Attention:** Utilisez HTTPS si possible, ou au minimum un firewall qui limite les IPs autorisées.

### Option 2: Avec domaine et Nginx (recommandé)

1. **Configurer un sous-domaine** (ex: `api.votredomaine.com`)
   - Dans votre DNS, créez un enregistrement A pointant vers l'IP du VPS

2. **Installer Nginx** (voir DEPLOYMENT.md)

3. **Configurer SSL** avec Let's Encrypt

4. **L'API sera accessible sur** `https://api.votredomaine.com`

## 📝 Configuration dans Roblox

Dans `roblox-integration/SecurityAPIClient.ts`, configurez:

```typescript
// Option 1: Avec IP
const SECURITY_API_URL = "http://VOTRE_IP_VPS:3000";

// Option 2: Avec domaine
const SECURITY_API_URL = "https://api.votredomaine.com";
```

## 🧪 Test de connectivité

### Depuis votre machine locale

```bash
# Test de connexion
curl http://VOTRE_IP_VPS:3000/health

# Devrait retourner:
# {"status":"ok","timestamp":"2024-..."}
```

### Depuis le VPS

```bash
# Test local
curl http://localhost:3000/health
```

## 🚨 Dépannage

### L'API ne répond pas depuis l'extérieur

1. **Vérifier que le service tourne:**
   ```bash
   pm2 status
   # ou
   sudo systemctl status security-api
   ```

2. **Vérifier le firewall:**
   ```bash
   sudo ufw status
   ```

3. **Vérifier le firewall OVH:**
   - Espace client OVH → IP → Firewall
   - Assurez-vous que le port est ouvert

4. **Vérifier que l'API écoute sur 0.0.0.0:**
   ```bash
   netstat -tlnp | grep 3000
   # Devrait afficher: 0.0.0.0:3000
   ```

### Erreur "Connection refused"

- Le port n'est pas ouvert dans le firewall OVH
- Le firewall du VPS bloque le port
- Le service n'écoute pas sur 0.0.0.0

### Erreur "Timeout"

- Le port est bloqué par le firewall OVH
- Le service n'est pas démarré
- Mauvaise IP

## 🔐 Sécurité renforcée (optionnel)

### Limiter l'accès par IP

Dans Nginx, vous pouvez limiter l'accès:

```nginx
location /api {
    # Autoriser uniquement certaines IPs
    allow 192.168.1.0/24;
    allow YOUR_IP;
    deny all;
    
    proxy_pass http://localhost:3000;
}
```

### Utiliser un VPN

Pour plus de sécurité, vous pouvez:
1. Configurer un VPN sur votre VPS
2. Limiter l'accès à l'API uniquement via le VPN
3. Accéder à l'API depuis votre machine via le VPN

## 📞 Support OVH

Si vous avez des problèmes avec le firewall OVH:
- Documentation: https://docs.ovh.com/
- Support: https://www.ovh.com/fr/support/
