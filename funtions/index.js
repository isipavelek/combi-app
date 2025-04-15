// CombiApp simplificado con único resumen compartido
import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  Timestamp,
} from 'firebase/firestore';
import {
  getAuth,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBvRzi4aDOgzdTHtnQmJh_fRh3kqurBXeA",
  authDomain: "combiapp-e585a.firebaseapp.com",
  projectId: "combiapp-e585a",
  storageBucket: "combiapp-e585a.firebasestorage.app",
  messagingSenderId: "884793176289",
  appId: "1:884793176289:web:7402bda2ef660077c607a0",
  measurementId: "G-QNHCT5VXK8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const STOPS = [
  "P. Goyena",
  "Puán-Fragata",
  "Juan B Justo y San Martín",
  "Santa Fe y Dresco",
  "Olazábal",
  "Congreso",
  "Vedia",
  "Pana y San Martin",
  "Pana y Marquez",
  "Pana y Cap. J de San Martin",
  "Garín-Escobar"
];

function App() {
  const [user, setUser] = useState(null);
  const [mostrarResumen, setMostrarResumen] = useState(false);

  useEffect(() => {
    auth.onAuthStateChanged((u) => {
      if (u) setUser(u);
    });
  }, []);

  if (!user) {
    return (
      <div className="bg-light min-vh-100 d-flex justify-content-center align-items-center">
        <div className="card shadow-lg p-4" style={{ maxWidth: '400px' }}>
          <h2 className="text-center mb-3">🚌 CombiApp</h2>
          <p className="text-center">Accedé con tu cuenta Google para comenzar.</p>
          <button className="btn btn-primary w-100" onClick={() => signInWithPopup(auth, provider)}>Iniciar sesión con Google</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-0">👤 Bienvenido, {user.displayName}</h3>
        </div>
        <div className="btn-group">
          <button className="btn btn-outline-primary" onClick={() => setMostrarResumen((prev) => !prev)}>
            📋 {mostrarResumen ? 'Ocultar' : 'Resumen del día'}
          </button>
          <button className="btn btn-outline-danger" onClick={() => signOut(auth)}>
            🔒 Cerrar sesión
          </button>
        </div>
      </div>
      <ResumenUsuario user={user} />
      {mostrarResumen && <ResumenViajes />}
    </div>
  );
}

function ResumenViajes() {
  const [diaSeleccionado, setDiaSeleccionado] = useState(() => {
    const today = new Date();
    return DAYS[today.getDay() - 1] || 'Lunes';
  });
  const [registros, setRegistros] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      const snapshot = await getDocs(collection(db, 'frecuencia'));
      const data = {};

      snapshot.forEach((doc) => {
        const d = doc.data();
        const dia = d.dias?.[diaSeleccionado];
        if (dia?.usar && dia.parada) {
          if (!data[dia.parada]) data[dia.parada] = [];
          data[dia.parada].push(d.nombre);
        }
      });
      setRegistros(data);
    };
    fetchData();
  }, [diaSeleccionado]);

  return (
    <div className="mt-4">
      <h4 className="mb-3">🗓️ Lista de pasajeros - {diaSeleccionado}</h4>
      <div className="mb-3">
        <label className="form-label">Seleccionar día</label>
        <select className="form-select" value={diaSeleccionado} onChange={(e) => setDiaSeleccionado(e.target.value)}>
          {DAYS.map((dia) => (
            <option key={dia} value={dia}>{dia}</option>
          ))}
        </select>
      </div>
      {Object.keys(registros).length === 0 ? (
        <p className="text-muted">No hay pasajeros registrados para este día.</p>
      ) : (
        Object.entries(registros).map(([parada, nombres]) => (
          <div key={parada} className="card mb-3 border-start border-primary">
            <div className="card-body">
              <h5 className="card-title">🚏 {parada}</h5>
              <ul className="mb-0">
                {nombres.map((nombre, i) => (
                  <li key={i}>{nombre}</li>
                ))}
              </ul>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ResumenUsuario({ user }) {
  const [viajes, setViajes] = useState({});
  const [loading, setLoading] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const ref = doc(db, 'frecuencia', user.email);
      const todayIndex = new Date().getDay() - 1;
      const todayName = DAYS[todayIndex];
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const datos = snap.data().dias || {};
        setViajes(datos);

        const hoy = datos[todayName];
        if (!hoy || !hoy.usar || !hoy.parada) {
          const beep = new Audio('https://notificationsounds.com/storage/sounds/file-sounds-1153-pristine.mp3');
          beep.play();
          const alerta = document.createElement('div');
          alerta.className = 'alert alert-warning alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
          alerta.style.zIndex = '1051';
          alerta.role = 'alert';
          alerta.innerHTML = `
            🚨 No registraste tu viaje para hoy (<strong>${todayName}</strong>). ¡Hacelo ahora!
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
          `;
          document.body.appendChild(alerta);
          setTimeout(() => {
            alerta.classList.remove('show');
            setTimeout(() => alerta.remove(), 300);
          }, 6000);
        }
      }
    };
    fetchData();
  }, [user.email]);

  const handleChange = (dia, campo, valor) => {
    setViajes((prev) => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        [campo]: valor,
      },
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);

    const todayIndex = new Date().getDay() - 1; // 0 = Lunes
    const cleanedViajes = {};

    Object.entries(viajes).forEach(([dia, datos]) => {
      const index = DAYS.indexOf(dia);
      if (!datos.usar) return;
      if (datos.recurrente || index >= todayIndex) {
        cleanedViajes[dia] = datos;
      }
    });

    const ref = doc(db, 'frecuencia', user.email);
    await setDoc(ref, {
      email: user.email,
      nombre: user.displayName,
      dias: viajes,
      updated: Timestamp.now(),
    });
    setLoading(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 3000);
  };

  return (
    <div className="mt-4">
      <h5 className="mb-3">🗓️ Mi resumen semanal</h5>
      {guardado && <div className="alert alert-success">✅ Cambios guardados</div>}
      {DAYS.map((dia) => (
        <div key={dia} className="card mb-2 border-start border-success border-3">
          <div className="card-body">
            <h6 className="card-title">📅 {dia}</h6>
            <div className="form-check form-switch mb-2">
              <input
                className="form-check-input"
                type="checkbox"
                id={`usar-${dia}`}
                checked={viajes[dia]?.usar || false}
                onChange={(e) => handleChange(dia, 'usar', e.target.checked)}
              />
              <label className="form-check-label" htmlFor={`usar-${dia}`}>
                Usar combi
              </label>
            </div>
            {viajes[dia]?.usar && (
              <>
                <div className="mb-2">
                  <label className="form-label">Parada</label>
                  <select
                    className="form-select"
                    value={viajes[dia]?.parada || ''}
                    onChange={(e) => handleChange(dia, 'parada', e.target.value)}
                  >
                    <option value="">Seleccionar parada</option>
                    {STOPS.map((stop, i) => (
                      <option key={i} value={stop}>{stop}</option>
                    ))}
                  </select>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`rec-${dia}`}
                    checked={viajes[dia]?.recurrente || false}
                    onChange={(e) => handleChange(dia, 'recurrente', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor={`rec-${dia}`}>
                    Viaje recurrente
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      ))}
      <div className="text-end">
        <button className="btn btn-success mt-2" onClick={handleSubmit} disabled={loading}>
          {loading && <span className="spinner-border spinner-border-sm me-2" role="status" />}Guardar selección
        </button>
      </div>
    </div>
  );
}

export default App;
