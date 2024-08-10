const express = require('express');
const whatsapp = require('wa-multi-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');
const QRCode = require('qrcode'); // Import qrcode package
const {processLoop} = require('./load')
// Inisialisasi aplikasi Express
dotenv.config();
const app = express();
const port = 3000;
const FIREBASE_URL = process.env.FIREBASE_URL; // Masukkan URL Firebase Anda di file .env

// URL Telegram Bot API
const TELEGRAM_BOT_API = process.env.TELEGRAM_BOT_API; // Masukkan URL Telegram Bot API Anda di file .env

// Middleware untuk parse JSON
app.use(bodyParser.json());

// Baca folder sesi
const sessionDir = './wa_credentials';
let sessions = new Set();
let sessionList = [];
let currentSessionIndex = 0;

const numbersFilePath = path.join(__dirname, 'numbers.txt');

// Function to save number to file
const saveNumberToFile = (number) => {
  fs.appendFile(numbersFilePath, `${number}\n`, (err) => {
    if (err) {
      console.error('Error saving number to file:', err);
    } else {
      console.log(`Number ${number} saved to file.`);
    }
  });
};

// Function to check if number is in the file
const isNumberInFile = async (number) => {
  try {
    const data = await fs.promises.readFile(numbersFilePath, 'utf8');
    const numbers = data.split('\n').map(num => num.trim()).filter(num => num.length > 0);
    return numbers.includes(number);
  } catch (err) {
    console.error('Error reading numbers file:', err);
    return false;
  }
};

// Function to get message count from Firebase
const getMessageCountFromFirebase = async (sessionId) => {
  try {
    const response = await axios.get(`${process.env.FIREBASE_URL}/message_counts/${sessionId}.json`);
    return response.data ? response.data.count : 0;
  } catch (error) {
    console.error('Error fetching message count from Firebase:', error);
    return 0;
  }
};

// Function to update message count in Firebase
const updateMessageCountInFirebase = async (sessionId, count) => {
  try {
    await axios.patch(`${process.env.FIREBASE_URL}/message_counts/${sessionId}.json`, { count });
    console.log(`Message count updated to ${count} for session ${sessionId}`);
  } catch (error) {
    console.error('Error updating message count in Firebase:', error);
  }
};

// Mulai sesi WhatsApp
const initializeSessions = async () => {
  try {
    const sessionFolders = fs.readdirSync(sessionDir).map(file => file.replace('_credentials', ''));
    processLoop();
    // Handle QR Code updates
    whatsapp.onQRUpdated(async ({ sessionId, qr }) => {
      console.log(`QR Code for session ${sessionId}: ${qr}`);

      // Save QR code as PNG file
      try {
        await QRCode.toFile(path.join(__dirname, `./qrcodes/qr_${sessionId}.png`), qr);
        console.log(`QR Code saved to qr_${sessionId}.png`);
      } catch (err) {
        console.error('Error saving QR Code:', err);
      }

    });

    whatsapp.onConnected((sessionId) => {
      console.log(`Session connected: ${sessionId}`);
      const qrFilePath = path.join(__dirname, `/qrcodes/qr_${sessionId}.png`);
      if (fs.existsSync(qrFilePath)) {
        fs.unlinkSync(qrFilePath);
        console.log(`QR Code file deleted for session ${sessionId}`);
      }
    });

    whatsapp.onDisconnected((sessionId) => {
      sessions.delete(sessionId);
      sessionList = sessionList.filter(session => session !== sessionId);
      console.log(`Session disconnected: ${sessionId}`);
      // You can implement further logic to handle session disconnection
    });

    whatsapp.onMessageReceived(async (msg) => {
      const phone = msg.key.remoteJid.replace('@s.whatsapp.net', '');
      if (await isNumberInFile(phone)) {
        let pesan = null; // Default value
        await whatsapp.readMessage({
          sessionId: msg.sessionId,
          key: msg.key,
        });
        // Check if 'fromMe' property is true, then set 'pesan' to null
        if (msg.key.fromMe === true) {
          pesan = null;
        } else {
          pesan = msg.message?.extendedTextMessage && msg.message?.extendedTextMessage.text ? msg.message?.extendedTextMessage.text : "";
          if (pesan.trim() === "") { // Check if text is empty or whitespace
            pesan = msg.message?.conversation || ""; // Use conversation from msg.message if text is empty
          }
        }

        if (pesan !== null) {
          const messageData = {
            from: phone,
            message: pesan,
            session: msg.sessionId
          };

          try {
            await axios.post(`${process.env.FIREBASE_URL}/received.json`, messageData);
            console.log(`Message logged to Firebase for session ${msg.sessionId}`);
          } catch (error) {
            console.error('Error logging message to Firebase:', error);
          }
        }
      }
      pesan = msg.message?.extendedTextMessage && msg.message?.extendedTextMessage.text ? msg.message?.extendedTextMessage.text : "";
      if (!msg.key.fromMe) {
        console.log(`New Message Received on Session ${msg.sessionId}:`);
        console.log(`From: ${phone}`);
        console.log(`Pesan: ${pesan}`);
        console.log('--------------------------------------------------------');
      }
    });

    // Mulai semua sesi
    for (const sessionId of sessionFolders) {
      try {
        await whatsapp.startSession(sessionId);
        sessions.add(sessionId);
        sessionList.push(sessionId); // Store session IDs in order
        console.log(`Session ${sessionId} started`);
      } catch (error) {
        console.error(`Error starting session ${sessionId}:`, error);
      }
    }

    console.log('WhatsApp sessions initialized. Waiting for requests...');
  } catch (error) {
    console.error('Error initializing sessions:', error);
    throw error; // Rethrow error to handle it in the .then() chain
  }
};


// Endpoint untuk mengambil QR Code pada folder qrcodes
app.get('/qrcode/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const filePath = path.join(__dirname, `./qrcodes/qr_${sessionId}.png`);

  try {
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'image/png');
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.status(404).json({ error: 'QR Code not found' });
    }
  } catch (error) {
    console.error('Error serving QR Code:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
// ready to satrt sending for change status with 0
app.put('/status', async (req, res) => {
  const { status } = req.body;
  if (status === '0' || status === '1') {
      fs.writeFileSync('status.txt', status);
      res.json({ message: 'Status updated successfully' });
  } else {
      res.status(400).json({ error: 'Invalid status' });
  }
});
// Endpoint untuk membuat sesi baru
app.get('/create', async (req, res) => {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ error: 'Session name is required' });
  }

  if (sessions.has(name)) {
    return res.status(400).json({ error: `Session ${name} already exists` });
  }

  try {
    await whatsapp.startSession(name);
    sessions.add(name);
    sessionList.push(name);
    // res.json({ message: `Session ${name} created successfully >> please wait for a few seconds` });
    setTimeout(() => {
      res.redirect(`/qrcode/${name}`);
    }, 5000);

    
  } catch (error) {
    console.error(`Error creating session ${name}:`, error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Endpoint untuk mendapatkan semua sesi
app.get('/get', async (req, res) => {
  const sessions = whatsapp.getAllSession();
  res.json(sessions);
});

// Endpoint untuk mengirim pesan
app.post('/send-message', async (req, res) => {
  let { sessionId, to, text } = req.body;

  if (!to || !text) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (sessionId && !sessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid sessionId' });
  }

  if (!sessionId) {
    // Use round-robin to select the next session
    sessionId = sessionList[currentSessionIndex];
    currentSessionIndex = (currentSessionIndex + 1) % sessionList.length; // Move to the next session

    if (sessionId === undefined) {
      return res.status(200).json({ message: "Kami Sedang Perbaikan Silahkan Hubungi Pelayanan" });
    }
  }

  try {
    await whatsapp.sendTyping({
      sessionId: sessionId,
      to: to,
      duration: 3000,
    });
    await whatsapp.sendTextMessage({
      sessionId,
      to,
      text
    });

    saveNumberToFile(`62${to}`);

    let currentCount = await getMessageCountFromFirebase(sessionId);
    currentCount += 1;
    await updateMessageCountInFirebase(sessionId, currentCount);

    res.json({ message: `Message sent with session ${sessionId} to ${to}: ${text}` });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Inisialisasi sesi dan mulai server
initializeSessions()
  .then(() => app.listen(port, () => console.log(`Server listening on port ${port}`)))
  .catch(error => {
    console.error('Failed to initialize WhatsApp sessions:', error);
    process.exit(1);
  });
