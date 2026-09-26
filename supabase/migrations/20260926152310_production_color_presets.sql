-- Required reference data belongs in migrations, independently of Demo seed.
-- Preserve existing colors when upgrading an already seeded database.
insert into public.color_presets (key, name_th, hex, text_color, sort_order) values
  ('yellow', 'เหลือง', '#F4C430', '#17211B', 1),
  ('blue', 'น้ำเงิน', '#2563EB', '#FFFFFF', 2),
  ('red', 'แดง', '#DC2626', '#FFFFFF', 3),
  ('green', 'เขียว', '#15803D', '#FFFFFF', 4),
  ('purple', 'ม่วง', '#7C3AED', '#FFFFFF', 5),
  ('orange', 'ส้ม', '#EA580C', '#FFFFFF', 6),
  ('sky', 'ฟ้า', '#0284C7', '#FFFFFF', 7),
  ('pink', 'ชมพู', '#DB2777', '#FFFFFF', 8),
  ('teal', 'เขียวอมฟ้า', '#0F766E', '#FFFFFF', 9),
  ('brown', 'น้ำตาล', '#8B5E3C', '#FFFFFF', 10),
  ('navy', 'กรมท่า', '#1E3A8A', '#FFFFFF', 11),
  ('lime', 'เขียวมะนาว', '#4D7C0F', '#FFFFFF', 12),
  ('magenta', 'บานเย็น', '#A21CAF', '#FFFFFF', 13),
  ('cyan', 'คราม', '#0E7490', '#FFFFFF', 14),
  ('maroon', 'เลือดหมู', '#881337', '#FFFFFF', 15),
  ('olive', 'เขียวมะกอก', '#3F6212', '#FFFFFF', 16),
  ('gray', 'เทา', '#4B5563', '#FFFFFF', 17),
  ('black', 'ดำ', '#111827', '#FFFFFF', 18),
  ('gold', 'ทอง', '#A16207', '#FFFFFF', 19),
  ('indigo', 'ครามม่วง', '#4338CA', '#FFFFFF', 20)
on conflict (key) do nothing;
