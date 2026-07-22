# Header Mod

一个开源、最小化的 Chrome 扩展，用来替代 [ModHeader](https://chromewebstore.google.com/detail/modheader-modify-http-hea/opgbiafapkbbnbnjcdomjaghbckfkglc) 修改 HTTP 请求头和响应头。

## 为什么要替代 ModHeader？

2025 年前后，ModHeader 因新增广告行为、自动打开网页、请求过多权限等问题收到大量负面评价，不少用户报告其行为接近恶意扩展：

- [Chrome Web Store 用户评论存档](https://chrome-stats.com/d/opgbiafapkbbnbnjcdomjaghbckfkglc) 中出现 "Behaves like malware, pops up ads" 等评价。
- GitLab 安全团队报告了影响数百万用户的恶意浏览器扩展问题：
  [Malicious browser extensions impacting at least 3.2 million users](https://gitlab-com.gitlab.io/gl-security/security-tech-notes/threat-intelligence-tech-notes/malicious-browser-extensions-feb-2025/)

如果你只需要“修改 HTTP 头”这一核心功能，这个扩展是一个干净、可控的替代方案。

## 功能

- **自动识别当前域名**：打开 popup 自动显示当前标签页的域名
- **一键添加当前域名 Header**：输入 Header 名和值，选择“当前域名”即可只对该域名生效
- **子域名生效**：选择“含子域名”会自动提取主域名（如在 `a.baidu.com` 上选择会匹配 `*.baidu.com`），规则名称也显示为主域名；与 Chrome 匹配模式一致，`*.baidu.com` 同时覆盖主域名 `baidu.com` 本身
- **全局 Header**：选择“所有域名”即可对所有请求生效
- **域名/Header 筛选**：在域名分组顶部输入关键词快速过滤规则
- 添加 / 修改 / 追加 / 删除**请求头**（Request headers）
- 添加 / 修改 / 追加 / 删除**响应头**（Response headers）
- 按 URL 模式匹配（例如 `*://api.example.com/*`）
- 规则更新失败时弹出错误提示
- 启用 / 禁用整个域名组或单条 Header
- **当前页面生效规则**：popup 顶部直接显示对当前域名生效的所有 Header，可一键编辑
- **域名分组默认折叠**：分组默认只显示摘要，点击展开查看和编辑 Header
- **全局总开关**：一键暂停/启用所有规则
- **生效规则计数**：顶部显示当前生效的 Header 数量
- **URL pattern 基础校验**：保存前检查格式是否合法
- **Header 名称自动补全**：内置常见请求/响应头，输入时自动提示
- 导入 / 导出规则为 JSON
- **动画小虎鲸图标**：工具栏图标是一只游动的小虎鲸，全局暂停时变为静态
- 仅使用 Manifest V3 的 `declarativeNetRequest` API，无远程脚本、无广告、无多余权限

## 权限说明

- `declarativeNetRequest`：修改请求/响应头所必需。
- `storage`：本地保存你的规则。
- `tabs`：读取当前活动标签页域名，用于“Quick add for current domain”。
- `<all_urls>`：为了能够匹配任意 URL 上的规则。

## 安装方式

### 开发者模式加载

1. 打开 Chrome，输入 `chrome://extensions/` 并回车。
2. 打开右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本文件夹 `modheader-replacement/`。
5. 扩展图标会出现在工具栏，点击即可使用。

### 打包发布（可选）

```bash
# 在 chrome://extensions/ 里点击“打包扩展程序”，选择本文件夹即可生成 .crx 和 .pem。
```

## 使用方式

### 给当前域名快速加 Header

1. 打开目标网页（例如 `https://api.example.com/`）。
2. 点击扩展图标，顶部会显示 `Quick add for api.example.com`。
3. 输入 Header 名（如 `Authorization`）和值（如 `Bearer xxx`）。
4. 选择类型（Request / Response）和操作（Set / Remove）。
5. 范围选择 **Current domain only**，点击 **Add header**。

### 添加全局 Header

同上，但范围选择 **All domains**。该规则会对所有域名生效。

### 管理已有规则

- 点击每个域名组右侧的 **Edit** 可以修改组名、URL pattern、优先级、启用状态，以及组内的 Headers。
- 点击 **×** 删除整个组。
- 组内可以单独编辑/删除单条 Header。

## 规则示例

### 当前域名：api.example.com

| Type | Operation | Header name | Header value |
|------|-----------|-------------|--------------|
| Request | Set | `Authorization` | `Bearer xxx` |
| Request | Set | `X-Request-ID` | `12345` |

### 全局：All domains

| Type | Operation | Header name |
|------|-----------|-------------|
| Response | Remove | `X-Frame-Options` |

## 导入/导出格式

JSON 数组，每个元素是一个域名组：

```json
[
  {
    "id": "group-1",
    "name": "api.example.com",
    "urlPattern": "*://api.example.com/*",
    "priority": 1,
    "enabled": true,
    "headers": [
      {
        "id": "header-1",
        "type": "request",
        "operation": "set",
        "name": "Authorization",
        "value": "Bearer xxx",
        "enabled": true
      }
    ]
  }
]
```

## 技术栈

- Chrome Extension Manifest V3
- `declarativeNetRequest` API
- 原生 JavaScript / CSS，无框架依赖

## 许可证

MIT
