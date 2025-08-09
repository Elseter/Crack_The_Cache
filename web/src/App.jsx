import { useState, useEffect } from 'react';
import './index.css';

function App() {
  const [clients, setClients] = useState([]);
  const [authUsers, setAuthUsers] = useState([]); // Nodogsplash authenticated users
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [routerStatus, setRouterStatus] = useState({ connected: false });

  const API_BASE = 'http://localhost:3000';

  const fetchActiveClients = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/router-clients`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (data.success) {
        setClients(data.clients || []);
        setLastUpdated(data.lastUpdated);
        setError(null);
      } else {
        setError('Failed to fetch clients');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
      console.error('Failed to fetch active clients:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Nodogsplash authenticated users
  const fetchAuthUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/nodogsplash/auth_users`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (data.success) {
        setAuthUsers(data.users || []);
      } else {
        console.warn('Failed to fetch auth users');
      }
    } catch (err) {
      console.error('Failed to fetch Nodogsplash auth users:', err);
    }
  };

  const fetchRouterStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/router-status`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (data.success) {
        setRouterStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch router status:', err);
    }
  };

  useEffect(() => {
    fetchActiveClients();
    fetchAuthUsers();
    fetchRouterStatus();

    const clientInterval = setInterval(fetchActiveClients, 2000);
    const authUsersInterval = setInterval(fetchAuthUsers, 5000);
    const statusInterval = setInterval(fetchRouterStatus, 10000);

    return () => {
      clearInterval(clientInterval);
      clearInterval(authUsersInterval);
      clearInterval(statusInterval);
    };
  }, []);

  const isClientValidated = (clientMac) => {
    if (!clientMac) return false;
    return authUsers.some(
      (user) => user.clientmac && user.clientmac.toLowerCase() === clientMac.toLowerCase() && user.isCurrentlyActive
    );
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-400 mx-auto"></div>
          <p className="mt-4 text-lg">Loading active clients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-blue-400">Vault Network</h1>
            <p className="text-gray-400 mt-2">Live Active Clients Dashboard</p>
          </div>
          <div className="flex space-x-4">
            <div className="text-right">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${routerStatus.connected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-sm">Router {routerStatus.connected ? 'Connected' : 'Disconnected'}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Last updated: {formatTime(lastUpdated)}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 p-4 rounded-lg mb-6">
            <p className="font-semibold">Connection Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 border border-gray-700 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-400">Active Clients</h3>
            <p className="text-3xl font-bold mt-2">{clients.length}</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-green-400">Total Traffic</h3>
            <p className="text-3xl font-bold mt-2">
              {formatBytes(clients.reduce((sum, c) => sum + (c.total_rx || 0) + (c.total_tx || 0), 0))}
            </p>
          </div>

          <div className="bg-gray-800 border border-gray-700 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-400">Router Status</h3>
            <p className="text-lg font-bold mt-2 capitalize">
              {routerStatus.connected ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">Connected Devices</h2>
          </div>

          {clients.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p className="text-lg">No active clients detected</p>
              <p className="text-sm mt-2">Devices will appear here when they connect to the network</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Device</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Network</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Traffic</th>
                    {/* Removed Connection column */}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Validated</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {clients.map((client, index) => (
                    <tr key={client.mac || index} className="hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-white">{client.alias || client.name || 'Unknown Device'}</p>
                          <p className="text-sm text-gray-400">{client.mac}</p>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div>
                          <p className="text-white">{client.ip || 'N/A'}</p>
                          {client.iface && <p className="text-sm text-gray-400">{client.iface}</p>}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="text-green-400">↓ {formatBytes(client.total_rx)}</p>
                          <p className="text-blue-400">↑ {formatBytes(client.total_tx)}</p>
                        </div>
                      </td>

                      {/* Validated column */}
                      <td className="px-6 py-4">
                        {isClientValidated(client.mac) ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-900 text-green-300">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-900 text-red-300">
                            No
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${client.online ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                            }`}
                        >
                          {client.online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Updates every 2 seconds </p>
        </div>
      </div>
    </div>
  );
}

export default App;