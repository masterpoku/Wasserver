const axios = require('axios');
const fs = require('fs');
const dotenv = require('dotenv');
const whatsapp = require('wa-multi-session');
dotenv.config();

// URL Firebase Realtime Database
const FIREBASE_URL = process.env.FIREBASE_URL;

// URL Telegram Bot API
const TELEGRAM_BOT_API = process.env.TELEGRAM_BOT_API;

// Variabel untuk menyimpan data sementara


// Daftar session untuk round-robin
let sessionList = ["session1", "session2", "session3"]; // Ganti dengan sesi yang sesuai
let currentSessionIndex = 0;


module.exports = {processLoop};