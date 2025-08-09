// Import necessary modules
// ------------------------
const express = require('express');
const cors = require('cors');
const redis = require('redis');
const ping = require('ping');
const mysql = require('mysql2/promise');


const { SimpleGLiNet } = require('./router');
const { ClientInfo } = require('./types');


// Configure 
// ------------------------
const app = express();
const PORT = process.env.PORT || 3000;

// Router configuration
const ROUTER_URL = process.env.ROUTER_URL || 'http://192.168.8.1/rpc';
const ROUTER_USERNAME = process.env.ROUTER_USERNAME || 'root';
const ROUTER_PASSWORD = process.env.ROUTER_PASSWORD || 'Wooimbouttamakeanameformyselfere';

// Create Redis client
const redisClient = redis.createClient();

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

// Initialize router instance
let router = null;
let routerConnected = false;
let activeClients = [];

// Middleware
app.use(cors());
app.use(express.json());

const NODOGSPLASH_KEY = 'nodogsplash:';
const ROUTER_CLIENTS_KEY = 'router_clients:';

const mysqlConfig = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || 'blackteam',
  password: process.env.MYSQL_PASSWORD || 'blackteamsqlauth',
  database: process.env.MYSQL_DATABASE || 'mydb', // optional
  connectTimeout: 3000, // 3 seconds timeout
};

// Helper Functions
// ------------------------
// Initialize connections
async function initializeConnections() {
  try {
    // Connect to Redis
    await redisClient.connect();
    console.log('Connected to Redis');

    // Initialize router connection
    router = new SimpleGLiNet(ROUTER_URL, ROUTER_USERNAME);
    await router.login(ROUTER_PASSWORD);
    routerConnected = true;
    console.log('Connected to GL.iNet router');

    // Start fetching client data
    startClientDataFetching();
  } catch (error) {
    console.error('Initialization error:', error);
    routerConnected = false;
  }
}

// Fetch active clients from router every second
function startClientDataFetching() {
  const fetchClients = async () => {
    if (!routerConnected || !router) {
      console.log('Router not connected, skipping client fetch');
      return;
    }

    try {
      // Check if router connection is still alive
      const isAlive = await router.isAlive();
      if (!isAlive) {
        console.log('Router connection lost, attempting to reconnect...');
        await router.login(ROUTER_PASSWORD);
        routerConnected = true;
        console.log('Router connection restored');
      }

      // Fetch active clients
      const clients = await router.getClients();
      activeClients = clients;

      // Store in Redis with timestamp
      const clientData = {
        clients: clients.map(client => client.toDict ? client.toDict() : client),
        lastUpdated: new Date().toISOString(),
        totalClients: clients.length
      };

      await redisClient.set(ROUTER_CLIENTS_KEY, JSON.stringify(clientData), { EX: 10 });

      console.log(`Fetched ${clients.length} active clients from router`);

    } catch (error) {
      console.error('Error fetching clients from router:', error);
      routerConnected = false;
      activeClients = [];
    }
  };

  // Initial fetch
  fetchClients();

  // Set up interval to fetch every second
  setInterval(fetchClients, 1000);
}

// API Endpoints
// -----------------------------------------------------------
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

    // Check if this client is currently active on the router
    const isActiveClient = activeClients.some(client =>
      client.mac && client.mac.toLowerCase() === clientmac.toLowerCase()
    );

    const userInfo = {
      alias,
      clientip: clientip || 'unknown',
      clientmac,
      timestamp: timestamp || new Date().toISOString(),
      registeredAt: new Date().toISOString(),
      isCurrentlyActive: isActiveClient,
      lastSeenActive: isActiveClient ? new Date().toISOString() : null
    };

    // Store user info keyed by clientmac
    await redisClient.set(
      NODOGSPLASH_KEY + clientmac,
      JSON.stringify(userInfo),
      { EX: 86400 } // expire after 24h
    );

    console.log(`New user registered: ${alias} (${clientmac}) from ${clientip} - Active: ${isActiveClient}`);

    // If router is connected and this is a new registration, try to set alias on router
    if (routerConnected && router) {
      try {
        await router.setAliasInfo(clientmac, alias);
        console.log(`Set alias "${alias}" for MAC ${clientmac} on router`);
      } catch (error) {
        console.log(`Could not set alias on router: ${error.message}`);
      }
    }

    // Get total registered users count
    const keys = await redisClient.keys(NODOGSPLASH_KEY + '*');

    res.status(200).json({
      success: true,
      message: 'Registration successful! Welcome to the vault.',
      user: {
        alias,
        registeredAt: userInfo.registeredAt,
        isCurrentlyActive: isActiveClient
      },
      totalRegisteredUsers: keys.length,
      totalActiveClients: activeClients.length
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again.'
    });
  }
});

// Get current router clients
app.get('/api/router-clients', async (req, res) => {
  try {
    // Try to get from Redis first (cached data)
    const cachedData = await redisClient.get(ROUTER_CLIENTS_KEY);

    if (cachedData) {
      const clientData = JSON.parse(cachedData);
      res.json({
        success: true,
        ...clientData,
        source: 'cached'
      });
    } else {
      // Fallback to current in-memory data
      res.json({
        success: true,
        clients: activeClients.map(client => client.toDict ? client.toDict() : client),
        lastUpdated: new Date().toISOString(),
        totalClients: activeClients.length,
        source: 'memory'
      });
    }
  } catch (error) {
    console.error('Error fetching router clients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch router clients'
    });
  }
});



// Get registered users (admin endpoint)
app.get('/api/nodogsplash/auth_users', async (req, res) => {
  try {
    const keys = await redisClient.keys(NODOGSPLASH_KEY + '*');
    const usersRaw = await Promise.all(keys.map(key => redisClient.get(key)));
    const users = usersRaw.map(data => JSON.parse(data));

    // Update active status based on current router data
    const updatedUsers = users.map(user => {
      const isCurrentlyActive = activeClients.some(client =>
        client.mac && client.mac.toLowerCase() === user.clientmac.toLowerCase()
      );

      return {
        ...user,
        isCurrentlyActive,
        lastSeenActive: isCurrentlyActive ? new Date().toISOString() : user.lastSeenActive
      };
    });

    res.json({
      success: true,
      users: updatedUsers,
      totalRegisteredUsers: users.length,
      totalActiveClients: activeClients.length,
      routerConnected
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// Remove user (admin endpoint)
app.delete('/api/users/:clientmac', async (req, res) => {
  try {
    const { clientmac } = req.params;
    const key = NODOGSPLASH_KEY + clientmac;
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

// Router status endpoint
app.get('/api/router-status', (req, res) => {
  res.json({
    success: true,
    connected: routerConnected,
    url: ROUTER_URL,
    username: ROUTER_USERNAME,
    activeClientsCount: activeClients.length,
    lastUpdate: new Date().toISOString()
  });
});

// Health check endpoints
// ------------------------------------------------------------
// Overall health endpoint
app.get('/health', async (req, res) => {
  try {
    const keys = await redisClient.keys(NODOGSPLASH_KEY + '*');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      registeredUsers: keys.length,
      activeClients: activeClients.length,
      routerConnected,
      redisConnected: redisClient.isOpen
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch health info',
      routerConnected,
      redisConnected: redisClient.isOpen
    });
  }
});

// Redis health check endpoint
app.get('/health/redis', async (req, res) => {
  const startTime = Date.now();
  try {
    if (!redisClient.isOpen) {
      return res.status(503).json({
        status: 'unhealthy',
        message: 'Redis connection is closed',
        connected: false
      });
    }

    // Send PING to verify Redis responsiveness
    const pong = await redisClient.ping();
    const latency = Date.now() - startTime;

    // Get server info (optional)
    const info = await redisClient.info();

    res.json({
      status: 'healthy',
      connected: true,
      pingResponse: pong,
      latencyMs: latency,
      redisInfo: info.split('\n').slice(0, 5) // just the first few lines for brevity
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      connected: false,
      error: error.message
    });
  }
});

// Router health check endpoint
app.get('/health/router', async (req, res) => {
  const startTime = Date.now();
  try {
    if (!routerConnected || !router) {
      return res.status(503).json({
        status: 'unhealthy',
        message: 'Router is not connected',
        connected: false
      });
    }

    // Try to get system status
    const statusData = await router.getSystemStatus();
    const latency = Date.now() - startTime;
    const clientStats = Array.isArray(statusData.client) && statusData.client.length > 0
      ? statusData.client[0]
      : { cable_total: null, wireless_total: null };
    const wanNetwork = Array.isArray(statusData.network)
      ? statusData.network.find(n => n.interface === 'wan') || null
      : null;
    const theVaultWifi = Array.isArray(statusData.wifi)
      ? statusData.wifi.find(w => w.ssid === 'The_Vault') || null
      : null;

    res.json({
      status: 'healthy',
      connected: true,
      latencyMs: latency,
      network: wanNetwork,
      wifi: theVaultWifi,
      uptimeSeconds: statusData.system.uptime,
      wiredClients: clientStats.cable_total,
      wirelessClients: clientStats.wireless_total
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      connected: false,
      error: error.message
    });
  }
});

// Extender health check endpoint
app.get('/health/extender', async (req, res) => {
  const host = '192.168.8.138';
  const startTime = Date.now();
  
  try {
    const result = await ping.promise.probe(host, { timeout: 2 });
    res.json({
      status: result.alive ? 'healthy' : 'unreachable',
      ip: host,
      latencyMs: result.alive ? Date.now() - startTime : null
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      ip: host,
      message: error.message
    });
  }
});

// MySQL health check endpoint
app.get('/health/mysql', async (req, res) => {
  let connection;
  const startTime = Date.now();
  try {
    connection = await mysql.createConnection(mysqlConfig);
    // Simple test query
    const [rows] = await connection.query('SELECT 1');
    
    const latency = Date.now() - startTime;
    
    res.json({
      status: 'healthy',
      latencyMs: latency,
      queryResult: rows,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Start server
// -----------------------------------------------------------
app.listen(PORT, async () => {
  console.log(`Vault Registration Server running on port ${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  - Registration: http://localhost:${PORT}/api/register-participant`);
  console.log(`  - Active Clients: http://localhost:${PORT}/api/active-clients`);
  console.log(`  - Users: http://localhost:${PORT}/api/users`);
  console.log(`  - Router Status: http://localhost:${PORT}/api/router-status`);
  console.log(`  - Health: http://localhost:${PORT}/health`);

  // Initialize connections after server starts
  await initializeConnections();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server...');
  try {
    if (router) {
      await router.logout();
      console.log('Logged out from router');
    }
    if (redisClient.isOpen) {
      await redisClient.quit();
      console.log('Disconnected from Redis');
    }
  } catch (err) {
    console.error('Error during shutdown:', err);
  }
  process.exit(0);
});

module.exports = app;