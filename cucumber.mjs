export default {
  paths: ['tests/**/*.feature'],
  import: ['tests/support/**/*.ts', 'tests/**/*.steps.ts'],
  tags: process.env.TAGS ?? '',
  format: [
    './tools/report/progress-formatter.ts',
    'message:reports/messages.ndjson',
  ],
};
