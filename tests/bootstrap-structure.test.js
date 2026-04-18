const fs = require('fs');
const path = require('path');

describe('bootstrap tutorial structure', () => {
  it('delegates tutorial helpers to TutorialModule instead of defining them locally', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'app', 'bootstrap.js'), 'utf8');

    expect(source).toContain('globalThis.TutorialModule');
    expect(source).not.toContain('function getTutorialCopy()');
    expect(source).not.toContain('function getTutorialSteps()');
    expect(source).not.toContain('function renderTutorial()');
    expect(source).not.toContain('function syncTutorialProgress()');
    expect(source).not.toContain('function startTutorial()');
    expect(source).not.toContain('function closeTutorial()');
    expect(source).not.toContain('function moveTutorial(direction)');
  });
});
