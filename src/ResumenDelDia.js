import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';

const firebaseConfig = {
  apiKey: "AIzaSyBvRzi4aDOgzdTHtnQmJh_fRh3kqurBXeA",
  authDomain: "combiapp-e585a.firebaseapp.com",
  projectId: "combiapp-e585a",
  storageBucket: "combiapp-e585a.firebasestorage.app",
  messagingSenderId: "884793176289",
  appId: "1:884793176289:web:7402bda2ef660077c607a0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

export default function ResumenDelDia() {
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
    <div className="container py-4">
      <h2 className="mb-4">📋 Resumen del día: {diaSeleccionado}</h2>

      <div className="mb-3">
        <label className="form-label">Seleccionar día</label>
        <select
          className="form-select"
          value={diaSeleccionado}
          onChange={(e) => setDiaSeleccionado(e.target.value)}
        >
          {DAYS.map((dia) => (
            <option key={dia} value={dia}>{dia}</option>
          ))}
        </select>
      </div>

      {Object.keys(registros).length === 0 ? (
        <p className="text-muted">No hay pasajeros registrados para este día.</p>
      ) : (
        Object.entries(registros).map(([parada, nombres]) => (
          <div key={parada} className="card mb-3 border-start border-info">
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

      <div className="mt-4">
        <Link to="/" className="btn btn-outline-secondary">
          ⬅ Volver al inicio
        </Link>
      </div>
    </div>
  );
}
