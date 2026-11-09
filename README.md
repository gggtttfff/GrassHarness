# GrassHarness

种子不动。用过的东西，长在日志里。

[GrassAgent](https://github.com/gggtttfff/GrassAgent) 管一轮对话怎么跑：流式输出、工具、会话。这个仓库管它周围的那层文字：系统说明、规则、工具提示、技能、记忆。

规则在 `guardrails.md`。生长写不进去。采纳过的改动追加到生长日志，下次启动再装上。日志是 JSONL，打开就能看。

现在没有自动多轮试跑。要长一条，得自己跑一次 `grow`。

## 目录

```
harness/
  system.md
  guardrails.md
  tools.md
  memory.md
  skills/
```

装进模型的顺序是：内置默认，然后这份种子，然后 `~/.grass-harness/growth/<domain>.jsonl`。同一部件，后面的种子盖住默认。生长日志里 `append` 把正文接在已有正文后面，`replace` 换掉正文。种子文件本身不被改写。

一条生长记录：

```json
{"id":"skill:check-tests","kind":"context","title":"跑测试","body":"改完代码后跑这个项目自己的测试，不要只看类型检查过了没。","order":41,"op":"append","domain":"general","situation":"改了存储但没跑测试","lesson":"改完先跑测试","evidence":{"sessionId":"demo","excerpt":"测试是红的"},"createdAt":1760000000000}
```

下次启动，这条会出现在系统提示词里，标题是「跑测试」。`guardrails` 不会出现在这个文件里。

## 跑起来

需要 Node.js 24 或更新。安装时会从 GitHub 拉下 GrassAgent。

```bash
npm install
cp .env.example .env
npm start
```

`.env` 里填 `GRASSHARNESS_API_KEY`。输入后回车，`/quit` 退出。

采纳一条：

```bash
node src/cli.ts grow \
  --id skill:check-tests \
  --title 跑测试 \
  --body "改完代码后跑这个项目自己的测试。" \
  --situation "改了存储但没跑测试" \
  --lesson "改完先跑测试" \
  --excerpt "测试是红的"
```

对 `guardrails` 会直接拒绝，日志文件不会多出这一行。

## 配置

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `GRASSHARNESS_API_KEY` | 对话时必填，`grow` 不用 | 无 |
| `GRASSHARNESS_MODEL` | 模型名 | `gpt-4o-mini` |
| `GRASSHARNESS_BASE_URL` | API 地址 | `https://api.openai.com/v1` |
| `GRASSHARNESS_HOME` | 种子副本、生长日志、会话库 | `~/.grass-harness` |
| `GRASSHARNESS_DOMAIN` | 生长日志按这个名字分文件 | `general` |
| `GRASSHARNESS_WORKSPACE` | 文件工具和命令的工作区 | 启动时的目录 |

系统环境变量盖过 `.env`。

改代码的人看 [docs/architecture.md](docs/architecture.md)。

## 许可

[MIT](./LICENSE) © Pieory
