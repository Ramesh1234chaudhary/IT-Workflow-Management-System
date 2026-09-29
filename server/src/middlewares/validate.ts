import Joi from 'joi';
import type { NextFunction, Request, Response } from 'express';
import ApiError from '../utils/ApiError';

type Source = 'body' | 'query' | 'params';

const formatJoiError = (error: Joi.ValidationErrorItem) => ({
  field: error.path.join('.'),
  message: error.message,
});

/**
 * Joi request validation. `validate(schema, source)` where source is one of
 * 'body' | 'query' | 'params'.
 */
export const validate =
  (schema: Joi.Schema, source: Source = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: source === 'body',
      convert: true,
    });

    if (error) {
      const details = error.details.map(formatJoiError);
      return next(
        ApiError.unprocessable(
          details.map((d) => `${d.field}: ${d.message}`).join('; '),
          { code: 'VALIDATION_ERROR', details },
        ),
      );
    }

    if (source === 'query') req.validatedQuery = value as Record<string, unknown>;
    else req[source] = value;

    return next();
  };

export const idParam = (name = 'id') => Joi.object({ [name]: Joi.string().pattern(/^[a-f\d]{24}$/i).required() }).unknown(true);

export const ValidationErrorClass = Joi.ValidationError;
export default validate;
