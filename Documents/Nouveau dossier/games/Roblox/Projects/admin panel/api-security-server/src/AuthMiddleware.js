/**
 * Middleware d'authentification
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export class AuthMiddleware {
    constructor() {
        this.JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
        this.ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
        this.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
        
        // Hash le mot de passe au premier démarrage si nécessaire
        this.initializePassword();
    }

    async initializePassword() {
        if (!this.ADMIN_PASSWORD_HASH && this.ADMIN_PASSWORD) {
            const hash = await bcrypt.hash(this.ADMIN_PASSWORD, 10);
            console.log('⚠️  ADMIN_PASSWORD_HASH (à ajouter dans .env):');
            console.log(`ADMIN_PASSWORD_HASH=${hash}`);
            console.log('⚠️  Supprimez ADMIN_PASSWORD après avoir ajouté le hash!');
        }
    }

    async login(password) {
        try {
            let isValid = false;

            if (this.ADMIN_PASSWORD_HASH) {
                // Utiliser le hash stocké
                isValid = await bcrypt.compare(password, this.ADMIN_PASSWORD_HASH);
            } else if (this.ADMIN_PASSWORD) {
                // Utiliser le mot de passe en clair (temporaire)
                isValid = password === this.ADMIN_PASSWORD;
            } else {
                return null;
            }

            if (!isValid) {
                return null;
            }

            // Générer un token JWT
            const token = jwt.sign(
                { admin: true, timestamp: Date.now() },
                this.JWT_SECRET,
                { expiresIn: '24h' }
            );

            return token;
        } catch (error) {
            console.error('Login error:', error);
            return null;
        }
    }

    verifyToken(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'No token provided' });
            }

            const token = authHeader.substring(7);
            const decoded = jwt.verify(token, this.JWT_SECRET);

            req.user = decoded;
            next();
        } catch (error) {
            return res.status(401).json({ error: 'Invalid token' });
        }
    }
}
