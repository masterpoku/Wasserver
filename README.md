
---

# WhatsApp Multi-Session Bot

Proyek ini adalah bot WhatsApp multi-sesi yang berinteraksi dengan API WhatsApp, memungkinkan Anda untuk mengelola beberapa sesi WhatsApp, mengirim dan menerima pesan, serta terintegrasi dengan Firebase untuk pencatatan pesan dan manajemen sesi. Bot ini dibangun menggunakan Node.js, Express, dan `wa-multi-session`.

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
   git clone https://github.com/username/whatsapp-multi-session-bot.git
   cd whatsapp-multi-session-bot
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
  Akses `/create?name=SesiBaru` untuk membuat sesi baru. QR code untuk sesi tersebut akan dihasilkan dan disimpan di folder `qrcodes`.

- **Mengirim Pesan:**
  Kirim POST request ke `/send-message` dengan payload berikut:

  ```json
  {
    "sessionId": "NamaSesi",
    "to": "NomorTujuan",
    "text": "Pesan yang akan dikirim"
  }
  ```

  Jika `sessionId` tidak diberikan, pesan akan dikirim menggunakan sesi berikutnya dalam daftar secara bergiliran.

- **Mengambil QR Code:**
  Akses `/qrcode/:sessionId` untuk mendapatkan QR code untuk sesi yang bersangkutan.

- **Memeriksa Status Sesi:**
  Akses `/get` untuk mendapatkan daftar semua sesi yang sedang aktif.

## Folder Struktur

- `wa_credentials`: Menyimpan kredensial sesi WhatsApp.
- `qrcodes`: Menyimpan QR code untuk sesi-sesi yang belum tersambung.
- `numbers.txt`: Menyimpan nomor yang telah dikirimi pesan.

## Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE).

---

Dengan README ini, pengguna lain dapat dengan mudah memahami dan menjalankan proyek WhatsApp Multi-Session Bot Anda.
