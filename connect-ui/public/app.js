const statusBadge = document.getElementById('status-badge');
const instanceName = document.getElementById('instance-name');
const stateValue = document.getElementById('state-value');
const webhookValue = document.getElementById('webhook-value');
const statusMessage = document.getElementById('status-message');
const pairingCode = document.getElementById('pairing-code');
const pairingMessage = document.getElementById('pairing-message');
const qrImage = document.getElementById('qr-image');
const webhookTarget = document.getElementById('webhook-target');
const n8nLink = document.getElementById('n8n-link');
const n8nEditorLink = document.getElementById('n8n-editor-link');
const n8nCredentialsLink = document.getElementById('n8n-credentials-link');
const n8nCredentialsInlineLink = document.getElementById('n8n-credentials-inline-link');
const phoneNumberInput = document.getElementById('phone-number');

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

  if (state === 'open') {
    statusMessage.textContent = 'WhatsApp is connected. You can open n8n and test a real message.';
  } else if (state === 'connecting') {
    statusMessage.textContent = 'Connection is in progress. If it hangs, refresh the pairing code or recreate the instance with the phone number.';
  } else {
    statusMessage.textContent = 'Connection is not open. Use the QR or the 8-letter code to link again.';
  }
}

async function loadConnect() {
  const payload = await api('/api/connect');
  pairingCode.textContent = payload.pairingCode || '--------';
  qrImage.src = payload.base64 || '';
  qrImage.hidden = !payload.base64;
  pairingMessage.textContent = payload.pairingCode
    ? 'Use this live code if WhatsApp asks for phone-number pairing.'
    : 'No phone pairing code is available yet. Refresh again or recreate the instance.';
}

async function refreshAll() {
  try {
    await Promise.all([loadStatus(), loadConnect()]);
  } catch (error) {
    statusMessage.textContent = error.message;
  }
}

document.getElementById('refresh-all').addEventListener('click', refreshAll);
document.getElementById('refresh-connect').addEventListener('click', loadConnect);
document.getElementById('refresh-qr').addEventListener('click', loadConnect);

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
    pairingMessage.textContent = 'Instance recreated. Refreshing connection details...';
    await refreshAll();
  } catch (error) {
    pairingMessage.textContent = error.message;
  }
});

Promise.all([loadConfig(), refreshAll()]).catch((error) => {
  statusMessage.textContent = error.message;
});