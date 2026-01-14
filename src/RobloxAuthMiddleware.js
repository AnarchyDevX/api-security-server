/**
 * Middleware d'authentification Roblox avec signature HMAC
 * 
 * Vérifie que les requêtes proviennent bien de games Roblox autorisés
 * en utilisant une signature cryptographique HMAC-SHA256
 */

import crypto from 'crypto';

// Cache pour la fonction de stringify (chargée de manière lazy)
let stringifyCache = null;

async function getStringify() {
    if (stringifyCache) {
        return stringifyCache;
    }
    
    try {
        const module = await import('fast-json-stable-stringify');
        stringifyCache = module.default || module;
        return stringifyCache;
    } catch {
        stringifyCache = JSON.stringify;
        return stringifyCache;
    }
}

export class RobloxAuthMiddleware {
    constructor() {
        this.universeSecrets = new Map();
        this.nonceCache = new Map();
        this.NONCE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
        this.TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes
        this.MAX_NONCE_CACHE_SIZE = 100000; // Protection DoS
        
        this.loadUniverseSecrets();
        // Nettoyer le cache de nonces toutes les 10 minutes
        setInterval(() => this.cleanNonceCache(), 10 * 60 * 1000);
    }

    /**
     * Charge les secrets depuis la base de données / fichier
     */
    loadUniverseSecrets() {
        // Charger depuis .env ou base de données
        // Format: ROBLOX_UNIVERSE_SECRETS={"123456789":"secret1","987654321":"secret2"}
        try {
            const secretsEnv = process.env.ROBLOX_UNIVERSE_SECRETS;
            if (secretsEnv) {
                const secrets = JSON.parse(secretsEnv);
                for (const [universeId, secret] of Object.entries(secrets)) {
                    this.universeSecrets.set(Number(universeId), secret);
                    console.log(`[RobloxAuth] Loaded secret for universe ${universeId}`);
                }
            } else {
                console.warn('[RobloxAuth] No ROBLOX_UNIVERSE_SECRETS configured');
            }
        } catch (error) {
            console.error('[RobloxAuth] Error loading secrets:', error);
        }
    }

    /**
     * Vérifie la signature HMAC
     */
    async verifySignature(secret, universeId, placeId, timestamp, nonce, endpoint, payload, providedSignature) {
        // Construire le message à signer avec JSON canonique
        // Utiliser fast-json-stable-stringify pour éviter les faux négatifs
        const stringify = await getStringify();
        const payloadStr = stringify(payload || {});
        
        const message = `${universeId}|${placeId}|${timestamp}|${nonce}|${endpoint}|${payloadStr}`;
        
        // Calculer le HMAC
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(message);
        const expectedSignature = hmac.digest('hex');
        
        // Comparaison constante (timing-safe)
        try {
            return crypto.timingSafeEqual(
                Buffer.from(expectedSignature, 'hex'),
                Buffer.from(providedSignature, 'hex')
            );
        } catch {
            return false;
        }
    }

    /**
     * Vérifie le nonce (anti-replay)
     */
    verifyNonce(nonce, timestamp) {
        // Protection DoS: limiter la taille du cache
        if (this.nonceCache.size > this.MAX_NONCE_CACHE_SIZE) {
            console.warn('[RobloxAuth] Nonce cache too large, clearing');
            this.nonceCache.clear();
        }

        // Vérifier si le nonce a déjà été utilisé
        if (this.nonceCache.has(nonce)) {
            return false; // Replay attack détecté
        }

        // Vérifier la fenêtre temporelle
        const now = Date.now();
        if (Math.abs(now - timestamp) > this.TIMESTAMP_TOLERANCE_MS) {
            return false; // Timestamp trop ancien ou futur
        }

        // Ajouter le nonce au cache
        this.nonceCache.set(nonce, timestamp);
        return true;
    }

    /**
     * Vérifie que l'universeId est autorisé
     */
    isUniverseAuthorized(universeId) {
        return this.universeSecrets.has(universeId);
    }

    /**
     * Middleware Express
     */
    verifyRobloxRequest(req, res, next) {
        // Wrapper async pour permettre await dans verifySignature
        (async () => {
        try {
            // Extraire les headers
            const universeId = Number(req.headers['x-roblox-universe-id']);
            const placeId = Number(req.headers['x-roblox-place-id']);
            const timestamp = Number(req.headers['x-roblox-timestamp']);
            const nonce = req.headers['x-roblox-nonce'];
            const signature = req.headers['x-roblox-signature'];

            // Validation des headers
            if (!universeId || !placeId || !timestamp || !nonce || !signature) {
                this.logSecurityEvent(req, 'MISSING_HEADERS');
                return res.status(401).json({ error: 'Missing required headers' });
            }

            // Validation des types
            if (!Number.isInteger(universeId) || !Number.isInteger(placeId) || 
                !Number.isInteger(timestamp) || typeof nonce !== 'string' || 
                typeof signature !== 'string') {
                this.logSecurityEvent(req, 'INVALID_HEADER_TYPES');
                return res.status(400).json({ error: 'Invalid header types' });
            }

            // Validation de format Roblox
            if (universeId <= 0 || placeId <= 0) {
                this.logSecurityEvent(req, 'INVALID_ROBLOX_IDS', { universeId, placeId });
                return res.status(400).json({ error: 'Invalid Roblox IDs' });
            }

            // Vérifier que l'universe est autorisé
            if (!this.isUniverseAuthorized(universeId)) {
                this.logSecurityEvent(req, 'UNAUTHORIZED_UNIVERSE', { universeId });
                return res.status(403).json({ error: 'Unauthorized universe' });
            }

            // Récupérer le secret
            const secret = this.universeSecrets.get(universeId);
            if (!secret) {
                this.logSecurityEvent(req, 'SECRET_NOT_FOUND', { universeId });
                return res.status(500).json({ error: 'Internal server error' });
            }

            // Vérifier le nonce (anti-replay)
            if (!this.verifyNonce(nonce, timestamp)) {
                this.logSecurityEvent(req, 'REPLAY_ATTACK', { nonce, timestamp });
                return res.status(401).json({ error: 'Invalid or reused nonce' });
            }

            // Construire l'endpoint
            const endpoint = `${req.method} ${req.path}`;

            // Vérifier la signature
            const isValid = await this.verifySignature(
                secret,
                universeId,
                placeId,
                timestamp,
                nonce,
                endpoint,
                req.body,
                signature
            );

            if (!isValid) {
                this.logSecurityEvent(req, 'INVALID_SIGNATURE', { universeId, placeId });
                return res.status(401).json({ error: 'Invalid signature' });
            }

            // Ajouter les infos au request
            req.roblox = {
                universeId,
                placeId,
                timestamp,
                nonce
            };

            // ✅ Requête valide
            next();

        } catch (error) {
            console.error('[RobloxAuth] Error:', error);
            this.logSecurityEvent(req, 'AUTH_ERROR', { error: String(error) });
            return res.status(500).json({ error: 'Internal server error' });
        }
        })().catch(error => {
            console.error('[RobloxAuth] Unhandled error:', error);
            res.status(500).json({ error: 'Internal server error' });
        });
    }

    /**
     * Nettoie le cache de nonces expirés
     */
    cleanNonceCache() {
        const now = Date.now();
        let cleaned = 0;
        for (const [nonce, timestamp] of this.nonceCache.entries()) {
            if (now - timestamp > this.NONCE_WINDOW_MS) {
                this.nonceCache.delete(nonce);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`[RobloxAuth] Cleaned ${cleaned} expired nonces`);
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
        // TODO: Envoyer à un service de monitoring (Sentry, etc.)
    }
}
