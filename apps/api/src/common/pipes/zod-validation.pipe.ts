import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

/** Validates/parses a request payload against a Zod schema (RFC7807-ish error). */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        title: 'Validation failed',
        status: 400,
        errors: result.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    return result.data;
  }
}
