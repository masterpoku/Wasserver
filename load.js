const express = require('express');
const axios = require('axios');
const fs = require('fs');
const dotenv = require('dotenv');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

dotenv.config();

// URL Firebase Realtime Database
const FIREBASE_URL = process.env.FIREBASE_URL;

// URL Telegram Bot API
const TELEGRAM_BOT_API = process.env.TELEGRAM_BOT_API;

// Variabel untuk menyimpan data sementara
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
                chat_id: '406423057',
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
                await sendRequest(`62${item.to}`, item.message);

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
async function sendRequest(to, text) {
    try {
        const response = await fetch('http://localhost:3000/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to,
                text,
            }),
        });

        const data = await response.json();
        console.log(data);
    } catch (error) {
        console.error('Error sending request:', error);
    }
}

// Express
const app = express();
const port = 3001;

app.use(express.json());

app.get('/status', async (req, res) => {
    const status = fs.readFileSync('status.txt', 'utf-8');
    res.json({ status: status === '0' ? 'Processing' : 'Finished' });
});

app.put('/status', async (req, res) => {
    const { status } = req.body;
    if (status === '0' || status === '1') {
        fs.writeFileSync('status.txt', status);
        res.json({ message: 'Status updated successfully' });
    } else {
        res.status(400).json({ error: 'Invalid status' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

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


module.exports = {processLoop};