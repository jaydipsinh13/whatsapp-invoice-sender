const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const INVOICES_DIR = path.join(__dirname, '..', 'invoices');

if (!fs.existsSync(INVOICES_DIR)) {
  fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

/**
 * Create an invoice PDF and save it to the invoices directory.
 *
 * @param {Object} data
 * @param {string} data.customerName
 * @param {string} data.phone
 * @param {Array<{ name: string, price: number }>} data.items
 * @returns {Promise<string>} - Resolves with the PDF file path
 */
function createInvoice(data) {
  return new Promise((resolve, reject) => {
    try {
      const now = new Date();
      const timestamp = now.getTime();
      const fileName = `invoice-${timestamp}.pdf`;
      const filePath = path.join(INVOICES_DIR, fileName);

      const doc = new PDFDocument({ margin: 50 });
      const writeStream = fs.createWriteStream(filePath);

      doc.pipe(writeStream);

      // Title
      doc
        .fontSize(24)
        .text('Invoice', { align: 'center' })
        .moveDown(2);

      // Customer and metadata
      doc
        .fontSize(14)
        .text(`Customer Name: ${data.customerName || ''}`)
        .moveDown(0.5);

      const formattedDate = now.toLocaleDateString();
      doc.text(`Date: ${formattedDate}`).moveDown(1.5);

      // Table header
      doc
        .fontSize(16)
        .text('Item', 50, doc.y, { continued: true })
        .text('Price', 400, doc.y, { align: 'right' })
        .moveDown(0.5);

      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke()
        .moveDown(0.5);

      // Items
      let total = 0;
      const items = Array.isArray(data.items) ? data.items : [];
      doc.fontSize(14);

      items.forEach((item) => {
        const price = Number(item.price) || 0;
        total += price;

        doc
          .text(item.name || '', 50, doc.y, { continued: true })
          .text(price.toFixed(2), 400, doc.y, { align: 'right' })
          .moveDown(0.3);
      });

      doc.moveDown(1);

      // Total
      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke()
        .moveDown(0.5);

      doc
        .fontSize(16)
        .text('Total', 50, doc.y, { continued: true })
        .text(total.toFixed(2), 400, doc.y, { align: 'right' });

      doc.end();

      writeStream.on('finish', () => {
        resolve(filePath);
      });

      writeStream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  createInvoice
};

