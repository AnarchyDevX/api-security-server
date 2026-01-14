/**
 * Middleware pour bloquer toutes les requêtes non-Roblox
 * 
 * Vérifie que la requête contient les headers Roblox requis
 * et bloque toute tentative d'accès depuis Postman, curl, etc.
 */

export function robloxOnlyMiddleware(req, res, next) {
    // Vérifier que la requête a les headers Roblox
    // Supporte deux systèmes :
    // 1. Ancien système HMAC : x-roblox-signature
    // 2. Nouveau système Challenge : x-roblox-challenge-token + x-roblox-challenge-signature
    const hasUniverseId = req.headers['x-roblox-universe-id'];
    const hasPlaceId = req.headers['x-roblox-place-id'];
    const hasOldSignature = req.headers['x-roblox-signature'];
    const hasChallengeToken = req.headers['x-roblox-challenge-token'];
    const hasChallengeSignature = req.headers['x-roblox-challenge-signature'];
    
    const hasRobloxHeaders = 
        hasUniverseId &&
        hasPlaceId &&
        (hasOldSignature || (hasChallengeToken && hasChallengeSignature));

    if (!hasRobloxHeaders) {
        // Log la tentative d'accès non autorisée
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('user-agent') || 'unknown';
        
        console.warn(`[SECURITY] Non-Roblox request blocked: ${ip} - ${req.method} ${req.path} - UA: ${userAgent}`);
        
        // Ne pas révéler d'informations sensibles
        return res.status(403).json({ 
            error: 'Forbidden',
            message: 'This endpoint is only accessible from authorized Roblox games'
        });
    }

    next();
}
