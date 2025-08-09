class ClientInfo {
  constructor({
    mac = '',
    ip = '',
    alias = '',
    name = '',
    online = false,
    blocked = false,
    iface = '',
    client_class = '',
    client_type = 0,
    remote = false,
    total_rx = 0,
    total_tx = 0,
    rx = 0,
    tx = 0,
    total_rx_init = 0,
    total_tx_init = 0,
    limit_rx = 0,
    limit_tx = 0,
    online_time = null,
    last_update_rate = null,
    last_rx = null,
    last_tx = null,
  } = {}) {
    this.mac = mac;
    this.ip = ip;
    this.alias = alias;
    this.name = name;
    this.online = online;
    this.blocked = blocked;
    this.iface = iface;
    this.client_class = client_class;
    this.client_type = client_type;
    this.remote = remote;

    this.total_rx = total_rx;
    this.total_tx = total_tx;
    this.rx = rx;
    this.tx = tx;
    this.total_rx_init = total_rx_init;
    this.total_tx_init = total_tx_init;

    this.limit_rx = limit_rx;
    this.limit_tx = limit_tx;

    this.online_time = online_time;
    this.last_update_rate = last_update_rate;
    this.last_rx = last_rx;
    this.last_tx = last_tx;
  }

  static fromDict(data = {}) {
    return new ClientInfo({
      mac: data.mac || '',
      ip: data.ip || '',
      alias: data.alias || '',
      name: data.name || '',
      online: data.online || false,
      blocked: data.blocked || false,
      iface: data.iface || '',
      client_class: data.class || '',
      client_type: data.type || 0,
      remote: data.remote || false,
      total_rx: data.total_rx || 0,
      total_tx: data.total_tx || 0,
      rx: data.rx || 0,
      tx: data.tx || 0,
      total_rx_init: data.total_rx_init || 0,
      total_tx_init: data.total_tx_init || 0,
      limit_rx: data.limit_rx || 0,
      limit_tx: data.limit_tx || 0,
      online_time: data.online_time ?? null,
      last_update_rate: data.last_update_rate ?? null,
      last_rx: data.last_rx ?? null,
      last_tx: data.last_tx ?? null,
    });
  }

  get displayName() {
    if (this.alias) return this.alias;
    if (this.name) return this.name;
    return this.mac;
  }

  get totalBytes() {
    return this.total_rx + this.total_tx;
  }

  get isWifi() {
    return this.iface.toLowerCase().includes('wifi');
  }

  get isEthernet() {
    const ifaceLower = this.iface.toLowerCase();
    return ifaceLower.includes('cable') || ifaceLower.includes('eth');
  }

  formatBytes(bytesValue) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytesValue;
    for (const unit of units) {
      if (value < 1024.0) {
        return `${value.toFixed(1)} ${unit}`;
      }
      value /= 1024.0;
    }
    return `${value.toFixed(1)} PB`;
  }

  get totalRxFormatted() {
    return this.formatBytes(this.total_rx);
  }

  get totalTxFormatted() {
    return this.formatBytes(this.total_tx);
  }

  get totalBytesFormatted() {
    return this.formatBytes(this.totalBytes);
  }

  toString() {
    const status = this.online ? 'Online' : 'Offline';
    let connection = this.iface;
    if (this.isWifi) connection = 'WiFi';
    else if (this.isEthernet) connection = 'Ethernet';

    return `${this.displayName} (${this.ip}) - ${status} via ${connection} - ${this.totalBytesFormatted}`;
  }
}

module.exports = { ClientInfo };
