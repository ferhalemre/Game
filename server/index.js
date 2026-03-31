import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import connectDB from './config/db.js';
import { setupSocket } from './socket/index.js';
import { startGameTick } from './services/gameTickService.js';
import errorHandler from './middleware/errorHandler.js';

// Routes
import authRoutes from './routes/auth.js';
import villageRoutes from './routes/village.js';
import mapRoutes from './routes/map.js';
import commandRoutes from './routes/command.js';
import clanRoutes from './routes/clan.js';
import marketRoutes from './routes/market.js';
import rankingRoutes from './routes/ranking.js';
import messageRoutes from './routes/message.js';
import adminRoutes from './routes/admin.js';
import { auth } from './middleware/auth.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());
app.set('io', io);

// Statik dosyalar (admin panel)
app.use('/admin', express.static('admin'));

// Production: serve client build
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist/client')));
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/villages', auth, villageRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/clans', clanRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/rankings', rankingRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);

// Production: SPA fallback
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/client/index.html'));
  });
}

// Error handler
app.use(errorHandler);

// Socket.io setup
setupSocket(io);

// Start
const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🏰 KlanSavasi sunucusu port ${PORT} üzerinde çalışıyor`);
    startGameTick(io);
  });
});
