import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const ACTION_BY_METHOD: Record<string, string> = {
  POST: 'created',
  PATCH: 'updated',
  PUT: 'updated',
  DELETE: 'deleted',
};
const REDACTED_FIELDS = ['password', 'passwordHash', 'refreshToken', 'accessToken'];

/**
 * Writes an activity_logs row for every admin mutation, fire-and-forget —
 * one global interceptor instead of per-service wiring, so new admin modules
 * are audited automatically.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { id: string }; params: Record<string, string> }>();

    if (!MUTATING.has(req.method) || !req.path.includes('/admin/')) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((result) => {
        const subjectType = this.subjectTypeFromPath(req.path);
        const resultId =
          result && typeof result === 'object' && 'id' in result
            ? String((result as { id: unknown }).id)
            : undefined;

        void this.prisma.activityLog
          .create({
            data: {
              userId: req.user?.id,
              action: ACTION_BY_METHOD[req.method] ?? req.method.toLowerCase(),
              subjectType,
              subjectId: req.params?.id ?? resultId,
              changes: { body: this.redact(req.body) } as Prisma.InputJsonValue,
            },
          })
          .catch((e) => this.logger.warn(`audit write failed: ${(e as Error).message}`));
      }),
    );
  }

  /** /v1/admin/affiliate-links/:id → 'affiliate-links' */
  private subjectTypeFromPath(path: string): string {
    const after = path.split('/admin/')[1] ?? '';
    return after.split('/')[0] || 'unknown';
  }

  private redact(body: unknown): Record<string, unknown> {
    if (!body || typeof body !== 'object') return {};
    const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
    for (const field of REDACTED_FIELDS) {
      if (field in clone) clone[field] = '[REDACTED]';
    }
    return clone;
  }
}
