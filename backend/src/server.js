import app from './app.js';
import { env } from './config/env.js';
import { initializeDatabase } from './database/db.js';

initializeDatabase();

const server = app.listen(env.port, () => {
  console.log(`BSE Trade Intelligence backend running on http://localhost:${env.port}`);
});

const gracefulShutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export default server;
