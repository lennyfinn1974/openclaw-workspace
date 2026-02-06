// Simple test to verify persistent connection functionality
// Run this in the browser console to test the localStorage integration

console.log('Testing OpenClaw Persistent Connection...')

// Test localStorage helper functions
const STORAGE_KEY = 'openclaw_connection_state'

const storage = {
  getConnectionState: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored === 'true'
    } catch (error) {
      console.warn('Failed to read OpenClaw connection state from localStorage:', error)
      return false
    }
  },
  
  setConnectionState: (connected) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(connected))
      console.log(`✅ Saved connection state: ${connected}`)
    } catch (error) {
      console.warn('Failed to save OpenClaw connection state to localStorage:', error)
    }
  },
  
  clearConnectionState: () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      console.log('✅ Cleared connection state')
    } catch (error) {
      console.warn('Failed to clear OpenClaw connection state from localStorage:', error)
    }
  }
}

// Test the storage functions
console.log('\n1. Testing storage functions...')
console.log('Initial state:', storage.getConnectionState())

storage.setConnectionState(true)
console.log('After setting true:', storage.getConnectionState())

storage.setConnectionState(false)
console.log('After setting false:', storage.getConnectionState())

storage.clearConnectionState()
console.log('After clearing:', storage.getConnectionState())

console.log('\n✅ Persistent connection storage test completed!')

console.log('\n2. Usage Instructions:')
console.log('- Connect to OpenClaw using the Connect button')
console.log('- Refresh the page - connection should auto-restore')  
console.log('- Check browser localStorage for "openclaw_connection_state" key')
console.log('- Disconnect manually to clear the persistent state')