const fs = require('fs');
const path = require('path');

describe('feedback pages', () => {
  it('adds the feedback form link and hides debug sections on the top page', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    expect(html).toContain('/contact.html');
    expect(html).toContain('id="debugNormal"');
    expect(html).toContain('id="debugError"');
    expect(html).toContain('class="card hidden"');
  });

  it('keeps the public contact page separate from protected admin pages', () => {
    const contact = fs.readFileSync(path.join(__dirname, '..', 'contact.html'), 'utf8');
    const admin = fs.readFileSync(path.join(__dirname, '..', 'feedback-admin.html'), 'utf8');
    const analytics = fs.readFileSync(path.join(__dirname, '..', 'analytics.html'), 'utf8');
    const adminScript = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'shared', 'feedback-admin.js'), 'utf8');

    expect(contact).toContain('feedbackCategory');
    expect(contact).toContain('feedbackSubject');
    expect(contact).toContain('feedbackBody');
    expect(contact).not.toContain('/feedback-admin.html');
    expect(contact).not.toContain(' AI ');

    expect(admin).toContain('data-feedback-tab="trash"');
    expect(admin).toContain('data-requires-admin-auth="true"');
    expect(admin).toContain('id="adminProtectedContent"');
    expect(admin).toContain('scripts/shared/admin-auth.js');

    expect(analytics).toContain('data-requires-admin-auth="true"');
    expect(analytics).toContain('id="adminProtectedContent"');
    expect(analytics).toContain('scripts/shared/admin-auth.js');

    expect(adminScript).toContain('/api/feedback-admin-list');
  });
});
