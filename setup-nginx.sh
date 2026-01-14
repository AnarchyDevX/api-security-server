#!/bin/bash
# Script d'installation Nginx + SSL pour API Security Server

echo "🔒 Configuration Nginx + HTTPS pour API Security Server"

# 1. Installer Nginx
echo "📦 Installation de Nginx..."
sudo apt update
sudo apt install -y nginx

# 2. Installer Certbot (SSL gratuit)
echo "📦 Installation de Certbot..."
sudo apt install -y certbot python3-certbot-nginx

# 3. Configurer le firewall
echo "🔥 Configuration du firewall..."
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (pour Let's Encrypt)
sudo ufw allow 443/tcp   # HTTPS
# ⚠️ NE PAS ouvrir le port 3000 publiquement
sudo ufw enable

# 4. Copier la configuration
echo "📝 Configuration Nginx..."
sudo cp nginx-config.conf /etc/nginx/sites-available/security-api

# 5. Activer le site
sudo ln -s /etc/nginx/sites-available/security-api /etc/nginx/sites-enabled/

# 6. Tester la configuration
sudo nginx -t

# 7. Si vous avez un domaine, obtenir le certificat SSL
echo "🔐 Configuration SSL..."
echo "Si vous avez un domaine, exécutez:"
echo "sudo certbot --nginx -d api.votredomaine.com"
echo ""
echo "Si vous n'avez PAS de domaine, vous devrez utiliser un certificat auto-signé"
echo "ou un service comme Cloudflare Tunnel"

# 8. Redémarrer Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx

echo "✅ Nginx configuré!"
echo "⚠️  IMPORTANT: Le port 3000 n'est plus accessible publiquement"
echo "⚠️  L'API est maintenant accessible uniquement via HTTPS sur le port 443"
