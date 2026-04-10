import { Controller, Get, Post, Body, Param, Req } from '@nestjs/common';
import { ApprovalService } from './approval.service';

@Controller('api/chat/approvals')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  /**
   * GET /api/chat/approvals/:sessionId
   * Get pending approvals for a session.
   */
  @Get(':sessionId')
  getPending(@Param('sessionId') sessionId: string) {
    const requests = this.approvalService.getSessionPendingRequests(sessionId);
    return { success: true, data: requests };
  }

  /**
   * POST /api/chat/approvals/:requestId/respond
   * Respond to an approval request.
   */
  @Post(':requestId/respond')
  respond(@Param('requestId') requestId: string, @Body() body: any, @Req() req: any) {
    const userId = req.user?.dbId || 'anonymous';
    const { status } = body; // 'approved' or 'denied'
    
    const success = this.approvalService.respondToRequest(requestId, status, userId);
    return { success, message: success ? `Request ${status}` : 'Request not found' };
  }
}
