import { Injectable } from '@nestjs/common';

export interface ApprovalRequest {
  id: string;
  sessionId: string;
  userId: string;
  toolName: string;
  args: any;
  status: 'pending' | 'approved' | 'denied';
  response?: string;
}

/**
 * ApprovalService
 * 
 * Manages pending approval requests for tools that require user confirmation.
 * For Phase 4, this is an in-memory store. (Production would use Redis/DB).
 */
@Injectable()
export class ApprovalService {
  private readonly requests = new Map<string, ApprovalRequest>();

  /**
   * Create a new pending approval request.
   * @returns The ID of the created request (for polling).
   */
  createRequest(data: Omit<ApprovalRequest, 'id' | 'status'>): string {
    const id = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.requests.set(id, { ...data, id, status: 'pending' });
    return id;
  }

  /**
   * Get request by ID.
   */
  getRequest(id: string): ApprovalRequest | undefined {
    return this.requests.get(id);
  }

  /**
   * Get all pending requests for a session.
   */
  getSessionPendingRequests(sessionId: string): ApprovalRequest[] {
    return Array.from(this.requests.values()).filter(
      (req) => req.sessionId === sessionId && req.status === 'pending',
    );
  }

  /**
   * Respond to an approval request.
   */
  respondToRequest(id: string, status: 'approved' | 'denied', response?: string): boolean {
    const req = this.requests.get(id);
    if (!req) return false;
    if (req.status !== 'pending') return false;

    req.status = status;
    req.response = response;
    this.requests.set(id, req);
    return true;
  }

  /**
   * Clear resolved requests (cleanup).
   */
  clearSessionRequests(sessionId: string) {
    for (const [id, req] of this.requests.entries()) {
      if (req.sessionId === sessionId && req.status !== 'pending') {
        this.requests.delete(id);
      }
    }
  }
}
