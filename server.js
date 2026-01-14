/**
 * API de gestion de sécurité pour Admin Panel Roblox
 * 
 * Installation:
 * 1. npm install
 * 2. Copiez .env.example vers .env et configurez
 * 3. npm start
 * 
 * Endpoints:
 * POST /api/auth/login - Connexion
 * GET /api/security/places - Liste des Place IDs autorisés
 * POST /api/security/places/add - Ajouter un Place ID
 * POST /api/security/places/remove - Retirer un Place ID
 * GET /api/security/killswitch - État du Kill Switch
 * POST /api/security/killswitch - Activer/Désactiver Kill Switch
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { SecurityAPI } from './src/SecurityAPI.js';
import { AuthMiddleware } from './src/AuthMiddleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Désactiver l'en-tête X-Powered-By pour la sécurité
app.disable('x-powered-by');

// Rate limiting strict pour le login (5 tentatives par 15 minutes)
const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 5, // 5 tentatives max
	message: { error: 'Too many login attempts, please try again later.' },
	standardHeaders: true,
	legacyHeaders: false,
	skipSuccessfulRequests: true, // Ne pas compter les succès
});

// Rate limiting pour les autres endpoints (100 requêtes par 15 minutes)
const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // 100 requêtes max
	message: { error: 'Too many requests, please try again later.' },
	standardHeaders: true,
	legacyHeaders: false,
});

// Middleware
app.use(cors({
	origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
	credentials: true,
}));
app.use(express.json());

// Trust proxy pour obtenir la vraie IP (si derrière Nginx/reverse proxy)
app.set('trust proxy', 1);

// Initialisation
const securityAPI = new SecurityAPI();
const authMiddleware = new AuthMiddleware();

// Routes publiques
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const timestamp = new Date().toISOString();
    
    try {
        const { password } = req.body;
        
        if (!password) {
            console.log(`[LOGIN ATTEMPT] ${timestamp} - IP: ${clientIP} - Missing password`);
            return res.status(400).json({ error: 'Password required' });
        }

        const token = await authMiddleware.login(password);
        
        if (!token) {
            console.log(`[LOGIN FAILED] ${timestamp} - IP: ${clientIP} - Invalid password`);
            return res.status(401).json({ error: 'Invalid password' });
        }

        console.log(`[LOGIN SUCCESS] ${timestamp} - IP: ${clientIP}`);
        res.json({ token });
    } catch (error) {
        console.error(`[LOGIN ERROR] ${timestamp} - IP: ${clientIP} -`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Routes protégées (avec rate limiting)
app.use('/api/security', apiLimiter, authMiddleware.verifyToken);

app.get('/api/security/places', async (req, res) => {
    try {
        const places = await securityAPI.getAuthorizedPlaces();
        res.json({ places });
    } catch (error) {
        console.error('Get places error:', error);
        res.status(500).json({ error: 'Failed to get places' });
    }
});

app.post('/api/security/places/add', async (req, res) => {
    try {
        const { placeId } = req.body;
        
        if (!placeId || typeof placeId !== 'number') {
            return res.status(400).json({ error: 'Valid placeId required' });
        }

        const success = await securityAPI.addPlace(placeId);
        
        if (success) {
            res.json({ success: true, message: `Place ID ${placeId} added` });
        } else {
            res.status(500).json({ error: 'Failed to add place' });
        }
    } catch (error) {
        console.error('Add place error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/security/places/remove', async (req, res) => {
    try {
        const { placeId } = req.body;
        
        if (!placeId || typeof placeId !== 'number') {
            return res.status(400).json({ error: 'Valid placeId required' });
        }

        const success = await securityAPI.removePlace(placeId);
        
        if (success) {
            res.json({ success: true, message: `Place ID ${placeId} removed` });
        } else {
            res.status(500).json({ error: 'Failed to remove place' });
        }
    } catch (error) {
        console.error('Remove place error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/security/killswitch', async (req, res) => {
    try {
        const enabled = await securityAPI.getKillSwitch();
        res.json({ enabled });
    } catch (error) {
        console.error('Get killswitch error:', error);
        res.status(500).json({ error: 'Failed to get killswitch status' });
    }
});

app.post('/api/security/killswitch', async (req, res) => {
    try {
        const { enabled } = req.body;
        
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'enabled must be a boolean' });
        }

        const success = await securityAPI.setKillSwitch(enabled);
        
        if (success) {
            res.json({ 
                success: true, 
                message: `Kill Switch ${enabled ? 'activated' : 'deactivated'}` 
            });
        } else {
            res.status(500).json({ error: 'Failed to update killswitch' });
        }
    } catch (error) {
        console.error('Set killswitch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Démarrage
// Écouter uniquement sur localhost (sécurisé - accessible uniquement via Nginx)
app.listen(PORT, '127.0.0.1', () => {
    console.log(`🔒 Security API running on localhost:${PORT}`);
    console.log(`⚠️  Accessible uniquement via Nginx reverse proxy (HTTPS)`);
    console.log(`📝 Endpoints:`);
    console.log(`   - https://YOUR_DOMAIN_OR_IP/api (via Nginx)`);
    console.log(`   - https://YOUR_DOMAIN_OR_IP/health (health check)`);
});
