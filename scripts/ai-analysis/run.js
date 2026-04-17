#!/usr/bin/env node
'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const ANALYSIS_DAYS = 7;

function requireEnv() {
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GROQ_API_KEY'].filter(
    (key) => !process.env[key],
  );
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supabase ${path} → ${response.status}: ${body}`);
  }

  return response.json().catch(() => null);
}

async function fetchAnalyticsEvents(periodStart) {
  const since = periodStart.toISOString();
  return supabaseFetch(
    `/app_events?created_at=gte.${since}&order=created_at.desc&limit=2000`,
    { headers: { Prefer: 'return=representation' } },
  );
}

async function fetchFeedback(periodStart) {
  const since = periodStart.toISOString();
  return supabaseFetch(
    `/feedback_entries?created_at=gte.${since}&bucket=eq.general&order=created_at.desc&limit=200`,
    { headers: { Prefer: 'return=representation' } },
  );
}

function summarizeAnalytics(events) {
  const counts = { page_view: 0, report_loaded: 0, comparison_completed: 0, api_error: 0 };
  const jobMap = new Map();
  const errorMap = new Map();

  for (const e of events) {
    if (e.event_type in counts) counts[e.event_type]++;

    if (e.event_type === 'comparison_completed') {
      const jobA = e.details?.jobA;
      const jobB = e.details?.jobB;
      if (jobA) jobMap.set(jobA, (jobMap.get(jobA) || 0) + 1);
      if (jobB) jobMap.set(jobB, (jobMap.get(jobB) || 0) + 1);
    }

    if (e.event_type === 'api_error') {
      const label = `${e.details?.stage || 'unknown'}:${e.details?.reason || e.details?.kind || ''}`;
      errorMap.set(label, (errorMap.get(label) || 0) + 1);
    }
  }

  const topJobs = [...jobMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([job, count]) => ({ job, count }));

  const topErrors = [...errorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  return { counts, topJobs, topErrors };
}

function summarizeFeedback(entries) {
  const byCategory = {};
  const samples = entries.slice(0, 20).map((e) => ({
    category: e.category,
    subject: e.subject,
    body: e.body.slice(0, 200),
    ai_reason: e.ai_reason,
  }));

  for (const e of entries) {
    byCategory[e.category] = (byCategory[e.category] || 0) + 1;
  }

  return { total: entries.length, byCategory, samples };
}

function buildPrompt(analyticsSummary, feedbackSummary, periodStart, periodEnd) {
  return `あなたはFFXIVスキルローテーション比較ツール「xiv-srd.com」の運営アナリストです。
以下のデータをもとに、日本語で運営レポートを作成してください。

## 分析期間
${periodStart.toLocaleDateString('ja-JP')} 〜 ${periodEnd.toLocaleDateString('ja-JP')}

## アナリティクスデータ（直近${ANALYSIS_DAYS}日）
- ページビュー: ${analyticsSummary.counts.page_view}
- レポート読み込み: ${analyticsSummary.counts.report_loaded}
- 比較完了: ${analyticsSummary.counts.comparison_completed}
- APIエラー: ${analyticsSummary.counts.api_error}
- 比較率（PV比）: ${analyticsSummary.counts.page_view > 0 ? ((analyticsSummary.counts.comparison_completed / analyticsSummary.counts.page_view) * 100).toFixed(1) : 0}%

人気ジョブ（比較回数順）:
${analyticsSummary.topJobs.map((j) => `- ${j.job}: ${j.count}回`).join('\n') || '- データなし'}

エラー内訳:
${analyticsSummary.topErrors.map((e) => `- ${e.label}: ${e.count}件`).join('\n') || '- エラーなし'}

## フィードバックデータ（直近${ANALYSIS_DAYS}日）
- 合計件数: ${feedbackSummary.total}件
- カテゴリ別: ${Object.entries(feedbackSummary.byCategory).map(([k, v]) => `${k}:${v}件`).join('、') || 'なし'}

フィードバックサンプル:
${feedbackSummary.samples.map((s) => `[${s.category}] ${s.subject}\n  内容: ${s.body}\n  AI判定: ${s.ai_reason || 'なし'}`).join('\n\n') || '- フィードバックなし'}

## レポート要件
以下の構成でMarkdownレポートを作成してください。コードブロックや余分な前置きは不要です。

### 📊 利用状況サマリー
数値から読み取れる全体的な傾向を2〜3文で。

### 🎮 人気ジョブ・トレンド
比較されているジョブの傾向と気づき。

### ⚠️ 注目すべき問題
エラーやフィードバックから見えてくる課題。

### 💡 改善アクション
優先度順に3つ以内の具体的なアクション提案。

### 📝 フィードバック要約
ユーザーの声から見えるニーズや感情のサマリー。`;
}

async function callGroq(prompt) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Groq API → ${response.status}: ${body}`);
  }

  const json = await response.json();
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq returned empty response');
  return text;
}

async function saveReport({ periodStart, periodEnd, reportMd, analyticsSnapshot, feedbackSnapshot }) {
  await supabaseFetch('/analysis_reports', {
    method: 'POST',
    body: JSON.stringify({
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      report_md: reportMd,
      analytics_snapshot: analyticsSnapshot,
      feedback_snapshot: feedbackSnapshot,
      model: GROQ_MODEL,
    }),
  });
}

async function main() {
  requireEnv();

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - ANALYSIS_DAYS * 24 * 60 * 60 * 1000);

  console.log(`Fetching data from ${periodStart.toISOString()} to ${periodEnd.toISOString()}...`);

  const [events, feedback] = await Promise.all([
    fetchAnalyticsEvents(periodStart),
    fetchFeedback(periodStart),
  ]);

  console.log(`Fetched ${events.length} events, ${feedback.length} feedback entries.`);

  const analyticsSummary = summarizeAnalytics(events);
  const feedbackSummary = summarizeFeedback(feedback);
  const prompt = buildPrompt(analyticsSummary, feedbackSummary, periodStart, periodEnd);

  console.log('Calling Groq...');
  const reportMd = await callGroq(prompt);

  console.log('Saving report to Supabase...');
  await saveReport({
    periodStart,
    periodEnd,
    reportMd,
    analyticsSnapshot: analyticsSummary,
    feedbackSnapshot: { total: feedbackSummary.total, byCategory: feedbackSummary.byCategory },
  });

  console.log('Done.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
