#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${N8N_CONTAINER_NAME:-whatsapp-n8n}"

if ! docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
	echo "Container '$CONTAINER_NAME' was not found." >&2
	exit 1
fi

docker exec -i "$CONTAINER_NAME" node - <<'NODE'
const fs = require('fs');
const { randomBytes, createHash, createCipheriv, randomUUID } = require('crypto');
const { DatabaseSync } = require('node:sqlite');

function getKeyAndIv(salt, key) {
	const password = Buffer.concat([Buffer.from(key, 'binary'), salt]);
	const hash1 = createHash('md5').update(password).digest();
	const hash2 = createHash('md5').update(Buffer.concat([hash1, password])).digest();
	const iv = createHash('md5').update(Buffer.concat([hash2, password])).digest();
	return [Buffer.concat([hash1, hash2]), iv];
}

function encrypt(data, key) {
	const salt = randomBytes(8);
	const [derivedKey, iv] = getKeyAndIv(salt, key);
	const cipher = createCipheriv('aes-256-cbc', derivedKey, iv);
	const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
	return Buffer.concat([Buffer.from('53616c7465645f5f', 'hex'), salt, encrypted]).toString('base64');
}

function readProjectId(db) {
	const sharedProject = db.prepare('select projectId from shared_credentials limit 1').get();
	if (sharedProject?.projectId) return sharedProject.projectId;
	const project = db.prepare('select id from project order by createdAt asc limit 1').get();
	if (project?.id) return project.id;
	throw new Error('Could not determine an n8n projectId');
}

function upsertCredential(db, projectId, encryptionKey, definition) {
	const encryptedData = encrypt(JSON.stringify(definition.payload), encryptionKey);
	const existing = db.prepare('select id from credentials_entity where id = ?').get(definition.id);

	if (existing) {
		db.prepare("update credentials_entity set name = ?, data = ?, type = ?, updatedAt = STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW') where id = ?").run(
			definition.name,
			encryptedData,
			definition.type,
			definition.id,
		);
	} else {
		db.prepare('insert into credentials_entity (id, name, data, type) values (?, ?, ?, ?)').run(
			definition.id,
			definition.name,
			encryptedData,
			definition.type,
		);
	}

	const shared = db.prepare('select credentialsId from shared_credentials where credentialsId = ? and projectId = ?').get(definition.id, projectId);
	if (!shared) {
		db.prepare('insert into shared_credentials (credentialsId, projectId, role) values (?, ?, ?)').run(
			definition.id,
			projectId,
			'credential:owner',
		);
	}

	return {
		id: definition.id,
		name: definition.name,
		type: definition.type,
	};
}

const env = process.env;
const { encryptionKey } = JSON.parse(fs.readFileSync('/home/node/.n8n/config', 'utf8'));
const db = new DatabaseSync('/home/node/.n8n/database.sqlite');
const projectId = readProjectId(db);

const definitions = [];

if (env.OPENAI_API_KEY) {
	definitions.push({
		id: '2ea268dd-5fb0-4080-93f3-3eb29188656c',
		name: 'OpenAI account',
		type: 'openAiApi',
		payload: {
			apiKey: env.OPENAI_API_KEY,
			organizationId: env.OPENAI_ORGANIZATION_ID || '',
			url: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
			header: false,
			headerName: '',
			headerValue: '',
		},
	});
}

if (env.WOOCOMMERCE_BASE_URL && env.WOOCOMMERCE_CONSUMER_KEY && env.WOOCOMMERCE_CONSUMER_SECRET) {
	definitions.push({
		id: 'c1hDGmnfjhyGQV5Q',
		name: 'WooCommerce account',
		type: 'wooCommerceApi',
		payload: {
			consumerKey: env.WOOCOMMERCE_CONSUMER_KEY,
			consumerSecret: env.WOOCOMMERCE_CONSUMER_SECRET,
			url: env.WOOCOMMERCE_BASE_URL,
			includeCredentialsInQuery: false,
		},
	});
}

if (!definitions.length) {
	console.error('No credential source environment variables were found in the n8n container.');
	process.exit(1);
}

const result = {
	containerName: env.HOSTNAME || 'n8n',
	projectId,
	credentials: [],
	skipped: [],
	runId: randomUUID(),
};

if (!env.OPENAI_API_KEY) {
	result.skipped.push('OpenAI account skipped: OPENAI_API_KEY is missing');
}

if (!(env.WOOCOMMERCE_BASE_URL && env.WOOCOMMERCE_CONSUMER_KEY && env.WOOCOMMERCE_CONSUMER_SECRET)) {
	result.skipped.push('WooCommerce account skipped: WooCommerce environment variables are incomplete');
}

db.exec('BEGIN');
try {
	for (const definition of definitions) {
		result.credentials.push(upsertCredential(db, projectId, encryptionKey, definition));
	}
	db.exec('COMMIT');
} catch (error) {
	db.exec('ROLLBACK');
	throw error;
}

console.log(JSON.stringify(result, null, 2));
NODE