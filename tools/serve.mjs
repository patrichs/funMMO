import {createServer} from 'vite';
import {startServer} from '../build/server/index.js';
const game = await startServer(2567);
const web = await createServer();
await web.listen();
web.printUrls();
const stop = async () => {await web.close(); await game.gracefullyShutdown(false); process.exit(0);};
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
