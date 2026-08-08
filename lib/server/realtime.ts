import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 3001 });

export function broadcast(event: string, data: any) {
  const payload = JSON.stringify({ event, data });

  wss.clients.forEach((client) => {
    // @ts-ignore
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

console.log("⚡ Realtime WS running on :3001");