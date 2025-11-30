import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, addDoc, deleteDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import { db, functions } from '../firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { STOPS_IDA, STOPS_VUELTA } from '../constants';

function AdminPanel({ user, onClose }) {
  const [stopsIda, setStopsIda] = useState([]);
  const [stopsVuelta, setStopsVuelta] = useState([]);
  const [activeTab, setActiveTab] = useState('ida');
  
  const [newName, setNewName] = useState('');
  const [newHours, setNewHours] = useState('08');
  const [newMinutes, setNewMinutes] = useState('00');
  
  const [usersList, setUsersList] = useState([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  
  const [editingUser, setEditingUser] = useState(null); // { email, name, isAdmin, originalEmail }
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStops();
    fetchUsers();
  }, []);

  const parseStops = (data) => {
    return data.map(stop => {
      if (typeof stop === 'string') {
        // Try to parse "Name (Time)"
        const match = stop.match(/^(.*) \((.*)\)$/);
        if (match) {
          return { name: match[1], time: match[2] };
        }
        return { name: stop, time: '' };
      }
      return stop; // Already an object
    });
  };

  const sortStops = (stops) => {
    return [...stops].sort((a, b) => a.time.localeCompare(b.time));
  };

  const fetchStops = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, 'config', 'stops');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setStopsIda(sortStops(parseStops(data.ida || [])));
        setStopsVuelta(sortStops(parseStops(data.vuelta || [])));
      } else {
        // Initialize with defaults if not exists
        const initialIda = sortStops(parseStops(STOPS_IDA));
        const initialVuelta = sortStops(parseStops(STOPS_VUELTA));
        
        await setDoc(docRef, {
          ida: initialIda,
          vuelta: initialVuelta
        });
        setStopsIda(initialIda);
        setStopsVuelta(initialVuelta);
      }
    } catch (error) {
      console.error("Error fetching stops:", error);
    }
    setLoading(false);
  };

  const fetchUsers = async () => {
    try {
      console.log("Fetching users...");
      const querySnapshot = await getDocs(collection(db, 'users'));
      const users = [];
      querySnapshot.forEach((doc) => {
        users.push(doc.data());
      });
      console.log("Fetched users:", users);
      setUsersList(users);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleSave = async () => {
    try {
      const sortedIda = sortStops(stopsIda);
      const sortedVuelta = sortStops(stopsVuelta);
      
      // Update local state to reflect sorted order immediately
      setStopsIda(sortedIda);
      setStopsVuelta(sortedVuelta);

      await setDoc(doc(db, 'config', 'stops'), {
        ida: sortedIda,
        vuelta: sortedVuelta
      });
      alert("✅ Cambios guardados y ordenados correctamente.");
    } catch (error) {
      console.error("Error saving stops:", error);
      alert("❌ Error al guardar.");
    }
  };

  const handleAddStop = () => {
    const newStopObj = { 
      name: newName, 
      time: `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}` 
    };
    
    if (activeTab === 'ida') {
      setStopsIda(sortStops([...stopsIda, newStopObj]));
    } else {
      setStopsVuelta(sortStops([...stopsVuelta, newStopObj]));
    }
    setNewName('');
    setNewHours('08');
    setNewMinutes('00');
  };

  const handleDeleteStop = (index) => {
    if (window.confirm("¿Seguro que quieres eliminar esta parada?")) {
      if (activeTab === 'ida') {
        const newStops = [...stopsIda];
        newStops.splice(index, 1);
        setStopsIda(newStops);
      } else {
        const newStops = [...stopsVuelta];
        newStops.splice(index, 1);
        setStopsVuelta(newStops);
      }
    }
  };

  const handleEditStop = (index, field, value) => {
    if (activeTab === 'ida') {
      const newStops = [...stopsIda];
      newStops[index] = { ...newStops[index], [field]: value };
      setStopsIda(newStops);
    } else {
      const newStops = [...stopsVuelta];
      newStops[index] = { ...newStops[index], [field]: value };
      setStopsVuelta(newStops);
    }
  };

  const handleTimeChange = (index, type, value) => {
    const list = activeTab === 'ida' ? stopsIda : stopsVuelta;
    const currentStop = list[index];
    let [h, m] = (currentStop.time || '00:00').split(':');
    
    if (type === 'h') h = value.toString().padStart(2, '0');
    if (type === 'm') m = value.toString().padStart(2, '0');

    handleEditStop(index, 'time', `${h}:${m}`);
  };

  const handleAddUser = async () => {
    if (!newUserEmail.trim()) return;
    const emailLower = newUserEmail.trim().toLowerCase();
    try {
      await setDoc(doc(db, 'users', emailLower), {
        email: emailLower,
        name: newUserName.trim(),
        addedAt: serverTimestamp()
      });
      setNewUserEmail('');
      setNewUserName('');
      await fetchUsers(); 
      alert("✅ Usuario agregado.");
    } catch (error) {
      console.error("Error adding user:", error);
      alert("❌ Error al agregar usuario.");
    }
  };

  const startEditUser = (user) => {
    setEditingUser({ ...user, originalEmail: user.email });
    setEditName(user.name || '');
    setEditEmail(user.email);
  };

  const saveEditUser = async () => {
    if (!editingUser || !editEmail.trim()) return;
    const newEmailLower = editEmail.trim().toLowerCase();
    
    try {
      // If email changed, we need to move the document
      if (newEmailLower !== editingUser.originalEmail) {
        // 1. Create new doc
        await setDoc(doc(db, 'users', newEmailLower), {
          ...editingUser,
          email: newEmailLower,
          name: editName.trim(),
          isAdmin: editingUser.isAdmin || false
        });
        // 2. Delete old doc
        await deleteDoc(doc(db, 'users', editingUser.originalEmail));
      } else {
        // Just update
        await setDoc(doc(db, 'users', editingUser.originalEmail), {
          ...editingUser,
          name: editName.trim()
        }, { merge: true });
      }

      setEditingUser(null);
      await fetchUsers();
      alert("✅ Usuario actualizado.");
    } catch (error) {
      console.error("Error updating user:", error);
      alert("❌ Error al actualizar usuario.");
    }
  };

  const handleDeleteUser = async (email) => {
    if (window.confirm(`¿Eliminar acceso a ${email}?`)) {
      try {
        await deleteDoc(doc(db, 'users', email)); // Email is already from the list, so it matches doc ID
        await fetchUsers();
      } catch (error) {
        console.error("Error deleting user:", error);
        alert("❌ Error al eliminar usuario.");
      }
    }
  };

  const handleToggleAdmin = async (user) => {
    const newStatus = !user.isAdmin;
    const confirmMsg = newStatus 
      ? `¿Hacer ADMIN a ${user.email}?` 
      : `¿Quitar permisos de ADMIN a ${user.email}?`;
      
    if (window.confirm(confirmMsg)) {
      try {
        await setDoc(doc(db, 'users', user.email), {
          ...user,
          isAdmin: newStatus
        });
        await fetchUsers();
      } catch (error) {
        console.error("Error toggling admin:", error);
        alert("❌ Error al cambiar permisos.");
      }
    }
  };

  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');

  const handleNotifyClick = () => {
    setShowNotifyModal(true);
    setNotifyMessage('');
  };

  const confirmNotify = async () => {
    if (!notifyMessage.trim()) return;

    try {
      // 1. Save to Chat (History)
      await addDoc(collection(db, 'chat_messages'), {
        text: `📢 ADMIN: ${notifyMessage}`,
          sender: 'Admin',
          timestamp: serverTimestamp(),
          isAdmin: true
        });

        // 2. Send Push Notification (Cloud Run Service)
        // Note: In production, use the deployed Cloud Run URL.
        // For local testing, we use localhost:8080.
        const SERVICE_URL = 'http://localhost:8080/send-broadcast';
        
        const idToken = await user.getIdToken();
        
        const response = await fetch(SERVICE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            title: "📢 Aviso de CombiApp",
            body: notifyMessage
          })
        });

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Error sending notification');
        }
        
        console.log("Notification result:", result);
        alert(`✅ Notificación enviada. (Éxito: ${result.sentCount})`);
        setShowNotifyModal(false);

      } catch (error) {
        console.error("Error sending notification:", error);
        alert("❌ Error al enviar notificación: " + error.message);
      }
  };

  const currentStops = activeTab === 'ida' ? stopsIda : stopsVuelta;

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content shadow-lg border-0" style={{ borderRadius: '15px' }}>
          <div className="modal-header bg-dark text-white" style={{ borderTopLeftRadius: '15px', borderTopRightRadius: '15px' }}>
            <h5 className="modal-title">🛠️ Panel de Administración</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4">
            
            <ul className="nav nav-pills mb-3 justify-content-center">
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeTab === 'ida' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('ida')}
                >
                  🌅 Ida
                </button>
              </li>
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeTab === 'vuelta' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('vuelta')}
                >
                  🌇 Vuelta
                </button>
              </li>
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeTab === 'usuarios' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('usuarios')}
                >
                  👥 Usuarios
                </button>
              </li>
            </ul>

            {loading ? (
              <div className="text-center"><div className="spinner-border text-primary"></div></div>
            ) : activeTab === 'usuarios' ? (
              <div>
                {/* Add User Form */}
                <div className="card p-3 mb-3 bg-light border-0">
                  <h6 className="mb-2">Agregar Nuevo Usuario</h6>
                  <div className="row g-2">
                    <div className="col-md-5">
                      <input 
                        type="text" 
                        className="form-control form-control-sm" 
                        placeholder="Nombre (Opcional)" 
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                      />
                    </div>
                    <div className="col-md-5">
                      <input 
                        type="email" 
                        className="form-control form-control-sm" 
                        placeholder="Email" 
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                      />
                    </div>
                    <div className="col-md-2">
                      <button className="btn btn-success btn-sm w-100" onClick={handleAddUser}>Agregar</button>
                    </div>
                  </div>
                </div>

                {/* Edit User Modal/Overlay */}
                {editingUser && (
                  <div className="card p-3 mb-3 border-primary shadow-sm">
                    <h6 className="mb-2 text-primary">Editar Usuario</h6>
                    <div className="mb-2">
                      <label className="small text-muted">Nombre</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </div>
                    <div className="mb-2">
                      <label className="small text-muted">Email</label>
                      <input 
                        type="email" 
                        className="form-control" 
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                      />
                    </div>
                    <div className="d-flex justify-content-end gap-2">
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingUser(null)}>Cancelar</button>
                      <button className="btn btn-primary btn-sm" onClick={saveEditUser}>Guardar</button>
                    </div>
                  </div>
                )}

                <div className="list-group" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {usersList.map((u, i) => (
                    <div key={i} className="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-bold">{u.name || 'Sin Nombre'}</div>
                        <div className="small text-muted">{u.email}</div>
                        {u.isAdmin && <span className="badge bg-warning text-dark mt-1">ADMIN</span>}
                      </div>
                      <div className="d-flex gap-2 flex-column flex-sm-row">
                        <button className="btn btn-outline-primary btn-sm" onClick={() => startEditUser(u)}>✏️</button>
                        <button 
                          className={`btn btn-sm ${u.isAdmin ? 'btn-outline-secondary' : 'btn-outline-warning'}`}
                          onClick={() => handleToggleAdmin(u)}
                          title={u.isAdmin ? "Quitar Admin" : "Hacer Admin"}
                        >
                          {u.isAdmin ? '👮‍♂️' : '⭐'}
                        </button>
                        <button className="btn btn-outline-danger btn-sm" onClick={() => handleDeleteUser(u.email)}>🗑️</button>
                      </div>
                    </div>
                  ))}
                  {usersList.length === 0 && <div className="text-muted text-center p-3">No hay usuarios registrados.</div>}
                </div>
              </div>
            ) : (
              <div className="list-group mb-3" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {currentStops.map((stop, index) => {
                  const [h, m] = (stop.time || '00:00').split(':');
                  return (
                    <div key={index} className="list-group-item d-flex align-items-center gap-2">
                      <div className="flex-grow-1">
                          <input 
                          type="text" 
                          className="form-control form-control-sm mb-1 fw-bold" 
                          placeholder="Nombre de parada"
                          value={stop.name} 
                          onChange={(e) => handleEditStop(index, 'name', e.target.value)}
                          />
                          <div className="d-flex align-items-center gap-1">
                            <input 
                              type="number" 
                              min="0" max="23"
                              className="form-control form-control-sm text-center" 
                              style={{ width: '60px' }}
                              value={parseInt(h)} 
                              onChange={(e) => handleTimeChange(index, 'h', e.target.value)}
                            />
                            <span>:</span>
                            <input 
                              type="number" 
                              min="0" max="59"
                              className="form-control form-control-sm text-center" 
                              style={{ width: '60px' }}
                              value={parseInt(m)} 
                              onChange={(e) => handleTimeChange(index, 'm', e.target.value)}
                            />
                            <span className="text-muted small ms-1">hs</span>
                          </div>
                      </div>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => handleDeleteStop(index)}>🗑️</button>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab !== 'usuarios' && (
            <div className="card bg-light p-3">
                <h6 className="mb-2">Agregar Nueva Parada</h6>
                <div className="row g-2">
                    <div className="col-6">
                        <input 
                            type="text" 
                            className="form-control" 
                            placeholder="Nombre..." 
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                        />
                    </div>
                    <div className="col-4 d-flex align-items-center gap-1">
                        <input 
                            type="number" 
                            min="0" max="23"
                            className="form-control text-center px-1" 
                            placeholder="HH"
                            value={newHours}
                            onChange={(e) => setNewHours(e.target.value)}
                        />
                        <span>:</span>
                        <input 
                            type="number" 
                            min="0" max="59"
                            className="form-control text-center px-1" 
                            placeholder="MM"
                            value={newMinutes}
                            onChange={(e) => setNewMinutes(e.target.value)}
                        />
                    </div>
                    <div className="col-2">
                        <button className="btn btn-success w-100" onClick={handleAddStop}>➕</button>
                    </div>
                </div>
            </div>
            )}

            {/* Notification Modal Overlay */}
            {showNotifyModal && (
              <div className="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1050, borderRadius: '15px' }}>
                <div className="card p-4 shadow-lg" style={{ width: '80%' }}>
                  <h5 className="mb-3">📢 Enviar Notificación</h5>
                  <textarea 
                    className="form-control mb-3" 
                    rows="3" 
                    placeholder="Escribe el mensaje para todos los usuarios..."
                    value={notifyMessage}
                    onChange={(e) => setNotifyMessage(e.target.value)}
                  ></textarea>
                  <div className="d-flex justify-content-end gap-2">
                    <button className="btn btn-secondary" onClick={() => setShowNotifyModal(false)}>Cancelar</button>
                    <button className="btn btn-primary" onClick={confirmNotify}>Enviar</button>
                  </div>
                </div>
              </div>
            )}

          </div>
          <div className="modal-footer border-0 justify-content-between">
            {activeTab !== 'usuarios' ? (
              <button type="button" className="btn btn-warning" onClick={handleNotifyClick}>📢 Notificar Cambios</button>
            ) : <div></div>}
            <div>
              <button type="button" className="btn btn-secondary me-2" onClick={onClose}>Cancelar</button>
              {activeTab !== 'usuarios' && <button type="button" className="btn btn-primary" onClick={handleSave}>Guardar Cambios</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
