<div align="center">
<div align="right">
  <a href="../README.md">English</a> | <a href="../README.fa.md">فارسی</a>
</div>

<img src="../assets/readme/hero.svg" width="100%" alt="NovaRoute">

**NovaRoute – 先进的 AI 提供商和聊天平台**

一个强大的自托管平台，用于管理 AI 提供商（API、CLI、OAuth、Cookie），构建模型组合，并在一个地方与所有模型聊天。

[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](../LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blueviolet?style=for-the-badge)](https://github.com/IRNova/NovaRoute)
</div>

---

## 🚀 一键安装

在全新的 Linux 服务器上运行（Ubuntu/Debian、RHEL/CentOS/Fedora 或兼容系统）：

```bash
curl -fsSL https://raw.githubusercontent.com/IRNova/NovaRoute/main/install.sh | sudo bash
```

安装程序将：

1. 如果缺少 Node.js，则安装它。
2. 将此仓库克隆到 `/opt/novaroute`。
3. 安装依赖项并构建生产包。
4. 创建隔离的 Linux 用户 `novaroute` 和数据目录 `/var/lib/novaroute`。
5. 生成带有随机密钥的安全 `.env` 文件。
6. 安装并启动名为 `novaroute` 的 systemd 服务。
7. 自动配置仪表板上的所有免费无身份验证提供商，以便您可以立即开始使用它们。

默认端口为 **20126**（选择此端口以避免与 OmniRoute 冲突）。安装程序将要求您确认或更改它。

安装后，在以下位置打开仪表板：

```text
http://<server-ip>:20126/dashboard
```

使用安装日志末尾打印的初始密码。

---

## 📋 要求

- 带有 `systemd` 的 Linux 服务器
- `curl`、`git`、`openssl`
- Node.js **20+**（如果缺少则自动安装）
- 最低 1 GB RAM（推荐 2 GB）
- 2 GB 可用磁盘空间
- 用于 systemd 和 `/opt` 安装的 root/sudo 访问权限

---

## ⚙️ 配置

所有运行时配置位于 `/opt/novaroute/.env`。最常见的变量是：

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `PORT` | 服务器监听的 HTTP 端口 | `20126` |
| `HOSTNAME` | 要绑定的接口 | `0.0.0.0` |
| `DATA_DIR` | SQLite 数据库和状态所在的位置 | `/var/lib/novaroute` |
| `JWT_SECRET` | 会话 cookie 的密钥 | 自动生成 |
| `INITIAL_PASSWORD` | 仪表板登录密码 | 自动生成 |
| `API_KEY_SECRET` | 内部 API 密钥签名的密钥 | 自动生成 |
| `MACHINE_ID_SALT` | 机器 ID 哈希的盐 | 自动生成 |

编辑 `.env` 后，重启服务：

```bash
sudo systemctl restart novaroute
```

---

## 🌐 API

NovaRoute 在以下位置公开 OpenAI 兼容端点：

```text
http://<server-ip>:20126/v1
```

配置您的 AI 客户端（Claude Code、Cursor、Cline、Codex 等）：

- **基础 URL：** `http://<server-ip>:20126/v1`
- **API 密钥：** 在仪表板的 **设置 → API 密钥** 下创建一个
- **模型：** 使用仪表板中显示的提供商/模型别名

---

## 📄 许可证

NovaRoute 根据 [MIT 许可证](../LICENSE) 发布。
