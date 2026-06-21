/*
  # Import 5 Garages from OSM Data

  1. Garages Added
    - Engen (Willowmore)
    - TotalEnergies (Caledon)
    - Sasol (George)
    - Caltex (Unknown location)
    - Shell (Unknown location)

  2. Details
    - All linked to Management Organization
    - Default password: 'garage123'
    - Price zone: 'coastal'
    - Status: 'active'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM garages
    WHERE name = 'Engen'
    AND city = 'Willowmore'
    AND latitude = -33.2961453
  ) THEN
    INSERT INTO garages (
      organization_id,
      name,
      email_address,
      address_line_1,
      address_line_2,
      city,
      province,
      postal_code,
      latitude,
      longitude,
      fuel_types,
      fuel_brand,
      price_zone,
      other_offerings,
      vat_number,
      password,
      status,
      contact_persons
    ) VALUES (
      (SELECT id FROM organizations WHERE organization_type = 'management' LIMIT 1),
      'Engen',
      NULL,
      '44 Knysna Street',
      NULL,
      'Willowmore',
      'Western Cape',
      NULL,
      -33.2961453,
      23.485679,
      '{"Diesel","Petrol (95 ULP)","Petrol (98 ULP)"}'::text[],
      'Engen',
      'coastal',
      '{}'::jsonb,
      NULL,
      'garage123',
      'active',
      '[{"name":"Manager","surname":"","email":"","phone":"+27 44 923 1007","mobile_phone":"","is_primary":true}]'::jsonb
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM garages
    WHERE name = 'TotalEnergies'
    AND city = 'Caledon'
    AND latitude = -34.2393389
  ) THEN
    INSERT INTO garages (
      organization_id,
      name,
      email_address,
      address_line_1,
      address_line_2,
      city,
      province,
      postal_code,
      latitude,
      longitude,
      fuel_types,
      fuel_brand,
      price_zone,
      other_offerings,
      vat_number,
      password,
      status,
      contact_persons
    ) VALUES (
      (SELECT id FROM organizations WHERE organization_type = 'management' LIMIT 1),
      'TotalEnergies',
      NULL,
      NULL,
      NULL,
      'Caledon',
      'Western Cape',
      '7230',
      -34.2393389,
      19.4280992,
      '{"Diesel","Petrol (95 ULP)"}'::text[],
      'Total Energies',
      'coastal',
      '{}'::jsonb,
      NULL,
      'garage123',
      'active',
      '[{"name":"Manager","surname":"","email":"","phone":"+27 28 214 3851","mobile_phone":"","is_primary":true}]'::jsonb
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM garages
    WHERE name = 'Sasol'
    AND city = 'George'
    AND latitude = -33.9732564
  ) THEN
    INSERT INTO garages (
      organization_id,
      name,
      email_address,
      address_line_1,
      address_line_2,
      city,
      province,
      postal_code,
      latitude,
      longitude,
      fuel_types,
      fuel_brand,
      price_zone,
      other_offerings,
      vat_number,
      password,
      status,
      contact_persons
    ) VALUES (
      (SELECT id FROM organizations WHERE organization_type = 'management' LIMIT 1),
      'Sasol',
      NULL,
      NULL,
      NULL,
      'George',
      'Western Cape',
      '6529',
      -33.9732564,
      22.470126,
      '{"Diesel","Petrol (95 ULP)","Petrol (98 ULP)"}'::text[],
      'Sasol',
      'coastal',
      '{}'::jsonb,
      NULL,
      'garage123',
      'active',
      '[{"name":"Manager","surname":"","email":"","phone":"+27 44 873 4142","mobile_phone":"","is_primary":true}]'::jsonb
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM garages
    WHERE name = 'Caltex'
    AND city = 'Unknown'
    AND latitude = -31.6626203
  ) THEN
    INSERT INTO garages (
      organization_id,
      name,
      email_address,
      address_line_1,
      address_line_2,
      city,
      province,
      postal_code,
      latitude,
      longitude,
      fuel_types,
      fuel_brand,
      price_zone,
      other_offerings,
      vat_number,
      password,
      status,
      contact_persons
    ) VALUES (
      (SELECT id FROM organizations WHERE organization_type = 'management' LIMIT 1),
      'Caltex',
      NULL,
      NULL,
      NULL,
      'Unknown',
      'Western Cape',
      NULL,
      -31.6626203,
      18.5084114,
      '{"Diesel","Petrol (93 ULP)","Petrol (95 ULP)"}'::text[],
      'Caltex',
      'coastal',
      '{}'::jsonb,
      NULL,
      'garage123',
      'active',
      '[]'::jsonb
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM garages
    WHERE name = 'Shell'
    AND city = 'Unknown'
    AND latitude = -32.2086234
  ) THEN
    INSERT INTO garages (
      organization_id,
      name,
      email_address,
      address_line_1,
      address_line_2,
      city,
      province,
      postal_code,
      latitude,
      longitude,
      fuel_types,
      fuel_brand,
      price_zone,
      other_offerings,
      vat_number,
      password,
      status,
      contact_persons
    ) VALUES (
      (SELECT id FROM organizations WHERE organization_type = 'management' LIMIT 1),
      'Shell',
      NULL,
      'Graafwater Road',
      NULL,
      'Unknown',
      'Western Cape',
      NULL,
      -32.2086234,
      18.5950122,
      '{"Diesel","Petrol (95 ULP)"}'::text[],
      'Shell',
      'coastal',
      '{}'::jsonb,
      NULL,
      'garage123',
      'active',
      '[]'::jsonb
    );
  END IF;
END $$;
