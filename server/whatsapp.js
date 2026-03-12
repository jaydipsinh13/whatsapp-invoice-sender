const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

// Directory where WhatsApp session data will be stored
const SESSION_DIR = path.join(__dirname, '..', 'whatsapp-session');

if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

let isReady = false;
let readyPromiseResolve;
let connectionStatus = 'initializing';
let latestQrDataUrl = null;

const readyPromise = new Promise((resolve) => {
  readyPromiseResolve = resolve;
});

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: SESSION_DIR
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
});

client.on('qr', async (qr) => {
  console.log('Scan this QR code with your WhatsApp mobile app:');
  qrcode.generate(qr, { small: true });

  connectionStatus = 'qr';
  latestQrDataUrl = null;

  try {
    // Generate a data URL that the renderer can display as an <img>
    latestQrDataUrl = await QRCode.toDataURL(qr);
  } catch (e) {
    console.error('Failed to generate QR data URL:', e);
  }
});

client.on('ready', () => {
  isReady = true;
  connectionStatus = 'ready';
  latestQrDataUrl = null;

  if (readyPromiseResolve) {
    readyPromiseResolve();
  }
  console.log('WhatsApp client is ready.');
});

client.on('authenticated', () => {
  connectionStatus = 'authenticated';
  console.log('WhatsApp client authenticated. Session data will be saved locally.');
});

client.on('auth_failure', (msg) => {
  connectionStatus = 'auth_failure';
  console.error('Authentication failure:', msg);
});

client.on('disconnected', (reason) => {
  connectionStatus = 'disconnected';
  latestQrDataUrl = null;
  console.warn('WhatsApp client was logged out:', reason);
});

client.initialize().catch((err) => {
  connectionStatus = 'error';
  console.error('Failed to initialize WhatsApp client:', err);
});

/**
 * Ensure the client is ready before sending any messages.
 * @returns {Promise<void>}
 */
async function ensureClientReady() {
  if (isReady) return;
  await readyPromise;
}

/**
 * Get current WhatsApp connection status and latest QR (if any).
 */
async function getWhatsAppStatus() {
  return {
    status: connectionStatus,
    ready: isReady,
    hasQr: Boolean(latestQrDataUrl),
    qrDataUrl: latestQrDataUrl
  };
}

/**
 * Send an invoice PDF via WhatsApp.
 *
 * @param {string} phoneNumber - Customer phone number, e.g. "919999999999"
 * @param {string} message - Text message to send
 * @param {string} pdfPath - Absolute or relative path to the PDF file
 * @returns {Promise<void>}
 */
async function sendInvoice(phoneNumber, message, pdfPath) {
  await ensureClientReady();

  try {
    const normalizedNumber = String(phoneNumber).replace(/\D/g, '');
    const chatId = `${normalizedNumber}@c.us`;

    const absolutePdfPath = path.isAbsolute(pdfPath)
      ? pdfPath
      : path.join(process.cwd(), pdfPath);

    if (!fs.existsSync(absolutePdfPath)) {
      throw new Error(`PDF file not found at path: ${absolutePdfPath}`);
    }

    const fileBuffer = fs.readFileSync(absolutePdfPath);
    const base64 = fileBuffer.toString('base64');
    const fileName = path.basename(absolutePdfPath);

    const media = new MessageMedia('application/pdf', base64, fileName);

    // Send text message first
    await client.sendMessage(chatId, message);

    // Then send PDF as attachment
    await client.sendMessage(chatId, media, {
      caption: 'Invoice PDF'
    });

    console.log(`Invoice sent successfully to ${chatId}`);
  } catch (err) {
    console.error('Error sending invoice via WhatsApp:', err);
    throw err;
  }
}

module.exports = {
  client,
  sendInvoice,
  getWhatsAppStatus
};

