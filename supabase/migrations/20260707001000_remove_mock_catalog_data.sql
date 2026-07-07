delete from public.products
where id like 'demo-%';

delete from public.booth_settings
where id = 'main'
  and booth_name = 'Akiba Shelf'
  and subtitle = 'Festival merch display'
  and booth_code = 'B12'
  and location = 'Artist Alley, near main stage'
  and open_hours = '09:00 - 20:30';

delete from public.payment_settings
where id = 'main'
  and momo_qr_url = './sample/momo-qr-demo.png'
  and bank_qr_url = './sample/momo-qr-demo.png'
  and momo_label = 'MoMo / QR Payment'
  and bank_label = 'Bank Transfer'
  and bank_account_name = 'AKIBA SHELF';
