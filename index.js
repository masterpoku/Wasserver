const express = require("express");
const whatsapp = require("wa-multi-session");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const axios = require("axios");
const QRCode = require("qrcode"); // Import qrcode package
// Inisialisasi aplikasi Express
dotenv.config();
const app = express();
const port = 40000;
const FIREBASE_URL = process.env.FIREBASE_URL; // Masukkan URL Firebase Anda di file .env

// URL Telegram Bot API
const TELEGRAM_BOT_API = process.env.TELEGRAM_BOT_API; // Masukkan URL Telegram Bot API Anda di file .env

// Middleware untuk parse JSON
app.use(bodyParser.json());

// Baca folder sesi
const sessionDir = "./wa_credentials";
let sessions = new Set();
let sessionList = [];
let currentSessionIndex = 0;

const numbersFilePath = path.join(__dirname, "numbers.txt");

let temporaryData = {};

// Flag untuk mencegah tumpang tindih proses
let isProcessing = false;
// Fungsi untuk mengambil data dari Firebase
const getDataFromFirebase = async (path) => {
  try {
    const response = await axios.get(`${FIREBASE_URL}/${path}.json`);
    temporaryData = response.data || {}; // Simpan data ke temporaryData dari Firebase
    return temporaryData;
  } catch (error) {
    console.error("Error mengambil data dari Firebase:", error);
    return null;
  }
};

// Fungsi untuk memperbarui status data menjadi true
const updateStatusInFirebase = async (path, key) => {
  try {
    await axios.patch(`${FIREBASE_URL}/${path}/${key}.json`, {
      status: true
    });
    console.log(`Status data ${key} diperbarui menjadi true`);
  } catch (error) {
    console.error(`Error memperbarui status data ${key}:`, error);
  }
};

// Fungsi untuk mengirim notifikasi ke Telegram
const sendTelegramNotification = async (message) => {
  try {
    const response = await axios.get(`${TELEGRAM_BOT_API}/sendMessage`, {
      params: {
        chat_id: "406423057", // Ganti dengan ID chat Telegram yang sesuai
        text: message,
      },
    });
    console.log("Notifikasi Telegram berhasil dikirim:", response.data);
  } catch (error) {
    console.error("Error mengirim notifikasi Telegram:", error);
  }
};

// Fungsi untuk sleep/delay
const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Fungsi untuk loop melalui data dengan delay
const loopThroughData = async (path) => {
  if (isProcessing) return; // Jangan mulai proses baru jika yang lama belum selesai
  isProcessing = true;

  const data = await getDataFromFirebase(path); // Perbarui temporaryData dengan data dari Firebase

  if (data) {
    const keys = Object.keys(data);
    let count = 0;

    for (const key of keys) {
      const item = data[key];

      // Cek apakah status masih false dan item belum dihapus dari temporaryData
      if (item && item.status === false && temporaryData[key]) {
        console.log(`Menampilkan data ${key}:`, item);

        // Kirim permintaan ke server lokal
        await sendRequest(item.to, item.message);

        // Perbarui status data menjadi true setelah dikirim
        await updateStatusInFirebase(path, key);

        // Hapus data dari temporaryData setelah diproses
        delete temporaryData[key];

        // Delay 10 detik sebelum mengambil data berikutnya
        console.log("Tunggu 30 detik");
        await sleep(30000);
        count++;
      } else {
        console.log(`Data ${key} sudah memiliki status true, dilewati.`);
      }
    }

    // Jika semua data sudah diproses
    if (count === 0) {
      fs.writeFileSync("status.txt", "1"); // Ubah status menjadi 1 setelah selesai
      console.log("Semua data selesai diproses.");
    }
  } else {
    console.log("Tidak ada data yang ditemukan di Firebase.");
  }

  isProcessing = false; // Selesai memproses, siap untuk loop berikutnya
};

// Fungsi untuk mengirim permintaan ke server lokal
const sendRequest = async (to, text) => {
  // Melakukan validasi pada `to` dan `text`
  if (!to || !text) {
    throw new Error('Missing required fields: "to" and "text" are required.');
  }

  let sessionId;

  if (!sessionId) {
    // Gunakan metode round-robin untuk memilih session berikutnya
    sessionId = sessionList[currentSessionIndex];
    currentSessionIndex = (currentSessionIndex + 1) % sessionList.length; // Pindah ke sesi berikutnya

    if (!sessionId) {
      throw new Error("No available sessions. Please try again later.");
    }
  }

  try {
    // Mengirimkan indikasi typing
    await whatsapp.sendTyping({
      sessionId: sessionId,
      to: `62${to}`,
      duration: 3000,
    });

    // Mengirimkan pesan teks
    await whatsapp.sendTextMessage({
      sessionId,
      to: `62${to}`,
      text,
    });

    saveNumberToFile(`62${to}`);

    // Update jumlah pesan yang dikirim di Firebase
    let currentCount = await getMessageCountFromFirebase(sessionId);
    currentCount += 1;
    await updateMessageCountInFirebase(sessionId, currentCount);

    console.log(`Message sent with session ${sessionId} to ${to}: ${text}`);
  } catch (error) {
    console.error("Error sending message:", error);
    throw new Error("Failed to send message");
  }
};

// Fungsi utama yang akan terus melakukan loop dan memproses data
const processLoop = async () => {
  const status = fs.readFileSync("status.txt", "utf-8");

  if (status === "0") {
    await loopThroughData("sms");

    // Jika selesai, kirim notifikasi Telegram
    if (fs.readFileSync("status.txt", "utf-8") === "1") {
      await sendTelegramNotification("Semua data telah diproses.");
    }
  } else {
    console.log("Tidak ada data baru untuk diproses.");
  }

  setTimeout(processLoop, 10000); // 10 detik
};

// Function to save number to file
const saveNumberToFile = (number) => {
  fs.appendFile(numbersFilePath, `${number}\n`, (err) => {
    if (err) {
      console.error("Error saving number to file:", err);
    } else {
      console.log(`Number ${number} saved to file.`);
    }
  });
};

// Function to check if number is in the file
const isNumberInFile = async (number) => {
  try {
    const data = await fs.promises.readFile(numbersFilePath, "utf8");
    const numbers = data
      .split("\n")
      .map((num) => num.trim())
      .filter((num) => num.length > 0);
    return numbers.includes(number);
  } catch (err) {
    console.error("Error reading numbers file:", err);
    return false;
  }
};

// Function to get message count from Firebase
const getMessageCountFromFirebase = async (sessionId) => {
  try {
    const response = await axios.get(
      `${process.env.FIREBASE_URL}/message_counts/${sessionId}.json`,
    );
    return response.data ? response.data.count : 0;
  } catch (error) {
    console.error("Error fetching message count from Firebase:", error);
    return 0;
  }
};

// Function to update message count in Firebase
const updateMessageCountInFirebase = async (sessionId, count) => {
  try {
    await axios.patch(
      `${process.env.FIREBASE_URL}/message_counts/${sessionId}.json`, {
        count
      },
    );
    console.log(`Message count updated to ${count} for session ${sessionId}`);
  } catch (error) {
    console.error("Error updating message count in Firebase:", error);
  }
};

// Mulai sesi WhatsApp
const initializeSessions = async () => {
  try {
    const sessionFolders = fs
      .readdirSync(sessionDir)
      .map((file) => file.replace("_credentials", ""));

    // Handle QR Code updates
    whatsapp.onQRUpdated(async ({
      sessionId,
      qr
    }) => {
      console.log(`QR Code for session ${sessionId}: ${qr}`);

      // Save QR code as PNG file
      try {
        await QRCode.toFile(
          path.join(__dirname, `./qrcodes/qr_${sessionId}.png`),
          qr,
        );
        console.log(`QR Code saved to qr_${sessionId}.png`);
      } catch (err) {
        console.error("Error saving QR Code:", err);
      }
    });

    whatsapp.onConnected((sessionId) => {
      console.log(`Session connected: ${sessionId}`);
      const qrFilePath = path.join(__dirname, `/qrcodes/qr_${sessionId}.png`);
      if (fs.existsSync(qrFilePath)) {
        fs.unlinkSync(qrFilePath);
        console.log(`QR Code file deleted for session ${sessionId}`);
      }
      processLoop();
    });

    whatsapp.onDisconnected((sessionId) => {
      sessions.delete(sessionId);
      sessionList = sessionList.filter((session) => session !== sessionId);
      console.log(`Session disconnected: ${sessionId}`);
      // You can implement further logic to handle session disconnection
    });

    whatsapp.onMessageReceived(async (msg) => {
      const phone = msg.key.remoteJid.replace("@s.whatsapp.net", "");
      let pesan = null; // Default value
      if (msg.key.fromMe === true) {
        pesan = null;
      } else {
        //pesan = message.extendedTextMessage && message.extendedTextMessage.text ? message.extendedTextMessage.text : "";
        pesan =
          msg.message.extendedTextMessage &&
          msg.message.extendedTextMessage.text ?
          msg.message.extendedTextMessage.text :
          "";
        if (pesan.trim() === "") {
          // Check if text is empty or whitespace
          pesan = msg.message.conversation || ""; // Use conversation from msg.message if text is empty
        }
      }
      if (await isNumberInFile(phone)) {
        console.log("ada");
        if (pesan) {
          const messageData = {
            from: phone,
            message: pesan,
            session: msg.sessionId,
          };

          try {
            await axios.post(
              `${process.env.FIREBASE_URL}/received.json`,
              messageData,
            );
            console.log(
              `Message logged to Firebase for session ${msg.sessionId}`,
            );
          } catch (error) {
            console.error("Error logging message to Firebase:", error);
          }
        }
      }

      console.log(`New Message Received on Session ${msg.sessionId}:`);
      console.log(`From: ${phone}`);
      console.log(`Pesan: ${pesan}`);
      console.log("--------------------------------------------------------");
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

    console.log("WhatsApp sessions initialized. Waiting for requests...");
  } catch (error) {
    console.error("Error initializing sessions:", error);
    throw error; // Rethrow error to handle it in the .then() chain
  }
};

// Endpoint untuk mengambil QR Code pada folder qrcodes
app.get("/qrcode/:sessionId", async (req, res) => {
  const {
    sessionId
  } = req.params;
  const filePath = path.join(__dirname, `./qrcodes/qr_${sessionId}.png`);

  try {
    if (fs.existsSync(filePath)) {
      res.setHeader("Content-Type", "image/png");
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.status(404).json({
        error: "QR Code not found"
      });
    }
  } catch (error) {
    console.error("Error serving QR Code:", error);
    res.status(500).json({
      error: "Internal Server Error"
    });
  }
});
// ready to satrt sending for change status with 0
app.put("/status", async (req, res) => {
  const {
    status
  } = req.body;
  if (status === "0" || status === "1") {
    fs.writeFileSync("status.txt", status);
    res.json({
      message: "Status updated successfully"
    });
  } else {
    res.status(400).json({
      error: "Invalid status"
    });
  }
});
// Endpoint untuk membuat sesi baru
app.get("/create", async (req, res) => {
  const {
    name
  } = req.query;

  if (!name) {
    return res.status(400).json({
      error: "Session name is required"
    });
  }

  if (sessions.has(name)) {
    return res.status(400).json({
      error: `Session ${name} already exists`
    });
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
    res.status(500).json({
      error: "Failed to create session"
    });
  }
});

// Endpoint untuk mendapatkan semua sesi
app.get("/get", async (req, res) => {
  const sessions = whatsapp.getAllSession();
  res.json(sessions);
});

// Endpoint untuk mengirim pesan
app.post("/send-message", async (req, res) => {
  let {
    sessionId,
    to,
    text
  } = req.body;

  if (!to || !text) {
    return res.status(400).json({
      error: "Missing required fields"
    });
  }

  if (sessionId && !sessions.has(sessionId)) {
    return res.status(400).json({
      error: "Invalid sessionId"
    });
  }

  if (!sessionId) {
    // Use round-robin to select the next session
    sessionId = sessionList[currentSessionIndex];
    currentSessionIndex = (currentSessionIndex + 1) % sessionList.length; // Move to the next session

    if (sessionId === undefined) {
      return res
        .status(200)
        .json({
          message: "Kami Sedang Perbaikan Silahkan Hubungi Pelayanan"
        });
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
      text,
    });

    saveNumberToFile(to);

    let currentCount = await getMessageCountFromFirebase(sessionId);
    currentCount += 1;
    await updateMessageCountInFirebase(sessionId, currentCount);

    res.json({
      message: `Message sent with session ${sessionId} to ${to}: ${text}`,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({
      error: "Failed to send message"
    });
  }
});

// Inisialisasi sesi dan mulai server

// Inisialisasi sesi dan mulai server

initializeSessions()
  .then(() =>
    app.listen(port, () => console.log(`Server listening on port ${port}`)),
  )
  .catch((error) => {
    console.error("Failed to initialize WhatsApp sessions:", error);
    process.exit(1);
  });