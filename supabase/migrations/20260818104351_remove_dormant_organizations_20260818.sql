-- Remove 13 dormant client organizations and all cascaded data
-- Backup is in backup_schema_20260818 schema
-- Keeping: FUEL EMPOWERMENT SYSTEMS (management), NELMARK TRADING, Shell Robertson, TotalEnergies Route 62, TEST TRANSPORT SOLUTIONS

DELETE FROM public.organizations
WHERE id IN (
  '200149bd-022c-4048-95a7-b6077311f668', -- BIG FLEET LTD
  '2ffab50c-e1cb-4fc4-949d-baea2462d2a4', -- Cedric Smith
  '9a97878e-b52d-4c59-99d9-3614fa2dba3e', -- CHERYL NEL
  'a5921836-45f1-4b56-a9c1-e72f0861fe84', -- Connor Nel
  '742def5c-8a73-4e22-be8e-14acaeb02a4a', -- GARTH MULLER
  '8f325f64-94d8-49d8-ba86-15cc39ad0888', -- JOHANNES NEL
  '93e41e48-cfc0-441b-8883-019f57a554dd', -- KOBUS VENTER
  '5e1b46b5-6839-44d6-9557-856b2b98e4fb', -- NELMARK TRADING ENTERPRISES (PTY) LTD
  'f3d3bda7-01a8-41e8-83d6-4affeb782dac', -- NEWFLEET LTD
  'bb29b444-138b-410f-86c8-43301e7633a7', -- NEWORG TEST (PTY) LTD
  '0a9efcc2-1a4c-45e4-a48d-3c7ceca31a97', -- SAREL COETZEE
  'bd18e38c-7003-4f16-b7ad-430c38e2cfa7', -- SHELLNEWLTD
  'd212d5ba-7cef-42b9-814d-4c961d3d00f2'  -- WILLEM NEL
);
