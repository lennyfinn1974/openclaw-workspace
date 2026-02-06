/**
 * Webhook Integration Component
 * 
 * Displays real-time webhook integration status and allows testing.
 */

import React, { useState } from 'react';
import { useWebhookIntegration } from '@/hooks/useWebhookIntegration';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Wifi, 
  WifiOff, 
  Play, 
  RefreshCw,
  TestTube
} from 'lucide-react';

interface WebhookIntegrationProps {
  className?: string;
}

export function WebhookIntegration({ className }: WebhookIntegrationProps) {
  const {
    isConnected,
    isLoading,
    error,
    lastUpdate,
    updateCount,
    connect,
    disconnect,
    loadCombinedData,
    sendTestWebhook,
    checkHealth,
    isReady,
    socketId
  } = useWebhookIntegration();

  const [testWebhookForm, setTestWebhookForm] = useState({
    objective: 'Test webhook integration',
    priority: 'medium',
    label: 'test-webhook-task'
  });

  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const handleTestWebhook = async () => {
    setIsTestingWebhook(true);
    try {
      const result = await sendTestWebhook(testWebhookForm);
      console.log('🧪 Test webhook result:', result);
      // You could add a toast notification here
    } catch (error) {
      console.error('❌ Test webhook failed:', error);
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleHealthCheck = async () => {
    setIsCheckingHealth(true);
    try {
      const health = await checkHealth();
      setHealthStatus(health);
    } catch (error) {
      console.error('❌ Health check failed:', error);
      setHealthStatus(null);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const ConnectionStatus = () => (
    <div className="flex items-center gap-2">
      {isConnected ? (
        <>
          <Wifi className="h-4 w-4 text-green-500" />
          <Badge variant="outline" className="text-green-700 border-green-300">
            Connected
          </Badge>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-red-500" />
          <Badge variant="outline" className="text-red-700 border-red-300">
            Disconnected
          </Badge>
        </>
      )}
      
      {socketId && (
        <span className="text-xs text-muted-foreground">
          Socket: {socketId.slice(0, 8)}...
        </span>
      )}
    </div>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            OpenClaw Webhook Integration
          </CardTitle>
          <CardDescription>
            Real-time webhook integration for live ticket creation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <ConnectionStatus />
            <div className="flex gap-2">
              {isConnected ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={disconnect}
                  disabled={isLoading}
                >
                  Disconnect
                </Button>
              ) : (
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={connect}
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Connect
                </Button>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadCombinedData}
                disabled={isLoading || !isConnected}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Last Update:</span>
              <div className="font-mono">
                {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Updates Received:</span>
              <div className="font-mono">{updateCount}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Server Health */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Server Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleHealthCheck}
              disabled={isCheckingHealth}
            >
              {isCheckingHealth && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Check Health
            </Button>
            
            {healthStatus && (
              <Badge variant="outline" className="text-green-700 border-green-300">
                <CheckCircle className="h-3 w-3 mr-1" />
                Healthy
              </Badge>
            )}
          </div>

          {healthStatus && (
            <div className="space-y-2 text-xs font-mono bg-gray-50 p-2 rounded">
              <div>Status: {healthStatus.status}</div>
              <div>Server: {healthStatus.server}</div>
              <div>Port: {healthStatus.port}</div>
              <div>Timestamp: {new Date(healthStatus.timestamp).toLocaleString()}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Webhook */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Test Webhook
          </CardTitle>
          <CardDescription>
            Send a test webhook to create a sample task
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label htmlFor="test-objective" className="text-sm">Objective</Label>
              <Input
                id="test-objective"
                value={testWebhookForm.objective}
                onChange={(e) => setTestWebhookForm(prev => ({ ...prev, objective: e.target.value }))}
                placeholder="Enter test task objective..."
              />
            </div>
            
            <div>
              <Label htmlFor="test-priority" className="text-sm">Priority</Label>
              <Select 
                value={testWebhookForm.priority} 
                onValueChange={(value) => setTestWebhookForm(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger id="test-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="test-label" className="text-sm">Label</Label>
              <Input
                id="test-label"
                value={testWebhookForm.label}
                onChange={(e) => setTestWebhookForm(prev => ({ ...prev, label: e.target.value }))}
                placeholder="Enter test task label..."
              />
            </div>
          </div>

          <Separator />

          <Button 
            onClick={handleTestWebhook}
            disabled={!isReady || isTestingWebhook}
            className="w-full"
          >
            {isTestingWebhook && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Play className="h-4 w-4 mr-2" />
            Send Test Webhook
          </Button>

          <p className="text-xs text-muted-foreground">
            This will simulate an OpenClaw webhook event and create a test task in the live board.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}