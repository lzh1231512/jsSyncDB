# jsSyncDB v2

`jsSyncDBv2` 是 jsSyncDB 的 TypeScript 重构版本，保留原有 `dbBase`、`dbCore` / `dbModel`、`dbSync` 分层，以及旧版公开 API、数据格式和同步服务协议；内部实现使用 Promise 和 async/await。客户端以 IndexedDB 为本地存储，经典脚本产物继续提供全局 `JssDB`，供旧式 `<script>` 页面调用。当前容量目标为 10,000 条记录。

调用示例和完整 API 使用流程见[使用说明](使用说明.md)。

## 开发命令

以下命令均在本目录 `jsSyncDBv2` 中执行：

```bash
npm install
npm test
npm run test:bundle
npm run test:integration
npm run typecheck
npm run build
npm run check
```

入口文件为 `src/index.ts`。`npm run build` 会生成两个 bundle：

- `dist/JssDB-2.0.module.js`：ESM 模块版本，通过 `import` 引入。
- `dist/JssDB-2.0.js`：经典 IIFE 脚本，向全局对象挂载 `JssDB` 构造器和模型注册表，供传统 `<script>` 引用。

经典脚本用法示例：

```html
<script src="dist/JssDB-2.0.js"></script>
<script>
  var mySyncDB = new JssDB('', 'keepPwdDB', 'https://your-sync-service/');
  JssDB.dbModelColumn.DbAc = ['title', 'groupId'];
</script>
```

## 测试类型

| 命令 | 验证内容 | 是否启动后端 |
| --- | --- | --- |
| `npm test` | `tests/` 下的单元测试，验证 `dbBase`、`dbCore` / `dbModel`、`dbSync` 和旧 API 的局部行为。使用 fake IndexedDB 或替身 transport，执行快、适合日常开发。 | 否 |
| `npm run test:bundle` | 加载构建后的 `dist/JssDB-2.0.js`，在 Node VM 中检查 IIFE 全局 API、回调兼容、CRUD，以及 KeepPwd 数据层所依赖的模型字段、筛选和密文字段读写契约。使用 fake IndexedDB 和内存 localStorage；加解密仅使用测试 fixture，不验证 KeepPwd 的真实 AES 实现。 | 否 |
| `npm run typecheck` | 执行 TypeScript 编译器的类型检查，不生成文件。 | 否 |
| `npm run build` | 构建 ESM 和经典 IIFE 两种发布产物。构建成功本身不代表运行时行为已通过测试。 | 否 |
| `npm run check` | 顺序执行类型检查、`npm test`、双格式构建和 `npm run test:bundle`。这是默认客户端验证入口，不包含真实服务集成测试。 | 否 |
| `npm run test:integration` | 构建客户端并启动临时 .NET 服务，通过真实 HTTP 请求验证完整同步流程和 SQLite 持久化。 | 是，使用本机临时服务 |

`npm run test:watch` 可启动 Vitest 监听模式。`npm run test:integration:client` 是集成 runner 内部调用的 Vitest 命令；它要求 runner 提供临时服务地址和 host 路径，不应单独作为完整集成测试入口运行。

## 真实服务集成测试

集成测试验证的是**构建后的经典 bundle、客户端同步逻辑、HTTP 协议和真实 .NET / SQLite 服务之间的连接**。它比单元测试更接近生产同步链路，但不会启动 Android WebView，也不会替代 KeepPwd2 在设备上的界面与生命周期验收。

目前的集成场景包括：

- 对未预建数据库的空服务端库首次同步，并确认 SQLite 文件自动创建。
- `DbAc`、`DbGroup`、`DbPwd` 模型数据在两个客户端间往返。
- 205 条记录跨越默认 100 条传输页上传和下载，并验证更新、删除历史。
- 模拟服务端已提交上传但客户端丢失响应，验证重试沿用相同幂等 token。
- 直接请求下载接口，验证服务端 UUID 不匹配返回 `-1`、同步游标缺档返回 `-2`。
- 一个客户端通过真实 `/ws` 连接自动同步，另一个客户端上传后验证服务端通知会触发下载。
- 删除本轮测试的远端 SQLite 文件后，验证客户端历史回灌及另一客户端重新下载。

### 前置条件

在 Windows 上运行，需要：

- Node.js 和 npm，且已在 `jsSyncDBv2` 安装项目依赖。
- .NET 8 SDK。
- Windows PowerShell。
- 仓库中的 `web-netcore/web-netcore.csproj` 后端项目及其依赖可正常发布。

### 运行步骤

在 `jsSyncDBv2` 目录执行：

```powershell
npm run test:integration
```

集成脚本 `scripts/runIntegration.ps1` 会自动完成以下步骤：

1. 清理专用目录 `%TEMP%\jsSyncDBv2-integration`，并创建临时后端发布目录和全新的 `wwwroot`。
2. 将仓库中的 `web-netcore/web-netcore.csproj` 以 Release 配置发布到临时目录。
3. 构建当前 ESM 和经典 IIFE 客户端 bundle。
4. 为临时服务选择一个可用的本机端口，在 `127.0.0.1` 上启动 .NET 服务；本轮服务使用全新 `wwwroot`，因此数据库不会与开发或生产数据混用。
5. 设置仅供本次 Vitest 进程使用的服务 URL 和临时 host 根目录，运行 `integrationCheck/` 下的用例。
6. 结束临时服务并恢复原有环境变量。全部通过时删除专用临时目录；失败时保留发布文件和日志供诊断。

脚本会在每次开始前删除固定的 `%TEMP%\jsSyncDBv2-integration` 目录。请勿在该目录保存其他需要保留的文件。测试数据库位于本轮 host 的 `wwwroot/uploadFile/` 下；测试使用随机场景名隔离各数据库，并且不会连接生产服务。

### 失败排查

集成失败后，脚本会保留 `%TEMP%\jsSyncDBv2-integration`，并在终端输出后端日志末尾内容。可查看：

- `%TEMP%\jsSyncDBv2-integration\backend.stdout.log`
- `%TEMP%\jsSyncDBv2-integration\backend.stderr.log`
- `%TEMP%\jsSyncDBv2-integration\backend\` 下的发布产物
- `%TEMP%\jsSyncDBv2-integration\host\wwwroot\uploadFile\` 下本轮 SQLite 文件

常见问题：

- 找不到 `dotnet` 或发布失败：确认安装了 .NET 8 SDK，并检查后端项目可否单独执行 `dotnet publish ..\web-netcore\web-netcore.csproj --configuration Release`。
- 找不到 npm 依赖：在 `jsSyncDBv2` 目录运行 `npm install` 后重试。
- 端口或启动问题：确认本机回环地址未被安全软件或策略拦截，并检查 stdout/stderr 日志。
- 测试断言失败：保留目录中的 SQLite 文件可用于复查实际写入内容；脚本下一次启动时会重新清理该固定目录。

## VS Code 任务

仓库提供以下常规 VS Code 任务：`jsSyncDBv2: test`、`jsSyncDBv2: typecheck` 和 `jsSyncDBv2: build`。真实服务集成测试可在集成终端中运行 `npm run test:integration`。
