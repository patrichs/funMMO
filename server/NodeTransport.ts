import {createServer,type IncomingMessage} from 'node:http';
import {WebSocketServer,type WebSocket} from 'ws';
import {Transport,matchMaker,connectClientToRoom} from '@colyseus/core';
import {WebSocketClient} from '@colyseus/ws-transport/WebSocketClient';

// Colyseus's public transport interface with its existing wire-protocol client.
// HTTP routes are bound by Colyseus core directly to Node's server. No Express
// application (or qs parser) is needed by this prototype.
export class NodeTransport extends Transport {
  server=createServer({maxHeaderSize:8192,requestTimeout:10000,headersTimeout:10000});
  private sockets=new WebSocketServer({server:this.server,maxPayload:2048,perMessageDeflate:false});
  private alive=new Map<WebSocket,boolean>();
  private heartbeat:ReturnType<typeof setInterval>;
  constructor() {
    super();
    this.sockets.on('connection',(socket,request)=>{
      this.alive.set(socket,true);
      socket.on('pong',()=>this.alive.set(socket,true));
      socket.on('close',()=>this.alive.delete(socket));
      socket.on('error',()=>socket.terminate());
      void this.attachClient(socket,request);
    });
    this.sockets.on('error',error=>console.error('WebSocket transport error:',error.message));
    this.heartbeat=setInterval(()=>{
      for(const [socket,alive] of this.alive) {
        if(!alive){socket.terminate();continue;}
        this.alive.set(socket,false);socket.ping();
      }
    },5000);
    this.heartbeat.unref();
    this.server.on('close',()=>clearInterval(this.heartbeat));
  }
  listen(port:number|string=2567,hostname='127.0.0.1',backlog?:number,listener?:Function):this {
    this.server.listen({port:Number(port),host:hostname,backlog},()=>listener?.());
    return this;
  }
  shutdown() {
    clearInterval(this.heartbeat);
    for(const socket of this.sockets.clients)socket.terminate();
    this.sockets.close();this.server.close();
  }
  simulateLatency(milliseconds:number) {
    if(milliseconds!==0)throw new Error('Use a network proxy for latency testing with NodeTransport.');
  }
  private async attachClient(socket:WebSocket,request:IncomingMessage) {
    try {
      const url=new URL(request.url ?? '/','http://localhost');
      const match=/^\/[A-Za-z0-9_-]{1,64}\/([A-Za-z0-9_-]{1,64})$/.exec(url.pathname);
      const sessionId=url.searchParams.get('sessionId');
      if(!match || !sessionId || !/^[A-Za-z0-9_-]{1,64}$/.test(sessionId)){socket.close(1008,'Invalid room connection');return;}
      const room=matchMaker.getLocalRoomById(match[1]);
      const client=new WebSocketClient(sessionId,socket);
      const headers=new Headers();
      for(const [key,value] of Object.entries(request.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);
      await connectClientToRoom(room,client,{headers,ip:request.socket.remoteAddress},{reconnectionToken:url.searchParams.get('reconnectionToken') ?? undefined,skipHandshake:false});
    }catch{socket.close(1008,'Room reservation expired');}
  }
}
