const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(process.cwd(), 'meet-n-greet-db.json');

let dbCache = {
  rooms: {},
  agenda_items: {}
};

// Initialize database file if it doesn't exist, otherwise load into memory
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify(dbCache));
} else {
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    dbCache = JSON.parse(data);
  } catch (e) {
    console.error("Failed to parse DB on startup, using empty DB.", e);
  }
}

// Ensure all root keys exist in case of legacy db format
if (!dbCache.rooms) dbCache.rooms = {};
if (!dbCache.agenda_items) dbCache.agenda_items = {};

let writeTimeout = null;

// Async non-blocking write with debouncing
const writeDBAsync = () => {
  if (writeTimeout) clearTimeout(writeTimeout);
  
  // Debounce writes by 1 second to batch multiple fast updates
  writeTimeout = setTimeout(() => {
    // Stringify and write to a temp file, then rename for atomic write
    const tempPath = `${dbPath}.tmp`;
    fs.writeFile(tempPath, JSON.stringify(dbCache, null, 2), (err) => {
      if (err) {
        console.error("Failed to write temp db file", err);
        return;
      }
      fs.rename(tempPath, dbPath, (err) => {
        if (err) console.error("Failed to rename temp db file", err);
      });
    });
  }, 1000);
};

module.exports = {
  // Rooms
  ensureRoom: (roomId, adminSessionId) => {
    if (!dbCache.rooms[roomId]) {
      dbCache.rooms[roomId] = { id: roomId, createdAt: new Date().toISOString(), adminSessionId };
      writeDBAsync();
    } else if (adminSessionId && !dbCache.rooms[roomId].adminSessionId) {
      dbCache.rooms[roomId].adminSessionId = adminSessionId;
      writeDBAsync();
    }
  },
  
  getRoomAdmin: (roomId) => {
    return dbCache.rooms[roomId] ? dbCache.rooms[roomId].adminSessionId : null;
  },

  // Conversations are ephemeral and no longer saved to DB
  
  // Agenda
  getAgendaItems: (roomId) => {
    const roomAgenda = dbCache.agenda_items[roomId] || {};
    return Object.values(roomAgenda);
  },
  saveAgendaItem: (item) => {
    if (!dbCache.agenda_items[item.roomId]) {
      dbCache.agenda_items[item.roomId] = {};
    }
    dbCache.agenda_items[item.roomId][item.id] = item;
    writeDBAsync();
  },


};
