/**
 * Gestion de la sécurité via Roblox DataStore
 * Utilise HttpService pour communiquer avec Roblox
 */

export class SecurityAPI {
    constructor() {
        this.robloxClient = new RobloxDataStoreClient();
    }

    /**
     * Récupère les Place IDs autorisés
     * NOTE: Nécessite que le script Roblox expose cette info via un DataStore
     */
    async getAuthorizedPlaces() {
        // Pour l'instant, on retourne un tableau vide
        // Vous pouvez implémenter une méthode pour lire depuis un DataStore partagé
        // ou utiliser l'API Roblox DataStore directement
        return [];
    }

    /**
     * Ajoute un Place ID
     */
    async addPlace(placeId) {
        return await this.robloxClient.addPlace(placeId);
    }

    /**
     * Retire un Place ID
     */
    async removePlace(placeId) {
        return await this.robloxClient.removePlace(placeId);
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
