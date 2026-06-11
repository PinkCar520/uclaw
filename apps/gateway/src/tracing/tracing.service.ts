import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { trace, context, Span, SpanStatusCode, Tracer } from '@opentelemetry/api';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class TracingService implements OnModuleInit {
  private tracer: Tracer;

  constructor(
    @Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient,
  ) {
    this.tracer = trace.getTracer('ocean-gateway');
  }

  onModuleInit() {
    console.log('[TracingService] Initialized for Ocean observability');
  }

  /**
   * Start a chat trace and return the traceId
   */
  async startChatTrace(options: {
    name: string;
    userId?: string;
    sessionId?: string;
    metadata?: any;
  }) {
    const span = this.tracer.startSpan(options.name);
    const traceId = span.spanContext().traceId;

    // Create a background DB record for this trace
    this.prisma.trace.create({
      data: {
        traceId,
        name: options.name,
        userId: options.userId,
        sessionId: options.sessionId,
        metadata: options.metadata || {},
      }
    }).catch(err => console.error('[Tracing] Failed to persist trace', err));

    span.end();
    return traceId;
  }

  /**
   * Wrap an LLM call or tool call in a span
   */
  async traceCall<T>(
    name: string,
    attributes: Record<string, any>,
    fn: (span: Span) => Promise<T>
  ): Promise<T> {
    return this.tracer.startActiveSpan(name, async (span) => {
      try {
        span.setAttributes(attributes);
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error: any) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message || String(error),
        });
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Add a log event to the current span
   */
  logEvent(name: string, attributes?: any) {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.addEvent(name, attributes);
    }
  }
}
