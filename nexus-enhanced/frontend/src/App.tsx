import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Send, Cpu, MessageSquare, Settings } from 'lucide-react';
import './App.css';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  skill?: string;
}

interface Skill {
  name: string;
  description: string;
  category: string;
  enabled: boolean;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize WebSocket connection
    const socket = io('http://localhost:8082');
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to Nexus Enhanced');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from Nexus Enhanced');
    });

    socket.on('message', (data: any) => {
      const newMessage: Message = {
        id: Date.now().toString(),
        content: data.content,
        sender: 'assistant',
        timestamp: new Date(),
        skill: data.skill
      };
      setMessages(prev => [...prev, newMessage]);
    });

    socket.on('skills_list', (skillsData: Skill[]) => {
      setSkills(skillsData);
    });

    // Request available skills on connect
    socket.on('connect', () => {
      socket.emit('get_skills');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!inputMessage.trim() || !socketRef.current) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    socketRef.current.emit('user_message', {
      content: inputMessage,
      skills: selectedSkills
    });

    setInputMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleSkill = (skillName: string) => {
    setSelectedSkills(prev => 
      prev.includes(skillName)
        ? prev.filter(s => s !== skillName)
        : [...prev, skillName]
    );
  };

  return (
    <div className="nexus-chat">
      <div style={{ display: 'flex', height: '100vh' }}>
        {/* Sidebar for Skills */}
        <div className="sidebar">
          <div className="skill-sidebar">
            <h2>Nexus Enhanced</h2>
            <div className="connection-status">
              <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ color: '#3b82f6', marginBottom: '10px' }}>
                Available Skills ({skills.length})
              </h3>
              <div className="skills-list">
                {skills.map((skill) => (
                  <div
                    key={skill.name}
                    className={`skill-item ${selectedSkills.includes(skill.name) ? 'selected' : ''}`}
                    onClick={() => toggleSkill(skill.name)}
                  >
                    <div className="skill-name">{skill.name}</div>
                    <div className="skill-description">{skill.description}</div>
                  </div>
                ))}
              </div>
            </div>

            {selectedSkills.length > 0 && (
              <div className="selected-skills">
                <h3>Selected Skills</h3>
                <div>
                  {selectedSkills.map(skill => (
                    <span key={skill} className="skill-tag">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="main-content">
          {/* Header */}
          <header className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Cpu size={24} color="#3b82f6" />
              <h1 style={{ fontSize: '18px', fontWeight: 'bold' }}>Nexus Enhanced</h1>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                <Settings size={18} />
              </button>
            </div>
          </header>

          {/* Messages */}
          <div className="messages-area">
            {messages.length === 0 ? (
              <div className="welcome-screen">
                <MessageSquare size={48} color="#888" />
                <h1>Welcome to Nexus Enhanced</h1>
                <p>
                  Your comprehensive AI assistant with 20+ OpenClaw skills integrated.
                  <br />
                  Select skills from the sidebar and start chatting!
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`message ${message.sender}`}
                >
                  <div>{message.content}</div>
                  {message.skill && (
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>
                      via {message.skill}
                    </div>
                  )}
                  <div style={{ fontSize: '10px', color: '#666', marginTop: '5px' }}>
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="input-area">
            <div className="input-wrapper">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask Nexus Enhanced anything..."
                rows={1}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || !isConnected}
                className="send-button"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;