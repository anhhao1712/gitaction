import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const readJson = (file) => {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

let jobs = [];
try {
  const response = await fetch(
    `${process.env.GITHUB_API_URL}/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/jobs?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(5000),
    },
  );
  if (response.ok) jobs = (await response.json()).jobs ?? [];
} catch {
  // The run URL is a usable fallback when the API is unavailable.
}

const jobFor = (name) => jobs.find((job) => job.name === name);
const display = (value) => ({
  success: '✅ Đạt',
  failure: '❌ Lỗi',
  skipped: '⏭️ Bỏ qua',
  cancelled: '⚪ Đã hủy',
})[value] ?? '— Chưa có dữ liệu';
const count = (value) => value == null ? '—' : String(value);
const link = (label, url) => `[${label}](${url ?? runUrl})`;
const lines = [
  '## CI và phát hành image',
  '',
  `Commit: \`${process.env.GITHUB_SHA}\` · ${link('Xem toàn bộ run', runUrl)}`,
  '',
  '### 1. Kiểm tra mã',
  '',
  '| Thành phần | Lint | Test | Line coverage (LCOV) | Log |',
  '| --- | --- | --- | ---: | --- |',
];

for (const component of ['backend', 'frontend']) {
  const lintReport = readJson(`ci-reports/ci-report-lint-${component}.json`) ?? {};
  const testReport = readJson(`ci-reports/ci-report-test-${component}.json`) ?? {};
  const lintJob = jobFor(`Lint (${component})`);
  const testJob = jobFor(`Test (${component})`);
  const coverage = testReport.lineCoverage == null ? '—' : `${testReport.lineCoverage}%`;
  lines.push(`| ${component} | ${display(lintReport.lint)} | ${display(testReport.test)} | ${coverage} | ${link('lint', lintJob?.html_url)} · ${link('test', testJob?.html_url)} |`);
}

const sonarJob = jobFor('SonarQube Cloud');
lines.push(
  '',
  '### 2. Chất lượng và bảo mật',
  '',
  `**SonarQube Cloud / Quality Gate:** ${display(process.env.SONAR_RESULT)} · ${link('Log Sonar', sonarJob?.html_url)}`,
  '',
  '| Image | Build | Trivy | High | Critical | Log |',
  '| --- | --- | --- | ---: | ---: | --- |',
);
for (const component of ['backend', 'frontend']) {
  const imageReport = readJson(`ci-reports/ci-report-image-${component}.json`) ?? {};
  const imageJob = jobFor(`Image security (${component})`);
  lines.push(`| ${component} | ${display(imageReport.imageBuild)} | ${display(imageReport.scan)} | ${count(imageReport.vulnerabilities?.high)} | ${count(imageReport.vulnerabilities?.critical)} | ${link('build và scan', imageJob?.html_url)} |`);
}

lines.push('', '### 3. Phát hành ECR', '');
if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  lines.push('Pull request: không phát hành image lên ECR.', '');
} else if (process.env.PUBLISH_RESULT === 'skipped') {
  lines.push('⏭️ Phát hành bị chặn vì một hoặc nhiều bước kiểm tra chưa đạt.', '');
}
lines.push('| Image | Trạng thái | ECR image | Log |', '| --- | --- | --- | --- |');
for (const component of ['backend', 'frontend']) {
  const release = readJson(`release-results/release-${component}.json`) ?? {};
  const publishJob = jobFor(`Publish (${component})`);
  const status = publishJob?.conclusion ?? process.env.PUBLISH_RESULT;
  const image = release.image
    ? `\`${release.image}\`${release.digest ? `<br>Digest: \`${release.digest}\`` : ''}`
    : '— Chưa phát hành';
  lines.push(`| ${component} | ${display(status)} | ${image} | ${link('push', publishJob?.html_url)} |`);
}

const failures = jobs.flatMap((job) =>
  (job.steps ?? [])
    .filter((step) => step.conclusion === 'failure')
    .map((step) => `- ${job.name}: ${step.name} — ${link('log', job.html_url)}`),
);
for (const component of ['backend', 'frontend']) {
  const report = readJson(`ci-reports/ci-report-image-${component}.json`);
  if (report?.scanReportError) failures.push(`- ${component}: ${report.scanReportError}`);
}
if (failures.length) lines.push('', '### Lỗi cần xem', '', ...failures);

writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
