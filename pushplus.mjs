export async function sendPushPlus({ token, title, content }) {
  if (!token) {
    throw new Error("未配置 PUSHPLUS_TOKEN");
  }

  const response = await fetch("https://www.pushplus.plus/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, title, content, template: "markdown" })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`PushPlus 推送失败：HTTP ${response.status} ${text}`);
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { code: response.status, msg: text };
  }

  if (body.code !== 200) {
    throw new Error(`PushPlus 推送失败：${body.msg ?? text}`);
  }

  return body;
}
