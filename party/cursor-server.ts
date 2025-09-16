import type * as Party from "partykit/server";

export interface CursorData {
  x: number;
  y: number;
  pointer: 'mouse' | 'touch';
  userId: string;
  userName: string;
  color: string;
}

export interface CursorUser {
  userId: string;
  userName: string;
  color: string;
  cursor: CursorData | null;
  lastSeen: number;
}

interface ConnectionState {
  userId?: string;
  userName?: string;
  color?: string;
}

export interface CursorMessage {
  type: 'cursor_update' | 'cursor_leave' | 'get_cursors';
  userId?: string;
  userName?: string;
  color?: string;
  x?: number;
  y?: number;
  pointer?: 'mouse' | 'touch';
}

export interface ServerMessage {
  type: 'cursor_update' | 'user_left' | 'cursors_sync';
  userId?: string;
  userName?: string;
  color?: string;
  x?: number;
  y?: number;
  pointer?: 'mouse' | 'touch';
  cursors?: CursorUser[];
}

export default class CursorServer implements Party.Server {
  constructor(public party: Party.Party) {}

  // Store active cursors
  private cursors = new Map<string, CursorUser>();
  
  // Cleanup interval
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  options: Party.ServerOptions = {
    hibernate: true,
  };

  onConnect(connection: Party.Connection, { request }: Party.ConnectionContext) {
    console.log(`User connected to cursor party: ${this.party.id}, connection: ${connection.id}`);
    
    // Send current cursors to new connection
    const currentCursors = Array.from(this.cursors.values());
    const syncMessage: ServerMessage = {
      type: 'cursors_sync',
      cursors: currentCursors
    };
    connection.send(JSON.stringify(syncMessage));

    // Start cleanup interval if this is the first connection
    if (this.party.getConnections().length === 1 && !this.cleanupInterval) {
      this.startCleanupInterval();
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data: CursorMessage = JSON.parse(message);
      
      switch (data.type) {
        case 'cursor_update':
          this.handleCursorUpdate(data, sender);
          break;
          
        case 'cursor_leave':
          this.handleCursorLeave(data, sender);
          break;
          
        case 'get_cursors':
          this.handleGetCursors(sender);
          break;
      }
    } catch (error) {
      console.error('Failed to parse cursor message:', error);
    }
  }

  onClose(connection: Party.Connection) {
    // Remove cursor for this connection
    const state = connection.state as ConnectionState;
    if (state?.userId) {
      this.cursors.delete(state.userId);
      
      // Broadcast user left
      const leaveMessage: ServerMessage = {
        type: 'user_left',
        userId: state.userId
      };
      this.party.broadcast(JSON.stringify(leaveMessage), [connection.id]);
    }

    // Stop cleanup interval if no connections left
    if (this.party.getConnections().length === 0 && this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  onError(connection: Party.Connection, error: Error) {
    console.error('Cursor server error:', error);
    this.onClose(connection);
  }

  private handleCursorUpdate(data: CursorMessage, sender: Party.Connection) {
    if (!data.userId || typeof data.x !== 'number' || typeof data.y !== 'number') {
      return;
    }

    // Update connection state
    const state = sender.state as ConnectionState;
    sender.setState({
      ...state,
      userId: data.userId,
      userName: data.userName,
      color: data.color
    });

    // Update cursor data
    const cursorData: CursorData = {
      x: data.x,
      y: data.y,
      pointer: data.pointer || 'mouse',
      userId: data.userId,
      userName: data.userName || 'Anonymous',
      color: data.color || '#3b82f6'
    };

    const user: CursorUser = {
      userId: data.userId,
      userName: data.userName || 'Anonymous',
      color: data.color || '#3b82f6',
      cursor: cursorData,
      lastSeen: Date.now()
    };

    this.cursors.set(data.userId, user);

    // Broadcast to all other connections
    const updateMessage: ServerMessage = {
      type: 'cursor_update',
      userId: data.userId,
      userName: data.userName,
      color: data.color,
      x: data.x,
      y: data.y,
      pointer: data.pointer
    };

    this.party.broadcast(JSON.stringify(updateMessage), [sender.id]);
  }

  private handleCursorLeave(data: CursorMessage, sender: Party.Connection) {
    if (!data.userId) return;

    this.cursors.delete(data.userId);
    
    const leaveMessage: ServerMessage = {
      type: 'user_left',
      userId: data.userId
    };
    
    this.party.broadcast(JSON.stringify(leaveMessage), [sender.id]);
  }

  private handleGetCursors(sender: Party.Connection) {
    const currentCursors = Array.from(this.cursors.values());
    const syncMessage: ServerMessage = {
      type: 'cursors_sync',
      cursors: currentCursors
    };
    sender.send(JSON.stringify(syncMessage));
  }

  private startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 60000; // 1 minute
      
      for (const [userId, user] of this.cursors.entries()) {
        if (now - user.lastSeen > staleThreshold) {
          this.cursors.delete(userId);
          
          // Broadcast user left
          const leaveMessage: ServerMessage = {
            type: 'user_left',
            userId: userId
          };
          this.party.broadcast(JSON.stringify(leaveMessage));
        }
      }
    }, 30000); // Run every 30 seconds
  }

  // HTTP endpoint for getting current cursors
  async onRequest(req: Party.Request) {
    if (req.method === 'GET') {
      const currentCursors = Array.from(this.cursors.values());
      return Response.json({ cursors: currentCursors });
    }
    
    return new Response('Method not allowed', { status: 405 });
  }
}