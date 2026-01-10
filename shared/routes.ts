import { z } from 'zod';
import { insertReportSchema, reports, comments, insertCommentSchema, reportFlags, insertReportFlagSchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  reports: {
    list: {
      method: 'GET' as const,
      path: '/api/reports',
      responses: {
        200: z.array(z.custom<typeof reports.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/reports',
      input: insertReportSchema,
      responses: {
        201: z.custom<typeof reports.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/reports/:id',
      responses: {
        200: z.custom<typeof reports.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    verify: {
      method: 'POST' as const,
      path: '/api/reports/:id/verify',
      responses: {
        200: z.custom<typeof reports.$inferSelect>(), // Returns updated report
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    downvote: {
      method: 'POST' as const,
      path: '/api/reports/:id/downvote',
      responses: {
        200: z.custom<typeof reports.$inferSelect>(), // Returns updated report
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
  },
  comments: {
    create: {
      method: 'POST' as const,
      path: '/api/comments',
      input: insertCommentSchema,
      responses: {
        201: z.custom<typeof comments.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/reports/:reportId/comments',
      responses: {
        200: z.array(z.custom<typeof comments.$inferSelect>()),
      },
    }
  },
  flags: {
    create: {
      method: 'POST' as const,
      path: '/api/reports/:id/flag',
      input: insertReportFlagSchema,
      responses: {
        201: z.custom<typeof reportFlags.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
