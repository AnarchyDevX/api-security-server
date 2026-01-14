/**
 * Gestion de la sécurité via Roblox DataStore
 * Utilise HttpService pour communiquer avec Roblox
 */

import { RobloxDataStoreClient } from './RobloxDataStoreClient.js';
import { PlacesStorage } from './PlacesStorage.js';

export class SecurityAPI {
    constructor() {
        this.robloxClient = new RobloxDataStoreClient();
        this.placesStorage = new PlacesStorage();
    }

    /**
     * Récupère les Place IDs autorisés
     */
    async getAuthorizedPlaces() {
        return await this.placesStorage.getPlaces();
    }

    /**
     * Ajoute un Place ID
     */
    async addPlace(placeId) {
        // Ajouter dans le stockage local
        await this.placesStorage.addPlace(placeId);
        // Envoyer la commande à Roblox (optionnel)
        await this.robloxClient.addPlace(placeId);
        return true;
    }

    /**
     * Ajoute un Place ID (alias pour compatibilité)
     */
    async addAuthorizedPlace(placeId) {
        return await this.addPlace(placeId);
    }

    /**
     * Retire un Place ID
     */
    async removePlace(placeId) {
        // Retirer du stockage local
        const removed = await this.placesStorage.removePlace(placeId);
        // Envoyer la commande à Roblox (optionnel)
        if (removed) {
            await this.robloxClient.removePlace(placeId);
        }
        return removed;
    }

    /**
     * Récupère l'état du Kill Switch
     */
    async getKillSwitch() {
        // TODO: Implémenter la lecture depuis Roblox
        return false;
    }

    /**
     * Active/Désactive le Kill Switch
     */
    async setKillSwitch(enabled) {
        return await this.robloxClient.setKillSwitch(enabled);
    }
}
