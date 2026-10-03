# dsh-price-indicator

> DeepSeek Harness (DSH) 插件：在对话界面上边框显示当前 DeepSeek 价格处于**低谷期（梁文谷）**还是**高峰期（梁文峰）**，并实时显示距离下次价格切换的倒计时。

在对话头部的操作行（排在「模式显示」的右边）会显示一个彩色胶囊指示器：

- **梁文谷时间（低谷价）** → 绿色胶囊：`● 梁文谷时间 距离 梁文峰时间结束还剩 HH:MM:SS 亿万鲸子必须喷发`
- **梁文峰时间（高峰价）** → 红色胶囊：`● 梁文峰时间 距离 梁文谷时间结束还剩 HH:MM:SS`

倒计时每秒刷新。

---

## ✨ 功能特性

- **启用即生效**：在插件市场（dsh-market）或插件管理页启用本插件后，价格指示器立即出现在对话上边框；停用即整体不加载。与其他插件（撤回、Amadeus 等）一样通过插件开关控制。
- **位置**：`conversation.session.header.actions` 插槽，排在「模式显示」（agent-preset）右边。
- **高峰/空闲判断（含周末与法定节假日）**：**工作日**高峰（梁文峰）为北京时间 9:00-12:00、14:00-18:00；**周六、周日全天**与**中国法定节假日全天**按空闲（梁文谷，价格为高峰的一半）计费。显示「现在是 X 时间 距离 X 时间结束还剩 …」，倒计时指向下一次价格切换（高峰结束，或下一个高峰窗口开始）。
- **实时倒计时**：距当前时段结束（下次价格切换）的剩余时间，每秒刷新（`HH:MM:SS`，支持跨天大于 24 小时）。
- **插件开关按钮**：在侧边栏底部（`sidebar.footer.action`，Amadeus 🧩 按钮旁）提供「📈 价格」按钮；点击弹层里有「价格显示」开关，可实时启用/停用指示器（localStorage 持久化）。
- **特殊文案**：处于梁文谷（空闲）时追加「亿万鲸子必须喷发」。
- **深色/浅色适配**：用 DSW 主题变量绘制，随主题变化。

## 🔍 工作原理

- 纯前端逻辑：根据本机当前时间与 `PRICE_CONFIG`（工作日高峰窗口、北京时间时区偏移、法定节假日表）计算「当前是高峰还是空闲」以及「下一次价格切换的时间戳」；周末与节假日表命中的日期全天按空闲计费。
- 通过 `conversation.session.header.actions` 列表插槽注册一个每秒自刷新的 React 组件（用 `ctx.interval` 驱动倒计时）。
- 通过 `sidebar.footer.action`（侧边栏底部插件按钮）与 `shell.overlay`（开关弹层）提供价格插件的启用/停用开关。
- 无需 Host 侧 RPC；`inject: ['slots', 'timer']`。

## 📁 目录结构

```
dsh-price-indicator/
├── README.md                  # 本文件
├── LICENSE                    # MIT 许可证
├── package.json               # 项目元数据（GitHub 展示用）
├── plugin.json                # 插件清单（名称 / ID 前缀 / 代码来源）
├── src/
│   ├── host.js                # Host 半端源码（空实现占位）
│   └── client.js              # Client 半端源码（可直接作为 code.client）
├── plugin/                    # 静态 web profile 插件包（安装后随 DSH 加载，推荐）
│   ├── package.json           # 安装包元数据（含 dsh.client 声明）
│   ├── host.js                # Host 半端（空实现占位）
│   └── client.js              # Client bundle（__ModuleLoader__ 注册）
└── tools/
    ├── deploy.ps1             # 一键部署到 web profile 的 node_modules
    ├── register.ps1           # 把插件注册进 cordis.patch.yml（幂等）
    ├── check-client-bundle.ps1# 校验 bundle 不会锁死启动
    └── price-killswitch.ps1   # 急救：禁用/启用本插件
```

## 🚀 安装与激活

> **DSH 0.2+（含桌面版）**：请装进你**当前实际使用的 profile**，例如 `dsh plugin --profile desktop add <本仓库路径>`（桌面版用 `desktop`，旧版网页版用 `web`）。下文示例里的 `~/.dsh/profiles/web/...` 对应旧版（0.1.x）网页 profile，把 profile 名换成你正在用的那个即可。

### 方式一：静态安装（推荐，随 DSH 加载，重启不丢失）

1. **部署**：把 `plugin/` 目录复制到 web profile 的 node_modules 下：
   ```
   ~/.dsh/profiles/web/node_modules/dsh-price-indicator/
   ```
   （或用一键脚本：`pwsh -ExecutionPolicy Bypass -File tools/deploy.ps1`）

2. **注册**：在 `~/.dsh/profiles/web/cordis.patch.yml` 末尾追加加载行（`tools/register.ps1` 幂等处理）：
   ```yaml
   - insert:
       - id: price-indicator
         name: dsh-price-indicator
   ```

3. **重启 DSH**。启用后价格指示器即出现在对话上边框；可在插件市场（dsh-market）或插件管理页随时停用/启用。

### 方式二：动态插件（临时体验，重启后失效）

1. 打开 DSH，在会话中进入 **Cordis 插件开发** 流程（`cordis_define`）。
2. 新建插件：
   - `idPrefix`：`price`
   - `code.host`：粘贴 `src/host.js` 的完整内容
   - `code.client`：粘贴 `src/client.js` 的完整内容
   - `name`：`Price Tide Indicator`（或任意）
   - `purpose`：一句话说明用途
3. 用返回的 `pluginId` / `packageId` 调用 `cordis_run` 激活，并在界面批准运行。

> 注意：动态插件是进程级、临时的——DSH 重启后需要重新定义。长期使用请用**方式一**的静态安装。

## ⚙️ 配置

价格高峰/空闲规则的参数在 `plugin/client.js`（或 `src/client.js`）顶部的 `PRICE_CONFIG`：

| 项 | 默认 | 说明 |
| --- | --- | --- |
| `peakWindows` | `[[540,720],[840,1080]]` | 工作日高峰窗口（梁文峰），北京时间分钟 `[start,end)`：540=9:00、720=12:00、840=14:00、1080=18:00 |
| `holidays` | `{ 2026: ['01-01', …] }` | 中国法定节假日表（`MM-DD`），命中的日期全天按空闲计费；**每年按国务院办公厅通知更新一次** |
| `tzOffset` | `8` | 时区偏移（北京时间 UTC+8） |

> 周末（周六、周日）无需配置，代码固定全天按空闲计费（含调休上班的周末）。

## 💰 定价政策（北京时间，2026 年现行）

| 时段 | 计费 |
| --- | --- |
| 工作日 09:00-12:00、14:00-18:00 | 高峰价（梁文峰） |
| 工作日其余时段 | 空闲价（梁文谷）= 高峰价的一半 |
| 周六、周日全天（含调休上班的周末） | 空闲价 |
| 中国法定节假日全天 | 空闲价 |

- 2026-08-17 起执行峰谷定价：工作日高峰 09:00-12:00、14:00-18:00，空闲价为高峰价的一半。
- 2026-08-23 00:00 起：周六、周日全天不再区分峰谷，统一按空闲价计费。
- 2026-09-19 起明确：调休上班的周末、中国法定节假日全天均按空闲时段计费。
- 节假日表来源：《国务院办公厅关于2026年部分节假日安排的通知》（国办发明电〔2025〕7号）。

## ⚠️ 限制与已知问题

- 高峰/空闲规则是**本地判定**的，不读取 DeepSeek 账户实际账单/定价接口；若官方价格规则变化，需手动更新 `PRICE_CONFIG`（并每年更新 `holidays` 节假日表）。
- 指示器只显示在「会话头部」；没有当前会话时不显示（`conversation.session.header.actions` 是 session 作用域）。
- 开关按钮位于侧边栏底部，折叠成图标时只显示「📈」；wide 态显示「📈 价格」。
- 动态插件不持久化；按「方式一」静态安装后随 DSH 启动自动加载，重启不丢失。

## 🔒 防锁死机制（重要）

DSH 网页启动是 **fail-loud** 的：任何一个插件加载失败都会整屏显示 `Failed to load plugins`，导致进不去 DSH。本插件 bundle 沿用防锁死写法：

1. **Bundle 结构性修复**：`window.__ModuleLoader__.load` 的 factory **只注入 `require`，不注入 `module` / `exports`**。`plugin/client.js` 完全不引用 `module` / `exports`，factory 直接 `return { inject, apply }`。
   > ⚠️ **不要删掉 `inject` 里的 `'timer'`**：Cordis 的 `ctx` 是 Proxy，未 inject 的服务属性被访问时直接抛错，导致 apply 阶段失败。`ctx.interval` 依赖 `timer` 服务。

2. **部署校验脚本**：`tools/check-client-bundle.ps1` 校验 `plugin/client.js` / `plugin/host.js` 语法，并拦截任何非注释的 `module` / `exports` 引用。参考 `tools/deploy.ps1` 内部调用。

3. **急救开关**：万一插件导致启动红屏，禁用它即可正常进入 DSH：
   ```powershell
   # 禁用（自动备份逻辑：给 cordis.patch.yml 的 price-indicator 加 disabled: true），然后重启 DSH
   pwsh -NoProfile -ExecutionPolicy Bypass -File tools/price-killswitch.ps1
   # 恢复，然后重启 DSH
   pwsh -NoProfile -ExecutionPolicy Bypass -File tools/price-killswitch.ps1 -Action enable
   ```

> 修改 `plugin/client.js` 后记得重新部署到 `~/.dsh/profiles/web/node_modules/dsh-price-indicator/` 并重启 DSH。

## 📦 版本历史

- **v1.1.0**（2026-10）同步 DeepSeek 现行峰谷政策：工作日高峰 09:00-12:00 / 14:00-18:00；周六、周日全天与法定节假日全天按空闲计费（含 2026 年节假日表，依据国办发明电〔2025〕7号）；倒计时在跨周末/跨假期时直接指向下一个高峰窗口。
- **v1.0.0**（2026）首个可运行版本：头部价格指示器 + 每秒倒计时。

## 相关参考

- DeepSeek 峰谷定价调整（2026-08-17 生效：工作日高峰 9:00-12:00 / 14:00-18:00，空闲价为高峰一半）：[央广网财经](https://finance.cnr.cn/ycbd/20260814/t20260814_527762035.shtml)。
- 周末全天按空闲价计费（2026-08-23 00:00 起）：[证券时报](https://www.stcn.com/article/detail/4103775.html)。
- 调休上班的周末、法定节假日全天按空闲计费（2026-09-19）：[IT之家（网易转载）](https://m.163.com/dy/article/L77765420511B8LM.html)。
- 2026 年节假日安排：[国务院办公厅通知（国办发明电〔2025〕7号）](https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm)。
- 历史参考（00:30–08:30 低谷惯例，已不适用）：[DSH 成本手册](https://raw.githubusercontent.com/Electricitysheep/dsh-handbook/main/docs/14-cost.md)。

## 📄 许可证

[MIT](LICENSE)
