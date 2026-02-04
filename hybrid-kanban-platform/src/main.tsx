import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './utils/webhookSimulator' // Enable testing functions

// Initialize the app
console.log('🚀 Hybrid Kanban Platform starting...')
console.log('💡 Combining Lovable design system with OpenClaw integration')
console.log('🧪 Testing functions available: window.openclawTest')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Log performance info
if (import.meta.hot) {
  console.log('🔥 Hot reload enabled for development')
}

// Service worker registration for future PWA features
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  console.log('📱 Service Worker support detected')
}