-- Launch the EST II subjects so their papers can be imported, published and listed.
update public.subjects set is_active = true where code like 'est2-%';
