const path = require('path');
const { spawnSync } = require('child_process');

describe('browser-loaded module syntax', () => {
  it('parses browser side-effect modules without syntax errors', () => {
    const files = [
      'scripts/data/icon-resolver.js',
      'scripts/data/report-transforms.js',
      'scripts/data/fflogs.js',
      'scripts/data/analytics.js',
      'scripts/ui/phase-ui.js',
      'scripts/ui/timeline-buffs.js',
      'scripts/ui/timeline-render-core.js',
      'scripts/ui/timeline.js',
      'scripts/shared/donation-config.js',
      'scripts/shared/donation.js',
      'scripts/app/bootstrap.js',
    ];

    for (const relativePath of files) {
      const absolutePath = path.join(__dirname, '..', relativePath);
      const result = spawnSync(process.execPath, ['--check', absolutePath], {
        encoding: 'utf8',
      });

      expect({
        file: relativePath,
        status: result.status,
        stderr: result.stderr.trim(),
      }).toEqual({
        file: relativePath,
        status: 0,
        stderr: '',
      });
    }
  });
});
