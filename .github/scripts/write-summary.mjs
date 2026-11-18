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
  skipped: '— Chưa chạy',
  cancelled: '⚪ Đã hủy',
})[value] ?? '— Chưa có dữ liệu';
const count = (value) => value == null ? '—' : String(value);
const link = (label, url) => `[${label}](${url ?? runUrl})`;
const lines = [
  '## CI và phát hành image',
  '',
  `Commit: \`${process.env.GITHUB_SHA}\` · ${link('Xem toàn bộ run', runUrl)}`,
  '',
  '| Thành phần | Lint | Test | Build image | Trivy | High | Critical | ECR image | Log |',
  '| --- | --- | --- | --- | --- | ---: | ---: | --- | --- |',
];

for (const component of ['backend', 'frontend']) {
  const lintReport = component === 'backend' ? readJson('ci-reports/ci-report-lint-backend.json') ?? {} : {};
  const testReport = readJson(`ci-reports/ci-report-test-${component}.json`) ?? {};
  const imageReport = readJson(`ci-reports/ci-report-image-${component}.json`) ?? {};
  const release = readJson(`release-results/release-${component}.json`) ?? {};
  const lintJob = component === 'backend' ? jobFor('Lint (backend)') : null;
  const testJob = jobFor(`Test (${component})`);
  const imageJob = jobFor(`Image security (${component})`);
  const publishJob = jobFor(`Publish (${component})`);
  const image = release.image
    ? `\`${release.image}\`${release.digest ? `<br>\`${release.digest}\`` : '<br>Digest chưa xác nhận'}`
    : 'Chưa phát hành';
  const logs = [
    ...(lintJob ? [link('lint', lintJob.html_url)] : []),
    link('test', testJob?.html_url),
    link('scan', imageJob?.html_url),
    ...(publishJob ? [link('push', publishJob.html_url)] : []),
  ].join(' · ');
  const lint = component === 'backend' ? display(lintReport.lint) : '— Không áp dụng';
  lines.push(`| ${component} | ${lint} | ${display(testReport.test)} | ${display(imageReport.imageBuild)} | ${display(imageReport.scan)} | ${count(imageReport.vulnerabilities?.high)} | ${count(imageReport.vulnerabilities?.critical)} | ${image} | ${logs} |`);
}

const sonarJob = jobFor('SonarQube');
lines.push(
  '',
  `**Lint backend:** ${display(process.env.LINT_RESULT)} · **Test backend:** ${display(process.env.TEST_BACKEND_RESULT)} · **Test frontend:** ${display(process.env.TEST_FRONTEND_RESULT)}`,
  `**SonarQube (${process.env.SONAR_MODE}):** ${display(process.env.SONAR_RESULT)} (${link('log', sonarJob?.html_url)}) · **Image scan:** ${display(process.env.IMAGE_RESULT)} · **Phát hành:** ${display(process.env.PUBLISH_RESULT)}`,
);

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
