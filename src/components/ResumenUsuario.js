import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { STOPS_IDA, STOPS_VUELTA } from '../constants';
import { getOrderedWeekDays } from '../utils/dateUtils';

function ResumenUsuario({ user }) {
  const [viajes, setViajes] = useState({});
  const [loading, setLoading] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [orderedDays, setOrderedDays] = useState([]);
  const [mostrarResto, setMostrarResto] = useState(false);
  
  const [stopsIda, setStopsIda] = useState(STOPS_IDA);
  const [stopsVuelta, setStopsVuelta] = useState(STOPS_VUELTA);

  useEffect(() => {
    setOrderedDays(getOrderedWeekDays());
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch dynamic stops
      try {
        const stopsSnap = await getDoc(doc(db, 'config', 'stops'));
        if (stopsSnap.exists()) {
          const data = stopsSnap.data();
          
          const processStops = (list) => {
            if (!list) return [];
            return list.map(s => {
              if (typeof s === 'object' && s.name) {
                return `${s.name} (${s.time})`;
              }
              return s;
            });
          };

          setStopsIda(processStops(data.ida) || STOPS_IDA);
          setStopsVuelta(processStops(data.vuelta) || STOPS_VUELTA);
        }
      } catch (error) {
        console.error("Error fetching stops:", error);
      }

      // Fetch user data
      if (user) {
        const ref = doc(db, 'frecuencia', user.email);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const datos = snap.data().dias || {};
          setViajes(datos);
        }
      }
    };
    fetchData();
  }, [user]);

  const handleChange = (dia, tipo, campo, valor) => {
    setViajes((prev) => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        [tipo]: {
          ...prev[dia]?.[tipo],
          [campo]: valor,
        },
      },
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    const ref = doc(db, 'frecuencia', user.email);
    
    const dataToSave = { ...viajes };
    orderedDays.forEach(dayObj => {
      const { key, date } = dayObj;
      if (dataToSave[key]) {
        if (dataToSave[key].ida) dataToSave[key].ida.fecha = date;
        if (dataToSave[key].vuelta) dataToSave[key].vuelta.fecha = date;
      }
    });

    await setDoc(ref, {
      email: user.email,
      nombre: user.displayName,
      dias: dataToSave,
      updated: Timestamp.now(),
    });
    setLoading(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 3000);
  };

  const renderOpcion = (dayObj, tipo, stops) => {
    const { name: dia, date: currentDate } = dayObj;
    const data = viajes[dia]?.[tipo] || {};
    
    let usar = data.usar;
    const storedDate = data.fecha;
    const isRecurrent = data.recurrente === true;

    if (usar !== undefined && !isRecurrent && storedDate && storedDate !== currentDate) {
      usar = null;
    }

    const handleToggle = (valor) => {
      const newValue = usar === valor ? null : valor;
      handleChange(dia, tipo, 'usar', newValue);
    };

    return (
      <div className={`mb-3 p-3 rounded transition-all ${usar === true ? 'bg-success-subtle border border-success' : usar === false ? 'bg-danger-subtle border border-danger' : 'bg-light border'}`}>
        <h6 className="text-uppercase mb-2 fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '1px', color: usar === true ? 'var(--success)' : usar === false ? 'var(--danger)' : '#6c757d' }}>
          {tipo === 'ida' ? '🌅 Ida (Mañana)' : '🌇 Vuelta (Tarde)'}
        </h6>
        
        <div className="d-flex gap-2 mb-2">
          <button 
            className={`btn flex-grow-1 ${usar === true ? 'btn-success' : 'btn-outline-secondary'}`}
            onClick={() => handleToggle(true)}
            style={{ transition: 'all 0.2s' }}
          >
            {usar === true ? '✅ Voy' : 'Voy'}
          </button>
          <button 
            className={`btn flex-grow-1 ${usar === false ? 'btn-danger' : 'btn-outline-secondary'}`}
            onClick={() => handleToggle(false)}
            style={{ transition: 'all 0.2s' }}
          >
            {usar === false ? '❌ No voy' : 'No voy'}
          </button>
        </div>
        
        {usar === true && (
          <div className="mt-3 animate-fade-in">
            <div className="mb-2">
              <label className="form-label small fw-bold text-success">📍 Seleccioná tu parada:</label>
              <select
                className="form-select form-select-sm border-success"
                value={data.parada || ''}
                onChange={(e) => handleChange(dia, tipo, 'parada', e.target.value)}
                required
              >
                <option value="">-- Seleccionar parada --</option>
                {stops.map((stop, i) => (
                  <option key={i} value={stop}>{stop}</option>
                ))}
              </select>
            </div>
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id={`rec-${dia}-${tipo}`}
                checked={data.recurrente || false}
                onChange={(e) => handleChange(dia, tipo, 'recurrente', e.target.checked)}
              />
              <label className="form-check-label small text-muted" htmlFor={`rec-${dia}-${tipo}`}>
                🔄 Fijo (Recurrente)
              </label>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDayCard = (dayObj, isFirst = false) => {
    const { name: dia, date, key } = dayObj;
    return (
      <div key={key} className={`card mb-3 shadow-sm ${isFirst ? 'border-primary border-4' : 'border-start border-secondary border-3'}`} style={isFirst ? {borderLeft: '4px solid #4F46E5'} : {}}>
        <div className="card-body">
          <h6 className={`card-title mb-3 fw-bold ${isFirst ? 'text-primary' : 'text-dark'}`}>
            {isFirst ? '⭐ Próximo viaje: ' : ''}📅 {dia} <span className="text-muted fw-normal ms-2" style={{ fontSize: '0.9em' }}>({date})</span>
          </h6>
          <div className="row g-3">
            <div className="col-md-6">
              {renderOpcion(dayObj, 'ida', stopsIda)}
            </div>
            <div className="col-md-6">
              {renderOpcion(dayObj, 'vuelta', stopsVuelta)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (orderedDays.length === 0) return null;

  const firstDay = orderedDays[0];
  const otherDays = orderedDays.slice(1);

  return (
    <div className="mt-4">
      <h5 className="mb-3">🗓️ Mi resumen semanal</h5>
      {guardado && <div className="alert alert-success">✅ Cambios guardados</div>}
      
      {/* First Day - Always Visible */}
      {renderDayCard(firstDay, true)}

      {/* Toggle for other days */}
      {otherDays.length > 0 && (
        <div className="mb-3">
          <button 
            className="btn btn-outline-primary w-100 fw-bold"
            onClick={() => setMostrarResto(!mostrarResto)}
          >
            {mostrarResto ? '🔼 Ocultar próximos días' : `🔽 Ver próximos ${otherDays.length} días`}
          </button>
        </div>
      )}

      {/* Other Days - Collapsible */}
      {mostrarResto && (
        <div className="animate-fade-in">
          {otherDays.map(day => renderDayCard(day))}
        </div>
      )}

      <div className="text-end sticky-bottom bg-white p-3 border-top shadow-lg" style={{ zIndex: 100 }}>
        <button className="btn btn-primary btn-lg px-5 rounded-pill" onClick={handleSubmit} disabled={loading}>
          {loading ? <span className="spinner-border spinner-border-sm me-2" role="status" /> : '💾 '}
          Guardar Cambios
        </button>
      </div>
    </div>
  );
}

export default ResumenUsuario;
