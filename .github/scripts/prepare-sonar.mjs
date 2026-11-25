import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const projectKey = process.env.SONAR_PROJECT_KEY;
const organization = process.env.SONAR_ORGANIZATION;
const coverageFiles = [
  'todo-app-src/backend/coverage/lcov.info',
  'todo-app-src/frontend/coverage/lcov.info',
];

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

if (!process.env.SONAR_TOKEN) {
  fail('Missing SONAR_TOKEN in repository Actions secrets.');
}
if (!projectKey) {
  fail('Missing SONAR_PROJECT_KEY in repository Actions variables.');
}
if (!organization) {
  fail('Missing SONAR_ORGANIZATION in repository Actions variables.');
}
for (const file of coverageFiles) {
  if (!existsSync(file)) fail(`Missing ${file}; check the test coverage artifact.`);
  const component = file.split('/')[1];
  const prefix = `todo-app-src/${component}`;
  let sourceCount = 0;
  const report = readFileSync(file, 'utf8').replace(/^SF:(.+)$/gm, (_, sourcePath) => {
    const relativePath = sourcePath.trim().replaceAll('\\', '/');
    let projectPath;
    if (relativePath.startsWith(`${prefix}/`)) {
      projectPath = relativePath;
    } else if (relativePath.startsWith(`${component}/`)) {
      projectPath = `todo-app-src/${relativePath}`;
    } else {
      projectPath = `${prefix}/${relativePath}`;
    }
    if (!existsSync(projectPath)) fail(`Coverage source ${projectPath} was not found.`);
    sourceCount += 1;
    return `SF:${projectPath}`;
  });
  if (sourceCount === 0) fail(`Coverage report ${file} has no source files.`);
  writeFileSync(file, report);
}

const properties = [
  `sonar.projectKey=${projectKey}`,
  `sonar.organization=${organization}`,
  'sonar.sources=todo-app-src/backend,todo-app-src/frontend',
  'sonar.exclusions=.github/**,todo-app-infra/**,todo-app-manifest/**,todo-app-src/docs/**,**/node_modules/**,**/coverage/**,**/build/**',
  `sonar.javascript.lcov.reportPaths=${coverageFiles.join(',')}`,
  'sonar.qualitygate.wait=true',
  'sonar.qualitygate.timeout=600',
];

writeFileSync('sonar-project.properties', `${properties.join('\n')}\n`);
console.log(`Prepared SonarQube Cloud analysis with backend and frontend coverage for ${projectKey}`);
