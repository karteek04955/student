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
    quiz:        { title: 'AI Quiz Generator', sub: 'Practice quizzes powered by AI 🧠' },
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
    quiz:        restartQuizGenerator,
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

    // Render Assignment Reminders
    const remindersArea = document.getElementById('assignmentRemindersArea');
    if (remindersArea) {
      const reminderAssignments = assignments.filter(a => !a.is_completed && (isOverdue(a.due_date) || isDueSoon(a.due_date)));
      if (reminderAssignments.length > 0) {
        remindersArea.style.display = 'block';
        remindersArea.innerHTML = `
          <div class="pending-approvals-card" style="background:var(--red-bg); border:1px solid rgba(220,38,38,0.15); padding:20px; border-radius:var(--radius-lg);">
            <h3 style="color:var(--red); margin-bottom:10px; display:flex; align-items:center; gap:8px;">⚠️ Assignment Reminders (${reminderAssignments.length})</h3>
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${reminderAssignments.map(a => {
                const overdue = isOverdue(a.due_date);
                const badgeText = overdue ? 'Overdue!' : 'Due Soon!';
                const badgeClass = overdue ? 'badge-danger' : 'badge-warning';
                return `
                  <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; background:var(--bg-card); padding:12px 16px; border-radius:var(--radius); border:1px solid var(--border);">
                    <div>
                      <strong style="color:var(--navy);">${escapeHtml(a.subject)}</strong>
                      <div style="font-size:0.75rem; color:var(--text-2); margin-top:2px;">
                        📅 Due: ${formatDate(a.due_date)} • <span class="badge ${badgeClass}">${badgeText}</span>
                      </div>
                    </div>
                    <button class="btn btn-success btn-sm" onclick="toggleAssignment('${a.id}', true)">Mark Done</button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      } else {
        remindersArea.style.display = 'none';
      }
    }

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
            ${n.author === 'incharge'
              ? `<span class="badge badge-purple" style="font-size:0.7rem; font-weight:600; padding:2px 8px; border-radius: var(--radius-pill); background: var(--gold-pale); color: var(--gold); border: 1px solid var(--gold-pale);">📢 Incharge Note</span>`
              : `<div class="note-actions" onclick="event.stopPropagation()">
                  <button class="btn btn-icon btn-secondary" onclick="openNoteModal('${n.id}')" title="Edit">✏️</button>
                  <button class="btn btn-icon btn-danger" onclick="deleteNote('${n.id}')" title="Delete">🗑️</button>
                </div>`
            }
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function openNewNoteModal() {
  currentNoteEdit = null;
  document.getElementById('noteModalTitle').textContent = 'New Note';
  
  const titleInput = document.getElementById('noteTitle');
  const contentInput = document.getElementById('noteContent');
  const colorInput = document.getElementById('noteColor');
  const saveBtn = document.getElementById('saveNoteBtn');
  const cancelBtn = document.getElementById('cancelNoteBtn');

  if (titleInput) {
    titleInput.value = '';
    titleInput.readOnly = false;
  }
  if (contentInput) {
    contentInput.value = '';
    contentInput.readOnly = false;
  }
  if (colorInput) {
    colorInput.value = '#C89B3C';
    colorInput.disabled = false;
  }
  if (saveBtn) {
    saveBtn.style.display = 'inline-flex';
  }
  if (cancelBtn) {
    cancelBtn.textContent = 'Cancel';
  }
  
  document.getElementById('noteModal').classList.add('active');
}

async function openNoteModal(id) {
  try {
    const notes = await api.notes.get(currentStudent.id);
    const note  = notes.find(n => String(n.id) === String(id));
    if (!note) return;
    currentNoteEdit = note;
    
    const isInchargeNote = (note.author === 'incharge');
    document.getElementById('noteModalTitle').textContent = isInchargeNote ? '👁️ View Incharge Note' : 'Edit Note';
    
    const titleInput = document.getElementById('noteTitle');
    const contentInput = document.getElementById('noteContent');
    const colorInput = document.getElementById('noteColor');
    const saveBtn = document.getElementById('saveNoteBtn');
    const cancelBtn = document.getElementById('cancelNoteBtn');

    if (titleInput) {
      titleInput.value = note.title;
      titleInput.readOnly = isInchargeNote;
    }
    if (contentInput) {
      contentInput.value = note.content;
      contentInput.readOnly = isInchargeNote;
    }
    if (colorInput) {
      colorInput.value = note.color;
      colorInput.disabled = isInchargeNote;
    }
    if (saveBtn) {
      saveBtn.style.display = isInchargeNote ? 'none' : 'inline-flex';
    }
    if (cancelBtn) {
      cancelBtn.textContent = isInchargeNote ? 'Close' : 'Cancel';
    }
    
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
                ? `<button class="btn btn-secondary btn-sm" onclick="toggleAssignment('${a.id}', false)">↩️ Undo</button>`
                : `<button class="btn btn-success btn-sm" onclick="toggleAssignment('${a.id}', true)">✅ Done</button>`
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

    // Summary stats
    const totalScored = marks.reduce((s, m) => s + m.scored_marks, 0);
    const totalMax    = marks.reduce((s, m) => s + m.total_marks, 0);
    const overallPct  = totalMax > 0 ? Math.round(totalScored / totalMax * 100) : 0;
    const overallGrade = overallPct >= 90 ? 'O' : overallPct >= 80 ? 'A+' : overallPct >= 70 ? 'A'
                       : overallPct >= 60 ? 'B+' : overallPct >= 50 ? 'B' : overallPct >= 40 ? 'C' : 'F';
    const gc = overallPct >= 75 ? 'success' : overallPct >= 50 ? 'warning' : 'danger';

    container.innerHTML = `
      <!-- Overall Summary Card -->
      <div class="card" style="padding:20px; margin-bottom:24px; background:var(--bg-card);">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;">
          <div>
            <div style="font-size:0.8rem; color:var(--text-2); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:4px;">Overall Performance</div>
            <div style="font-size:2rem; font-weight:800; color:var(--navy);">${overallPct}%</div>
            <div style="font-size:0.85rem; color:var(--text-2);">${totalScored} / ${totalMax} marks across ${marks.length} subject${marks.length !== 1 ? 's' : ''}</div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:72px; height:72px; border-radius:50%; background:var(--${gc === 'success' ? 'green' : gc === 'warning' ? 'amber' : 'red'}-bg); border:3px solid var(--${gc === 'success' ? 'green' : gc === 'warning' ? 'amber' : 'red'});">
            <span style="font-size:1.5rem; font-weight:800; color:var(--${gc === 'success' ? 'green' : gc === 'warning' ? 'amber' : 'red'});">${overallGrade}</span>
          </div>
          <div style="display:flex; gap:16px; flex-wrap:wrap;">
            <div style="text-align:center;">
              <div style="font-size:1.3rem; font-weight:700; color:var(--navy);">${sem.length}</div>
              <div style="font-size:0.75rem; color:var(--text-2);">Sem Subjects</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:1.3rem; font-weight:700; color:var(--navy);">${cat.length}</div>
              <div style="font-size:0.75rem; color:var(--text-2);">CAT Subjects</div>
            </div>
          </div>
        </div>
        <div style="margin-top:16px;">
          <div style="height:8px; border-radius:99px; background:var(--border); overflow:hidden;">
            <div style="height:100%; width:${overallPct}%; background:${overallPct >= 75 ? 'var(--green)' : overallPct >= 50 ? 'var(--amber)' : 'var(--red)'}; border-radius:99px; transition:width 0.8s ease;"></div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="marks-tabs" style="margin-bottom:20px;">
        <button class="marks-tab active" onclick="switchMarksTab('all', this)">All (${marks.length})</button>
        <button class="marks-tab" onclick="switchMarksTab('sem', this)">📚 Semester (${sem.length})</button>
        <button class="marks-tab" onclick="switchMarksTab('cat', this)">📝 CAT / Mid (${cat.length})</button>
      </div>

      <div id="marksTableAll">${renderMarksGrouped(marks)}</div>
      <div id="marksTableSem" style="display:none;">${renderMarksGrouped(sem)}</div>
      <div id="marksTableCat" style="display:none;">${renderMarksGrouped(cat)}</div>
    `;
  } catch {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Error loading marks</h3></div>';
  }
}

function renderMarksGrouped(marks) {
  if (marks.length === 0) return '<div class="empty-state" style="padding:40px;"><div class="empty-state-icon">📋</div><h3>No records</h3></div>';

  // Group by exam name
  const exams = {};
  marks.forEach(m => {
    const key = `${m.exam_type}||${m.exam_name}`;
    if (!exams[key]) exams[key] = { exam_name: m.exam_name, exam_type: m.exam_type, subjects: [] };
    exams[key].subjects.push(m);
  });

  return Object.values(exams).map(exam => {
    const totalScored = exam.subjects.reduce((s, m) => s + m.scored_marks, 0);
    const totalMax    = exam.subjects.reduce((s, m) => s + m.total_marks, 0);
    const examPct     = totalMax > 0 ? Math.round(totalScored / totalMax * 100) : 0;
    const examGc      = examPct >= 75 ? 'success' : examPct >= 50 ? 'warning' : 'danger';
    const examGrade   = examPct >= 90 ? 'O' : examPct >= 80 ? 'A+' : examPct >= 70 ? 'A'
                      : examPct >= 60 ? 'B+' : examPct >= 50 ? 'B' : examPct >= 40 ? 'C' : 'F';

    return `
      <div class="marks-student-group" style="margin-bottom:24px;">
        <!-- Exam Header -->
        <div class="marks-student-header" style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <span class="badge ${exam.exam_type === 'sem' ? 'badge-primary' : 'badge-purple'}" style="font-size:0.8rem;">
            ${exam.exam_type === 'sem' ? '📚 Semester Exam' : '📝 CAT / Mid Exam'}
          </span>
          <span style="font-weight:700; color:var(--navy); font-size:1rem;">${escapeHtml(exam.exam_name)}</span>
          <span style="margin-left:auto; display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.8rem; color:var(--text-2);">${exam.subjects.length} subject${exam.subjects.length !== 1 ? 's' : ''}</span>
            <span class="badge badge-${examGc}">${examPct}% • ${examGrade}</span>
          </span>
        </div>

        <!-- Subjects Table -->
        <div class="table-wrapper" style="border-top:none; border-radius:0 0 var(--radius) var(--radius);">
          <table>
            <thead>
              <tr>
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

  // Populate edit fields
  const nameInput = document.getElementById('editProfileName');
  const emailInput = document.getElementById('editProfileEmail');
  const rollInput = document.getElementById('editProfileRoll');
  const courseInput = document.getElementById('editProfileCourse');
  if (nameInput) nameInput.value = s.name;
  if (emailInput) emailInput.value = s.email;
  if (rollInput) rollInput.value = s.roll_number;
  if (courseInput) courseInput.value = s.course;
}

function toggleProfileEdit(showEdit) {
  const viewMode = document.getElementById('profileViewMode');
  const editMode = document.getElementById('profileEditMode');
  if (viewMode && editMode) {
    viewMode.style.display = showEdit ? 'none' : 'block';
    editMode.style.display = showEdit ? 'block' : 'none';
  }
}

async function saveProfileDetails() {
  const name = document.getElementById('editProfileName').value.trim();
  const email = document.getElementById('editProfileEmail').value.trim();
  const course = document.getElementById('editProfileCourse').value.trim();

  if (!name || !email || !course) {
    showToast('All profile fields are required', 'warning');
    return;
  }

  try {
    const res = await api.student.update(currentStudent.id, { name, email, course });
    if (res.success) {
      currentStudent.name = name;
      currentStudent.email = email;
      currentStudent.course = course;
      localStorage.setItem('currentStudent', JSON.stringify(currentStudent));

      loadProfile();
      toggleProfileEdit(false);
      showToast('Profile updated successfully! ✅', 'success');

      // Update student details inside sidebar
      const navUser = document.querySelector('.sidebar-user-name');
      const navCourse = document.querySelector('.sidebar-user-course');
      const navAvatar = document.querySelector('.sidebar-avatar');
      if (navUser) navUser.textContent = name;
      if (navCourse) navCourse.textContent = course;
      if (navAvatar) navAvatar.textContent = getInitials(name);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
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

/* ── AI PRACTICE QUIZ GENERATOR ── */
let currentQuiz = null;
let currentQuizIndex = 0;
let quizScore = 0;
let selectedQuizOption = null;

function restartQuizGenerator() {
  currentQuiz = null;
  currentQuizIndex = 0;
  quizScore = 0;
  selectedQuizOption = null;

  const formCard = document.getElementById('quizGeneratorFormCard');
  const playCard = document.getElementById('quizPlayCard');
  const resultsCard = document.getElementById('quizResultsCard');
  const topicInput = document.getElementById('quizTopic');

  if (formCard) formCard.style.display = 'block';
  if (playCard) playCard.style.display = 'none';
  if (resultsCard) resultsCard.style.display = 'none';
  if (topicInput) topicInput.value = '';

  const generateBtn = document.getElementById('quizGenerateBtn');
  if (generateBtn) {
    generateBtn.disabled = false;
    generateBtn.textContent = '⚡ Generate Quiz via AI';
  }
}

async function generateQuiz() {
  const topic = document.getElementById('quizTopic').value.trim();
  const numQuestions = parseInt(document.getElementById('quizNumQuestions').value) || 10;
  const difficulty = document.getElementById('quizDifficulty').value;
  const generateBtn = document.getElementById('quizGenerateBtn');

  if (!topic) {
    showToast('Please enter a topic or subject', 'warning');
    return;
  }

  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.textContent = '🧠 Generating questions via AI... Please wait...';
  }

  try {
    const prompt = `You are QuizBot AI, a professional practice test generator.
Create a multiple choice quiz on the topic: "${topic}".
Difficulty level: ${difficulty}.
Number of questions: ${numQuestions}.

Return ONLY a valid JSON object matching this structure:
{
  "title": "Quiz Title",
  "questions": [
    {
      "question": "Question text?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "answer": 0 // 0-based index of the correct answer
    }
  ]
}

Strict requirements:
1. Return ONLY the JSON object. Do not wrap it in markdown code blocks like \`\`\`json. Do not include introductory or concluding conversational text.
2. The correct answer index must map accurately to one of the provided options.`;

    const chatResponse = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!chatResponse.ok) {
      throw new Error('Server-side AI request failed');
    }

    const data = await chatResponse.json();
    let reply = data.choices[0]?.message?.content || '';

    // Clean up potential markdown wrapped responses
    reply = reply.trim();
    if (reply.startsWith('```json')) {
      reply = reply.substring(7);
    }
    if (reply.endsWith('```')) {
      reply = reply.substring(0, reply.length - 3);
    }
    reply = reply.trim();

    const quizData = JSON.parse(reply);
    if (!quizData.questions || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
      throw new Error('Invalid quiz format received from AI');
    }

    currentQuiz = quizData;
    currentQuizIndex = 0;
    quizScore = 0;
    selectedQuizOption = null;

    // Transition UI
    const formCard = document.getElementById('quizGeneratorFormCard');
    const playCard = document.getElementById('quizPlayCard');
    if (formCard) formCard.style.display = 'none';
    if (playCard) playCard.style.display = 'block';

    const titleDisp = document.getElementById('quizTitleDisplay');
    const metaDisp = document.getElementById('quizMetaDisplay');
    if (titleDisp) titleDisp.textContent = currentQuiz.title || `${topic} Practice Quiz`;
    if (metaDisp) metaDisp.textContent = `${difficulty} • ${currentQuiz.questions.length} Qs`;

    showQuizQuestion();
  } catch (err) {
    showToast('Failed to generate quiz: ' + err.message, 'error');
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = '⚡ Generate Quiz via AI';
    }
  }
}

function showQuizQuestion() {
  if (!currentQuiz || currentQuizIndex >= currentQuiz.questions.length) return;

  selectedQuizOption = null;
  const q = currentQuiz.questions[currentQuizIndex];
  
  const progText = document.getElementById('quizScoreProgress');
  if (progText) progText.textContent = `Question ${currentQuizIndex + 1} of ${currentQuiz.questions.length}`;

  const qText = document.getElementById('quizQuestionText');
  if (qText) qText.textContent = `${currentQuizIndex + 1}. ${escapeHtml(q.question)}`;

  const optContainer = document.getElementById('quizOptionsContainer');
  if (optContainer) {
    optContainer.innerHTML = q.options.map((opt, idx) => `
      <button class="btn btn-secondary" onclick="selectQuizOption(${idx}, this)" style="text-align:left; justify-content:flex-start; padding:12px 18px; width:100%; border:1px solid var(--border); background:var(--bg-card); color:var(--text-1); font-weight:500;">
        <span style="font-weight:700; color:var(--gold); margin-right:12px;">${String.fromCharCode(65 + idx)}.</span>
        ${escapeHtml(opt)}
      </button>
    `).join('');
  }

  const nextBtn = document.getElementById('quizNextBtn');
  if (nextBtn) {
    nextBtn.disabled = true;
    nextBtn.textContent = currentQuizIndex === currentQuiz.questions.length - 1 ? 'Show Results 🏆' : 'Next Question ➡️';
  }
}

function selectQuizOption(index, buttonEl) {
  if (selectedQuizOption !== null) return; // Prevent double-clicking answers
  selectedQuizOption = index;

  const q = currentQuiz.questions[currentQuizIndex];
  const isCorrect = (index === q.answer);

  if (isCorrect) {
    quizScore++;
    showToast('Correct answer! 🎉', 'success');
  } else {
    showToast('Incorrect answer', 'error');
  }

  const buttons = document.getElementById('quizOptionsContainer').querySelectorAll('button');
  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === q.answer) {
      btn.style.borderColor = 'var(--green)';
      btn.style.background = 'rgba(22, 163, 74, 0.15)';
      btn.style.color = 'var(--green)';
    } else if (idx === index) {
      btn.style.borderColor = 'var(--red)';
      btn.style.background = 'rgba(220, 38, 38, 0.15)';
      btn.style.color = 'var(--red)';
    }
  });

  const nextBtn = document.getElementById('quizNextBtn');
  if (nextBtn) nextBtn.disabled = false;
}

function nextQuizQuestion() {
  currentQuizIndex++;
  if (currentQuizIndex >= currentQuiz.questions.length) {
    showQuizResults();
  } else {
    showQuizQuestion();
  }
}

function showQuizResults() {
  const playCard = document.getElementById('quizPlayCard');
  const resultsCard = document.getElementById('quizResultsCard');
  if (playCard) playCard.style.display = 'none';
  if (resultsCard) resultsCard.style.display = 'block';

  const scoreText = document.getElementById('quizScoreText');
  if (scoreText) scoreText.textContent = `You scored ${quizScore} out of ${currentQuiz.questions.length} (${Math.round(quizScore / currentQuiz.questions.length * 100)}%)`;

  const feedback = document.getElementById('quizScoreFeedback');
  if (feedback) {
    const pct = quizScore / currentQuiz.questions.length;
    if (pct >= 0.8) {
      feedback.textContent = 'Excellent job! You have mastered this topic! 🌟';
      feedback.style.color = 'var(--green)';
    } else if (pct >= 0.5) {
      feedback.textContent = 'Good try! Review and practice again to score higher. 👍';
      feedback.style.color = 'var(--amber)';
    } else {
      feedback.textContent = 'Keep practicing! Focus on review study notes and try again. 💪';
      feedback.style.color = 'var(--red)';
    }
  }
}

function exitQuiz() {
  restartQuizGenerator();
  loadSection('dashboard');
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === 'dashboard');
  });
}
