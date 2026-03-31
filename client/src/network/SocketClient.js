import { io } from 'socket.io-client';

class SocketClient {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect(token) {
    if (this.socket) this.socket.disconnect();

    this.socket = io({
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });

    this.socket.on('connect', () => {
      console.log('Socket bağlandı');
      this.emit('connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket bağlantısı kesildi:', reason);
      this.emit('disconnected', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket bağlantı hatası:', err.message);
    });

    // Oyun eventlerini dinle
    const gameEvents = [
      'village:buildComplete', 'village:troopComplete',
      'village:supportArrived', 'command:incoming',
      'command:returned', 'command:completed',
      'battle:report', 'clan:message',
      'message:new', 'announcement',
      'ranking:updated'
    ];

    gameEvents.forEach(event => {
      this.socket.on(event, (data) => {
        this.emit(event, data);
      });
    });
  }

  joinVillage(villageId) {
    this.socket?.emit('village:join', villageId);
  }

  leaveVillage(villageId) {
    this.socket?.emit('village:leave', villageId);
  }

  joinClan(clanId) {
    this.socket?.emit('clan:join', clanId);
  }

  sendClanMessage(clanId, message) {
    this.socket?.emit('clan:message', { clanId, message });
  }

  // Event system
  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      this.listeners.set(event, cbs.filter(cb => cb !== callback));
    }
  }

  emit(event, data) {
    const cbs = this.listeners.get(event);
    if (cbs) cbs.forEach(cb => cb(data));
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const socketClient = new SocketClient();
