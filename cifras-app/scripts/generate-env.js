const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const env = {};

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
}

const required = [
  'CIFRAS_API_URL',
  'CIFRAS_API_KEY',
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_MEASUREMENT_ID',
];

const missing = required.filter(k => !env[k]);
if (missing.length) {
  console.error(`✘ Variáveis ausentes no .env: ${missing.join(', ')}`);
  process.exit(1);
}

const content = `export const environment = {
  production: false,
  cifrasApiUrl: '${env.CIFRAS_API_URL}',
  cifrasApiKey: '${env.CIFRAS_API_KEY}',
  firebaseConfig: {
    apiKey: '${env.FIREBASE_API_KEY}',
    authDomain: '${env.FIREBASE_AUTH_DOMAIN}',
    projectId: '${env.FIREBASE_PROJECT_ID}',
    storageBucket: '${env.FIREBASE_STORAGE_BUCKET}',
    messagingSenderId: '${env.FIREBASE_MESSAGING_SENDER_ID}',
    appId: '${env.FIREBASE_APP_ID}',
    measurementId: '${env.FIREBASE_MEASUREMENT_ID}',
  },
};
`;

fs.writeFileSync(
  path.join(__dirname, '..', 'src', 'environments', 'environment.ts'),
  content,
  'utf-8',
);

console.log('✓ environment.ts gerado');
