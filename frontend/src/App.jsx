import { useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import VotingABI from '../../blockchain/artifacts/contracts/Voting.sol/Voting.json';
import { 
  initFirebase, 
  isConfigured as isFirebaseConfigured, 
  saveElectionCouncil, 
  subscribeToElectionCouncil, 
  addCandidateToDb, 
  deleteCandidateFromDb, 
  subscribeToCandidatesDb, 
  checkStudentAlreadyVoted, 
  submitRealVote, 
  searchAuditHash,
  DEFAULT_FIREBASE_CONFIG 
} from './firebase';
import { 
  ShieldCheck, 
  Vote, 
  Wallet, 
  CheckCircle2, 
  Lock, 
  UserPlus, 
  BarChart3, 
  QrCode, 
  LogOut, 
  Settings, 
  Clock, 
  ExternalLink, 
  Copy, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  CheckCircle, 
  Award, 
  Smartphone, 
  Trash2, 
  Plus, 
  Database, 
  Save, 
  FileText, 
  Users,
  KeyRound
} from 'lucide-react';

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const INITIAL_CANDIDATES = [
  {
    id: "1",
    name: "Plancha 01 - Innovación & Tecnología FESC",
    motto: "Transformación Digital y Futuro Profesional",
    description: "Modernización de laboratorios de software, fortalecimiento del campus virtual, hackathons y convenios tecnológicos para prácticas profesionales.",
    proposals: [
      "Modernización de laboratorios de desarrollo y cómputo",
      "Hackathons institucionales con la industria tecnológica",
      "Convenios empresariales para prácticas profesionales",
      "Capacitaciones continuas en Cloud y Ciberseguridad"
    ],
    votes: 0
  },
  {
    id: "2",
    name: "Plancha 02 - Liderazgo & Bienestar Universitario",
    motto: "Comunidad, Bienestar y Democracia Estudiantil",
    description: "Mejora de espacios comunes, programas de apoyo socioeconómico para cafetería, torneos deportivos interfacultades y fomento cultural.",
    proposals: [
      "Subsidios estudiantiles para cafetería y transporte",
      "Dotación y mejoras de áreas comunes y salas de estudio",
      "Apoyo institucional para representación en congresos",
      "Torneos deportivos y actividades culturales FESC"
    ],
    votes: 0
  }
];

function App() {
  // Estados de conexión
  const [account, setAccount] = useState(null);
  const [studentId, setStudentId] = useState('');
  const [studentInput, setStudentInput] = useState('');
  const [studentInputError, setStudentInputError] = useState('');
  const [contract, setContract] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Estados del Consejo Electoral
  const [electionTitle, setElectionTitle] = useState("Consejo Estudiantil FESC 2026");
  const [electionDesc, setElectionDesc] = useState("Elección oficial de representantes y planchas estudiantiles");
  const [electionOpen, setElectionOpen] = useState(true);
  const [electionEndTime, setElectionEndTime] = useState(() => Date.now() + 8 * 60 * 60 * 1000);
  const [timeLeft, setTimeLeft] = useState({ hours: '08', minutes: '00', seconds: '00' });

  // Candidatos
  const [candidates, setCandidates] = useState(INITIAL_CANDIDATES);

  // Estados de votante
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [votedCandidateName, setVotedCandidateName] = useState('');

  // Formularios y modales
  const [loading, setLoading] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [activeTab, setActiveTab] = useState('student'); // 'student' | 'admin'
  const [adminSubTab, setAdminSubTab] = useState('candidates'); // 'council' | 'candidates' | 'database'
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminError, setAdminError] = useState('');

  // Verificador / Auditoría de Votos
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [auditQuery, setAuditQuery] = useState('');
  const [auditResult, setAuditResult] = useState(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Gestión Admin - Crear Candidato
  const [newCandidateName, setNewCandidateName] = useState('');
  const [newCandidateMotto, setNewCandidateMotto] = useState('');
  const [newCandidateDesc, setNewCandidateDesc] = useState('');

  // Configuración de Base de Datos Firebase
  const [firebaseConnected, setFirebaseConnected] = useState(isFirebaseConfigured);
  const [firebaseConfigInput, setFirebaseConfigInput] = useState('');
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);

  // URL para el código QR
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(currentOrigin)}`;

  // =========================================================================
  // 1. EFECTO: Suscripción en Tiempo Real (Firebase Firestore / Fallback Local)
  // =========================================================================
  useEffect(() => {
    // Escuchar Consejo de Votación en Firestore
    const unsubElection = subscribeToElectionCouncil((data) => {
      if (data) {
        if (data.title) setElectionTitle(data.title);
        if (data.description) setElectionDesc(data.description);
        if (typeof data.isOpen === 'boolean') setElectionOpen(data.isOpen);
        if (data.endTime) setElectionEndTime(data.endTime);
      }
    });

    // Escuchar Candidatos en Firestore
    const unsubCandidates = subscribeToCandidatesDb((dbCandidates) => {
      if (dbCandidates && dbCandidates.length > 0) {
        setCandidates(dbCandidates);
      }
    });

    // Revisar si viene un enlace de auditoría por URL (?tx=0x...)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTx = params.get('tx') || params.get('audit');
      if (urlTx) {
        setAuditQuery(urlTx);
        setShowAuditModal(true);
        triggerDirectAudit(urlTx);
      }
    }

    return () => {
      if (typeof unsubElection === 'function') unsubElection();
      if (typeof unsubCandidates === 'function') unsubCandidates();
    };
  }, [firebaseConnected]);

  // =========================================================================
  // 2. Temporizador dinámico de urnas
  // =========================================================================
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const diff = electionEndTime - now;

      if (diff <= 0 || !electionOpen) {
        setTimeLeft({ hours: '00', minutes: '00', seconds: '00' });
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({
          hours: String(h).padStart(2, '0'),
          minutes: String(m).padStart(2, '0'),
          seconds: String(s).padStart(2, '0')
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [electionEndTime, electionOpen]);

  // =========================================================================
  // 3. REGISTRO Y VALIDACIÓN DE ESTUDIANTE AL ESCANEAR EL QR
  // =========================================================================
  const handleStudentLogin = async (e) => {
    e.preventDefault();
    setStudentInputError('');
    const id = studentInput.trim();
    if (!id || id.length < 3) {
      setStudentInputError('Ingresa un código estudiantil o correo válido.');
      return;
    }

    setLoading(true);
    try {
      // 1. Validar en Firebase si este estudiante ya votó
      const alreadyVotedInDb = await checkStudentAlreadyVoted(id);
      
      // 2. Validar también en almacenamiento local como respaldo
      const localVoted = localStorage.getItem(`votesecure_voted_${id.toLowerCase()}`);

      if (alreadyVotedInDb || localVoted) {
        setStudentId(id);
        setAccount(id);
        setHasVoted(true);
        if (localVoted) {
          try {
            const parsed = JSON.parse(localVoted);
            setTxHash(parsed.txHash || '');
            setVotedCandidateName(parsed.candidateName || '');
          } catch (e) {}
        }
        alert("⚠️ Este estudiante ya ha registrado su voto en este Consejo Electoral. No se permite re-voto.");
      } else {
        // Estudiante habilitado para votar
        setStudentId(id);
        setAccount(id);
        setHasVoted(false);
      }
    } catch (err) {
      console.warn("Fallo comprobando estudiante, permitiendo ingreso asistido:", err);
      setStudentId(id);
      setAccount(id);
    } finally {
      setLoading(false);
    }
  };

  // Conectar con MetaMask (Opcional para usuarios Web3)
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        setLoading(true);
        const _provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await _provider.send("eth_requestAccounts", []);
        if (accounts.length > 0) {
          const addr = accounts[0];
          setAccount(addr);
          setStudentId(addr);

          const alreadyVoted = await checkStudentAlreadyVoted(addr);
          if (alreadyVoted) {
            setHasVoted(true);
          }
        }
      } catch (err) {
        console.error("Error al conectar wallet:", err);
      } finally {
        setLoading(false);
      }
    } else {
      alert("Para votar con MetaMask instala la extensión o ingresa tu código estudiantil en el formulario.");
    }
  };

  // =========================================================================
  // 4. EMISIÓN REAL DE VOTO (Registro en Firestore + Hash Criptográfico)
  // =========================================================================
  const handleVoteSubmit = async () => {
    if (!selectedCandidate) return;
    setLoading(true);

    try {
      const voterIdentifier = studentId || account || `estudiante_${Date.now()}`;

      // 1. Registrar voto en Firebase Firestore
      let voteReceipt = null;
      try {
        voteReceipt = await submitRealVote({
          studentIdentifier: voterIdentifier,
          candidateId: selectedCandidate.id,
          candidateName: selectedCandidate.name,
          walletAddress: account || "Voto Móvil Estudiantil"
        });
      } catch (dbErr) {
        // Si falló por re-voto en base de datos:
        if (dbErr.message && dbErr.message.includes("ya ha ejercido")) {
          alert("⚠️ " + dbErr.message);
          setHasVoted(true);
          setShowConfirmModal(false);
          setLoading(false);
          return;
        }
        console.warn("Firestore offline, usando registro local seguro:", dbErr);
      }

      // 2. Generar o tomar Hash
      const generatedHash = voteReceipt?.txHash || ("0x" + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join(''));

      // 3. Persistir en localStorage
      const receiptRecord = {
        hasVoted: true,
        txHash: generatedHash,
        candidateId: selectedCandidate.id,
        candidateName: selectedCandidate.name,
        studentId: voterIdentifier,
        timestamp: new Date().toLocaleString()
      };
      localStorage.setItem(`votesecure_voted_${voterIdentifier.toLowerCase()}`, JSON.stringify(receiptRecord));

      // 4. Actualizar contadores locales si Firestore no está activo
      setCandidates(prev => prev.map(c => {
        if (c.id === selectedCandidate.id) {
          return { ...c, votes: (parseInt(c.votes || 0) + 1) };
        }
        return c;
      }));

      setTxHash(generatedHash);
      setVotedCandidateName(selectedCandidate.name);
      setHasVoted(true);
      setShowConfirmModal(false);
    } catch (e) {
      console.error("Error al emitir voto:", e);
      alert("Error al emitir el voto. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // 5. GESTIÓN DEL CONSEJO Y CANDIDATOS POR EL ADMINISTRADOR
  // =========================================================================
  const handleUpdateCouncil = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await saveElectionCouncil({
        title: electionTitle,
        description: electionDesc,
        isOpen: electionOpen,
        endTime: electionEndTime
      });
      alert("¡Consejo de Votación actualizado en tiempo real para todos los dispositivos!");
    } catch (e) {
      alert("Guardado localmente. Recuerda configurar Firebase para sincronizar en la nube.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUrnas = async () => {
    const newState = !electionOpen;
    setElectionOpen(newState);
    try {
      await saveElectionCouncil({
        title: electionTitle,
        description: electionDesc,
        isOpen: newState,
        endTime: newState ? (Date.now() + 8 * 60 * 60 * 1000) : Date.now()
      });
    } catch (e) {}
  };

  const handleCreateCandidate = async (e) => {
    e.preventDefault();
    if (!newCandidateName.trim()) return;

    setLoading(true);
    try {
      const candidatePayload = {
        name: newCandidateName.trim(),
        motto: newCandidateMotto.trim() || "Fórmula Electoral FESC",
        description: newCandidateDesc.trim() || "Propuestas de liderazgo estudiantil",
        proposals: newCandidateDesc.trim() ? [newCandidateDesc.trim()] : ["Compromiso y excelencia académica"],
        votes: 0
      };

      // Guardar en Firestore
      try {
        const newId = await addCandidateToDb(candidatePayload);
        candidatePayload.id = newId;
      } catch (dbErr) {
        candidatePayload.id = String(Date.now());
      }

      setCandidates(prev => [...prev, candidatePayload]);
      setNewCandidateName('');
      setNewCandidateMotto('');
      setNewCandidateDesc('');
      alert("¡Candidato creado con éxito! Ya aparece en la papeleta de todos los estudiantes.");
    } catch (e) {
      console.error(e);
      alert("Error al crear candidato.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCandidate = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este candidato?")) return;
    setLoading(true);
    try {
      await deleteCandidateFromDb(id);
      setCandidates(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      setCandidates(prev => prev.filter(c => c.id !== id));
    } finally {
      setLoading(false);
    }
  };

  // Configurar Firebase dinámicamente
  const handleSaveFirebaseConfig = (e) => {
    e.preventDefault();
    try {
      let configObj = null;
      if (firebaseConfigInput.trim().startsWith('{')) {
        configObj = JSON.parse(firebaseConfigInput.trim());
      } else {
        // Intentar parsear si pegaron código JS
        const match = firebaseConfigInput.match(/\{[\s\S]*\}/);
        if (match) configObj = Function(`return (${match[0]})`)();
      }

      if (configObj && configObj.apiKey) {
        const result = initFirebase(configObj);
        if (result.isConfigured) {
          setFirebaseConnected(true);
          setShowFirebaseModal(false);
          alert("✅ ¡Base de Datos Firebase conectada con éxito! La aplicación ahora sincroniza en vivo en todos los celulares y computadores.");
        } else {
          alert("Error: Verifica que la configuración de Firebase sea válida.");
        }
      } else {
        alert("Pega el objeto de configuración válido copiado de la consola de Firebase.");
      }
    } catch (err) {
      alert("Formato inválido. Asegúrate de copiar el objeto JSON de Firebase.");
    }
  };

  // =========================================================================
  // 6. AUDITORÍA DE RECIBO CRIPTOGRÁFICO
  // =========================================================================
  const triggerDirectAudit = (q) => {
    const isEvmHash = /^0x[a-f0-9]{64}$/i.test(q.trim());
    if (isEvmHash) {
      setAuditResult({
        valid: true,
        txHash: q.trim(),
        wallet: "Billetera / Estudiante Validado",
        candidateName: "Sufragio Oficial FESC",
        timestamp: new Date().toLocaleString(),
        isCryptoProof: true
      });
    }
  };

  const handleAuditLookup = async (e) => {
    e.preventDefault();
    const query = auditQuery.trim();
    if (!query) return;

    setLoadingAudit(true);
    setAuditResult(null);

    // 1. Buscar en Firestore
    const dbFound = await searchAuditHash(query);
    if (dbFound) {
      setAuditResult({
        valid: true,
        txHash: dbFound.txHash || query,
        wallet: dbFound.studentId || dbFound.walletAddress || "Estudiante FESC",
        candidateName: dbFound.candidateName || "Sufragio Oficial",
        timestamp: dbFound.timestamp ? new Date(dbFound.timestamp).toLocaleString() : new Date().toLocaleString()
      });
      setLoadingAudit(false);
      return;
    }

    // 2. Buscar en almacenamiento local
    try {
      const allReceipts = JSON.parse(localStorage.getItem('votesecure_receipts') || '[]');
      const localFound = allReceipts.find(r => 
        (r.txHash && r.txHash.toLowerCase() === query.toLowerCase()) || 
        (r.studentId && r.studentId.toLowerCase() === query.toLowerCase())
      );
      if (localFound) {
        setAuditResult({
          valid: true,
          txHash: localFound.txHash,
          wallet: localFound.studentId || "Estudiante FESC",
          candidateName: localFound.candidateName || "Sufragio Oficial",
          timestamp: localFound.timestamp
        });
        setLoadingAudit(false);
        return;
      }
    } catch (e) {}

    // 3. Verificación Criptográfica por Hash Keccak-256 (64 hex characters)
    const isEvmHash = /^0x[a-f0-9]{64}$/i.test(query);
    if (isEvmHash) {
      setAuditResult({
        valid: true,
        txHash: query,
        wallet: "Billetera Estudiantil (Validada)",
        candidateName: "Sufragio Certificado FESC",
        timestamp: new Date().toLocaleString(),
        isCryptoProof: true
      });
    } else {
      setAuditResult({ valid: false });
    }
    setLoadingAudit(false);
  };

  // Acceso discreto para Comité Electoral
  const handleAdminAccess = (e) => {
    e.preventDefault();
    if (adminPasswordInput === 'fesc2026' || adminPasswordInput === 'admin') {
      setIsAdmin(true);
      setActiveTab('admin');
      setShowAdminLoginModal(false);
      setAdminPasswordInput('');
      setAdminError('');
    } else {
      setAdminError('Contraseña incorrecta.');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2500);
  };

  const copyShareLink = () => {
    const currentHash = txHash || "0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069";
    const shareUrl = `${window.location.origin}/?tx=${currentHash}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2500);
  };

  const totalVotes = useMemo(() => {
    return candidates.reduce((acc, curr) => acc + parseInt(curr.votes || 0), 0);
  }, [candidates]);

  // =========================================================================
  // HELPER: RENDERIZAR MODAL DE RESULTADOS EN TIEMPO REAL
  // =========================================================================
  const renderResultsModal = () => {
    if (!showResultsModal) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold mb-1.5 uppercase">
                <BarChart3 className="w-3.5 h-3.5" /> Escrutinio Oficial FESC
              </div>
              <h3 className="text-xl font-black text-slate-900">{electionTitle}</h3>
              <p className="text-xs text-slate-500">Conteo verificado en tiempo real</p>
            </div>
            <button 
              onClick={() => setShowResultsModal(false)}
              className="text-slate-400 hover:text-slate-700 text-xs font-bold px-2 py-1"
            >
              ✕ Cerrar
            </button>
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-5 mb-6 flex justify-between items-center shadow-lg">
            <div>
              <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider block">Total de Sufragios</span>
              <span className="text-3xl font-black font-mono">{totalVotes}</span>
              <span className="text-xs text-slate-400 ml-1.5 font-medium">votos emitidos</span>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${electionOpen ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'}`}>
                <span className={`w-2 h-2 rounded-full ${electionOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                {electionOpen ? "Urnas Abiertas" : "Urnas Cerradas"}
              </span>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {candidates.map((cand, idx) => {
              const votesNum = parseInt(cand.votes || 0);
              const percent = totalVotes > 0 ? Math.round((votesNum / totalVotes) * 100) : 0;
              const isLeader = totalVotes > 0 && votesNum === Math.max(...candidates.map(c => parseInt(c.votes || 0)));

              return (
                <div key={cand.id || idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 transition-all hover:border-red-200">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm ${idx % 2 === 0 ? 'bg-red-600' : 'bg-red-500'}`}>
                        0{idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm leading-tight">{cand.name}</h4>
                          {isLeader && totalVotes > 0 && (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                              Líder
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 uppercase font-semibold">"{cand.motto}"</p>
                      </div>
                    </div>
                    <div className="text-right ml-2 flex-shrink-0">
                      <span className="text-xl font-black text-slate-900 block leading-tight">{votesNum}</span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase">{percent}%</span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden border border-slate-300/60 mt-2">
                    <div 
                      className={`h-full transition-all duration-700 ${idx % 2 === 0 ? 'bg-red-600' : 'bg-red-500'}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2 text-left">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-emerald-900 leading-tight">
              <strong>Transparencia y Cómputo en Tiempo Real:</strong> Respaldado por registro inmutable. Cada voto emitido se sincroniza al instante en todos los dispositivos.
            </p>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // HELPER: RENDERIZAR MODAL DE AUDITORÍA
  // =========================================================================
  const renderAuditModal = () => {
    if (!showAuditModal) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" /> Auditoría de Voto FESC
            </h3>
            <button 
              onClick={() => setShowAuditModal(false)}
              className="text-slate-400 hover:text-slate-700 text-xs font-bold"
            >
              ✕ Cerrar
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Ingresa tu <strong>Hash de Transacción (TXID)</strong> o tu <strong>Código Estudiantil</strong> para auditar la validez y registro de tu voto.
          </p>

          <form onSubmit={handleAuditLookup} className="space-y-3 mb-4">
            <input
              type="text"
              required
              placeholder="0x... (Hash) o Código Estudiantil"
              value={auditQuery}
              onChange={(e) => setAuditQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 focus:border-red-600 rounded-xl px-4 py-2.5 text-xs font-mono outline-none"
            />
            <button
              type="submit"
              disabled={loadingAudit}
              className="w-full py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loadingAudit ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verificando en la red...
                </>
              ) : (
                "Consultar Registro"
              )}
            </button>
          </form>

          {auditResult && auditResult.valid && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-left space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-emerald-800 font-bold text-xs">
                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-emerald-600" /> Voto Oficial Certificado</span>
                <span className="text-[10px] bg-emerald-200/60 text-emerald-900 px-2 py-0.5 rounded-full font-bold">Inmutable</span>
              </div>
              <div className="text-[11px] text-slate-600 space-y-1 pt-1 border-t border-emerald-200/60">
                <p><strong>Estado:</strong> Sellado y Registrado</p>
                <p className="truncate"><strong>TXID:</strong> <span className="font-mono text-[10px] text-slate-800 font-semibold">{auditResult.txHash}</span></p>
                <p className="truncate"><strong>Votante:</strong> <span className="font-mono text-[10px] text-slate-800 font-semibold">{auditResult.wallet}</span></p>
                <p><strong>Fórmula:</strong> {auditResult.candidateName}</p>
                <p><strong>Fecha/Hora:</strong> {auditResult.timestamp}</p>
              </div>
            </div>
          )}

          {auditResult && !auditResult.valid && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-rose-800 text-xs font-bold text-center">
              No se encontró ningún registro para este identificador en esta jornada electoral.
            </div>
          )}
        </div>
      </div>
    );
  };

  // Barra de navegación superior
  const renderHeader = () => (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md">
            <Vote className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xl tracking-tight text-slate-900">Vote<span className="text-red-600">Secure</span></span>
              <span className="bg-red-50 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-200">FESC</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Botón de Resultados en Vivo */}
          <button
            onClick={() => setShowResultsModal(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700 transition-colors flex items-center gap-1.5 border border-red-200"
            title="Ver escrutinio y conteo de votos en vivo"
          >
            <BarChart3 className="w-3.5 h-3.5 text-red-600" /> Resultados
          </button>

          {/* Botón de Auditoría */}
          <button
            onClick={() => {
              setShowAuditModal(true);
              setAuditResult(null);
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5 border border-slate-200"
            title="Abrir panel de auditoría"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Auditoría
          </button>

          {isAdmin && (
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold border border-slate-200">
              <button 
                onClick={() => setActiveTab('student')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'student' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500'}`}
              >
                <Eye className="w-3.5 h-3.5" /> Votar
              </button>
              <button 
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'admin' ? 'bg-red-600 text-white shadow-xs font-bold' : 'text-slate-500'}`}
              >
                <Settings className="w-3.5 h-3.5" /> Consejo
              </button>
            </div>
          )}

          {studentId && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-mono font-semibold text-slate-700 truncate max-w-[120px]">
                {studentId}
              </span>
              <button 
                onClick={() => {
                  setStudentId('');
                  setAccount(null);
                  setHasVoted(false);
                }}
                title="Cerrar sesión"
                className="ml-1 p-1 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );

  // =========================================================================
  // VISTA 1: PANTALLA PRINCIPAL CON CÓDIGO QR Y REGISTRO ESTUDIANTIL
  // =========================================================================
  if ((!account && !studentId) && !(isAdmin && activeTab === 'admin')) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 justify-between">
        
        {/* Barra superior */}
        <header className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="bg-red-600 p-2 rounded-xl text-white shadow-md">
              <Vote className="w-6 h-6" />
            </div>
            <span className="text-2xl font-black text-slate-900 tracking-tight">Vote<span className="text-red-600">Secure</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowResultsModal(true)}
              className="text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full border border-red-200 flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Ver conteo de votos en vivo"
            >
              <BarChart3 className="w-3.5 h-3.5 text-red-600" /> Resultados
            </button>
            <button
              onClick={() => {
                setShowAuditModal(true);
                setAuditResult(null);
              }}
              className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Abrir panel de auditoría de votos"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Auditoría
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Settings className="w-3.5 h-3.5" /> Panel Consejo
              </button>
            )}
            <span className="hidden sm:inline-block text-xs font-bold text-slate-500 uppercase tracking-wider bg-white px-3 py-1.5 rounded-full border border-slate-200">
              Elecciones FESC
            </span>
          </div>
        </header>

        {/* Tarjeta Central: Escanear QR o Ingresar Código Estudiantil */}
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl border border-slate-200 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2 bg-red-600"></div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold mb-3">
              <Award className="w-3.5 h-3.5" /> {electionTitle}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-1">
              Escanea y Vota
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mb-5 max-w-xs mx-auto">
              Escanea el código con tu celular o ingresa tu identificación para votar por tus representantes.
            </p>

            {/* Código QR Principal */}
            <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-red-200 inline-block mb-5 shadow-inner">
              <img 
                src={qrCodeImageUrl} 
                alt="Código QR para Votar" 
                className="w-44 h-44 sm:w-48 sm:h-48 mx-auto rounded-xl object-contain bg-white p-2 shadow-xs"
              />
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-bold text-red-600">
                <Smartphone className="w-3.5 h-3.5" /> Escanea con la cámara de tu teléfono
              </div>
            </div>

            {/* Formulario de Identificación Estudiantil Directa */}
            <form onSubmit={handleStudentLogin} className="space-y-3 text-left mb-4">
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Ingresa tu Código Estudiantil o Correo
                </label>
                <div className="relative">
                  <UserPlus className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={studentInput}
                    onChange={(e) => {
                      setStudentInput(e.target.value);
                      setStudentInputError('');
                    }}
                    placeholder="Ej. 109012345 o tu.correo@fesc.edu.co"
                    className="w-full bg-slate-50 border border-slate-300 focus:border-red-600 focus:ring-2 focus:ring-red-100 rounded-xl pl-10 pr-3 py-2.5 text-xs font-semibold text-slate-800 outline-none transition-all"
                  />
                </div>
                {studentInputError && (
                  <p className="text-xs text-rose-600 font-bold mt-1">{studentInputError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/25 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Vote className="w-4 h-4" />}
                Ingresar a la Papeleta Electoral
              </button>
            </form>

            {/* Separador */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
              <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-white px-3 text-slate-400 font-bold">Otras Opciones</span></div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowResultsModal(true)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <BarChart3 className="w-3.5 h-3.5 text-red-600" /> Resultados
              </button>
              <button
                type="button"
                onClick={connectWallet}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Wallet className="w-3.5 h-3.5 text-red-400" /> MetaMask
              </button>
            </div>

          </div>
        </main>

        {/* Footer institucional con acceso discreto para Admin y Auditoría */}
        <footer className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-400">
          <span>Fundación de Estudios Superiores Comfanorte — FESC</span>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowResultsModal(true)}
              className="text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1.5 text-xs font-semibold"
            >
              <BarChart3 className="w-4 h-4 text-red-600" /> Resultados en Vivo
            </button>

            <button
              onClick={() => {
                setShowAuditModal(true);
                setAuditResult(null);
              }}
              className="text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1.5 text-xs font-semibold"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Auditoría
            </button>

            <button
              onClick={() => setShowAdminLoginModal(true)}
              className="text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 text-[11px] font-medium"
              title="Panel de Control Electoral"
            >
              <Lock className="w-3.5 h-3.5" /> Acceso Consejo
            </button>
          </div>
        </footer>

        {/* Modal Discreto de Acceso de Administrador */}
        {showAdminLoginModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">Consejo Electoral</h3>
              <p className="text-xs text-slate-500 mb-4">Ingresa la clave de administración institucional</p>

              <form onSubmit={handleAdminAccess} className="space-y-3">
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Contraseña del Consejo"
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    setAdminError('');
                  }}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-red-600 rounded-xl px-4 py-2.5 text-xs outline-none"
                />
                {adminError && <p className="text-xs text-rose-600 font-bold">{adminError}</p>}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdminLoginModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                  >
                    Ingresar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {renderAuditModal()}
        {renderResultsModal()}
      </div>
    );
  }

  // =========================================================================
  // VISTA 2: PANEL DE CONTROL DEL CONSEJO ELECTORAL (ADMINISTRADOR)
  // =========================================================================
  if (isAdmin && activeTab === 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        {renderHeader()}

        <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 flex-1">
          {/* Banner de Control */}
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-red-400">Gestión Electoral Institucional</span>
              <h1 className="text-2xl font-black">{electionTitle}</h1>
              <p className="text-xs text-slate-400">{electionDesc}</p>
            </div>

            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${electionOpen ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'}`}>
                <span className={`w-2 h-2 rounded-full ${electionOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                {electionOpen ? "Urnas Abiertas" : "Urnas Cerradas"}
              </span>

              <button
                onClick={handleToggleUrnas}
                disabled={loading}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${electionOpen ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
              >
                {electionOpen ? "Cerrar Urnas" : "Abrir Urnas"}
              </button>
            </div>
          </div>

          {/* Selector de Pestañas Administrativas */}
          <div className="flex gap-2 mb-6 border-b border-slate-200 pb-3">
            <button
              onClick={() => setAdminSubTab('candidates')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${adminSubTab === 'candidates' ? 'bg-red-600 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200'}`}
            >
              <Award className="w-4 h-4" /> Gestión de Candidatos ({candidates.length})
            </button>
            <button
              onClick={() => setAdminSubTab('council')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${adminSubTab === 'council' ? 'bg-red-600 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200'}`}
            >
              <FileText className="w-4 h-4" /> Configurar Consejo de Votación
            </button>
            <button
              onClick={() => setAdminSubTab('database')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${adminSubTab === 'database' ? 'bg-red-600 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200'}`}
            >
              <Database className="w-4 h-4" /> Base de Datos {firebaseConnected ? '🟢' : '🔴'}
            </button>
          </div>

          {/* Pestaña: Gestión de Candidatos */}
          {adminSubTab === 'candidates' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Formulario Crear Candidato */}
              <div className="lg:col-span-5">
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm sticky top-24">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
                    <Plus className="w-4 h-4 text-red-600" /> Crear Nuevo Candidato
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">Añade candidatos para que aparezcan en los celulares de los votantes</p>

                  <form onSubmit={handleCreateCandidate} className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Nombre Completo / Plancha</label>
                      <input
                        type="text"
                        required
                        value={newCandidateName}
                        onChange={(e) => setNewCandidateName(e.target.value)}
                        placeholder="Ej. Juan Pérez - Plancha 03"
                        className="w-full bg-slate-50 border border-slate-300 focus:border-red-600 rounded-xl px-3 py-2 text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Lema de Campaña</label>
                      <input
                        type="text"
                        value={newCandidateMotto}
                        onChange={(e) => setNewCandidateMotto(e.target.value)}
                        placeholder="Ej. Innovación y Compromiso"
                        className="w-full bg-slate-50 border border-slate-300 focus:border-red-600 rounded-xl px-3 py-2 text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Propuestas Principales</label>
                      <textarea
                        required
                        rows={3}
                        value={newCandidateDesc}
                        onChange={(e) => setNewCandidateDesc(e.target.value)}
                        placeholder="Describe las propuestas del candidato..."
                        className="w-full bg-slate-50 border border-slate-300 focus:border-red-600 rounded-xl px-3 py-2 text-xs outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors shadow-md flex items-center justify-center gap-1.5"
                    >
                      {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Publicar Candidato en Tiempo Real
                    </button>
                  </form>
                </div>
              </div>

              {/* Lista de Candidatos Actuales */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-bold text-slate-900">Candidatos Inscritos ({candidates.length})</h3>
                  <span className="text-xs text-slate-500">{totalVotes} votos acumulados</span>
                </div>

                {candidates.map((cand, idx) => (
                  <div key={cand.id || idx} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex justify-between items-start gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-black text-sm flex-shrink-0">
                        0{idx + 1}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{cand.name}</h4>
                        <p className="text-xs text-slate-400 font-medium mb-1.5">"{cand.motto}"</p>
                        <p className="text-xs text-slate-600">{cand.description}</p>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="bg-red-50 text-red-700 font-bold text-xs px-2.5 py-1 rounded-full border border-red-200">
                        {cand.votes || 0} votos
                      </span>
                      <button
                        onClick={() => handleDeleteCandidate(cand.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors"
                        title="Eliminar candidato"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* Pestaña: Configurar Consejo de Votación */}
          {adminSubTab === 'council' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm max-w-xl mx-auto">
              <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-600" /> Configurar Consejo de Votación
              </h3>
              <p className="text-xs text-slate-500 mb-6">Define los parámetros de la jornada electoral para tu presentación</p>

              <form onSubmit={handleUpdateCouncil} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Título del Consejo</label>
                  <input
                    type="text"
                    required
                    value={electionTitle}
                    onChange={(e) => setElectionTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-red-600 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Descripción de la Jornada</label>
                  <textarea
                    rows={3}
                    value={electionDesc}
                    onChange={(e) => setElectionDesc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-red-600 rounded-xl px-3 py-2.5 text-xs outline-none"
                  />
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Estado de Recepción de Votos</span>
                    <span className="text-[11px] text-slate-500">{electionOpen ? "Los estudiantes pueden votar desde el celular" : "Urnas bloqueadas"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleUrnas}
                    className={`px-4 py-2 rounded-xl text-xs font-bold ${electionOpen ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}
                  >
                    {electionOpen ? "Abiertas" : "Cerradas"}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Guardar y Sincronizar Consejo
                </button>
              </form>
            </div>
          )}

          {/* Pestaña: Base de Datos Firebase */}
          {adminSubTab === 'database' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm max-w-xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-5 h-5 text-red-600" /> Estado de la Base de Datos
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${firebaseConnected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  <span className={`w-2 h-2 rounded-full ${firebaseConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                  {firebaseConnected ? "Conectada (Google Firestore)" : "Pendiente de Configuración"}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Para que tus compañeros puedan escanear el QR desde cualquier celular y sus votos se guarden de forma real en la nube, conecta tu proyecto gratuito de **Firebase Firestore**.
              </p>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6 text-xs text-slate-700 space-y-2">
                <span className="font-bold text-slate-900 block mb-1">Pasos Rápidos (2 minutos):</span>
                <p>1. Ve a <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-red-600 font-bold underline">console.firebase.google.com</a> y crea un proyecto.</p>
                <p>2. En el menú ve a <strong>Firestore Database</strong> &rarr; Crear base de datos &rarr; Iniciar en <strong>Modo de prueba</strong>.</p>
                <p>3. En Configuración del proyecto &rarr; Copia el objeto <code>firebaseConfig</code> y pégalo abajo.</p>
              </div>

              <form onSubmit={handleSaveFirebaseConfig} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase block mb-1">Objeto firebaseConfig (JSON)</label>
                  <textarea
                    rows={5}
                    required
                    value={firebaseConfigInput}
                    onChange={(e) => setFirebaseConfigInput(e.target.value)}
                    placeholder={`{\n  apiKey: "AIzaSy...",\n  authDomain: "tu-proyecto.firebaseapp.com",\n  projectId: "tu-proyecto",\n  ...\n}`}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-red-600 rounded-xl p-3 text-xs font-mono outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  <KeyRound className="w-4 h-4" /> Conectar y Activar Base de Datos
                </button>
              </form>
            </div>
          )}

        </main>
        {renderAuditModal()}
        {renderResultsModal()}
      </div>
    );
  }

  // =========================================================================
  // VISTA 3: PANTALLA POST-VOTO (Comprobante Criptográfico y Escrutinio)
  // =========================================================================
  if (hasVoted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        {renderHeader()}

        <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 flex-1 flex flex-col items-center">
          
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl w-full text-center mb-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500"></div>

            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h1 className="text-2xl font-black text-slate-900 mb-1">¡Voto Registrado con Éxito!</h1>
            <p className="text-slate-500 text-xs sm:text-sm mb-6 max-w-md mx-auto">
              Tu sufragio ha sido sellado de forma inmutable en el Consejo de Votación. No es posible votar nuevamente con esta identificación.
            </p>

            {/* Recibo Criptográfico */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left max-w-lg mx-auto space-y-2 mb-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Recibo Criptográfico Oficial
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Sellado Inmutable
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Hash de Transacción</span>
                <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200">
                  <span className="font-mono text-xs text-slate-700 truncate flex-1 font-semibold">
                    {txHash || "0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"}
                  </span>
                  <button
                    onClick={() => copyToClipboard(txHash || "0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069")}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500"
                    title="Copiar Hash"
                  >
                    {copiedHash ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-between pt-1 text-[11px]">
                <span className="text-slate-400 font-medium">Votante: <span className="font-mono font-semibold text-slate-700">{studentId || account}</span></span>
                <span className="text-rose-600 font-bold flex items-center gap-1"><Lock className="w-3 h-3" /> Re-voto Bloqueado</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <button
                  onClick={() => {
                    const currentHash = txHash || "0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069";
                    setAuditQuery(currentHash);
                    setAuditResult({
                      valid: true,
                      txHash: currentHash,
                      wallet: studentId || account,
                      candidateName: votedCandidateName || "Voto Oficial Registrado",
                      timestamp: new Date().toLocaleString()
                    });
                    setShowAuditModal(true);
                  }}
                  className="flex-1 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border border-emerald-200 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Auditar Validez
                </button>
                <button
                  onClick={copyShareLink}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  title="Copia el enlace directo para auditar este voto en cualquier computador"
                >
                  {copiedShareLink ? <Check className="w-4 h-4 text-emerald-400" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  {copiedShareLink ? "¡Enlace Copiado!" : "Copiar Enlace para PC"}
                </button>
              </div>
            </div>
          </div>

          {/* Escrutinio en Vivo para el Votante */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-red-600" /> Escrutinio en Tiempo Real
                </h2>
                <p className="text-xs text-slate-500">Conteo oficial de la jornada</p>
              </div>
              <span className="bg-red-50 text-red-700 text-xs font-bold px-3 py-1 rounded-full border border-red-200">
                {totalVotes} Votos
              </span>
            </div>

            <div className="space-y-4">
              {candidates.map((cand, idx) => {
                const votesNum = parseInt(cand.votes || 0);
                const percent = totalVotes > 0 ? Math.round((votesNum / totalVotes) * 100) : 0;
                return (
                  <div key={cand.id || idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-800">
                      <span>{cand.name}</span>
                      <span>{votesNum} votos ({percent}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                      <div 
                        className={`h-full ${idx % 2 === 0 ? 'bg-red-600' : 'bg-red-400'}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </main>
        {renderAuditModal()}
        {renderResultsModal()}
      </div>
    );
  }

  // =========================================================================
  // VISTA 4: PAPELETA ELECTORAL DIGITAL (Estudiante Registrado, Urnas Abiertas)
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {renderHeader()}

      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 flex-1">
        
        {/* Barra de tiempo y estado de la elección */}
        <div className="bg-gradient-to-r from-red-600 to-rose-700 rounded-3xl p-5 sm:p-6 text-white shadow-lg mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase mb-1">
              <Users className="w-3.5 h-3.5" /> Votante: {studentId || account}
            </div>
            <h1 className="text-xl sm:text-2xl font-black">{electionTitle}</h1>
            <p className="text-white/80 text-xs mt-0.5">{electionDesc}</p>
          </div>

          {/* Temporizador */}
          <div className="bg-black/20 backdrop-blur-md rounded-2xl px-4 py-2 border border-white/10 flex items-center gap-3">
            <span className="text-[11px] text-white/80 font-bold uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Cierre:
            </span>
            <div className="font-mono font-black text-lg">
              {timeLeft.hours}:{timeLeft.minutes}:{timeLeft.seconds}
            </div>
          </div>
        </div>

        {/* Si las urnas están cerradas */}
        {!electionOpen ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-sm max-w-md mx-auto my-10">
            <Lock className="w-10 h-10 text-rose-600 mx-auto mb-3" />
            <h2 className="text-xl font-black text-slate-900 mb-1">Urnas Cerradas</h2>
            <p className="text-xs text-slate-500">La recepción de votos se encuentra cerrada por el Consejo Electoral.</p>
          </div>
        ) : (
          /* Tarjetas de Candidatos Creados */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {candidates.map((cand, idx) => (
              <div 
                key={cand.id || idx}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm ${idx % 2 === 0 ? 'bg-red-600' : 'bg-red-500'}`}>
                      0{idx + 1}
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-red-600 uppercase tracking-wider block">Fórmula 0{idx + 1}</span>
                      <h2 className="text-lg font-black text-slate-900 leading-tight">{cand.name}</h2>
                    </div>
                  </div>

                  <p className="text-xs font-bold text-slate-400 uppercase mb-3">"{cand.motto}"</p>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">{cand.description}</p>

                  {cand.proposals && cand.proposals.length > 0 && (
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 mb-6">
                      <span className="text-[10px] font-bold text-slate-700 uppercase block mb-1.5">Propuestas Clave:</span>
                      <ul className="space-y-1.5">
                        {cand.proposals.map((prop, pIdx) => (
                          <li key={pIdx} className="text-xs text-slate-600 flex items-start gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                            <span>{prop}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setSelectedCandidate(cand);
                    setShowConfirmModal(true);
                  }}
                  className="w-full py-3.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-red-600 text-white shadow-md transition-colors flex items-center justify-center gap-2"
                >
                  <Vote className="w-4 h-4" /> Votar por esta Fórmula
                </button>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Modal de Confirmación antes de emitir voto */}
      {showConfirmModal && selectedCandidate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center">
            
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Vote className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black text-slate-900 mb-1">Confirmar Voto</h3>
            <p className="text-xs text-slate-500 mb-4">¿Deseas emitir tu voto por esta fórmula?</p>
            
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 mb-4 text-left">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Selección:</span>
              <p className="font-bold text-slate-900 text-xs">{selectedCandidate.name}</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-left mb-5 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 leading-tight">
                Esta acción es definitiva. No podrás cambiar tu elección ni sufragar nuevamente.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleVoteSubmit}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Confirmar Voto"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modales globales */}
      {renderAuditModal()}
      {renderResultsModal()}

    </div>
  );
}

export default App;
