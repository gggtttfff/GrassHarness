# 架构

给改代码的人看。怎么用在 README。

## 装载

1. `defaults`：种子缺文件时的内置正文。
2. 种子目录：`system.md`、`guardrails.md`、`tools.md`、`memory.md`、`skills/*.md`。有文件就盖住同 id 的默认。
3. 生长日志：按写入顺序重放。`append` 拼接正文，`replace` 换正文。

`loadCatalog` 只做同 id 覆盖，给以后的补丁层用。生长不是覆盖，所以在目录合成之后单独重放（`applyGrowthLog`）。

部件是 `{ id, kind, title, body, order }`。`kind` 为 `context` 或 `pinned`。组装按 `order` 排序，不写死有哪些 id。空的 pinned 在 `assembleSystemPrompt` 里直接失败。现在种子里唯一的 pinned 是 `guardrails`。

生长记录的 `kind` 只能是 `context`。目标如果已经是 pinned，`applyGrowth` 抛错，并且这一行不会写入日志。

## 接缝

`HarnessRegistry.register(id, value)` 默认一个 id 只能注册一次。`{ many: true, key }` 用来追加，key 相同就拒绝。

| id | 注册 |
| --- | --- |
| `llm` | 一次。模型和传输 |
| `fs` | 一次。路径沙箱 |
| `sessions` | 一次。会话存储 |
| `tools` | 可追加，同名拒绝 |

再加接缝调用同一个 `register`。进程内插件是 `{ name, register(registry) }`，由 `applyPlugins` 依次调用。不从磁盘加载代码。

## 写保护

`write_file`、`edit`、`edit_batch` 在调用 GrassAgent 的实现之前，先把路径解析出来。落在种子目录或生长日志目录里就返回错误，不写盘。`run_bash` 仍按 GrassAgent 原来的方式执行，工作目录锁在工作区里。这两个目录默认在 `~/.grass-harness/`，不在工作区里。

## 不写进会话

每一轮开始时按上面的顺序重算系统提示词，写进 `context.systemPrompt`。`context.messages` 仍只是对话，生长日志不插进去。

会话里的 `/grow` 只在人输入 `y` 之后调用 `commitGrowth`。情境和证据取自刚才那一轮的用户消息和助手回复。没有 `y` 就不写。写完立刻重算系统提示词，所以下一轮能看见。
