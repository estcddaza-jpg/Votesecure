# 🗳️ VoteSecure — Sistema Descentralizado y en Tiempo Real de Votación Estudiantil FESC

> **Proyecto Final de Examen — Tecnologías Emergentes**  
> **Estudiante:** Carlos Daniel Daza Medina  
> **Docente:** Ing. Jenny Esmeralda Suárez  
> **Programa:** Ingeniería de Software — VIII Semestre  
> **Institución:** Fundación de Estudios Superiores Comfanorte (FESC)  
> **Despliegue en Producción:** [https://fancy-sunflower-aa05c5.netlify.app](https://fancy-sunflower-aa05c5.netlify.app)

---

## 📌 Descripción del Proyecto

**VoteSecure** es una solución tecnológica integral diseñada para transformar y blindar los procesos electorales universitarios en la **FESC**. Combina la inmutabilidad y transparencia de la tecnología **Blockchain (Ethereum / Solidity)** con la reactividad y sincronización multi-dispositivo sin latencia de **Google Cloud Firestore**, ofreciendo una experiencia sin fricción para los estudiantes:

* **Papeleta Digital Inmediata vía Código QR:** Los estudiantes apuntan con la cámara de sus teléfonos inteligentes a la pantalla del aula/proyector y acceden al instante a la papeleta electoral oficial.
* **Prevención Rigurosa de Fraude y Doble Voto:** Registro inmutable del elector (mediante documento institucional o wallet MetaMask). Si un estudiante ya sufragó en la jornada activa, el sistema bloquea inmediatamente cualquier reintento de voto tanto a nivel de base de datos como de contrato inteligente.
* **Escrutinio en Tiempo Real:** El proyector del docente o pantalla central computa y actualiza los porcentajes y el recuento de votos atómicamente mediante listeners reactivos (`onSnapshot`), sin necesidad de recargar la página.
* **Comité Electoral y Gestión Dinámica:** Panel administrativo discreto protegido por credencial institucional (`fesc2026`) que permite crear, editar o eliminar planchas/candidatos, nombrar la elección y conmutar el estado de las urnas (Abiertas / Cerradas).
* **Auditoría Criptográfica Pública:** Cada sufragio emite un comprobante digital con un **TX Hash Keccak-256**. Cualquier participante puede auditar la validez y marca temporal del voto en el módulo público sin comprometer el secreto del sufragio.

---

## 🏛️ Arquitectura del Sistema

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                      ARQUITECTURA INTEGRAL VOTESECURE                     │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   [ Dispositivos Móviles ]              [ Pantalla Central / Proyector ]  │
│   (Estudiantes / Escaneo QR)             (Docente / Comité Electoral)     │
│             │                                           │                 │
│             ▼                                           ▼                 │
│   ┌───────────────────────────────────────────────────────────────┐       │
│   │               FRONTEND HOSTING (NETLIFY PWA)                  │       │
│   │   • React 19 + Vite + Tailwind CSS                            │       │
│   │   • Dominio HTTPS global con CDN de baja latencia             │       │
│   └───────────────────────────────┬───────────────────────────────┘       │
│                                   │                                       │
│                                   ▼                                       │
│   ┌───────────────────────────────────────────────────────────────┐       │
│   │            CAPA CLOUD REACTIVA (FIREBASE FIRESTORE)           │       │
│   │   • Colección /elections/consejo_actual (Estado de Urnas)     │       │
│   │   • Colección /candidates (Candidatos y Conteo Atómico)       │       │
│   │   • Colección /votes (Control de Sufragio Único)              │       │
│   │   • Colección /audit_ledger (Libro de Auditoría TXID)         │       │
│   └───────────────────────────────┬───────────────────────────────┘       │
│                                   │                                       │
│                                   ▼                                       │
│   ┌───────────────────────────────────────────────────────────────┐       │
│   │             CAPA BLOCKCHAIN (ETHEREUM / SOLIDITY)             │       │
│   │   • Smart Contract `Voting.sol` (^0.8.20)                     │       │
│   │   • Inmutabilidad criptográfica y certificación de eventos    │       │
│   └───────────────────────────────────────────────────────────────┘       │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 📂 Estructura del Repositorio

```text
votesecure/
├── README.md                      # Documentación y manual de ejecución
├── blockchain/                    # Módulo Smart Contracts (Ethereum / Solidity)
│   ├── contracts/
│   │   └── Voting.sol             # Contrato de votación, urnas y auditoría
│   ├── scripts/
│   │   └── deploy.js              # Script de despliegue en red Hardhat / Sepolia
│   ├── hardhat.config.js          # Configuración del compilador y redes
│   └── package.json               # Dependencias de Hardhat y Toolbox
└── frontend/                      # Aplicación Web Cliente PWA
    ├── src/
    │   ├── App.jsx                # Lógica de votación, papeleta y panel electoral
    │   ├── firebase.js            # Conexión en tiempo real con Firestore
    │   ├── main.jsx               # Entrada principal de React
    │   └── index.css              # Estilos Tailwind CSS institucionales
    ├── dist/                      # Compilación para despliegue en producción
    ├── vite.config.js             # Configuración del empaquetador Vite
    └── package.json               # Dependencias de React y librerías auxiliares
```

---

## 🚀 Guía de Ejecución Local

### 1. Requisitos Previos
* **Node.js:** Versión 18.x o superior.
* **NPM:** Gestor de paquetes incluido con Node.
* **Navegador Web:** Chrome, Brave, Edge o Firefox.

---

### 2. Módulo Blockchain (Smart Contracts)
Abre una terminal en la raíz del proyecto:

```bash
# 1. Ingresar a la carpeta blockchain
cd blockchain

# 2. Instalar dependencias
npm install

# 3. Compilar los contratos en Solidity
npx hardhat compile

# 4. Iniciar nodo Ethereum local (dejar esta terminal abierta)
npx hardhat node
```

En una segunda terminal, despliega el contrato en la red local:
```bash
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```

---

### 3. Módulo Frontend (React + Vite)
En una nueva terminal:

```bash
# 1. Ingresar a la carpeta frontend
cd frontend

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor local de desarrollo
npm run dev -- --host
```

* **Acceso en el computador:** `http://localhost:5173/`
* **Acceso desde teléfonos móviles en la misma red Wi-Fi:** `http://<TU_IP_LOCAL>:5173/`

---

## 🌐 Despliegue en Producción (Netlify)

Para compilar y publicar en producción:

```bash
cd frontend
npm run build
```

Arrastra la carpeta generada `frontend/dist` a la pestaña **Deploys** en tu panel de [Netlify](https://app.netlify.com).

* **Sitio Web Oficial en Producción:**  
  👉 **[https://fancy-sunflower-aa05c5.netlify.app](https://fancy-sunflower-aa05c5.netlify.app)**

---

## 🛡️ Credenciales y Control Electoral

* **Acceso Administrativo:** Clic en **"Acceso Consejo"** en el pie de página institucional.
* **Contraseña del Comité:** `fesc2026` (o `admin`).
* **Funciones del Panel:** Abrir/cerrar urnas, crear candidatos oficiales con propuestas, eliminar planchas y auditar recibos criptográficos.
