const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();
// URL Firebase Realtime Database
const FIREBASE_URL = process.env.FIREBASE_URL; // Masukkan URL Firebase Anda di file .env

// Fungsi untuk menghapus seluruh data di Firebase
const deleteAllDataInFirebase = async (path) => {
    try {
        const response = await axios.get(`${FIREBASE_URL}/${path}.json`);
        const data = response.data;

        if (data) {
            const keys = Object.keys(data);

            for (const key of keys) {
                await axios.delete(`${FIREBASE_URL}/${path}/${key}.json`);
            }

            console.log(`Semua data di path ${path} berhasil dihapus`);
        } else {
            console.log('Tidak ada data yang ditemukan di Firebase.');
        }
    } catch (error) {
        console.error('Error menghapus data di Firebase:', error);
    }
};

// Hapus semua data di path 'sms'
deleteAllDataInFirebase('sms');

