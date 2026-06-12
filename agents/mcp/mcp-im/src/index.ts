import { BugDetail } from '@ocean/core';

/**
 * 统一 IM 输入消息结构
 */
export interface IMIncomingMessage {
  senderId: string;
  senderName: string;
  content: string;
  chatId: string;
  source: 'wework' | 'dingtalk' | 'internal';
  rawPayload?: any;
}

/**
 * 统一 IM 回复结果结构
 */
export interface IMReply {
  text: string;
  markdown?: string;
  card?: any;
}

/**
 * 抽象 IM 处理器接口
 */
export interface IMChannelHandler {
  parseWebhook(payload: any): IMIncomingMessage | null;
  sendReply(chatId: string, reply: IMReply): Promise<boolean>;
}

/**
 * 银联 U聊 (UpChat) 适配器
 * 适配银联开放平台 U聊 机器人协议
 */
export class UpChatHandler implements IMChannelHandler {
  /**
   * 解析银联 U聊 的 Webhook 回调报文
   * 典型报文结构参考自银联开放平台常用规范
   */
  parseWebhook(payload: any): IMIncomingMessage | null {
    // 银联 U聊 典型字段: sender_user_id (工号), content (消息内容), msg_type (消息类型)
    const senderId = payload?.sender_user_id || payload?.fromUser || payload?.user_id;
    const content = payload?.content?.text || payload?.body || payload?.text || '';

    if (!senderId) return null;

    return {
      senderId: senderId,
      senderName: payload?.sender_name || 'UP User',
      content: typeof content === 'string' ? content : JSON.stringify(content),
      chatId: payload?.chat_id || senderId,
      source: 'internal',
      rawPayload: payload
    };
  }

  /**
   * 验证银联报文签名 (POC 阶段暂不强制拦截，预留逻辑)
   */
  verifySignature(payload: any, signature: string): boolean {
    console.log(`[IM-UpChat] Verifying signature: ${signature}`);
    // 银联规范通常使用 AppId + Timestamp + Body 的 MD5/HMAC-SHA256 签名
    return true; 
  }

  async sendReply(chatId: string, reply: IMReply): Promise<boolean> {
    console.log(`[IM-UpChat] Posting reply to UnionPay Gateway (${chatId}): ${reply.text.slice(0, 50)}...`);
    // 真实场景：调用 https://api.unionpay.com/upchat/send_msg
    return true;
  }
}
