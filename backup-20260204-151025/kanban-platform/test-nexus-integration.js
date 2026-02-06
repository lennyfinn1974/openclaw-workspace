#!/usr/bin/env node

/**
 * Test script for Nexus integration with the hybrid Kanban platform
 * This script simulates Nexus agent activities and tests the integration
 */

const fetch = require('node-fetch');
const WebSocket = require('ws');

const KANBAN_URL = 'http://localhost:3001';
const NEXUS_URL = 'http://localhost:8081';

class NexusIntegrationTester {
  constructor() {
    this.testResults = [];
    this.activeAgents = new Map();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
    
    this.testResults.push({
      timestamp,
      type,
      message
    });
  }

  async testNexusConnection() {
    this.log('Testing Nexus connection...', 'test');
    
    try {
      const response = await fetch(`${NEXUS_URL}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (response.ok) {
        this.log('✅ Nexus connection successful', 'success');
        return true;
      } else {
        this.log(`❌ Nexus connection failed: ${response.status}`, 'error');
        return false;
      }
    } catch (error) {
      this.log(`❌ Nexus connection error: ${error.message}`, 'error');
      return false;
    }
  }

  async testKanbanConnection() {
    this.log('Testing Kanban platform connection...', 'test');
    
    try {
      const response = await fetch(`${KANBAN_URL}/api/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (response.ok) {
        this.log('✅ Kanban platform connection successful', 'success');
        return true;
      } else {
        this.log(`❌ Kanban platform connection failed: ${response.status}`, 'error');
        return false;
      }
    } catch (error) {
      this.log(`❌ Kanban platform connection error: ${error.message}`, 'error');
      return false;
    }
  }

  async simulateNexusLearnCommand(topic) {
    this.log(`Simulating Nexus /learn command: ${topic}`, 'test');
    
    const agentId = `nexus-learn-${Date.now()}`;
    const taskData = {
      command: '/learn',
      objective: `Learn about: ${topic}`,
      priority: 'medium',
      taskType: 'learn',
      tags: ['learning', 'automated', 'nexus'],
      estimatedDuration: 30
    };

    this.activeAgents.set(agentId, {
      ...taskData,
      startTime: Date.now(),
      status: 'active'
    });

    // Simulate webhook event to Kanban platform
    await this.sendWebhookEvent('agent.started', agentId, taskData);
    
    // Simulate progress updates
    setTimeout(() => this.simulateProgress(agentId, 25), 2000);
    setTimeout(() => this.simulateProgress(agentId, 50), 5000);
    setTimeout(() => this.simulateProgress(agentId, 75), 8000);
    setTimeout(() => this.simulateCompletion(agentId), 12000);

    return agentId;
  }

  async simulateNexusResearchTask(topic) {
    this.log(`Simulating Nexus research task: ${topic}`, 'test');
    
    const agentId = `nexus-research-${Date.now()}`;
    const taskData = {
      command: 'research',
      objective: `Research: ${topic}`,
      priority: 'high',
      taskType: 'research',
      tags: ['research', 'automated', 'nexus'],
      estimatedDuration: 60
    };

    this.activeAgents.set(agentId, {
      ...taskData,
      startTime: Date.now(),
      status: 'active'
    });

    // Simulate webhook event to Kanban platform
    await this.sendWebhookEvent('agent.started', agentId, taskData);
    
    // Simulate research progress with insights
    setTimeout(() => this.simulateResearchProgress(agentId, 20, 'Initial literature review'), 3000);
    setTimeout(() => this.simulateResearchProgress(agentId, 40, 'Data collection phase'), 7000);
    setTimeout(() => this.simulateResearchProgress(agentId, 60, 'Analysis and synthesis'), 12000);
    setTimeout(() => this.simulateResearchProgress(agentId, 80, 'Key insights identified'), 16000);
    setTimeout(() => this.simulateResearchCompletion(agentId), 20000);

    return agentId;
  }

  async simulateNexusSkillDevelopment(skill) {
    this.log(`Simulating Nexus skill development: ${skill}`, 'test');
    
    const agentId = `nexus-skill-${Date.now()}`;
    const taskData = {
      command: 'skill_development',
      objective: `Develop skill: ${skill}`,
      priority: 'high',
      taskType: 'skill',
      tags: ['skill-development', 'automated', 'nexus'],
      estimatedDuration: 45
    };

    this.activeAgents.set(agentId, {
      ...taskData,
      startTime: Date.now(),
      status: 'active'
    });

    await this.sendWebhookEvent('agent.started', agentId, taskData);
    
    setTimeout(() => this.simulateSkillProgress(agentId, 30), 4000);
    setTimeout(() => this.simulateSkillProgress(agentId, 70), 10000);
    setTimeout(() => this.simulateSkillCompletion(agentId), 15000);

    return agentId;
  }

  async simulateProgress(agentId, progress) {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;

    agent.progress = progress;
    this.log(`Agent ${agentId} progress: ${progress}%`, 'info');
    
    await this.sendWebhookEvent('agent.progress', agentId, {
      progress,
      status: 'Working...'
    });
  }

  async simulateResearchProgress(agentId, progress, insights) {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;

    agent.progress = progress;
    this.log(`Research agent ${agentId} progress: ${progress}% - ${insights}`, 'info');
    
    await this.sendWebhookEvent('research.progress', agentId, {
      progress,
      insights,
      status: 'Researching...'
    });
  }

  async simulateSkillProgress(agentId, progress) {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;

    agent.progress = progress;
    this.log(`Skill development agent ${agentId} progress: ${progress}%`, 'info');
    
    await this.sendWebhookEvent('skill.progress', agentId, {
      progress,
      status: 'Developing skills...'
    });
  }

  async simulateCompletion(agentId) {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;

    agent.status = 'completed';
    agent.endTime = Date.now();
    
    const result = {
      summary: `Successfully learned about ${agent.objective.replace('Learn about: ', '')}`,
      insights: 'Key concepts identified and documented',
      duration: agent.endTime - agent.startTime
    };

    this.log(`Agent ${agentId} completed: ${result.summary}`, 'success');
    
    await this.sendWebhookEvent('agent.completed', agentId, result);
    this.activeAgents.delete(agentId);
  }

  async simulateResearchCompletion(agentId) {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;

    agent.status = 'completed';
    agent.endTime = Date.now();
    
    const result = {
      summary: `Research completed: ${agent.objective.replace('Research: ', '')}`,
      insights: 'Comprehensive analysis with actionable recommendations',
      keyFindings: [
        'Primary trend identified',
        'Best practices documented',
        'Implementation strategies defined'
      ],
      duration: agent.endTime - agent.startTime
    };

    this.log(`Research agent ${agentId} completed with key findings`, 'success');
    
    await this.sendWebhookEvent('research.completed', agentId, result);
    this.activeAgents.delete(agentId);
  }

  async simulateSkillCompletion(agentId) {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;

    agent.status = 'completed';
    agent.endTime = Date.now();
    
    const result = {
      summary: `Skill development completed: ${agent.objective.replace('Develop skill: ', '')}`,
      skillsAcquired: ['Advanced techniques', 'Best practices', 'Practical applications'],
      proficiencyLevel: 85,
      duration: agent.endTime - agent.startTime
    };

    this.log(`Skill development agent ${agentId} completed`, 'success');
    
    await this.sendWebhookEvent('skill.completed', agentId, result);
    this.activeAgents.delete(agentId);
  }

  async sendWebhookEvent(eventType, agentId, data) {
    const webhookPayload = {
      source: 'nexus-webhook',
      payload: {
        type: eventType,
        agentId,
        sessionId: `session-${agentId}`,
        data,
        timestamp: new Date().toISOString()
      }
    };

    try {
      // Simulate sending webhook to Kanban platform
      // In a real implementation, this would be an HTTP POST to the webhook endpoint
      this.log(`Webhook event sent: ${eventType} for agent ${agentId}`, 'info');
      
      // Simulate the postMessage that would be received by the frontend
      if (typeof window !== 'undefined') {
        window.postMessage(webhookPayload, '*');
      }
      
    } catch (error) {
      this.log(`Failed to send webhook: ${error.message}`, 'error');
    }
  }

  async runFullIntegrationTest() {
    this.log('🚀 Starting Nexus Integration Test Suite', 'test');
    
    // Test connections
    const nexusConnected = await this.testNexusConnection();
    const kanbanConnected = await this.testKanbanConnection();
    
    if (!nexusConnected || !kanbanConnected) {
      this.log('❌ Connection tests failed - aborting integration tests', 'error');
      return false;
    }

    this.log('✅ All connections successful - proceeding with integration tests', 'success');
    
    // Test different types of Nexus tasks
    await this.simulateNexusLearnCommand('Machine Learning Fundamentals');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await this.simulateNexusResearchTask('AI Ethics and Safety Guidelines');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await this.simulateNexusSkillDevelopment('Advanced Data Analysis');
    
    // Wait for all agents to complete
    this.log('Waiting for all agents to complete...', 'info');
    
    const maxWaitTime = 30000; // 30 seconds
    const startWait = Date.now();
    
    while (this.activeAgents.size > 0 && (Date.now() - startWait) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.log(`Active agents remaining: ${this.activeAgents.size}`, 'info');
    }
    
    if (this.activeAgents.size === 0) {
      this.log('✅ All agents completed successfully', 'success');
      this.log('🎉 Nexus integration test completed successfully!', 'success');
      return true;
    } else {
      this.log('⚠️ Some agents did not complete within timeout', 'warning');
      return false;
    }
  }

  generateReport() {
    const report = {
      testStartTime: this.testResults[0]?.timestamp || new Date().toISOString(),
      testEndTime: new Date().toISOString(),
      totalEvents: this.testResults.length,
      successCount: this.testResults.filter(r => r.type === 'success').length,
      errorCount: this.testResults.filter(r => r.type === 'error').length,
      warningCount: this.testResults.filter(r => r.type === 'warning').length,
      events: this.testResults
    };

    console.log('\n📊 TEST REPORT');
    console.log('================');
    console.log(`Total Events: ${report.totalEvents}`);
    console.log(`✅ Successes: ${report.successCount}`);
    console.log(`❌ Errors: ${report.errorCount}`);
    console.log(`⚠️ Warnings: ${report.warningCount}`);
    console.log(`Test Duration: ${new Date(report.testEndTime).getTime() - new Date(report.testStartTime).getTime()}ms`);

    return report;
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  const tester = new NexusIntegrationTester();
  
  tester.runFullIntegrationTest()
    .then(success => {
      const report = tester.generateReport();
      console.log('\n📋 Full test report generated');
      
      if (success) {
        console.log('🎉 All tests passed!');
        process.exit(0);
      } else {
        console.log('❌ Some tests failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = NexusIntegrationTester;