# 🎥 Smart Interview Room

🔴 **Live Demo:** [https://smart-interview-room.onrender.com/](https://smart-interview-room.onrender.com/)

A modern, highly reliable video conferencing and interview platform equipped with a powerful AI assistant. Designed to provide a seamless, interactive, and intelligent environment for remote interviews and collaborative meetings. 

This project goes beyond standard video calling by integrating real-time conversation analysis, agenda tracking, and structured feedback mechanisms.

---

## ✨ Comprehensive Feature Set

### 🤖 AI-Powered Interview Assistant
- **Real-Time Analysis:** The AI assistant actively listens to the ongoing conversation via live transcriptions.
- **Smart Suggestions:** Automatically generates context-aware follow-up questions for interviewers based on the candidate's answers.
- **Dynamic Summaries:** Summarizes talking points and generates meeting insights on the fly.

### 📹 High-Quality Video & Audio
- **WebRTC Integration:** Fast, secure, and low-latency peer-to-peer communication.
- **Screen Sharing:** Share your entire screen, application windows, or specific browser tabs with a single click.
- **Media Controls:** Easy toggling for camera and microphone with visual feedback for muted states.

### 🛠 Interactive Meeting Tools
- **In-Call Chat:** A built-in messaging system for sending links, text, and notes without interrupting the speaker.
- **Live Agenda & Scorecards:** Keep track of interview questions or meeting talking points. Interviewers can check them off dynamically to maintain structure.
- **Hand Raising:** Non-verbal signaling allowing participants to indicate they have a question or comment.
- **Participant Roster:** View all active members in the room and easily manage permissions.

---

## 🏗️ Technology Stack

- **Frontend Framework:** [Next.js (App Router)](https://nextjs.org) for fast server-side rendering and static generation.
- **Real-Time WebSockets:** [Socket.io](https://socket.io/) for signaling, chat, and live agenda updates.
- **Peer-to-Peer Video:** Native WebRTC for direct media streaming.
- **Styling:** Custom CSS built with modern Google Meet-inspired UI patterns and responsive design.
- **Icons:** [Lucide React](https://lucide.dev/) for crisp, scalable vector icons.
- **Deployment & Infrastructure:** Easily configurable for Render via `render.yaml` or other Node-compatible hosting platforms.

---

## 📂 Project Structure

```text
smart-interview-room/
├── src/
│   ├── app/
│   │   ├── page.js           # Main application logic & UI for the interview room
│   │   ├── globals.css       # Core design system and UI variables
│   │   ├── layout.js         # Root Next.js layout
│   │   └── api/              # API Routes (including AI endpoints)
│   └── db.js                 # Database configuration for agenda & session storage
├── render.yaml               # IaC configuration for easy Render deployment
├── server.js                 # Custom Node.js/Socket.io server implementation
└── package.json              # Project dependencies and scripts
```

---

## 🚀 Getting Started Locally

Follow these steps to run the Smart Interview Room on your local machine.

### 1. Clone the repository
```bash
git clone https://github.com/Izumi42/smart-interview-room.git
cd smart-interview-room
```

### 2. Install dependencies
Make sure you have Node.js installed, then run:
```bash
npm install
```

### 3. Run the development server
Because this project utilizes a custom WebSocket server, you must run it using the custom start script rather than standard Next.js commands:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application in action.

---

## 🌍 Deployment Guide

Because the application relies on a persistent WebSocket connection handled by `server.js`, standard Serverless deployments (like Vercel) will **not** support the real-time features out-of-the-box. 

It is highly recommended to deploy this to a platform that supports long-running Node.js processes, such as **Render**, Railway, or AWS EC2.

### 🚀 Deploying on Render (Recommended)
This repository includes a `render.yaml` file, meaning Render can automatically configure and deploy your application.

1. Create an account on [Render.com](https://render.com/).
2. From the dashboard, click **New** -> **Blueprint**.
3. Connect your GitHub account and select this repository.
4. Render will read the `render.yaml` file, set up your Node.js environment, and execute `npm run build` followed by `npm run start`.
5. Once complete, your Smart Interview Room is live!

> **Note on Data Persistence:** On Render's free tier, local file storage is ephemeral. The local `db.js` JSON database will reset when the server spins down. For production applications, consider migrating the database logic in `db.js` to MongoDB, PostgreSQL, or Firebase.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! 
If you have suggestions to improve the platform, feel free to open a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---
