const { WebSocketServer } = require('ws');

// Salas: sessionId -> { screen: ws, remotes: [ws] }
const rooms = new Map();

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const sessionId = url.searchParams.get('session');
    const role = url.searchParams.get('role'); // 'screen' | 'remote'

    if (!sessionId) { ws.close(); return; }

    // Inicializar sala
    if (!rooms.has(sessionId)) rooms.set(sessionId, { screen: null, remotes: [] });
    const room = rooms.get(sessionId);

    if (role === 'screen') {
      room.screen = ws;
      console.log(`Screen conectada: ${sessionId}`);
      ws.send(JSON.stringify({ type: 'connected', role: 'screen' }));
    } else {
      room.remotes.push(ws);
      console.log(`Remote conectado: ${sessionId}`);
      ws.send(JSON.stringify({ type: 'connected', role: 'remote' }));
      // Notificar a la pantalla que hay un control conectado
      if (room.screen?.readyState === 1) {
        room.screen.send(JSON.stringify({ type: 'remote_connected' }));
      }
    }

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const room = rooms.get(sessionId);
        if (!room) return;

        if (role === 'remote' && room.screen?.readyState === 1) {
          // Remote -> Screen: comandos de control
          room.screen.send(JSON.stringify(msg));
        } else if (role === 'screen') {
          // Screen -> Remotes: estado actual (velocidad, posición)
          room.remotes.forEach(r => {
            if (r.readyState === 1) r.send(JSON.stringify(msg));
          });
        }
      } catch (e) { console.error('WS error:', e.message); }
    });

    ws.on('close', () => {
      const room = rooms.get(sessionId);
      if (!room) return;
      if (role === 'screen') {
        room.screen = null;
        // Notificar remotes
        room.remotes.forEach(r => {
          if (r.readyState === 1) r.send(JSON.stringify({ type: 'screen_disconnected' }));
        });
      } else {
        room.remotes = room.remotes.filter(r => r !== ws);
      }
      // Limpiar sala vacía
      if (!room.screen && room.remotes.length === 0) rooms.delete(sessionId);
    });

    ws.on('error', (e) => console.error('WS error:', e.message));
  });

  console.log('WebSocket listo en /ws');
}

module.exports = { setupWebSocket };
