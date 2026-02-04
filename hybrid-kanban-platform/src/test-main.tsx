
import React from "react"
import ReactDOM from "react-dom/client"

function TestApp() {
  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>🎯 Test Page</h1>
      <p>If you can see this, React is working!</p>
      <p>Current time: {new Date().toLocaleTimeString()}</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById("root")!).render(<TestApp />)

