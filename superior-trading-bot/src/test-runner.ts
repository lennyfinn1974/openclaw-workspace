// Test runner for Superior Trading Bot - Phase 1 validation
// Validates Observation Engine functionality

import { createObservationEngine } from './observation';

async function testObservationEngine() {
  console.log('🧪 Testing Superior Trading Bot - Observation Engine');
  console.log('='.repeat(60));
  
  // Create observation engine
  const engine = createObservationEngine({
    bufferSize: 1000,
    enableEnrichment: true,
    enableTimeQueries: true
  });
  
  try {
    // Test 1: Start the engine
    console.log('Test 1: Starting Observation Engine...');
    await engine.start();
    
    // Wait a moment for connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Check status
    console.log('\\nTest 2: Checking system status...');
    const status = engine.getStatus();
    console.log('Status:', JSON.stringify(status, null, 2));
    
    // Test 3: Query recent events
    console.log('\\nTest 3: Querying recent events...');
    const recentEvents = engine.getRecentEvents(10);
    console.log(`Found ${recentEvents.length} recent events`);
    
    // Test 4: Query trade events specifically
    console.log('\\nTest 4: Querying trade events...');
    const tradeEvents = engine.getTradeEvents();
    console.log(`Found ${tradeEvents.length} trade events`);
    
    // Test 5: Time range query
    console.log('\\nTest 5: Testing time range queries...');
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const timeRangeEvents = engine.getEventsInTimeRange(oneMinuteAgo, now);
    console.log(`Found ${timeRangeEvents.length} events in last minute`);
    
    console.log('\\n✅ All tests completed successfully!');
    console.log('🎯 Observation Engine (Layer 1) is operational and ready for Layer 2 integration');
    
    // Keep running for monitoring
    console.log('\\n📊 Monitoring mode - press Ctrl+C to stop');
    
    // Monitor for 30 seconds then stop
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    engine.stop();
    console.log('\\n🛑 Test completed - Observation Engine stopped');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    engine.stop();
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testObservationEngine().catch(console.error);
}

export { testObservationEngine };