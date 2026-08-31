<div align="center">
<div align="right">
  <a href="../README.md">English</a> | <a href="../README.fa.md">فارسی</a>
</div>

<img src="../assets/readme/hero.svg" width="100%" alt="NovaRoute">

**NovaRoute – Plateforme Avancée de Fournisseurs IA et Chat**

Une plateforme puissante auto-hébergée pour gérer les fournisseurs IA (API, CLI, OAuth, Cookie), construire des combinaisons de modèles et discuter avec tous vos modèles en un seul endroit.

[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](../LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blueviolet?style=for-the-badge)](https://github.com/IRNova/NovaRoute)
</div>

---

## 🚀 Installation en une ligne

Exécutez sur un serveur Linux frais (Ubuntu/Debian, RHEL/CentOS/Fedora ou compatible) :

```bash
curl -fsSL https://raw.githubusercontent.com/IRNova/NovaRoute/main/install.sh | sudo bash
```

L'installateur :

1. Installe Node.js s'il manque.
2. Clone ce dépôt dans `/opt/novaroute`.
3. Installe les dépendances et construit le bundle de production.
4. Crée un utilisateur Linux isolé `novaroute` et répertoire de données `/var/lib/novaroute`.
5. Génère un fichier `.env` sécurisé avec des clés aléatoires.
6. Installe et démarre un service systemd nommé `novaroute`.
7. Auto-configure tous les fournisseurs gratuits sans authentification sur le tableau de bord.

Le port par défaut est **20126**. L'installateur demandera confirmation ou modification.

Après l'installation, ouvrez le tableau de bord :

```text
http://<server-ip>:20126/dashboard
```

---

## 🌐 API

NovaRoute expose un endpoint compatible OpenAI sur :

```text
http://<server-ip>:20126/v1
```

---

## 📄 Licence

NovaRoute est distribué sous la [MIT License](../LICENSE).
