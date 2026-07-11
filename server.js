const express = require('express');
const path = require('path');
const { ObjectId } = require('mongodb');
const { initializeDatabase, getCollection } = require('./database');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Bootstrap ───────────────────────────────────────────────────────────────
(async () => {
  try {
    await initializeDatabase();
  } catch (err) {
    console.error('❌ Could not start database connection:', err);
    process.exit(1);
  }

  // ═══════════════════════════════════════
  //  STUDENT ROUTES
  // ═══════════════════════════════════════
  app.post('/api/student/login', async (req, res) => {
    const { name, course, email, roll_number } = req.body;
    if (!name || !course || !email || !roll_number)
      return res.status(400).json({ error: 'All fields are required' });
    try {
      const studentsColl = getCollection('students');
      const attendanceColl = getCollection('attendance');

      let student = await studentsColl.findOne({ roll_number });
      if (!student) {
        const emailExists = await studentsColl.findOne({ email });
        if (emailExists) {
          return res.status(400).json({ error: 'This email is already registered with a different roll number.' });
        }

        const newStudent = {
          name,
          course,
          email,
          roll_number,
          created_at: new Date().toISOString()
        };
        const r = await studentsColl.insertOne(newStudent);
        student = { id: r.insertedId.toString(), ...newStudent };

        // Initialize default attendance record for the new student
        await attendanceColl.updateOne(
          { student_id: student.id },
          { $setOnInsert: { student_id: student.id, days_present: 0, total_days: 0, updated_at: new Date().toISOString() } },
          { upsert: true }
        );
      } else {
        student = {
          id: student._id.toString(),
          name: student.name,
          course: student.course,
          email: student.email,
          roll_number: student.roll_number,
          created_at: student.created_at
        };
      }
      res.json({ success: true, student });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/students', async (req, res) => {
    try {
      const students = await getCollection('students').find({}).sort({ name: 1 }).toArray();
      const mapped = students.map(s => ({
        id: s._id.toString(),
        name: s.name,
        course: s.course,
        email: s.email,
        roll_number: s.roll_number,
        created_at: s.created_at
      }));
      res.json(mapped);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ═══════════════════════════════════════
  //  INCHARGE ROUTES
  // ═══════════════════════════════════════
  app.post('/api/incharge/login', async (req, res) => {
    const { username, password } = req.body;
    try {
      const incharge = await getCollection('incharge').findOne({ username, password });
      if (!incharge) return res.status(401).json({ error: 'Invalid credentials' });
      res.json({ success: true, incharge: { id: incharge._id.toString(), username: incharge.username } });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ═══════════════════════════════════════
  //  TIMETABLE ROUTES
  // ═══════════════════════════════════════
  app.get('/api/timetable', async (req, res) => {
    try {
      const entries = await getCollection('timetable').find({}).toArray();
      const mapped = entries.map(e => ({
        id: e._id.toString(),
        day: e.day,
        period: e.period,
        subject: e.subject,
        timing: e.timing,
        created_at: e.created_at
      }));

      const dayOrder = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7 };
      mapped.sort((a, b) => {
        const orderA = dayOrder[a.day] || 8;
        const orderB = dayOrder[b.day] || 8;
        if (orderA !== orderB) return orderA - orderB;
        return (parseInt(a.period) || 0) - (parseInt(b.period) || 0);
      });

      res.json(mapped);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/timetable', async (req, res) => {
    const { day, period, subject, timing } = req.body;
    if (!day || !period || !subject || !timing)
      return res.status(400).json({ error: 'All fields required' });
    try {
      const newEntry = {
        day,
        period: parseInt(period),
        subject,
        timing,
        created_at: new Date().toISOString()
      };
      const r = await getCollection('timetable').insertOne(newEntry);
      res.json({ id: r.insertedId.toString(), ...newEntry });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.put('/api/timetable/:id', async (req, res) => {
    const { day, period, subject, timing } = req.body;
    try {
      const updateData = {
        day,
        period: parseInt(period),
        subject,
        timing
      };
      await getCollection('timetable').updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: updateData }
      );
      res.json({ id: req.params.id, ...updateData });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete('/api/timetable/:id', async (req, res) => {
    try {
      await getCollection('timetable').deleteOne({ _id: new ObjectId(req.params.id) });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ═══════════════════════════════════════
  //  ASSIGNMENT ROUTES
  // ═══════════════════════════════════════
  app.get('/api/assignments', async (req, res) => {
    const { studentId } = req.query;
    try {
      const assignmentsColl = getCollection('assignments');
      const completionsColl = getCollection('assignment_completions');

      if (studentId) {
        const sid = String(studentId);
        const assignments = await assignmentsColl.find({
          $or: [
            { created_for: 'all' },
            { created_for: sid }
          ]
        }).toArray();

        const mapped = await Promise.all(assignments.map(async (a) => {
          const comp = await completionsColl.findOne({
            assignment_id: a._id.toString(),
            student_id: sid
          });
          return {
            id: a._id.toString(),
            subject: a.subject,
            description: a.description,
            due_date: a.due_date,
            created_for: a.created_for,
            created_at: a.created_at,
            is_completed: comp ? 1 : 0
          };
        }));

        mapped.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
        res.json(mapped);
      } else {
        const assignments = await assignmentsColl.find({}).toArray();
        const mapped = await Promise.all(assignments.map(async (a) => {
          const count = await completionsColl.countDocuments({
            assignment_id: a._id.toString()
          });
          return {
            id: a._id.toString(),
            subject: a.subject,
            description: a.description,
            due_date: a.due_date,
            created_for: a.created_for,
            created_at: a.created_at,
            completion_count: count
          };
        }));

        mapped.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        res.json(mapped);
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/assignments/:id/completions', async (req, res) => {
    try {
      const completions = await getCollection('assignment_completions')
        .find({ assignment_id: req.params.id })
        .toArray();

      const studentsColl = getCollection('students');

      const mapped = await Promise.all(completions.map(async (c) => {
        let student = null;
        try {
          student = await studentsColl.findOne({ _id: new ObjectId(c.student_id) });
        } catch (_) {
          student = await studentsColl.findOne({ id: c.student_id }) || await studentsColl.findOne({ roll_number: c.student_id });
        }
        return {
          id: c._id.toString(),
          assignment_id: c.assignment_id,
          student_id: c.student_id,
          completed_at: c.completed_at,
          student_name: student ? student.name : 'Unknown',
          roll_number: student ? student.roll_number : 'N/A'
        };
      }));

      mapped.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
      res.json(mapped);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/assignments', async (req, res) => {
    const { subject, description, due_date, created_for } = req.body;
    if (!subject || !due_date || !created_for)
      return res.status(400).json({ error: 'Required fields missing' });
    try {
      const newAssignment = {
        subject,
        description: description || '',
        due_date,
        created_for: String(created_for),
        created_at: new Date().toISOString()
      };
      const r = await getCollection('assignments').insertOne(newAssignment);
      res.json({ id: r.insertedId.toString(), ...newAssignment });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete('/api/assignments/:id', async (req, res) => {
    try {
      await getCollection('assignment_completions').deleteMany({ assignment_id: req.params.id });
      await getCollection('assignments').deleteOne({ _id: new ObjectId(req.params.id) });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/assignments/:id/complete', async (req, res) => {
    const { studentId } = req.body;
    try {
      await getCollection('assignment_completions').updateOne(
        { assignment_id: req.params.id, student_id: String(studentId) },
        {
          $setOnInsert: {
            assignment_id: req.params.id,
            student_id: String(studentId),
            completed_at: new Date().toISOString()
          }
        },
        { upsert: true }
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete('/api/assignments/:id/complete', async (req, res) => {
    const { studentId } = req.body;
    try {
      await getCollection('assignment_completions').deleteOne({
        assignment_id: req.params.id,
        student_id: String(studentId)
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ═══════════════════════════════════════
  //  ATTENDANCE ROUTES
  // ═══════════════════════════════════════
  app.get('/api/attendance', async (req, res) => {
    try {
      const attendance = await getCollection('attendance').find({}).toArray();
      const studentsColl = getCollection('students');

      const mapped = await Promise.all(attendance.map(async (a) => {
        let student = null;
        try {
          student = await studentsColl.findOne({ _id: new ObjectId(a.student_id) });
        } catch (_) {
          student = await studentsColl.findOne({ id: a.student_id }) || await studentsColl.findOne({ roll_number: a.student_id });
        }
        return {
          id: a._id.toString(),
          student_id: a.student_id,
          days_present: a.days_present,
          total_days: a.total_days,
          updated_at: a.updated_at,
          student_name: student ? student.name : 'Unknown',
          roll_number: student ? student.roll_number : 'N/A',
          course: student ? student.course : 'N/A'
        };
      }));

      mapped.sort((a, b) => a.student_name.localeCompare(b.student_name));
      res.json(mapped);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/attendance/:studentId', async (req, res) => {
    const studentId = req.params.studentId;
    try {
      const attendanceColl = getCollection('attendance');
      let att = await attendanceColl.findOne({ student_id: studentId });
      if (!att) {
        const newAtt = {
          student_id: studentId,
          days_present: 0,
          total_days: 0,
          updated_at: new Date().toISOString()
        };
        await attendanceColl.insertOne(newAtt);
        att = newAtt;
      }
      res.json({
        id: att._id ? att._id.toString() : null,
        student_id: att.student_id,
        days_present: att.days_present,
        total_days: att.total_days,
        updated_at: att.updated_at
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.put('/api/attendance/:studentId', async (req, res) => {
    const studentId = req.params.studentId;
    const { days_present, total_days } = req.body;
    try {
      const updateData = {
        days_present: parseInt(days_present),
        total_days: parseInt(total_days),
        updated_at: new Date().toISOString()
      };

      await getCollection('attendance').updateOne(
        { student_id: studentId },
        { $set: updateData },
        { upsert: true }
      );

      const record = await getCollection('attendance').findOne({ student_id: studentId });
      res.json({
        id: record._id.toString(),
        student_id: record.student_id,
        days_present: record.days_present,
        total_days: record.total_days,
        updated_at: record.updated_at
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ═══════════════════════════════════════
  //  MARKS ROUTES
  // ═══════════════════════════════════════
  app.get('/api/marks', async (req, res) => {
    const { studentId } = req.query;
    try {
      const marksColl = getCollection('marks');
      const studentsColl = getCollection('students');

      if (studentId) {
        const marks = await marksColl.find({ student_id: String(studentId) }).toArray();
        const mapped = marks.map(m => ({
          id: m._id.toString(),
          student_id: m.student_id,
          exam_type: m.exam_type,
          exam_name: m.exam_name,
          subject: m.subject,
          scored_marks: m.scored_marks,
          total_marks: m.total_marks,
          created_at: m.created_at
        }));
        mapped.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        res.json(mapped);
      } else {
        const marks = await marksColl.find({}).toArray();
        const mapped = await Promise.all(marks.map(async (m) => {
          let student = null;
          try {
            student = await studentsColl.findOne({ _id: new ObjectId(m.student_id) });
          } catch (_) {
            student = await studentsColl.findOne({ id: m.student_id }) || await studentsColl.findOne({ roll_number: m.student_id });
          }
          return {
            id: m._id.toString(),
            student_id: m.student_id,
            exam_type: m.exam_type,
            exam_name: m.exam_name,
            subject: m.subject,
            scored_marks: m.scored_marks,
            total_marks: m.total_marks,
            created_at: m.created_at,
            student_name: student ? student.name : 'Unknown',
            roll_number: student ? student.roll_number : 'N/A'
          };
        }));

        mapped.sort((a, b) => {
          const nameCompare = a.student_name.localeCompare(b.student_name);
          if (nameCompare !== 0) return nameCompare;
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });

        res.json(mapped);
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/marks', async (req, res) => {
    const { student_id, exam_type, exam_name, subject, scored_marks, total_marks } = req.body;
    if (!student_id || !exam_type || !exam_name || !subject || scored_marks === undefined || !total_marks)
      return res.status(400).json({ error: 'All fields required' });

    try {
      const marksColl = getCollection('marks');
      if (student_id === 'all') {
        const students = await getCollection('students').find({}).toArray();
        const promises = students.map(s => {
          const newMark = {
            student_id: s._id.toString(),
            exam_type,
            exam_name,
            subject,
            scored_marks: parseFloat(scored_marks),
            total_marks: parseFloat(total_marks),
            created_at: new Date().toISOString()
          };
          return marksColl.insertOne(newMark);
        });
        await Promise.all(promises);
        return res.json({ success: true, count: students.length });
      } else {
        const newMark = {
          student_id: String(student_id),
          exam_type,
          exam_name,
          subject,
          scored_marks: parseFloat(scored_marks),
          total_marks: parseFloat(total_marks),
          created_at: new Date().toISOString()
        };
        const r = await marksColl.insertOne(newMark);
        res.json({ id: r.insertedId.toString(), ...newMark });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete('/api/marks/:id', async (req, res) => {
    try {
      await getCollection('marks').deleteOne({ _id: new ObjectId(req.params.id) });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ═══════════════════════════════════════
  //  NOTES ROUTES
  // ═══════════════════════════════════════
  app.get('/api/notes/:studentId', async (req, res) => {
    try {
      const notes = await getCollection('notes').find({ student_id: req.params.studentId }).toArray();
      const mapped = notes.map(n => ({
        id: n._id.toString(),
        student_id: n.student_id,
        title: n.title,
        content: n.content,
        color: n.color,
        created_at: n.created_at,
        updated_at: n.updated_at
      }));
      mapped.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
      res.json(mapped);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/notes', async (req, res) => {
    const { student_id, title, content, color } = req.body;
    if (!student_id || !title) return res.status(400).json({ error: 'Student ID and title required' });
    try {
      const newNote = {
        student_id: String(student_id),
        title,
        content: content || '',
        color: color || '#6366f1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const r = await getCollection('notes').insertOne(newNote);
      res.json({ id: r.insertedId.toString(), ...newNote });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.put('/api/notes/:id', async (req, res) => {
    const { title, content, color } = req.body;
    try {
      const updateData = {
        title,
        content,
        color,
        updated_at: new Date().toISOString()
      };
      await getCollection('notes').updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: updateData }
      );
      res.json({ id: req.params.id, ...updateData });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete('/api/notes/:id', async (req, res) => {
    try {
      await getCollection('notes').deleteOne({ _id: new ObjectId(req.params.id) });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ═══════════════════════════════════════
  //  EXPORT ROUTES
  // ═══════════════════════════════════════
  app.get('/api/export/marks', async (req, res) => {
    try {
      const marks = await getCollection('marks').find({}).toArray();
      const studentsColl = getCollection('students');

      const mapped = await Promise.all(marks.map(async (m) => {
        let student = null;
        try {
          student = await studentsColl.findOne({ _id: new ObjectId(m.student_id) });
        } catch (_) {
          student = await studentsColl.findOne({ id: m.student_id }) || await studentsColl.findOne({ roll_number: m.student_id });
        }
        return {
          'Student Name': student ? student.name : 'Unknown',
          'Roll Number': student ? student.roll_number : 'N/A',
          'Course': student ? student.course : 'N/A',
          'Exam Type': m.exam_type,
          'Exam Name': m.exam_name,
          'Subject': m.subject,
          'Scored Marks': m.scored_marks,
          'Total Marks': m.total_marks
        };
      }));

      mapped.sort((a, b) => a['Student Name'].localeCompare(b['Student Name']));
      res.json(mapped);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/export/assignments', async (req, res) => {
    try {
      const assignments = await getCollection('assignments').find({}).toArray();
      const completionsColl = getCollection('assignment_completions');
      const studentsColl = getCollection('students');

      const mapped = await Promise.all(assignments.map(async (a) => {
        const compCount = await completionsColl.countDocuments({ assignment_id: a._id.toString() });
        let assignedTo = 'All Students';
        if (a.created_for !== 'all') {
          let student = null;
          try {
            student = await studentsColl.findOne({ _id: new ObjectId(a.created_for) });
          } catch (_) {
            student = await studentsColl.findOne({ id: a.created_for }) || await studentsColl.findOne({ roll_number: a.created_for });
          }
          assignedTo = student ? student.name : 'Unknown';
        }
        return {
          'Subject': a.subject,
          'Description': a.description || '',
          'Due Date': a.due_date,
          'Assigned To': assignedTo,
          'Completions': compCount,
          created_at: a.created_at
        };
      }));

      mapped.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      res.json(mapped.map(({ created_at, ...rest }) => rest));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ═══════════════════════════════════════
  //  AI CHAT ROUTE (SECURE PROXY)
  // ═══════════════════════════════════════
  app.post('/api/ai/chat', async (req, res) => {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return res.status(500).json({ error: 'Groq API Key is not configured on the server.' });
    }

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are StudyBot AI, a helpful and encouraging AI study assistant for college students. 
You specialize in explaining academic concepts clearly, helping with homework, exam preparation, and providing study tips.
Be friendly, concise, and use emojis occasionally. Format code or math nicely when needed.`
            },
            ...messages,
          ],
          max_tokens: 1024,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Groq API request failed');
      }

      const data = await response.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Catch-all — serve frontend
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`\n🚀 StudentOS is running at http://localhost:${PORT}`);
    console.log(`📚 Open your browser: http://localhost:${PORT}`);
    console.log(`🔑 Incharge login → username: incharge  |  password: incharge123\n`);
  });
})();
