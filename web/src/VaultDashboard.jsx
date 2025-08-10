
import React, { useState, useEffect, act } from 'react';
import { Shield, Users, Wifi, Database, Router, Server, Activity, Eye, EyeOff, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import './index.css';

const VaultDashboard = () => {
    const [healthData, setHealthData] = useState({
        overall: { status: 'unknown', registeredUsers: 0, activeClients: 0, routerConnected: false, redisConnected: false },
        redis: {
            status: 'unknown',
            connected: false,
            latencyMs: 0,
            pingResponse: '',
            memoryUsedBytes: 0,
            totalCommandsProcessed: 0,
            instantaneousOpsPerSec: 0,
            connectedClients: 0,
            dbKeys: [],
            rawInfoSample: []
        },
        router: {
            status: 'unknown',
            connected: false,
            latencyMs: 0,
            uptimeSeconds: 0,
            network: null,
            wifi: null,
            wiredClients: 0,
            wirelessClients: 0
        }, extender: { status: 'unknown', latencyMs: 0 },
        mysql: { status: 'unknown', latencyMs: 0 }
    });

    const [registeredUsers, setRegisteredUsers] = useState([]);
    const [routerClients, setRouterClients] = useState([]);
    const [activeClients, setActiveClients] = useState([]);
    const [scrolled, setScrolled] = useState(false);
    const [showDetails, setShowDetails] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(new Date());

    // Mock API base URL - replace with your actual API
    const API_BASE = 'http://localhost:3000';

    // Handle scroll to shrink health panel
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 100);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Fetch health data
    const fetchHealthData = async () => {
        try {
            const [overall, redis, router, extender, mysql] = await Promise.all([
                fetch(`${API_BASE}/health`).then(r => r.json()).catch(() => ({ status: 'error' })),
                fetch(`${API_BASE}/health/redis`).then(r => r.json()).catch(() => ({ status: 'error' })),
                fetch(`${API_BASE}/health/router`).then(r => r.json()).catch(() => ({ status: 'error' })),
                fetch(`${API_BASE}/health/extender`).then(r => r.json()).catch(() => ({ status: 'error' })),
                fetch(`${API_BASE}/health/mysql`).then(r => r.json()).catch(() => ({ status: 'error' }))
            ]);

            setHealthData({
                overall,
                redis: {
                    status: redis.status || 'unknown',
                    connected: redis.connected || false,
                    latencyMs: redis.latencyMs || 0,
                    pingResponse: redis.pingResponse || '',
                    memoryUsedBytes: redis.memoryUsedBytes || 0,
                    totalCommandsProcessed: redis.totalCommandsProcessed || 0,
                    instantaneousOpsPerSec: redis.instantaneousOpsPerSec || 0,
                    connectedClients: redis.connectedClients || 0,
                    dbKeys: redis.dbKeys || [],
                    rawInfoSample: redis.rawInfoSample || []
                },
                router: {
                    status: router.status || 'unknown',
                    connected: router.connected || false,
                    latencyMs: router.latencyMs || 0,
                    uptimeSeconds: router.uptimeSeconds || 0,
                    network: router.network || null,
                    wifi: router.wifi || null,
                    wiredClients: router.wiredClients || 0,
                    wirelessClients: router.wirelessClients || 0,
                },
                extender,
                mysql
            });

            setLastUpdate(new Date());
        } catch (error) {
            console.error('Error fetching health data:', error);
        }
    };

    // Fetch users and clients
    const fetchData = async () => {
        try {
            const [usersRes, clientsRes] = await Promise.all([
                fetch(`${API_BASE}/api/nodogsplash/auth_users`).then(r => r.json()).catch(() => ({ users: [] })),
                fetch(`${API_BASE}/api/router-clients`).then(r => r.json()).catch(() => ({ clients: [] }))
            ]);

            if (usersRes.users) setRegisteredUsers(usersRes.users);
            if (clientsRes.clients) {
                setRouterClients(clientsRes.clients);
                setActiveClients(clientsRes.clients.filter(client => client.online));
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    // Periodic health checks
    useEffect(() => {
        fetchHealthData();
        fetchData();

        const healthInterval = setInterval(fetchHealthData, 3000);
        const dataInterval = setInterval(fetchData, 10000);

        return () => {
            clearInterval(healthInterval);
            clearInterval(dataInterval);
        };
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
            case 'healthy': return 'text-green-400 border-green-400 bg-green-400/10';
            case 'unhealthy': case 'error': case 'unreachable': return 'text-red-400 border-red-400 bg-red-400/10';
            default: return 'text-yellow-400 border-yellow-400 bg-yellow-400/10';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'healthy': return <CheckCircle className="w-4 h-4" />;
            case 'unhealthy': case 'error': case 'unreachable': return <XCircle className="w-4 h-4" />;
            default: return <AlertTriangle className="w-4 h-4" />;
        }
    };

    const formatUptime = (seconds) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${mins}m`;
    };

    return (
        <div className="min-h-screen bg-slate-900 text-gray-100">
            {/* Floating Health Status Panel */}
            <div className={`fixed top-4 left-4 right-4 z-50 transition-all duration-300 ${scrolled ? 'transform scale-90' : ''
                }`}>
                <div className="bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-2xl">
                    <div className="flex items-center justify-between p-4 border-b border-slate-700">
                        <div className="flex items-center space-x-3">
                            <Shield className="w-6 h-6 text-cyan-400" />
                            <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                                THE VAULT - SYSTEM STATUS
                            </h2>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="text-sm text-gray-400">
                                Last Update: {lastUpdate.toLocaleTimeString()}
                            </div>
                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                className="p-1 text-gray-400 hover:text-cyan-400 transition-colors"
                            >
                                {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Health Status Grid */}
                    <div className={`p-4 transition-all duration-300 ${scrolled ? 'py-2' : ''}`}>
                        <div className={`grid gap-3 ${scrolled ? 'grid-cols-5' : 'grid-cols-2 md:grid-cols-5'}`}>

                            {/* Extender */}
                            <div className={`border rounded-lg p-3 ${getStatusColor(healthData.extender.status)} ${scrolled ? 'p-2' : ''}`}>
                                <div className="flex items-center justify-between">
                                    <Wifi className={`${scrolled ? 'w-4 h-4' : 'w-5 h-5'}`} />
                                    {getStatusIcon(healthData.extender.status)}
                                </div>
                                <div className={`mt-1 ${scrolled ? 'text-xs' : 'text-sm'} font-medium`}>Extender</div>
                                {showDetails && !scrolled && (
                                    <div className="text-xs text-gray-400 mt-1 space-y-1">
                                        {/* Latency */}
                                        <div>
                                            Latency: <span className="font-semibold">{healthData.extender.latencyMs ?? 0} ms</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Router */}
                            <div className={`border rounded-lg p-3 ${getStatusColor(healthData.router.status)} ${scrolled ? 'p-2' : ''}`}>
                                <div className="flex items-center justify-between">
                                    <Router className={`${scrolled ? 'w-4 h-4' : 'w-5 h-5'}`} />
                                    {getStatusIcon(healthData.router.status)}
                                </div>
                                <div className={`mt-1 ${scrolled ? 'text-xs' : 'text-sm'} font-medium`}>Router</div>

                                {showDetails && !scrolled && (
                                    <div className="text-xs text-gray-400 mt-1 space-y-1">
                                        {/* Uptime */}
                                        <div>Uptime: {healthData.router.uptimeSeconds ? formatUptime(healthData.router.uptimeSeconds) : 'N/A'}</div>

                                        {/* WAN Status */}
                                        <div>
                                            WAN: {healthData.router.network?.online ? (
                                                <span className="text-green-400 font-semibold">Online</span>
                                            ) : (
                                                <span className="text-red-400 font-semibold">Offline</span>
                                            )}
                                        </div>

                                        {/* WiFi SSID */}
                                        <div>
                                            SSID: <span className="font-semibold">{healthData.router.wifi?.ssid || 'N/A'}</span>
                                        </div>

                                        {/* Wired Clients */}
                                        <div>
                                            Wired Clients: <span className="font-semibold">{healthData.router.wiredClients ?? 0}</span>
                                        </div>

                                        {/* Wireless Clients */}
                                        <div>
                                            Wireless Clients: <span className="font-semibold">{healthData.router.wirelessClients ?? 0}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Redis */}
                            <div className={`border rounded-lg p-3 ${getStatusColor(healthData.redis.status)} ${scrolled ? 'p-2' : ''}`}>
                                <div className="flex items-center justify-between">
                                    <Database className={`${scrolled ? 'w-4 h-4' : 'w-5 h-5'}`} />
                                    {getStatusIcon(healthData.redis.status)}
                                </div>
                                <div className={`mt-1 ${scrolled ? 'text-xs' : 'text-sm'} font-medium`}>Redis</div>

                                {showDetails && !scrolled && (
                                    <div className="text-xs text-gray-400 mt-1 space-y-1">
                                        {/* Latency */}
                                        <div>
                                            Latency: <span className="font-semibold">{healthData.redis.latencyMs ?? 0} ms</span>
                                        </div>

                                        {/* Memory */}
                                        <div>
                                            Memory: <span className="font-semibold">{(healthData.redis.memoryUsedBytes / 1024 / 1024).toFixed(2)} MB</span>
                                        </div>

                                        {/* Total Commands */}
                                        <div>
                                            Commands: <span className="font-semibold">{healthData.redis.totalCommandsProcessed ?? 0}</span>
                                        </div>

                                        {/* Operations per Second */}
                                        <div>
                                            Ops/sec: <span className="font-semibold">{healthData.redis.instantaneousOpsPerSec ?? 0}</span>
                                        </div>

                                        {/* Connected Clients */}
                                        <div>
                                            Connected Clients: <span className="font-semibold">{healthData.redis.connectedClients ?? 0}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* MySQL */}
                            <div className={`border rounded-lg p-3 ${getStatusColor(healthData.mysql.status)} ${scrolled ? 'p-2' : ''}`}>
                                <div className="flex items-center justify-between">
                                    <Server className={`${scrolled ? 'w-4 h-4' : 'w-5 h-5'}`} />
                                    {getStatusIcon(healthData.mysql.status)}
                                </div>
                                <div className={`mt-1 ${scrolled ? 'text-xs' : 'text-sm'} font-medium`}>MySQL</div>
                                {showDetails && !scrolled && (
                                    <div className="text-xs text-gray-400 mt-1">
                                        {healthData.mysql.latencyMs}ms
                                    </div>
                                )}
                            </div>

                            {/* Overall Stats */}
                            <div className={`border border-cyan-400 rounded-lg p-3 bg-cyan-400/10 ${scrolled ? 'p-2' : ''}`}>
                                <div className="flex items-center justify-between">
                                    <Activity className={`${scrolled ? 'w-4 h-4' : 'w-5 h-5'} text-cyan-400`} />
                                    <div className="text-cyan-400 text-xs font-bold">
                                        {activeClients.length}/{healthData.overall.activeClients}
                                    </div>
                                </div>
                                <div className={`mt-1 ${scrolled ? 'text-xs' : 'text-sm'} font-medium text-cyan-400`}>
                                    {scrolled ? 'Active' : 'Active / Total'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className={`transition-all duration-300 ${scrolled ? 'pt-28' : 'pt-48'} px-4 pb-8`}>
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-12 pt-30">
                        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                            THE VAULT NETWORK
                        </h1>
                        <p className="text-gray-400 text-lg">Network Management Dashboard</p>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                            <div className="flex items-center space-x-3 mb-4">
                                <Users className="w-8 h-8 text-green-400" />
                                <h3 className="text-xl font-semibold">Registered Users</h3>
                            </div>
                            <div className="text-3xl font-bold text-green-400 mb-2">
                                {healthData.overall.registeredUsers}
                            </div>
                            <p className="text-gray-400 text-sm">Total vault members</p>
                        </div>

                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                            <div className="flex items-center space-x-3 mb-4">
                                <Activity className="w-8 h-8 text-cyan-400" />
                                <h3 className="text-xl font-semibold">Clients</h3>
                            </div>
                            <div className="text-3xl font-bold text-cyan-400 mb-2">
                                {activeClients.length}
                            </div>
                            <p className="text-gray-400 text-sm">Currently connected</p>
                        </div>

                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                            <div className="flex items-center space-x-3 mb-4">
                                <Shield className="w-8 h-8 text-purple-400" />
                                <h3 className="text-xl font-semibold">Security Status</h3>
                            </div>
                            <div className="text-3xl font-bold text-purple-400 mb-2">
                                {healthData.overall.routerConnected ? 'SECURED' : 'ALERT'}
                            </div>
                            <p className="text-gray-400 text-sm">Network protection active</p>
                        </div>
                    </div>

                    {/* Data Tables */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Registered Users */}
                        <div className="bg-slate-800 border border-slate-700 rounded-lg">
                            <div className="p-6 border-b border-slate-700">
                                <h3 className="text-xl font-semibold flex items-center space-x-2">
                                    <Users className="w-5 h-5 text-green-400" />
                                    <span>Registered Vault Members</span>
                                </h3>
                            </div>
                            <div className="p-6">
                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {registeredUsers.length > 0 ? registeredUsers.map((user, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                            <div>
                                                <div className="font-medium text-green-400">{user.alias}</div>
                                                <div className="text-sm text-gray-400">{user.clientmac}</div>
                                                <div className="text-xs text-gray-500">
                                                    {user.clientip} • {new Date(user.registeredAt).toLocaleString()}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-xs px-2 py-1 rounded-full ${user.isCurrentlyActive
                                                    ? 'bg-green-400/20 text-green-400'
                                                    : 'bg-gray-600/50 text-gray-400'
                                                    }`}>
                                                    {user.isCurrentlyActive ? 'ACTIVE' : 'OFFLINE'}
                                                </div>
                                                {user.lastSeenActive && (
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        Last seen: {new Date(user.lastSeenActive).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center text-gray-400 py-8">
                                            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                            <p>No registered users found</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Active Clients */}
                        <div className="bg-slate-800 border border-slate-700 rounded-lg">
                            <div className="p-6 border-b border-slate-700">
                                <h3 className="text-xl font-semibold flex items-center space-x-2">
                                    <Wifi className="w-5 h-5 text-cyan-400" />
                                    <span>Active Network Clients</span>
                                </h3>
                            </div>
                            <div className="p-6">
                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {routerClients.length > 0 ? routerClients.map((client, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                                            <div>
                                                <div className="font-medium text-cyan-400">
                                                    {client.hostname || client.name || 'Unknown Device'}
                                                </div>
                                                <div className="text-sm text-gray-400">{client.mac}</div>
                                                <div className="text-xs text-gray-500">
                                                    {client.ip} • {client.interface || 'Unknown Interface'}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs px-2 py-1 rounded-full bg-cyan-400/20 text-cyan-400">
                                                    CONNECTED
                                                </div>
                                                {client.rx_bytes && client.tx_bytes && (
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        ↓{Math.round(client.rx_bytes / 1024 / 1024)}MB
                                                        ↑{Math.round(client.tx_bytes / 1024 / 1024)}MB
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center text-gray-400 py-8">
                                            <Wifi className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                            <p>No active clients detected</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-12 text-center text-gray-500">
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VaultDashboard;