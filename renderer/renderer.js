/* global axios */

const API_BASE_URL = 'http://localhost:5000';

function createItemRow(name = '', price = '') {
  const row = document.createElement('div');
  row.className = 'item-row';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Item name';
  nameInput.value = name;

  const priceInput = document.createElement('input');
  priceInput.type = 'number';
  priceInput.placeholder = 'Price';
  priceInput.min = '0';
  priceInput.step = '0.01';
  priceInput.value = price;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-item';
  removeBtn.textContent = 'Remove';
  removeBtn.addEventListener('click', () => {
    row.remove();
  });

  row.appendChild(nameInput);
  row.appendChild(priceInput);
  row.appendChild(removeBtn);

  return row;
}

function setStatus(message, type = 'info') {
  const el = document.getElementById('status-message');
  if (!el) return;

  el.textContent = message;
  el.className = '';
  if (type) {
    el.classList.add(type);
  }
}

async function refreshWhatsAppStatus() {
  const statusTextEl = document.getElementById('wa-status-text');
  const qrImgEl = document.getElementById('wa-qr-image');

  if (!statusTextEl || !qrImgEl) return;

  try {
    const res = await axios.get(`${API_BASE_URL}/whatsapp-status`);
    if (!res.data || res.data.status !== 'success') {
      statusTextEl.textContent = 'Unable to load WhatsApp status.';
      qrImgEl.style.display = 'none';
      return;
    }

    const { status, ready, hasQr, qrDataUrl } = res.data.data || {};

    if (ready) {
      statusTextEl.textContent = 'WhatsApp is connected and ready.';
      qrImgEl.style.display = 'none';
      return;
    }

    switch (status) {
      case 'initializing':
        statusTextEl.textContent = 'Initializing WhatsApp connection...';
        break;
      case 'authenticated':
        statusTextEl.textContent = 'Authenticated. Finalizing connection...';
        break;
      case 'qr':
        statusTextEl.textContent = 'Scan this QR code with WhatsApp on your phone (Linked Devices).';
        break;
      case 'auth_failure':
        statusTextEl.textContent = 'Authentication failed. Please try relaunching the app.';
        break;
      case 'disconnected':
        statusTextEl.textContent = 'Disconnected from WhatsApp. Please restart the app to reconnect.';
        break;
      case 'error':
        statusTextEl.textContent = 'Error connecting to WhatsApp. Check the console output.';
        break;
      default:
        statusTextEl.textContent = 'Waiting for WhatsApp connection...';
        break;
    }

    if (hasQr && qrDataUrl) {
      qrImgEl.src = qrDataUrl;
      qrImgEl.style.display = 'block';
    } else {
      qrImgEl.style.display = 'none';
    }
  } catch (err) {
    console.error('Failed to refresh WhatsApp status', err);
    statusTextEl.textContent = 'WhatsApp backend is not reachable.';
    const qrImgEl2 = document.getElementById('wa-qr-image');
    if (qrImgEl2) {
      qrImgEl2.style.display = 'none';
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('invoice-form');
  const itemsContainer = document.getElementById('items-container');
  const addItemBtn = document.getElementById('add-item-btn');

  // Start with one empty item row
  itemsContainer.appendChild(createItemRow());

  addItemBtn.addEventListener('click', () => {
    itemsContainer.appendChild(createItemRow());
  });

  // Initial WhatsApp status + QR load and polling
  refreshWhatsAppStatus();
  setInterval(refreshWhatsAppStatus, 3000);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const customerName = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('phone').value.trim();

    const items = [];
    const rows = itemsContainer.querySelectorAll('.item-row');

    rows.forEach((row) => {
      const [nameInput, priceInput] = row.querySelectorAll('input');
      const nameVal = (nameInput.value || '').trim();
      const priceVal = parseFloat(priceInput.value || '0');

      if (nameVal && !Number.isNaN(priceVal) && priceVal > 0) {
        items.push({
          name: nameVal,
          price: priceVal
        });
      }
    });

    if (!customerName || !phone || items.length === 0) {
      setStatus('Please fill customer name, phone number, and at least one item.', 'error');
      return;
    }

    setStatus('Creating invoice and sending via WhatsApp... Please wait.', 'info');

    try {
      const response = await axios.post(`${API_BASE_URL}/create-invoice`, {
        customerName,
        phone,
        items
      });

      if (response.data && response.data.status === 'success') {
        setStatus('Invoice created and sent via WhatsApp successfully.', 'success');
      } else {
        setStatus(
          response.data && response.data.message
            ? response.data.message
            : 'Unexpected response from server.',
          'error'
        );
      }
    } catch (err) {
      console.error(err);
      const message =
        (err.response && err.response.data && err.response.data.message) ||
        err.message ||
        'Failed to create or send invoice.';
      setStatus(message, 'error');
    }
  });
});

