<div align="center">
<div align="right">
  <a href="../README.md">English</a> | <a href="../README.fa.md">فارسی</a>
</div>

<img src="../assets/readme/hero.svg" width="100%" alt="NovaRoute">

**NovaRoute – Plataforma Avanzada de Proveedores de IA y Chat**

Una plataforma potente autoalojada para gestionar proveedores de IA (API, CLI, OAuth, Cookie), construir combinaciones de modelos y chatear con todos tus modelos en un solo lugar.

[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](../LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blueviolet?style=for-the-badge)](https://github.com/IRNova/NovaRoute)
</div>

---

## 🚀 Instalación con una línea

Ejecuta en un servidor Linux nuevo (Ubuntu/Debian, RHEL/CentOS/Fedora o compatible):

```bash
curl -fsSL https://raw.githubusercontent.com/IRNova/NovaRoute/main/install.sh | sudo bash
```

El instalador:

1. Instala Node.js si falta.
2. Clona este repositorio en `/opt/novaroute`.
3. Instala dependencias y construye el bundle de producción.
4. Crea un usuario Linux aislado `novaroute` y directorio de datos `/var/lib/novaroute`.
5. Genera un archivo `.env` seguro con claves aleatorias.
6. Instala e inicia un servicio systemd llamado `novaroute`.
7. Auto-configura todos los proveedores gratuitos sin autenticación en el panel.

El puerto predeterminado es **20126**. El instalador preguntará si desea confirmar o cambiar.

Después de la instalación, abre el panel:

```text
http://<server-ip>:20126/dashboard
```

---

## 🌐 API

NovaRoute expone un endpoint compatible con OpenAI en:

```text
http://<server-ip>:20126/v1
```

---

## 📄 Licencia

NovaRoute se distribuye bajo la [MIT License](../LICENSE).
