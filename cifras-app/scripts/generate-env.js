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

const content = `export const environment = {
  production: false,
  cifrasApiUrl: '${env.CIFRAS_API_URL || 'http://localhost:8000'}',
  cifrasApiKey: '${env.CIFRAS_API_KEY || 'dev'}',
};
`;

fs.writeFileSync(
  path.join(__dirname, '..', 'src', 'environments', 'environment.ts'),
  content,
  'utf-8',
);

console.log('✓ environment.ts gerado');
