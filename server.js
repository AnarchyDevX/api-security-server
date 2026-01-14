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
import { SecurityAPI } from './src/SecurityAPI.js';
import { AuthMiddleware } from './src/AuthMiddleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
	origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
	credentials: true,
}));
app.use(express.json());

// Initialisation
const securityAPI = new SecurityAPI();
const authMiddleware = new AuthMiddleware();

// Routes publiques
app.post('/api/auth/login', async (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ error: 'Password required' });
        }

        const token = await authMiddleware.login(password);
        
        if (!token) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        res.json({ token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Routes protégées
app.use('/api/security', authMiddleware.verifyToken);

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
// Écouter sur toutes les interfaces (0.0.0.0) pour être accessible depuis l'extérieur
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🔒 Security API running on port ${PORT}`);
    console.log(`📝 Endpoints available at:`);
    console.log(`   - http://localhost:${PORT}/api (local)`);
    console.log(`   - http://YOUR_VPS_IP:${PORT}/api (depuis l'extérieur)`);
    console.log(`   - http://YOUR_DOMAIN:${PORT}/api (si domaine configuré)`);
});
