# Feedback Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ご要望フォーム` と `feedback-admin.html` を追加し、送信時の AI 判定、一般/ゴミ箱の仕分け、既読管理、既読後 7 日削除、将来の Claude / Codex 自動化に使える管理 API を実装する。

**Architecture:** 既存の `app_events` とは別に `feedback_entries` と `feedback_rate_limits` を Supabase に持つ。フロントは静的 HTML + ページ単位の小さな JS で構成し、保存・分類・管理操作はすべて Netlify Functions 経由に寄せる。送信 API は入力検証とレート制限を通過した後にだけ OpenAI API を呼び、一覧/API 操作は共通のフィードバックデータ層を使う。

**Tech Stack:** Static HTML, vanilla JS, Netlify Functions (CommonJS), Supabase REST API, OpenAI API, Vitest

---

## File structure

- Modify: `index.html`
  - `ご要望フォーム` 導線を追加
  - `Log` / `Error Log` のカードを非表示化
- Modify: `styles.css`
  - フォーム画面、管理画面、非表示ログ、管理カード、集計表示のスタイル追加
- Modify: `netlify.toml`
  - feedback 系 API の redirect を追加
- Modify: `.env.example`
  - OpenAI API 用 env var を追記
- Modify: `package.json`
  - バージョンを `1.0.16` に更新
- Modify: `supabase/schema.sql`
  - `feedback_entries` と `feedback_rate_limits` を追加
- Modify: `README.md`
  - 新画面と必要 env var の説明を追加
- Create: `contact.html`
  - ご要望フォーム画面
- Create: `feedback-admin.html`
  - 管理画面
- Create: `scripts/shared/feedback-shared.js`
  - UMD 形式の共通定数、カテゴリ表示、入力検証、制限値
- Create: `scripts/shared/feedback-form.js`
  - ご要望フォーム送信処理
- Create: `scripts/shared/feedback-admin.js`
  - 管理画面の状態管理、一覧描画、操作イベント
- Create: `lib/feedback-db.js`
  - Supabase に対する CRUD、一覧取得、既読更新、復元、ゴミ箱移動、purge、rate limit 操作
- Create: `lib/feedback-moderation.js`
  - OpenAI API 呼び出しと `general / trash` の決定
- Create: `lib/feedback-list-utils.js`
  - 一覧レスポンスの整形、サマリー集計、カテゴリ別グルーピング
- Create: `netlify/functions/feedback-submit.js`
- Create: `netlify/functions/feedback-admin-list.js`
- Create: `netlify/functions/feedback-admin-mark-read.js`
- Create: `netlify/functions/feedback-admin-restore.js`
- Create: `netlify/functions/feedback-admin-move-to-trash.js`
- Create: `netlify/functions/feedback-admin-purge.js`
- Test: `tests/feedback-shared.test.js`
- Test: `tests/feedback-list-utils.test.js`
- Test: `tests/feedback-moderation.test.js`
- Test: `tests/feedback-submit.test.js`
- Test: `tests/feedback-admin-functions.test.js`
- Test: `tests/feedback-pages.test.js`
- Test: `tests/build-info.test.js`

### Task 1: Add shared feedback contract helpers

**Files:**
- Create: `scripts/shared/feedback-shared.js`
- Test: `tests/feedback-shared.test.js`

- [ ] **Step 1: Write the failing test**

```js
const {
  FEEDBACK_BUCKETS,
  FEEDBACK_CATEGORIES,
  MAX_BODY_LENGTH,
  MAX_SUBJECT_LENGTH,
  normalizeFeedbackInput,
} = require('../scripts/shared/feedback-shared.js');

describe('normalizeFeedbackInput', () => {
  it('accepts valid category, subject, and body', () => {
    expect(normalizeFeedbackInput({
      category: 'bug_report',
      subject: '件名',
      body: '本文です',
      website: '',
    })).toEqual({
      ok: true,
      value: {
        category: 'bug_report',
        subject: '件名',
        body: '本文です',
      },
    });
  });

  it('rejects invalid category and empty fields', () => {
    expect(normalizeFeedbackInput({
      category: 'unknown',
      subject: ' ',
      body: '',
      website: '',
    })).toEqual({
      ok: false,
      error: 'Invalid feedback input.',
    });
  });

  it('rejects honeypot spam and oversized input', () => {
    expect(MAX_SUBJECT_LENGTH).toBe(200);
    expect(MAX_BODY_LENGTH).toBe(2000);
    expect(FEEDBACK_BUCKETS).toEqual(['general', 'trash']);
    expect(FEEDBACK_CATEGORIES).toEqual(['bug_report', 'feature_request', 'question', 'other']);

    expect(normalizeFeedbackInput({
      category: 'question',
      subject: 'x'.repeat(201),
      body: '本文',
      website: 'bot-filled',
    })).toEqual({
      ok: false,
      error: 'Invalid feedback input.',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/feedback-shared.test.js`  
Expected: FAIL with `Cannot find module '../scripts/shared/feedback-shared.js'`

- [ ] **Step 3: Write minimal implementation**

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.FeedbackShared = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const FEEDBACK_BUCKETS = ['general', 'trash'];
  const FEEDBACK_CATEGORIES = ['bug_report', 'feature_request', 'question', 'other'];
  const CATEGORY_LABELS = {
    bug_report: '不具合報告',
    feature_request: '改善要望',
    question: '質問',
    other: 'その他',
  };
  const MAX_SUBJECT_LENGTH = 200;
  const MAX_BODY_LENGTH = 2000;
  const HONEYPOT_FIELD = 'website';

  function normalizeFeedbackInput(input = {}) {
    const category = String(input.category || '').trim();
    const subject = String(input.subject || '').trim();
    const body = String(input.body || '').trim();
    const honeypot = String(input[HONEYPOT_FIELD] || '').trim();

    const valid =
      FEEDBACK_CATEGORIES.includes(category) &&
      subject.length > 0 &&
      subject.length <= MAX_SUBJECT_LENGTH &&
      body.length > 0 &&
      body.length <= MAX_BODY_LENGTH &&
      !honeypot;

    if (!valid) {
      return { ok: false, error: 'Invalid feedback input.' };
    }

    return {
      ok: true,
      value: { category, subject, body },
    };
  }

  return {
    CATEGORY_LABELS,
    FEEDBACK_BUCKETS,
    FEEDBACK_CATEGORIES,
    HONEYPOT_FIELD,
    MAX_BODY_LENGTH,
    MAX_SUBJECT_LENGTH,
    normalizeFeedbackInput,
  };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/feedback-shared.test.js`  
Expected: PASS with `1 passed file`

- [ ] **Step 5: Commit**

```bash
git add scripts/shared/feedback-shared.js tests/feedback-shared.test.js
git commit -m "feat: add feedback shared contract helpers"
```

### Task 2: Add schema and feedback data helpers

**Files:**
- Modify: `supabase/schema.sql`
- Create: `lib/feedback-db.js`
- Create: `lib/feedback-list-utils.js`
- Test: `tests/feedback-list-utils.test.js`

- [ ] **Step 1: Write the failing test**

```js
const {
  buildFeedbackSummary,
  groupFeedbackItems,
} = require('../lib/feedback-list-utils');

describe('buildFeedbackSummary', () => {
  it('counts unread, general, trash, and purge candidates', () => {
    const rows = [
      { bucket: 'general', is_read: false, delete_after_at: null },
      { bucket: 'general', is_read: true, delete_after_at: '2026-04-20T00:00:00.000Z' },
      { bucket: 'trash', is_read: false, delete_after_at: null },
      { bucket: 'trash', is_read: true, delete_after_at: '2026-04-10T00:00:00.000Z' },
    ];

    expect(buildFeedbackSummary(rows, Date.parse('2026-04-17T00:00:00.000Z'))).toEqual({
      unread_count: 2,
      general_count: 2,
      trash_count: 2,
      pending_purge_count: 1,
    });
  });
});

describe('groupFeedbackItems', () => {
  it('groups only general items by category and leaves trash flat', () => {
    const rows = [
      { id: 1, bucket: 'general', category: 'bug_report' },
      { id: 2, bucket: 'general', category: 'question' },
      { id: 3, bucket: 'trash', category: 'feature_request' },
    ];

    expect(groupFeedbackItems(rows).general.bug_report).toHaveLength(1);
    expect(groupFeedbackItems(rows).general.question).toHaveLength(1);
    expect(groupFeedbackItems(rows).trash).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/feedback-list-utils.test.js`  
Expected: FAIL with `Cannot find module '../lib/feedback-list-utils'`

- [ ] **Step 3: Write minimal implementation**

```sql
create table if not exists public.feedback_entries (
  id bigint generated by default as identity primary key,
  category text not null,
  subject text not null,
  body text not null,
  bucket text not null default 'general',
  ai_reason text not null default '',
  admin_note text not null default '',
  is_read boolean not null default false,
  read_at timestamptz,
  delete_after_at timestamptz,
  ip_hash text,
  moderation_provider text not null default '',
  moderation_model text not null default '',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.feedback_rate_limits (
  ip_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (ip_hash, window_started_at)
);
```

```js
function buildFeedbackSummary(rows, nowMs = Date.now()) {
  return rows.reduce((summary, row) => {
    if (!row.is_read) summary.unread_count += 1;
    if (row.bucket === 'general') summary.general_count += 1;
    if (row.bucket === 'trash') summary.trash_count += 1;
    if (row.is_read && row.delete_after_at && Date.parse(row.delete_after_at) <= nowMs) {
      summary.pending_purge_count += 1;
    }
    return summary;
  }, {
    unread_count: 0,
    general_count: 0,
    trash_count: 0,
    pending_purge_count: 0,
  });
}

function groupFeedbackItems(rows) {
  const grouped = {
    general: {
      bug_report: [],
      feature_request: [],
      question: [],
      other: [],
    },
    trash: [],
  };

  rows.forEach((row) => {
    if (row.bucket === 'trash') {
      grouped.trash.push(row);
      return;
    }
    grouped.general[row.category]?.push(row);
  });

  return grouped;
}

module.exports = {
  buildFeedbackSummary,
  groupFeedbackItems,
};
```

```js
async function cleanupRateLimitWindows(fetchImpl, config, nowIso) {
  const url = new URL(`${config.url}/rest/v1/feedback_rate_limits`);
  url.searchParams.set('window_started_at', `lt.${new Date(Date.parse(nowIso) - (10 * 60 * 1000)).toISOString()}`);
  return fetchImpl(url, {
    method: 'DELETE',
    headers: getSupabaseHeaders(config, { Prefer: 'return=minimal' }),
  });
}

async function checkAndIncrementFeedbackRateLimit({ fetchImpl = fetch, ipHash, now = new Date().toISOString() }) {
  const config = getSupabaseConfig();
  const windowMs = 10 * 60 * 1000;
  const startedMs = Math.floor(Date.parse(now) / windowMs) * windowMs;
  const windowStartedAt = new Date(startedMs).toISOString();

  await cleanupRateLimitWindows(fetchImpl, config, now);

  const selectUrl = new URL(`${config.url}/rest/v1/feedback_rate_limits`);
  selectUrl.searchParams.set('select', 'request_count');
  selectUrl.searchParams.set('ip_hash', `eq.${ipHash}`);
  selectUrl.searchParams.set('window_started_at', `eq.${windowStartedAt}`);

  const selectResponse = await fetchImpl(selectUrl, {
    method: 'GET',
    headers: getSupabaseHeaders(config, { Accept: 'application/json' }),
  });
  const rows = await selectResponse.json();
  const currentCount = Number(rows[0]?.request_count || 0);
  if (currentCount >= 5) {
    return { allowed: false, requestCount: currentCount };
  }

  const upsertResponse = await fetchImpl(`${config.url}/rest/v1/feedback_rate_limits`, {
    method: 'POST',
    headers: getSupabaseHeaders(config, {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    }),
    body: JSON.stringify([{
      ip_hash: ipHash,
      window_started_at: windowStartedAt,
      request_count: currentCount + 1,
      updated_at: now,
    }]),
  });

  if (!upsertResponse.ok) {
    throw new Error('Feedback rate limit upsert failed.');
  }

  return { allowed: true, requestCount: currentCount + 1, windowStartedAt };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/feedback-list-utils.test.js`  
Expected: PASS with `1 passed file`

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql lib/feedback-db.js lib/feedback-list-utils.js tests/feedback-list-utils.test.js
git commit -m "feat: add feedback schema and storage helpers"
```

### Task 3: Add moderation and submit API

**Files:**
- Modify: `.env.example`
- Modify: `netlify.toml`
- Create: `lib/feedback-moderation.js`
- Create: `netlify/functions/feedback-submit.js`
- Test: `tests/feedback-moderation.test.js`
- Test: `tests/feedback-submit.test.js`

- [ ] **Step 1: Write the failing test**

```js
const { decideFeedbackBucket } = require('../lib/feedback-moderation');

describe('decideFeedbackBucket', () => {
  it('normalizes model output into general/trash', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: '{"bucket":"trash","reason":"abusive content"}',
      }),
    });

    await expect(decideFeedbackBucket({
      fetchImpl,
      apiKey: 'test-key',
      model: 'test-model',
      subject: 'hello',
      body: 'you are terrible',
    })).resolves.toEqual({
      bucket: 'trash',
      reason: 'abusive content',
      provider: 'openai',
      model: 'test-model',
    });
  });
});
```

```js
vi.mock('../lib/feedback-db', () => ({
  checkAndIncrementFeedbackRateLimit: vi.fn(),
  createFeedbackEntry: vi.fn(),
}));

vi.mock('../lib/feedback-moderation', () => ({
  decideFeedbackBucket: vi.fn(),
}));

const { handler } = require('../netlify/functions/feedback-submit');

describe('feedback-submit handler', () => {
  it('returns 429 before moderation when rate limit is exceeded', async () => {
    const { checkAndIncrementFeedbackRateLimit } = require('../lib/feedback-db');
    checkAndIncrementFeedbackRateLimit.mockResolvedValue({ allowed: false });

    const response = await handler({
      httpMethod: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.8' },
      body: JSON.stringify({
        category: 'question',
        subject: '件名',
        body: '本文',
        website: '',
      }),
    });

    expect(response.statusCode).toBe(429);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/feedback-moderation.test.js tests/feedback-submit.test.js`  
Expected: FAIL with missing module errors for `feedback-moderation.js` and `feedback-submit.js`

- [ ] **Step 3: Write minimal implementation**

```env
OPENAI_API_KEY=
OPENAI_FEEDBACK_MODEL=gpt-5-mini
```

```toml
[[redirects]]
  from = "/api/feedback-submit"
  to = "/.netlify/functions/feedback-submit"
  status = 200
```

```js
async function decideFeedbackBucket({ fetchImpl = fetch, apiKey, model, subject, body }) {
  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'Return JSON {"bucket":"general|trash","reason":"short reason"}. Use trash only for abuse, slurs, harassment, or unreadable nonsense.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `subject: ${subject}\nbody: ${body}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    return { bucket: 'general', reason: 'moderation_fallback', provider: 'openai', model };
  }

  const json = await response.json();
  const parsed = JSON.parse(json.output_text || '{"bucket":"general","reason":"moderation_fallback"}');
  const bucket = parsed.bucket === 'trash' ? 'trash' : 'general';
  return { bucket, reason: String(parsed.reason || 'moderation_ok'), provider: 'openai', model };
}
```

```js
const { normalizeFeedbackInput } = require('../../scripts/shared/feedback-shared.js');
const { checkAndIncrementFeedbackRateLimit, createFeedbackEntry } = require('../../lib/feedback-db');
const { decideFeedbackBucket } = require('../../lib/feedback-moderation');

exports.handler = async (event) => {
  const payload = JSON.parse(event.body || '{}');
  const normalized = normalizeFeedbackInput(payload);
  if (!normalized.ok) return json(400, { ok: false, error: normalized.error });

  const ip = String(event.headers['x-forwarded-for'] || event.headers['client-ip'] || '').split(',')[0].trim();
  const rate = await checkAndIncrementFeedbackRateLimit({ ip, now: new Date().toISOString() });
  if (!rate.allowed) return json(429, { ok: false, error: 'Too Many Requests' });

  const moderation = await decideFeedbackBucket({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_FEEDBACK_MODEL || 'gpt-5-mini',
    subject: normalized.value.subject,
    body: normalized.value.body,
  });

  await createFeedbackEntry({
    ...normalized.value,
    bucket: moderation.bucket,
    aiReason: moderation.reason,
    moderationProvider: moderation.provider,
    moderationModel: moderation.model,
    ip,
  });

  return json(202, { ok: true, bucket: moderation.bucket });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/feedback-moderation.test.js tests/feedback-submit.test.js`  
Expected: PASS with `2 passed files`

- [ ] **Step 5: Commit**

```bash
git add .env.example netlify.toml lib/feedback-moderation.js netlify/functions/feedback-submit.js tests/feedback-moderation.test.js tests/feedback-submit.test.js
git commit -m "feat: add feedback submit moderation pipeline"
```

### Task 4: Add admin list and admin action APIs

**Files:**
- Create: `netlify/functions/feedback-admin-list.js`
- Create: `netlify/functions/feedback-admin-mark-read.js`
- Create: `netlify/functions/feedback-admin-restore.js`
- Create: `netlify/functions/feedback-admin-move-to-trash.js`
- Create: `netlify/functions/feedback-admin-purge.js`
- Test: `tests/feedback-admin-functions.test.js`
- Modify: `netlify.toml`

- [ ] **Step 1: Write the failing test**

```js
vi.mock('../lib/feedback-db', () => ({
  listFeedbackEntries: vi.fn(),
  updateFeedbackReadState: vi.fn(),
  restoreFeedbackEntry: vi.fn(),
  moveFeedbackEntryToTrash: vi.fn(),
  purgeExpiredFeedbackEntries: vi.fn(),
}));

const listHandler = require('../netlify/functions/feedback-admin-list').handler;
const markReadHandler = require('../netlify/functions/feedback-admin-mark-read').handler;

describe('feedback admin handlers', () => {
  it('returns summary, items, and pagination for list API', async () => {
    const { listFeedbackEntries } = require('../lib/feedback-db');
    listFeedbackEntries.mockResolvedValue({
      summary: { unread_count: 1, general_count: 1, trash_count: 0, pending_purge_count: 0 },
      items: [{ id: 1, category: 'question', subject: '件名', body: '本文', bucket: 'general', is_read: false, created_at: '2026-04-17T00:00:00.000Z', delete_after_at: null, ai_reason: '', admin_note: '', moderation_provider: 'openai', moderation_model: 'test-model' }],
      pagination: { limit: 20, offset: 0, returned_count: 1 },
    });

    const response = await listHandler({ httpMethod: 'GET', queryStringParameters: {} });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.summary.unread_count).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.pagination.returned_count).toBe(1);
  });

  it('marks entries read and returns delete_after_at', async () => {
    const { updateFeedbackReadState } = require('../lib/feedback-db');
    updateFeedbackReadState.mockResolvedValue({ is_read: true, delete_after_at: '2026-04-24T00:00:00.000Z' });

    const response = await markReadHandler({
      httpMethod: 'POST',
      body: JSON.stringify({ id: 12, isRead: true }),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).delete_after_at).toBe('2026-04-24T00:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/feedback-admin-functions.test.js`  
Expected: FAIL with missing handler modules

- [ ] **Step 3: Write minimal implementation**

```toml
[[redirects]]
  from = "/api/feedback-admin-list"
  to = "/.netlify/functions/feedback-admin-list"
  status = 200

[[redirects]]
  from = "/api/feedback-admin-mark-read"
  to = "/.netlify/functions/feedback-admin-mark-read"
  status = 200

[[redirects]]
  from = "/api/feedback-admin-restore"
  to = "/.netlify/functions/feedback-admin-restore"
  status = 200

[[redirects]]
  from = "/api/feedback-admin-move-to-trash"
  to = "/.netlify/functions/feedback-admin-move-to-trash"
  status = 200

[[redirects]]
  from = "/api/feedback-admin-purge"
  to = "/.netlify/functions/feedback-admin-purge"
  status = 200
```

```js
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method Not Allowed' });
  const limit = Math.max(1, Math.min(Number(event.queryStringParameters?.limit) || 20, 100));
  const offset = Math.max(0, Number(event.queryStringParameters?.offset) || 0);

  const result = await listFeedbackEntries({
    bucket: event.queryStringParameters?.bucket || '',
    category: event.queryStringParameters?.category || '',
    isRead: event.queryStringParameters?.is_read || '',
    limit,
    offset,
  });

  return json(200, result);
};
```

```js
exports.handler = async (event) => {
  const { id, isRead } = JSON.parse(event.body || '{}');
  const result = await updateFeedbackReadState({ id, isRead });
  return json(200, { ok: true, ...result });
};
```

```js
exports.handler = async (event) => {
  const { id } = JSON.parse(event.body || '{}');
  const result = await restoreFeedbackEntry({ id });
  return json(200, { ok: true, ...result });
};

exports.handler = async (event) => {
  const { id, reason } = JSON.parse(event.body || '{}');
  const result = await moveFeedbackEntryToTrash({ id, reason });
  return json(200, { ok: true, ...result });
};

exports.handler = async (event) => {
  const result = await purgeExpiredFeedbackEntries();
  return json(200, { ok: true, deletedCount: result.deletedCount });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/feedback-admin-functions.test.js`  
Expected: PASS with `1 passed file`

- [ ] **Step 5: Commit**

```bash
git add netlify.toml netlify/functions/feedback-admin-*.js tests/feedback-admin-functions.test.js
git commit -m "feat: add feedback admin function endpoints"
```

### Task 5: Build form page, admin page, and top-page entry points

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Create: `contact.html`
- Create: `feedback-admin.html`
- Create: `scripts/shared/feedback-form.js`
- Create: `scripts/shared/feedback-admin.js`
- Test: `tests/feedback-pages.test.js`

- [ ] **Step 1: Write the failing test**

```js
const fs = require('fs');
const path = require('path');

describe('feedback pages', () => {
  it('adds the goyobo form link and hides debug sections on the top page', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    expect(html).toContain('ご要望フォーム');
    expect(html).toContain('id="debugNormal"');
    expect(html).toContain('id="debugError"');
    expect(html).toContain('class="card hidden"');
  });

  it('contains a dedicated contact page and admin page shell', () => {
    const contact = fs.readFileSync(path.join(__dirname, '..', 'contact.html'), 'utf8');
    const admin = fs.readFileSync(path.join(__dirname, '..', 'feedback-admin.html'), 'utf8');

    expect(contact).toContain('カテゴリ');
    expect(contact).toContain('件名');
    expect(contact).toContain('本文');
    expect(admin).toContain('一般');
    expect(admin).toContain('ゴミ箱');
    expect(admin).toContain('未読件数');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/feedback-pages.test.js`  
Expected: FAIL because `contact.html` and `feedback-admin.html` do not exist and `ご要望フォーム` is not present on `index.html`

- [ ] **Step 3: Write minimal implementation**

```html
<!-- index.html -->
<div class="header-actions">
  <a id="tutorialBtn" class="button-link ghost tutorial-launch-btn" href="/tutorial.html">初めての方はこちら</a>
  <a class="button-link ghost tutorial-launch-btn" href="/contact.html">ご要望フォーム</a>
  <button id="langToggle" type="button" class="lang-btn">EN</button>
</div>

<section class="card hidden" id="debugNormal">
  <h2 id="debugNormalTitle">Log</h2>
  <pre id="debugLog" class="debug-log"></pre>
</section>
<section class="card hidden" id="debugError">
  <h2 id="debugErrorTitle">Error Log</h2>
  <pre id="errorLog" class="debug-log error-log"></pre>
</section>
```

```html
<!-- contact.html -->
<main class="feedback-main">
  <section class="card feedback-form-card">
    <h2>ご要望フォーム</h2>
    <label>カテゴリ
      <select id="feedbackCategory">
        <option value="bug_report">不具合報告</option>
        <option value="feature_request">改善要望</option>
        <option value="question">質問</option>
        <option value="other">その他</option>
      </select>
    </label>
    <label>件名 <input id="feedbackSubject" maxlength="200" /></label>
    <label>本文 <textarea id="feedbackBody" maxlength="2000"></textarea></label>
    <input id="feedbackWebsite" name="website" class="feedback-honeypot" tabindex="-1" autocomplete="off" />
    <button id="feedbackSubmitBtn" type="button">送信する</button>
    <p id="feedbackMessage" class="message"></p>
  </section>
</main>
<script src="./scripts/shared/feedback-shared.js"></script>
<script src="./scripts/shared/feedback-form.js"></script>
```

```html
<!-- feedback-admin.html -->
<main class="feedback-admin-main">
  <section class="card feedback-admin-summary">
    <div>未読件数 <strong id="feedbackUnreadCount">-</strong></div>
    <div>一般件数 <strong id="feedbackGeneralCount">-</strong></div>
    <div>ゴミ箱件数 <strong id="feedbackTrashCount">-</strong></div>
    <div>削除待ち件数 <strong id="feedbackPendingPurgeCount">-</strong></div>
  </section>
  <section class="card">
    <button data-feedback-tab="general">一般</button>
    <button data-feedback-tab="trash">ゴミ箱</button>
    <button id="feedbackPurgeBtn" type="button">期限切れ削除を実行する</button>
  </section>
  <section id="feedbackGeneralSections"></section>
  <section id="feedbackTrashSection" class="hidden"></section>
</main>
<script src="./scripts/shared/feedback-shared.js"></script>
<script src="./scripts/shared/feedback-admin.js"></script>
```

```js
// scripts/shared/feedback-form.js
document.getElementById('feedbackSubmitBtn')?.addEventListener('click', async () => {
  const response = await fetch('/api/feedback-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: document.getElementById('feedbackCategory').value,
      subject: document.getElementById('feedbackSubject').value,
      body: document.getElementById('feedbackBody').value,
      website: document.getElementById('feedbackWebsite').value,
    }),
  });
  document.getElementById('feedbackMessage').textContent = response.ok
    ? '送信しました。ありがとうございます。'
    : '送信に失敗しました。';
});
```

```js
// scripts/shared/feedback-admin.js
async function loadFeedback(offset = 0) {
  const response = await fetch(`/api/feedback-admin-list?limit=20&offset=${offset}`, { cache: 'no-store' });
  const json = await response.json();
  renderSummary(json.summary);
  renderItems(json.items);
}

document.getElementById('feedbackPurgeBtn')?.addEventListener('click', async () => {
  await fetch('/api/feedback-admin-purge', { method: 'POST' });
  await loadFeedback(0);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/feedback-pages.test.js`  
Expected: PASS with `1 passed file`

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css contact.html feedback-admin.html scripts/shared/feedback-form.js scripts/shared/feedback-admin.js tests/feedback-pages.test.js
git commit -m "feat: add feedback form and admin pages"
```

### Task 6: Document env vars, bump version, and verify build info

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `package.json`
- Test: `tests/build-info.test.js`

- [ ] **Step 1: Write the failing test**

```js
const packageJson = require('../package.json');
const { handler } = require('../netlify/functions/build-info');

describe('build-info version', () => {
  it('returns the updated package version', async () => {
    expect(packageJson.version).toBe('1.0.16');

    const response = await handler({ httpMethod: 'GET' });
    const body = JSON.parse(response.body);
    expect(body.version).toBe('1.0.16');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/build-info.test.js`  
Expected: FAIL because `package.json` still reports `1.0.15`

- [ ] **Step 3: Write minimal implementation**

```json
{
  "version": "1.0.16"
}
```

```env
OPENAI_API_KEY=
OPENAI_FEEDBACK_MODEL=gpt-5-mini
```

```md
## ご要望フォーム

- `/contact.html` から送信できます
- 管理画面は `/feedback-admin.html` です
- OpenAI API を使うため `OPENAI_API_KEY` と `OPENAI_FEEDBACK_MODEL` が必要です
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/build-info.test.js`  
Expected: PASS with `1 passed file`

- [ ] **Step 5: Commit**

```bash
git add README.md .env.example package.json tests/build-info.test.js
git commit -m "chore: bump version for feedback intake test build"
```

### Task 7: Full verification

**Files:**
- Verify only

- [ ] **Step 1: Run the focused feedback test suite**

Run:

```bash
npm test -- tests/feedback-shared.test.js tests/feedback-list-utils.test.js tests/feedback-moderation.test.js tests/feedback-submit.test.js tests/feedback-admin-functions.test.js tests/feedback-pages.test.js tests/build-info.test.js
```

Expected: all seven files PASS

- [ ] **Step 2: Run the full repository test suite**

Run:

```bash
npm test
```

Expected: all existing tests plus the new feedback tests PASS

- [ ] **Step 3: Run syntax checks for new browser scripts and functions**

Run:

```bash
node --check scripts/shared/feedback-shared.js
node --check scripts/shared/feedback-form.js
node --check scripts/shared/feedback-admin.js
node --check lib/feedback-db.js
node --check lib/feedback-moderation.js
node --check lib/feedback-list-utils.js
node --check netlify/functions/feedback-submit.js
node --check netlify/functions/feedback-admin-list.js
node --check netlify/functions/feedback-admin-mark-read.js
node --check netlify/functions/feedback-admin-restore.js
node --check netlify/functions/feedback-admin-move-to-trash.js
node --check netlify/functions/feedback-admin-purge.js
```

Expected: no output and exit code 0 for every file

- [ ] **Step 4: Manual browser smoke test**

Check:

```text
1. Open / and confirm ご要望フォーム link is visible and Log / Error Log cards are hidden.
2. Open /contact.html and submit a normal message.
3. Open /feedback-admin.html and confirm the item appears under 一般 > selected category.
4. Submit a clearly abusive message and confirm it lands in ゴミ箱.
5. Mark one item 既読 and confirm 7日後に削除予定 is shown.
6. Move one general item to ゴミ箱 and confirm it becomes unread and loses delete_after_at.
7. Restore one trash item and confirm it returns to its original category as unread.
8. Press 期限切れ削除を実行する and confirm deletedCount is shown or the list refreshes.
```

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: ship feedback intake workflow"
```
