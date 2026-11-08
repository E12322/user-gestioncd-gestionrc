import { ValueTransformer } from 'typeorm';

/**
 * PostgreSQL `numeric` columns are returned as strings by the pg driver.
 * This transformer keeps the API contract as a number.
 */
export class NumericTransformer implements ValueTransformer {
  to(value?: number | null): number | null | undefined {
    return value;
  }

  from(value?: string | null): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    return parseFloat(value);
  }
}
