#!/bin/bash
# Installation rapide - Télécharge et exécute le script complet

set -e

echo "📥 Téléchargement du script d'installation..."
curl -fsSL https://raw.githubusercontent.com/AnarchyDevX/api-security-server/master/install-complete.sh -o /tmp/install-api.sh
chmod +x /tmp/install-api.sh
echo "✅ Script téléchargé"
echo "🚀 Exécution..."
bash /tmp/install-api.sh
