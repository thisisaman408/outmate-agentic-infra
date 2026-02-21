const jwt = require('jsonwebtoken');
const db = require('../config/db');

module.exports = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key_123');

            // Check if user still exists
            const result = await db.query('SELECT id, name, email, workspace, credits FROM users WHERE id = $1', [decoded.id]);

            if (result.rows.length === 0) {
                return res.status(401).json({ message: 'The user belonging to this token no longer exists.' });
            }

            req.user = result.rows[0];
            next();
        } catch (error) {
            console.error('Auth Middleware Error:', error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};
