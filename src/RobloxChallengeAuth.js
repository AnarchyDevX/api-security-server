/**
 * Middleware d'authentification Roblox via Challenge Serveur
 * 
 * Flow:
 * 1. Roblox demande un challenge (POST /api/roblox/challenge)
 * 2. Serveur génère un challenge signé (TTL 10s)
 * 3. Roblox utilise le challenge pour authentifier la requête
 * 4. Serveur vérifie et consomme le challenge (one-time use)
 * 
 * ✅ Aucun secret côté Roblox
 * ✅ Impossible à spoof
 * ✅ Non rejouable
 */

import { ChallengeController } from './ChallengeController.js';

export class RobloxChallengeAuth {
    constructor() {
        this.challengeController = new ChallengeController();
    }

    /**
     * Endpoint pour demander un challenge
     */
    requestChallenge(req, res) {
        try {
            const universeId = Number(req.body.universeId);
            const placeId = Number(req.body.placeId);

            // Validation
            if (!universeId || !placeId || !Number.isInteger(universeId) || !Number.isInteger(placeId)) {
                return res.status(400).json({ error: 'Invalid universeId or placeId' });
            }

            if (universeId <= 0 || placeId <= 0) {
                return res.status(400).json({ error: 'Invalid Roblox IDs' });
            }

            // Créer le challenge
            const challenge = this.challengeController.createChallenge(universeId, placeId);
            
            if (!challenge) {
                return res.status(403).json({ error: 'Unauthorized universe' });
            }

            // Retourner le challenge (sans révéler le secret)
            res.json({
                challengeToken: challenge.token,
                signature: challenge.signature,
                expiresIn: this.challengeController.CHALLENGE_TTL_MS / 1000 // secondes
            });

        } catch (error) {
            console.error('[RobloxChallengeAuth] Error creating challenge:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Middleware pour vérifier une requête avec challenge
     */
    verifyChallengeRequest(req, res, next) {
        try {
            // Extraire les headers
            const challengeToken = req.headers['x-roblox-challenge-token'];
            const challengeSignature = req.headers['x-roblox-challenge-signature'];
            const universeId = Number(req.headers['x-roblox-universe-id']);
            const placeId = Number(req.headers['x-roblox-place-id']);

            // Validation des headers
            if (!challengeToken || !challengeSignature || !universeId || !placeId) {
                this.logSecurityEvent(req, 'MISSING_CHALLENGE_HEADERS');
                return res.status(401).json({ error: 'Missing required challenge headers' });
            }

            // Validation des types
            if (!Number.isInteger(universeId) || !Number.isInteger(placeId) ||
                typeof challengeToken !== 'string' || typeof challengeSignature !== 'string') {
                this.logSecurityEvent(req, 'INVALID_CHALLENGE_HEADER_TYPES');
                return res.status(400).json({ error: 'Invalid header types' });
            }

            // Validation de format Roblox
            if (universeId <= 0 || placeId <= 0) {
                this.logSecurityEvent(req, 'INVALID_ROBLOX_IDS', { universeId, placeId });
                return res.status(400).json({ error: 'Invalid Roblox IDs' });
            }

            // Vérifier et consommer le challenge
            const verification = this.challengeController.verifyAndConsumeChallenge(
                challengeToken,
                challengeSignature,
                universeId,
                placeId
            );

            if (!verification.valid) {
                this.logSecurityEvent(req, 'INVALID_CHALLENGE', { 
                    reason: verification.reason,
                    universeId,
                    placeId
                });
                return res.status(401).json({ error: 'Invalid or expired challenge', reason: verification.reason });
            }

            // Ajouter les infos au request
            req.roblox = {
                universeId: verification.universeId,
                placeId: verification.placeId,
                challengeToken
            };

            // ✅ Requête valide
            next();

        } catch (error) {
            console.error('[RobloxChallengeAuth] Error:', error);
            this.logSecurityEvent(req, 'AUTH_ERROR', { error: String(error) });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Log les événements de sécurité
     */
    logSecurityEvent(req, event, data = {}) {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const log = {
            timestamp: new Date().toISOString(),
            event,
            ip,
            path: req.path,
            method: req.method,
            ...data
        };
        console.warn(`[SECURITY] ${JSON.stringify(log)}`);
    }
}
