/**
 * Système de Challenge Serveur - Zero-Trust Roblox
 * 
 * Remplace l'HMAC côté Roblox par un challenge signé serveur uniquement
 * Aucun secret côté Roblox = impossible à spoof
 */

import crypto from 'crypto';

export class ChallengeController {
    constructor() {
        this.challenges = new Map(); // challengeToken -> { universeId, placeId, expiresAt }
        this.CHALLENGE_TTL_MS = 30 * 1000; // 30 secondes (augmenté pour gérer les délais réseau)
        this.CHALLENGE_SECRET = process.env.CHALLENGE_SECRET || this.generateSecret();
        
        // Nettoyer les challenges expirés toutes les 30 secondes
        setInterval(() => this.cleanExpiredChallenges(), 30 * 1000);
        
        console.log('[ChallengeController] Initialized with challenge-based auth');
    }

    /**
     * Génère un secret pour signer les challenges
     */
    generateSecret() {
        const secret = crypto.randomBytes(32).toString('hex');
        console.warn('[ChallengeController] Generated new CHALLENGE_SECRET (add to .env):', secret);
        return secret;
    }

    /**
     * Crée un challenge pour un universe/place
     */
    createChallenge(universeId, placeId) {
        // Vérifier que l'universe est autorisé
        const universeSecrets = this.getUniverseSecrets();
        if (!universeSecrets.has(universeId)) {
            return null;
        }

        // Générer un token unique
        const challengeToken = crypto.randomBytes(32).toString('hex');
        
        // Créer le challenge signé
        const challengeData = {
            universeId,
            placeId,
            timestamp: Date.now(),
            nonce: challengeToken
        };
        
        const message = `${universeId}|${placeId}|${challengeData.timestamp}|${challengeToken}`;
        const signature = crypto
            .createHmac('sha256', this.CHALLENGE_SECRET)
            .update(message)
            .digest('hex');
        
        const signedChallenge = {
            token: challengeToken,
            signature,
            expiresAt: Date.now() + this.CHALLENGE_TTL_MS
        };
        
        // Stocker le challenge (avec le timestamp original pour la vérification)
        this.challenges.set(challengeToken, {
            universeId,
            placeId,
            timestamp: challengeData.timestamp, // Timestamp original utilisé dans la signature
            expiresAt: signedChallenge.expiresAt,
            used: false
        });
        
        console.log(`[ChallengeController] Challenge créé: ${challengeToken.substring(0, 8)}... pour universe ${universeId}, place ${placeId}. Cache size: ${this.challenges.size}`);
        
        return signedChallenge;
    }

    /**
     * Vérifie et consomme un challenge
     */
    verifyAndConsumeChallenge(challengeToken, providedSignature, universeId, placeId) {
        console.log(`[ChallengeController] Vérification challenge: ${challengeToken.substring(0, 8)}... pour universe ${universeId}, place ${placeId}. Cache size: ${this.challenges.size}`);
        console.log(`[ChallengeController] Challenges dans le cache:`, Array.from(this.challenges.keys()).map(k => k.substring(0, 8) + '...'));
        
        // Vérifier que le challenge existe
        const challenge = this.challenges.get(challengeToken);
        if (!challenge) {
            console.warn(`[ChallengeController] Challenge not found: ${challengeToken.substring(0, 8)}...`);
            return { valid: false, reason: 'CHALLENGE_NOT_FOUND' };
        }
        
        // Vérifier qu'il n'a pas été utilisé (marquer immédiatement pour éviter les conditions de course)
        if (challenge.used) {
            console.warn(`[ChallengeController] Challenge already used: ${challengeToken.substring(0, 8)}...`);
            return { valid: false, reason: 'CHALLENGE_ALREADY_USED' };
        }
        
        // Marquer comme utilisé IMMÉDIATEMENT pour éviter les conditions de course
        challenge.used = true;
        
        // Vérifier qu'il n'est pas expiré
        const now = Date.now();
        if (now > challenge.expiresAt) {
            console.warn(`[ChallengeController] Challenge expired: ${challengeToken.substring(0, 8)}... (now: ${now}, expires: ${challenge.expiresAt})`);
            this.challenges.delete(challengeToken);
            return { valid: false, reason: 'CHALLENGE_EXPIRED' };
        }
        
        // Vérifier que l'universeId correspond
        if (challenge.universeId !== universeId) {
            console.warn(`[ChallengeController] Universe mismatch: expected ${challenge.universeId}, got ${universeId}`);
            this.challenges.delete(challengeToken);
            return { valid: false, reason: 'UNIVERSE_MISMATCH' };
        }
        
        // Vérifier que le placeId correspond
        if (challenge.placeId !== placeId) {
            console.warn(`[ChallengeController] Place mismatch: expected ${challenge.placeId}, got ${placeId}`);
            this.challenges.delete(challengeToken);
            return { valid: false, reason: 'PLACE_MISMATCH' };
        }
        
        // Vérifier la signature (utiliser le timestamp original stocké)
        const message = `${challenge.universeId}|${challenge.placeId}|${challenge.timestamp}|${challengeToken}`;
        const expectedSignature = crypto
            .createHmac('sha256', this.CHALLENGE_SECRET)
            .update(message)
            .digest('hex');
        
        if (!crypto.timingSafeEqual(
            Buffer.from(expectedSignature, 'hex'),
            Buffer.from(providedSignature, 'hex')
        )) {
            console.warn(`[ChallengeController] Invalid signature for challenge ${challengeToken.substring(0, 8)}...`);
            console.warn(`[ChallengeController] Expected: ${expectedSignature.substring(0, 16)}..., Got: ${providedSignature.substring(0, 16)}...`);
            this.challenges.delete(challengeToken);
            return { valid: false, reason: 'INVALID_SIGNATURE' };
        }
        
        // Supprimer le challenge après validation réussie
        this.challenges.delete(challengeToken);
        
        return { 
            valid: true, 
            universeId: challenge.universeId,
            placeId: challenge.placeId
        };
    }

    /**
     * Récupère les secrets d'universes autorisés
     */
    getUniverseSecrets() {
        const secrets = new Map();
        try {
            const secretsEnv = process.env.ROBLOX_UNIVERSE_SECRETS;
            if (secretsEnv) {
                const parsed = JSON.parse(secretsEnv);
                for (const [universeId] of Object.entries(parsed)) {
                    secrets.set(Number(universeId), true);
                }
            }
        } catch (error) {
            console.error('[ChallengeController] Error loading universe secrets:', error);
        }
        return secrets;
    }

    /**
     * Nettoie les challenges expirés
     */
    cleanExpiredChallenges() {
        const now = Date.now();
        let cleaned = 0;
        for (const [token, challenge] of this.challenges.entries()) {
            if (now > challenge.expiresAt) {
                this.challenges.delete(token);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`[ChallengeController] Cleaned ${cleaned} expired challenges`);
        }
        
        // Protection DoS: limiter la taille du cache
        if (this.challenges.size > 10000) {
            console.warn('[ChallengeController] Challenge cache too large, clearing');
            this.challenges.clear();
        }
    }

    /**
     * Statistiques (pour monitoring)
     */
    getStats() {
        return {
            activeChallenges: this.challenges.size,
            ttl: this.CHALLENGE_TTL_MS
        };
    }
}
