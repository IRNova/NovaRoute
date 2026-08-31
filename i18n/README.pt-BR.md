<div align="center">
<div align="right">
  <a href="../README.md">English</a> | <a href="../README.fa.md">فارسی</a>
</div>

<img src="../assets/readme/hero.svg" width="100%" alt="NovaRoute">

**NovaRoute – Plataforma Avançada de Fornecedores de IA e Chat**

Uma plataforma poderosa auto-hospedada para gerenciar fornecedores de IA (API, CLI, OAuth, Cookie), construir combinações de modelos e conversar com todos os seus modelos em um só lugar.

[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](../LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blueviolet?style=for-the-badge)](https://github.com/IRNova/NovaRoute)
</div>

---

## 🚀 Instalação com uma linha

Execute em um servidor Linux novo (Ubuntu/Debian, RHEL/CentOS/Fedora ou compatível):

```bash
curl -fsSL https://raw.githubusercontent.com/IRNova/NovaRoute/main/install.sh | sudo bash
```

O instalador irá:

1. Instalar o Node.js se estiver faltando.
2. Clonar este repositório para `/opt/novaroute`.
3. Instalar dependências e construir o bundle de produção.
4. Criar um usuário Linux isolado `novaroute` e diretório de dados `/var/lib/novaroute`.
5. Gerar um arquivo `.env` seguro com chaves aleatórias.
6. Instalar e iniciar um serviço systemd chamado `novaroute`.
7. Auto-configurar todos os fornecedores gratuitos sem autenticação no painel.

A porta padrão é **20126**. O instalador perguntará se você deseja confirmar ou alterar.

Após a instalação, abra o painel:

```text
http://<server-ip>:20126/dashboard
```

---

## 🌐 API

NovaRoute expõe um endpoint compatível com OpenAI em:

```text
http://<server-ip>:20126/v1
```

---

## 📄 Licença

NovaRoute é distribuído sob a [MIT License](../LICENSE).
