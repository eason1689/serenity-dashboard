import { sendPushPlus } from "./pushplus.mjs";

const now = new Intl.DateTimeFormat("zh-HK", {
  timeZone: "Asia/Hong_Kong",
  dateStyle: "full",
  timeStyle: "long"
}).format(new Date());

sendPushPlus({
  token: process.env.PUSHPLUS_TOKEN,
  title: "07709监控恢复测试",
  content: `# 07709监控恢复测试\n\nGitHub Actions → Pushplus 通知链路正常。\n\n测试时间：${now}\n\n这是一条系统测试消息，不是交易信号。`
}).then(() => {
  console.log("07709监控恢复测试推送成功");
}).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
