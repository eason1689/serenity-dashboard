# Serenity 股票情报看板

一个纯静态 Dashboard，用于展示 Serenity / @aleabitoreddit 的公开推文股票信息流、标的立场、主题分布和风险标记。

## 本地预览

```bash
python3 -m http.server 3000 --bind localhost
```

打开：

```text
http://localhost:3000/
```

## GitHub Pages 部署

1. 新建一个 GitHub 仓库，例如 `serenity-dashboard`。
2. 将本目录文件推送到仓库的 `main` 分支。
3. 在 GitHub 仓库进入 `Settings -> Pages`。
4. Source 选择 `Deploy from a branch`。
5. Branch 选择 `main`，目录选择 `/root`。
6. 保存后等待 GitHub Pages 生成公网网址。

## Cloudflare Pages 部署

1. 进入 Cloudflare Dashboard。
2. 选择 `Workers & Pages -> Create application -> Pages`。
3. 连接 GitHub 仓库。
4. Build command 留空。
5. Build output directory 填 `/`。
6. 部署后会得到一个 `*.pages.dev` 公网网址。

## 数据文件

当前页面读取：

```text
data/signals.json
```

后续自动抓取推文后，只要更新这个 JSON 文件，页面会自动展示新数据。
