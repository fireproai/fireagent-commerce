import clsx from 'clsx';
import { MONEY_FALLBACK_CURRENCY, coerceAmount, formatMoney } from 'lib/money';

const Price = ({
  amount,
  className,
  currencyCode,
  currencyCodeClassName
}: {
  amount: string;
  className?: string;
  currencyCode?: string;
  currencyCodeClassName?: string;
} & React.ComponentProps<'p'>) => {
  const safeCurrency = currencyCode || MONEY_FALLBACK_CURRENCY;
  const numericAmount = coerceAmount(amount);
  const isValidNumber = numericAmount !== null && Number.isFinite(numericAmount);

  if (!isValidNumber) {
    return (
      <p suppressHydrationWarning={true} className={className}>
        — <span className={clsx('ml-1 inline', currencyCodeClassName)}>{safeCurrency}</span>
      </p>
    );
  }

  return (
    <p suppressHydrationWarning={true} className={className}>
      {formatMoney(numericAmount ?? 0, safeCurrency)}
      <span className={clsx('ml-1 inline', currencyCodeClassName)}>{`${safeCurrency}`}</span>
    </p>
  );
};

export default Price;
