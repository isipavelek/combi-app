import React, { useState, useEffect } from 'react';

import { updateProfile, updateEmail } from 'firebase/auth';
import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';
import { db, auth, messaging } from '../firebaseConfig';

function Configuracion({ user, onClose }) {
  const [alertaIda, setAlertaIda] = useState(true);
  const [minutos, setMinutos] = useState(15);
  const [recordatorioVuelta, setRecordatorioVuelta] = useState(true);

  // Profile State
  const [nombre, setNombre] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [originalEmail, setOriginalEmail] = useState(user?.email || '');

  useEffect(() => {
    const savedConfig = localStorage.getItem('combiAppConfig');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      setAlertaIda(config.alertaIda !== undefined ? config.alertaIda : true);
      setMinutos(config.minutosAnticipacion || 15);
      setRecordatorioVuelta(config.recordatorioVuelta !== undefined ? config.recordatorioVuelta : true);
    }
  }, []);

  const handleSave = async () => {
    // 1. Save Config
    const config = {
      alertaIda,
      minutosAnticipacion: parseInt(minutos),
      recordatorioVuelta
    };
    localStorage.setItem('combiAppConfig', JSON.stringify(config));
    
    // 2. Save Profile (if changed)
    if (user) {
      try {
        // Update Name
        if (nombre !== user.displayName) {
          await updateProfile(user, { displayName: nombre });
          // Update Firestore
          await setDoc(doc(db, 'users', originalEmail), { name: nombre }, { merge: true });
        }

        // Update Email
        if (email !== originalEmail) {
          await updateEmail(user, email);
          // Move Firestore Doc
          const oldDocRef = doc(db, 'users', originalEmail);
          const oldDocSnap = await getDoc(oldDocRef);
          if (oldDocSnap.exists()) {
            const data = oldDocSnap.data();
            await setDoc(doc(db, 'users', email), { ...data, email: email, name: nombre });
            await deleteDoc(oldDocRef);
          }
          alert("✅ Email actualizado. Por favor inicia sesión nuevamente.");
        } else {
           alert("✅ Configuración guardada.");
        }
      } catch (error) {
        console.error("Error updating profile:", error);
        if (error.code === 'auth/requires-recent-login') {
          alert("⚠️ Para cambiar el email, necesitas haber iniciado sesión recientemente. Por favor sal y vuelve a entrar.");
        } else {
          alert("❌ Error al actualizar perfil: " + error.message);
        }
        return; // Stop here if error
      }
    }

    // Request permission if not granted
    if ((alertaIda || recordatorioVuelta) && Notification.permission !== 'granted') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification("✅ Notificaciones activadas");
        }
      });
    }

    onClose();
  };

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow-lg border-0" style={{ borderRadius: '15px' }}>
          <div className="modal-header bg-primary text-white" style={{ borderTopLeftRadius: '15px', borderTopRightRadius: '15px' }}>
            <h5 className="modal-title">🔔 Configuración de Alertas</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4">
            
            {/* Profile Section */}
            <div className="mb-4 border-bottom pb-4">
              <h6 className="fw-bold text-primary mb-3">👤 Mi Perfil</h6>
              <div className="mb-3">
                <label className="form-label small text-muted">Nombre</label>
                <input 
                  type="text" 
                  className="form-control rounded-pill" 
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label small text-muted">Email</label>
                <input 
                  type="email" 
                  className="form-control rounded-pill" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="form-check form-switch mb-2">
                <input 
                  className="form-check-input" 
                  type="checkbox" 
                  id="idaSwitch"
                  checked={alertaIda}
                  onChange={(e) => setAlertaIda(e.target.checked)}
                />
                <label className="form-check-label fw-bold" htmlFor="idaSwitch">
                  ⏰ Alerta de Parada (Ida)
                </label>
              </div>
              
              {alertaIda && (
                <div className="ms-4 animate__animated animate__fadeIn">
                  <p className="text-muted small mb-2">¿Cuántos minutos antes de tu parada quieres que te avise?</p>
                  <div className="input-group">
                    <input 
                      type="number" 
                      className="form-control" 
                      value={minutos} 
                      onChange={(e) => setMinutos(e.target.value)}
                      min="1" 
                      max="60"
                    />
                    <span className="input-group-text">minutos antes</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-3">
              <div className="form-check form-switch">
                <input 
                  className="form-check-input" 
                  type="checkbox" 
                  id="vueltaSwitch"
                  checked={recordatorioVuelta}
                  onChange={(e) => setRecordatorioVuelta(e.target.checked)}
                />
                <label className="form-check-label fw-bold" htmlFor="vueltaSwitch">
                  🔙 Recordatorio de Vuelta
                </label>
              </div>
              <p className="text-muted small mt-1">
                Te avisará a las 16:45 si fuiste a la ida pero olvidaste registrar tu vuelta.
              </p>
            </div>

          </div>
          <div className="modal-footer border-0">
            <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn btn-primary rounded-pill px-4" onClick={handleSave}>Guardar</button>
            {/* Debug Section */}
            <div className="mt-4 pt-3 border-top">
              <h6 className="fw-bold text-danger mb-2">🐞 Zona de Debug</h6>
              <div className="small text-muted mb-2">
                Permiso: <strong>{Notification.permission}</strong>
              </div>
              <div className="d-flex gap-2">
                <button 
                  className="btn btn-outline-secondary btn-sm"
                  onClick={async () => {
                    try {
                      const token = await getToken(messaging, { vapidKey: "IloSmezI9GJwGyaaS4jnuAm1BgOtV6fd4a8AGNiZ-MU" });
                      navigator.clipboard.writeText(token);
                      alert("Token copiado al portapapeles: " + token.substring(0, 10) + "...");
                    } catch (e) {
                      alert("Error obteniendo token: " + e.message);
                    }
                  }}
                >
                  🔑 Copiar Token
                </button>
                <button 
                  className="btn btn-outline-info btn-sm"
                  onClick={() => {
                    new Notification("Prueba Local", { body: "Si ves esto, los permisos están bien." });
                  }}
                >
                  🔔 Test Local
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default Configuracion;
