DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM garages WHERE name = 'Shell V&A Waterfront') THEN
    INSERT INTO garages (
      organization_id, name, email_address, address_line_1, address_line_2,
      city, province, postal_code, latitude, longitude,
      fuel_types, fuel_brand, price_zone, other_offerings,
      vat_number, password, status
    ) VALUES (
      (SELECT id FROM organizations WHERE organization_type = 'management' LIMIT 1),
      'Shell V&A Waterfront',
      'shell.va@example.com',
      'Dock Road',
      NULL,
      'Cape Town',
      'Western Cape',
      '8001',
      -33.9025,
      18.4187,
      ARRAY["Petrol 95","Diesel 50ppm","Petrol 93"]::text[],
      'Shell',
      'coastal',
      '["Car Wash","Convenience Store"]'::jsonb,
      NULL,
      'garage123',
      'active'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM garages WHERE name = 'BP Claremont') THEN
    INSERT INTO garages (
      organization_id, name, email_address, address_line_1, address_line_2,
      city, province, postal_code, latitude, longitude,
      fuel_types, fuel_brand, price_zone, other_offerings,
      vat_number, password, status
    ) VALUES (
      (SELECT id FROM organizations WHERE organization_type = 'management' LIMIT 1),
      'BP Claremont',
      'bp.claremont@example.com',
      'Main Road',
      NULL,
      'Cape Town',
      'Western Cape',
      '7708',
      -33.9817,
      18.4647,
      ARRAY["Petrol 95","Diesel 50ppm"]::text[],
      'BP',
      'coastal',
      '["Car Wash"]'::jsonb,
      NULL,
      'garage123',
      'active'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM garages WHERE name = 'Engen Table View') THEN
    INSERT INTO garages (
      organization_id, name, email_address, address_line_1, address_line_2,
      city, province, postal_code, latitude, longitude,
      fuel_types, fuel_brand, price_zone, other_offerings,
      vat_number, password, status
    ) VALUES (
      (SELECT id FROM organizations WHERE organization_type = 'management' LIMIT 1),
      'Engen Table View',
      'engen.tableview@example.com',
      'Marine Drive',
      NULL,
      'Cape Town',
      'Western Cape',
      '7441',
      -33.8177,
      18.4966,
      ARRAY["Petrol 95","Diesel 50ppm"]::text[],
      'Engen',
      'coastal',
      '[]'::jsonb,
      NULL,
      'garage123',
      'active'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM garages WHERE name = 'Sasol Stellenbosch') THEN
    INSERT INTO garages (
      organization_id, name, email_address, address_line_1, address_line_2,
      city, province, postal_code, latitude, longitude,
      fuel_types, fuel_brand, price_zone, other_offerings,
      vat_number, password, status
    ) VALUES (
      (SELECT id FROM organizations WHERE organization_type = 'management' LIMIT 1),
      'Sasol Stellenbosch',
      'sasol.stellenbosch@example.com',
      'Bird Street',
      NULL,
      'Stellenbosch',
      'Western Cape',
      '7600',
      -33.9321,
      18.8602,
      ARRAY["Petrol 95","Diesel 50ppm","Diesel 500ppm"]::text[],
      'Sasol',
      'inland',
      '["Convenience Store","ATM"]'::jsonb,
      NULL,
      'garage123',
      'active'
    );
  END IF;
END $$;