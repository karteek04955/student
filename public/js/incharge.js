/**
 * incharge.js - Class Incharge Portal Logic
 */

let inchargeUser = null;
let allStudents = [];
let assignType = 'all';
let marksAssignType = 'all';
let marksExamType = 'sem';
let currentSection = 'dashboard';

// ═══════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  const stored = localStorage.getItem('inchargeUser');
  if (!stored) {
    window.location.href = 'incharge-login.html';
    return;
  }

  inchargeUser = JSON.parse(stored);

  await fetchStudents();
  await loadInchargeSection('dashboard');

  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      currentSection = item.dataset.section;
      loadInchargeSection(currentSection);
      closeSidebar();
    });
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('inchargeUser');
    window.location.href = 'incharge-login.html';
  });

  // Hamburger / mobile sidebar
  const hamburger = document.getElementById('hamburger');
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebarOverlay');

  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }

  // Dark mode switch handler
  const darkToggle = document.getElementById('darkToggle');
  const darkToggleSw = document.getElementById('darkToggleSw');
  if (darkToggle && darkToggleSw) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    darkToggleSw.classList.toggle('on', isDark);

    darkToggle.addEventListener('click', () => {
      const turnDark = !darkToggleSw.classList.contains('on');
      darkToggleSw.classList.toggle('on', turnDark);
      applyDarkMode(turnDark);
      showToast(turnDark ? 'Dark Mode Enabled 🌙' : 'Light Mode Enabled ☀️', 'success');
    });
  }
});

function closeSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  if (sidebar)  sidebar.classList.remove('open');
  if (overlay)  overlay.classList.remove('active');
}

async function fetchStudents() {
  try {
    allStudents = await api.student.list();
  } catch { allStudents = []; }
}

// ═══════════════════════════════════════
//  SECTION ROUTER
// ═══════════════════════════════════════
async function loadInchargeSection(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`section-${section}`);
  if (el) el.classList.add('active');

  const titles = {
    dashboard:   { title: 'Dashboard',         sub: 'Overview & quick stats' },
    students:    { title: 'Students',           sub: 'All registered students' },
    timetable:   { title: 'Timetable Manager', sub: 'Manage class schedule' },
    assignments: { title: 'Assignments Manager', sub: 'Create and track assignments' },
    marks:       { title: 'Marks Manager',      sub: 'Assign marks to students' },
    attendance:  { title: 'Attendance Manager', sub: 'Update student attendance' },
    notes:       { title: 'Notes Manager',      sub: 'Create and manage class-wide or individual notes' },
    export:      { title: 'Export to Excel',    sub: 'Export data reports' },
  };

  const info = titles[section] || { title: section, sub: '' };
  document.getElementById('headerTitle').textContent = info.title;
  document.getElementById('headerSubtitle').textContent = info.sub;

  const loaders = {
    dashboard: loadInchargeDashboard,
    students: loadStudentList,
    timetable: loadTimetableManager,
    assignments: loadAssignmentManager,
    marks: loadMarksManager,
    attendance: loadAttendanceManager,
    notes: loadNotesManager,
    export: loadExportPage,
  };
  if (loaders[section]) await loaders[section]();
}

// ═══════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════
async function loadInchargeDashboard() {
  try {
    const [students, assignments, marks, timetable] = await Promise.all([
      api.student.list(),
      api.assignments.all(),
      api.marks.all(),
      api.timetable.get(),
    ]);
    const pending = assignments.filter(a => a.completion_count < (a.created_for === 'all' ? students.length : 1));
    const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('dashWelcomeName').textContent = inchargeUser.username;
    document.getElementById('dashDate').textContent = today;
    document.getElementById('statStudents').textContent = students.length;
    document.getElementById('statAssignments').textContent = assignments.length;
    document.getElementById('statMarks').textContent = marks.length;
    document.getElementById('statTimetable').textContent = timetable.length;

    // Recent students
    const recentEl = document.getElementById('dashRecentStudents');
    const recent = students.slice(-5).reverse();
    recentEl.innerHTML = recent.length === 0
      ? '<div class="empty-state" style="padding:30px;"><div class="empty-state-icon">👥</div><p>No students yet</p></div>'
      : recent.map(s => `
          <div style="display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--border-color);">
            <div class="student-avatar" style="width:36px; height:36px; font-size:0.875rem;">${getInitials(s.name)}</div>
            <div>
              <div style="font-weight:600; font-size:0.875rem; color: var(--navy);">${escapeHtml(s.name)}</div>
              <div style="font-size:0.75rem; color:var(--text-2);">${s.roll_number} • ${s.course}</div>
            </div>
          </div>
        `).join('');

    // Pending assignments
    const pendingEl = document.getElementById('dashPendingAssignments');
    pendingEl.innerHTML = pending.length === 0
      ? '<div class="empty-state" style="padding:30px;"><div class="empty-state-icon">✅</div><p>No pending assignments</p></div>'
      : pending.slice(0, 4).map(a => `
          <div style="display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--border-color);">
            <span class="badge badge-warning">⏳</span>
            <div style="min-width:0; flex:1;">
              <div style="font-weight:600; font-size:0.875rem; color: var(--navy); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(a.subject)}</div>
              <div style="font-size:0.75rem; color:var(--text-2);">Due: ${formatDate(a.due_date)}</div>
            </div>
            <span class="badge badge-success" style="margin-left:auto; flex-shrink:0;">✅ ${a.completion_count} done</span>
          </div>
        `).join('');
  } catch {}
}

// ═══════════════════════════════════════
//  STUDENTS
// ═══════════════════════════════════════
async function loadStudentList() {
  const container = document.getElementById('studentsContent');
  container.innerHTML = '<div class="loading-container"><div class="spinner"></div></div>';
  try {
    await fetchStudents();
    if (allStudents.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><h3>No students registered yet</h3><p>Students will appear here once they log in.</p></div>';
      return;
    }

    const pending = allStudents.filter(s => s.approved === false);
    const approved = allStudents.filter(s => s.approved !== false);

    let pendingHtml = '';
    if (pending.length > 0) {
      pendingHtml = `
        <div class="pending-approvals-card" style="background:var(--amber-bg); border:1px solid rgba(217,119,6,0.15); padding:24px; border-radius:var(--radius-lg); margin-bottom:30px;">
          <h3 style="color:var(--amber); margin-bottom:14px; display:flex; align-items:center; gap:8px;">⏳ Pending Approvals (${pending.length})</h3>
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${pending.map(s => `
              <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; background:var(--bg-card); padding:16px; border-radius:var(--radius); border:1px solid var(--border);">
                <div style="display:flex; align-items:center; gap:12px;">
                  <div class="student-avatar" style="width:36px; height:36px; font-size:0.875rem;">${getInitials(s.name)}</div>
                  <div>
                    <div style="font-weight:700; color:var(--navy);">${escapeHtml(s.name)}</div>
                    <div style="font-size:0.78rem; color:var(--text-2);">${s.roll_number} • ${escapeHtml(s.course)} • ${s.email}</div>
                  </div>
                </div>
                <div style="display:flex; gap:8px;">
                  <button class="btn btn-success btn-sm" onclick="approveStudent('${s.id}')">Approve</button>
                  <button class="btn btn-danger btn-sm" onclick="removeStudent('${s.id}', true)">Reject</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      ${pendingHtml}
      <div class="filter-bar">
        <input type="text" class="search-input" placeholder="🔍 Search approved students by name, roll, or course..." oninput="filterStudents(this.value)" />
        <span class="badge badge-primary">${approved.length} Approved Students</span>
      </div>
      <div class="student-list-grid" id="studentGrid">
        ${approved.map(s => renderStudentCard(s)).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Error loading students</h3></div>';
  }
}

function renderStudentCard(s) {
  return `
    <div class="student-list-card" data-name="${s.name.toLowerCase()}" data-roll="${s.roll_number.toLowerCase()}" data-course="${s.course.toLowerCase()}">
      <div class="student-avatar">${getInitials(s.name)}</div>
      <div style="flex:1; min-width:0;">
        <div class="student-card-name" style="font-weight:700; color:var(--navy);">${escapeHtml(s.name)}</div>
        <div class="student-card-roll" style="font-size:0.8rem; color:var(--text-2);">🎫 ${s.roll_number}</div>
        <div class="student-card-course" style="margin-top:4px;"><span class="badge badge-cyan">${escapeHtml(s.course)}</span></div>
      </div>
      <button class="btn btn-icon btn-danger btn-sm" onclick="removeStudent('${s.id}')" title="Remove Student" style="margin-left:8px; opacity:0.85; transition:var(--t);">🗑️</button>
    </div>
  `;
}

function filterStudents(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('.student-list-card').forEach(card => {
    const match = card.dataset.name.includes(q) || card.dataset.roll.includes(q) || card.dataset.course.includes(q);
    card.style.display = match ? '' : 'none';
  });
}

// ═══════════════════════════════════════
//  TIMETABLE MANAGER
// ═══════════════════════════════════════
async function loadTimetableManager() {
  await fetchStudents();
  renderTimetableManager();
  await refreshTimetableList();
}

function renderTimetableManager() {
  const form = document.getElementById('timetableFormArea');
  form.innerHTML = `
    <div class="timetable-form-card">
      <h3>➕ Add Timetable Entry</h3>
      <div class="timetable-form-grid">
        <div class="form-group" style="margin-bottom:0;">
          <label>Day</label>
          <select id="ttDay">
            ${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d => `<option>${d}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label>Period</label>
          <select id="ttPeriod">
            ${[1,2,3,4,5,6,7,8].map(p => `<option value="${p}">Period ${p}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label>Subject</label>
          <input type="text" id="ttSubject" placeholder="e.g. Mathematics" />
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label>Timing</label>
          <input type="text" id="ttTiming" placeholder="e.g. 9:00 AM - 10:00 AM" />
        </div>
        <div style="display:flex; align-items:flex-end;">
          <button class="btn btn-primary" onclick="addTimetableEntry()" style="width:100%;">➕ Add</button>
        </div>
      </div>
    </div>
  `;
}

async function refreshTimetableList() {
  const container = document.getElementById('timetableListArea');
  container.innerHTML = '<div class="loading-container"><div class="spinner"></div></div>';
  try {
    const entries = await api.timetable.get();
    if (entries.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><h3>No timetable entries</h3><p>Add entries using the form above.</p></div>';
      return;
    }

    const dayEmojis = { Monday: '🌙', Tuesday: '🔥', Wednesday: '💫', Thursday: '⚡', Friday: '🎉', Saturday: '✨' };

    container.innerHTML = `
      <h3 style="margin-top:24px; margin-bottom:16px;">📋 Current Timetable</h3>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr><th>Day</th><th>Period</th><th>Subject</th><th>Timing</th><th>Action</th></tr>
          </thead>
          <tbody>
            ${entries.map(e => `
              <tr>
                <td>${dayEmojis[e.day] || ''} ${e.day}</td>
                <td><span class="badge badge-primary">P${e.period}</span></td>
                <td><strong>${escapeHtml(e.subject)}</strong></td>
                <td>${escapeHtml(e.timing)}</td>
                <td>
                  <button class="btn btn-danger btn-sm" onclick="deleteTimetableEntry('${e.id}')">🗑️ Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch {}
}

async function addTimetableEntry() {
  const day = document.getElementById('ttDay').value;
  const period = document.getElementById('ttPeriod').value;
  const subject = document.getElementById('ttSubject').value.trim();
  const timing = document.getElementById('ttTiming').value.trim();
  if (!subject || !timing) { showToast('Please fill all fields', 'warning'); return; }
  try {
    await api.timetable.add({ day, period, subject, timing });
    showToast('Timetable entry added! ✅', 'success');
    document.getElementById('ttSubject').value = '';
    document.getElementById('ttTiming').value = '';
    await refreshTimetableList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteTimetableEntry(id) {
  if (!confirm('Delete this timetable entry?')) return;
  try {
    await api.timetable.delete(id);
    showToast('Entry deleted', 'info');
    await refreshTimetableList();
  } catch {}
}

// ═══════════════════════════════════════
//  ASSIGNMENT MANAGER
// ═══════════════════════════════════════
async function loadAssignmentManager() {
  await fetchStudents();
  const container = document.getElementById('assignmentsContent');
  container.innerHTML = `
    <!-- Create Assignment Form -->
    <div class="card" style="margin-bottom:24px;">
      <h3 style="margin-bottom:20px;">➕ Create Assignment</h3>
      
      <div class="form-group">
        <label>Assign To</label>
        <div class="assign-type-pills">
          <button class="assign-pill active" id="assignPillAll" onclick="setAssignType('all')">🌐 All Students</button>
          <button class="assign-pill" id="assignPillIndividual" onclick="setAssignType('individual')">👤 Individual</button>
        </div>
      </div>

      <div id="assignStudentSelect" style="display:none;" class="form-group">
        <label>Select Student</label>
        <select id="assignStudent">
          <option value="">— Select a student —</option>
          ${allStudents.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${s.roll_number})</option>`).join('')}
        </select>
      </div>

      <div class="grid-2">
        <div class="form-group">
          <label>Subject</label>
          <input type="text" id="assignSubject" placeholder="e.g. Mathematics Assignment 1" />
        </div>
        <div class="form-group">
          <label>Due Date</label>
          <input type="date" id="assignDueDate" min="${new Date().toISOString().split('T')[0]}" />
        </div>
      </div>
      <div class="form-group">
        <label>Description (Optional)</label>
        <textarea id="assignDesc" placeholder="Assignment details, instructions..."></textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="createAssignment()">📤 Create Assignment</button>
      </div>
    </div>

    <!-- Assignments List -->
    <div id="assignListArea"></div>
  `;

  await refreshAssignmentList();
}

function setAssignType(type) {
  assignType = type;
  document.getElementById('assignPillAll').classList.toggle('active', type === 'all');
  document.getElementById('assignPillIndividual').classList.toggle('active', type === 'individual');
  document.getElementById('assignStudentSelect').style.display = type === 'individual' ? 'block' : 'none';
}

async function createAssignment() {
  const subject = document.getElementById('assignSubject').value.trim();
  const due_date = document.getElementById('assignDueDate').value;
  const description = document.getElementById('assignDesc').value.trim();
  let created_for = 'all';

  if (!subject || !due_date) { showToast('Subject and due date are required', 'warning'); return; }

  if (assignType === 'individual') {
    created_for = document.getElementById('assignStudent').value;
    if (!created_for) { showToast('Please select a student', 'warning'); return; }
  }

  try {
    await api.assignments.add({ subject, description, due_date, created_for });
    showToast('Assignment created! 📤', 'success');
    document.getElementById('assignSubject').value = '';
    document.getElementById('assignDueDate').value = '';
    document.getElementById('assignDesc').value = '';
    await refreshAssignmentList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function refreshAssignmentList() {
  const container = document.getElementById('assignListArea');
  container.innerHTML = '<div class="loading-container"><div class="spinner"></div></div>';
  try {
    const assignments = await api.assignments.all();
    if (assignments.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><h3>No assignments yet</h3></div>';
      return;
    }

    container.innerHTML = `
      <h3 style="margin-bottom:16px;">📋 All Assignments</h3>
      <div class="assignment-list">
        ${assignments.map(a => {
          const studentName = a.created_for === 'all' ? 'All Students' : (allStudents.find(s => s.id == a.created_for)?.name || 'Unknown');
          // Escape single quotes carefully for JS function params inside string template
          const escSubject = escapeHtml(a.subject).replace(/'/g, "\\'");
          return `
            <div class="assignment-item">
              <div class="assignment-icon">📋</div>
              <div class="assignment-info">
                <div class="assignment-subject">${escapeHtml(a.subject)}</div>
                ${a.description ? `<div class="assignment-desc">${escapeHtml(a.description)}</div>` : ''}
                <div class="assignment-meta">
                  <span class="due-date ${isOverdue(a.due_date) ? 'overdue' : ''}">📅 Due: ${formatDate(a.due_date)}</span>
                  <span class="badge ${a.created_for === 'all' ? 'badge-cyan' : 'badge-purple'}">👤 ${escapeHtml(studentName)}</span>
                  <span class="badge badge-success">✅ ${a.completion_count} completed</span>
                </div>
              </div>
              <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
                <button class="btn btn-secondary btn-sm" onclick="viewCompletions('${a.id}', '${escSubject}')">👁️ View</button>
                <button class="btn btn-danger btn-sm" onclick="deleteAssignment('${a.id}')">🗑️</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch {}
}

async function deleteAssignment(id) {
  if (!confirm('Delete this assignment?')) return;
  try {
    await api.assignments.delete(id);
    showToast('Assignment deleted', 'info');
    await refreshAssignmentList();
  } catch {}
}

async function viewCompletions(id, subject) {
  try {
    const completions = await api.assignments.completions(id);
    const modal = document.getElementById('completionsModal');
    document.getElementById('completionsModalTitle').textContent = `✅ Completions: ${subject}`;
    document.getElementById('completionsModalBody').innerHTML = completions.length === 0
      ? '<div class="empty-state" style="padding:30px;"><div class="empty-state-icon">⏳</div><h3>No completions yet</h3></div>'
      : completions.map(c => `
          <div class="completion-item">
            <span class="check-icon">✅</span>
            <div>
              <div style="font-weight:600; color: var(--navy);">${escapeHtml(c.student_name)}</div>
              <div style="font-size:0.75rem; color:var(--text-2);">Roll: ${c.roll_number} • Completed: ${formatDate(c.completed_at)}</div>
            </div>
          </div>
        `).join('');
    modal.classList.add('active');
  } catch {}
}

function closeCompletionsModal() {
  document.getElementById('completionsModal').classList.remove('active');
}

// ═══════════════════════════════════════
//  MARKS MANAGER (Bulk Subject Entry)
// ═══════════════════════════════════════
async function loadMarksManager() {
  await fetchStudents();
  const container = document.getElementById('marksContent');
  const approvedStudents = allStudents.filter(s => s.approved !== false);

  container.innerHTML = `
    <!-- Step 1: Setup -->
    <div class="marks-form-card" id="marksSetupCard">
      <h3 style="margin-bottom:6px;">📊 Bulk Marks Entry</h3>
      <p style="font-size:0.85rem; color:var(--text-2); margin-bottom:20px;">
        Set the exam details and number of subjects, then fill all subject marks in one go.
      </p>

      <!-- Assign To -->
      <div class="form-group">
        <label>Assign To</label>
        <div class="assign-type-pills">
          <button class="assign-pill active" id="marksPillAll" onclick="setMarksAssignType('all')">🌐 All Students</button>
          <button class="assign-pill" id="marksPillIndividual" onclick="setMarksAssignType('individual')">👤 Individual Student</button>
        </div>
      </div>

      <div id="marksStudentSelect" style="display:none;" class="form-group">
        <label>Select Student</label>
        <select id="marksStudent" style="width:100%;">
          <option value="">— Select a student —</option>
          ${approvedStudents.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${s.roll_number})</option>`).join('')}
        </select>
      </div>

      <!-- Exam Type -->
      <div class="form-group">
        <label>Exam Type</label>
        <div class="exam-type-selector">
          <button class="exam-type-btn active" id="examTypeSem" onclick="setExamType('sem')">📚 Semester Exam</button>
          <button class="exam-type-btn" id="examTypeCat" onclick="setExamType('cat')">📝 CAT / Mid Exam</button>
        </div>
      </div>

      <!-- Exam Name -->
      <div class="form-group">
        <label>Exam Name</label>
        <input type="text" id="marksExamName" placeholder="e.g. Semester I Final, CAT-1" style="width:100%;" />
      </div>

      <!-- Default Total Marks -->
      <div class="form-group">
        <label>Default Total Marks per Subject</label>
        <input type="number" id="marksDefaultTotal" min="1" value="100" style="width:180px;" />
        <span style="font-size:0.8rem; color:var(--text-2); margin-left:10px;">You can override per row</span>
      </div>

      <!-- Number of Subjects -->
      <div class="form-group" style="display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:180px;">
          <label>Number of Subjects</label>
          <input type="number" id="marksSubjectCount" min="1" max="20" value="6" style="width:100%;" />
        </div>
        <button class="btn btn-secondary" onclick="generateSubjectRows()" style="height:44px; white-space:nowrap;">
          ⚡ Generate Subject Rows
        </button>
      </div>
    </div>

    <!-- Step 2: Subject Rows Table (dynamically injected) -->
    <div id="marksSubjectRowsCard" style="display:none; margin-top:20px;">
      <div class="card" style="padding:24px;">
        <div class="flex-between" style="margin-bottom:16px; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 id="marksTableHeading">📋 Enter Marks for All Subjects</h3>
            <p style="font-size:0.82rem; color:var(--text-2); margin-top:4px;" id="marksTableSubTitle"></p>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="loadMarksManager()">↩ Reset Form</button>
        </div>

        <div class="table-wrapper" style="margin-bottom:20px;">
          <table id="marksSubjectTable">
            <thead>
              <tr>
                <th style="width:40px;">#</th>
                <th>Subject Name</th>
                <th style="width:140px;">Scored Marks</th>
                <th style="width:140px;">Total Marks</th>
                <th style="width:80px;">%</th>
              </tr>
            </thead>
            <tbody id="marksSubjectTbody">
              <!-- rows injected by generateSubjectRows() -->
            </tbody>
          </table>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" onclick="submitBulkMarks()" style="min-width:200px;">
            💾 Submit All Marks
          </button>
        </div>
      </div>
    </div>

    <!-- Marks List -->
    <div id="marksListArea" style="margin-top:30px;"></div>
  `;

  await refreshMarksList();
}

function setMarksAssignType(type) {
  marksAssignType = type;
  document.getElementById('marksPillAll').classList.toggle('active', type === 'all');
  document.getElementById('marksPillIndividual').classList.toggle('active', type === 'individual');
  document.getElementById('marksStudentSelect').style.display = type === 'individual' ? 'block' : 'none';
}

function setExamType(type) {
  marksExamType = type;
  document.getElementById('examTypeSem').classList.toggle('active', type === 'sem');
  document.getElementById('examTypeCat').classList.toggle('active', type === 'cat');
}

function generateSubjectRows() {
  const count = parseInt(document.getElementById('marksSubjectCount').value);
  const examName = document.getElementById('marksExamName').value.trim();
  const defaultTotal = document.getElementById('marksDefaultTotal').value || '100';

  if (!examName) { showToast('Please enter an Exam Name first', 'warning'); return; }
  if (!count || count < 1 || count > 20) { showToast('Enter a number of subjects between 1 and 20', 'warning'); return; }

  // Show the rows card
  document.getElementById('marksSubjectRowsCard').style.display = 'block';
  document.getElementById('marksTableHeading').textContent = `📋 ${examName} — Enter Marks`;
  document.getElementById('marksTableSubTitle').textContent =
    `${marksExamType === 'sem' ? 'Semester Exam' : 'CAT / Mid Exam'} • ${count} Subject${count > 1 ? 's' : ''} • Fill all rows and submit at once`;

  const tbody = document.getElementById('marksSubjectTbody');
  tbody.innerHTML = Array.from({ length: count }, (_, i) => `
    <tr id="markRow${i}">
      <td style="font-weight:700; color:var(--gold);">${i + 1}</td>
      <td>
        <input type="text" id="mSubject${i}" class="form-input" placeholder="Subject name" style="width:100%; min-width:160px;" />
      </td>
      <td>
        <input type="number" id="mScored${i}" class="form-input" min="0" placeholder="Scored" style="width:100%;"
          oninput="updateRowPct(${i})" />
      </td>
      <td>
        <input type="number" id="mTotal${i}" class="form-input" min="1" value="${defaultTotal}" style="width:100%;"
          oninput="updateRowPct(${i})" />
      </td>
      <td>
        <span id="mPct${i}" class="badge badge-primary" style="font-size:0.75rem;">—</span>
      </td>
    </tr>
  `).join('');

  // Scroll to the table
  document.getElementById('marksSubjectRowsCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateRowPct(i) {
  const scored = parseFloat(document.getElementById(`mScored${i}`).value);
  const total  = parseFloat(document.getElementById(`mTotal${i}`).value);
  const pctEl  = document.getElementById(`mPct${i}`);
  if (!pctEl) return;
  if (isNaN(scored) || isNaN(total) || total <= 0) { pctEl.textContent = '—'; pctEl.className = 'badge badge-primary'; return; }
  const pct = Math.round(scored / total * 100);
  pctEl.textContent = `${pct}%`;
  pctEl.className = `badge ${pct >= 75 ? 'badge-success' : pct >= 50 ? 'badge-warning' : 'badge-danger'}`;
}

async function submitBulkMarks() {
  const exam_name = document.getElementById('marksExamName').value.trim();
  const defaultTotal = parseFloat(document.getElementById('marksDefaultTotal').value) || 100;

  let student_id = 'all';
  if (marksAssignType === 'individual') {
    student_id = document.getElementById('marksStudent').value;
    if (!student_id) { showToast('Please select a student', 'warning'); return; }
  }

  // Collect all rows
  const tbody = document.getElementById('marksSubjectTbody');
  if (!tbody) { showToast('Please generate subject rows first', 'warning'); return; }
  const rowCount = tbody.querySelectorAll('tr').length;

  const entries = [];
  for (let i = 0; i < rowCount; i++) {
    const subject = document.getElementById(`mSubject${i}`)?.value.trim();
    const scored_marks = parseFloat(document.getElementById(`mScored${i}`)?.value);
    const total_marks  = parseFloat(document.getElementById(`mTotal${i}`)?.value) || defaultTotal;

    if (!subject) { showToast(`Row ${i + 1}: Please enter a subject name`, 'warning'); return; }
    if (isNaN(scored_marks)) { showToast(`Row ${i + 1} (${subject}): Please enter scored marks`, 'warning'); return; }
    if (scored_marks > total_marks) { showToast(`Row ${i + 1} (${subject}): Scored marks exceed total marks`, 'warning'); return; }

    entries.push({ subject, scored_marks, total_marks });
  }

  if (entries.length === 0) { showToast('No subject rows found', 'warning'); return; }

  try {
    // Submit all entries concurrently
    await Promise.all(entries.map(e =>
      api.marks.add({
        student_id,
        exam_type: marksExamType,
        exam_name,
        subject: e.subject,
        scored_marks: e.scored_marks,
        total_marks: e.total_marks,
      })
    ));

    const target = student_id === 'all' ? 'all students' : 'the selected student';
    showToast(`✅ ${entries.length} subject marks submitted for ${target}!`, 'success');

    // Reset form
    await loadMarksManager();
    // Scroll to list
    setTimeout(() => document.getElementById('marksListArea')?.scrollIntoView({ behavior: 'smooth' }), 400);
  } catch (err) {
    showToast('Error submitting marks: ' + err.message, 'error');
  }
}


async function refreshMarksList() {
  const container = document.getElementById('marksListArea');
  container.innerHTML = '<div class="loading-container"><div class="spinner"></div></div>';
  try {
    const marks = await api.marks.all();
    if (marks.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎓</div><h3>No marks assigned yet</h3></div>';
      return;
    }

    // Group by student
    const grouped = {};
    marks.forEach(m => {
      if (!grouped[m.student_name]) grouped[m.student_name] = { name: m.student_name, roll: m.roll_number, marks: [] };
      grouped[m.student_name].marks.push(m);
    });

    container.innerHTML = `
      <div class="flex-between" style="margin-bottom:16px;">
        <h3>📊 All Marks (${marks.length} records)</h3>
        <input type="text" class="search-input" placeholder="Search student..." style="max-width:200px;" oninput="filterMarksGroups(this.value)" />
      </div>
      ${Object.values(grouped).map(g => `
        <div class="marks-student-group" data-student="${g.name.toLowerCase()}">
          <div class="marks-student-header">
            <div class="student-avatar" style="width:32px; height:32px; font-size:0.75rem;">${getInitials(g.name)}</div>
            <span style="color:var(--navy); font-weight:700;">${escapeHtml(g.name)}</span>
            <span class="badge badge-cyan" style="margin-left:8px;">${g.roll}</span>
            <span class="badge badge-primary" style="margin-left:auto;">${g.marks.length} records</span>
          </div>
          <div class="table-wrapper" style="border-top:none; border-radius:0 0 var(--radius) var(--radius);">
            <table>
              <thead>
                <tr><th>Type</th><th>Exam Name</th><th>Subject</th><th>Scored</th><th>Total</th><th>%</th><th>Action</th></tr>
              </thead>
              <tbody>
                ${g.marks.map(m => {
                  const pct = Math.round(m.scored_marks / m.total_marks * 100);
                  return `
                    <tr>
                      <td><span class="badge ${m.exam_type === 'sem' ? 'badge-primary' : 'badge-purple'}">${m.exam_type === 'sem' ? 'Sem' : 'CAT'}</span></td>
                      <td>${escapeHtml(m.exam_name)}</td>
                      <td><strong>${escapeHtml(m.subject)}</strong></td>
                      <td>${m.scored_marks}</td>
                      <td>${m.total_marks}</td>
                      <td><span class="badge ${pct >= 75 ? 'badge-success' : pct >= 50 ? 'badge-warning' : 'badge-danger'}">${pct}%</span></td>
                      <td>
                        <div style="display:flex; gap:6px;">
                          <button class="btn btn-secondary btn-sm" onclick="openEditMarkModal('${m.id}')" title="Edit">✏️</button>
                          <button class="btn btn-danger btn-sm" onclick="deleteMark('${m.id}')">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `).join('')}
    `;
  } catch {}
}

function filterMarksGroups(q) {
  document.querySelectorAll('.marks-student-group').forEach(g => {
    g.style.display = g.dataset.student.includes(q.toLowerCase()) ? '' : 'none';
  });
}

async function deleteMark(id) {
  if (!confirm('Delete this mark record?')) return;
  try {
    await api.marks.delete(id);
    showToast('Mark deleted', 'info');
    await refreshMarksList();
  } catch {}
}

// ═══════════════════════════════════════
//  ATTENDANCE MANAGER
// ═══════════════════════════════════════
async function loadAttendanceManager() {
  await fetchStudents();
  const container = document.getElementById('attendanceContent');
  
  container.innerHTML = `
    <!-- Tabs for attendance modes -->
    <div class="marks-tabs" style="margin-bottom:20px;">
      <button class="marks-tab active" id="attModeCalendar" onclick="switchAttendanceMode('calendar')">📅 Daily Calendar Tracker</button>
      <button class="marks-tab" id="attModeCumulative" onclick="switchAttendanceMode('cumulative')">📊 Bulk Cumulative Updates</button>
    </div>

    <!-- Calendar Mode -->
    <div id="attendanceCalendarArea">
      <div class="attendance-form-card" style="margin-bottom:24px;">
        <h3>📅 Daily Attendance</h3>
        <p style="font-size:0.85rem; color:var(--text-2); margin-bottom:16px;">Select a date to mark daily present/absent statuses for all students.</p>
        <div class="form-group" style="max-width:280px;">
          <label>Select Date</label>
          <input type="date" id="dailyAttDate" class="form-input" onchange="fetchDailyAttendance()" />
        </div>
      </div>
      
      <div id="dailyAttendanceListCard" class="card" style="display:none; padding:24px;">
        <div class="flex-between" style="margin-bottom:18px; flex-wrap:wrap; gap:10px;">
          <h4>Students List (<span id="dailyAttCount">0</span> approved students)</h4>
          <button class="btn btn-secondary btn-sm" onclick="markAllDailyAttendance('present')">Mark All Present</button>
        </div>
        <div id="dailyAttListGrid" style="display:flex; flex-direction:column; gap:12px; margin-bottom:24px;">
          <!-- dynamically populated -->
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" onclick="saveDailyAttendance()">💾 Save Daily Attendance</button>
        </div>
      </div>
    </div>

    <!-- Cumulative Mode (Original layout) -->
    <div id="attendanceCumulativeArea" style="display:none;">
      <div class="attendance-form-card">
        <h3>📝 Update Attendance</h3>
        <div class="grid-2">
          <div class="form-group">
            <label>Select Student</label>
            <select id="attStudent" onchange="loadStudentAttendance()">
              <option value="">— Select a student —</option>
              ${allStudents.filter(s => s.approved !== false).map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${s.roll_number})</option>`).join('')}
            </select>
          </div>
          <div id="attCurrentDisplay" style="display:flex; align-items:center;">
            <div style="font-size:0.875rem; color:var(--text-2);">Select a student to view current attendance</div>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label>Days Present</label>
            <input type="number" id="attPresent" min="0" placeholder="e.g. 42" />
          </div>
          <div class="form-group">
            <label>Total Working Days</label>
            <input type="number" id="attTotal" min="0" placeholder="e.g. 60" />
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" onclick="updateAttendance()">💾 Save Attendance</button>
        </div>
      </div>
    </div>

    <!-- Attendance Table -->
    <div id="attendanceTableArea" style="margin-top:30px;"></div>
  `;

  // Set default date in calendar input to today's local date
  const dateInput = document.getElementById('dailyAttDate');
  if (dateInput) {
    const local = new Date();
    const offset = local.getTimezoneOffset();
    const localDate = new Date(local.getTime() - (offset * 60 * 1000));
    dateInput.value = localDate.toISOString().split('T')[0];
  }

  await refreshAttendanceTable();
  await fetchDailyAttendance();
}

async function loadStudentAttendance() {
  const studentId = document.getElementById('attStudent').value;
  if (!studentId) return;
  try {
    const att = await api.attendance.getStudent(studentId);
    document.getElementById('attPresent').value = att.days_present;
    document.getElementById('attTotal').value = att.total_days;
    const pct = att.total_days > 0 ? Math.round(att.days_present / att.total_days * 100) : 0;
    
    let color = 'var(--red)';
    if (pct >= 75) color = 'var(--green)';
    else if (pct >= 50) color = 'var(--amber)';

    document.getElementById('attCurrentDisplay').innerHTML = `
      <div class="stat-card" style="flex:1; margin:0;">
        <div class="stat-icon" style="background:var(--gold-pale);">📊</div>
        <div class="stat-info">
          <div class="stat-value" style="color:${color};">${pct}%</div>
          <div class="stat-label">Current Attendance</div>
        </div>
      </div>
    `;
  } catch {}
}

async function updateAttendance() {
  const student_id = document.getElementById('attStudent').value;
  const days_present = parseInt(document.getElementById('attPresent').value);
  const total_days = parseInt(document.getElementById('attTotal').value);

  if (!student_id) { showToast('Please select a student', 'warning'); return; }
  if (isNaN(days_present) || isNaN(total_days)) { showToast('Please enter valid numbers', 'warning'); return; }
  if (days_present > total_days) { showToast('Days present cannot exceed total days', 'warning'); return; }

  try {
    await api.attendance.update(student_id, { days_present, total_days });
    showToast('Attendance updated! ✅', 'success');
    await refreshAttendanceTable();
    await loadStudentAttendance();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function refreshAttendanceTable() {
  const container = document.getElementById('attendanceTableArea');
  container.innerHTML = '<div class="loading-container"><div class="spinner"></div></div>';
  try {
    const attendance = await api.attendance.getAll();
    if (attendance.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><h3>No attendance records yet</h3></div>';
      return;
    }

    container.innerHTML = `
      <div class="attendance-table-wrapper">
        <table>
          <thead>
            <tr><th>Student</th><th>Roll No.</th><th>Course</th><th>Present</th><th>Total</th><th>%</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${attendance.map(a => {
              const pct = a.total_days > 0 ? Math.round(a.days_present / a.total_days * 100) : 0;
              const status = pct >= 75 ? '✅ Good' : pct >= 50 ? '⚠️ Low' : '❌ Critical';
              const badgeClass = pct >= 75 ? 'success' : pct >= 50 ? 'warning' : 'danger';
              const barColor = pct >= 75 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
              return `
                <tr>
                  <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                      <div class="student-avatar" style="width:32px; height:32px; font-size:0.75rem;">${getInitials(a.student_name)}</div>
                      <strong style="color:var(--navy);">${escapeHtml(a.student_name)}</strong>
                    </div>
                  </td>
                  <td>${a.roll_number}</td>
                  <td>${escapeHtml(a.course)}</td>
                  <td>${a.days_present}</td>
                  <td>${a.total_days}</td>
                  <td>
                    <div class="attendance-progress-cell">
                      <div class="progress-bar-wrapper" style="width:60px;">
                        <div class="progress-bar" style="width:${pct}%; background:${barColor};"></div>
                      </div>
                      <span>${pct}%</span>
                    </div>
                  </td>
                  <td><span class="badge badge-${badgeClass}">${status}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch {}
}

// ═══════════════════════════════════════
//  EXPORT PAGE
// ═══════════════════════════════════════
function loadExportPage() {
  const container = document.getElementById('exportContent');
  container.innerHTML = `
    <div class="card" style="margin-bottom:24px;">
      <h3>📤 Export Data reports</h3>
      <p style="margin-top:8px; font-size:0.875rem; color:var(--text-2);">Download StudentOS data spreadsheets offline for report purposes.</p>
    </div>
    <div class="export-cards">
      <div class="export-card" onclick="exportMarks()">
        <div class="export-icon">🎓</div>
        <h3>Student Marks</h3>
        <p>Export all registered students mark details.</p>
        <button class="btn btn-primary" style="margin-top:14px; width:100%;">📥 Download Marks.xlsx</button>
      </div>
      <div class="export-card" onclick="exportAssignments()">
        <div class="export-icon">📋</div>
        <h3>Assignments</h3>
        <p>Export assignment logs and completions stats.</p>
        <button class="btn btn-primary" style="margin-top:14px; width:100%;">📥 Download Assignments.xlsx</button>
      </div>
      <div class="export-card" onclick="exportAttendance()">
        <div class="export-icon">📊</div>
        <h3>Attendance</h3>
        <p>Export full class attendance report details.</p>
        <button class="btn btn-primary" style="margin-top:14px; width:100%;">📥 Download Attendance.xlsx</button>
      </div>
      <div class="export-card" onclick="exportStudents()">
        <div class="export-icon">👥</div>
        <h3>Students List</h3>
        <p>Export registered student directory profiles.</p>
        <button class="btn btn-primary" style="margin-top:14px; width:100%;">📥 Download Students.xlsx</button>
      </div>
    </div>
  `;
}

async function exportMarks() {
  try {
    const data = await api.export.marks();
    downloadExcel(data, 'StudentOS_Marks', 'Marks');
    showToast('Marks exported successfully! 📥', 'success');
  } catch { showToast('Error exporting marks', 'error'); }
}

async function exportAssignments() {
  try {
    const data = await api.export.assignments();
    downloadExcel(data, 'StudentOS_Assignments', 'Assignments');
    showToast('Assignments exported! 📥', 'success');
  } catch { showToast('Error exporting assignments', 'error'); }
}

async function exportAttendance() {
  try {
    const att = await api.attendance.getAll();
    const data = att.map(a => ({
      'Student Name': a.student_name,
      'Roll Number': a.roll_number,
      'Course': a.course,
      'Days Present': a.days_present,
      'Total Days': a.total_days,
      'Percentage': a.total_days > 0 ? Math.round(a.days_present / a.total_days * 100) + '%' : '0%',
    }));
    downloadExcel(data, 'StudentOS_Attendance', 'Attendance');
    showToast('Attendance exported! 📥', 'success');
  } catch { showToast('Error exporting', 'error'); }
}

async function exportStudents() {
  try {
    const students = await api.student.list();
    const data = students.map(s => ({
      'Name': s.name,
      'Roll Number': s.roll_number,
      'Course': s.course,
      'Email': s.email,
      'Joined': formatDate(s.created_at),
    }));
    downloadExcel(data, 'StudentOS_Students', 'Students');
    showToast('Students exported! 📥', 'success');
  } catch { showToast('Error exporting', 'error'); }
}

function downloadExcel(data, filename, sheetName) {
  if (typeof XLSX === 'undefined') { showToast('XLSX library not loaded', 'error'); return; }
  if (data.length === 0) { showToast('No data to export', 'warning'); return; }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ═══════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── STUDENT APPROVALS & DELETIONS ── */
async function approveStudent(id) {
  try {
    await api.student.approve(id);
    showToast('Student approved! ✅', 'success');
    await loadStudentList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function removeStudent(id, isReject = false) {
  const label = isReject ? 'reject this student registration' : 'permanently remove this student and all their data';
  if (!confirm(`Are you sure you want to ${label}?`)) return;
  try {
    await api.student.delete(id);
    showToast(isReject ? 'Registration rejected' : 'Student removed successfully', 'info');
    await loadStudentList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── DAILY ATTENDANCE CALENDAR TRACKER ── */
function switchAttendanceMode(mode) {
  const calArea = document.getElementById('attendanceCalendarArea');
  const cumArea = document.getElementById('attendanceCumulativeArea');
  const calBtn = document.getElementById('attModeCalendar');
  const cumBtn = document.getElementById('attModeCumulative');

  if (calArea && cumArea && calBtn && cumBtn) {
    calArea.style.display = mode === 'calendar' ? 'block' : 'none';
    cumArea.style.display = mode === 'cumulative' ? 'block' : 'none';
    calBtn.classList.toggle('active', mode === 'calendar');
    cumBtn.classList.toggle('active', mode === 'cumulative');
  }
}

let currentDailyAttendance = [];

async function fetchDailyAttendance() {
  const date = document.getElementById('dailyAttDate').value;
  const listCard = document.getElementById('dailyAttendanceListCard');
  const listGrid = document.getElementById('dailyAttListGrid');
  const countSpan = document.getElementById('dailyAttCount');

  if (!date || !listCard || !listGrid) return;

  const approvedStudents = allStudents.filter(s => s.approved !== false);
  countSpan.textContent = approvedStudents.length;

  if (approvedStudents.length === 0) {
    listCard.style.display = 'block';
    listGrid.innerHTML = '<div class="empty-state"><p>No approved students to mark attendance.</p></div>';
    return;
  }

  listCard.style.display = 'block';
  listGrid.innerHTML = '<div class="loading-container"><div class="spinner"></div></div>';

  try {
    const existing = await api.attendance.getByDate(date);
    currentDailyAttendance = approvedStudents.map(s => {
      const rec = existing.find(r => r.student_id === s.id);
      return {
        student_id: s.id,
        name: s.name,
        roll: s.roll_number,
        status: rec ? rec.status : 'present'
      };
    });

    renderDailyAttendanceList();
  } catch (err) {
    listGrid.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

function renderDailyAttendanceList() {
  const listGrid = document.getElementById('dailyAttListGrid');
  if (!listGrid) return;

  listGrid.innerHTML = currentDailyAttendance.map(item => {
    const isPresent = item.status === 'present';
    return `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--bg-card); border-radius:var(--radius); border:1px solid var(--border);">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="student-avatar" style="width:32px; height:32px; font-size:0.75rem;">${getInitials(item.name)}</div>
          <div>
            <div style="font-weight:600; color:var(--navy); font-size:0.875rem;">${escapeHtml(item.name)}</div>
            <div style="font-size:0.75rem; color:var(--text-2);">${item.roll}</div>
          </div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-sm ${isPresent ? 'btn-success' : 'btn-secondary'}" onclick="toggleDailyStudentStatus('${item.student_id}', 'present')" style="padding:6px 14px;">Present</button>
          <button class="btn btn-sm ${!isPresent ? 'btn-danger' : 'btn-secondary'}" onclick="toggleDailyStudentStatus('${item.student_id}', 'absent')" style="padding:6px 14px;">Absent</button>
        </div>
      </div>
    `;
  }).join('');
}

function toggleDailyStudentStatus(studentId, status) {
  const item = currentDailyAttendance.find(i => i.student_id === studentId);
  if (item) {
    item.status = status;
    renderDailyAttendanceList();
  }
}

function markAllDailyAttendance(status) {
  currentDailyAttendance.forEach(i => i.status = status);
  renderDailyAttendanceList();
}

async function saveDailyAttendance() {
  const date = document.getElementById('dailyAttDate').value;
  if (!date) return;
  try {
    const body = currentDailyAttendance.map(i => ({ student_id: i.student_id, status: i.status }));
    await api.attendance.updateByDate(date, body);
    showToast('Daily attendance saved! ✅', 'success');
    await refreshAttendanceTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── MARKS EDIT MODAL OPERATIONS ── */
async function openEditMarkModal(id) {
  try {
    const marks = await api.marks.all();
    const record = marks.find(m => m.id === id);
    if (!record) return;

    document.getElementById('editMarkId').value = record.id;
    document.getElementById('editMarkStudentId').value = record.student_id;
    document.getElementById('editMarkExamType').value = record.exam_type;
    document.getElementById('editMarkExamName').value = record.exam_name;
    document.getElementById('editMarkSubject').value = record.subject;
    document.getElementById('editMarkScored').value = record.scored_marks;
    document.getElementById('editMarkTotal').value = record.total_marks;

    document.getElementById('editMarkModal').classList.add('active');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeEditMarkModal() {
  document.getElementById('editMarkModal').classList.remove('active');
}

async function submitEditMark() {
  const id = document.getElementById('editMarkId').value;
  const student_id = document.getElementById('editMarkStudentId').value;
  const exam_type = document.getElementById('editMarkExamType').value;
  const exam_name = document.getElementById('editMarkExamName').value.trim();
  const subject = document.getElementById('editMarkSubject').value.trim();
  const scored_marks = parseFloat(document.getElementById('editMarkScored').value);
  const total_marks = parseFloat(document.getElementById('editMarkTotal').value);

  if (!exam_name || !subject || isNaN(scored_marks) || isNaN(total_marks)) {
    showToast('Please fill all fields', 'warning');
    return;
  }
  if (scored_marks > total_marks) {
    showToast('Scored marks cannot exceed total marks', 'warning');
    return;
  }

  try {
    await api.marks.update(id, { student_id, exam_type, exam_name, subject, scored_marks, total_marks });
    showToast('Marks updated successfully! ✅', 'success');
    closeEditMarkModal();
    await refreshMarksList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── INCHARGE NOTES MANAGER ── */
async function loadNotesManager() {
  await fetchStudents();
  const container = document.getElementById('notesContent');
  const approvedStudents = allStudents.filter(s => s.approved !== false);

  container.innerHTML = `
    <!-- Create/Edit Note Form -->
    <div class="marks-form-card" id="noteFormCard">
      <h3 id="noteFormTitle">📝 Create Note</h3>
      
      <input type="hidden" id="noteId" />
      
      <div class="form-group">
        <label>Assign To</label>
        <select id="noteStudentTarget" class="form-input" style="width:100%;">
          <option value="all">🌐 All Students (Class note)</option>
          ${approvedStudents.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${s.roll_number})</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label>Title</label>
        <input type="text" id="noteTitle" class="form-input" placeholder="e.g. Exam Schedule" />
      </div>

      <div class="form-group">
        <label>Content</label>
        <textarea id="noteContentText" class="form-input" placeholder="Enter note details here..." rows="4" style="width:100%; font-family:var(--font-body); padding:10px; border-radius:var(--radius); border:1px solid var(--border);"></textarea>
      </div>

      <div class="form-group">
        <label>Color Tag</label>
        <div style="display:flex; gap:10px; align-items:center;">
          <input type="color" id="noteColor" value="#C89B3C" style="border:none; width:44px; height:44px; padding:0; border-radius:50%; cursor:pointer; background:none;" />
          <span style="font-size:0.84rem; color:var(--text-2);">Click circle to select a custom color tag</span>
        </div>
      </div>

      <div class="form-actions" style="display:flex; gap:12px; margin-top:20px;">
        <button class="btn btn-primary" id="saveNoteBtn" onclick="saveInchargeNote()">💾 Create Note</button>
        <button class="btn btn-secondary" id="cancelNoteBtn" onclick="resetNoteForm()" style="display:none;">Cancel</button>
      </div>
    </div>

    <!-- Notes List -->
    <div style="margin-top:30px;">
      <div class="flex-between" style="margin-bottom:18px;">
        <h3>📋 All Notes</h3>
        <input type="text" class="search-input" placeholder="🔍 Search notes..." style="max-width:220px;" oninput="filterInchargeNotes(this.value)" />
      </div>
      <div id="inchargeNotesGrid" class="notes-grid">
        <div class="loading-container"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  await refreshInchargeNotesList();
}

async function refreshInchargeNotesList() {
  const grid = document.getElementById('inchargeNotesGrid');
  if (!grid) return;
  try {
    const notes = await api.notes.all();
    const myNotes = notes.filter(n => n.author === 'incharge');
    if (myNotes.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">📝</div><h3>No notes created by incharge</h3></div>';
      return;
    }

    grid.innerHTML = myNotes.map(n => `
      <div class="note-card incharge-note-item" style="--note-color: ${n.color};" data-title="${n.title.toLowerCase()}" data-content="${n.content.toLowerCase()}">
        <div class="note-title">${escapeHtml(n.title)}</div>
        <div style="font-size:0.7rem; margin-bottom:8px;">
          <span class="badge ${n.student_id === 'all' ? 'badge-primary' : 'badge-purple'}">
            🎯 Target: ${escapeHtml(n.student_name)}
          </span>
        </div>
        <div class="note-content">${escapeHtml(n.content) || '<em style="color:var(--text-3);">No content</em>'}</div>
        <div class="note-footer">
          <span class="note-date">📅 ${formatDate(n.updated_at)}</span>
          <div class="note-actions" onclick="event.stopPropagation()">
            <button class="btn btn-icon btn-secondary" onclick="editInchargeNote('${n.id}')" title="Edit">✏️</button>
            <button class="btn btn-icon btn-danger" onclick="deleteInchargeNote('${n.id}')" title="Delete">🗑️</button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><p>Error loading notes: ${err.message}</p></div>`;
  }
}

function filterInchargeNotes(q) {
  const query = q.toLowerCase();
  document.querySelectorAll('.incharge-note-item').forEach(item => {
    const match = item.dataset.title.includes(query) || item.dataset.content.includes(query);
    item.style.display = match ? '' : 'none';
  });
}

async function saveInchargeNote() {
  const target = document.getElementById('noteStudentTarget').value;
  const title = document.getElementById('noteTitle').value.trim();
  const content = document.getElementById('noteContentText').value.trim();
  const color = document.getElementById('noteColor').value;
  const id = document.getElementById('noteId').value;

  if (!title) {
    showToast('Please enter a title', 'warning');
    return;
  }

  try {
    if (id) {
      await api.notes.update(id, { title, content, color, student_id: target });
      showToast('Note updated! ✅', 'success');
    } else {
      await api.notes.add({ student_id: target, title, content, color, author: 'incharge' });
      showToast('Note created! ✅', 'success');
    }
    resetNoteForm();
    await refreshInchargeNotesList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function editInchargeNote(id) {
  try {
    const notes = await api.notes.all();
    const note = notes.find(n => n.id === id);
    if (!note) return;

    document.getElementById('noteId').value = note.id;
    document.getElementById('noteStudentTarget').value = note.student_id;
    document.getElementById('noteTitle').value = note.title;
    document.getElementById('noteContentText').value = note.content;
    document.getElementById('noteColor').value = note.color;

    document.getElementById('noteFormTitle').textContent = '✏️ Edit Note';
    document.getElementById('saveNoteBtn').textContent = '💾 Save Note';
    document.getElementById('cancelNoteBtn').style.display = 'block';

    document.getElementById('noteFormCard').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function resetNoteForm() {
  document.getElementById('noteId').value = '';
  document.getElementById('noteStudentTarget').value = 'all';
  document.getElementById('noteTitle').value = '';
  document.getElementById('noteContentText').value = '';
  document.getElementById('noteColor').value = '#C89B3C';

  document.getElementById('noteFormTitle').textContent = '📝 Create Note';
  document.getElementById('saveNoteBtn').textContent = '💾 Create Note';
  document.getElementById('cancelNoteBtn').style.display = 'none';
}

async function deleteInchargeNote(id) {
  if (!confirm('Are you sure you want to delete this note?')) return;
  try {
    await api.notes.delete(id);
    showToast('Note deleted successfully', 'info');
    await refreshInchargeNotesList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
