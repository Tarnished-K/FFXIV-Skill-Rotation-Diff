const fs = require('fs');
const path = require('path');

function readRootFile(fileName) {
  return fs.readFileSync(path.join(__dirname, '..', fileName), 'utf8');
}

describe('page asset loading', () => {
  it('loads the shared stylesheet split across every HTML entrypoint', () => {
    const expectedLinks = [
      'href="styles-base.css"',
      'href="styles-layout.css"',
      'href="styles-timeline.css"',
      'href="styles.css"',
    ];

    for (const fileName of ['index.html', 'tutorial.html', 'contact.html', 'feedback-admin.html', 'analytics.html']) {
      const html = readRootFile(fileName);
      let lastIndex = -1;
      for (const expectedLink of expectedLinks) {
        const nextIndex = html.indexOf(expectedLink);
        expect(nextIndex).toBeGreaterThan(lastIndex);
        lastIndex = nextIndex;
      }
    }
  });

  it('loads the tutorial module before bootstrap in the script loader', () => {
    const scriptLoader = readRootFile('script.js');

    expect(scriptLoader).toContain("'./scripts/app/tutorial.js'");
    expect(scriptLoader.indexOf("'./scripts/app/tutorial.js'"))
      .toBeLessThan(scriptLoader.indexOf("'./scripts/app/bootstrap.js'"));
  });
});
