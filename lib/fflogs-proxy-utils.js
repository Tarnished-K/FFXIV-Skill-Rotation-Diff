const MISSING_ENV_MESSAGE = 'サーバー設定が未完了です。FFLOGS_CLIENT_ID と FFLOGS_CLIENT_SECRET を設定してください。';
const PUBLIC_ONLY_MESSAGE = '公開ログのみ対応です。FF Logs 側で公開されているレポートを指定してください。';

function normalizeErrorMessage(rawMessage) {
  const message = String(rawMessage || 'Unknown FF Logs proxy error.');
  if (/Missing required environment variable/i.test(message)) {
    return MISSING_ENV_MESSAGE;
  }
  if (/authoriz|permission|private|forbidden|public/i.test(message)) {
    return PUBLIC_ONLY_MESSAGE;
  }
  return message;
}

function inferStatusCode(message) {
  if (message.includes(PUBLIC_ONLY_MESSAGE)) return 403;
  if (message.includes(MISSING_ENV_MESSAGE)) return 500;
  return 502;
}

module.exports = {
  MISSING_ENV_MESSAGE,
  PUBLIC_ONLY_MESSAGE,
  inferStatusCode,
  normalizeErrorMessage,
};
