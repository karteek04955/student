const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("❌ MONGODB_URI environment variable is not defined in the environment or .env file!");
}

let client;
let db;

async function initializeDatabase() {
  if (db) return db;

  try {
    client = new MongoClient(uri);
    await client.connect();
    // Default db is extracted from the connection URI, or we use the connected database
    db = client.db(); 
    console.log('✅ Connected to MongoDB Atlas successfully');

    // Seed default incharge account if empty
    const inchargeColl = db.collection('incharge');
    const inchargeCount = await inchargeColl.countDocuments();
    if (inchargeCount === 0) {
      await inchargeColl.insertOne({
        username: 'incharge',
        password: 'incharge123'
      });
      console.log('✅ Default incharge account created: username=incharge, password=incharge123');
    }

    return db;
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB Atlas:', error);
    throw error;
  }
}

function getCollection(name) {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return db.collection(name);
}

module.exports = {
  initializeDatabase,
  getCollection,
  getDb: () => db,
  getClient: () => client
};
