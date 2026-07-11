# StudentOS 🚀

A modern, responsive **College Management Platform** designed for students and class incharges to track schedules, marks, assignments, attendance, and study notes. The platform is built on a robust Node.js/Express backend and is fully backed by **MongoDB Atlas** for secure, real-time database management.

---

## Features 🌟

### 👨‍🎓 Student Portal
- **Dashboard**: High-level summary of tasks, classes, and recent notifications.
- **Timetable**: View the weekly schedule and class timings.
- **Assignments**: Track pending assignments, due dates, and mark them as completed.
- **Marks & Analytics**: View exam scores across subjects.
- **Attendance Tracker**: Check total days present and current attendance percentage.
- **Notes Space**: Create, save, and color-code study notes.

### 👩‍🏫 Class Incharge Portal
- **Student Directory**: Manage and list all registered students.
- **Timetable Editor**: Add, modify, or remove class periods.
- **Assignment Manager**: Publish new assignments for all students or target individual students.
- **Marks Ledger**: Input and track test/exam grades for students (supports individual or batch marking).
- **Attendance Manager**: Update class attendance records.
- **Export Data**: Export marks and assignments data directly to JSON spreadsheets.

---

## Technology Stack 🛠️

- **Frontend**: HTML5, Vanilla JavaScript, CSS3 (with Premium Glassmorphism styling and dark mode support).
- **Backend**: Node.js & Express.js.
- **Database**: MongoDB Atlas (Cloud Database).
- **Environment**: dotenv (Security for database credentials).

---

## Getting Started 💻

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/karteek04955/student.git
   cd student
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory of the project and define your variables:
   ```env
   MONGODB_URI=mongodb://kakumanukarteek:karteek500@ac-nj9210o-shard-00-00.dldj7nr.mongodb.net:27017,ac-nj9210o-shard-00-01.dldj7nr.mongodb.net:27017,ac-nj9210o-shard-00-02.dldj7nr.mongodb.net:27017/studentos?ssl=true&replicaSet=atlas-tuyl59-shard-0&authSource=admin&retryWrites=true&w=majority
   PORT=3000
   ```

4. **Run the Application**:
   Start the development server:
   ```bash
   npm run dev
   ```

5. **Access the Web App**:
   Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## Incharge Credentials (Default) 🔑
- **Username**: `incharge`
- **Password**: `incharge123`
