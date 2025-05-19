"use client";
import { useState, useRef, useEffect } from "react";

export default function Home() {
  // Load chat history from localStorage on component mount
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'bot', content: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load chat history from localStorage on initial render
  useEffect(() => {
    const savedMessages = localStorage.getItem('chatHistory');
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages);
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
      }
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('chatHistory', JSON.stringify(messages));
    }
  }, [messages]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Start audio recording
  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await sendAudioToWebhook(audioBlob);
        
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("Error accessing microphone:", err);
      } else {
        console.error("Error accessing microphone:", err);
      }
    }
  };

  // Clear chat history
  const clearChatHistory = () => {
    setMessages([]);
    localStorage.removeItem('chatHistory');
  };

  // Stop audio recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Send audio to n8n webhook
  const sendAudioToWebhook = async (audioBlob: Blob) => {
    try {
      setLoading(true);
      
      // Add a message to show the user their audio is being processed
      setMessages(prev => [...prev, {
        role: 'user',
        content: `🎤 Audio message sent`
      }]);
      
      // Create formData to send the audio
      const formData = new FormData();
      formData.append('audio', audioBlob);
      
      // Send to our API route that will forward to n8n
      const response = await fetch('/api/n8n-webhook', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const data = await response.json();
      
      // Extract the useful content from the response
      let content = "No response received";
      
      if (data.response) {
        if (typeof data.response === 'string') {
          // Handle string response
          content = data.response;
        } else if (Array.isArray(data.response) && data.response.length > 0) {
          // Handle array response with cleanText format: [{"cleanText":"..."}]
          if (data.response[0] && data.response[0].cleanText) {
            content = data.response[0].cleanText;
          } else {
            content = JSON.stringify(data.response);
          }
        } else if (data.response.text) {
          // Handle object with text property
          content = data.response.text;
        } else if (data.response.message) {
          // Handle object with message property
          content = data.response.message;
        } else {
          // If it's an object without expected properties, stringify it
          content = JSON.stringify(data.response);
        }
      }
      
      // Display the response from n8n
      setMessages(prev => [...prev, {
        role: 'bot',
        content: content
      }]);
      
    } catch (err: unknown) {
      let message = 'Unknown error';
      if (err instanceof Error) {
        message = err.message;
        console.error("Error sending audio to webhook:", err);
      } else {
        console.error("Error sending audio to webhook:", err);
      }
      // Show error in chat
      setMessages(prev => [...prev, {
        role: 'bot',
        content: `Error: ${message}. Please try again.`
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="app-container">
      <div className="header">
        <h1>Ayush&apos;s assistant</h1>
        {messages.length > 0 && (
          <button onClick={clearChatHistory} className="clear-button">
            Clear History
          </button>
        )}
      </div>
      
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <h2>Voice Assistant</h2>
            <p>Tap the microphone and speak your question</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={index} 
              className={`message ${msg.role === 'user' ? 'user-message' : 'bot-message'}`}
            >
              <div className="message-content">
                {msg.content}
              </div>
              <div className="message-timestamp">
                {new Date().toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="message bot-message loading">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="voice-controls">
        {isRecording && (
          <div className="recording-indicator">
            <div className="recording-pulse"></div>
            <span>Recording... {formatTime(recordingTime)}</span>
          </div>
        )}
        
        <button 
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className={`mic-button ${isRecording ? 'recording' : ''}`}
          disabled={loading}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
          <div className="mic-button-inner">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 16.5C14.76 16.5 17 14.26 17 11.5V6C17 3.24 14.76 1 12 1C9.24 1 7 3.24 7 6V11.5C7 14.26 9.24 16.5 12 16.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.5 11.5V12C3.5 16.69 7.31 20.5 12 20.5C16.69 20.5 20.5 16.69 20.5 12V11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 20.5V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              {isRecording && (
                <path d="M2 3L22 21" stroke="#FF5252" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              )}
            </svg>
          </div>
        </button>
      </div>
      
      <style jsx>{`
        .app-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100%;
          background: #121212;
          color: #ffffff;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          position: relative;
          overflow: hidden;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: rgba(18, 18, 18, 0.9);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        
        .header h1 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
          background: linear-gradient(90deg, #8b5cf6, #4f46e5);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .clear-button {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .clear-button:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        
        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 24px 16px 96px 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          scrollbar-width: thin;
          scrollbar-color: #333 #121212;
        }
        
        .messages-container::-webkit-scrollbar {
          width: 6px;
        }
        
        .messages-container::-webkit-scrollbar-track {
          background: #1e1e1e;
          border-radius: 3px;
        }
        
        .messages-container::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 3px;
        }
        
        .welcome-message {
          text-align: center;
          margin: auto 0;
          color: #9ca3af;
          animation: fadeIn 1s ease;
        }
        
        .welcome-message h2 {
          font-size: 2rem;
          font-weight: 600;
          margin-bottom: 16px;
          background: linear-gradient(90deg, #8b5cf6, #4f46e5);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .welcome-message p {
          font-size: 1.1rem;
          opacity: 0.8;
        }
        
        .message {
          max-width: 90%;
          padding: 14px 18px;
          border-radius: 16px;
          position: relative;
          transition: all 0.5s ease;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .user-message {
          align-self: flex-end;
          background: linear-gradient(135deg, #4f46e5, #8b5cf6);
          color: white;
          border-bottom-right-radius: 4px;
          animation: slideInRight 0.3s ease;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
        }
        
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        .bot-message {
          align-self: flex-start;
          background: #2a2a2a;
          color: #fff;
          border-bottom-left-radius: 4px;
          animation: slideInLeft 0.3s ease;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          border-left: 2px solid var(--primary-light);
        }
        
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        .message-content {
          word-break: break-word;
          white-space: pre-wrap;
          font-size: 16px;
          line-height: 1.6;
          letter-spacing: 0.01em;
        }
        
        .bot-message .message-content {
          color: rgba(255, 255, 255, 0.95);
          font-weight: 400;
        }
        
        .user-message .message-content {
          font-weight: 500;
        }
        
        .message-timestamp {
          font-size: 0.7rem;
          opacity: 0.6;
          text-align: right;
          margin-top: 8px;
        }
        
        .loading {
          padding: 16px;
          background: rgba(34, 34, 34, 0.5);
          backdrop-filter: blur(4px);
        }
        
        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .typing-indicator span {
          width: 8px;
          height: 8px;
          background: #8b5cf6;
          border-radius: 50%;
          animation: pulseTyping 1.5s infinite ease-in-out;
        }
        
        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }
        
        @keyframes pulseTyping {
          0% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 0.4; }
        }
        
        .voice-controls {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px;
          background: rgba(18, 18, 18, 0.8);
          backdrop-filter: blur(10px);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          z-index: 10;
        }
        
        .recording-indicator {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #ff5252;
          font-weight: 500;
          padding: 8px 16px;
          margin-bottom: 12px;
          border-radius: 24px;
          background: rgba(255, 82, 82, 0.1);
          animation: fadeIn 0.3s;
        }
        
        .recording-pulse {
          width: 12px;
          height: 12px;
          background: #ff5252;
          border-radius: 50%;
          animation: pulse-recording 1.5s infinite;
        }
        
        @keyframes pulse-recording {
          0% { transform: scale(0.8); opacity: 0.5; box-shadow: 0 0 0 0 rgba(255,82,82,0.7); }
          70% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 10px rgba(255,82,82,0); }
          100% { transform: scale(0.8); opacity: 0.5; box-shadow: 0 0 0 0 rgba(255,82,82,0); }
        }
        
        .mic-button {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: transparent;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        }
        
        .mic-button-inner {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: ${isRecording ? 'rgba(255, 82, 82, 0.2)' : 'rgba(79, 70, 229, 0.1)'};
          color: ${isRecording ? '#ff5252' : '#8b5cf6'};
          border: 2px solid ${isRecording ? '#ff5252' : '#4f46e5'};
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          box-shadow: 0 0 20px ${isRecording ? 'rgba(255, 82, 82, 0.4)' : 'rgba(79, 70, 229, 0.4)'};
        }
        
        .mic-button:hover .mic-button-inner {
          transform: scale(1.05);
          box-shadow: 0 0 30px ${isRecording ? 'rgba(255, 82, 82, 0.6)' : 'rgba(79, 70, 229, 0.6)'};
        }
        
        .mic-button:active .mic-button-inner {
          transform: scale(0.95);
        }
        
        .mic-button.recording .mic-button-inner {
          animation: pulse-mic 2s infinite;
        }
        
        @keyframes pulse-mic {
          0% { box-shadow: 0 0 0 0 rgba(255,82,82,0.4); }
          70% { box-shadow: 0 0 0 20px rgba(255,82,82,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,82,82,0); }
        }
        
        .mic-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Responsive styles */
        @media (max-width: 600px) {
          .app-container {
            font-size: 15px;
          }
          .header {
            padding: 10px;
          }
          .messages-container {
            padding: 12px 2px 90px 2px;
            gap: 10px;
          }
          .message {
            padding: 10px 10px;
            font-size: 15px;
          }
          .mic-button {
            width: 56px;
            height: 56px;
          }
          .mic-button-inner {
            width: 48px;
            height: 48px;
          }
        }
      `}</style>
    </div>
  );
}
