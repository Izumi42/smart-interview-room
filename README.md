# Smart Interview Room

🔴 **Live Demo:** [https://smart-interview-room.onrender.com/](https://smart-interview-room.onrender.com/)

A modern, highly reliable video conferencing and interview platform with an integrated AI assistant. Built to seamlessly connect, collaborate, and celebrate from anywhere.

## ✨ Features

- **Real-Time Video & Audio:** Fast and secure WebRTC-based communication.
- **AI Interview Assistant:** Get real-time suggested questions and conversational analysis based on the live transcript.
- **In-Call Chat:** Send and receive messages instantly during the call.
- **Meeting Agenda & Scorecards:** Keep track of talking points and check them off as you go.
- **Screen Sharing:** Share your screen with other participants effortlessly.
- **Hand Raising & Reactions:** Non-verbally signal when you want to speak.
- **Meeting Details & Link Sharing:** Easily copy and share room links to invite participants.

## 🛠️ Technologies Used

- **Framework:** [Next.js](https://nextjs.org)
- **Real-Time Communication:** WebSockets ([Socket.io](https://socket.io/)) and WebRTC
- **Styling:** Custom CSS (Modern, Google Meet-inspired UI)
- **Icons:** [Lucide React](https://lucide.dev/)

## 🚀 Getting Started Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/Izumi42/smart-interview-room.git
   cd smart-interview-room
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🌍 Deployment

This project uses a custom Node.js server (`server.js`) to handle WebSockets, so it is best deployed on platforms like **Render**, Railway, or a VPS rather than standard serverless platforms like Vercel.

**To deploy on Render (Free & Automated):**
1. Create a new **Blueprint** on Render.com.
2. Connect this GitHub repository.
3. Render will automatically read the included `render.yaml` file and deploy the app!
