const express = require('express');
const whatsapp = require('wa-multi-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');
const QRCode = require('qrcode');

dotenv.config();
const app = express();
const port = 40000;
const FIREBASE_URL = process.env.FIREBASE_URL;
const TELEGRAM_BOT_API = process.env.TELEGRAM_BOT_API;

app.use(bodyParser.json());

const sessionDir = './wa_credentials';
const sessionUpdates = new Map(); // Deklarasikan di bagian atas file
let sessions = new Set();
let sessionList = [];
let currentSessionIndex = 0;
const numbersFilePath = path.join(__dirname, 'numbers.txt');
let temporaryData = {};
let isProcessing = false;

const getDataFromFirebase = async (path) => {
    try {
        const response = await axios.get(`${FIREBASE_URL}/${path}.json`);
        temporaryData = response.data || {};
        return temporaryData;
    } catch (error) {
        console.error('Error fetching data from Firebase:', error);
        return null;
    }
};

const updateStatusInFirebase = async (path, key) => {
    try {
        await axios.patch(`${FIREBASE_URL}/${path}/${key}.json`, { status: true });
        console.log(`Status updated to true for ${key}`);
    } catch (error) {
        console.error(`Error updating status for ${key}:`, error);
    }
};

const sendTelegramNotification = async (message) => {
    try {
        const response = await axios.get(`${TELEGRAM_BOT_API}/sendMessage`, {
            params: {
                chat_id: '406423057',
                text: message,
            },
        });
        console.log('Telegram notification sent:', response.data);
    } catch (error) {
        console.error('Error sending Telegram notification:', error);
    }
};

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const loopThroughData = async (path) => {
    if (isProcessing) return;
    isProcessing = true;

    const data = await getDataFromFirebase(path);

    if (data) {
        const keys = Object.keys(data);
        let count = 0;

        for (const key of keys) {
            const item = data[key];
            if (item && item.status === false && temporaryData[key]) {
                console.log(`Processing data ${key}:`, item);
                await sendRequest(item.to, item.message);
                await updateStatusInFirebase(path, key);
                delete temporaryData[key];
                console.log('Waiting 30 seconds');
                await sleep(30000);
                count++;
            } else {
                console.log(`Data ${key} already processed.`);
            }
        }

        if (count === 0) {
            fs.writeFileSync('status.txt', '1');
            console.log('All data processed.');
        }
    } else {
        console.log('No data found in Firebase.');
    }

    isProcessing = false;
};

const sendRequest = async (to, text) => {
    if (!to || !text) {
        throw new Error('Missing required fields: "to" and "text" are required.');
    }

    let sessionId;

    if (!sessionId) {
        sessionId = sessionList[currentSessionIndex];
        currentSessionIndex = (currentSessionIndex + 1) % sessionList.length;

        if (!sessionId) {
            throw new Error("No available sessions.");
        }
    }

    try {
        await whatsapp.sendTyping({ sessionId: sessionId, to: `62${to}`, duration: 3000 });
        await whatsapp.sendTextMessage({ sessionId, to: `62${to}`, text });
        saveNumberToFile(`62${to}`);

        let currentCount = await getMessageCountFromFirebase(sessionId);
        currentCount += 1;
        await updateMessageCountInFirebase(sessionId, currentCount);

        console.log(`Message sent with session ${sessionId} to ${to}: ${text}`);
    } catch (error) {
        console.error('Error sending message:', error);
        throw new Error('Failed to send message');
    }
};

const processLoop = async () => {
    const status = fs.readFileSync('status.txt', 'utf-8');
    if (status === '0') {
        await loopThroughData('sms');
        if (fs.readFileSync('status.txt', 'utf-8') === '1') {
            await sendTelegramNotification('All data processed.');
        }
    } else {
        console.log("No new data to process.");
    }
    setTimeout(processLoop, 10000);
};

const saveNumberToFile = (number) => {
    fs.appendFile(numbersFilePath, `${number}\n`, (err) => {
        if (err) {
            console.error('Error saving number to file:', err);
        } else {
            console.log(`Number ${number} saved.`);
        }
    });
};

const isNumberInFile = async (number) => {
    try {
        const data = await fs.promises.readFile(numbersFilePath, 'utf8');
        const numbers = data.split('\n').map(num => num.trim()).filter(num => num.length > 0);
        return numbers.includes(number);
    } catch (err) {
        console.error('Error reading numbers file:', err);
        return false;
    }
};

const getMessageCountFromFirebase = async (sessionId) => {
    try {
        const response = await axios.get(`${process.env.FIREBASE_URL}/message_counts/${sessionId}.json`);
        return response.data ? response.data.count : 0;
    } catch (error) {
        console.error('Error fetching message count from Firebase:', error);
        return 0;
    }
};

const updateMessageCountInFirebase = async (sessionId, count) => {
    try {
        await axios.patch(`${process.env.FIREBASE_URL}/message_counts/${sessionId}.json`, { count });
        console.log(`Message count updated to ${count} for session ${sessionId}`);
    } catch (error) {
        console.error('Error updating message count in Firebase:', error);
    }
};

const initializeSessions = async () => {
    try {
        const sessionFolders = fs.readdirSync(sessionDir).map(file => file.replace('_credentials', ''));

        let qrUpdatedCount = 0; // Initialize QR code update counter

        whatsapp.onQRUpdated(async ({ sessionId, qr }) => {
            console.log(`QR Code for session ${sessionId}: ${qr}`);
            try {
                // Save QR Code image to file
                const qrFilePath = path.join(__dirname, `./qrcodes/qr_${sessionId}.png`);
                await QRCode.toFile(qrFilePath, qr);

                // Update QR code update counter
                if (!sessionUpdates.has(sessionId)) {
                    sessionUpdates.set(sessionId, 0);
                }
                const updateCount = sessionUpdates.get(sessionId) + 1;
                sessionUpdates.set(sessionId, updateCount);

                // Check if we have updated QR Code 5 times
                if (updateCount === 5) {
                    // Delete the QR Code file if it exists
                    if (fs.existsSync(qrFilePath)) {
                        fs.unlinkSync(qrFilePath);
                        const sessionDirPath = path.join(__dirname, `./wa_credentials/${sessionId}_credentials`);
                        if (fs.existsSync(sessionDirPath)) {
                            fs.rmSync(sessionDirPath, { recursive: true }); // Update to fs.rmSync
                        }
                        console.log(`QR Code file deleted for session ${sessionId}`);
                    }

                    // Remove session from the list
                    sessions.delete(sessionId);
                    sessionList = sessionList.filter(session => session !== sessionId);
                    sessionUpdates.delete(sessionId); // Reset counter for the removed session
                    console.log(`Session ${sessionId} removed after 5 QR Code updates.`);
                } else {
                    console.log(`====>>> [${updateCount}] QR Code saved to qr_${sessionId}.png`);
                }
            } catch (err) {
                console.error('Error saving QR Code:', err);
            }
        });
        whatsapp.onConnected((sessionId) => {
            console.log(`Session connected: ${sessionId}`);
            // Cleanup QR Code file after connection
            const qrFilePath = path.join(__dirname, `/qrcodes/qr_${sessionId}.png`);
            if (fs.existsSync(qrFilePath)) {
                fs.unlinkSync(qrFilePath);
                console.log(`QR Code file deleted for session ${sessionId}`);
            }
            processLoop();
        });

        whatsapp.onDisconnected((sessionId) => {
            sessions.delete(sessionId);
            sessionList = sessionList.filter(session => session !== sessionId);
            console.log(`Session disconnected: ${sessionId}`);
        });

        whatsapp.onMessageReceived(async (msg) => {
            const phone = msg.key.remoteJid.replace('@s.whatsapp.net', '');
            let pesan = msg.message?.extendedTextMessage?.text || msg.message?.conversation || "";

            if (pesan.trim()) {
                if (await isNumberInFile(phone)) {
                    const messageData = {
                        from: phone,
                        message: pesan,
                        session: msg.sessionId
                    };

                    try {
                        await axios.post(`${process.env.FIREBASE_URL}/received.json`, messageData);
                        console.log(`Message logged to Firebase for session ${msg.sessionId}`);
                    } catch (error) {
                        console.error('Error logging message to Firebase:', error);
                    }
                }

                if (pesan.startsWith('/qrcode')) {
                    const sessionId = pesan.split(' ')[1];
                    const filePath = `./qrcodes/qr_${sessionId}.png`;
                    if (fs.existsSync(filePath)) {
                        const image = fs.readFileSync(filePath); // return Buffer
                        const send = await whatsapp.sendImage({
                          sessionId: msg.sessionId,
                          to: phone,
                          text: `QR Code: ${sessionId}`,
                          media: image, // can from URL too
                        });
                    } else {
                        await whatsapp.sendTextMessage({
                            sessionId: msg.sessionId,
                            to: phone,
                            text: 'QR Code not found.'
                        });
                    }
                } else if (pesan.startsWith('/status')) {
                    const status = pesan.split(' ')[1];
                    if (status === '0' || status === '1') {
                        fs.writeFileSync('status.txt', status);
                        await whatsapp.sendTextMessage({
                            sessionId: msg.sessionId,
                            to: phone,
                            text: 'Status updated successfully'
                        });
                    } else {
                        await whatsapp.sendTextMessage({
                            sessionId: msg.sessionId,
                            to: phone,
                            text: 'Invalid status'
                        });
                    }
                } else if (pesan.startsWith('/create')) {
                    const name = pesan.split(' ')[1];
                    if (name) {
                        if (!sessions.has(name)) {
                            try {
                                await whatsapp.startSession(name);
                                sessions.add(name);
                                sessionList.push(name);
                                await whatsapp.sendTextMessage({
                                    sessionId: msg.sessionId,
                                    to: phone,
                                    text: `Session ${name} created. Please wait for a few seconds for the QR code.`
                                });
                                setTimeout(async () => {
                                const filePath = `./qrcodes/qr_${name}.png`;
                                if (fs.existsSync(filePath)) {
                                    const image = fs.readFileSync(filePath); // return Buffer
                                    await whatsapp.sendImage({
                                        sessionId: msg.sessionId,
                                        to: phone,
                                        text: `QR Code: ${name}`,
                                        media: image, // can from URL too
                                      });
                                }
                                }, 10000);
                            } catch (error) {
                                console.error(`Error creating session ${name}:`, error);
                                await whatsapp.sendTextMessage({
                                    sessionId: msg.sessionId,
                                    to: phone,
                                    text: 'Failed to create session'
                                });
                            }
                        } else {
                            await whatsapp.sendTextMessage({
                                sessionId: msg.sessionId,
                                to: phone,
                                text: `Session ${name} already exists`
                            });
                        }
                    } else {
                        await whatsapp.sendTextMessage({
                            sessionId: msg.sessionId,
                            to: phone,
                            text: 'Session name is required'
                        });
                    }
                } else if (pesan.startsWith('/get')) {
                    const allSessions = whatsapp.getAllSession();
                    await whatsapp.sendTextMessage({
                        sessionId: msg.sessionId,
                        to: phone,
                        text: `Sessions: ${allSessions.join(', ')}`
                    });
                }
            }

            console.log(`New Message Received on Session ${msg.sessionId}:`);
            console.log(`From: ${phone}`);
            console.log(`Message: ${pesan}`);
            console.log('--------------------------------------------------------');
        });

        // Start sessions from existing folders
        for (const sessionId of sessionFolders) {
            try {
                await whatsapp.startSession(sessionId);
                sessions.add(sessionId);
                sessionList.push(sessionId);
                console.log(`Session ${sessionId} started`);
            } catch (error) {
                console.error(`Error starting session ${sessionId}:`, error);
            }
        }

        console.log('WhatsApp sessions initialized. Waiting for requests...');
    } catch (error) {
        console.error('Error initializing sessions:', error);
        throw error;
    }
};


app.put('/status', async (req, res) => {
    const { status } = req.body;
    if (status === '0' || status === '1') {
        fs.writeFileSync('status.txt', status);
        res.json({ message: 'Status updated successfully' });
    } else {
        res.status(400).json({ error: 'Invalid status' });
    }
});

app.get('/create', async (req, res) => {
    const { name } = req.query;

    if (!name) {
        return res.status(400).json({ error: 'Session name is required' });
    }

    if (sessions.has(name)) {
        return res.status(400).json({ error: `Session ${name} already exists` });
    }

    try {
        await whatsapp.startSession(name);
        sessions.add(name);
        sessionList.push(name);
        setTimeout(() => {
            res.redirect(`/qrcode/${name}`);
        }, 5000);
    } catch (error) {
        console.error(`Error creating session ${name}:`, error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

app.get('/get', async (req, res) => {
    const sessions = whatsapp.getAllSession();
    res.json(sessions);
});

app.get('/qrcode/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const filePath = path.join(__dirname, `./qrcodes/qr_${sessionId}.png`);

    try {
        if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'image/png');
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.status(404).json({ error: 'QR Code not found' });
        }
    } catch (error) {
        console.error('Error serving QR Code:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

initializeSessions()
    .then(() => app.listen(port, () => console.log(`Server listening on port ${port}`)))
    .catch(error => {
        console.error('Failed to initialize WhatsApp sessions:', error);
        process.exit(1);
    });
