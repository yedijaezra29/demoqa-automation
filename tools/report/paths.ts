import { fileURLToPath } from 'node:url';

export const REPORTS_DIR = 'reports';
export const MESSAGES_FILE = `${REPORTS_DIR}/messages.ndjson`;
export const RUN_INFO_FILE = `${REPORTS_DIR}/run-info.json`;
export const REPORT_FILE = `${REPORTS_DIR}/test-report.html`;

export const TEMPLATE_FILE = fileURLToPath(
  new URL('./template.html', import.meta.url),
);
