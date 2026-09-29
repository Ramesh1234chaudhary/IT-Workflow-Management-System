import type { AuthUser } from './domain.js';

declare global {
  namespace Express {
    interface Request {
      /** Populated by `authenticate`. Absent on public routes. */
      user?: AuthUser;
      /** The hydrated Mongoose document, kept for services that need more fields. */
      currentUserDoc?: unknown;
      /** Populated by `validate` middleware after Joi validation. */
      validatedQuery?: Record<string, unknown>;
    }

    interface Response {
      /** Set by `filterClientData` so serializers know how to shape the payload. */
      clientScope?: { isClientScoped: boolean; canSeeInternalData: boolean };
    }
  }
}

export {};
