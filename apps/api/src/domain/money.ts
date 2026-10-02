import Decimal from "decimal.js";

export type CurrencyCode = string & { readonly __brand: "CurrencyCode" };

export function currencyCode(value: string): CurrencyCode {
  const normalized = value.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error("Invalid currency code");
  }

  return normalized as CurrencyCode;
}

export class Money {
  readonly amount: Decimal;
  readonly currency: CurrencyCode;

  constructor(amount: Decimal.Value, currency: CurrencyCode) {
    this.amount = new Decimal(amount);
    this.currency = currency;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.add(other.amount), this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.sub(other.amount), this.currency);
  }

  multiply(multiplier: Decimal.Value): Money {
    return new Money(this.amount.mul(multiplier), this.currency);
  }

  isZero(): boolean {
    return this.amount.isZero();
  }

  toString(): string {
    return this.amount.toFixed();
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error("Currency mismatch");
    }
  }
}
