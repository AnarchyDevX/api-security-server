/**
 * Logger de sécurité pour détecter les tentatives d'attaque
 */

export class SecurityLogger {
    constructor() {
        this.events = [];
        this.MAX_EVENTS = 10000;
        this.alertThreshold = 10; // Nombre de tentatives avant alerte
    }

    /**
     * Log un événement de sécurité
     */
    log(event) {
        this.events.push(event);
        
        // Limiter la taille
        if (this.events.length > this.MAX_EVENTS) {
            this.events.shift();
        }

        // Log critique
        if (event.type === 'BLOCKED' || event.type === 'SUSPICIOUS') {
            console.warn(`[SECURITY] ${JSON.stringify(event)}`);
            
            // Vérifier si on doit alerter
            this.checkForAlerts(event);
        } else if (event.type === 'SUCCESS') {
            console.log(`[SECURITY] ${JSON.stringify(event)}`);
        }
    }

    /**
     * Vérifie s'il faut envoyer une alerte
     */
    checkForAlerts(event) {
        const oneMinuteAgo = Date.now() - 60000;
        
        // Compter les tentatives bloquées de cette IP dans la dernière minute
        const recentBlocks = this.events.filter(e => 
            e.type === 'BLOCKED' && 
            e.ip === event.ip &&
            new Date(e.timestamp).getTime() > oneMinuteAgo
        );
        
        if (recentBlocks.length >= this.alertThreshold) {
            this.sendAlert(event, recentBlocks.length);
        }
    }

    /**
     * Envoie une alerte critique
     */
    sendAlert(event, count) {
        const alert = {
            level: 'CRITICAL',
            message: `Multiple blocked attempts detected`,
            ip: event.ip,
            count,
            timeWindow: '1 minute',
            timestamp: new Date().toISOString()
        };
        
        console.error(`[ALERT] ${JSON.stringify(alert)}`);
        
        // TODO: Envoyer à un service d'alerte (email, webhook, Slack, etc.)
        // Exemple:
        // this.sendWebhook(alert);
        // this.sendEmail(alert);
    }

    /**
     * Récupère les statistiques de sécurité
     */
    getStats() {
        const last24h = this.events.filter(e => 
            new Date(e.timestamp).getTime() > Date.now() - 86400000
        );
        
        // Compter par type
        const blocked = last24h.filter(e => e.type === 'BLOCKED').length;
        const suspicious = last24h.filter(e => e.type === 'SUSPICIOUS').length;
        const success = last24h.filter(e => e.type === 'SUCCESS').length;
        
        // Top IPs avec tentatives bloquées
        const ipCounts = new Map();
        last24h
            .filter(e => e.type === 'BLOCKED')
            .forEach(e => {
                ipCounts.set(e.ip, (ipCounts.get(e.ip) || 0) + 1);
            });
        
        const topIPs = Array.from(ipCounts.entries())
            .map(([ip, count]) => ({ ip, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        
        return {
            total: last24h.length,
            blocked,
            suspicious,
            success,
            topIPs
        };
    }

    /**
     * Récupère les événements récents
     */
    getRecentEvents(limit = 100) {
        return this.events.slice(-limit).reverse();
    }

    /**
     * Nettoie les anciens événements
     */
    cleanOldEvents(olderThanDays = 7) {
        const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
        this.events = this.events.filter(e => 
            new Date(e.timestamp).getTime() > cutoff
        );
    }
}
