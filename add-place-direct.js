#!/usr/bin/env node
/**
 * Script pour ajouter une place autorisée directement
 * Utilise l'API interne sans passer par HTTP
 */

import dotenv from 'dotenv';
dotenv.config();

import { SecurityAPI } from './src/SecurityAPI.js';

const placeId = process.argv[2] ? Number(process.argv[2]) : 130305949126944;

if (!placeId || isNaN(placeId) || placeId <= 0) {
    console.error('❌ Place ID invalide');
    console.log('Usage: node add-place-direct.js <placeId>');
    process.exit(1);
}

console.log(`➕ Ajout de la place ${placeId}...`);

try {
    const securityAPI = new SecurityAPI();
    const success = await securityAPI.addPlace(placeId);
    
    if (success) {
        console.log(`✅ Place ${placeId} ajoutée avec succès!`);
        
        // Afficher la liste actuelle
        const places = await securityAPI.getAuthorizedPlaces();
        console.log(`📋 Places autorisées: [${places.join(', ')}]`);
    } else {
        console.error(`❌ Erreur lors de l'ajout de la place ${placeId}`);
        process.exit(1);
    }
} catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
}
