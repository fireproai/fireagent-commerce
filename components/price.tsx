import clsx from 'clsx';

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
  const safeCurrency = currencyCode || 'GBP';
  const numericAmount = Number.parseFloat(amount);
  const isValidNumber = Number.isFinite(numericAmount);

  if (!isValidNumber) {
    return (
      <p suppressHydrationWarning={true} className={className}>
        — <span className={clsx('ml-1 inline', currencyCodeClassName)}>{safeCurrency}</span>
      </p>
    );
  }

  return (
    <p suppressHydrationWarning={true} className={className}>
      {`${new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: safeCurrency,
        currencyDisplay: 'narrowSymbol'
      }).format(numericAmount)}`}
      <span className={clsx('ml-1 inline', currencyCodeClassName)}>{`${safeCurrency}`}</span>
    </p>
  );
};

export default Price;
