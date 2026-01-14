#!/bin/bash
# Script pour ajouter une place autorisée via l'API
# Lit automatiquement le mot de passe depuis .env

cd /opt/security-api

# Lire le mot de passe depuis .env
if [ -f .env ]; then
    # Essayer d'abord ADMIN_PASSWORD_HASH (si configuré)
    ADMIN_PASSWORD_HASH=$(grep "^ADMIN_PASSWORD_HASH=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    ADMIN_PASSWORD=$(grep "^ADMIN_PASSWORD=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    
    if [ -n "$ADMIN_PASSWORD_HASH" ]; then
        echo "⚠️  ADMIN_PASSWORD_HASH est configuré. Vous devez utiliser le mot de passe original (pas le hash)."
        echo "Si vous avez oublié le mot de passe, vous devez le réinitialiser."
        read -sp "Entrez le mot de passe admin: " PASSWORD
        echo
    elif [ -n "$ADMIN_PASSWORD" ]; then
        PASSWORD="$ADMIN_PASSWORD"
        echo "✅ Mot de passe trouvé dans .env"
    else
        echo "❌ Aucun mot de passe trouvé dans .env"
        read -sp "Entrez le mot de passe admin: " PASSWORD
        echo
    fi
else
    echo "❌ Fichier .env non trouvé"
    read -sp "Entrez le mot de passe admin: " PASSWORD
    echo
fi

# Obtenir le token
echo "🔐 Connexion à l'API..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$PASSWORD\"}")

# Vérifier si le login a réussi
if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    TOKEN=$(echo "$LOGIN_RESPONSE" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
    echo "✅ Connexion réussie"
    
    # Place ID à ajouter (premier argument ou valeur par défaut)
    PLACE_ID=${1:-130305949126944}
    
    echo "➕ Ajout de la place $PLACE_ID..."
    ADD_RESPONSE=$(curl -s -X POST http://localhost:3000/api/security/places/add \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"placeId\":$PLACE_ID}")
    
    echo "$ADD_RESPONSE"
    
    if echo "$ADD_RESPONSE" | grep -q "success\|added"; then
        echo "✅ Place $PLACE_ID ajoutée avec succès!"
    else
        echo "❌ Erreur lors de l'ajout de la place"
        echo "Réponse: $ADD_RESPONSE"
    fi
else
    echo "❌ Échec de la connexion"
    echo "Réponse: $LOGIN_RESPONSE"
    exit 1
fi
