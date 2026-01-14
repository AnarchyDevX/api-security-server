/**
 * Stockage local des places autorisées
 * Utilise un fichier JSON pour persister les données
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Utiliser un chemin absolu basé sur le répertoire de travail ou le répertoire du projet
const PROJECT_ROOT = process.cwd();
const STORAGE_FILE = path.join(PROJECT_ROOT, 'data/authorized-places.json');

export class PlacesStorage {
    constructor() {
        this.places = new Set();
        this.initialized = false;
    }

    /**
     * Initialise le stockage (charge depuis le fichier)
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // Créer le dossier data s'il n'existe pas
            const dataDir = path.dirname(STORAGE_FILE);
            await fs.mkdir(dataDir, { recursive: true });

            // Charger depuis le fichier
            try {
                const data = await fs.readFile(STORAGE_FILE, 'utf-8');
                const places = JSON.parse(data);
                this.places = new Set(places);
                console.log(`[PlacesStorage] Loaded ${this.places.size} authorized places`);
            } catch (error) {
                // Fichier n'existe pas encore, créer avec tableau vide
                await this.save();
                console.log('[PlacesStorage] Created new storage file');
            }
        } catch (error) {
            console.error('[PlacesStorage] Error initializing:', error);
        }

        this.initialized = true;
    }

    /**
     * Sauvegarde les places dans le fichier
     */
    async save() {
        try {
            const data = JSON.stringify(Array.from(this.places), null, 2);
            await fs.writeFile(STORAGE_FILE, data, 'utf-8');
        } catch (error) {
            console.error('[PlacesStorage] Error saving:', error);
            throw error;
        }
    }

    /**
     * Récupère toutes les places autorisées
     */
    async getPlaces() {
        await this.initialize();
        return Array.from(this.places);
    }

    /**
     * Ajoute une place
     */
    async addPlace(placeId) {
        await this.initialize();
        this.places.add(placeId);
        await this.save();
        console.log(`[PlacesStorage] Added place ${placeId}`);
        return true;
    }

    /**
     * Retire une place
     */
    async removePlace(placeId) {
        await this.initialize();
        const removed = this.places.delete(placeId);
        if (removed) {
            await this.save();
            console.log(`[PlacesStorage] Removed place ${placeId}`);
        }
        return removed;
    }

    /**
     * Vérifie si une place est autorisée
     */
    async isPlaceAuthorized(placeId) {
        await this.initialize();
        return this.places.has(placeId);
    }
}
