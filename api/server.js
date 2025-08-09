const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for current users (use database in production)
const currentUsers = new Map();

// API endpoint for user registration
app.post('/api/register-participant', (req, res) => {
    try {
        const { alias, clientip, clientmac, timestamp } = req.body;
        console.log(alias);
        console.log(clientip);
        console.log(clientmac);
        
        
        // Register the user
        const userInfo = {
            alias: alias,
            clientip: clientip || 'unknown',
            clientmac: clientmac || 'unknown',
            timestamp: timestamp || new Date().toISOString(),
            registeredAt: new Date().toISOString()
        };
        
        currentUsers.set(alias, userInfo);
        
        console.log(`New user registered: ${alias} from ${clientip}`);
        console.log(`Total users: ${currentUsers.size}`);
        
        // Return success response
        res.status(200).json({
            success: true,
            message: 'Registration successful! Welcome to the vault.',
            user: {
                alias: alias,
                registeredAt: userInfo.registeredAt
            },
            totalUsers: currentUsers.size
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again.'
        });
    }
});

// Get current users (admin endpoint)
app.get('/api/users', (req, res) => {
    const users = Array.from(currentUsers.values()).map(user => ({
        alias: user.alias,
        clientip: user.clientip,
        registeredAt: user.registeredAt
    }));
    
    res.json({
        success: true,
        users: users,
        totalUsers: users.length
    });
});

// Remove user (admin endpoint - useful for cleanup)
app.delete('/api/users/:alias', (req, res) => {
    const { alias } = req.params;
    
    if (currentUsers.has(alias)) {
        currentUsers.delete(alias);
        console.log(`User removed: ${alias}`);
        res.json({
            success: true,
            message: `User ${alias} removed successfully`
        });
    } else {
        res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeUsers: currentUsers.size
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Vault Registration Server running on port ${PORT}`);
    console.log(`API endpoint: http://localhost:${PORT}/api/register-participant`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    console.log(`Final user count: ${currentUsers.size}`);
    process.exit(0);
});

module.exports = app;