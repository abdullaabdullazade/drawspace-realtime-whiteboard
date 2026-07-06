import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000/canvas';

let socket: Socket | null = null;
let currentToken: string | null = null;

export function getSocket(token?: string | null): Socket {
  const key = token ?? '';
  if (socket && socket.connected && currentToken === key) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = key;

  socket = io(SOCKET_URL, {
    // No token → connect as anonymous guest (public boards only)
    auth: token ? { token } : {},
    // Polling only — reliable everywhere (some browsers/proxies block ws://).
    // Real-time still works over long-polling; avoids the ws upgrade failure.
    transports: ['polling'],
    upgrade: false,
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 800,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}

export function getExistingSocket(): Socket | null {
  return socket;
}
