import crypto from 'node:crypto';

const clients = new Set();

export function attachSSEClient(req, res) {
  const clientId = crypto.randomUUID();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, timestamp: new Date().toISOString() })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (error) {
      cleanupClient(res, heartbeat);
    }
  }, 15000);

  clients.add(res);

  req.on('close', () => {
    cleanupClient(res, heartbeat);
  });

  return clientId;
}

function cleanupClient(res, heartbeat) {
  if (heartbeat) {
    clearInterval(heartbeat);
  }

  clients.delete(res);
}

export function broadcastEvent(eventName, payload) {
  const serialized = JSON.stringify(payload);

  for (const res of Array.from(clients)) {
    try {
      res.write(`event: ${eventName}\ndata: ${serialized}\n\n`);
    } catch (error) {
      cleanupClient(res);
    }
  }
}

export function getSSEConnectionCount() {
  return clients.size;
}
