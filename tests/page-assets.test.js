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

  it('loads the tutorial module before bootstrap in the main module', () => {
    const mainModule = readRootFile('scripts/app/main.js');

    expect(mainModule).toContain("'./tutorial.js'");
    expect(mainModule.indexOf("'./tutorial.js'"))
      .toBeLessThan(mainModule.indexOf("'./bootstrap.js'"));
  });

  it('keeps FF14 asset visualizations out of supporter-only pricing copy', () => {
    const premium = readRootFile('premium.html');

    expect(premium).toContain('デバフレーン、シナジーレーン、PT比較などの基本的な可視化機能は、無料ユーザーでも利用できます');
    expect(premium).toContain('FINAL FANTASY XIVの画像・名称・アイコン等へのアクセスを販売するものではありません');
    expect(premium).toContain('将来的な追加利便性・新機能へのアクセス');
    expect(premium).not.toContain(['Supporter', 'unlocks', 'analysis', 'lanes'].join(' '));
    expect(premium).not.toContain(['比較回数', '\u7121\u5236\u9650'].join(''));
    expect(premium).not.toContain(['\u9ad8\u983b\u5ea6', '\u30ad\u30e3\u30c3\u30b7\u30e5\u66f4\u65b0'].join(''));
    expect(premium).not.toContain(['\u5c65\u6b74\u4fdd\u5b58', ' / ', '\u4fdd\u5b58\u6570\u62e1\u5f35'].join(''));
  });
});
