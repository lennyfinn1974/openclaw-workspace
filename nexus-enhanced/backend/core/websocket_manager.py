"""
WebSocket Manager
================

Manages WebSocket connections for real-time chat functionality.
"""

import json
import logging
from typing import Dict, List, Set
from uuid import uuid4

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger("nexus.websocket")


class ConnectionManager:
    """Manages WebSocket connections for a single conversation."""
    
    def __init__(self, conversation_id: str):
        self.conversation_id = conversation_id
        self.connections: Dict[str, WebSocket] = {}
        
    async def connect(self, websocket: WebSocket, user_id: str = None) -> str:
        """Add a new connection."""
        await websocket.accept()
        
        connection_id = str(uuid4())
        self.connections[connection_id] = websocket
        
        logger.info(f"New connection {connection_id} for conversation {self.conversation_id}")
        return connection_id
    
    async def disconnect(self, connection_id: str):
        """Remove a connection."""
        if connection_id in self.connections:
            try:
                await self.connections[connection_id].close()
            except:
                pass
            del self.connections[connection_id]
            
        logger.info(f"Disconnected {connection_id} from conversation {self.conversation_id}")
    
    async def send_to_connection(self, connection_id: str, message: dict):
        """Send message to specific connection."""
        if connection_id in self.connections:
            try:
                await self.connections[connection_id].send_text(json.dumps(message))
            except:
                # Connection is dead, remove it
                await self.disconnect(connection_id)
    
    async def broadcast(self, message: dict, exclude_connection: str = None):
        """Broadcast message to all connections in this conversation."""
        disconnected = []
        
        for connection_id, websocket in self.connections.items():
            if connection_id == exclude_connection:
                continue
                
            try:
                await websocket.send_text(json.dumps(message))
            except:
                disconnected.append(connection_id)
        
        # Clean up dead connections
        for connection_id in disconnected:
            await self.disconnect(connection_id)
    
    def get_connection_count(self) -> int:
        """Get number of active connections."""
        return len(self.connections)


class WebSocketManager:
    """Global WebSocket manager for all conversations."""
    
    def __init__(self):
        self.conversations: Dict[str, ConnectionManager] = {}
        self.connection_to_conversation: Dict[str, str] = {}
        
    async def connect(self, websocket: WebSocket, conversation_id: str = None, 
                     user_id: str = None) -> str:
        """Connect to a conversation."""
        if not conversation_id:
            conversation_id = "default"
        
        # Create conversation manager if it doesn't exist
        if conversation_id not in self.conversations:
            self.conversations[conversation_id] = ConnectionManager(conversation_id)
        
        # Add connection to conversation
        connection_id = await self.conversations[conversation_id].connect(websocket, user_id)
        self.connection_to_conversation[connection_id] = conversation_id
        
        # Send welcome message
        await self.conversations[conversation_id].send_to_connection(connection_id, {
            "type": "connection_established",
            "connection_id": connection_id,
            "conversation_id": conversation_id,
            "message": "Connected to Nexus Enhanced"
        })
        
        return connection_id
    
    async def disconnect(self, websocket: WebSocket):
        """Disconnect a WebSocket."""
        # Find connection ID by websocket
        connection_id = None
        for conv_id, manager in self.conversations.items():
            for conn_id, ws in manager.connections.items():
                if ws == websocket:
                    connection_id = conn_id
                    break
            if connection_id:
                break
        
        if connection_id:
            await self._disconnect_by_id(connection_id)
    
    async def _disconnect_by_id(self, connection_id: str):
        """Disconnect by connection ID."""
        conversation_id = self.connection_to_conversation.get(connection_id)
        if conversation_id and conversation_id in self.conversations:
            await self.conversations[conversation_id].disconnect(connection_id)
            
            # Clean up empty conversations
            if self.conversations[conversation_id].get_connection_count() == 0:
                del self.conversations[conversation_id]
        
        if connection_id in self.connection_to_conversation:
            del self.connection_to_conversation[connection_id]
    
    async def send_to_connection(self, connection_id: str, message: dict):
        """Send message to specific connection."""
        conversation_id = self.connection_to_conversation.get(connection_id)
        if conversation_id and conversation_id in self.conversations:
            await self.conversations[conversation_id].send_to_connection(connection_id, message)
    
    async def broadcast_to_conversation(self, conversation_id: str, message: dict,
                                     exclude_connection: str = None):
        """Broadcast to all connections in a conversation."""
        if conversation_id in self.conversations:
            await self.conversations[conversation_id].broadcast(message, exclude_connection)
    
    async def disconnect_all(self):
        """Disconnect all connections."""
        for conversation_id in list(self.conversations.keys()):
            manager = self.conversations[conversation_id]
            for connection_id in list(manager.connections.keys()):
                await manager.disconnect(connection_id)
        
        self.conversations.clear()
        self.connection_to_conversation.clear()
    
    def get_stats(self) -> dict:
        """Get WebSocket statistics."""
        total_connections = sum(
            manager.get_connection_count() 
            for manager in self.conversations.values()
        )
        
        return {
            "total_connections": total_connections,
            "active_conversations": len(self.conversations),
            "conversations": {
                conv_id: manager.get_connection_count()
                for conv_id, manager in self.conversations.items()
            }
        }