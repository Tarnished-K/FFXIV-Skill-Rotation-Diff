const packageJson = require('../package.json');
const { handler } = require('../netlify/functions/build-info');

describe('build-info version', () => {
  it('returns the updated package version', async () => {
    expect(packageJson.version).toBe('1.0.21');

    const response = await handler({ httpMethod: 'GET' });
    const body = JSON.parse(response.body);
    expect(body.version).toBe('1.0.21');
  });
});
