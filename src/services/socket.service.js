const { Server } = require("socket.io");
const supabase = require('../config/supabase');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  console.log("Socket.io initialized");

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // 1. ASTROLOGER PRESENCE
    socket.on("astrologer-online", async (astrologerId) => {
      console.log(`Astrologer ${astrologerId} is now online`);
      socket.join(`astro-${astrologerId}`);
      
      // Update DB status
      await supabase.from('astrologers').update({ status: 'online' }).eq('id', astrologerId);
      
      // Broadcast to users if needed
      io.emit("astrologer-status-changed", { id: astrologerId, status: 'online' });
    });

    socket.on("astrologer-offline", async (astrologerId) => {
      console.log(`Astrologer ${astrologerId} is now offline`);
      await supabase.from('astrologers').update({ status: 'offline' }).eq('id', astrologerId);
      io.emit("astrologer-status-changed", { id: astrologerId, status: 'offline' });
    });

    // 2. CHAT SESSIONS
    socket.on("join-chat", (sessionId) => {
      console.log(`Socket ${socket.id} joining session ${sessionId}`);
      socket.join(sessionId);
    });

    socket.on("send-msg", (data) => {
      // data: { sessionId, senderId, senderType, text, timestamp }
      console.log(`New message in ${data.sessionId}: ${data.text}`);
      io.to(data.sessionId).emit("receive-msg", data);
      
      // Optional: Persist to DB (if you have a messages table)
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

module.exports = { initSocket, getIO };
