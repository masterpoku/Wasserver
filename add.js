const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const csv = require('csv-parser');

dotenv.config();

// URL Firebase Realtime Database
const FIREBASE_URL = process.env.FIREBASE_URL; // Masukkan URL Firebase Anda di file .env

// Fungsi untuk menambahkan data baru ke Firebase
const addDataToFirebase = async (path, data) => {
    try {
        const response = await axios.post(`${FIREBASE_URL}/${path}.json`, data);
        console.log('Data baru berhasil ditambahkan:', response.data);
    } catch (error) {
        console.error('Error menambahkan data ke Firebase:', error);
    }
};

// Fungsi untuk membaca data dari CSV dan menambahkannya ke Firebase
const addDataFromCsvToFirebase = async (csvFilePath, path) => {
    try {
        const records = [];
        
        fs.createReadStream(csvFilePath)
            .pipe(csv())
            .on('data', (data) => records.push(data))
            .on('end', async () => {
                for (const record of records) {
                    // Pastikan struktur data sesuai dengan kebutuhan Firebase
                    const newData = {
                        message: record.message,
                        to: record.to,
                        status: false // Atur status awal menjadi false
                    };
                    await addDataToFirebase(path, newData);
                }
                console.log('Semua data dari CSV berhasil ditambahkan ke Firebase.');
            });
    } catch (error) {
        console.error('Error membaca data dari CSV dan menambahkannya ke Firebase:', error);
    }
};

// Path di Firebase Realtime Database
const path = 'sms'; // Contoh: Menambahkan data ke path 'sms'

// Path ke file CSV
const csvFilePath = 'data.csv'; // Ganti dengan path file CSV Anda

// Memanggil fungsi untuk membaca data dari CSV dan menambahkannya ke Firebase
addDataFromCsvToFirebase(csvFilePath, path);
