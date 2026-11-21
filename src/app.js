import { createClient } from '@supabase/supabase-js';

const config = import.meta.env;
const supabaseUrl = config.VITE_SUPABASE_URL?.trim();
const supabaseKey = config.VITE_SUPABASE_ANON_KEY?.trim();
const authRedirectUrl = () => new URL(import.meta.env.BASE_URL, window.location.origin).href;
const hasSafePublicKey = !!supabaseKey && !supabaseKey.startsWith('sb_secret_');
const supabase = supabaseUrl && hasSafePublicKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    })
  : null;

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const formatDate = (value, options = {}) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-MX', options);
};
const formatDateOnly = (value) => {
  if (!value) return '—';
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '—';
  return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
};
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || '?';
const bmiLabel = (value) => {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
  if (value < 18.5) return 'Bajo peso';
  if (value < 25) return 'Normal';
  if (value < 30) return 'Sobrepeso';
  return 'Obesidad';
};
const friendlyError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('invalid api key') || message.includes('invalid api_key') || message.includes('no apikey found')) {
    return 'La clave pública y la URL parecen ser de proyectos distintos. Confirma que ambas sean del mismo proyecto Supabase.';
  }
  if (message.includes('schema cache') || message.includes('relation "public.profiles" does not exist') || message.includes('could not find the table')) {
    return 'Falta instalar el esquema de NutriSalud+. Ejecuta supabase/schema.sql en el SQL Editor del mismo proyecto.';
  }
  if (message.includes('0 rows') || message.includes('multiple (or no) rows')) {
    return 'La cuenta no tiene perfil en NutriSalud+. Confirma que supabase/schema.sql se ejecutó correctamente.';
  }
  if (message.includes('invalid login credentials')) return 'El correo o la contraseña no coinciden.';
  if (message.includes('email not confirmed')) return 'Confirma tu correo desde el enlace que te enviamos.';
  if (message.includes('user already registered')) return 'Ya existe una cuenta con ese correo. Inicia sesión.';
  if (message.includes('password should be at least')) return 'La contraseña debe tener al menos 8 caracteres.';
  if (message.includes('failed to fetch') || message.includes('network') || message.includes('fetch failed')) {
    return 'No se pudo conectar con Supabase. Revisa tu conexión y que la URL del proyecto y la clave pública pertenezcan al mismo proyecto.';
  }
  return error?.message || 'Ocurrió un error. Inténtalo de nuevo.';
};

let currentUser = null;
let currentProfile = null;
let authMode = 'register';
let toastTimer;

function notify(message, type = 'error') {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 5200);
}

function setAuthMessage(message, type = 'error') {
  const alert = $('#authAlert');
  alert.textContent = message;
  alert.className = `alert alert-${type}`;
  alert.classList.remove('hidden');
}

function ensureConfigured() {
  if (supabase) return true;
  const notice = $('#configNotice');
  notice?.classList.remove('hidden');
  if (supabaseKey?.startsWith('sb_secret_')) {
    if (notice) notice.textContent = 'Falta configurar una clave pública de Supabase. La clave secreta del servidor no debe usarse en esta página.';
  } else if (!supabaseUrl) {
    if (notice) notice.textContent = 'Falta configurar la URL de Supabase en .env.local para activar las cuentas y el guardado de datos.';
  } else if (notice) {
    notice.textContent = 'Agrega la clave pública Publishable o anon de Supabase a .env.local para activar las cuentas y el guardado de datos.';
  }
  return false;
}

function localDateTime(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function openModal(mode) {
  authMode = mode;
  const login = mode === 'login';
  $('#modalTitle').textContent = login ? 'Qué gusto verte de nuevo' : 'Comienza tu seguimiento';
  $('#modalSubtitle').textContent = login
    ? 'Inicia sesión para continuar con tu expediente.'
    : 'Crea tu acceso personal en menos de un minuto.';
  $('#submitLabel').textContent = login ? 'Iniciar sesión' : 'Crear mi cuenta';
  $('#nameField').classList.toggle('hidden', login);
  $('#forgotPassword').classList.toggle('hidden', !login);
  $('#password').autocomplete = login ? 'current-password' : 'new-password';
  $('#password').placeholder = login ? 'Tu contraseña' : 'Al menos 8 caracteres';
  $('#authAlert').classList.add('hidden');
  $('#formView').classList.remove('hidden');
  $('#resetView').classList.add('hidden');
  $('#successView').classList.remove('show');
  $('#modal').classList.add('show');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => $(login ? '#email' : '#name').focus());
}

function closeModal() {
  $('#modal').classList.remove('show');
  document.body.style.overflow = '';
}

function showAuthSuccess(title, message) {
  $('#successTitle').textContent = title;
  $('#successMsg').textContent = message;
  $('#formView').classList.add('hidden');
  $('#successView').classList.add('show');
}

function setAppVisible(visible) {
  $('#app').classList.toggle('hidden', !visible);
  $('#landing').classList.toggle('hidden', visible);
  $('#botLaunch').classList.toggle('hidden', visible);
  $$('.install-app-button, #installApp').forEach((button) => button.classList.toggle('hidden', visible));
  if (visible) $('#appointmentBot').classList.add('hidden');
  if (!visible) {
    $('#patientPanel').classList.add('hidden');
    $('#adminPanel').classList.add('hidden');
  }
}

async function getProfile(user) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error) throw error;
  return data;
}

async function loadUserAndPanel(user) {
  if (!user) {
    currentUser = null;
    currentProfile = null;
    setAppVisible(false);
    return;
  }
  try {
    currentUser = user;
    currentProfile = await getProfile(user);
    $('#userName').textContent = currentProfile.full_name || user.email;
    $('#userEmail').textContent = user.email || '';
    $('#userAvatar').textContent = initials(currentProfile.full_name || user.email);
    const admin = currentProfile.role === 'admin';
    $('#roleTag').textContent = admin ? 'Equipo' : 'Paciente';
    $('#roleTag').className = `role-tag ${admin ? 'admin' : 'patient'}`;
    $('#roleSubtitle').textContent = admin ? 'Panel profesional' : 'Mi seguimiento';
    setAppVisible(true);
    $('#patientPanel').classList.toggle('hidden', admin);
    $('#adminPanel').classList.toggle('hidden', !admin);
    if (admin) await loadAdminPanel();
    else await loadPatientPanel();
  } catch (error) {
    setAppVisible(false);
    notify(friendlyError(error));
    console.error('No se pudo cargar el perfil autenticado.', error);
  }
}

async function authSubmit(event) {
  event.preventDefault();
  if (!ensureConfigured()) {
    setAuthMessage('La conexión segura aún no está configurada. Agrega la clave pública de Supabase y vuelve a intentarlo.');
    return;
  }
  const button = $('#submitBtn');
  const label = $('#submitLabel');
  const email = $('#email').value.trim().toLowerCase();
  const password = $('#password').value;
  button.disabled = true;
  label.textContent = authMode === 'login' ? 'Verificando…' : 'Creando cuenta…';
  $('#authAlert').classList.add('hidden');
  try {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Escribe un correo electrónico válido.');
    if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
    if (authMode === 'register') {
      const fullName = $('#name').value.trim();
      if (fullName.length < 2) throw new Error('Escribe tu nombre completo.');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          // Send confirmation links back to the site currently hosting the app.
          emailRedirectTo: authRedirectUrl()
        }
      });
      if (error) throw error;
      if (!data.session) {
        showAuthSuccess('Revisa tu correo', 'Te enviamos un enlace para confirmar la cuenta. Después podrás iniciar sesión.');
      } else {
        closeModal();
        await loadUserAndPanel(data.user);
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      closeModal();
      await loadUserAndPanel(data.user);
    }
  } catch (error) {
    setAuthMessage(friendlyError(error));
  } finally {
    button.disabled = false;
    label.textContent = authMode === 'login' ? 'Iniciar sesión' : 'Crear mi cuenta';
  }
}

async function sendPasswordReset() {
  if (!ensureConfigured()) {
    setAuthMessage('La conexión segura aún no está configurada.');
    return;
  }
  const email = $('#email').value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setAuthMessage('Escribe tu correo arriba para enviarte el enlace de recuperación.');
    return;
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() });
  if (error) setAuthMessage(friendlyError(error));
  else setAuthMessage('Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.', 'ok');
}

async function saveNewPassword(event) {
  event.preventDefault();
  const alert = $('#resetAlert');
  const button = $('#resetSubmit');
  const password = $('#newPassword').value;
  alert.classList.add('hidden');
  if (password.length < 8) {
    alert.textContent = 'La contraseña debe tener al menos 8 caracteres.';
    alert.className = 'alert alert-error';
    return;
  }
  button.disabled = true;
  try {
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    closeModal();
    await loadUserAndPanel(data.user);
    notify('Contraseña actualizada.', 'ok');
  } catch (error) {
    alert.textContent = friendlyError(error);
    alert.className = 'alert alert-error';
  } finally {
    button.disabled = false;
  }
}

async function loadPatientPanel() {
  if (!currentUser || !currentProfile) return;
  $('#pGreet').textContent = (currentProfile.full_name || 'hola').split(' ')[0];
  $('#pProfile').innerHTML = `
    <div class="data-item"><span>Nombre</span><b>${esc(currentProfile.full_name || '—')}</b></div>
    <div class="data-item"><span>Correo</span><b>${esc(currentUser.email || '—')}</b></div>
    <div class="data-item"><span>Teléfono</span><b>${esc(currentProfile.phone || '—')}</b></div>
    <div class="data-item"><span>Fecha de nacimiento</span><b>${formatDateOnly(currentProfile.birth_date)}</b></div>
    <div class="data-item"><span>Estatura</span><b>${currentProfile.height_cm ? `${esc(currentProfile.height_cm)} cm` : '—'}</b></div>
    <div class="data-item"><span>Mi objetivo</span><b>${esc(currentProfile.nutritional_goal || '—')}</b></div>`;
  $('#mHeight').value = currentProfile.height_cm ?? '';
  $('#eName').value = currentProfile.full_name || '';
  $('#eBirth').value = currentProfile.birth_date || '';
  $('#ePhone').value = currentProfile.phone || '';
  $('#eGoal').value = currentProfile.nutritional_goal || '';
  $('#eBirth').max = localDateTime(new Date()).slice(0, 10);
  await Promise.all([loadPatientMeasurements(), loadPatientAppointments()]);
}

async function loadPatientMeasurements() {
  const { data, error } = await supabase.from('measurements').select('*')
    .eq('patient_id', currentUser.id).order('measured_at', { ascending: false });
  if (error) throw error;
  const measurements = data || [];
  $('#pCount').textContent = measurements.length;
  const latestWeight = measurements.find((item) => item.weight_kg !== null);
  const latestBmi = measurements.find((item) => item.bmi !== null);
  const latestPressure = measurements.find((item) => item.systolic !== null && item.diastolic !== null);
  $('#pWeight').textContent = latestWeight?.weight_kg ?? '—';
  $('#pBmi').textContent = latestBmi?.bmi ?? '—';
  $('#pBmiLabel').textContent = bmiLabel(latestBmi?.bmi);
  $('#pBp').textContent = latestPressure ? `${latestPressure.systolic}/${latestPressure.diastolic}` : '—';
  $('#pMeasureTable').innerHTML = measurements.length ? measurements.slice(0, 30).map((item) => `
    <tr><td>${formatDate(item.measured_at, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
    <td>${item.weight_kg ?? '—'}</td><td>${item.bmi ?? '—'}</td>
    <td>${item.systolic && item.diastolic ? `${item.systolic}/${item.diastolic}` : '—'}</td>
    <td>${item.heart_rate ?? '—'}</td></tr>`).join('')
    : '<tr><td colspan="5" class="empty">Aún no hay mediciones. Registra la primera para comenzar tu historial.</td></tr>';
  const weights = measurements.filter((item) => item.weight_kg !== null).reverse();
  $('#pChart').innerHTML = weights.length > 1
    ? buildChart(weights, 'weight_kg', '#16836f')
    : '<div class="empty">Tu gráfica aparecerá después de registrar al menos dos pesos.</div>';
}

async function loadPatientAppointments() {
  const { data, error } = await supabase.from('appointments').select('*')
    .eq('patient_id', currentUser.id).order('scheduled_at', { ascending: false });
  if (error) throw error;
  const appointments = data || [];
  const tbody = $('#pApptTable');
  if (!appointments.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">Aún no tienes citas solicitadas.</td></tr>';
    return;
  }
  tbody.innerHTML = appointments.map((item) => `
    <tr><td>${formatDate(item.scheduled_at, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
    <td>${esc(item.reason)}</td><td><span class="tag ${esc(item.status)}">${esc(item.status)}</span></td>
    <td>${['pendiente', 'confirmada'].includes(item.status) ? `<button type="button" class="btn btn-danger btn-sm" data-cancel-appt="${esc(item.id)}">Cancelar</button>` : '—'}</td></tr>`).join('');
  tbody.querySelectorAll('[data-cancel-appt]').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm('¿Quieres cancelar esta cita?')) return;
    const { error: updateError } = await supabase.from('appointments').update({ status: 'cancelada' })
      .eq('id', button.dataset.cancelAppt).eq('patient_id', currentUser.id);
    if (updateError) notify(friendlyError(updateError));
    else { notify('Cita cancelada.', 'ok'); await loadPatientAppointments(); }
  }));
}

async function saveMeasurement(event) {
  event.preventDefault();
  const alert = $('#mAlert');
  alert.classList.add('hidden');
  const weight = Number($('#mWeight').value) || null;
  const height = Number($('#mHeight').value) || null;
  const systolic = Number($('#mSys').value) || null;
  const diastolic = Number($('#mDia').value) || null;
  const heartRate = Number($('#mHr').value) || null;
  if ((systolic && !diastolic) || (!systolic && diastolic)) {
    alert.textContent = 'Para registrar la presión, completa sistólica y diastólica.';
    alert.className = 'alert alert-error';
    return;
  }
  if (!weight && !(systolic && diastolic)) {
    alert.textContent = 'Captura un peso o ambos valores de presión arterial.';
    alert.className = 'alert alert-error';
    return;
  }
  const bmi = weight && height ? Number((weight / ((height / 100) ** 2)).toFixed(1)) : null;
  const { error } = await supabase.from('measurements').insert({
    patient_id: currentUser.id, weight_kg: weight, height_cm: height,
    bmi, systolic, diastolic, heart_rate: heartRate
  });
  if (error) {
    alert.textContent = friendlyError(error);
    alert.className = 'alert alert-error';
    return;
  }
  $('#mWeight').value = '';
  $('#mSys').value = '';
  $('#mDia').value = '';
  $('#mHr').value = '';
  alert.textContent = 'Medición guardada en tu historial.';
  alert.className = 'alert alert-ok';
  await loadPatientPanel();
}

async function requestAppointment(event) {
  event.preventDefault();
  const alert = $('#aAlert');
  alert.classList.add('hidden');
  const value = $('#aDatetime').value;
  const reason = $('#aReason').value.trim();
  const scheduledAt = new Date(value);
  if (!value || !reason) return;
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    alert.textContent = 'Elige una fecha y hora futuras.';
    alert.className = 'alert alert-error';
    return;
  }
  const { error } = await supabase.from('appointments').insert({
    patient_id: currentUser.id, scheduled_at: scheduledAt.toISOString(), reason
  });
  if (error) {
    alert.textContent = friendlyError(error);
    alert.className = 'alert alert-error';
    return;
  }
  $('#aDatetime').value = '';
  $('#aReason').value = '';
  alert.textContent = 'Solicitud guardada en Supabase. El consultorio debe confirmar la cita; puedes coordinarlo por WhatsApp desde este panel.';
  alert.className = 'alert alert-ok';
  await loadPatientAppointments();
}

async function saveProfile(event) {
  event.preventDefault();
  const button = $('#editForm button[type="submit"]');
  button.disabled = true;
  const changes = {
    full_name: $('#eName').value.trim(),
    birth_date: $('#eBirth').value || null,
    phone: $('#ePhone').value.trim() || null,
    nutritional_goal: $('#eGoal').value.trim() || null
  };
  try {
    const { error } = await supabase.from('profiles').update(changes).eq('id', currentUser.id);
    if (error) throw error;
    currentProfile = { ...currentProfile, ...changes };
    $('#editModal').classList.remove('show');
    await loadUserAndPanel(currentUser);
    notify('Perfil actualizado.', 'ok');
  } catch (error) {
    $('#editAlert').textContent = friendlyError(error);
    $('#editAlert').className = 'alert alert-error';
  } finally {
    button.disabled = false;
  }
}

async function loadAdminPanel() {
  const [profilesResult, measurementsResult, appointmentsResult] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('measurements').select('*').order('measured_at', { ascending: false }),
    supabase.from('appointments').select('*').order('scheduled_at', { ascending: false })
  ]);
  const error = profilesResult.error || measurementsResult.error || appointmentsResult.error;
  if (error) throw error;
  const profiles = profilesResult.data || [];
  const measurements = measurementsResult.data || [];
  const appointments = appointmentsResult.data || [];
  const patients = profiles.filter((profile) => profile.role !== 'admin');
  $('#aPatients').textContent = patients.length;
  $('#aMeasures').textContent = measurements.length;
  $('#aPending').textContent = appointments.filter((item) => item.status === 'pendiente').length;
  $('#aConfirmed').textContent = appointments.filter((item) => item.status === 'confirmada').length;
  renderAdminPatients(patients, measurements);
  renderAdminAppointments(appointments, profiles);
}

function renderAdminPatients(profiles, measurements) {
  const query = ($('#aSearch').value || '').toLowerCase().trim();
  const filtered = profiles.filter((profile) => !query
    || (profile.full_name || '').toLowerCase().includes(query)
    || (profile.email || '').toLowerCase().includes(query));
  const tbody = $('#aPatientTable');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty">No hay pacientes que coincidan con la búsqueda.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map((profile) => {
    const records = measurements.filter((item) => item.patient_id === profile.id);
    const latestWeight = records.find((item) => item.weight_kg !== null);
    const latestBmi = records.find((item) => item.bmi !== null);
    const latestPressure = records.find((item) => item.systolic && item.diastolic);
    return `<tr><td><b>${esc(profile.full_name || 'Sin nombre')}</b><br><small>${esc(profile.email)}</small></td>
      <td>${esc(profile.email)}</td><td>${latestWeight?.weight_kg ?? '—'}</td>
      <td>${profile.height_cm ?? '—'}</td><td>${latestBmi?.bmi ?? '—'}</td>
      <td>${latestPressure ? `${latestPressure.systolic}/${latestPressure.diastolic}` : '—'}</td>
      <td>${records.length}</td><td>${formatDate(profile.created_at, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
      <td><button type="button" class="btn btn-ghost btn-sm" data-open-patient="${esc(profile.id)}">Ver expediente</button></td></tr>`;
  }).join('');
  tbody.querySelectorAll('[data-open-patient]').forEach((button) => button.addEventListener('click', () => openPatientModal(button.dataset.openPatient)));
}

function renderAdminAppointments(appointments, profiles) {
  const tbody = $('#aApptTable');
  if (!appointments.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">No hay citas registradas.</td></tr>';
    return;
  }
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  tbody.innerHTML = appointments.map((item) => {
    const patient = profileById.get(item.patient_id);
    let actions = '—';
    if (item.status === 'pendiente') actions = `<button type="button" class="btn btn-ok btn-sm" data-appt="${esc(item.id)}" data-status="confirmada">Confirmar</button> <button type="button" class="btn btn-danger btn-sm" data-appt="${esc(item.id)}" data-status="rechazada">Rechazar</button>`;
    if (item.status === 'confirmada') actions = `<button type="button" class="btn btn-danger btn-sm" data-appt="${esc(item.id)}" data-status="cancelada">Cancelar</button>`;
    return `<tr><td>${formatDate(item.scheduled_at, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
      <td>${esc(patient?.full_name || patient?.email || '—')}</td><td>${esc(item.reason)}</td>
      <td><span class="tag ${esc(item.status)}">${esc(item.status)}</span></td><td>${actions}</td></tr>`;
  }).join('');
  tbody.querySelectorAll('[data-appt]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    const { error } = await supabase.from('appointments').update({ status: button.dataset.status }).eq('id', button.dataset.appt);
    if (error) notify(friendlyError(error));
    else { notify(`Cita ${button.dataset.status}.`, 'ok'); await loadAdminPanel(); }
  }));
}

async function openPatientModal(patientId) {
  try {
    const [profileResult, measurementsResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', patientId).single(),
      supabase.from('measurements').select('*').eq('patient_id', patientId).order('measured_at', { ascending: false })
    ]);
    if (profileResult.error) throw profileResult.error;
    if (measurementsResult.error) throw measurementsResult.error;
    const profile = profileResult.data;
    $('#pmTitle').textContent = profile.full_name || 'Expediente del paciente';
    $('#pmSubtitle').textContent = profile.email || '';
    $('#pmBody').innerHTML = `<div class="data-list">
      <div class="data-item"><span>Fecha de nacimiento</span><b>${formatDateOnly(profile.birth_date)}</b></div>
      <div class="data-item"><span>Teléfono</span><b>${esc(profile.phone || '—')}</b></div>
      <div class="data-item"><span>Peso más reciente</span><b>${profile.weight_kg ?? '—'} kg</b></div>
      <div class="data-item"><span>Estatura</span><b>${profile.height_cm ?? '—'} cm</b></div>
      <div class="data-item"><span>Objetivo nutricional</span><b>${esc(profile.nutritional_goal || '—')}</b></div>
      <div class="data-item"><span>Registro</span><b>${formatDate(profile.created_at, { day: '2-digit', month: 'short', year: 'numeric' })}</b></div></div>`;
    const measurements = measurementsResult.data || [];
    $('#pmMeasures').innerHTML = measurements.length ? measurements.map((item) => `<tr>
      <td>${formatDate(item.measured_at, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
      <td>${item.weight_kg ?? '—'}</td><td>${item.bmi ?? '—'}</td>
      <td>${item.systolic && item.diastolic ? `${item.systolic}/${item.diastolic}` : '—'}</td><td>${item.heart_rate ?? '—'}</td></tr>`).join('')
      : '<tr><td colspan="5" class="empty">Este paciente aún no tiene mediciones.</td></tr>';
    $('#patientModal').classList.add('show');
  } catch (error) { notify(friendlyError(error)); }
}

function buildChart(items, field, color) {
  const values = items.map((item) => Number(item[field])).filter(Number.isFinite);
  if (values.length < 2) return '';
  const width = 640, height = 210, padding = 32;
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const points = values.map((value, index) => [
    padding + index * (width - padding * 2) / (values.length - 1),
    height - padding - (value - min) / range * (height - padding * 2)
  ]);
  const line = points.map((point) => point.join(',')).join(' ');
  const area = `M${points[0][0]},${height-padding} L${line.replace(/ /g, ' L')} L${points.at(-1)[0]},${height-padding} Z`;
  const labels = items.map((item) => formatDate(item.measured_at, { day: '2-digit', month: 'short' }));
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Gráfica de evolución del peso">
    <defs><linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity=".24"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#weightGradient)"/><polyline points="${line}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${points.map(([x, y], index) => `<circle cx="${x}" cy="${y}" r="4" fill="white" stroke="${color}" stroke-width="2.5"><title>${esc(labels[index])}: ${values[index]} kg</title></circle>`).join('')}
  </svg>`;
}

// Navegación y modales
window.addEventListener('scroll', () => $('#header')?.classList.toggle('scrolled', window.scrollY > 12), { passive: true });
$('#burger').addEventListener('click', () => {
  const open = $('#mobileMenu').classList.toggle('show');
  $('#burger').classList.toggle('open', open);
  $('#burger').setAttribute('aria-expanded', String(open));
});
$$('#mobileMenu a, #mobileMenu button').forEach((element) => element.addEventListener('click', () => {
  $('#mobileMenu').classList.remove('show');
  $('#burger').classList.remove('open');
  $('#burger').setAttribute('aria-expanded', 'false');
}));
document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-open-modal]');
  if (trigger) { event.preventDefault(); openModal(trigger.dataset.openModal); }
});
$('#closeModal').addEventListener('click', closeModal);
$('#modal').addEventListener('click', (event) => { if (event.target === $('#modal')) closeModal(); });
$('#closeEditModal').addEventListener('click', () => $('#editModal').classList.remove('show'));
$('#editModal').addEventListener('click', (event) => { if (event.target === $('#editModal')) $('#editModal').classList.remove('show'); });
$('#closePatientModal').addEventListener('click', () => $('#patientModal').classList.remove('show'));
$('#patientModal').addEventListener('click', (event) => { if (event.target === $('#patientModal')) $('#patientModal').classList.remove('show'); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    $$('.modal.show').forEach((dialog) => dialog.classList.remove('show'));
    document.body.style.overflow = '';
  }
});
const appointmentBot = $('#appointmentBot');
const botLaunch = $('#botLaunch');
function toggleAppointmentBot(open) {
  appointmentBot.classList.toggle('hidden', !open);
  botLaunch.setAttribute('aria-expanded', String(open));
}
botLaunch.addEventListener('click', () => toggleAppointmentBot(appointmentBot.classList.contains('hidden')));
$$('[data-open-bot]').forEach((button) => button.addEventListener('click', () => toggleAppointmentBot(true)));
$('#botNo').addEventListener('click', () => toggleAppointmentBot(false));
$('#appointmentBot [data-open-modal]').addEventListener('click', () => toggleAppointmentBot(false));
$('#appointmentBot a').addEventListener('click', () => toggleAppointmentBot(false));
const installModal = $('#installModal');
const installButtons = $$('.install-app-button, #installApp');
let deferredInstallPrompt = null;
const isInstalledApp = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
function closeInstallModal() {
  installModal.classList.remove('show');
  document.body.style.overflow = '';
}
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  installButtons.forEach((button) => button.classList.add('hidden'));
});
installButtons.forEach((installButton) => installButton.addEventListener('click', async () => {
  if (isInstalledApp()) {
    installButtons.forEach((button) => button.classList.add('hidden'));
    return;
  }
  if (deferredInstallPrompt) {
    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice?.outcome === 'accepted') installButtons.forEach((button) => button.classList.add('hidden'));
    return;
  }
  installModal.classList.add('show');
  document.body.style.overflow = 'hidden';
  $('#closeInstall').focus();
}));
$('#closeInstall').addEventListener('click', closeInstallModal);
installModal.addEventListener('click', (event) => {
  if (event.target === installModal) closeInstallModal();
});
if (isInstalledApp()) installButtons.forEach((button) => button.classList.add('hidden'));
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', { scope: import.meta.env.BASE_URL })
    .catch((error) => console.warn('No se pudo activar el modo instalable.', error));
}
$('#copyrightYear').textContent = new Date().getFullYear();
$('#aDatetime').min = localDateTime(new Date());
$('#authForm').addEventListener('submit', authSubmit);
$('#forgotPassword').addEventListener('click', (event) => { event.preventDefault(); sendPasswordReset().catch((error) => setAuthMessage(friendlyError(error))); });
$('#resetForm').addEventListener('submit', (event) => saveNewPassword(event).catch((error) => notify(friendlyError(error))));
$('#successBtn').addEventListener('click', () => { closeModal(); openModal('login'); });
$('#logoutBtn').addEventListener('click', async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) notify(friendlyError(error));
  else { currentUser = null; currentProfile = null; setAppVisible(false); }
});
$('#pMeasureForm').addEventListener('submit', (event) => saveMeasurement(event).catch((error) => notify(friendlyError(error))));
$('#pApptForm').addEventListener('submit', (event) => requestAppointment(event).catch((error) => notify(friendlyError(error))));
$('#pEditProfileBtn').addEventListener('click', () => { $('#editAlert').classList.add('hidden'); $('#editModal').classList.add('show'); });
$('#editForm').addEventListener('submit', saveProfile);
$('#aSearch').addEventListener('input', () => loadAdminPanel().catch((error) => notify(friendlyError(error))));

if (!ensureConfigured()) {
  $('#submitBtn').disabled = true;
  $('#configNotice')?.classList.remove('hidden');
} else {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      $('#formView').classList.add('hidden');
      $('#successView').classList.remove('show');
      $('#resetView').classList.remove('hidden');
      $('#modal').classList.add('show');
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => $('#newPassword').focus());
    }
  });
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) notify(friendlyError(error));
    else if (data.session) loadUserAndPanel(data.session.user);
  }).catch((error) => notify(friendlyError(error)));
}
