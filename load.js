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
let temporaryData = {};

// Flag untuk mencegah tumpang tindih proses
let isProcessing = false;

// Daftar session untuk round-robin
let sessionList = ["session1", "session2", "session3"]; // Ganti dengan sesi yang sesuai
let currentSessionIndex = 0;

// Fungsi untuk mengambil data dari Firebase
const getDataFromFirebase = async (path) => {
    try {
        const response = await axios.get(`${FIREBASE_URL}/${path}.json`);
        temporaryData = response.data || {}; // Simpan data ke temporaryData dari Firebase
        return temporaryData;
    } catch (error) {
        console.error('Error mengambil data dari Firebase:', error);
        return null;
    }
};

// Fungsi untuk memperbarui status data menjadi true
const updateStatusInFirebase = async (path, key) => {
    try {
        await axios.patch(`${FIREBASE_URL}/${path}/${key}.json`, { status: true });
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
                chat_id: '406423057', // Ganti dengan ID chat Telegram yang sesuai
                text: message,
            },
        });
        console.log('Notifikasi Telegram berhasil dikirim:', response.data);
    } catch (error) {
        console.error('Error mengirim notifikasi Telegram:', error);
    }
};

// Fungsi untuk sleep/delay
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
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
                console.log('Tunggu 10 detik');
                await sleep(10000);
                count++;
            } else {
                console.log(`Data ${key} sudah memiliki status true, dilewati.`);
            }
        }

        // Jika semua data sudah diproses
        if (count === 0) {
            fs.writeFileSync('status.txt', '1'); // Ubah status menjadi 1 setelah selesai
            console.log('Semua data selesai diproses.');
        }
    } else {
        console.log('Tidak ada data yang ditemukan di Firebase.');
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
            to: to,
            duration: 3000,
        });

        // Mengirimkan pesan teks
        await whatsapp.sendTextMessage({
            sessionId,
            to,
            text
        });

        saveNumberToFile(`62${to}`);

        // Update jumlah pesan yang dikirim di Firebase
        let currentCount = await getMessageCountFromFirebase(sessionId);
        currentCount += 1;
        await updateMessageCountInFirebase(sessionId, currentCount);

        console.log(`Message sent with session ${sessionId} to ${to}: ${text}`);
    } catch (error) {
        console.error('Error sending message:', error);
        throw new Error('Failed to send message');
    }
};


// Fungsi utama yang akan terus melakukan loop dan memproses data
const processLoop = async () => {
    const status = fs.readFileSync('status.txt', 'utf-8');

    if (status === '0') {
        await loopThroughData('sms');

        // Jika selesai, kirim notifikasi Telegram
        if (fs.readFileSync('status.txt', 'utf-8') === '1') {
            await sendTelegramNotification('Semua data telah diproses.');
        }
    } else {
        console.log("Tidak ada data baru untuk diproses.");
    }

    setTimeout(processLoop, 10000); // 10 detik
};

// Mulai proses looping
processLoop();

module.exports = {processLoop};