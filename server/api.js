const express = require('express');
const path = require('path');
const { createInvoice } = require('./invoice');
const { sendInvoice, getWhatsAppStatus } = require('./whatsapp');

const app = express();
const PORT = 5000;

// Simple CORS middleware to allow renderer (file://) to call the API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

/**
 * Health check
 */
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Invoice WhatsApp API running' });
});

/**
 * WhatsApp connection status + QR code (for GUI).
 */
app.get('/whatsapp-status', async (req, res) => {
  try {
    const status = await getWhatsAppStatus();
    res.json({
      status: 'success',
      data: status
    });
  } catch (err) {
    console.error('Error getting WhatsApp status:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get WhatsApp status'
    });
  }
});

/**
 * POST /create-invoice
 *
 * Body:
 * {
 *   customerName: "Rahul",
 *   phone: "919999999999",
 *   items: [
 *     { name: "Room Rent", price: 5000 },
 *     { name: "Electricity", price: 700 }
 *   ]
 * }
 */
app.post('/create-invoice', async (req, res) => {
  const { customerName, phone, items } = req.body || {};

  if (!customerName || !phone || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid payload. Please provide customerName, phone, and at least one item.'
    });
  }

  try {
    const invoiceData = {
      customerName,
      phone,
      items
    };

    const pdfPath = await createInvoice(invoiceData);

    const message = `Hello ${customerName}, here is your invoice.`;

    await sendInvoice(phone, message, pdfPath);

    return res.json({
      status: 'success',
      message: 'Invoice sent via WhatsApp',
      pdfPath: path.relative(process.cwd(), pdfPath)
    });
  } catch (err) {
    console.error('Error in /create-invoice:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create or send invoice',
      details: err.message || String(err)
    });
  }
});

app.listen(PORT, () => {
  console.log(`Express API server listening on http://localhost:${PORT}`);
});

module.exports = app;

