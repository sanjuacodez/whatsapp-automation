const statusBadge = document.getElementById('status-badge');
const instanceName = document.getElementById('instance-name');
const stateValue = document.getElementById('state-value');
const webhookValue = document.getElementById('webhook-value');
const statusMessage = document.getElementById('status-message');
const pairingCode = document.getElementById('pairing-code');
const pairingMessage = document.getElementById('pairing-message');
const qrImage = document.getElementById('qr-image');
const qrEmpty = document.getElementById('qr-empty');
const webhookTarget = document.getElementById('webhook-target');
const n8nLink = document.getElementById('n8n-link');
const n8nEditorLink = document.getElementById('n8n-editor-link');
const n8nCredentialsLink = document.getElementById('n8n-credentials-link');
const n8nCredentialsInlineLink = document.getElementById('n8n-credentials-inline-link');
const phoneNumberInput = document.getElementById('phone-number');
const tabButtons = Array.from(document.querySelectorAll('[data-tab]'));
const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));

function setTab(tabName) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  tabPanels.forEach((panel) => {
    const isActive = panel.id === `panel-${tabName}`;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload;
}

function setBadge(state) {
  const normalized = String(state || 'unknown').toLowerCase();
  statusBadge.textContent = normalized;
  statusBadge.className = 'badge pending';

  if (normalized === 'open') {
    statusBadge.className = 'badge open';
  } else if (normalized === 'close') {
    statusBadge.className = 'badge closed';
  }
}

function setStatusText(state) {
  if (state === 'open') {
    statusMessage.textContent = 'WhatsApp is connected. QR and pairing code may disappear until you recreate the instance for a new pairing.';
    return;
  }

  if (state === 'connecting') {
    statusMessage.textContent = 'Connection is in progress. Refresh the active tab if you are waiting for a new QR or phone pairing code.';
    return;
  }

  statusMessage.textContent = 'Connection is not open. Use QR scan or phone code, then restore the webhook if the instance was recreated.';
}

async function loadConfig() {
  const config = await api('/api/config');
  instanceName.textContent = config.instanceName;
  webhookValue.textContent = config.webhookTarget;
  webhookTarget.textContent = config.webhookTarget;
  n8nLink.href = config.n8nEditorBaseUrl;
  n8nEditorLink.href = config.n8nEditorBaseUrl;
  n8nCredentialsLink.href = config.n8nCredentialsUrl;
  n8nCredentialsInlineLink.href = config.n8nCredentialsUrl;
}

async function loadStatus() {
  const payload = await api('/api/status');
  const state = payload.instance?.state || 'unknown';
  stateValue.textContent = state;
  setBadge(state);
  setStatusText(state);
  return state;
}

async function loadConnect() {
  const payload = await api('/api/connect');
  const state = String(payload.state || 'unknown').toLowerCase();
  const livePairingCode = payload.pairingCode || '--------';
  const liveQrCode = payload.qrCode || '';

  pairingCode.textContent = livePairingCode;
  qrImage.src = liveQrCode;
  qrImage.hidden = !liveQrCode;
  qrEmpty.hidden = Boolean(liveQrCode);

  if (payload.pairingCode) {
    pairingMessage.textContent = 'Use this live 8-character code if WhatsApp asks for phone-number pairing.';
  } else if (state === 'open') {
    pairingMessage.textContent = 'No pairing code is shown because the instance is already connected. Recreate the instance to generate a new one.';
  } else {
    pairingMessage.textContent = 'No phone pairing code is available yet. Refresh again or recreate the instance with the phone number.';
  }

  return payload;
}

async function refreshAll() {
  try {
    await Promise.all([loadStatus(), loadConnect()]);
  } catch (error) {
    statusMessage.textContent = error.message;
  }
}

document.getElementById('refresh-all').addEventListener('click', refreshAll);
document.getElementById('refresh-connect').addEventListener('click', async () => {
  setTab('phone');
  pairingMessage.textContent = 'Refreshing phone pairing details...';
  try {
    await loadConnect();
  } catch (error) {
    pairingMessage.textContent = error.message;
  }
});

document.getElementById('refresh-qr').addEventListener('click', async () => {
  setTab('qr');
  statusMessage.textContent = 'Refreshing QR details...';
  try {
    await loadConnect();
    const payload = await api('/api/status');
    setStatusText(payload.instance?.state || 'unknown');
  } catch (error) {
    statusMessage.textContent = error.message;
  }
});

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setTab(button.dataset.tab);
  });
});

document.getElementById('restore-webhook').addEventListener('click', async () => {
  try {
    await api('/api/webhook/restore', { method: 'POST' });
    statusMessage.textContent = 'Webhook restored to the n8n production path.';
  } catch (error) {
    statusMessage.textContent = error.message;
  }
});

document.getElementById('restore-settings').addEventListener('click', async () => {
  try {
    await api('/api/settings/restore', { method: 'POST' });
    statusMessage.textContent = 'Evolution instance settings restored.';
  } catch (error) {
    statusMessage.textContent = error.message;
  }
});

document.getElementById('recreate-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const number = phoneNumberInput.value.trim();
  if (!number) {
    pairingMessage.textContent = 'Enter the WhatsApp number with country code first.';
    return;
  }

  pairingMessage.textContent = 'Recreating instance...';
  try {
    await api('/api/instance/recreate', {
      method: 'POST',
      body: JSON.stringify({ number })
    });
    setTab('phone');
    pairingMessage.textContent = 'Instance recreated. Refreshing connection details...';
    await refreshAll();
  } catch (error) {
    pairingMessage.textContent = error.message;
  }
});

setTab('qr');

Promise.all([loadConfig(), refreshAll()]).catch((error) => {
  statusMessage.textContent = error.message;
});