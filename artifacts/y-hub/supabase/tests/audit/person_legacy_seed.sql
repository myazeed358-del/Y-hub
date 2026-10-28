-- Synthetic pre-0045 history verifies companion backfill without altering events.
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('45000000-0000-4000-8000-000000000001','legacy-audit@example.invalid','{"full_name_ar":"هوية تاريخية","full_name_en":"Legacy audit identity"}');
DELETE FROM auth.users WHERE id='45000000-0000-4000-8000-000000000001';
