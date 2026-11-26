# 🗳️ VoteSecure — Sistema Descentralizado de Votación FESC

Sistema de votación estudiantil basado en tecnología **Blockchain (Ethereum / Solidity)** y **React (Vite + Tailwind CSS v4)** con enfoque en personalización de experiencia de usuario (**UX Personalization**).

Desarrollado para la asignatura de **Tecnologías Emergentes** en la **Fundación de Estudios Superiores Comfanorte (FESC)** por **Carlos Daniel Daza Medina**.

---

## 📖 Documentación Completa del Proyecto

Toda la documentación técnica, marco conceptual, arquitectura híbrida, justificación de privacidad y manual de ejecución detallado se encuentra en:
📄 **[DOCUMENTACION_VOTESECURE.md](./DOCUMENTACION_VOTESECURE.md)**

---

## ⚡ Inicio Rápido

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Acceder a: `http://localhost:5173/`

### Smart Contracts (Hardhat)
```bash
cd blockchain
npx hardhat compile
npx hardhat run scripts/deploy.js --network localhost
```
