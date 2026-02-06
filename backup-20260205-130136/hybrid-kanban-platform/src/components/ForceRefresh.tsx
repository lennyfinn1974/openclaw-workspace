import React from 'react';
import { useWebhookIntegration } from '@/hooks/useWebhookIntegration';
import { useKanbanStore } from '@/stores/kanban';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Trash2, Download } from 'lucide-react';

export function ForceRefresh() {
  const { loadCombinedData, isLoading } = useWebhookIntegration({ autoConnect: false });
  const { selectedBoard, boards, tasks, setSelectedBoard } = useKanbanStore();

  const handleForceRefresh = async () => {
    console.log('🔄 Force refreshing live data...');
    try {
      const data = await loadCombinedData();
      console.log('✅ Force refresh completed:', { 
        boards: data.boards.length, 
        tasks: data.tasks.length,
        selectedBoard: data.boards[0]?.id 
      });
      
      // Force select the live board
      if (data.boards.length > 0) {
        setSelectedBoard(data.boards[0].id);
        console.log('🎯 Forced board selection:', data.boards[0].name);
      }
    } catch (error) {
      console.error('❌ Force refresh failed:', error);
    }
  };

  const handleClearStorage = () => {
    localStorage.removeItem('kanban-storage');
    window.location.reload();
  };

  const currentBoard = boards.find(b => b.id === selectedBoard);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw size={20} />
          Debug Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm space-y-2">
          <p><strong>Current Board:</strong> {currentBoard?.name || 'None'}</p>
          <p><strong>Total Boards:</strong> {boards.length}</p>
          <p><strong>Total Tasks:</strong> {tasks.length}</p>
          <p><strong>Selected ID:</strong> {selectedBoard}</p>
        </div>
        
        <div className="space-y-2">
          <Button 
            onClick={handleForceRefresh} 
            disabled={isLoading}
            className="w-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {isLoading ? 'Refreshing...' : 'Force Refresh Live Data'}
          </Button>
          
          <Button 
            onClick={handleClearStorage} 
            variant="destructive"
            className="w-full"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear Storage & Reload
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}