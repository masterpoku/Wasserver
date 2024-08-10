const axios = require('axios');

const TELEGRAM_API_URL = 'https://api.telegram.org/bot863703755:AAFeDCkK-M_noSt152ZUXfwapYs03sEKSew/getUpdates';

const getLastChat = async () => {
    try {
        const response = await axios.get(TELEGRAM_API_URL);
        const updates = response.data.result;

        if (updates.length === 0) {
            console.log('Tidak ada pembaruan yang tersedia.');
            return;
        }

        const lastUpdate = updates[updates.length - 1];
        const lastMessage = lastUpdate.message;

        console.log('Pesan terakhir:', lastMessage);
    } catch (error) {
        console.error('Error mendapatkan pembaruan:', error);
    }
};

getLastChat();
