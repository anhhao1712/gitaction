import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const component = process.env.COMPONENT;
const kind = process.env.REPORT_KIND;
if (!['backend', 'frontend'].includes(component) || !['lint', 'test', 'image'].includes(kind)) {
  throw new Error('REPORT_KIND and COMPONENT must identify a CI result');
}

const report = { component, kind };

if (kind === 'lint') {
  report.install = process.env.INSTALL_OUTCOME;
  report.lint = process.env.LINT_OUTCOME;
} else if (kind === 'test') {
  report.install = process.env.INSTALL_OUTCOME;
  report.test = process.env.TEST_OUTCOME;
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

writeFileSync(`ci-report-${kind}-${component}.json`, `${JSON.stringify(report, null, 2)}\n`);
