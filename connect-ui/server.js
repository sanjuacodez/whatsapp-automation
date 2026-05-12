const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.CONNECT_UI_PORT || '3000');
const evolutionUrl = process.env.EVOLUTION_INTERNAL_URL || 'http://evolution-api:8080';
const evolutionApiKey = process.env.EVOLUTION_API_KEY || '';
const evolutionInstance = process.env.EVOLUTION_INSTANCE || 'local-whatsapp';
const n8nEditorBaseUrl = process.env.N8N_EDITOR_BASE_URL || 'http://localhost:5678';
const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://host.docker.internal:5678/';
const n8nCredentialsUrl = `${n8nEditorBaseUrl.replace(/\/$/, '')}/home/credentials`;
const publicDir = path.join(__dirname, 'public');

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(payload));
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath);
  const contentType = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
  }[extension] || 'application/octet-stream';

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }

    response.writeHead(200, { 'Content-Type': contentType });
    response.end(data);
  });
}

async function requestEvolution(endpoint, options = {}) {
  const response = await fetch(`${evolutionUrl}${endpoint}`, {
    ...options,
    headers: {
      apikey: evolutionApiKey,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(`Evolution request failed: ${response.status}`);
    error.statusCode = response.status;
    error.payload = body;
    throw error;
  }

  return body;
}

function parseRequestBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
    });
    request.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

async function handleApi(request, response) {
  try {
    if (request.url === '/api/config' && request.method === 'GET') {
      sendJson(response, 200, {
        instanceName: evolutionInstance,
        n8nEditorBaseUrl,
        n8nCredentialsUrl,
        webhookTarget: `${n8nWebhookUrl.replace(/\/$/, '')}/webhook/evolution-incoming`
      });
      return;
    }

    if (request.url === '/api/status' && request.method === 'GET') {
      const payload = await requestEvolution(`/instance/connectionState/${evolutionInstance}`);
      sendJson(response, 200, payload);
      return;
    }

    if (request.url === '/api/connect' && request.method === 'GET') {
      const payload = await requestEvolution(`/instance/connect/${evolutionInstance}`);
      sendJson(response, 200, payload);
      return;
    }

    if (request.url === '/api/webhook/restore' && request.method === 'POST') {
      const payload = await requestEvolution(`/webhook/set/${evolutionInstance}`, {
        method: 'POST',
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: `${n8nWebhookUrl.replace(/\/$/, '')}/webhook/evolution-incoming`,
            webhookByEvents: false,
            webhookBase64: false,
            events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE']
          }
        })
      });
      sendJson(response, 200, payload);
      return;
    }

    if (request.url === '/api/settings/restore' && request.method === 'POST') {
      const payload = await requestEvolution(`/settings/set/${evolutionInstance}`, {
        method: 'POST',
        body: JSON.stringify({
          rejectCall: false,
          msgCall: '',
          groupsIgnore: true,
          alwaysOnline: false,
          readMessages: false,
          readStatus: false,
          syncFullHistory: false
        })
      });
      sendJson(response, 200, payload);
      return;
    }

    if (request.url === '/api/instance/recreate' && request.method === 'POST') {
      const body = await parseRequestBody(request);
      const phoneNumber = String(body.number || '').trim();
      if (!phoneNumber) {
        sendJson(response, 400, { error: 'Phone number is required' });
        return;
      }

      try {
        await requestEvolution(`/instance/delete/${evolutionInstance}`, { method: 'DELETE' });
      } catch (error) {
        if (error.statusCode !== 404) {
          throw error;
        }
      }

      const created = await requestEvolution('/instance/create', {
        method: 'POST',
        body: JSON.stringify({
          instanceName: evolutionInstance,
          number: phoneNumber,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
          groupsIgnore: true,
          alwaysOnline: false,
          readMessages: false,
          readStatus: false,
          syncFullHistory: false
        })
      });

      sendJson(response, 200, created);
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: error.message,
      details: error.payload || null
    });
  }
}

const server = http.createServer((request, response) => {
  if (request.url.startsWith('/api/')) {
    handleApi(request, response);
    return;
  }

  const requestedPath = request.url === '/' ? '/index.html' : request.url;
  const filePath = path.normalize(path.join(publicDir, requestedPath));

  if (!filePath.startsWith(publicDir)) {
    sendJson(response, 403, { error: 'Forbidden' });
    return;
  }

  sendFile(response, filePath);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Connect UI listening on port ${port}`);
});