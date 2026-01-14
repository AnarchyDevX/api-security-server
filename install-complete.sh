#!/bin/bash
# Script d'installation complète - API Security Server
# Usage: bash install-complete.sh (sudo sera demandé automatiquement)

set -e  # Arrêter en cas d'erreur

echo "🚀 Installation complète de l'API Security Server"
echo "=================================================="

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier et demander sudo si nécessaire
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}⚠️  Ce script nécessite des privilèges root${NC}"
    echo -e "${GREEN}🔄 Relance avec sudo...${NC}"
    exec sudo "$0" "$@"
fi

# Variables
INSTALL_DIR="/opt/security-api"
DOMAIN=""  # Laissez vide si pas de domaine
EMAIL=""   # Email pour Let's Encrypt (optionnel)

# Demander le domaine (optionnel)
read -p "Avez-vous un domaine? (laissez vide si non): " DOMAIN

# 1. Mettre à jour le système
echo -e "${GREEN}📦 Mise à jour du système...${NC}"
sudo apt update && sudo apt upgrade -y

# 2. Installer Node.js 18+
echo -e "${GREEN}📦 Installation de Node.js...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
    sudo apt install -y nodejs
fi
echo -e "${GREEN}✅ Node.js $(node --version) installé${NC}"

# 3. Installer Nginx
echo -e "${GREEN}📦 Installation de Nginx...${NC}"
sudo apt install -y nginx

# 4. Installer Certbot (SSL)
echo -e "${GREEN}📦 Installation de Certbot...${NC}"
sudo apt install -y certbot python3-certbot-nginx

# 5. Installer PM2
echo -e "${GREEN}📦 Installation de PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# 6. Cloner le dépôt
echo -e "${GREEN}📦 Clonage du dépôt...${NC}"
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}⚠️  Le dossier existe déjà. Mise à jour...${NC}"
    cd "$INSTALL_DIR"
    git pull origin master
else
    cd /opt
    git clone https://github.com/AnarchyDevX/api-security-server.git security-api
    cd "$INSTALL_DIR"
fi

# 7. Installer les dépendances
echo -e "${GREEN}📦 Installation des dépendances npm...${NC}"
npm install --production

# 8. Créer le fichier .env
echo -e "${GREEN}⚙️  Configuration du fichier .env...${NC}"
if [ ! -f .env ]; then
    cat > .env << 'EOF'
# Port (écoute uniquement sur localhost)
PORT=3000

# Challenge Secret (générer avec: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
CHALLENGE_SECRET=

# JWT Secret (générer avec: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=

# Mot de passe Admin (sera hashé au premier démarrage)
ADMIN_PASSWORD=

# Secrets par Universe (format JSON: {"universeId":"secret-hex-64-chars"})
ROBLOX_UNIVERSE_SECRETS={}

# CORS
ALLOWED_ORIGINS=*
EOF
    echo -e "${YELLOW}⚠️  Fichier .env créé. Configurez-le avant de démarrer!${NC}"
    echo -e "${YELLOW}   nano $INSTALL_DIR/.env${NC}"
else
    echo -e "${GREEN}✅ Fichier .env existe déjà${NC}"
fi

# 9. Générer les secrets si demandé
read -p "Voulez-vous générer des secrets automatiquement? (o/n): " GENERATE_SECRETS
if [ "$GENERATE_SECRETS" = "o" ] || [ "$GENERATE_SECRETS" = "O" ]; then
    echo -e "${GREEN}🔐 Génération des secrets...${NC}"
    CHALLENGE_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    ADMIN_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '') + require('crypto').randomBytes(8).toString('hex'))")
    
    # Mettre à jour .env
    sed -i "s/^CHALLENGE_SECRET=.*/CHALLENGE_SECRET=$CHALLENGE_SECRET/" .env
    sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    sed -i "s/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=$ADMIN_PASSWORD/" .env
    
    echo -e "${GREEN}✅ Secrets générés et ajoutés au .env${NC}"
    echo -e "${YELLOW}⚠️  IMPORTANT: Notez le mot de passe admin: $ADMIN_PASSWORD${NC}"
fi

# 10. Configurer le firewall
echo -e "${GREEN}🔥 Configuration du firewall...${NC}"
sudo ufw --force enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 3000/tcp   # Bloquer le port 3000 publiquement
echo -e "${GREEN}✅ Firewall configuré${NC}"

# 11. Créer la configuration Nginx
echo -e "${GREEN}📝 Configuration de Nginx...${NC}"
NGINX_CONFIG="/etc/nginx/sites-available/security-api"

# Déterminer le server_name
if [ -z "$DOMAIN" ]; then
    # Récupérer l'IP IPv4 (ignorer IPv6)
    SERVER_NAME=$(curl -s -4 ifconfig.me 2>/dev/null || curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{for(i=1;i<=NF;i++) if($i ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/) {print $i; exit}}')
    if [ -z "$SERVER_NAME" ]; then
        SERVER_NAME=$(hostname -I | awk '{print $1}')
    fi
    echo -e "${YELLOW}⚠️  Pas de domaine configuré. Utilisation de l'IP: $SERVER_NAME${NC}"
else
    SERVER_NAME="$DOMAIN"
fi

cat > "$NGINX_CONFIG" << EOF
# Rate limiting
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=challenge_limit:10m rate=5r/m;

# Redirection HTTP → HTTPS
server {
    listen 80;
    server_name $SERVER_NAME;
    
    # Pour Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    return 301 https://\$server_name\$request_uri;
}

# Configuration HTTPS
server {
    listen 443 ssl http2;
    server_name $SERVER_NAME;

    # Certificats SSL (sera configuré par Certbot ou auto-signé)
    ssl_certificate /etc/nginx/ssl/nginx-selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/nginx-selfsigned.key;
    
    # SSL moderne
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Headers de sécurité
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Referrer-Policy "no-referrer" always;

    # Rate limiting challenge (5/min)
    location /api/roblox/challenge {
        limit_req zone=challenge_limit burst=2 nodelay;
        limit_req_status 429;
        
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Rate limiting API (10/s)
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        limit_req_status 429;
        
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000;
        access_log off;
    }

    # Bloquer tout le reste
    location / {
        return 404;
    }
}
EOF

# Activer le site
sudo ln -sf "$NGINX_CONFIG" /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default  # Désactiver le site par défaut

# 12. Configurer SSL
echo -e "${GREEN}🔐 Configuration SSL...${NC}"
sudo mkdir -p /etc/nginx/ssl

if [ -z "$DOMAIN" ]; then
    # Certificat auto-signé
    echo -e "${YELLOW}⚠️  Génération d'un certificat auto-signé...${NC}"
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/nginx-selfsigned.key \
        -out /etc/nginx/ssl/nginx-selfsigned.crt \
        -subj "/CN=$SERVER_NAME" \
        2>/dev/null
    echo -e "${GREEN}✅ Certificat auto-signé créé${NC}"
    echo -e "${YELLOW}⚠️  Les navigateurs afficheront un avertissement (normal pour certificat auto-signé)${NC}"
else
    # Let's Encrypt
    echo -e "${GREEN}🔐 Configuration Let's Encrypt pour $DOMAIN...${NC}"
    if [ -z "$EMAIL" ]; then
        read -p "Email pour Let's Encrypt (optionnel): " EMAIL
    fi
    
    if [ -n "$EMAIL" ]; then
        sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" || {
            echo -e "${YELLOW}⚠️  Échec Let's Encrypt. Utilisation d'un certificat auto-signé...${NC}"
            sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout /etc/nginx/ssl/nginx-selfsigned.key \
                -out /etc/nginx/ssl/nginx-selfsigned.crt \
                -subj "/CN=$DOMAIN" \
                2>/dev/null
        }
    fi
fi

# 13. Tester et redémarrer Nginx
echo -e "${GREEN}🔄 Test de la configuration Nginx...${NC}"
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
echo -e "${GREEN}✅ Nginx configuré et démarré${NC}"

# 14. Modifier server.js pour écouter uniquement sur localhost
echo -e "${GREEN}🔧 Configuration de server.js...${NC}"
cd "$INSTALL_DIR"
sed -i "s/app.listen(PORT, '0.0.0.0'/app.listen(PORT, '127.0.0.1'/" server.js || {
    echo -e "${YELLOW}⚠️  Modification de server.js manuelle nécessaire${NC}"
    echo -e "${YELLOW}   Changez '0.0.0.0' en '127.0.0.1' dans server.js${NC}"
}

# 15. Démarrer avec PM2
echo -e "${GREEN}🚀 Démarrage de l'API avec PM2...${NC}"
cd "$INSTALL_DIR"
pm2 delete security-api 2>/dev/null || true
pm2 start server.js --name security-api
pm2 save

# Configurer le démarrage automatique (méthode plus fiable)
echo -e "${GREEN}⚙️  Configuration du démarrage automatique PM2...${NC}"
STARTUP_CMD=$(pm2 startup systemd -u $USER --hp /root 2>/dev/null | tail -n 1)
if [ -n "$STARTUP_CMD" ]; then
    eval "$STARTUP_CMD" 2>/dev/null || echo -e "${YELLOW}⚠️  Démarrage automatique PM2 à configurer manuellement${NC}"
fi
echo -e "${GREEN}✅ API démarrée avec PM2${NC}"

# 16. Afficher les informations
echo ""
echo -e "${GREEN}=================================================="
echo -e "✅ Installation terminée!"
echo -e "==================================================${NC}"
echo ""
echo -e "${GREEN}📍 Informations:${NC}"
echo -e "   - Dossier: $INSTALL_DIR"
echo -e "   - URL API: https://$SERVER_NAME/api"
echo -e "   - Health: https://$SERVER_NAME/health"
echo ""
echo -e "${YELLOW}⚠️  Actions requises:${NC}"
echo -e "   1. Configurez .env: nano $INSTALL_DIR/.env"
echo -e "   2. Ajoutez votre ROBLOX_UNIVERSE_SECRETS"
echo -e "   3. Redémarrez: pm2 restart security-api"
echo ""
echo -e "${GREEN}📊 Commandes utiles:${NC}"
echo -e "   - Logs: pm2 logs security-api"
echo -e "   - Status: pm2 status"
echo -e "   - Restart: pm2 restart security-api"
echo -e "   - Nginx logs: tail -f /var/log/nginx/error.log"
echo ""
echo -e "${GREEN}🔒 Sécurité:${NC}"
echo -e "   ✅ Port 3000 bloqué publiquement"
echo -e "   ✅ API accessible uniquement via HTTPS"
echo -e "   ✅ Rate limiting configuré"
echo -e "   ✅ Headers de sécurité activés"
echo ""
