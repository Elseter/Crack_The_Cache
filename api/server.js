const express = require('express');
const cors = require('cors');
const redis = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;

// Create Redis client
const redisClient = redis.createClient();

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

(async () => {
  await redisClient.connect();
  console.log('Connected to Redis');
})();

// Middleware
app.use(cors());
app.use(express.json());

const PARTICIPANT_PREFIX = 'participant:';


// API endpoint for user registration
app.post('/api/register-participant', async (req, res) => {
  try {
    const { alias, clientip, clientmac, timestamp } = req.body;

    if (!alias || !clientmac) {
      return res.status(400).json({
        success: false,
        message: 'alias and clientmac are required'
      });
    }

    const userInfo = {
      alias,
      clientip: clientip || 'unknown',
      clientmac,
      timestamp: timestamp || new Date().toISOString(),
      registeredAt: new Date().toISOString(),
    };

    // Store user info as JSON string keyed by alias or clientmac (choose one)
    // Here, we key by clientmac for simplicity; you can change as needed.
    await redisClient.set(
      PARTICIPANT_PREFIX + clientmac,
      JSON.stringify(userInfo),
      { EX: 86400 } // expire after 24h (optional)
    );

    console.log(`New user registered: ${alias} from ${clientip}`);

    // Get total users count for response
    const keys = await redisClient.keys(PARTICIPANT_PREFIX + '*');

    res.status(200).json({
      success: true,
      message: 'Registration successful! Welcome to the vault.',
      user: {
        alias,
        registeredAt: userInfo.registeredAt
      },
      totalUsers: keys.length
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
app.get('/api/users', async (req, res) => {
  try {
    const keys = await redisClient.keys(PARTICIPANT_PREFIX + '*');
    const usersRaw = await Promise.all(keys.map(key => redisClient.get(key)));
    const users = usersRaw.map(data => JSON.parse(data));

    res.json({
      success: true,
      users,
      totalUsers: users.length
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// Remove user (admin endpoint - useful for cleanup)
app.delete('/api/users/:clientmac', async (req, res) => {
  try {
    const { clientmac } = req.params;
    const key = PARTICIPANT_PREFIX + clientmac;
    const exists = await redisClient.exists(key);

    if (exists) {
      await redisClient.del(key);
      console.log(`User removed: ${clientmac}`);
      res.json({
        success: true,
        message: `User ${clientmac} removed successfully`
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
  } catch (error) {
    console.error('Error removing user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove user'
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const keys = await redisClient.keys(PARTICIPANT_PREFIX + '*');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      activeUsers: keys.length
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch health info'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Vault Registration Server running on port ${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/register-participant`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server...');
  try {
    await redisClient.quit();
    console.log('Disconnected from Redis');
  } catch (err) {
    console.error('Error during Redis disconnect:', err);
  }
  process.exit(0);
});

module.exports = app;