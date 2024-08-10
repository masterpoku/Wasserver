
---

# WhatsApp Multi-Session Bot

Proyek ini adalah bot WhatsApp multi-sesi yang berinteraksi dengan API WhatsApp, memungkinkan Anda untuk mengelola beberapa sesi WhatsApp, mengirim dan menerima pesan, serta terintegrasi dengan Firebase untuk pencatatan pesan dan manajemen sesi. Bot ini dibangun menggunakan Node.js, Express, dan `Wasserver`.

## Fitur

- **Manajemen Multi-Sesi**: Mengelola beberapa sesi WhatsApp secara bersamaan.
- **Pembuatan QR Code**: Secara otomatis menghasilkan dan menyimpan QR code untuk sesi baru.
- **Pencatatan Pesan**: Mencatat pesan yang diterima ke Firebase.
- **Pengiriman Pesan Round-Robin**: Membagikan pesan ke berbagai sesi secara bergiliran jika sesi tidak ditentukan.
- **Simulasi Mengetik**: Mensimulasikan indikator mengetik sebelum mengirim pesan.
- **Pemantauan Sesi**: Secara otomatis mendeteksi dan menangani pemutusan sesi.

## Prasyarat

- Node.js (versi 14 atau lebih tinggi)
- Akun Firebase dengan Realtime Database

## Instalasi

1. **Clone repositori ini:**

   ```bash
   git clone https://github.com/masterpoku/Wasserver.git
   cd Wasserver
   ```

2. **Instal dependensi:**

   ```bash
   npm install
   ```

3. **Konfigurasi file `.env`:**

   Buat file `.env` di root proyek dan tambahkan variabel lingkungan berikut:

   ```
   FIREBASE_URL=URL_FIREBASE_ANDA
   TELEGRAM_BOT_API=URL_API_BOT_TELEGRAM_ANDA
   ```

4. **Mulai aplikasi:**

   ```bash
   npm start
   ```

   Server akan berjalan pada port 3000.

## Penggunaan

- **Membuat Sesi Baru:**
  Akses `http://localhost:3000/create?name=SesiBaru` untuk membuat sesi baru. QR code untuk sesi tersebut akan dihasilkan dan disimpan di folder `qrcodes` dan dapat diakses melalui `http://localhost:3000/qrcode/SesiBaru`.

- **Mengirim Pesan Menggunakan Sesi:**
  Kirim POST request ke `http://localhost:3000/send-message` dengan payload berikut:

  ```json
  {
    "sessionId": "NamaSesi",
    "to": "NomorTujuan",
    "text": "Pesan yang akan dikirim"
  }
  ```

- **Mengirim Pesan Tanpa Sesi:**
  Kirim POST request ke `http://localhost:3000/send-message` dengan payload berikut:

  ```json
  {
    "to": "NomorTujuan",
    "text": "Pesan yang akan dikirim"
  }
  ```

  Pesan akan dikirim menggunakan sesi yang tersedia secara bergiliran.

- **Mengambil QR Code:**
  Akses `http://localhost:3000/qrcode/:sessionId` untuk mendapatkan QR code untuk sesi yang bersangkutan.

- **Memeriksa Status Sesi:**
  Akses `http://localhost:3000/get` untuk mendapatkan daftar semua sesi yang sedang aktif.

## Struktur Folder

- `wa_credentials`: Menyimpan kredensial sesi WhatsApp.
- `qrcodes`: Menyimpan QR code untuk sesi-sesi yang belum tersambung.
- `numbers.txt`: Menyimpan nomor-nomor yang telah dikirimi pesan.

## Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE).

---

README ini memberikan panduan yang jelas tentang bagaimana cara menggunakan dan menjalankan bot WhatsApp multi-sesi Anda, serta menjelaskan fitur dan struktur proyek dengan detail.