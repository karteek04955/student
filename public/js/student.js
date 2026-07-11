/**
 * student.js - Student Portal Logic
 */

let currentStudent = null;
let analyticsCharts = {};
let currentNoteEdit = null;

// ═══════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  const stored = localStorage.getItem('currentStudent');
  if (!stored) {
    window.location.href = 'student-login.html';
    return;
  }

  currentStudent = JSON.parse(stored);
  populateSidebarUser();
  await loadSection('dashboard');

  // Nav click handlers
  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      loadSection(section);
      // Close sidebar on mobile after nav click
      closeSidebar();
    });
  });

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('currentStudent');
      window.location.href = 'student-login.html';
    });
  }

  // Hamburger / mobile sidebar
  const hamburger = document.getElementById('hamburger');
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebarOverlay');

  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('active');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }
});

function closeSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  if (sidebar)  sidebar.classList.remove('open');
  if (overlay)  overlay.classList.remove('active');
}

function populateSidebarUser() {
  const nameEl   = document.getElementById('sidebarUserName');
  const courseEl = document.getElementById('sidebarUserCourse');
  const avatarEl = document.getElementById('sidebarAvatar');
  if (nameEl)   nameEl.textContent   = currentStudent.name;
  if (courseEl) courseEl.textContent = currentStudent.course;
  if (avatarEl) avatarEl.textContent = getInitials(currentStudent.name);
}

// ═══════════════════════════════════════
//  SECTION ROUTER
// ═══════════════════════════════════════
async function loadSection(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`section-${section}`);
  if (el) el.classList.add('active');

  const titles = {
    dashboard:   { title: 'Dashboard',      sub: 'Your academic overview' },
    timetable:   { title: 'Timetable',      sub: 'Your class schedule 📅' },
    notes:       { title: 'My Notes',       sub: 'Your personal study notes 📝' },
    assignments: { title: 'Assignments',    sub: 'Track your tasks 📋' },
    attendance:  { title: 'Attendance',     sub: 'Your attendance record 📊' },
    marks:       { title: 'Marks',          sub: 'Your academic performance 🎓' },
    analytics:   { title: 'Analytics',      sub: 'Performance insights 📈' },
    ai:          { title: 'AI Assistant',   sub: 'Your 24/7 study buddy 🤖' },
    profile:     { title: 'My Profile',     sub: 'Your account details 👤' },
  };

  const info = titles[section] || { title: section, sub: '' };
  const titleEl    = document.getElementById('headerTitle');
  const subtitleEl = document.getElementById('headerSubtitle');
  if (titleEl)    titleEl.textContent    = info.title;
  if (subtitleEl) subtitleEl.textContent = info.sub;

  const loaders = {
    dashboard:   loadDashboard,
    timetable:   loadTimetable,
    notes:       loadNotes,
    assignments: loadAssignments,
    attendance:  loadAttendance,
    marks:       loadMarks,
    analytics:   loadAnalytics,
    ai:          initAIAssistant,
    profile:     loadProfile,
  };

  if (loaders[section]) await loaders[section]();
}

// ═══════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════
async function loadDashboard() {
  try {
    const [attendance, marks, assignments] = await Promise.all([
      api.attendance.getStudent(currentStudent.id),
      api.marks.forStudent(currentStudent.id),
      api.assignments.forStudent(currentStudent.id),
    ]);

    const attPercent = attendance.total_days > 0
      ? Math.round((attendance.days_present / attendance.total_days) * 100) : 0;
    const pending = assignments.filter(a => !a.is_completed).length;
    const avgMark = marks.length
      ? Math.round(marks.reduce((s, m) => s + (m.scored_marks / m.total_marks * 100), 0) / marks.length) : 0;
    const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const nameEl = document.getElementById('dashWelcomeName');
    const dateEl = document.getElementById('dashDate');
    const attEl  = document.getElementById('statAttendance');
    const pendEl = document.getElementById('statPending');
    const mrkEl  = document.getElementById('statMarks');
    const notEl  = document.getElementById('statNotes');

    if (nameEl) nameEl.textContent = currentStudent.name.split(' ')[0];
    if (dateEl) dateEl.textContent = '📅 ' + today;
    if (attEl)  attEl.textContent  = `${attPercent}%`;
    if (pendEl) pendEl.textContent = pending;
    if (mrkEl)  mrkEl.textContent  = `${avgMark}%`;

    // Notes count
    const notes = await api.notes.get(currentStudent.id);
    if (notEl) notEl.textContent = notes.length;

    // Upcoming assignments
    const upcoming  = assignments.filter(a => !a.is_completed).slice(0, 3);
    const assignEl  = document.getElementById('dashAssignments');
    if (assignEl) {
      if (upcoming.length === 0) {
        assignEl.innerHTML = '<div class="empty-state" style="padding:30px;"><div class="empty-state-icon">✅</div><h3>All caught up!</h3><p>No pending assignments.</p></div>';
      } else {
        assignEl.innerHTML = upcoming.map(a => `
          <div class="assignment-item" style="margin-bottom:8px;">
            <div class="assignment-icon">📋</div>
            <div class="assignment-info">
              <div class="assignment-subject">${escapeHtml(a.subject)}</div>
              <div class="due-date ${isOverdue(a.due_date) ? 'overdue' : isDueSoon(a.due_date) ? 'due-soon' : ''}">
                📅 Due: ${formatDate(a.due_date)} ${isOverdue(a.due_date) ? '(Overdue!)' : isDueSoon(a.due_date) ? '(Due soon!)' : ''}
              </div>
            </div>
          </div>
        `).join('');
      }
    }

    // Recent marks
    const recentMarks = marks.slice(0, 3);
    const marksEl = document.getElementById('dashMarks');
    if (marksEl) {
      if (recentMarks.length === 0) {
        marksEl.innerHTML = '<div class="empty-state" style="padding:30px;"><div class="empty-state-icon">📊</div><h3>No marks yet</h3></div>';
      } else {
        marksEl.innerHTML = recentMarks.map(m => {
          const pct = Math.round((m.scored_marks / m.total_marks) * 100);
          const color = pct >= 75 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
          return `
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
              <div style="flex:1; min-width:0;">
                <div style="font-family:var(--font-heading); font-weight:700; font-size:0.875rem; color:var(--navy);">${escapeHtml(m.subject)}</div>
                <div style="font-size:0.75rem; color:var(--text-2);">${escapeHtml(m.exam_name)}</div>
                <div class="progress-bar-wrapper" style="margin-top:5px;">
                  <div class="progress-bar" style="width:${pct}%; background:${color};"></div>
                </div>
              </div>
              <span class="badge ${pct >= 75 ? 'badge-success' : pct >= 50 ? 'badge-warning' : 'badge-danger'}">${pct}%</span>
            </div>
          `;
        }).join('');
      }
    }
  } catch (err) {
    showToast('Error loading dashboard', 'error');
  }
}

// ═══════════════════════════════════════
//  TIMETABLE
// ═══════════════════════════════════════
async function loadTimetable() {
  const container = document.getElementById('timetableContent');
  if (!container) return;
  container.innerHTML = '<div class="loading-container"><div class="spinner"></div></div>';
  try {
    const entries = await api.timetable.get();
    if (entries.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><h3>No timetable yet</h3><p>The class incharge hasn\'t set up the timetable yet.</p></div>';
      return;
    }

    const days    = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const grouped = {};
    days.forEach(d => { grouped[d] = []; });
    entries.forEach(e => {
      if (!grouped[e.day]) grouped[e.day] = [];
      grouped[e.day].push(e);
    });

    const dayEmojis = { Monday: '🌙', Tuesday: '🔥', Wednesday: '💫', Thursday: '⚡', Friday: '🎉', Saturday: '✨' };

    container.innerHTML = days.filter(d => grouped[d].length > 0).map(day => `
      <div class="day-card">
        <div class="day-header">${dayEmojis[day] || '📅'} ${day}</div>
        <div class="period-list">
          ${grouped[day].sort((a, b) => a.period - b.period).map(e => `
            <div class="period-item">
              <div class="period-number">P${e.period}</div>
              <div class="period-subject">${escapeHtml(e.subject)}</div>
              <div class="period-timing">🕐 ${escapeHtml(e.timing)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Error loading timetable</h3></div>';
  }
}

// ═══════════════════════════════════════
//  NOTES
// ═══════════════════════════════════════
async function loadNotes() {
  const container = document.getElementById('notesContent');
  if (!container) return;
  container.innerHTML = '<div class="loading-container"><div class="spinner"></div></div>';
  try {
    const notes = await api.notes.get(currentStudent.id);
    renderNotes(notes);
  } catch {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Error loading notes</h3></div>';
  }
}

function renderNotes(notes) {
  const container = document.getElementById('notesContent');
  if (!container) return;
  if (notes.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><h3>No notes yet</h3><p>Click "New Note" to create your first note.</p></div>';
    return;
  }
  container.innerHTML = `
    <div class="notes-grid">
      ${notes.map(n => `
        <div class="note-card" style="--note-color: ${n.color};" onclick="openNoteModal('${n.id}')">
          <div class="note-title">${escapeHtml(n.title)}</div>
          <div class="note-content">${escapeHtml(n.content) || '<em style="color:var(--text-3);">No content</em>'}</div>
          <div class="note-footer">
            <span class="note-date">📅 ${formatDate(n.updated_at)}</span>
            <div class="note-actions" onclick="event.stopPropagation()">
              <button class="btn btn-icon btn-secondary" onclick="openNoteModal('${n.id}')" title="Edit">✏️</button>
              <button class="btn btn-icon btn-danger" onclick="deleteNote(${n.id})" title="Delete">🗑️</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function openNewNoteModal() {
  currentNoteEdit = null;
  document.getElementById('noteModalTitle').textContent = 'New Note';
  document.getElementById('noteTitle').value   = '';
  document.getElementById('noteContent').value = '';
  document.getElementById('noteColor').value   = '#C89B3C';
  document.getElementById('noteModal').classList.add('active');
}

async function openNoteModal(id) {
  try {
    const notes = await api.notes.get(currentStudent.id);
    const note  = notes.find(n => String(n.id) === String(id));
    if (!note) return;
    currentNoteEdit = note;
    document.getElementById('noteModalTitle').textContent = 'Edit Note';
    document.getElementById('noteTitle').value   = note.title;
    document.getElementById('noteContent').value = note.content;
    document.getElementById('noteColor').value   = note.color;
    document.getElementById('noteModal').classList.add('active');
  } catch {}
}

function closeNoteModal() {
  document.getElementById('noteModal').classList.remove('active');
}

async function saveNote() {
  const title   = document.getElementById('noteTitle').value.trim();
  const content = document.getElementById('noteContent').value.trim();
  const color   = document.getElementById('noteColor').value;
  if (!title) { showToast('Please enter a title', 'warning'); return; }
  try {
    if (currentNoteEdit) {
      await api.notes.update(currentNoteEdit.id, { title, content, color });
      showToast('Note updated! ✅', 'success');
    } else {
      await api.notes.add({ student_id: currentStudent.id, title, content, color });
      showToast('Note saved! ✅', 'success');
    }
    closeNoteModal();
    await loadNotes();
  } catch {
    showToast('Error saving note', 'error');
  }
}

async function deleteNote(id) {
  if (!confirm('Delete this note?')) return;
  try {
    await api.notes.delete(id);
    showToast('Note deleted', 'info');
    await loadNotes();
  } catch {
    showToast('Error deleting note', 'error');
  }
}

// ═══════════════════════════════════════
//  ASSIGNMENTS
// ═══════════════════════════════════════
async function loadAssignments() {
  const container = document.getElementById('assignmentsContent');
  if (!container) return;
  container.innerHTML = '<div class="loading-container"><div class="spinner"></div></div>';
  try {
    const assignments = await api.assignments.forStudent(currentStudent.id);
    if (assignments.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><h3>No assignments</h3><p>No assignments have been given yet.</p></div>';
      return;
    }
    renderAssignments(assignments);
  } catch {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Error loading assignments</h3></div>';
  }
}

function renderAssignments(assignments) {
  const container = document.getElementById('assignmentsContent');
  if (!container) return;
  const pending   = assignments.filter(a => !a.is_completed);
  const completed = assignments.filter(a => a.is_completed);

  container.innerHTML = `
    <div style="margin-bottom:14px; display:flex; gap:8px; flex-wrap:wrap;">
      <span class="badge badge-warning">⏳ Pending: ${pending.length}</span>
      <span class="badge badge-success">✅ Completed: ${completed.length}</span>
    </div>
    <div class="assignment-list">
      ${assignments.map(a => {
        const overdue = isOverdue(a.due_date) && !a.is_completed;
        const soon    = isDueSoon(a.due_date) && !a.is_completed;
        return `
          <div class="assignment-item ${a.is_completed ? 'completed' : ''}">
            <div class="assignment-icon">${a.is_completed ? '✅' : overdue ? '🔴' : '📋'}</div>
            <div class="assignment-info">
              <div class="assignment-subject">${escapeHtml(a.subject)}</div>
              ${a.description ? `<div class="assignment-desc">${escapeHtml(a.description)}</div>` : ''}
              <div class="assignment-meta">
                <span class="due-date ${overdue ? 'overdue' : soon ? 'due-soon' : ''}">
                  📅 Due: ${formatDate(a.due_date)} ${overdue ? '⚠️ Overdue!' : soon ? '⚡ Due Soon!' : ''}
                </span>
                ${a.created_for === 'all' ? '<span class="badge badge-cyan">All Students</span>' : '<span class="badge badge-purple">Individual</span>'}
              </div>
            </div>
            <div style="flex-shrink:0;">
              ${a.is_completed
                ? `<button class="btn btn-secondary btn-sm" onclick="toggleAssignment(${a.id}, false)">↩️ Undo</button>`
                : `<button class="btn btn-success btn-sm" onclick="toggleAssignment(${a.id}, true)">✅ Done</button>`
              }
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function toggleAssignment(id, complete) {
  try {
    if (complete) {
      await api.assignments.complete(id, currentStudent.id);
      showToast('Assignment marked complete! 🎉', 'success');
    } else {
      await api.assignments.uncomplete(id, currentStudent.id);
      showToast('Marked as pending', 'info');
    }
    await loadAssignments();
  } catch {
    showToast('Error updating assignment', 'error');
  }
}

// ═══════════════════════════════════════
//  ATTENDANCE
// ═══════════════════════════════════════
async function loadAttendance() {
  const container = document.getElementById('attendanceContent');
  if (!container) return;
  container.innerHTML = '<div class="loading-container"><div class="spinner"></div></div>';
  try {
    const att     = await api.attendance.getStudent(currentStudent.id);
    const percent = att.total_days > 0 ? Math.round((att.days_present / att.total_days) * 100) : 0;
    const absent  = att.total_days - att.days_present;
    const color   = percent >= 75 ? 'var(--green)' : percent >= 50 ? 'var(--amber)' : 'var(--red)';
    const status  = percent >= 75 ? '✅ Good Standing' : percent >= 50 ? '⚠️ Needs Improvement' : '❌ Below 50% — Critical';

    container.innerHTML = `
      <div class="attendance-overview">
        <div class="attendance-circle">
          <div class="circle-percent" style="color:${color};">${percent}%</div>
          <div class="circle-label">Attendance Percentage</div>
          <span class="badge" style="background:${color}20; color:${color}; margin-top:4px;">${status}</span>
          <div class="progress-bar-wrapper" style="width:180px; margin-top:14px;">
            <div class="progress-bar" style="width:${percent}%; background:${color};"></div>
          </div>
        </div>

        <div class="attendance-stats">
          <div class="att-stat-row">
            <div class="stat-icon" style="background:var(--green-bg);">✅</div>
            <div class="stat-info">
              <div class="stat-value" style="color:var(--green);">${att.days_present}</div>
              <div class="stat-label">Days Present</div>
            </div>
          </div>
          <div class="att-stat-row">
            <div class="stat-icon" style="background:var(--red-bg);">❌</div>
            <div class="stat-info">
              <div class="stat-value" style="color:var(--red);">${absent}</div>
              <div class="stat-label">Days Absent</div>
            </div>
          </div>
          <div class="att-stat-row">
            <div class="stat-icon" style="background:var(--blue-bg);">📅</div>
            <div class="stat-info">
              <div class="stat-value">${att.total_days}</div>
              <div class="stat-label">Total Working Days</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">📊 Attendance Breakdown</div>
        </div>
        <div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.82rem;">
            <span>Present</span><span style="color:var(--green); font-weight:600;">${att.days_present} days</span>
          </div>
          <div class="progress-bar-wrapper" style="margin-bottom:14px;">
            <div class="progress-bar" style="width:${percent}%; background:var(--green);"></div>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.82rem;">
            <span>Absent</span><span style="color:var(--red); font-weight:600;">${absent} days</span>
          </div>
          <div class="progress-bar-wrapper">
            <div class="progress-bar" style="width:${att.total_days > 0 ? Math.round(absent/att.total_days*100) : 0}%; background:var(--red);"></div>
          </div>
        </div>
        ${percent < 75 ? `
          <div style="margin-top:16px; padding:12px 16px; background:var(--amber-bg); border:1px solid rgba(217,119,6,0.2); border-radius:var(--radius-lg); font-size:0.875rem; color:var(--amber);">
            ⚠️ Your attendance is below 75%. You need <strong>${att.total_days > 0 ? Math.max(0, Math.ceil(0.75 * att.total_days) - att.days_present) : 0}</strong> more present days to reach 75%.
          </div>
        ` : ''}
      </div>
    `;
  } catch {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Error loading attendance</h3></div>';
  }
}

// ═══════════════════════════════════════
//  MARKS
// ═══════════════════════════════════════
async function loadMarks() {
  const container = document.getElementById('marksContent');
  if (!container) return;
  container.innerHTML = '<div class="loading-container"><div class="spinner"></div></div>';
  try {
    const marks = await api.marks.forStudent(currentStudent.id);
    if (marks.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎓</div><h3>No marks yet</h3><p>Marks will appear here once assigned by your class incharge.</p></div>';
      return;
    }

    const sem = marks.filter(m => m.exam_type === 'sem');
    const cat = marks.filter(m => m.exam_type === 'cat');

    container.innerHTML = `
      <div class="marks-tabs">
        <button class="marks-tab active" onclick="switchMarksTab('all', this)">All (${marks.length})</button>
        <button class="marks-tab" onclick="switchMarksTab('sem', this)">Sem Exams (${sem.length})</button>
        <button class="marks-tab" onclick="switchMarksTab('cat', this)">CAT / Mid (${cat.length})</button>
      </div>
      <div id="marksTableAll">${renderMarksTable(marks)}</div>
      <div id="marksTableSem" style="display:none;">${renderMarksTable(sem)}</div>
      <div id="marksTableCat" style="display:none;">${renderMarksTable(cat)}</div>
    `;
  } catch {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Error loading marks</h3></div>';
  }
}

function renderMarksTable(marks) {
  if (marks.length === 0) return '<div class="empty-state" style="padding:40px;"><div class="empty-state-icon">📋</div><h3>No records</h3></div>';
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Type</th>
            <th>Exam Name</th>
            <th>Subject</th>
            <th>Scored</th>
            <th>Total</th>
            <th>Percentage</th>
            <th>Grade</th>
          </tr>
        </thead>
        <tbody>
          ${marks.map((m, i) => {
            const pct   = Math.round((m.scored_marks / m.total_marks) * 100);
            const grade = pct >= 90 ? 'O' : pct >= 80 ? 'A+' : pct >= 70 ? 'A' : pct >= 60 ? 'B+' : pct >= 50 ? 'B' : pct >= 40 ? 'C' : 'F';
            const gc    = pct >= 75 ? 'success' : pct >= 50 ? 'warning' : 'danger';
            return `
              <tr>
                <td>${i + 1}</td>
                <td><span class="badge ${m.exam_type === 'sem' ? 'badge-primary' : 'badge-purple'}">${m.exam_type === 'sem' ? 'Sem' : 'CAT'}</span></td>
                <td>${escapeHtml(m.exam_name)}</td>
                <td><strong>${escapeHtml(m.subject)}</strong></td>
                <td>${m.scored_marks}</td>
                <td>${m.total_marks}</td>
                <td>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <div class="progress-bar-wrapper" style="width:70px; height:5px;">
                      <div class="progress-bar" style="width:${pct}%; background:${pct >= 75 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)'};"></div>
                    </div>
                    <span class="badge badge-${gc}">${pct}%</span>
                  </div>
                </td>
                <td><span class="badge badge-${gc}">${grade}</span></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function switchMarksTab(type, btn) {
  document.querySelectorAll('.marks-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  ['all', 'sem', 'cat'].forEach(t => {
    const el = document.getElementById(`marksTable${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (el) el.style.display = t === type ? 'block' : 'none';
  });
}

// ═══════════════════════════════════════
//  ANALYTICS
// ═══════════════════════════════════════
async function loadAnalytics() {
  const container = document.getElementById('analyticsContent');
  if (!container) return;
  container.innerHTML = '<div class="loading-container"><div class="spinner"></div></div>';

  // Destroy old charts
  Object.values(analyticsCharts).forEach(c => c.destroy());
  analyticsCharts = {};

  try {
    const marks = await api.marks.forStudent(currentStudent.id);
    if (marks.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📈</div><h3>No data yet</h3><p>Analytics will appear once you have marks assigned.</p></div>';
      return;
    }

    const subjects    = [...new Set(marks.map(m => m.subject))];
    const subjectAvgs = subjects.map(s => {
      const sm  = marks.filter(m => m.subject === s);
      const avg = sm.reduce((sum, m) => sum + (m.scored_marks / m.total_marks * 100), 0) / sm.length;
      return { subject: s, avg: Math.round(avg) };
    });

    const semMarks = marks.filter(m => m.exam_type === 'sem');
    const catMarks = marks.filter(m => m.exam_type === 'cat');
    const semAvg   = semMarks.length ? Math.round(semMarks.reduce((s, m) => s + m.scored_marks / m.total_marks * 100, 0) / semMarks.length) : 0;
    const catAvg   = catMarks.length ? Math.round(catMarks.reduce((s, m) => s + m.scored_marks / m.total_marks * 100, 0) / catMarks.length) : 0;
    const overall  = Math.round(marks.reduce((s, m) => s + m.scored_marks / m.total_marks * 100, 0) / marks.length);

    container.innerHTML = `
      <div class="stats-grid" style="margin-bottom:24px;">
        <div class="stat-card"><div class="stat-icon" style="background:var(--blue-bg);">📊</div><div class="stat-info"><div class="stat-value">${overall}%</div><div class="stat-label">Overall Average</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:var(--green-bg);">📚</div><div class="stat-info"><div class="stat-value">${semAvg}%</div><div class="stat-label">Sem Exam Avg</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:var(--amber-bg);">📝</div><div class="stat-info"><div class="stat-value">${catAvg}%</div><div class="stat-label">CAT / Mid Avg</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:var(--gold-pale);">🎯</div><div class="stat-info"><div class="stat-value">${marks.length}</div><div class="stat-label">Total Exams</div></div></div>
      </div>
      <div class="analytics-grid">
        <div class="chart-card"><div class="chart-title">📊 Subject-wise Performance</div><canvas id="chartSubject"></canvas></div>
        <div class="chart-card"><div class="chart-title">🥧 Score Distribution</div><canvas id="chartPie"></canvas></div>
        <div class="chart-card"><div class="chart-title">📈 All Exam Scores</div><canvas id="chartLine"></canvas></div>
        <div class="chart-card"><div class="chart-title">⚖️ Sem vs CAT Comparison</div><canvas id="chartCompare"></canvas></div>
      </div>
    `;

    const barColors = ['#1F2A44','#C89B3C','#2E3E62','#D4AF5C','#4A6FA5','#B8893A'];

    analyticsCharts.subject = new Chart(document.getElementById('chartSubject'), {
      type: 'bar',
      data: {
        labels: subjectAvgs.map(s => s.subject),
        datasets: [{ label: 'Average %', data: subjectAvgs.map(s => s.avg),
          backgroundColor: subjectAvgs.map((_, i) => barColors[i % barColors.length] + 'CC'),
          borderColor: subjectAvgs.map((_, i) => barColors[i % barColors.length]),
          borderWidth: 2, borderRadius: 8 }]
      },
      options: chartOptions('Subject Performance (%)', true)
    });

    const gradeCount = { 'A/O (≥80%)': 0, 'B (60-79%)': 0, 'C (40-59%)': 0, 'F (<40%)': 0 };
    marks.forEach(m => {
      const p = m.scored_marks / m.total_marks * 100;
      if (p >= 80) gradeCount['A/O (≥80%)']++;
      else if (p >= 60) gradeCount['B (60-79%)']++;
      else if (p >= 40) gradeCount['C (40-59%)']++;
      else gradeCount['F (<40%)']++;
    });

    analyticsCharts.pie = new Chart(document.getElementById('chartPie'), {
      type: 'doughnut',
      data: {
        labels: Object.keys(gradeCount),
        datasets: [{ data: Object.values(gradeCount), backgroundColor: ['#16A34A','#C89B3C','#D97706','#DC2626'], borderWidth: 0, hoverOffset: 8 }]
      },
      options: { ...chartOptions(), plugins: { legend: { position: 'bottom', labels: { color: '#5A6480', padding: 18, font: { family: 'Inter', weight: '600' } } } } }
    });

    analyticsCharts.line = new Chart(document.getElementById('chartLine'), {
      type: 'line',
      data: {
        labels: marks.map((m, i) => `${m.subject.slice(0,8)} #${i + 1}`),
        datasets: [{ label: 'Score %', data: marks.map(m => Math.round(m.scored_marks / m.total_marks * 100)),
          borderColor: '#C89B3C', backgroundColor: 'rgba(200,155,60,0.08)', fill: true, tension: 0.4,
          pointBackgroundColor: '#C89B3C', pointBorderColor: '#FFFFFF', pointBorderWidth: 2, pointRadius: 5 }]
      },
      options: chartOptions('Score Trend (%)', true)
    });

    analyticsCharts.compare = new Chart(document.getElementById('chartCompare'), {
      type: 'bar',
      data: {
        labels: ['Semester Exams', 'CAT / Mid Exams'],
        datasets: [{ label: 'Average %', data: [semAvg, catAvg],
          backgroundColor: ['rgba(31,42,68,0.75)', 'rgba(200,155,60,0.75)'],
          borderColor: ['#1F2A44', '#C89B3C'], borderWidth: 2, borderRadius: 12 }]
      },
      options: chartOptions('Average Score (%)', true)
    });

  } catch {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Error loading analytics</h3></div>';
  }
}

function chartOptions(yLabel = '', showAxis = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1F2A44', titleColor: '#FFFFFF', bodyColor: '#D4AF5C',
        borderColor: 'rgba(200,155,60,0.3)', borderWidth: 1, padding: 12, cornerRadius: 10,
        titleFont: { family: 'Playfair Display', weight: '700' },
        bodyFont: { family: 'Inter' },
      }
    },
    scales: showAxis ? {
      x: { grid: { color: 'rgba(31,42,68,0.05)' }, ticks: { color: '#9CA3AF', font: { size: 11, family: 'Inter' } } },
      y: { grid: { color: 'rgba(31,42,68,0.05)' }, ticks: { color: '#9CA3AF', font: { family: 'Inter' } }, max: 100, min: 0,
        title: { display: !!yLabel, text: yLabel, color: '#9CA3AF', font: { family: 'Inter' } } }
    } : {}
  };
}

// ═══════════════════════════════════════
//  PROFILE
// ═══════════════════════════════════════
function loadProfile() {
  const s = currentStudent;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('profileInitials',    getInitials(s.name));
  set('profileName',        s.name);
  set('profileCourse',      s.course);
  set('profileFieldName',   s.name);
  set('profileFieldEmail',  s.email);
  set('profileFieldRoll',   s.roll_number);
  set('profileFieldCourse', s.course);
  set('profileFieldJoined', formatDate(s.created_at));
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
