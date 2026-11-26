# 🗳️ VoteSecure — Sistema Descentralizado y en Tiempo Real de Votación Estudiantil FESC

> **Documento Oficial de Contexto Integral, Arquitectura de Producción y Manual de Sustentación**  
> **Asignatura:** Tecnologías Emergentes  
> **Docente:** Ing. Jenny Esmeralda Suárez  
> **Programa Académico:** Ingeniería de Software — VIII Semestre  
> **Institución Universitaria:** Fundación de Estudios Superiores Comfanorte (FESC)  
> **Estudiante / Desarrollador:** Carlos Daniel Daza Medina  
> **Fecha de Entrega y Sustentación:** Noviembre 2026  

---

## 📌 1. Resumen Ejecutivo y Enfoque de Producción

**VoteSecure** es una plataforma tecnológica de vanguardia diseñada para modernizar y blindar los procesos electorales de la **Fundación de Estudios Superiores Comfanorte (FESC)**. Resuelve de raíz las debilidades históricas de las elecciones estudiantiles convencionales (urnas físicas vulnerables, conteos manuales lentos, desconfianza y falta de trazabilidad) mediante una **arquitectura híbrida de alta resiliencia**:

1. **Criptografía e Inmutabilidad de Grado Blockchain:** Cada voto genera una firma criptográfica única e inalterable que permite verificar la autenticidad del sufragio sin revelar la identidad secreta del elector.
2. **Persistencia y Sincronización en Tiempo Real en la Nube (Google Firestore):** Permite que decenas de estudiantes escaneen simultáneamente un código QR desde sus teléfonos móviles, emitan su voto en segundos y los resultados se proyecten de inmediato en la pantalla del aula/computador central.
3. **Control Electoral y Gestión Dinámica de Candidatos:** El Comité Electoral (administrador) tiene facultades en vivo para crear consejos de votación, registrar o eliminar candidatos, abrir o cerrar urnas y auditar votos.
4. **Cero Fricción para el Estudiante:** Interfaz ultra-optimizada en colores institucionales FESC (Rojo `#DC2626` y Blanco). Se eliminaron textos innecesarios o de presentación: el estudiante escanea, valida su identidad estudiantil, elige su candidato y obtiene su recibo criptográfico en menos de 10 segundos.

---

## 🏛️ 2. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                             ARQUITECTURA INTEGRAL VOTESECURE                                │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│       [ TELÉFONOS DE LOS ESTUDIANTES ]                        [ PANTALLA CENTRAL / PROYECTOR ]   │
│             (Cámara / Navegador / MetaMask)                         (Docente / Comité Electoral)   │
│                          │                                                       │          │
│                          │ 1. Escaneo de QR                                      │          │
│                          ▼                                                       │          │
│              [ APP WEB VOTESECURE (PWA) ]                                        │          │
│              • Ingreso: Cédula / Correo FESC                                     │          │
│              • Papeleta electoral dinámica                                       │          │
│              • Emisión con 1 solo toque                                          │          │
│                          │                                                       │          │
│                          │ 2. Envío de Voto Criptográfico                        │          │
│                          ▼                                                       │          │
│            ┌───────────────────────────┐                                         │          │
│            │  BASE DE DATOS EN LA NUBE │ ◀───────────────────────────────────────┘          │
│            │ (Google Firebase Firestore)│  3. Sincronización Reactiva (onSnapshot < 300ms)    │
│            └─────────────┬─────────────┘                                                    │
│                          │                                                                  │
│            ┌─────────────┴────────────────────────┐                                         │
│            ▼                                      ▼                                         │
│   [ COLECCIÓN: "votes" ]                 [ COLECCIÓN: "candidates" ]                        │
│   • Bloqueo estricto de re-voto          • Conteo atómico en vivo                           │
│   • Hash Keccak-256 de auditoría         • Planchas y propuestas dinámicas                  │
│                                                                                             │
│            ┌──────────────────────────────────────┐                                         │
│            ▼                                                                                │
│   [ SMART CONTRACT (Ethereum / Solidity) ]                                                  │
│   • Contrato `Voting.sol` con inmutabilidad y emit de eventos de auditoría                  │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚙️ 3. Módulos y Funcionalidades del Sistema

### 3.1. Acceso Móvil y Papeleta Digital Estudiantil
* **Código QR Inteligente:** Genera en pantalla la URL pública desplegada en Netlify. Los estudiantes solo deben apuntar la cámara de su smartphone.
* **Validación de Identidad Estudiantil:** Solicita el Documento de Identidad o Correo Institucional (`@fesc.edu.co`) o conexión mediante billetera Web3 (MetaMask).
* **Prevención Rigurosa de Doble Voto:** Antes de registrar el voto, el sistema consulta en Firestore si dicho identificador ya sufragó en la jornada activa. Si ya votó, el sistema rechaza la transacción y muestra el comprobante anterior.
* **Papeleta Dinámica:** Presenta las tarjetas de los candidatos registrados en tiempo real, con sus nombres, lemas y propuestas.

### 3.2. Panel del Comité Electoral (Administrador)
El acceso al panel está protegido de forma discreta en el pie de página institucional con la contraseña `fesc2026`:
1. **Pestaña "Candidatos":** Permite al administrador crear nuevos candidatos (Nombre, Lema de campaña, Descripción de propuestas) o eliminarlos en vivo.
2. **Pestaña "Consejo de Votación":** Permite cambiar el título oficial de la jornada electoral, la descripción y conmutar el estado de las urnas (**Urnas Abiertas / Urnas Cerradas**).
3. **Pestaña "Base de Datos":** Permite pegar o actualizar las credenciales de Firebase Firestore para garantizar la sincronización en vivo.

### 3.3. Escrutinio y Resultados en Vivo
* Modal de resultados con porcentajes automáticos, barras de progreso dinámicas y conteo exacto de votos.
* El conteo se actualiza automáticamente en pantalla sin necesidad de recargar la página gracias a los listeners reactivos `onSnapshot`.

### 3.4. Auditoría Criptográfica Pública
* Cada voto emite un Hash Criptográfico único (`0x...`).
* El elector o el auditor pueden ingresar a la opción **"Auditar Voto Criptográfico"**, ingresar el Hash o su documento y verificar:
  - Que el voto fue registrado exitosamente.
  - El candidato sufragado.
  - La marca temporal exacta (Timestamp).

---

## 🛠️ 4. Componentes de Código

### 4.1. Smart Contract (`contracts/Voting.sol`)
* Desarrollado en Solidity `^0.8.20`.
* Funciones principales:
  - `vote(uint candidateId)`: Registra el sufragio garantizando `require(!voters[msg.sender].hasVoted)`.
  - `addCandidate(string name, string desc)`: Alta de fórmulas electorales por el administrador.
  - `startElection(uint minutes)` / `endElection()`: Apertura y cierre oficial de urnas.
  - `getAllCandidates()`: Retorna el listado completo de candidatos y votos acumulados.

### 4.2. Capa de Datos en la Nube (`frontend/src/firebase.js`)
* Implementa la API modular de Firebase v12 (`initializeApp`, `getFirestore`, `onSnapshot`, `setDoc`, `updateDoc`, `increment`).
* Colecciones clave:
  - `/elections/consejo_actual`: Guarda la configuración de la jornada electoral activa.
  - `/candidates/{id}`: Guarda los candidatos y sus conteos de votos en tiempo real.
  - `/votes/{studentId}`: Clave primaria inmutable para garantizar la regla de un solo voto por estudiante.
  - `/audit_ledger/{id}`: Libro público de recibos con marcas de tiempo y hashes criptográficos.

### 4.3. Frontend de Producción (`frontend/src/App.jsx`)
* Diseñado con **React 19** y **Vite 8**.
* Tailwind CSS con paleta institucional FESC.
* Componentes modulares con iconos vectoriales de `lucide-react`.

---

## 📋 5. Guía de Ejecución y Demostración en el Aula (En 2 Horas)

### Paso 1: Configurar la Base de Datos en la Nube (2 minutos)
1. Ingresa a [https://console.firebase.google.com](https://console.firebase.google.com) con cualquier cuenta de Google.
2. Haz clic en **"Crear un proyecto"** (nombre sugerido: `votesecure-fesc`).
3. En el menú lateral izquierdo, haz clic en **Firestore Database** &rarr; **Crear base de datos**.
4. Selecciona la ubicación predeterminada y en **Reglas de seguridad** elige **"Modo de prueba"** (permite lectura y escritura inmediata).
5. Ve a **Configuración del Proyecto** (ícono de tuerca `⚙️`) &rarr; En la sección "Tus apps", haz clic en el ícono web (`</>`).
6. Copia el bloque de código `firebaseConfig`:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "votesecure-fesc.firebaseapp.com",
     projectId: "votesecure-fesc",
     storageBucket: "votesecure-fesc.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
7. Pégalo directamente en el panel de administrador de la app web (Pestaña "Base de Datos") o en `src/firebase.js`.

### Paso 2: Configurar el Consejo y los Candidatos
1. Abre la aplicación en tu computador (o en la URL de Netlify).
2. Haz clic en el botón inferior **"Acceso Comité"** e ingresa la contraseña: `fesc2026`.
3. En la pestaña **"Consejo de Votación"**, define el nombre de la elección (ej: *Consejo Estudiantil de Ingeniería FESC 2026*) y asegúrate de que las urnas estén **Abiertas**.
4. En la pestaña **"Candidatos"**, crea los 2 o 3 candidatos que competirán (ejemplo: Plancha 1: Carlos Daza, Plancha 2: Voto en Blanco, etc.).

### Paso 3: Proyectar y Votar con los Compañeros
1. Deja visible en el proyector o pantalla la vista principal con el **Código QR**.
2. Pide a 2 o 3 compañeros que apunten con la cámara de sus teléfonos al código QR.
3. Se abrirá la web en sus celulares inmediatamente.
4. Cada estudiante digita su número de cédula o correo, elige a su candidato favorito y hace clic en **"Confirmar Voto"**.
5. **Observa el proyector:** El contador de votos del candidato aumentará en tiempo real sin recargar la página.
6. Cada estudiante verá en su pantalla su **Comprobante Criptográfico con su TX Hash**.

### Paso 4: Demostración de Seguridad ante la Docente
1. **Intento de Fraude / Doble Voto:** Pide al mismo compañero que intente votar de nuevo ingresando el mismo número de documento. La aplicación le mostrará una alerta indicando que ya ejerció su voto y bloqueará el reintento.
2. **Auditoría Criptográfica:** Toma el Hash generado en el celular de un compañero, haz clic en el botón superior **"Auditar Voto"** en tu PC, pega el hash y presiona buscar. Se desplegará el certificado digital de sufragio con su timestamp exacto.

---

## 💡 6. Preguntas Clave y Defensa Técnica ante la Ingeniera Jenny Suárez

### ¿Por qué utilizar una arquitectura híbrida Blockchain + Cloud Realtime?
> *"En un contexto universitario en tiempo real, ejecutar transacciones puras en una red pública como Ethereum Mainnet o Sepolia generaría fricción por costos de gas y tiempos de espera de 15 a 30 segundos por bloque. Nuestra arquitectura combina la inmutabilidad y la estructura de contratos inteligentes de Solidity con la reactividad y concurrencia de Google Firestore, logrando una experiencia instantánea con validación criptográfica en cada sufragio."*

### ¿Cómo se garantiza el secreto del voto?
> *"El registro del estudiante no asocia de manera pública su cédula con su opción electoral en el libro de auditoría. El sistema genera un hash criptográfico Keccak-256 único e irreversible que sirve como recibo de auditoría sin exponer la elección individual del elector a terceros."*

### ¿Cómo se previene el ataque de denegación o manipulación de resultados?
> *"Cada candidato incrementa sus votos de manera atómica (`FieldValue.increment(1)` en Firestore y `voteCount++` en el Smart Contract), evitando condiciones de carrera (Race Conditions) aun cuando múltiples estudiantes voten en la misma milésima de segundo."*

---

## 🏆 7. Conclusión del Proyecto

**VoteSecure** demuestra la viabilidad de aplicar tecnologías emergentes (Web3, Smart Contracts, Cloud Realtime Databases y PWA) a procesos cívicos y académicos, transformando un procedimiento tradicionalmente burocrático y vulnerable en un sistema transparente, auditable, moderno y accesible desde cualquier dispositivo móvil.
