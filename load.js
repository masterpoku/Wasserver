const axios = require('axios');

async function fetchData() {
    try {
        const response = await axios.get('http://localhost/slt/test.php');
        temporaryData = response.data || {}; // Simpan data ke temporaryData dari Firebase
        return temporaryData;
    } catch (error) {
        console.error("Error mengambil data dari Firebase:", error);
        return null;
    }

}
fetchData().then((pesan) => {
    const {
        message,
        data
    } = pesan;
    console.log(`pesan: ${message}`);
    console.log(`id: ${data.id}`);
    console.log(`number: ${data.number}`);
    console.log(`message_id: ${data.message_id}`);
    console.log(`status: ${data.status}`);
    console.log(`created_at: ${data.created_at}`);
    console.log(`updated_at: ${data.updated_at}`);
    console.log(`message_text: ${data.message_text}`);
}).catch((error) => {
    console.error(error);
});