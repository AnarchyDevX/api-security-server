/**
 * Rate Limiter par Universe ID
 * 
 * Protection contre les attaques ciblées par universe
 * Plus efficace que le rate limiting global
 */

export class RateLimiterByUniverse {
    constructor() {
        this.limits = new Map(); // universeId -> { count, resetAt }
        this.WINDOW_MS = 60 * 1000; // 1 minute
        this.MAX_REQUESTS = 100; // Par minute par universe
    }

    /**
     * Vérifie si une requête est autorisée
     */
    checkLimit(universeId) {
        const now = Date.now();
        const limit = this.limits.get(universeId);

        // Pas de limite existante ou fenêtre expirée
        if (!limit || now > limit.resetAt) {
            this.limits.set(universeId, {
                count: 1,
                resetAt: now + this.WINDOW_MS
            });
            return { allowed: true, remaining: this.MAX_REQUESTS - 1 };
        }

        // Limite atteinte
        if (limit.count >= this.MAX_REQUESTS) {
            return { 
                allowed: false, 
                remaining: 0,
                resetAt: limit.resetAt
            };
        }

        // Incrémenter le compteur
        limit.count++;
        this.limits.set(universeId, limit);

        return { 
            allowed: true, 
            remaining: this.MAX_REQUESTS - limit.count 
        };
    }

    /**
     * Middleware Express
     */
    middleware() {
        return (req, res, next) => {
            // Extraire l'universeId depuis req.roblox (après authentification)
            const universeId = req.roblox?.universeId;

            if (!universeId) {
                // Pas d'universeId = pas de rate limit (sera bloqué par l'auth)
                return next();
            }

            const result = this.checkLimit(universeId);

            if (!result.allowed) {
                res.setHeader('X-RateLimit-Limit', this.MAX_REQUESTS);
                res.setHeader('X-RateLimit-Remaining', 0);
                res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());
                
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    message: `Too many requests for universe ${universeId}. Try again later.`
                });
            }

            // Ajouter les headers de rate limit
            res.setHeader('X-RateLimit-Limit', this.MAX_REQUESTS);
            res.setHeader('X-RateLimit-Remaining', result.remaining);

            next();
        };
    }

    /**
     * Nettoie les limites expirées
     */
    cleanExpired() {
        const now = Date.now();
        let cleaned = 0;
        for (const [universeId, limit] of this.limits.entries()) {
            if (now > limit.resetAt) {
                this.limits.delete(universeId);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`[RateLimiter] Cleaned ${cleaned} expired limits`);
        }
    }
}
