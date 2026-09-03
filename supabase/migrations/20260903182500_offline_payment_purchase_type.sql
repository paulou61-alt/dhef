alter table public.offline_sync_receipts
  drop constraint if exists offline_sync_receipts_operation_type_check;

alter table public.offline_sync_receipts
  add constraint offline_sync_receipts_operation_type_check
  check (operation_type in ('sale', 'payment', 'payment_purchase', 'expense'));
