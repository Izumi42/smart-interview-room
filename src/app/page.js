"use client";

/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/purity */
/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Mic, MicOff, VideoOff, PhoneOff, MonitorUp, MessageSquare, Hand, Send, Info, Users, Settings, X, Keyboard, Video as VideoIcon, Loader2, Bot, Sparkles, CheckCircle, Circle, Plus, Trash2, Download, Copy, FileText, AudioLines, ChevronUp } from 'lucide-react';

export default function Home() {
  const [inCall, setInCall] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [micOn, setMicOn] = useState(false);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [userName, setUserName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [aiModel, setAiModel] = useState('groq');
  const [interviewContext, setInterviewContext] = useState('');
  const [deepgramApiKey, setDeepgramApiKey] = useState('');
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [liveTranscriptOpen, setLiveTranscriptOpen] = useState(false);
  const [transcriptError, setTranscriptError] = useState('');
  const [messages, setMessages] = useState([]);
  const [transcripts, setTranscripts] = useState([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [noiseSuppressionEnabled, setNoiseSuppressionEnabled] = useState(true);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [aiQuestions, setAiQuestions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [localSocketId, setLocalSocketId] = useState('');
  const [agendaItems, setAgendaItems] = useState([]);
  const [newAgendaItem, setNewAgendaItem] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [localHandRaised, setLocalHandRaised] = useState(false);
  const [peers, setPeers] = useState({}); // { userId: { stream, micOn, videoOn, handRaised } }

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const transcriptsEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const peerRecordersRef = useRef({});
  const deepgramSocketsRef = useRef({});
  const transcriptsRef = useRef([]);
  const agendaItemsRef = useRef([]);
  const sessionIdRef = useRef('');
  const lastAnalyzedText = useRef('');
  const userNameRef = useRef(userName);
  const isGeneratingRef = useRef(false);
  const interimTranscriptRef = useRef('');
  const audioCtxRef = useRef(null);

  // VAD (Voice Activity Detection) refs to act as a noise gate for transcription
  const localHasSpokenRef = useRef(false);
  const peerHasSpokenRef = useRef({});
  
  // Dynamic Silence Detection refs
  const localSilenceTimeoutRef = useRef(null);
  const localMaxRecordTimeoutRef = useRef(null);
  const peerSilenceTimeoutRef = useRef({});
  const peerMaxRecordTimeoutRef = useRef({});

  useEffect(() => {
    userNameRef.current = userName;
  }, [userName]);

  useEffect(() => {
    agendaItemsRef.current = agendaItems;
  }, [agendaItems]);

  useEffect(() => {
    interimTranscriptRef.current = interimTranscript;
  }, [interimTranscript]);

  useEffect(() => {
    // If the user has configured an API key, they are the interviewer (Admin)
    if (apiKey && apiKey.trim() !== '') {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
  }, [apiKey]);

  useEffect(() => {
    const savedName = localStorage.getItem('meet_username');
    if (savedName) {
      setUserName(savedName);
      setNameSubmitted(true);
    }
    
    const savedApiKey = localStorage.getItem('meet_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }

    const savedAiModel = localStorage.getItem('meet_ai_model');
    if (savedAiModel) {
      setAiModel(savedAiModel);
    }
    
    const savedContext = localStorage.getItem('meet_interview_context');
    if (savedContext) {
      setInterviewContext(savedContext);
    }
    
    const savedDeepgramKey = localStorage.getItem('meet_deepgram_key');
    if (savedDeepgramKey) {
      setDeepgramApiKey(savedDeepgramKey);
    }
    
    let sid = localStorage.getItem('meet_session_id');
    if (!sid) {
      sid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('meet_session_id', sid);
    }
    sessionIdRef.current = sid;

    // Auto-fill room ID from URL search params
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomId(roomParam);
    }
  }, []);

  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  useEffect(() => {
    let checkInterval;
    let source;
    
    if (micOn && localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        try {
          if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
          }
          const audioCtx = audioCtxRef.current;
          const analyser = audioCtx.createAnalyser();
          // Create a fresh stream just for the analyser to ensure it picks up the current track
          const stream = new MediaStream([track]);
          source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);
          analyser.fftSize = 256;
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          let currentlySpeaking = false;
          
          const checkLevel = () => {
            if (!micOn) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const average = sum / dataArray.length;
            const isSpeakingNow = average > 35;
            
            if (isSpeakingNow !== currentlySpeaking) {
              currentlySpeaking = isSpeakingNow;
              const el = document.getElementById('local-video-wrapper');
              if (el) {
                el.style.border = isSpeakingNow ? '3px solid #1a73e8' : '3px solid transparent';
                el.style.boxShadow = isSpeakingNow ? '0 0 15px rgba(26, 115, 232, 0.6)' : 'none';
              }
            }
          };
          checkInterval = setInterval(checkLevel, 150);
        } catch (e) {
          console.error("Local audio analyser failed", e);
        }
      }
    }
    
    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (source) source.disconnect();
      const el = document.getElementById('local-video-wrapper');
      if (el) {
        el.style.border = '3px solid transparent';
        el.style.boxShadow = 'none';
      }
    };
  }, [micOn]);

  useEffect(() => {
    socketRef.current = io(); 
    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Connected to signaling server');
      setLocalSocketId(socket.id);
    });

    socket.on('room-joined', (payload) => {
      setIsAdmin(payload.isAdmin);
    });

    socket.on('user-connected', async (userId) => {
      setPeers(prev => ({ ...prev, [userId]: { stream: null, micOn: true, videoOn: true, handRaised: false } }));
      await createOffer(userId);
    });

    socket.on('offer', async (payload) => {
      setPeers(prev => ({ ...prev, [payload.caller]: prev[payload.caller] || { stream: null, micOn: true, videoOn: true, handRaised: false } }));
      await handleOffer(payload);
    });

    socket.on('answer', async (payload) => {
      await handleAnswer(payload);
    });

    socket.on('ice-candidate', (incoming) => {
      handleNewICECandidateMsg(incoming);
    });

    socket.on('user-disconnected', (userId) => {
      if (peerConnectionsRef.current[userId]) {
        peerConnectionsRef.current[userId].close();
        delete peerConnectionsRef.current[userId];
      }
      setPeers(prev => {
        const newPeers = { ...prev };
        delete newPeers[userId];
        return newPeers;
      });
    });

    socket.on('chat-message', (payload) => {
      setMessages(prev => [...prev, payload]);
    });

    socket.on('interim-transcript', (payload) => {
      setInterimTranscript(payload.text);
    });

    socket.on('transcript', (payload) => {
      setInterimTranscript('');
      setTranscripts(prev => {
        const existingIdx = prev.findIndex(t => t.id && t.id === payload.id);
        if (existingIdx >= 0) {
          const newTranscripts = [...prev];
          newTranscripts[existingIdx] = payload;
          return newTranscripts;
        }
        return [...prev, payload];
      });
    });

    socket.on('raise-hand', (payload) => {
      setPeers(prev => ({
        ...prev,
        [payload.userId]: { ...prev[payload.userId], handRaised: true }
      }));
      setTimeout(() => {
        setPeers(prev => prev[payload.userId] ? {
          ...prev,
          [payload.userId]: { ...prev[payload.userId], handRaised: false }
        } : prev);
      }, 5000);
    });

    socket.on('toggle-media', (payload) => {
      setPeers(prev => prev[payload.userId] ? {
        ...prev,
        [payload.userId]: {
          ...prev[payload.userId],
          [payload.type === 'audio' ? 'micOn' : 'videoOn']: payload.isEnabled
        }
      } : prev);
    });

    socket.on('room-history', (data) => {
      if (data.transcripts && data.transcripts.length > 0) setTranscripts(data.transcripts);
      if (data.agenda && data.agenda.length > 0) setAgendaItems(data.agenda);
    });

    socket.on('add-agenda', (item) => {
      setAgendaItems(prev => {
        if (prev.find(i => i.id === item.id)) return prev;
        return [...prev, item];
      });
    });

    socket.on('toggle-agenda', (item) => {
      setAgendaItems(prev => prev.map(i => i.id === item.id ? item : i));
    });



    return () => {
      if (socket) socket.disconnect();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  // Server-side transcription using Groq Whisper (Cross-Browser)
  useEffect(() => {
    if (inCall && micOn && localStreamRef.current) {
      if (recognitionRef.current) return; // Reuse the ref for MediaRecorder

      try {
        const audioStream = new MediaStream(localStreamRef.current.getAudioTracks());
        const dgKey = localStorage.getItem('meet_deepgram_key');
        if (dgKey) {
          const socket = new WebSocket('wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true&utterance_end_ms=1000&endpointing=300', ['token', dgKey]);
          deepgramSocketsRef.current['local'] = socket;

          let keepAliveInterval;
          socket.onopen = () => {
            keepAliveInterval = setInterval(() => {
              if (socket.readyState === 1) socket.send(JSON.stringify({ type: "KeepAlive" }));
            }, 8000);
            const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus' } : {};
            const mediaRecorder = new MediaRecorder(audioStream, options);
            recognitionRef.current = mediaRecorder;
            
            mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0 && socket.readyState === 1) socket.send(e.data);
            };
            mediaRecorder.start(250);
            console.log("Deepgram Local WebSocket Connected & Streaming");
          };

          socket.onmessage = (message) => {
            try {
              const received = JSON.parse(message.data);
              if (received.channel && received.channel.alternatives && received.channel.alternatives[0]) {
                const transcriptStr = received.channel.alternatives[0].transcript;
                if (transcriptStr && received.is_final) {
                  const roleTag = isAdmin ? '(Interviewer)' : '(Candidate)';
                  socketRef.current.emit('transcript', { 
                    id: Math.random().toString(36).substr(2, 9), 
                    roomId, 
                    senderName: `${userNameRef.current} ${roleTag}`, 
                    text: transcriptStr.trim(), 
                    isFinal: true, 
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
                    unix: Date.now() 
                  });
                } else if (transcriptStr) {
                  socketRef.current.emit('interim-transcript', { roomId, text: transcriptStr });
                }
              }
            } catch(e) {}
          };
          
          socket.onerror = (e) => {
            clearInterval(keepAliveInterval);
            console.error("Deepgram local error", e);
          };
          socket.onclose = () => {
            clearInterval(keepAliveInterval);
          };
        } else {
          console.warn("Deepgram API Key not set. Local transcription is disabled.");
        }
      } catch (err) {
        console.error("Failed to start MediaRecorder", err);
      }
    } else {
      setInterimTranscript('');
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e){}
        recognitionRef.current = null;
      }
      if (deepgramSocketsRef.current['local']) {
        try { deepgramSocketsRef.current['local'].close(); } catch(e){}
        delete deepgramSocketsRef.current['local'];
      }
    }
  }, [inCall, micOn, roomId, userName, isAdmin, deepgramApiKey]);

  // Admin transcribes everyone else's audio since candidates don't have API keys
  useEffect(() => {
    if (!inCall || !isAdmin) {
      Object.values(peerRecordersRef.current).forEach(r => { 
        try { r.stop(); } catch(e){} 
      });
      peerRecordersRef.current = {};
      Object.values(deepgramSocketsRef.current).forEach(s => {
        if (s !== deepgramSocketsRef.current['local']) {
          try { s.close(); } catch(e){}
        }
      });
      return;
    }

    const apiKeyStr = localStorage.getItem('meet_api_key');
    const aiModelStr = localStorage.getItem('meet_ai_model') || 'groq';
    if (!apiKeyStr) return;

    Object.entries(peers).forEach(([peerId, peer]) => {
      if (peer.stream && peer.micOn && !peerRecordersRef.current[peerId]) {
        try {
          const audioStream = new MediaStream(peer.stream.getAudioTracks());
          if (audioStream.getAudioTracks().length === 0) return;

          const dgKey = localStorage.getItem('meet_deepgram_key');
          if (dgKey) {
            const socket = new WebSocket('wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true&utterance_end_ms=1000&endpointing=300', ['token', dgKey]);
            deepgramSocketsRef.current[peerId] = socket;

            let keepAliveInterval;
            socket.onopen = () => {
              keepAliveInterval = setInterval(() => {
                if (socket.readyState === 1) socket.send(JSON.stringify({ type: "KeepAlive" }));
              }, 8000);
              const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus' } : {};
              const mediaRecorder = new MediaRecorder(audioStream, options);
              peerRecordersRef.current[peerId] = mediaRecorder;
              
              mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0 && socket.readyState === 1) socket.send(e.data);
              };
              mediaRecorder.start(250);
              console.log("Deepgram Peer WebSocket Connected & Streaming");
            };

            socket.onmessage = (message) => {
              try {
                const received = JSON.parse(message.data);
                if (received.channel && received.channel.alternatives && received.channel.alternatives[0]) {
                  const transcriptStr = received.channel.alternatives[0].transcript;
                  if (transcriptStr && received.is_final) {
                    socketRef.current.emit('transcript', {
                      id: Math.random().toString(36).substr(2, 9),
                      roomId,
                      userId: peerId,
                      senderName: `${peer.name || 'Candidate'} (Candidate)`,
                      text: transcriptStr.trim(),
                      isFinal: true,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      unix: Date.now()
                    });
                  }
                }
              } catch(e) {}
            };
          }
            socket.onerror = (e) => {
              clearInterval(keepAliveInterval);
            };
            socket.onclose = () => {
              clearInterval(keepAliveInterval);
            };
        } catch (err) {
          console.error("Failed to start peer MediaRecorder", err);
        }
      } else if ((!peer.stream || !peer.micOn) && peerRecordersRef.current[peerId]) {
        try { peerRecordersRef.current[peerId].stop(); } catch(e){}
        delete peerRecordersRef.current[peerId];
        if (deepgramSocketsRef.current[peerId]) {
          try { deepgramSocketsRef.current[peerId].close(); } catch(e){}
          delete deepgramSocketsRef.current[peerId];
        }
      }
    });

    Object.keys(peerRecordersRef.current).forEach(peerId => {
      if (!peers[peerId]) {
        try { peerRecordersRef.current[peerId].stop(); } catch(e){}
        delete peerRecordersRef.current[peerId];
        if (deepgramSocketsRef.current[peerId]) {
          try { deepgramSocketsRef.current[peerId].close(); } catch(e){}
          delete deepgramSocketsRef.current[peerId];
        }
      }
    });
  }, [peers, inCall, isAdmin, deepgramApiKey]);

  useEffect(() => {
    if (inCall && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = screenStreamRef.current || localStreamRef.current;
    }
  }, [inCall, screenSharing]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  useEffect(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts, interimTranscript, liveTranscriptOpen]);

  const startCall = async (idToJoin) => {
    const finalRoomId = typeof idToJoin === 'string' ? idToJoin : roomId;
    if (!userName.trim()) return alert("Enter your name");
    if (!finalRoomId.trim()) return alert("Enter a room ID");
    
    setIsLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: { 
          noiseSuppression: true, 
          echoCancellation: true, 
          autoGainControl: true 
        } 
      });

      navigator.mediaDevices.enumerateDevices().then(devices => {
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        setAudioDevices(audioInputs);
        if (audioInputs.length > 0) {
          setSelectedAudioDevice(audioInputs[0].deviceId);
        }
      }).catch(err => console.error("Could not enumerate devices", err));
      
      // Wait for a smooth loading animation delay
      await new Promise(resolve => setTimeout(resolve, 800));

      stream.getAudioTracks().forEach(track => track.stop()); // Stop the hardware track so the mic goes fully off
      stream.getVideoTracks().forEach(track => track.stop()); // Stop the hardware track so the camera light turns off
      setMicOn(false);
      setVideoOn(false);

      // Audio VAD logic is now handled by the useEffect watching micOn


      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setInCall(true);
      if (typeof idToJoin === 'string') setRoomId(idToJoin);
      
      window.history.pushState(null, '', `/?room=${finalRoomId}`);
      
      socketRef.current.emit('join-room', { roomId: finalRoomId, sessionId: sessionIdRef.current });
    } catch (err) {
      console.error("Error accessing media devices.", err);
      alert("Error accessing camera and microphone. Please ensure permissions are granted.");
    } finally {
      setIsLoading(false);
    }
  };

  const createPeerConnection = (targetUserId) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });
    
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current.emit('ice-candidate', { target: targetUserId, caller: socketRef.current.id, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      console.log('Received remote track', e.streams[0]);
      const stream = e.streams[0];
      setPeers(prev => ({
        ...prev,
        [targetUserId]: { ...prev[targetUserId], stream }
      }));

      if (e.track.kind === 'audio') {
        try {
          if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
          }
          const audioCtx = audioCtxRef.current;
          const analyser = audioCtx.createAnalyser();
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);
          analyser.fftSize = 256;
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          let currentlySpeaking = false;

          const checkLevel = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const average = sum / dataArray.length;
            const isSpeakingNow = average > 35; // Tuned for loud office environments
            
            if (isSpeakingNow) {
              peerHasSpokenRef.current[targetUserId] = true;
            }
            
            if (isSpeakingNow !== currentlySpeaking) {
              currentlySpeaking = isSpeakingNow;
              
              const el = document.getElementById(`peer-video-wrapper-${targetUserId}`);
              if (el) {
                el.style.border = isSpeakingNow ? '3px solid #1a73e8' : '3px solid transparent';
                el.style.boxShadow = isSpeakingNow ? '0 0 15px rgba(26, 115, 232, 0.6)' : 'none';
              }
              
              if (!isSpeakingNow) {
                 peerSilenceTimeoutRef.current[targetUserId] = setTimeout(() => {
                    const rec = peerRecordersRef.current[targetUserId];
                    if (rec && rec.state === 'recording') rec.stop();
                 }, 1200); // Wait 1.2s of silence to avoid splitting sentences
                 clearTimeout(peerMaxRecordTimeoutRef.current[targetUserId]);
                 peerMaxRecordTimeoutRef.current[targetUserId] = null;
              } else {
                 clearTimeout(peerSilenceTimeoutRef.current[targetUserId]);
                 if (!peerMaxRecordTimeoutRef.current[targetUserId]) {
                    peerMaxRecordTimeoutRef.current[targetUserId] = setTimeout(() => {
                       const rec = peerRecordersRef.current[targetUserId];
                       if (rec && rec.state === 'recording') rec.stop();
                       peerMaxRecordTimeoutRef.current[targetUserId] = null;
                    }, 6000);
                 }
              }
            }
            setTimeout(checkLevel, 150);
          };
          checkLevel();
        } catch (err) { console.error("Remote audio analyser error", err); }
      }
    };

    const streamToUse = screenStreamRef.current || localStreamRef.current;
    if (streamToUse) {
      streamToUse.getTracks().forEach(track => {
        pc.addTrack(track, streamToUse);
      });
    }

    peerConnectionsRef.current[targetUserId] = pc;
    return pc;
  };

  const createOffer = async (targetUserId) => {
    const pc = createPeerConnection(targetUserId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current.emit('offer', { target: targetUserId, caller: socketRef.current.id, sdp: pc.localDescription, name: userNameRef.current });
  };

  const handleOffer = async (payload) => {
    setPeers(prev => ({ ...prev, [payload.caller]: { ...prev[payload.caller], name: payload.name } }));
    const pc = createPeerConnection(payload.caller);
    await pc.setRemoteDescription(payload.sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socketRef.current.emit('answer', { target: payload.caller, caller: socketRef.current.id, sdp: pc.localDescription, name: userNameRef.current });
  };

  const handleAnswer = async (payload) => {
    setPeers(prev => ({ ...prev, [payload.caller]: { ...prev[payload.caller], name: payload.name } }));
    const pc = peerConnectionsRef.current[payload.caller];
    if (pc) await pc.setRemoteDescription(payload.sdp);
  };

  const handleNewICECandidateMsg = async (incoming) => {
    const pc = peerConnectionsRef.current[incoming.caller];
    if (pc) {
      try { await pc.addIceCandidate(incoming.candidate); } 
      catch (e) { console.error('Error adding received ice candidate', e); }
    }
  };

  useEffect(() => {
    if (!autoJoinAttempted && nameSubmitted && userName && roomId && !inCall) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('room') === roomId) {
        setAutoJoinAttempted(true);
        startCall(roomId);
      }
    }
  }, [nameSubmitted, userName, roomId, autoJoinAttempted, inCall]);

  const toggleMedia = async (type) => {
    if (!localStreamRef.current) return;
    const isVideo = type === 'video';

    if (isVideo) {
      if (videoOn) {
        // Turning OFF: stop the hardware track so the webcam light goes out
        const track = localStreamRef.current.getVideoTracks()[0];
        if (track) track.stop();
        
        setVideoOn(false);
        socketRef.current.emit('toggle-media', { roomId, userId: socketRef.current.id, type, isEnabled: false });
      } else {
        // Turning ON: request a new hardware track and replace it in peer connections
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const newTrack = newStream.getVideoTracks()[0];
          
          const oldTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldTrack) localStreamRef.current.removeTrack(oldTrack);
          localStreamRef.current.addTrack(newTrack);
          
          if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
          
          Object.values(peerConnectionsRef.current).forEach(pc => {
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) sender.replaceTrack(newTrack);
          });
          
          setVideoOn(true);
          socketRef.current.emit('toggle-media', { roomId, userId: socketRef.current.id, type, isEnabled: true });
        } catch (err) {
          console.error("Failed to restart camera", err);
          alert("Could not access camera. Please check permissions.");
        }
      }
    } else {
      if (micOn) {
        // Turning OFF: stop the hardware track
        const track = localStreamRef.current.getAudioTracks()[0];
        if (track) track.stop();
        
        if (interimTranscriptRef.current && socketRef.current) {
          socketRef.current.emit('transcript', {
            id: Math.random().toString(36).substring(2, 11),
            roomId,
            text: interimTranscriptRef.current,
            senderId: socketRef.current.id,
            senderName: userNameRef.current + (isAdmin ? ' (Interviewer)' : ' (Candidate)'),
            isFinal: true,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            unix: Date.now()
          });
          interimTranscriptRef.current = '';
        }
        
        setMicOn(false);
        setInterimTranscript('');
        socketRef.current.emit('toggle-media', { roomId, userId: socketRef.current.id, type, isEnabled: false });
      } else {
        // Turning ON: request a new hardware track and replace it in peer connections
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({ audio: { 
            noiseSuppression: noiseSuppressionEnabled, 
            echoCancellation: true, 
            autoGainControl: true 
          } });
          const newTrack = newStream.getAudioTracks()[0];
          
          const oldTrack = localStreamRef.current.getAudioTracks()[0];
          if (oldTrack) {
            oldTrack.stop();
            localStreamRef.current.removeTrack(oldTrack);
          }
          localStreamRef.current.addTrack(newTrack);
          
          Object.values(peerConnectionsRef.current).forEach(pc => {
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
            if (sender) sender.replaceTrack(newTrack);
          });
          
          setMicOn(true);
          socketRef.current.emit('toggle-media', { roomId, userId: socketRef.current.id, type, isEnabled: true });
        } catch (err) {
          console.error("Failed to restart microphone", err);
          alert("Could not access microphone. Please check permissions.");
        }
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!screenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        
        // Replace video track in all peer connections
        const videoTrack = screenStream.getVideoTracks()[0];
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack);
        });

        // Update local video element
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        setScreenSharing(true);

        // Handle stop sharing from browser UI
        videoTrack.onended = () => {
          stopScreenShare();
        };
      } catch (err) {
        console.error("Error sharing screen", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    Object.values(peerConnectionsRef.current).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track.kind === 'video');
      if (sender) sender.replaceTrack(videoTrack);
    });
    if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    setScreenSharing(false);
  };

  const toggleNoiseSuppression = async () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        try {
          const currentConstraints = audioTrack.getConstraints();
          const nextState = !noiseSuppressionEnabled;
          await audioTrack.applyConstraints({
            ...currentConstraints,
            noiseSuppression: nextState
          });
          setNoiseSuppressionEnabled(nextState);
        } catch (e) {
          console.error("Failed to toggle noise suppression", e);
        }
      }
    }
  };

  const changeAudioDevice = async (deviceId) => {
    if (!localStreamRef.current) return;
    try {
      const audioConstraints = {
        deviceId: { exact: deviceId },
        noiseSuppression: noiseSuppressionEnabled,
        echoCancellation: true,
        autoGainControl: true
      };
      
      const newStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      const newAudioTrack = newStream.getAudioTracks()[0];
      
      const oldAudioTrack = localStreamRef.current.getAudioTracks()[0];
      if (oldAudioTrack) oldAudioTrack.stop();
      
      localStreamRef.current.removeTrack(oldAudioTrack);
      localStreamRef.current.addTrack(newAudioTrack);
      
      Object.values(peerConnectionsRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
        if (sender) sender.replaceTrack(newAudioTrack);
      });
      
      setSelectedAudioDevice(deviceId);
      setShowAudioMenu(false);
      newAudioTrack.enabled = micOn;
    } catch (err) {
      console.error("Failed to change audio device", err);
    }
  };

  const toggleHand = () => {
    setLocalHandRaised(true);
    socketRef.current.emit('raise-hand', { roomId, userId: socketRef.current.id });
    setTimeout(() => setLocalHandRaised(false), 5000);
  };

  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msg = {
      roomId,
      message: chatInput,
      senderId: socketRef.current.id,
      senderName: userName,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    socketRef.current.emit('chat-message', msg);
    setChatInput('');
  };

  const endCall = () => {
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    setPeers({});
    setInCall(false);
    setChatOpen(false);
    setParticipantsOpen(false);
    window.history.pushState(null, '', '/');
    setAiSidebarOpen(false);
    setMessages([]);
  };

  const toggleChat = () => {
    setChatOpen(!chatOpen);
    setParticipantsOpen(false);
    setAiSidebarOpen(false);
    setInfoOpen(false);
  };

  const toggleParticipants = () => {
    setParticipantsOpen(!participantsOpen);
    setChatOpen(false);
    setAiSidebarOpen(false);
    setInfoOpen(false);
  };

  const toggleAiSidebar = () => {
    setAiSidebarOpen(!aiSidebarOpen);
    setChatOpen(false);
    setParticipantsOpen(false);
    setInfoOpen(false);
  };

  const toggleInfo = () => {
    setInfoOpen(!infoOpen);
    setChatOpen(false);
    setParticipantsOpen(false);
    setAiSidebarOpen(false);
  };

  const generateAiQuestions = async (isAuto = false) => {
    const currentTranscripts = transcriptsRef.current;
    if (currentTranscripts.length === 0) {
      if (!isAuto) alert("No conversation to analyze yet!");
      return;
    }
    if (isGeneratingRef.current) return;
    
    setIsGenerating(true);
    isGeneratingRef.current = true;
    try {
      const transcriptText = currentTranscripts.map(t => `${t.senderName}: ${t.text}`).join('\n');
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcriptText, type: 'questions', agent: aiModel || localStorage.getItem('meet_ai_model') || 'groq', apiKey: apiKey || localStorage.getItem('meet_api_key') })
      });
      const data = await res.json();
      if (data.questions) {
        setAiQuestions(data.questions);
      } else {
        const errorMsg = data.error?.message || data.error || "Could not generate questions.";
        console.error("AI Generation Failed:", errorMsg);
        if (!isAuto) alert(errorMsg);
        setAiQuestions(`[API Error]: ${errorMsg}\n\nPlease check your LLM API Key in the settings.`);
      }
    } catch (err) {
      console.error(err);
      if (!isAuto) alert("Error calling AI API");
      setAiQuestions(`[Network Error]: Could not reach the AI endpoint.\n\nCheck your internet connection or API keys.`);
    } finally {
      setIsGenerating(false);
      isGeneratingRef.current = false;
    }
  };


  const evaluateAgenda = async () => {
    const currentTranscripts = transcriptsRef.current;
    const currentAgenda = agendaItemsRef.current;
    
    const pendingItems = currentAgenda.filter(i => !i.done);
    if (pendingItems.length === 0 || currentTranscripts.length === 0) return;

    try {
      const transcriptText = currentTranscripts.map(t => `${t.senderName}: ${t.text}`).join('\n');
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transcript: transcriptText, 
          type: 'evaluate_agenda',
          agendaItems: pendingItems.map(i => ({ id: i.id, text: i.text })),
          agent: aiModel || localStorage.getItem('meet_ai_model') || 'groq',
          apiKey: apiKey || localStorage.getItem('meet_api_key')
        })
      });
      const data = await res.json();
      if (data.answeredIds && data.answeredIds.length > 0) {
        data.answeredIds.forEach(id => {
          const item = currentAgenda.find(i => i.id === id);
          if (item && socketRef.current && !item.done) {
             socketRef.current.emit('toggle-agenda', { ...item, done: true, roomId });
          }
        });
      } else if (data.error) {
        console.error("Agenda evaluation error:", data.error);
      }
    } catch (err) {
      console.error("Error evaluating agenda:", err);
    }
  };

  useEffect(() => {
    // Only analyze if user is admin and there are transcripts
    if (!isAdmin || transcripts.length === 0) return;

    const currentText = transcripts.map(t => `${t.senderName}: ${t.text}`).join('\n');
    const lastTranscript = transcripts[transcripts.length - 1];
    
    // Only trigger if the text has changed since last analysis
    if (lastTranscript && currentText !== lastAnalyzedText.current) {
      const timeout = setTimeout(() => {
        lastAnalyzedText.current = currentText;
        generateAiQuestions(true);
        evaluateAgenda();
      }, 500); // 0.5 second pause triggers the AI
      
      return () => clearTimeout(timeout);
    }
  }, [isAdmin, transcripts]);

  const toggleAgendaItem = (id) => {
    const item = agendaItems.find(i => i.id === id);
    if (item && socketRef.current) {
      socketRef.current.emit('toggle-agenda', { ...item, done: !item.done, roomId });
    }
  };

  const addAgendaItem = (e) => {
    e.preventDefault();
    if (!newAgendaItem.trim() || !socketRef.current) return;
    const id = Math.random().toString(36).substring(2, 10);
    socketRef.current.emit('add-agenda', { id, roomId, text: newAgendaItem, done: false });
    setNewAgendaItem('');
  };

  const addQuestionToAgenda = (text) => {
    const cleanText = text.replace(/^\d+\.\s*/, '').trim(); // Remove leading numbers
    if (!cleanText || !socketRef.current) return;
    const id = Math.random().toString(36).substring(2, 10);
    socketRef.current.emit('add-agenda', { id, roomId, text: cleanText, done: false });
    
    // Remove it from the suggestions list so it disappears
    setAiQuestions(prev => prev.split('\n').filter(line => !line.includes(cleanText)).join('\n'));
  };

  const removeAgendaItem = (id) => {
    setAgendaItems(prev => prev.filter(item => item.id !== id));
  };

  const downloadSummary = () => {
    const dateStr = new Date().toLocaleString();
    let content = `Interview Summary - ${dateStr}\n\n`;
    
    content += `=== Smart Agenda ===\n`;
    if (agendaItems.length === 0) content += `No agenda items.\n`;
    agendaItems.forEach(item => {
      content += `[${item.done ? 'x' : ' '}] ${item.text}\n`;
    });
    content += `\n`;

    content += `=== AI Generated Questions ===\n`;
    content += aiQuestions ? `${aiQuestions}\n` : `No questions generated.\n`;
    content += `\n`;

    content += `=== Live Transcript ===\n`;
    if (transcripts.length === 0) content += `No transcript available.\n`;
    transcripts.forEach(t => {
      content += `[${t.timestamp}] ${t.senderName}: ${t.text}\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Interview_Summary_${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalParticipants = Object.keys(peers).length + 1;
  const gridColumns = totalParticipants === 1 ? 1 : totalParticipants <= 4 ? 2 : totalParticipants <= 9 ? 3 : 4;

  return (
    <div className="app-container">
      {!nameSubmitted && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 16px 48px rgba(0,0,0,0.2)', textAlign: 'center', maxWidth: '420px', width: '90%'}}>
            <h2 style={{marginBottom: '8px', fontSize: '20px', fontWeight: 500, color: 'var(--gm-text)'}}>Welcome</h2>
            <p style={{color: 'var(--gm-text-muted)', marginBottom: '24px', fontSize: '15px'}}>Please enter your name to join</p>
            <form onSubmit={(e) => { 
              e.preventDefault(); 
              if(userName.trim()) {
                setNameSubmitted(true); 
                localStorage.setItem('meet_username', userName.trim());
              }
            }} autoComplete="off">
              <div className="input-wrapper" style={{marginBottom: '24px', width: '100%'}}>
                <input 
                  type="text"
                  name="participantName"
                  placeholder="Your Name" 
                  value={userName} 
                  onChange={(e) => setUserName(e.target.value)}
                  style={{paddingLeft: '16px', width: '100%'}}
                  autoFocus
                  autoComplete="off"
                />
              </div>
              <button type="submit" className="btn-primary" style={{width: '100%', justifyContent: 'center'}} disabled={!userName.trim()}>
                Continue
              </button>
            </form>
          </div>
        </div>
      )}
      
      {isLoading && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.9)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
          <Loader2 size={48} color="var(--gm-primary)" className="animate-spin" style={{marginBottom: '16px'}} />
          <h2 style={{color: 'var(--gm-text)', fontSize: '20px', fontWeight: 500}}>Joining meeting...</h2>
        </div>
      )}

      {!inCall ? (
        <>
          <header className="header-light">
            <div className="logo-light">
              <VideoIcon size={32} color="var(--gm-primary)" />
              <span style={{marginLeft: '10px', fontWeight: 600, fontSize: '24px', letterSpacing: '-0.5px'}}>Meet-N-Greet</span>
            </div>
            <div className="header-actions" style={{display: 'flex', alignItems: 'center', gap: '24px'}}>
              <span style={{color: 'var(--gm-text-muted)'}}>{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '12px', background: '#f1f3f4', padding: '4px 12px 4px 4px', borderRadius: '24px'}}>
                  <div className="video-off-avatar" style={{width: '32px', height: '32px', fontSize: '14px', background: 'var(--gm-primary)', color: 'white'}}>{userName ? userName.charAt(0).toUpperCase() : ''}</div>
                  <button onClick={() => setNameSubmitted(false)} style={{background: 'transparent', border: 'none', padding: 0, margin: 0, fontSize: '15px', fontWeight: 500, color: 'var(--gm-text)', cursor: 'pointer'}}>
                    {userName} <span style={{color: 'var(--gm-primary)', fontSize: '13px', marginLeft: '6px'}}>(Change)</span>
                  </button>
                </div>
                
                {nameSubmitted && (
                  <div onClick={() => setShowAiSettings(true)} style={{display: 'flex', alignItems: 'center', gap: '12px', background: '#f1f3f4', padding: '4px 12px 4px 4px', borderRadius: '24px', cursor: 'pointer', transition: 'background 0.2s'}} onMouseEnter={(e) => e.currentTarget.style.background = '#e8eaed'} onMouseLeave={(e) => e.currentTarget.style.background = '#f1f3f4'}>
                    <div className="video-off-avatar" style={{width: '32px', height: '32px', background: 'var(--gm-primary)', color: 'white'}}>
                      <Bot size={18} />
                    </div>
                    <div style={{background: 'transparent', border: 'none', padding: 0, margin: 0, fontSize: '15px', fontWeight: 500, color: 'var(--gm-text)', paddingRight: '4px'}}>
                      AI Settings
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>
          
          {showAiSettings && (
            <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <div style={{background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 16px 48px rgba(0,0,0,0.2)', maxWidth: '400px', width: '90%'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                  <h2 style={{margin: 0, fontSize: '18px', fontWeight: 500, color: 'var(--gm-text)', display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <Bot size={20} color="var(--gm-primary)"/> AI Settings
                  </h2>
                  <button onClick={() => setShowAiSettings(false)} style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gm-text-muted)'}}>
                    <X size={20} />
                  </button>
                </div>
                <p style={{color: 'var(--gm-text-muted)', fontSize: '13px', marginBottom: '20px'}}>Configure AI to enable smart transcripts and suggested interview questions. (Admin only)</p>
                
                <label style={{display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px'}}>AI Model</label>
                <select 
                  value={aiModel} 
                  onChange={(e) => {
                    setAiModel(e.target.value);
                    localStorage.setItem('meet_ai_model', e.target.value);
                  }} 
                  style={{width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--gm-border)', marginBottom: '16px', fontSize: '14px', outline: 'none', background: '#f8f9fa'}}
                >
                  <option value="groq">Groq (Llama-3 - Fastest)</option>
                  <option value="openai">ChatGPT (OpenAI)</option>
                  <option value="gemini">Gemini (Google)</option>
                  <option value="anthropic">Claude (Anthropic)</option>
                </select>

                <label style={{display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px'}}>LLM API Key (ChatGPT/Llama)</label>
                <div className="input-wrapper" style={{marginBottom: '16px'}}>
                  <Keyboard size={18} className="input-icon" />
                  <input 
                    type="password" 
                    placeholder="Enter API Key" 
                    value={apiKey} 
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      localStorage.setItem('meet_api_key', e.target.value);
                    }} 
                    style={{width: '100%', paddingLeft: '40px', paddingRight: '12px'}}
                  />
                </div>
                
                <label style={{display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px'}}>Deepgram API Key (Transcription)</label>
                <div className="input-wrapper" style={{marginBottom: '24px'}}>
                  <Keyboard size={18} className="input-icon" />
                  <input 
                    type="password" 
                    placeholder="Enter Deepgram API Key" 
                    value={deepgramApiKey} 
                    onChange={(e) => {
                      setDeepgramApiKey(e.target.value);
                      localStorage.setItem('meet_deepgram_key', e.target.value);
                    }} 
                    style={{width: '100%', paddingLeft: '40px', paddingRight: '12px'}}
                  />
                </div>
                
                <label style={{display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px'}}>Interview Context / Keywords (Optional)</label>
                <div className="input-wrapper" style={{marginBottom: '16px'}}>
                  <FileText size={18} className="input-icon" />
                  <input 
                    type="text" 
                    placeholder="e.g. React, Frontend Developer, UI/UX" 
                    value={interviewContext} 
                    onChange={(e) => {
                      setInterviewContext(e.target.value);
                      localStorage.setItem('meet_interview_context', e.target.value);
                    }} 
                    style={{width: '100%', paddingLeft: '40px', paddingRight: '12px'}}
                  />
                </div>

                <button onClick={() => setShowAiSettings(false)} className="btn-primary" style={{width: '100%', justifyContent: 'center'}}>
                  Save & Close
                </button>
              </div>
            </div>
          )}

          <div className="join-layout">
            <div className="join-content">
              <h1>Premium video meetings. <br/>Now free for everyone.</h1>
              <p>Secure, fast, and highly reliable video conferencing tailored for you. Connect, collaborate, and celebrate from anywhere with Meet-N-Greet.</p>
              
              <div className="action-row">
                <button onClick={() => startCall(Math.random().toString(36).substring(2, 9))} className="btn-primary" disabled={!userName.trim()}>
                  <VideoIcon size={20} />
                  New meeting
                </button>
                <div className="input-wrapper">
                  <Keyboard size={20} className="input-icon" />
                  <input 
                    type="text" 
                    placeholder="Enter a code or link" 
                    value={roomId} 
                    onChange={(e) => setRoomId(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && userName.trim() && startCall()}
                  />
                </div>
                <button 
                  onClick={() => startCall()} 
                  className="btn-text" 
                  disabled={!roomId.trim() || !userName.trim()}
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="call-layout">
          <div className="call-main">
            {inCall && isAdmin && !liveTranscriptOpen && (
              <button 
                onClick={() => setLiveTranscriptOpen(true)}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 10,
                  background: 'var(--gm-surface)',
                  color: 'var(--gm-text)',
                  border: '1px solid var(--gm-border)',
                  borderLeft: 'none',
                  borderRadius: '0 8px 8px 0',
                  padding: '16px 8px',
                  cursor: 'pointer',
                  boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s'
                }}
              >
                <FileText size={20} color="var(--gm-primary)" />
                <span style={{writingMode: 'vertical-rl', fontSize: '13px', fontWeight: 500, letterSpacing: '1px'}}>LIVE TRANSCRIPTS</span>
              </button>
            )}
            
            {inCall && isAdmin && liveTranscriptOpen && (
              <div style={{
                width: '320px',
                height: '100%',
                background: 'var(--gm-surface)',
                borderRight: '1px solid var(--gm-border)',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                zIndex: 5
              }}>
                <div style={{
                  padding: '16px',
                  borderBottom: '1px solid var(--gm-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'white'
                }}>
                  <h3 style={{margin: 0, fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gm-text)'}}>
                    <FileText size={18} color="var(--gm-primary)" />
                    Live Transcripts
                  </h3>
                  <button onClick={() => setLiveTranscriptOpen(false)} style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gm-text-muted)', padding: '4px'}}>
                    <X size={18} />
                  </button>
                </div>
                <div style={{flex: 1, overflowY: 'auto', padding: '16px', background: '#f8f9fa', display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  {transcriptError && (
                    <div style={{padding: '12px', background: '#fce8e6', color: '#c5221f', borderRadius: '8px', fontSize: '13px', marginBottom: '4px', border: '1px solid #fad2cf'}}>
                      <b>API Error:</b> {transcriptError}
                    </div>
                  )}
                  {transcripts.length === 0 && !interimTranscript ? (
                    <p style={{fontSize: '13px', color: 'var(--gm-text-muted)', textAlign: 'center', marginTop: '20px', fontStyle: 'italic'}}>No conversation detected yet. Make sure your microphone is unmuted and you are speaking clearly.</p>
                  ) : (
                    <>
                      {transcripts.map((t, i) => (
                        <div key={i} style={{background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e9ecef', boxShadow: '0 1px 2px rgba(0,0,0,0.02)'}}>
                          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center'}}>
                            <span style={{fontSize: '12px', fontWeight: 600, color: t.senderName.includes('(Interviewer)') ? 'var(--gm-primary)' : '#0f9d58'}}>{t.senderName}</span>
                            <span style={{fontSize: '11px', color: 'var(--gm-text-muted)'}}>{t.timestamp}</span>
                          </div>
                          <p style={{margin: 0, fontSize: '14px', color: 'var(--gm-text)', lineHeight: '1.5'}}>{t.text}</p>
                        </div>
                      ))}
                      {interimTranscript && (
                        <div style={{marginBottom: '16px', display: 'flex', flexDirection: 'column', opacity: 0.7}}>
                          <span style={{fontSize: '12px', fontWeight: 600, color: 'var(--gm-text-muted)', marginBottom: '4px'}}>
                            Hearing...
                          </span>
                          <div style={{background: 'white', padding: '12px', borderRadius: '8px', fontSize: '14px', lineHeight: '1.5', color: 'var(--gm-text)', border: '1px solid #e9ecef', fontStyle: 'italic'}}>
                            {interimTranscript}
                          </div>
                        </div>
                      )}
                      <div ref={transcriptsEndRef} />
                    </>
                  )}
                </div>
              </div>
            )}
            <div className="video-area">
              <div className="video-grid" style={{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }}>
                <div id="local-video-wrapper" className="video-wrapper" style={{ 
                  border: '3px solid transparent', 
                  boxShadow: 'none',
                  transition: 'border 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box'
                }}>
                  <video ref={localVideoRef} autoPlay muted playsInline disablePictureInPicture className={`local-video ${!videoOn && !screenSharing ? 'hidden' : ''}`}></video>
                  {!videoOn && !screenSharing && <div className="video-off-avatar">{userName ? userName.charAt(0).toUpperCase() : 'Y'}</div>}
                  <div className="name-tag">You ({userName}) {localHandRaised && ' ✋'} {!micOn && ' 🔇'}</div>
                </div>
                {Object.entries(peers).map(([id, peer]) => {
                  const displayName = peer.name || id.substring(0, 8);
                  return (
                  <div key={id} id={`peer-video-wrapper-${id}`} className="video-wrapper" style={{ 
                    border: '3px solid transparent', 
                    boxShadow: 'none',
                    transition: 'border 0.2s, box-shadow 0.2s',
                    boxSizing: 'border-box'
                  }}>
                    <video ref={el => { if (el && peer.stream && el.srcObject !== peer.stream) el.srcObject = peer.stream; }} autoPlay playsInline disablePictureInPicture className={`remote-video ${!peer.videoOn ? 'hidden' : ''}`}></video>
                    {!peer.videoOn && <div className="video-off-avatar">{displayName.charAt(0).toUpperCase()}</div>}
                    <div className="name-tag">
                      {displayName} {peer.handRaised && ' ✋'} {!peer.micOn && ' 🔇'}
                    </div>
                  </div>
                )})}
              </div>
            </div>

            {(chatOpen || participantsOpen || aiSidebarOpen || infoOpen) && (
              <div className="gm-sidebar">
                <div className="sidebar-header">
                  <h3>{chatOpen ? 'In-call messages' : participantsOpen ? 'People' : infoOpen ? 'Meeting details' : 'AI Assistant'}</h3>
                  <button className="close-btn" onClick={() => { setChatOpen(false); setParticipantsOpen(false); setAiSidebarOpen(false); setInfoOpen(false); }}>
                    <X size={20} />
                  </button>
                </div>
                
                {aiSidebarOpen && (
                  <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
                    <div style={{flex: 1, overflowY: 'auto', background: '#f8f9fa'}}>
                      <div style={{padding: '24px 16px', borderBottom: '1px solid var(--gm-border)', background: 'white'}}>
                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px'}}>
                          <h4 style={{margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--gm-text)'}}>Smart Agenda</h4>
                        </div>
                        {agendaItems.length === 0 && (
                          <p style={{fontSize: '13px', color: 'var(--gm-text-muted)', fontStyle: 'italic', marginBottom: '8px', textAlign: 'center'}}>No agenda items added.</p>
                        )}
                        {agendaItems.map(item => (
                          <div key={item.id} className={`agenda-item ${item.done ? 'done' : ''}`}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: 'pointer'}} onClick={() => toggleAgendaItem(item.id)}>
                              {item.done ? <CheckCircle size={18} color="var(--gm-primary)" /> : <Circle size={18} color="#dadce0" />}
                              <span style={{fontSize: '14px', color: 'var(--gm-text)', textDecoration: item.done ? 'line-through' : 'none', fontWeight: item.done ? 400 : 500}}>{item.text}</span>
                            </div>
                            <button onClick={() => removeAgendaItem(item.id)} style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gm-text-muted)', padding: '4px'}}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                        <form onSubmit={addAgendaItem} style={{display: 'flex', gap: '8px', marginTop: '16px'}}>
                          <input 
                            type="text" 
                            value={newAgendaItem}
                            onChange={(e) => setNewAgendaItem(e.target.value)}
                            placeholder="Add new agenda item..." 
                            style={{flex: 1, padding: '10px 14px', border: '1px solid var(--gm-border)', borderRadius: '8px', fontSize: '14px', outline: 'none', background: '#f1f3f4'}}
                          />
                          <button type="submit" style={{background: 'var(--gm-primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '0 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                            <Plus size={18} />
                          </button>
                        </form>
                      </div>

                      <div style={{padding: '24px 16px'}}>
                        <button onClick={downloadSummary} className="btn-secondary" style={{width: '100%', justifyContent: 'center', marginBottom: '12px'}}>
                          <Download size={18} />
                          Download Summary
                        </button>
                        
                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px'}}>
                          <h4 style={{margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--gm-text)'}}>Suggested Questions</h4>
                          <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                            {isGenerating && (
                              <span style={{fontSize: '12px', color: 'var(--gm-primary)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500}}><Loader2 size={14} className="animate-spin"/> Analyzing...</span>
                            )}
                            {aiQuestions && (
                              <button onClick={() => setAiQuestions('')} style={{background: 'none', border: 'none', color: 'var(--gm-text-muted)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'}}>
                                <Trash2 size={14} /> Clear
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {!aiQuestions ? (
                          <div style={{background: 'white', border: '1px dashed var(--gm-border)', borderRadius: '8px', padding: '32px 16px', textAlign: 'center'}}>
                            <Bot size={32} color="#dadce0" style={{marginBottom: '12px'}} />
                            <p style={{color: 'var(--gm-text-muted)', fontSize: '14px', margin: 0}}>Start listening to let the AI analyze the conversation and suggest questions.</p>
                          </div>
                        ) : (
                          <div className="ai-suggestions-box" style={{marginTop: 0}}>
                            {aiQuestions.split('\n').map((line, i) => (
                              line.trim() ? (
                                <div 
                                  key={i} 
                                  onClick={() => addQuestionToAgenda(line.replace(/^\d+\.\s*/, '').trim())}
                                  className="suggested-question"
                                >
                                  <Plus size={14} className="add-icon" />
                                  <span>{line.replace(/^\d+\.\s*/, '').trim()}</span>
                                </div>
                              ) : null
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {participantsOpen && (
                  <div style={{padding: '16px', overflowY: 'auto', flex: 1, color: 'var(--gm-text)'}}>
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                        <div className="video-off-avatar" style={{width: '32px', height: '32px', fontSize: '14px'}}>{userName ? userName.charAt(0).toUpperCase() : 'Y'}</div>
                        <span style={{fontWeight: 500}}>You ({userName})</span>
                      </div>
                      <div>
                        {!micOn && <MicOff size={16} color="var(--gm-danger)" style={{marginLeft: '8px'}}/>}
                        {localHandRaised && <Hand size={16} color="#fbbc04" style={{marginLeft: '8px'}}/>}
                      </div>
                    </div>
                    {Object.entries(peers).map(([id, peer]) => {
                      const displayName = peer.name || id.substring(0, 8);
                      return (
                      <div key={id} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                          <div className="video-off-avatar" style={{width: '32px', height: '32px', fontSize: '14px', background: '#e8eaed', color: '#5f6368'}}>{displayName.charAt(0).toUpperCase()}</div>
                          <span style={{fontWeight: 500}}>{displayName}</span>
                        </div>
                        <div>
                          {!peer.micOn && <MicOff size={16} color="var(--gm-danger)" style={{marginLeft: '8px'}}/>}
                          {peer.handRaised && <Hand size={16} color="#fbbc04" style={{marginLeft: '8px'}}/>}
                        </div>
                      </div>
                    )})}
                  </div>
                )}
                
                {chatOpen && (
                  <>
                    <div className="chat-messages">
                      <p style={{fontSize: '12px', color: 'var(--gm-text-muted)', textAlign: 'center', margin: '0 0 16px 0'}}>
                        Messages can only be seen by people in the call and are deleted when the call ends.
                      </p>
                      {messages.map((msg, i) => (
                        <div key={`${msg.timestamp}-${msg.senderId}-${i}`} className={`chat-msg`}>
                          <div className="msg-meta">
                            <span className="msg-sender">{msg.senderId === localSocketId ? `You (${userName})` : (msg.senderName || msg.senderId.substring(0, 5))}</span>
                            <span className="msg-time">{msg.timestamp}</span>
                          </div>
                          <div className="msg-text">{msg.message}</div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                    <form className="chat-input-form" onSubmit={sendChatMessage}>
                      <div className="chat-input-wrapper">
                        <input 
                          type="text" 
                          placeholder="Send a message" 
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                        />
                        <button type="submit" className="send-btn" disabled={!chatInput.trim()}>
                          <Send size={18} />
                        </button>
                      </div>
                    </form>
                  </>
                )}
                {infoOpen && (
                  <div style={{padding: '24px', flex: 1, color: 'var(--gm-text)'}}>
                    <h4 style={{fontSize: '16px', fontWeight: 500, marginBottom: '16px'}}>Joining Info</h4>
                    <div style={{background: '#f1f3f4', padding: '16px', borderRadius: '8px', marginBottom: '24px'}}>
                      <p style={{fontSize: '13px', color: 'var(--gm-text-muted)', marginBottom: '4px'}}>Meeting link or code</p>
                      <div style={{fontSize: '16px', fontWeight: 500, userSelect: 'all', wordBreak: 'break-all'}}>{typeof window !== 'undefined' ? `${window.location.origin}/?room=${roomId}` : roomId}</div>
                    </div>
                    <button 
                      className="btn-primary" 
                      style={{width: '100%', justifyContent: 'center', background: '#e8f0fe', color: 'var(--gm-primary)', boxShadow: 'none'}}
                      onClick={() => {
                        const url = window.location.origin + '/?room=' + roomId;
                        navigator.clipboard.writeText(url);
                        const btn = document.getElementById('copy-btn-text');
                        if (btn) {
                          btn.innerText = 'Copied to clipboard!';
                          setTimeout(() => { if (btn) btn.innerText = 'Copy joining info'; }, 2000);
                        }
                      }}
                    >
                      <Copy size={18} />
                      <span id="copy-btn-text">Copy joining info</span>
                    </button>
                    
                    <div style={{marginTop: '32px', padding: '16px', borderTop: '1px solid var(--gm-border)'}}>
                      <p style={{fontSize: '13px', color: 'var(--gm-text-muted)', lineHeight: '1.5'}}>
                        Share this meeting code with others you want in the meeting. They can enter it on the Meet-N-Greet homepage to join directly.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bottom-bar">
            <div className="bar-left">
              <span>{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              <span style={{margin: '0 12px'}}>|</span>
              <span 
                style={{cursor: 'pointer'}} 
                onClick={() => {
                  navigator.clipboard.writeText(roomId);
                }}
                title="Click to copy Room ID"
              >
                {roomId}
              </span>
            </div>
            
            <div className="bar-center">
              <div style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
                <div style={{display: 'flex', background: !micOn ? '#ea4335' : '#3c4043', borderRadius: '24px', marginRight: '10px'}}>
                  <button className="gm-icon-btn" style={{background: 'transparent', margin: 0, paddingRight: '8px', borderTopRightRadius: 0, borderBottomRightRadius: 0}} onClick={() => toggleMedia('audio')}>
                    {micOn ? <Mic size={20} color={!micOn ? 'white' : 'var(--gm-text)'} /> : <MicOff size={20} color="white" />}
                  </button>
                  <button className="gm-icon-btn" style={{background: 'transparent', margin: 0, paddingLeft: '4px', paddingRight: '8px', borderTopLeftRadius: 0, borderBottomLeftRadius: 0}} onClick={() => setShowAudioMenu(!showAudioMenu)}>
                    <ChevronUp size={16} color={!micOn ? 'white' : 'var(--gm-text)'} />
                  </button>
                </div>
                
                {showAudioMenu && (
                  <div style={{position: 'absolute', bottom: '100%', left: 0, marginBottom: '8px', background: '#282a2d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', padding: '8px 0', minWidth: '240px', zIndex: 100}}>
                    <div style={{padding: '4px 16px', fontSize: '11px', fontWeight: 600, color: '#9aa0a6', letterSpacing: '0.5px'}}>MICROPHONE</div>
                    {audioDevices.length === 0 && <div style={{padding: '8px 16px', fontSize: '13px', color: '#9aa0a6'}}>No devices found</div>}
                    {audioDevices.map(device => (
                      <div key={device.deviceId} onClick={() => changeAudioDevice(device.deviceId)} style={{padding: '8px 16px', fontSize: '13px', cursor: 'pointer', background: selectedAudioDevice === device.deviceId ? 'rgba(255,255,255,0.1)' : 'transparent', display: 'flex', alignItems: 'center', gap: '8px', color: '#e8eaed'}}>
                        {selectedAudioDevice === device.deviceId ? <CheckCircle size={14} color="var(--gm-primary)" /> : <div style={{width: 14}}/>}
                        <span style={{flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                          {device.label ? device.label : (device.deviceId ? `Microphone (${device.deviceId.substring(0, 4)})` : 'System Default Microphone')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <button className={`gm-icon-btn ${!noiseSuppressionEnabled ? 'danger' : ''}`} onClick={toggleNoiseSuppression} title="Toggle Noise Suppression (Background Noise)">
                <div style={{position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <AudioLines size={20} />
                  {!noiseSuppressionEnabled && <div style={{position: 'absolute', width: '24px', height: '2px', backgroundColor: 'currentColor', transform: 'rotate(-45deg)'}} />}
                </div>
              </button>
              <button className={`gm-icon-btn ${!videoOn ? 'danger' : ''}`} onClick={() => toggleMedia('video')}>
                {videoOn ? <VideoIcon size={20} /> : <VideoOff size={20} />}
              </button>
              <button className={`gm-icon-btn ${localHandRaised ? 'active' : ''}`} onClick={toggleHand}>
                <Hand size={20} />
              </button>
              <button className={`gm-icon-btn ${screenSharing ? 'active' : ''}`} onClick={toggleScreenShare}>
                <MonitorUp size={20} />
              </button>
              <button className="gm-end-call" onClick={endCall}>
                <PhoneOff size={24} />
              </button>
            </div>

            <div className="bar-right">
              {isAdmin && (
                <button className={`gm-icon-btn ghost ${aiSidebarOpen ? 'active' : ''}`} onClick={toggleAiSidebar} title="AI Interview Assistant">
                  <Bot size={20} />
                </button>
              )}
              <button className={`gm-icon-btn ghost ${infoOpen ? 'active' : ''}`} onClick={toggleInfo} title="Meeting details">
                <Info size={20} />
              </button>
              <button className={`gm-icon-btn ghost ${participantsOpen ? 'active' : ''}`} onClick={toggleParticipants}>
                <Users size={20} />
              </button>
              <button className={`gm-icon-btn ghost ${chatOpen ? 'active' : ''}`} onClick={toggleChat}>
                <MessageSquare size={20} />
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}
