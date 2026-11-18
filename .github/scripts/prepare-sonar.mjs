import { writeFileSync } from 'node:fs';

const mode = process.env.SONAR_MODE;
const host = process.env.SONAR_HOST_URL;
const projectKey = process.env.SONAR_PROJECT_KEY;
const organization = process.env.SONAR_ORGANIZATION;

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

if (!['local', 'cloud'].includes(mode)) {
  fail('SONAR_MODE must be local or cloud. Set it in repository Actions variables.');
}
if (!process.env.SONAR_TOKEN) {
  fail('Missing SONAR_TOKEN in repository Actions secrets.');
}
if (!projectKey) {
  fail('Missing SONAR_PROJECT_KEY in repository Actions variables.');
}
if (mode === 'cloud' && !organization) {
  fail('Missing SONAR_ORGANIZATION in repository Actions variables.');
}

let url;
try {
  url = new URL(host);
} catch {
  fail('SONAR_HOST_URL must be a valid HTTP or HTTPS URL.');
}
if (!['http:', 'https:'].includes(url.protocol)) {
  fail('SONAR_HOST_URL must use HTTP or HTTPS.');
}

const properties = [
  `sonar.projectKey=${projectKey}`,
  'sonar.sources=backend,frontend/src',
  'sonar.exclusions=**/node_modules/**,**/coverage/**,**/build/**',
  'sonar.qualitygate.wait=true',
  'sonar.qualitygate.timeout=600',
];
if (mode === 'cloud') properties.push(`sonar.organization=${organization}`);

writeFileSync('sonar-project.properties', `${properties.join('\n')}\n`);
console.log(`Prepared ${mode} SonarQube analysis for ${projectKey} at ${url.origin}`);
