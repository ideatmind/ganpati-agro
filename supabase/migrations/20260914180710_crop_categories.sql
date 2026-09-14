-- Preserve existing cluster identifiers and allow the owner's expanded catalog.
alter table public.persons drop constraint persons_cluster_type_check;
alter table public.persons add constraint persons_cluster_type_check
  check (cluster_type in (
    'cereals', 'pulses', 'oilseeds', 'cash', 'fruits', 'vegs', 'spices',
    'flowers', 'medicinal', 'mushroom', 'allied', 'protected', 'agroforestry'
  ));
