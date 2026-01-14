#!/bin/bash
# Script simple pour ajouter une place autorisée
# Demande le mot de passe admin interactivement

cd /opt/security-api

# Place ID (premier argument ou valeur par défaut)
PLACE_ID=${1:-130305949126944}

echo "➕ Ajout de la place $PLACE_ID à la liste des places autorisées"
echo ""
read -sp "Entrez le mot de passe admin: " PASSWORD
echo ""

# Se connecter et obtenir le token
echo "🔐 Connexion à l'API..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$PASSWORD\"}")

# Vérifier si le login a réussi
if echo "$LOGIN_RESPONSE" | grep -q '"token"'; then
    TOKEN=$(echo "$LOGIN_RESPONSE" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
    echo "✅ Connexion réussie"
    echo ""
    
    # Ajouter la place
    echo "➕ Ajout de la place $PLACE_ID..."
    ADD_RESPONSE=$(curl -s -X POST http://localhost:3000/api/security/places/add \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"placeId\":$PLACE_ID}")
    
    if echo "$ADD_RESPONSE" | grep -q "success\|added"; then
        echo "✅ Place $PLACE_ID ajoutée avec succès!"
        echo "Réponse: $ADD_RESPONSE"
    else
        echo "❌ Erreur lors de l'ajout"
        echo "Réponse: $ADD_RESPONSE"
    fi
else
    echo "❌ Échec de la connexion - Mot de passe incorrect"
    echo "Réponse: $LOGIN_RESPONSE"
    exit 1
fi
