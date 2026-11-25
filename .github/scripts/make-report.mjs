import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const component = process.env.COMPONENT;
const kind = process.env.REPORT_KIND;
if (!['lint', 'test', 'image', 'sonar'].includes(kind)) {
  throw new Error('REPORT_KIND must be lint, test, image, or sonar');
}
if (kind !== 'sonar' && !['backend', 'frontend'].includes(component)) {
  throw new Error('REPORT_KIND and COMPONENT must identify a CI result');
}

const report = kind === 'sonar' ? { kind } : { component, kind };

if (kind === 'sonar') {
  const prepare = process.env.PREPARE_OUTCOME ?? 'skipped';
  const scan = process.env.SCAN_OUTCOME ?? 'skipped';
  let outcome = 'skipped';
  if (prepare === 'success' && scan === 'success') {
    outcome = 'success';
  } else if (prepare === 'failure' || scan === 'failure') {
    outcome = 'failure';
  } else if (prepare === 'cancelled' || scan === 'cancelled') {
    outcome = 'cancelled';
  }
  report.prepare = prepare;
  report.scan = scan;
  report.outcome = outcome;
} else if (kind === 'lint') {
  report.install = process.env.INSTALL_OUTCOME;
  report.lint = process.env.LINT_OUTCOME;
} else if (kind === 'test') {
  report.install = process.env.INSTALL_OUTCOME;
  report.test = process.env.TEST_OUTCOME;
  report.lineCoverage = null;
  const coverageFile = `todo-app-src/${component}/coverage/lcov.info`;
  if (existsSync(coverageFile)) {
    const lcov = readFileSync(coverageFile, 'utf8');
    const total = [...lcov.matchAll(/^LF:(\d+)$/gm)].reduce((sum, match) => sum + Number(match[1]), 0);
    const covered = [...lcov.matchAll(/^LH:(\d+)$/gm)].reduce((sum, match) => sum + Number(match[1]), 0);
    if (total > 0) report.lineCoverage = Math.round((covered / total) * 1000) / 10;
  }
} else {
  report.imageBuild = process.env.BUILD_OUTCOME;
  report.scan = process.env.SCAN_OUTCOME;
  report.imageArchive = process.env.SAVE_OUTCOME;
  report.vulnerabilities = null;
  report.scanReportError = null;

  const scanFile = `trivy-${component}.json`;
  if (existsSync(scanFile)) {
    try {
      const scan = JSON.parse(readFileSync(scanFile, 'utf8'));
      const found = (scan.Results ?? []).flatMap((result) => result.Vulnerabilities ?? []);
      report.vulnerabilities = {
        high: found.filter((item) => item.Severity === 'HIGH').length,
        critical: found.filter((item) => item.Severity === 'CRITICAL').length,
      };
    } catch (error) {
      report.scanReportError = `Trivy report could not be read: ${error.message}`;
    }
  } else if (report.scan !== 'skipped') {
    report.scanReportError = 'Trivy report was not produced';
  }
}

const outputFile = kind === 'sonar' ? 'ci-report-sonar.json' : `ci-report-${kind}-${component}.json`;
writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
