const crypto = require('crypto');
const { ClientInfo } = require('./types');

class SimpleGLiNet {
    constructor(url = "http://192.168.8.1/rpc", username = "root") {
        this.url = url;
        this.username = username;
        this.sid = null;
        this.queryId = 0;

        this.hashAlgos = {
            "1": (password, salt) => md5Crypt(password, salt),
            "5": (password, salt) => { throw new Error("SHA-256 crypt not implemented"); },
            "6": (password, salt) => { throw new Error("SHA-512 crypt not implemented"); }
        };
    }

    async makeRequest(method, params = {}) {
        if (this.sid && !["challenge", "login"].includes(method)) {
            if (typeof params === 'object' && !Array.isArray(params)) {
                params.sid = this.sid;
            } else if (Array.isArray(params)) {
                if (!(typeof params[0] === 'string' && params[0] === this.sid)) {
                    params = [this.sid, ...params];
                }
            }
        }

        const payload = {
            jsonrpc: "2.0",
            id: this.queryId++,
            method: method,
            params: params
        };

        const response = await fetch(this.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(`API Error: ${JSON.stringify(data.error)}`);
        }

        return data.result || {};
    }

    async login(password) {
        console.log("Initiating Login");
        if (!password) {
            throw new Error("Password is required");
        }

        const challenge = await this.makeRequest("challenge", { username: this.username });
        const hashFunc = this.hashAlgos[String(challenge.alg)];
        if (!hashFunc) throw new Error(`Unsupported hash algorithm: ${challenge.alg}`);

        const passwordHash = hashFunc(password, challenge.salt);
        const loginString = `${this.username}:${passwordHash}:${challenge.nonce}`;
        const loginHash = crypto.createHash('md5').update(loginString).digest('hex');

        const result = await this.makeRequest("login", { username: this.username, hash: loginHash });
        this.sid = result.sid;
        console.log(`Logged In Successfully - ${this.sid}`);

        return true;
    }

    async isAlive() {
        if (!this.sid) return false;
        try {
            await this.makeRequest("alive", { sid: this.sid });
            return true;
        } catch {
            return false;
        }
    }

    async logout() {
        if (!this.sid) return;
        try {
            await this.makeRequest("logout", { sid: this.sid });
        } catch {
            // ignore errors on logout
        } finally {
            this.sid = null;
        }
    }

    async callApi(module, method, params = {}) {
        if (!this.sid) throw new Error("Not logged in. Call login() first.");
        return await this.makeRequest("call", [module, method, params]);
    }

    // Get list of connected clients (raw data)
    async getClientsRaw() {
        if (!this.sid) throw new Error("Not logged in. Call login() first.");
        return await this.makeRequest("call", [this.sid, "clients", "get_list", {}]);
    }

    // Get list of connected clients - returns an array of ClientInfo-like objects
    async getClients() {
        if (!this.sid) throw new Error("Not logged in. Call login() first.");
        const result = await this.getClientsRaw();
        const clients = result.clients || [];
        return clients.map(clientData => ClientInfo.fromDict(clientData));
    }

    // Set alias info for a client by MAC address
    async setAliasInfo(clientMac, newAlias) {
        if (!this.sid) throw new Error("Not logged in. Call login() first.");
        const changes = {
            mac: clientMac,
            alias: newAlias
        };
        return await this.makeRequest("call", [this.sid, "clients", "set_info", changes]);
    }

    // Get system status
    async getSystemStatus() {
        if (!this.sid) throw new Error("Not logged in. Call login() first.");

        // Matches the example call:
        // {"jsonrpc":"2.0","id":7,"method":"call","params":[SID,"system","get_status",{}]}
        const result = await this.makeRequest("call", [
            this.sid,
            "system",
            "get_status",
            {}
        ]);

        return result;
    }
}

function md5Crypt(password, salt) {
    const CRYPT_ALPHABET = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

    function to64(value, length) {
        let result = '';
        while (--length >= 0) {
            result += CRYPT_ALPHABET[value & 0x3f];
            value >>= 6;
        }
        return result;
    }

    function md5CryptFinalEncode(digest) {
        let output = '';
        output += to64(
            (digest[0] << 16) | (digest[6] << 8) | digest[12],
            4
        );
        output += to64(
            (digest[1] << 16) | (digest[7] << 8) | digest[13],
            4
        );
        output += to64(
            (digest[2] << 16) | (digest[8] << 8) | digest[14],
            4
        );
        output += to64(
            (digest[3] << 16) | (digest[9] << 8) | digest[15],
            4
        );
        output += to64(
            (digest[4] << 16) | (digest[10] << 8) | digest[5],
            4
        );
        output += to64(
            digest[11],
            2
        );
        return output;
    }

    let hash1 = crypto.createHash('md5');
    hash1.update(password);
    hash1.update('$1$');
    hash1.update(salt);

    let hash2 = crypto.createHash('md5');
    hash2.update(password);
    hash2.update(salt);
    hash2.update(password);
    let digest2 = hash2.digest();

    for (let i = password.length; i > 0; i -= 16) {
        if (i > 16) {
            hash1.update(digest2);
        } else {
            hash1.update(digest2.slice(0, i));
        }
    }

    for (let i = password.length; i > 0; i >>= 1) {
        if (i & 1) {
            hash1.update(Buffer.from([0]));
        } else {
            hash1.update(Buffer.from([password.charCodeAt(0)]));
        }
    }

    let digest = hash1.digest();

    for (let i = 0; i < 1000; i++) {
        let hash = crypto.createHash('md5');
        if (i & 1) {
            hash.update(password);
        } else {
            hash.update(digest);
        }
        if (i % 3 !== 0) {
            hash.update(salt);
        }
        if (i % 7 !== 0) {
            hash.update(password);
        }
        if (i & 1) {
            hash.update(digest);
        } else {
            hash.update(password);
        }
        digest = hash.digest();
    }

    let encoded = md5CryptFinalEncode(digest);
    encoded = encoded.substring(0, 22);

    return `$1$${salt}$${encoded}`;
}

// Usage example
async function main() {
    const router = new SimpleGLiNet('http://192.168.8.1/rpc', 'root');

    try {
        await router.login('Wooimbouttamakeanameformyselfere');

        const clients = await router.getClients();
        console.log("Connected Clients:");
        clients.forEach(client => {
            console.log(client.toString());
        });

    } catch (error) {
        console.error("Failed to connect:", error.message);
    }
}

// Uncomment to run
// main();

module.exports = { SimpleGLiNet };