/**
 * Client Roblox pour communiquer avec l'API de sécurité
 *
 * INSTALLATION:
 * 1. Placez ce fichier dans votre projet Roblox
 * 2. Configurez SECURITY_API_URL dans Config.ts ou ici
 * 3. Le script écoute les requêtes HTTP et met à jour le DataStore
 */

import { HttpService, DataStoreService as RobloxDataStoreService } from "@rbxts/services";
import { CONFIG } from "shared/Config";

// ⚠️ CONFIGURATION REQUISE
// Option 1: Avec IP publique (ex: VPS OVH)
const SECURITY_API_URL = "http://51.91.100.208:3000"; // IP de votre VPS OVH

// Option 2: Avec domaine (recommandé si vous avez un domaine)
// const SECURITY_API_URL = "https://api.yourdomain.com";

const SECURITY_API_TOKEN = "your-api-token"; // ⚠️ Token pour authentifier les requêtes depuis l'API
// Ce token doit correspondre à ROBLOX_API_TOKEN dans .env de l'API

const SECURITY_STORE_NAME = `${CONFIG.DATASTORE.NAME}_Security`;
const SECURITY_KEY = "PanelSecurity_AuthorizedPlaces";
const KILL_SWITCH_KEY = "PanelSecurity_KillSwitch";

const httpService = HttpService;
const dataStore = RobloxDataStoreService.GetDataStore(SECURITY_STORE_NAME);

/**
 * Vérifie si la requête est authentifiée
 */
function isAuthenticated(headers: Map<string, string>): boolean {
	const authHeader = headers.get("Authorization");
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return false;
	}

	const token = authHeader.sub(8); // Retirer "Bearer "

	// Vérifier le token (vous pouvez implémenter une vérification JWT plus complexe)
	// Pour l'instant, on utilise un token simple
	return token === SECURITY_API_TOKEN;
}

/**
 * Récupère les Place IDs depuis le DataStore
 */
function getAuthorizedPlaces(): number[] {
	try {
		const [success, result] = pcall(() => {
			return dataStore.GetAsync(SECURITY_KEY);
		});

		if (!success) {
			warn(`[SecurityAPIClient] Erreur lors de la récupération: ${result}`);
			return [];
		}

		let value: unknown;
		if (typeIs(result, "table")) {
			const resultArray = result as Array<unknown>;
			if (resultArray.size() > 0 && resultArray[0] !== undefined) {
				value = resultArray[0];
			} else {
				value = result;
			}
		} else {
			value = result;
		}

		if (typeIs(value, "table")) {
			return value as number[];
		}

		return [];
	} catch (error) {
		warn(`[SecurityAPIClient] Erreur: ${error}`);
		return [];
	}
}

/**
 * Met à jour les Place IDs dans le DataStore
 */
function updateAuthorizedPlaces(places: number[]): boolean {
	try {
		const [success, error] = pcall(() => {
			dataStore.SetAsync(SECURITY_KEY, places);
		});

		if (!success) {
			warn(`[SecurityAPIClient] Erreur lors de la sauvegarde: ${error}`);
			return false;
		}

		print(`[SecurityAPIClient] ✅ Place IDs mis à jour: [${places.join(", ")}]`);
		return true;
	} catch (error) {
		warn(`[SecurityAPIClient] Erreur: ${error}`);
		return false;
	}
}

/**
 * Gère les Place IDs
 */
function handlePlacesRequest(method: string, body: Map<string, unknown>): { success: boolean; data?: unknown } {
	if (method === "GET") {
		const places = getAuthorizedPlaces();
		return { success: true, data: { places } };
	} else if (method === "POST") {
		const action = body.get("action") as string;
		const placeId = body.get("placeId") as number;

		if (!placeId || !typeIs(placeId, "number")) {
			return { success: false, data: { error: "Invalid placeId" } };
		}

		const currentPlaces = getAuthorizedPlaces();

		if (action === "add") {
			if (currentPlaces.includes(placeId)) {
				return { success: true, data: { message: "Place ID already exists" } };
			}
			const updatedPlaces = [...currentPlaces, placeId];
			const success = updateAuthorizedPlaces(updatedPlaces);
			return { success, data: { message: success ? "Place ID added" : "Failed to add" } };
		} else if (action === "remove") {
			const updatedPlaces = currentPlaces.filter((id) => id !== placeId);
			const success = updateAuthorizedPlaces(updatedPlaces);
			return { success, data: { message: success ? "Place ID removed" : "Failed to remove" } };
		}

		return { success: false, data: { error: "Invalid action" } };
	}

	return { success: false, data: { error: "Method not allowed" } };
}

/**
 * Gère le Kill Switch
 */
function handleKillSwitchRequest(method: string, body: Map<string, unknown>): { success: boolean; data?: unknown } {
	if (method === "GET") {
		try {
			const [success, result] = pcall(() => {
				return dataStore.GetAsync(KILL_SWITCH_KEY);
			});

			if (!success) {
				return { success: true, data: { enabled: false } };
			}

			let value: unknown;
			if (typeIs(result, "table")) {
				const resultArray = result as Array<unknown>;
				if (resultArray.size() > 0 && resultArray[0] !== undefined) {
					value = resultArray[0];
				} else {
					value = result;
				}
			} else {
				value = result;
			}

			const enabled = typeIs(value, "boolean") ? (value as boolean) : false;
			return { success: true, data: { enabled } };
		} catch (error) {
			return { success: true, data: { enabled: false } };
		}
	} else if (method === "POST") {
		const enabled = body.get("enabled") as boolean;

		if (!typeIs(enabled, "boolean")) {
			return { success: false, data: { error: "Invalid enabled value" } };
		}

		try {
			const [success, error] = pcall(() => {
				dataStore.SetAsync(KILL_SWITCH_KEY, enabled);
			});

			if (!success) {
				warn(`[SecurityAPIClient] Erreur lors de la sauvegarde du Kill Switch: ${error}`);
				return { success: false, data: { error: "Failed to update" } };
			}

			print(`[SecurityAPIClient] ✅ Kill Switch ${enabled ? "activé" : "désactivé"}`);
			return { success: true, data: { message: `Kill Switch ${enabled ? "activated" : "deactivated"}` } };
		} catch (error) {
			return { success: false, data: { error: tostring(error) } };
		}
	}

	return { success: false, data: { error: "Method not allowed" } };
}

/**
 * Initialise le serveur HTTP
 */
export function initializeSecurityAPIClient(): void {
	print(`[SecurityAPIClient] 🚀 Initialisation du serveur HTTP...`);
	print(`[SecurityAPIClient] URL: ${SECURITY_API_URL}`);

	// Créer un BindableFunction pour recevoir les commandes depuis l'API externe
	// L'API externe appellera ce BindableFunction via HttpService

	// Alternative: Utiliser un script qui écoute les requêtes HTTP
	// Note: Roblox HttpService ne peut pas recevoir de requêtes HTTP directement
	// Il faut utiliser une approche différente:
	// 1. L'API externe envoie des commandes via MessagingService
	// 2. Ou l'API externe stocke les commandes dans un DataStore que ce script lit périodiquement

	// Solution recommandée: Utiliser un DataStore comme queue de commandes
	task.spawn(() => {
		const COMMAND_QUEUE_KEY = "SecurityAPI_CommandQueue";

		while (true) {
			task.wait(5); // Vérifier toutes les 5 secondes

			try {
				const [success, command] = pcall(() => {
					return dataStore.GetAsync(COMMAND_QUEUE_KEY);
				});

				if (!success || !command) continue;

				// Parser la commande
				let cmd: unknown;
				if (typeIs(command, "table")) {
					const resultArray = command as Array<unknown>;
					if (resultArray.size() > 0 && resultArray[0] !== undefined) {
						cmd = resultArray[0];
					} else {
						cmd = command;
					}
				} else {
					cmd = command;
				}

				if (!typeIs(cmd, "table")) continue;

				const commandData = cmd as Map<string, unknown>;
				const action = commandData.get("action") as string;
				const token = commandData.get("token") as string;

				// Vérifier l'authentification
				if (token !== SECURITY_API_TOKEN) {
					warn(`[SecurityAPIClient] Token invalide`);
					continue;
				}

				// Exécuter la commande
				if (action === "addPlace") {
					const placeId = commandData.get("placeId") as number;
					const currentPlaces = getAuthorizedPlaces();
					if (!currentPlaces.includes(placeId)) {
						updateAuthorizedPlaces([...currentPlaces, placeId]);
					}
				} else if (action === "removePlace") {
					const placeId = commandData.get("placeId") as number;
					const currentPlaces = getAuthorizedPlaces();
					updateAuthorizedPlaces(currentPlaces.filter((id) => id !== placeId));
				} else if (action === "setKillSwitch") {
					const enabled = commandData.get("enabled") as boolean;
					pcall(() => {
						dataStore.SetAsync(KILL_SWITCH_KEY, enabled);
					});
				}

				// Effacer la commande après exécution
				pcall(() => {
					dataStore.SetAsync(COMMAND_QUEUE_KEY, undefined);
				});

				print(`[SecurityAPIClient] ✅ Commande "${action}" exécutée`);
			} catch (error) {
				warn(`[SecurityAPIClient] Erreur lors du traitement de la commande: ${error}`);
			}
		}
	});

	print(`[SecurityAPIClient] ✅ Serveur initialisé - En attente de commandes...`);
}

// Démarrer au chargement du script
initializeSecurityAPIClient();
