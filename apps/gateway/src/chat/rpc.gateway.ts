import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { RPCResponse } from '@uclaw/core';
import { ApprovalService } from '../skill/approval.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class RpcGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly approvalService: ApprovalService) {}

  @WebSocketServer()
  server!: Server;

  // 记录在线的 CLI 客户端映射 (工号 -> SocketId)
  private clients = new Map<string, string>();

  // 记录等待中的请求 (requestId -> { resolve, reject, timeout })
  private pendingRequests = new Map<string, { 
    resolve: (val: any) => void; 
    reject: (err: any) => void;
    timeout: NodeJS.Timeout;
  }>();

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      this.clients.set(userId, client.id);
      console.log(`[RpcGateway] CLI connected: ${userId} (${client.id})`);
    } else {
      console.warn(`[RpcGateway] Connection attempt without userId. Disconnecting.`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    for (const [userId, socketId] of this.clients.entries()) {
      if (socketId === client.id) {
        this.clients.delete(userId);
        console.log(`[RpcGateway] CLI disconnected: ${userId}`);
        break;
      }
    }
  }

  @SubscribeMessage('rpc_response')
  handleRpcResponse(client: Socket, payload: RPCResponse) {
    const request = this.pendingRequests.get(payload.id);
    if (request) {
      clearTimeout(request.timeout);
      if (payload.error) {
        request.reject(new Error(payload.error));
      } else {
        request.resolve(payload.result);
      }
      this.pendingRequests.delete(payload.id);
      console.log(`[RpcGateway] Resolved RPC Response (ID: ${payload.id})`);
    }
  }

  @SubscribeMessage('request_approval')
  async handleRequestApproval(client: Socket, payload: { sessionId: string; toolName: string; args: any }) {
    console.log(`[RpcGateway] Received approval request from CLI: ${payload.toolName} (Session: ${payload.sessionId})`);
    
    try {
      const requestId = await this.approvalService.createRequest({
        sessionId: payload.sessionId,
        toolName: payload.toolName,
        args: payload.args,
      });

      // Poll for status or wait
      const approved = await this.approvalService.waitForApproval(requestId, 5 * 60 * 1000); // 5 min timeout
      
      client.emit('approval_resolved', {
        requestId,
        approved,
      });
      console.log(`[RpcGateway] Approval ${requestId} resolved: ${approved ? 'APPROVED' : 'DENIED'}`);
    } catch (err: any) {
      console.error(`[RpcGateway] Error handling approval request:`, err.message);
      client.emit('approval_resolved', {
        approved: false,
        error: err.message
      });
    }
  }

  // 下发指令到特定用户的 CLI 并等待返回结果
  async sendToCli(userId: string, method: string, params: any): Promise<any> {
    const socketId = this.clients.get(userId);
    if (!socketId) {
      throw new Error(`CLI for user ${userId} not online.`);
    }

    const id = Math.random().toString(36).substring(7);
    
    return new Promise((resolve, reject) => {
      // 设置 15 秒超时
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`RPC Request Timeout: ${method} (ID: ${id})`));
      }, 15000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.server.to(socketId).emit('rpc_request', { id, method, params });
      console.log(`[RpcGateway] Command sent to ${userId}: ${method} (ID: ${id}), waiting for response...`);
    });
  }

  getOnlineUsers(): string[] {
    return Array.from(this.clients.keys());
  }

  isUserOnline(userId: string): boolean {
    return this.clients.has(userId);
  }
}
