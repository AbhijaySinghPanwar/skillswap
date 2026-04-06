# 🔄 SkillSwap – Peer-to-Peer Skill Exchange Platform

A full-stack web application where users can exchange skills with each other. Built with Node.js, Express, MongoDB, and a premium Bootstrap UI.

---
## 🌐 Live Demo

👉 https://skillswap-b68k.onrender.com

> ⚠️ Note: On first load, the app may take ~30–60 seconds to start due to Render free tier cold start.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v16+ ([download](https://nodejs.org))
- **MongoDB** running locally on port 27017  
  *(Install MongoDB Community Edition: https://www.mongodb.com/try/download/community)*

---

## 📦 Installation

### 1. Clone / Extract the project
```bash
cd skillswap
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start MongoDB (if not already running)
```bash
# macOS (with Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows – start MongoDB service from Services panel
# or run: mongod
```

### 4. Start the server
```bash
# Production
npm start

# Development (auto-restart on changes)
npm run dev
```

### 5. Open in browser
```
http://localhost:3000
```

---

## 🗂️ Project Structure

```
skillswap/
├── backend/
│   ├── controllers/
│   │   ├── authController.js      # Signup, login, logout, session
│   │   ├── userController.js      # Get users, update profile, matches
│   │   ├── requestController.js   # CRUD for skill requests
│   │   └── messageController.js   # Chat messages
│   ├── middleware/
│   │   └── auth.js                # isAuthenticated, isGuest middleware
│   ├── models/
│   │   ├── User.js                # User schema (bcrypt password hashing)
│   │   ├── Request.js             # Skill exchange request schema
│   │   └── Message.js             # Chat message schema
│   ├── routes/
│   │   ├── auth.js                # /api/auth/* routes
│   │   ├── users.js               # /api/users/* routes
│   │   ├── requests.js            # /api/requests/* routes
│   │   └── messages.js            # /api/messages/* routes
│   └── server.js                  # Express app entry point
├── frontend/
│   ├── css/
│   │   └── style.css              # Global styles, design system
│   ├── js/
│   │   ├── utils.js               # Shared JS utilities
│   │   └── dashboard.js           # Dashboard page logic
│   ├── index.html                 # Landing page
│   ├── login.html                 # Login page
│   ├── signup.html                # 3-step signup wizard
│   ├── dashboard.html             # Main app (explore/matches/requests/chat)
│   └── profile.html               # User profile view & edit
└── package.json
```

---

## 🌐 API Endpoints

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user (protected) |
| GET | `/api/auth/check` | Check login status |

### Users
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/users` | All users with match scores (protected) |
| GET | `/api/users/matches` | Best matches for current user (protected) |
| GET | `/api/users/:id` | Get single user (protected) |
| PUT | `/api/users/profile` | Update profile (protected) |

### Requests
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/requests` | Send skill request (protected) |
| GET | `/api/requests` | Get sent & received requests (protected) |
| PUT | `/api/requests/:id` | Accept/reject request (protected) |
| DELETE | `/api/requests/:id` | Cancel request (protected) |

### Messages
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/messages/contacts` | Get chat contacts (protected) |
| GET | `/api/messages/:userId` | Get conversation (protected) |
| POST | `/api/messages` | Send message (protected) |

---

## ✨ Features

### Core
- ✅ User Signup & Login (bcrypt + sessions)
- ✅ User profiles with Skills Offered & Skills Wanted
- ✅ View all users with match scores
- ✅ Send / Accept / Reject skill exchange requests
- ✅ Match percentage algorithm
- ✅ Basic chat system (polls every 5s)

### UI/UX
- ✅ Premium dark theme with purple/pink/teal palette
- ✅ Animated hero section with floating cards
- ✅ Card-based user profiles
- ✅ 3-step signup wizard
- ✅ Tag input for skills
- ✅ Toast notifications
- ✅ Loading spinners
- ✅ Empty state designs
- ✅ Mobile responsive (RWD)
- ✅ Smooth animations & transitions

---

## 🔐 Security
- Passwords hashed with **bcryptjs** (12 salt rounds)
- Sessions stored in MongoDB via **connect-mongo**
- Protected routes via `isAuthenticated` middleware
- HttpOnly cookies

---

## 🛠️ Environment Variables (Optional)

Create a `.env` file for production:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/skillswap
SESSION_SECRET=your-secret-key-here
```

---

## 📱 Pages
| URL | Page |
|-----|------|
| `/` | Landing page |
| `/login` | Login |
| `/signup` | Signup wizard |
| `/dashboard` | Main app dashboard |
| `/profile` | User profile |
