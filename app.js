import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where,
  getDocs, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

/* ---------- tiện ích ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid6 = () => 'p' + Math.random().toString(36).slice(2, 8);
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

function renderMath(el) {
  if (window.renderMathInElement) {
    window.renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  }
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2200);
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function fmtDate(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  return d ? d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '';
}
function errMsg(e) {
  const c = e?.code || '';
  const map = {
    'auth/invalid-credential': 'Sai email hoặc mật khẩu.',
    'auth/invalid-email': 'Email không hợp lệ.',
    'auth/email-already-in-use': 'Email này đã có tài khoản, hãy đăng nhập.',
    'auth/weak-password': 'Mật khẩu cần ít nhất 6 ký tự.',
    'auth/operation-not-allowed': 'Chưa bật phương thức đăng nhập này trong Firebase (xem README).',
    'auth/admin-restricted-operation': 'Chưa bật đăng nhập Ẩn danh (Anonymous) trong Firebase (xem README).',
    'permission-denied': 'Không có quyền thực hiện (kiểm tra lại Firestore rules).'
  };
  return map[c] || e?.message || 'Có lỗi xảy ra.';
}

/* ---------- Firebase ---------- */
const configured = !!firebaseConfig.apiKey;
let auth, db;
const state = { user: null };
let authReady = Promise.resolve();
if (configured) {
  const fb = initializeApp(firebaseConfig);
  auth = getAuth(fb);
  db = getFirestore(fb);
  authReady = new Promise((resolve) => {
    let first = true;
    onAuthStateChanged(auth, (u) => {
      state.user = u;
      renderNav();
      if (first) { first = false; resolve(); }
    });
  });
}
const isTeacher = () => !!state.user && !state.user.isAnonymous;
async function ensureAnon() {
  await authReady;
  if (!auth.currentUser) await signInAnonymously(auth);
  return auth.currentUser;
}

function renderNav() {
  const nav = $('#nav');
  nav.innerHTML = isTeacher()
    ? `<span class="muted small">${esc(state.user.email)}</span><a href="#/gv">Lớp của tôi</a><button class="btn sm" id="out">Đăng xuất</button>`
    : '';
  $('#out')?.addEventListener('click', async () => { await signOut(auth); location.hash = '#/'; });
}

/* ---------- hộp nhập công thức ---------- */
let mathTarget = null;
let lastTA = null;
document.addEventListener('focusin', (e) => { if (e.target.classList?.contains('mathta')) lastTA = e.target; });
function insertAtCursor(ta, text) {
  const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? s;
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
  ta.selectionStart = ta.selectionEnd = s + text.length;
  ta.focus();
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}
function openMath(ta) {
  mathTarget = ta;
  const mf = $('#mf'); mf.value = '';
  $('#mathDialog').showModal();
  setTimeout(() => mf.focus(), 50);
}
$('#mathCancel').addEventListener('click', () => $('#mathDialog').close());
$('#mathInsert').addEventListener('click', () => {
  const latex = ($('#mf').value || '').trim();
  $('#mathDialog').close();
  if (latex && mathTarget) insertAtCursor(mathTarget, `$${latex}$`);
});

const SNIPPETS = [
  ['ℝ', '\\mathbb{R}'], ['ℂ', '\\mathbb{C}'], ['ℕ', '\\mathbb{N}'], ['∈', '\\in'], ['⊂', '\\subset'],
  ['∑', '\\sum_{i=1}^{n} a_i'], ['x/y', '\\frac{a}{b}'], ['√', '\\sqrt{x}'], ['vector', '\\vec{v}'],
  ['⟨u,v⟩', '\\langle u, v \\rangle'], ['‖v‖', '\\|v\\|'], ['α', '\\alpha'], ['λ', '\\lambda'],
  ['→', '\\to'], ['⟺', '\\iff'], ['≠', '\\neq'], ['≤', '\\leq'], ['∀', '\\forall'], ['∃', '\\exists'],
  ['ma trận', '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'], ['|ψ⟩', '|\\psi\\rangle'], ['⊗', '\\otimes']
];

/* ---------- router ---------- */
async function route() {
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  const p = path.split('/').filter(Boolean);
  const q = new URLSearchParams(qs || '');
  window.scrollTo(0, 0);

  if (!configured) return viewSetup();
  await authReady;
  try {
    if (p.length === 0) return viewHome();
    if (p[0] === 'hs') {
      if (p.length === 1) return viewStudentJoin(q);
      if (p[1] === 'lop') return viewStudentClass();
      if (p[1] === 'bai') return viewStudentAssignment(p[2]);
    }
    if (p[0] === 'gv') {
      if (!isTeacher()) return viewTeacherLogin();
      if (p.length === 1) return viewTeacherHome();
      if (p[1] === 'lop' && p.length === 3) return viewTeacherClass(p[2]);
      if (p[1] === 'lop' && p[3] === 'bai' && p.length === 5) return viewTeacherEditor(p[2], p[4]);
      if (p[1] === 'lop' && p[3] === 'bai' && p[5] === 'ketqua') return viewTeacherResults(p[2], p[4]);
    }
    app.innerHTML = `<div class="card"><p>Không tìm thấy trang. <a href="#/">Về trang chủ</a></p></div>`;
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="card"><p class="err">${esc(errMsg(e))}</p><a href="#/">Về trang chủ</a></div>`;
  }
}
window.addEventListener('hashchange', route);
route();

/* ---------- màn hình chung ---------- */
function viewSetup() {
  app.innerHTML = `<div class="card"><h1>Chưa cấu hình Firebase</h1>
    <p>Mở file <code>firebase-config.js</code> và dán cấu hình web app của Firebase vào. Các bước chi tiết có trong <code>README.md</code>.</p></div>`;
}

function viewHome() {
  app.innerHTML = `
    <h1 class="center">Chào mừng!</h1>
    <div class="big-choice">
      <a class="card" href="#/hs"><div class="emoji">🎒</div><h2>Tôi là học sinh</h2><p class="muted">Vào lớp bằng tên và mã lớp</p></a>
      <a class="card" href="#/gv"><div class="emoji">🧑‍🏫</div><h2>Tôi là giáo viên</h2><p class="muted">Tạo lớp, ra đề, xem tiến độ</p></a>
    </div>`;
}

/* =====================  HỌC SINH  ===================== */
const getHS = () => { try { return JSON.parse(localStorage.getItem('hs') || 'null'); } catch { return null; } };

function viewStudentJoin(q) {
  const saved = getHS();
  app.innerHTML = `<div class="card narrow"><h1>Vào lớp</h1>
    <form id="f">
      <label>Họ và tên<input name="name" required maxlength="60" value="${esc(saved?.name || '')}" placeholder="Nguyễn Văn A"></label>
      <label>Mã lớp<input name="code" required maxlength="10" value="${esc((q.get('ma') || saved?.code || '').toUpperCase())}" placeholder="VD: K7M3QX" style="text-transform:uppercase"></label>
      <div class="err" id="err"></div>
      <button class="btn primary" style="width:100%">Vào lớp</button>
    </form></div>`;
  $('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    const code = e.target.code.value.trim().toUpperCase();
    $('#err').textContent = '';
    try {
      await ensureAnon();
      const snap = await getDoc(doc(db, 'classes', code));
      if (!snap.exists()) { $('#err').textContent = 'Không tìm thấy lớp với mã này.'; return; }
      localStorage.setItem('hs', JSON.stringify({ name, code, className: snap.data().name }));
      location.hash = '#/hs/lop';
    } catch (err) { $('#err').textContent = errMsg(err); }
  });
}

async function viewStudentClass() {
  const hs = getHS();
  if (!hs) { location.hash = '#/hs'; return; }
  const user = await ensureAnon();
  app.innerHTML = `<p class="muted center">Đang tải bài tập…</p>`;
  const snap = await getDocs(query(collection(db, 'classes', hs.code, 'assignments'), where('published', '==', true)));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const subs = await Promise.all(list.map(a => getDoc(doc(db, 'classes', hs.code, 'submissions', `${a.id}_${user.uid}`))));
  app.innerHTML = `
    <div class="row between"><div><h1>${esc(hs.className || 'Lớp học')}</h1><div class="muted">Xin chào, ${esc(hs.name)}</div></div>
    <a class="btn sm" href="#/hs">Đổi tên / lớp</a></div>
    <div class="card">${list.length ? list.map((a, i) => {
      const s = subs[i].exists() ? subs[i].data() : null;
      const done = s ? Object.values(s.answers || {}).filter(x => x.done).length : 0;
      const total = (a.problems || []).length;
      return `<div class="item"><div><b>${esc(a.title)}</b>
        <div class="muted small">${esc(a.scope || '')}${a.due ? ` · Hạn: ${esc(a.due)}` : ''}</div>
        <span class="tag ${done === total && total ? 'ok' : ''}">${done}/${total} bài đã làm</span>
        ${s?.comment ? '<span class="tag">Có nhận xét</span>' : ''}</div>
        <a class="btn primary sm" href="#/hs/bai/${a.id}">Làm bài</a></div>`;
    }).join('') : '<p class="muted">Chưa có bài tập nào được giao.</p>'}</div>`;
}

async function viewStudentAssignment(aid) {
  const hs = getHS();
  if (!hs) { location.hash = '#/hs'; return; }
  const user = await ensureAnon();
  const aSnap = await getDoc(doc(db, 'classes', hs.code, 'assignments', aid));
  if (!aSnap.exists() || !aSnap.data().published) { app.innerHTML = '<div class="card">Bài tập không tồn tại.</div>'; return; }
  const a = aSnap.data();
  const sref = doc(db, 'classes', hs.code, 'submissions', `${aid}_${user.uid}`);
  const sSnap = await getDoc(sref);
  const sub = sSnap.exists() ? sSnap.data() : {};
  const answers = JSON.parse(JSON.stringify(sub.answers || {}));

  app.innerHTML = `
    <a href="#/hs/lop" class="small">← Quay lại danh sách</a>
    <h1>${esc(a.title)}</h1>
    <div class="muted">${esc(a.scope || '')}${a.due ? ` · Hạn: ${esc(a.due)}` : ''}</div>
    ${sub.comment ? `<div class="comment"><b>Nhận xét của thầy/cô:</b><br>${esc(sub.comment)}</div>` : ''}
    <div id="plist">${(a.problems || []).map((p, i) => `
      <div class="problem" data-id="${p.id}">
        <div><span class="num">Bài ${i + 1}.</span></div>
        <div class="stmt">${esc(p.text)}</div>
        <textarea class="mathta" placeholder="Viết bài làm / đáp án của em…">${esc(answers[p.id]?.text || '')}</textarea>
        <div class="row between">
          <div class="row"><button type="button" class="btn sm mbtn">∑ Chèn công thức</button>
          <label style="margin:0;font-weight:500"><input type="checkbox" class="done" ${answers[p.id]?.done ? 'checked' : ''}>Đã làm xong</label></div>
        </div>
        <div class="preview" hidden></div>
      </div>`).join('')}</div>
    <div class="savebar"><span class="muted small" id="status">Bài làm được tự động lưu.</span>
      <a class="btn primary" href="#/hs/lop">Xong</a></div>`;
  renderMath($('#plist'));

  const status = $('#status');
  const save = debounce(async () => {
    try {
      await setDoc(sref, { uid: user.uid, studentName: hs.name, assignmentId: aid, answers, updatedAt: serverTimestamp() }, { merge: true });
      status.textContent = 'Đã lưu ✓';
    } catch (e) { status.textContent = 'Lưu lỗi: ' + errMsg(e); }
  }, 800);

  $$('.problem').forEach(card => {
    const id = card.dataset.id, ta = $('textarea', card), pv = $('.preview', card), cb = $('.done', card);
    const upd = () => { answers[id] = { text: ta.value, done: cb.checked }; status.textContent = 'Đang lưu…'; save(); };
    const showPreview = debounce(() => {
      if (/\$|\\\(|\\\[/.test(ta.value)) { pv.hidden = false; pv.textContent = ta.value; renderMath(pv); } else pv.hidden = true;
    }, 250);
    ta.addEventListener('input', () => { upd(); showPreview(); });
    cb.addEventListener('change', upd);
    $('.mbtn', card).addEventListener('click', () => openMath(ta));
    showPreview();
  });
}

/* =====================  GIÁO VIÊN  ===================== */
function viewTeacherLogin() {
  app.innerHTML = `<div class="card narrow"><h1>Giáo viên đăng nhập</h1>
    <form id="f">
      <label>Email<input type="email" name="email" required></label>
      <label>Mật khẩu<input type="password" name="pw" required minlength="6"></label>
      <div class="err" id="err"></div>
      <div class="row"><button class="btn primary" id="in">Đăng nhập</button>
      <button class="btn" type="button" id="up">Tạo tài khoản</button></div>
      <p class="small"><a href="#" id="reset">Quên mật khẩu?</a></p>
    </form></div>`;
  const f = $('#f');
  const go = async (fn) => {
    $('#err').textContent = '';
    try { await fn(f.email.value.trim(), f.pw.value); location.hash = '#/gv'; route(); }
    catch (e) { $('#err').textContent = errMsg(e); }
  };
  f.addEventListener('submit', (e) => { e.preventDefault(); go((m, p) => signInWithEmailAndPassword(auth, m, p)); });
  $('#up').addEventListener('click', () => { if (f.reportValidity()) go((m, p) => createUserWithEmailAndPassword(auth, m, p)); });
  $('#reset').addEventListener('click', async (e) => {
    e.preventDefault();
    if (!f.email.value) { $('#err').textContent = 'Nhập email trước rồi bấm lại.'; return; }
    try { await sendPasswordResetEmail(auth, f.email.value.trim()); toast('Đã gửi email đặt lại mật khẩu'); } catch (err) { $('#err').textContent = errMsg(err); }
  });
}

async function viewTeacherHome() {
  app.innerHTML = `<p class="muted center">Đang tải…</p>`;
  const snap = await getDocs(query(collection(db, 'classes'), where('teacherUid', '==', state.user.uid)));
  const classes = snap.docs.map(d => ({ code: d.id, ...d.data() }));
  app.innerHTML = `<h1>Lớp của tôi</h1>
    <div class="card">${classes.length ? classes.map(c => `
      <div class="item"><div><b>${esc(c.name)}</b> <span class="muted small">mã: ${esc(c.code)}</span></div>
      <a class="btn primary sm" href="#/gv/lop/${c.code}">Mở lớp</a></div>`).join('') : '<p class="muted">Chưa có lớp nào.</p>'}</div>
    <div class="card"><h2>Tạo lớp mới</h2>
      <form id="f" class="row"><input name="name" required maxlength="60" placeholder="Tên lớp, VD: QML – Buổi tối T3" style="flex:1;min-width:200px;margin:0">
      <button class="btn primary">Tạo lớp</button></form></div>`;
  $('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    for (let i = 0; i < 5; i++) {
      const code = newCode();
      const ref = doc(db, 'classes', code);
      try {
        if ((await getDoc(ref)).exists()) continue;
      } catch { /* get được phép với mọi người đã đăng nhập */ }
      await setDoc(ref, { name, teacherUid: state.user.uid, createdAt: serverTimestamp() });
      location.hash = `#/gv/lop/${code}`; return;
    }
    toast('Không tạo được mã lớp, thử lại nhé');
  });
}

async function viewTeacherClass(code) {
  const cs = await getDoc(doc(db, 'classes', code));
  if (!cs.exists() || cs.data().teacherUid !== state.user.uid) { app.innerHTML = '<div class="card">Không có quyền xem lớp này.</div>'; return; }
  const cls = cs.data();
  const snap = await getDocs(collection(db, 'classes', code, 'assignments'));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const link = `${location.origin}${location.pathname}#/hs?ma=${code}`;
  app.innerHTML = `
    <a href="#/gv" class="small">← Các lớp</a>
    <h1>${esc(cls.name)}</h1>
    <div class="card">
      <div class="row between"><div><div class="muted small">Mã lớp (đưa cho học sinh)</div><span class="code">${code}</span></div>
      <button class="btn" id="copy">Sao chép link vào lớp</button></div>
      <p class="muted small" style="margin-bottom:0">Link: <span style="word-break:break-all">${esc(link)}</span></p>
    </div>
    <div class="row between"><h2 style="margin:0">Buổi học / bài tập</h2><button class="btn primary" id="new">+ Tạo buổi mới</button></div>
    <div class="card" style="margin-top:.6rem">${list.length ? list.map(a => `
      <div class="item"><div><b>${esc(a.title || '(chưa đặt tên)')}</b>
        <span class="tag ${a.published ? 'ok' : 'draft'}">${a.published ? 'Đã giao' : 'Nháp'}</span>
        <div class="muted small">${(a.problems || []).length} bài${a.scope ? ' · ' + esc(a.scope) : ''}</div></div>
        <div class="row"><a class="btn sm" href="#/gv/lop/${code}/bai/${a.id}">Sửa</a>
        <a class="btn sm" href="#/gv/lop/${code}/bai/${a.id}/ketqua">Kết quả</a>
        <button class="btn sm danger del" data-id="${a.id}">Xóa</button></div></div>`).join('') : '<p class="muted">Chưa có buổi nào.</p>'}</div>`;
  $('#copy').addEventListener('click', async () => { await navigator.clipboard.writeText(link); toast('Đã sao chép link'); });
  $('#new').addEventListener('click', async () => {
    const ref = doc(collection(db, 'classes', code, 'assignments'));
    await setDoc(ref, { title: '', scope: '', due: '', published: false, problems: [{ id: uid6(), text: '' }], createdAt: serverTimestamp() });
    location.hash = `#/gv/lop/${code}/bai/${ref.id}`;
  });
  $$('.del').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Xóa buổi này? Bài làm của học sinh vẫn còn trong cơ sở dữ liệu nhưng sẽ không hiển thị nữa.')) return;
    await deleteDoc(doc(db, 'classes', code, 'assignments', b.dataset.id)); route();
  }));
}

function parseBulk(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const startRe = /^\s*(?:Bài|Câu|Problem)?\s*\d+\s*[.):]\s*/i;
  if (lines.some(l => startRe.test(l))) {
    const out = []; let cur = null;
    for (const l of lines) {
      if (startRe.test(l)) { if (cur !== null) out.push(cur.trim()); cur = l.replace(startRe, ''); }
      else if (cur !== null) cur += '\n' + l;
    }
    if (cur !== null) out.push(cur.trim());
    return out.filter(Boolean);
  }
  return text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
}

async function viewTeacherEditor(code, aid) {
  const ref = doc(db, 'classes', code, 'assignments', aid);
  const snap = await getDoc(ref);
  if (!snap.exists()) { app.innerHTML = '<div class="card">Không tìm thấy buổi này.</div>'; return; }
  const a = snap.data();
  a.problems = a.problems?.length ? a.problems : [{ id: uid6(), text: '' }];

  const draw = () => {
    app.innerHTML = `
      <a href="#/gv/lop/${code}" class="small">← Về lớp</a>
      <h1>Soạn buổi học</h1>
      <div class="card">
        <label>Tên buổi<input id="title" value="${esc(a.title)}" placeholder="Buổi 03 – Không gian vector"></label>
        <label>Chương / phạm vi kiến thức<input id="scope" value="${esc(a.scope)}" placeholder="Không gian vector, cơ sở, số chiều"></label>
        <div class="row"><label style="flex:1">Hạn nộp (tùy chọn)<input id="due" type="date" value="${esc(a.due)}"></label>
        <label style="flex:1;margin-top:1.4rem"><input type="checkbox" id="pub" ${a.published ? 'checked' : ''}> Giao cho học sinh (hiện ra cho học sinh)</label></div>
      </div>
      <details class="card"><summary><b>Dán nhanh từ AI</b> <span class="muted small">(tách các bài tự động)</span></summary>
        <p class="muted small">Dán một khối văn bản có đánh số (“1.”, “Bài 2:”, “Câu 3)”…) hoặc ngăn cách bằng dòng trống. Công thức đặt trong <code>$...$</code>.</p>
        <textarea id="bulk" style="min-height:140px"></textarea>
        <div class="row" style="margin-top:.5rem"><button class="btn" id="bulkAdd">Thêm vào danh sách</button>
        <button class="btn" id="bulkReplace">Thay toàn bộ danh sách</button></div>
      </details>
      <div class="toolbar" id="snips"><span class="muted small" style="align-self:center">Chèn nhanh:</span>
        ${SNIPPETS.map((s, i) => `<button type="button" data-i="${i}">${esc(s[0])}</button>`).join('')}</div>
      <div id="plist">${a.problems.map((p, i) => `
        <div class="problem" data-i="${i}">
          <div class="row between"><span class="num">Bài ${i + 1}</span>
            <div class="row"><button class="btn sm up" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn sm dn" ${i === a.problems.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="btn sm danger rm">Xóa</button></div></div>
          <textarea class="mathta" placeholder="Đề bài. Công thức đặt trong $...$">${esc(p.text)}</textarea>
          <div class="row" style="margin:.3rem 0"><button class="btn sm mbtn" type="button">∑ Nhập công thức bằng bàn phím toán</button></div>
          <div class="preview"></div>
        </div>`).join('')}</div>
      <button class="btn" id="add">+ Thêm bài</button>
      <div class="savebar"><span class="muted small" id="status"></span>
        <div class="row"><a class="btn" href="#/gv/lop/${code}/bai/${aid}/ketqua">Xem kết quả</a><button class="btn primary" id="save">Lưu</button></div></div>`;

    const readMeta = () => { a.title = $('#title').value; a.scope = $('#scope').value; a.due = $('#due').value; a.published = $('#pub').checked; };
    $$('.problem').forEach(card => {
      const i = +card.dataset.i, ta = $('textarea', card), pv = $('.preview', card);
      const paint = debounce(() => { pv.textContent = ta.value || ' '; renderMath(pv); }, 200);
      ta.addEventListener('input', () => { a.problems[i].text = ta.value; paint(); });
      paint();
      $('.mbtn', card).addEventListener('click', () => openMath(ta));
      $('.rm', card).addEventListener('click', () => { readMeta(); a.problems.splice(i, 1); if (!a.problems.length) a.problems.push({ id: uid6(), text: '' }); draw(); });
      $('.up', card).addEventListener('click', () => { readMeta(); [a.problems[i - 1], a.problems[i]] = [a.problems[i], a.problems[i - 1]]; draw(); });
      $('.dn', card).addEventListener('click', () => { readMeta(); [a.problems[i + 1], a.problems[i]] = [a.problems[i], a.problems[i + 1]]; draw(); });
    });
    $('#add').addEventListener('click', () => { readMeta(); a.problems.push({ id: uid6(), text: '' }); draw(); });
    $$('#snips button').forEach(b => b.addEventListener('click', () => {
      const ta = lastTA && document.body.contains(lastTA) ? lastTA : $('.mathta');
      insertAtCursor(ta, `$${SNIPPETS[+b.dataset.i][1]}$`);
    }));
    const bulk = (replace) => {
      const items = parseBulk($('#bulk').value);
      if (!items.length) { toast('Không tách được bài nào'); return; }
      readMeta();
      const mapped = items.map(t => ({ id: uid6(), text: t }));
      const empty = a.problems.length === 1 && !a.problems[0].text.trim();
      a.problems = replace || empty ? mapped : a.problems.concat(mapped);
      draw(); toast(`Đã thêm ${items.length} bài`);
    };
    $('#bulkAdd').addEventListener('click', () => bulk(false));
    $('#bulkReplace').addEventListener('click', () => bulk(true));
    $('#save').addEventListener('click', async () => {
      readMeta();
      try {
        await updateDoc(ref, {
          title: a.title.trim(), scope: a.scope.trim(), due: a.due, published: a.published,
          problems: a.problems.filter(p => p.text.trim()), updatedAt: serverTimestamp()
        });
        toast(a.published ? 'Đã lưu và giao cho học sinh' : 'Đã lưu (nháp)');
        $('#status').textContent = 'Đã lưu ✓';
      } catch (e) { $('#status').textContent = errMsg(e); }
    });
  };
  draw();
}

async function viewTeacherResults(code, aid) {
  app.innerHTML = `<p class="muted center">Đang tải…</p>`;
  const aSnap = await getDoc(doc(db, 'classes', code, 'assignments', aid));
  if (!aSnap.exists()) { app.innerHTML = '<div class="card">Không tìm thấy buổi này.</div>'; return; }
  const a = aSnap.data(); const probs = a.problems || [];
  const sSnap = await getDocs(query(collection(db, 'classes', code, 'submissions'), where('assignmentId', '==', aid)));
  const byName = new Map();
  sSnap.docs.forEach(d => {
    const s = { id: d.id, ...d.data() };
    const key = (s.studentName || '').trim().toLowerCase();
    const prev = byName.get(key);
    if (!prev || (s.updatedAt?.seconds || 0) > (prev.updatedAt?.seconds || 0)) byName.set(key, s);
  });
  const subs = [...byName.values()].sort((x, y) => (x.studentName || '').localeCompare(y.studentName || '', 'vi'));

  app.innerHTML = `
    <a href="#/gv/lop/${code}" class="small">← Về lớp</a>
    <h1>Kết quả: ${esc(a.title)}</h1>
    <div class="card" style="overflow-x:auto">${subs.length ? `<table>
      <tr><th>Học sinh</th>${probs.map((_, i) => `<th>${i + 1}</th>`).join('')}<th>Xong</th><th>Cập nhật</th></tr>
      ${subs.map((s, k) => {
        const done = probs.filter(p => s.answers?.[p.id]?.done).length;
        return `<tr class="click" data-k="${k}"><td>${esc(s.studentName)}${s.comment ? ' 💬' : ''}</td>${probs.map(p => {
          const x = s.answers?.[p.id];
          return `<td><span class="dot ${x?.done ? 'on' : (x?.text ? 'part' : '')}"></span></td>`;
        }).join('')}<td>${done}/${probs.length}</td><td class="muted small">${fmtDate(s.updatedAt)}</td></tr>`;
      }).join('')}</table>
      <p class="muted small" style="margin-bottom:0">Xanh = đã đánh dấu xong · Cam = có viết nhưng chưa đánh dấu · Bấm vào dòng để xem bài làm.</p>`
      : '<p class="muted">Chưa có học sinh nào bắt đầu làm bài.</p>'}</div>
    <div id="detail"></div>`;

  $$('tr.click').forEach(tr => tr.addEventListener('click', () => {
    const s = subs[+tr.dataset.k];
    $('#detail').innerHTML = `<div class="card"><h2>Bài làm của ${esc(s.studentName)}</h2>
      ${probs.map((p, i) => `<div class="problem"><span class="num">Bài ${i + 1}.</span> ${s.answers?.[p.id]?.done ? '<span class="tag ok">đã xong</span>' : ''}
        <div class="stmt">${esc(p.text)}</div>
        <div class="answer">${esc(s.answers?.[p.id]?.text || '(chưa làm)')}</div></div>`).join('')}
      <label>Nhận xét gửi học sinh<textarea id="cm">${esc(s.comment || '')}</textarea></label>
      <button class="btn primary" id="cmSave">Lưu nhận xét</button></div>`;
    renderMath($('#detail'));
    $('#detail').scrollIntoView({ behavior: 'smooth' });
    $('#cmSave').addEventListener('click', async () => {
      try {
        await updateDoc(doc(db, 'classes', code, 'submissions', s.id), { comment: $('#cm').value.trim() });
        s.comment = $('#cm').value.trim(); toast('Đã lưu nhận xét');
      } catch (e) { toast(errMsg(e)); }
    });
  }));
}
