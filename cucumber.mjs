export default {
  paths: ['features/**/*.feature'],
  import: ['support/**/*.ts', 'features/**/*.steps.ts'],
  tags: process.env.TAGS ?? '',
  format: [
    './tools/report/progress-formatter.ts',
    'message:reports/messages.ndjson',
  ],
};
