import {Server} from '@colyseus/core';
import {NodeTransport} from './NodeTransport.js';
import {WorldRoom} from './WorldRoom.js';
export async function startServer(port:number) {
  const server=new Server({transport:new NodeTransport(),greet:false,gracefullyShutdown:false});
  server.define('embervale',WorldRoom);
  await server.listen(port,'0.0.0.0');
  return server;
}
