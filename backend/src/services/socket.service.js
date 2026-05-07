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

    socket.on("send-msg", async (data) => {
      // data: { sessionId, senderId, senderType, text, timestamp }
      console.log(`New message in ${data.sessionId}: ${data.text}`);
      
      // 1. Broadcast to other participants in the session
      io.to(data.sessionId).emit("receive-msg", data);
      
      // 2. Persist to DB for history and admin review
      try {
        const { error } = await supabase
          .from('messages')
          .insert({
            session_id:  data.sessionId,
            sender_id:   data.senderId,
            sender_type: data.senderType,
            text:        data.text,
            is_system:   false
          });
        
        if (error) console.error("Error persisting socket message:", error);
      } catch (err) {
        console.error("Socket persistence exception:", err);
      }
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

const notifyAstrologer = (astrologerId, event, data) => {
  if (!io) {
    console.warn("Socket.io not initialized, cannot notify astrologer");
    return;
  }
  console.log(`Notifying astrologer ${astrologerId} with event ${event}`);
  io.to(`astro-${astrologerId}`).emit(event, data);
};

module.exports = { initSocket, getIO, notifyAstrologer };
