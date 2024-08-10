const axios = require('axios');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();
// URL Firebase Realtime Database dan Telegram Bot API dari file .env
const FIREBASE_URL = process.env.FIREBASE_URL;
const TELEGRAM_BOT_API = process.env.TELEGRAM_BOT_API;

// Variabel untuk menyimpan data sementara
let temporaryData = {};

// Fungsi untuk mengambil data dari Firebase
const getDataFromFirebase = async (path) => {
    try {
        const response = await axios.get(`${FIREBASE_URL}/${path}.json`);
        temporaryData = response.data ? { ...response.data } : {}; // Simpan data ke temporaryData dari Firebase
        return temporaryData;
    } catch (error) {
        console.error('Error mengambil data dari Firebase:', error);
        return null;
    }
};

// Fungsi untuk memperbarui status data di Firebase
const updateStatusInFirebase = async (path, key) => {
    try {
        await axios.patch(`${FIREBASE_URL}/${path}/${key}.json`, { status: true });
        console.log(`Status data ${key} diperbarui menjadi true`);
    } catch (error) {
        console.error(`Error memperbarui status data ${key}:`, error);
    }
};

// Fungsi untuk menunda eksekusi
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

// Fungsi untuk loop melalui data dengan delay
const loopThroughData = async (path) => {
    const data = await getDataFromFirebase(path); // Perbarui temporaryData dengan data dari Firebase

    if (data) {
        const keys = Object.keys(data);
        let count = 0;

        for (const key of keys) {
            const item = data[key];

            // Cek apakah item terdefinisi, memiliki status false, dan belum diproses
            if (item && item.status === false && temporaryData[key]) {
                console.log(`Menampilkan data ${key}:`, item);
                console.log(item.to);
                console.log(item.message);

                // Perbarui status data menjadi true di Firebase
                await updateStatusInFirebase(path, key);

                // Hapus data dari temporaryData setelah diproses
                delete temporaryData[key];

                // Delay 3 detik sebelum mengambil data berikutnya
                await sleep(3000);
                count++;
            } else {
                console.log(`Data ${key} tidak valid atau sudah diproses, dilewati.`);
            }
        }

        // Jika semua data sudah diproses
        if (count === 0) {
            fs.writeFileSync('status.txt', '1'); // Ubah status menjadi 1 setelah selesai
            console.log('Semua data selesai diproses.');
        }
    } else {
        fs.writeFileSync('status.txt', '1'); // Ubah status menjadi 1 setelah selesai
        console.log('Tidak ada data yang ditemukan di Firebase.');
    }
};

// Fungsi untuk mengirim notifikasi ke Telegram
const sendTelegramNotification = async (message) => {
    try {
        const response = await axios.get(`${TELEGRAM_BOT_API}/sendMessage?chat_id=406423057&text=${encodeURIComponent(message)}`);
        console.log('Notifikasi Telegram berhasil dikirim:', response.data);
    } catch (error) {
        console.error('Error mengirim notifikasi Telegram:', error);
    }
};

module.exports = {
    getDataFromFirebase,
    updateStatusInFirebase,
    sleep,
    loopThroughData,
    sendTelegramNotification
};
