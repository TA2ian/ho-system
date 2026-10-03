ALTER TABLE accounting_periods
  ADD CONSTRAINT accounting_periods_date_range_excl
  EXCLUDE USING gist (
    daterange(period_start, period_end, '[]') WITH &&
  );
