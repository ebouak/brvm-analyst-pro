import { describe, expect, it } from 'vitest';
import { paperOrderErrorResponse } from './orderErrors';

describe('paperOrderErrorResponse', () => {
  it('maps insufficient reservations to a conflict without masking the cause', () => {
    expect(paperOrderErrorResponse('INSUFFICIENT_CASH')).toEqual({
      status: 409,
      message: 'Liquidités disponibles insuffisantes pour réserver cet ordre.',
    });
  });

  it('returns null for an unexpected server error code', () => {
    expect(paperOrderErrorResponse('DATABASE_FAILURE')).toBeNull();
  });
});
