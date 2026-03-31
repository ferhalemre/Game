import jwt from 'jsonwebtoken';

export function setupSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Oyuncu bağlandı: ${socket.userId}`);

    // Kullanıcı odasına katıl
    socket.join(`user:${socket.userId}`);

    // Köy odasına katıl
    socket.on('village:join', (villageId) => {
      socket.join(`village:${villageId}`);
    });

    socket.on('village:leave', (villageId) => {
      socket.leave(`village:${villageId}`);
    });

    // Klan chat
    socket.on('clan:join', (clanId) => {
      socket.join(`clan:${clanId}`);
    });

    socket.on('clan:message', async (data) => {
      const { clanId, message } = data;
      io.to(`clan:${clanId}`).emit('clan:message', {
        userId: socket.userId,
        message,
        timestamp: new Date()
      });
    });

    // Harita odasına katıl (chunk bazlı)
    socket.on('map:subscribe', ({ x, y, range }) => {
      socket.join(`map:${x}:${y}`);
    });

    socket.on('disconnect', () => {
      console.log(`Oyuncu ayrıldı: ${socket.userId}`);
    });
  });
}
