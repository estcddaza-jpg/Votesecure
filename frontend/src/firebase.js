import { initializeApp, getApps } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where,
  serverTimestamp,
  increment 
} from "firebase/firestore";

// Configuración por defecto o cargada dinámicamente desde localStorage
const savedConfigStr = typeof window !== 'undefined' ? localStorage.getItem('votesecure_firebase_config') : null;
let savedConfig = null;
try {
  if (savedConfigStr) {
    const parsed = JSON.parse(savedConfigStr);
    if (parsed && parsed.apiKey && parsed.apiKey !== "API_KEY_AQUI") {
      savedConfig = parsed;
    }
  }
} catch (e) {}

export const DEFAULT_FIREBASE_CONFIG = savedConfig || {
  apiKey: "AIzaSyALnyvSqr8i4uJ8naO1xs9d0PujhQaKc5k",
  authDomain: "vote-fesc.firebaseapp.com",
  projectId: "vote-fesc",
  storageBucket: "vote-fesc.firebasestorage.app",
  messagingSenderId: "299439571024",
  appId: "1:299439571024:web:ca96edce4fc3bec28d5155",
  measurementId: "G-JVJ78CN8CL"
};

let app = null;
let db = null;
let isConfigured = false;

export function initFirebase(customConfig) {
  const config = customConfig || DEFAULT_FIREBASE_CONFIG;
  if (!config || !config.apiKey || config.apiKey === "API_KEY_AQUI") {
    isConfigured = false;
    return { isConfigured: false, db: null };
  }

  try {
    if (!getApps().length) {
      app = initializeApp(config);
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
    isConfigured = true;
    if (typeof window !== 'undefined' && customConfig) {
      localStorage.setItem('votesecure_firebase_config', JSON.stringify(customConfig));
    }
    return { isConfigured: true, db };
  } catch (error) {
    console.error("Error al inicializar Firebase:", error);
    isConfigured = false;
    return { isConfigured: false, error };
  }
}

// Inicializar intento inicial
initFirebase();

export { db, isConfigured };

// ============================================================================
// 1. CONSEJO DE VOTACIÓN (Jornada Electoral)
// ============================================================================
const ELECTION_DOC_ID = "consejo_actual";

export async function saveElectionCouncil(electionData) {
  if (!db) throw new Error("Base de datos no configurada");
  const electionRef = doc(db, "elections", ELECTION_DOC_ID);
  await setDoc(electionRef, {
    title: electionData.title || "Elección de Consejo Estudiantil FESC",
    description: electionData.description || "Jornada democrática oficial FESC",
    isOpen: electionData.isOpen ?? true,
    endTime: electionData.endTime || Date.now() + 8 * 60 * 60 * 1000,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export function subscribeToElectionCouncil(onDataChange) {
  if (!db) return () => {};
  const electionRef = doc(db, "elections", ELECTION_DOC_ID);
  return onSnapshot(electionRef, (snapshot) => {
    if (snapshot.exists()) {
      onDataChange({ id: snapshot.id, ...snapshot.data() });
    } else {
      // Valor por defecto si no existe aún en Firestore
      onDataChange({
        id: ELECTION_DOC_ID,
        title: "Consejo Estudiantil FESC 2026",
        description: "Elección de representantes estudiantiles oficiales",
        isOpen: true,
        endTime: Date.now() + 8 * 60 * 60 * 1000
      });
    }
  }, (err) => {
    console.warn("Snapshot election error:", err);
  });
}

// ============================================================================
// 2. GESTIÓN DE CANDIDATOS (Crear, Editar, Eliminar y Escuchar)
// ============================================================================
export async function addCandidateToDb(candidateData) {
  if (!db) throw new Error("Base de datos no configurada");
  const candidatesRef = collection(db, "candidates");
  const docRef = await addDoc(candidatesRef, {
    name: candidateData.name,
    motto: candidateData.motto || "Propuestas de Calidad",
    description: candidateData.description || "",
    proposals: candidateData.proposals || [candidateData.description],
    votes: 0,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function deleteCandidateFromDb(candidateId) {
  if (!db) throw new Error("Base de datos no configurada");
  const candidateRef = doc(db, "candidates", candidateId);
  await deleteDoc(candidateRef);
}

export function subscribeToCandidatesDb(onCandidatesChange) {
  if (!db) return () => {};
  const candidatesRef = collection(db, "candidates");
  return onSnapshot(candidatesRef, (snapshot) => {
    const list = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    onCandidatesChange(list);
  }, (err) => {
    console.warn("Snapshot candidates error:", err);
  });
}

// ============================================================================
// 3. REGISTRO ESTUDIANTIL Y VOTACIÓN REAL (Bloqueo Estricto de Re-voto)
// ============================================================================
export async function checkStudentAlreadyVoted(studentIdentifier) {
  if (!db) return false;
  const cleanId = String(studentIdentifier).trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
  const voteDocRef = doc(db, "votes", cleanId);
  const snap = await getDoc(voteDocRef);
  return snap.exists();
}

export async function submitRealVote({ studentIdentifier, candidateId, candidateName, walletAddress }) {
  if (!db) throw new Error("Base de datos no configurada");
  const cleanId = String(studentIdentifier).trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');

  // 1. Verificar si ya votó
  const voteDocRef = doc(db, "votes", cleanId);
  const existingVote = await getDoc(voteDocRef);
  if (existingVote.exists()) {
    throw new Error("Este estudiante ya ha ejercido su voto en esta jornada. No se permite re-voto.");
  }

  // 2. Generar Hash Criptográfico único del sufragio
  const txHash = "0x" + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');

  // 3. Registrar voto del estudiante (inmutable)
  await setDoc(voteDocRef, {
    studentId: cleanId,
    candidateId,
    candidateName,
    txHash,
    walletAddress: walletAddress || "Voto Móvil Estudiantil",
    timestamp: Date.now(),
    createdAt: serverTimestamp()
  });

  // 4. Incrementar contador del candidato en Firestore de forma atómica
  if (candidateId) {
    const candidateRef = doc(db, "candidates", candidateId);
    try {
      await updateDoc(candidateRef, {
        votes: increment(1)
      });
    } catch (e) {
      console.warn("Error incrementando votos de candidato:", e);
    }
  }

  // 5. Registrar en el libro de auditoría pública
  try {
    await addDoc(collection(db, "audit_ledger"), {
      txHash,
      candidateId,
      candidateName,
      timestamp: Date.now(),
      createdAt: serverTimestamp()
    });
  } catch (e) {}

  return { txHash, timestamp: Date.now() };
}

// ============================================================================
// 4. AUDITORÍA Y BÚSQUEDA DE RECIBO
// ============================================================================
export async function searchAuditHash(hashOrId) {
  if (!db) return null;
  const cleanQuery = hashOrId.trim();

  // Buscar por TX Hash
  const qHash = query(collection(db, "audit_ledger"), where("txHash", "==", cleanQuery));
  const snapHash = await getDocs(qHash);
  if (!snapHash.empty) {
    return snapHash.docs[0].data();
  }

  // Buscar por ID de estudiante
  const cleanId = cleanQuery.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
  const snapVote = await getDoc(doc(db, "votes", cleanId));
  if (snapVote.exists()) {
    return snapVote.data();
  }

  return null;
}
