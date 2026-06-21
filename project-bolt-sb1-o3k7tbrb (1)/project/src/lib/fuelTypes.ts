// Standard South African fuel types as per Department of Mineral Resources and Energy
export const AVAILABLE_FUEL_TYPES = [
  { value: 'ULP-93', label: 'Unleaded Petrol 93 (ULP-93)' },
  { value: 'ULP-95', label: 'Unleaded Petrol 95 (ULP-95)' },
  { value: 'Diesel-10', label: 'Diesel 10 ppm Sulphur' },
  { value: 'Diesel-50', label: 'Diesel 50 ppm Sulphur' },
  { value: 'Diesel-500', label: 'Diesel 500 ppm Sulphur' },
] as const;

export const getFuelTypeDisplayName = (fuelType: string): string => {
  const displayNames: { [key: string]: string } = {
    'ULP-93': 'Unleaded Petrol 93 (ULP-93)',
    'ULP-95': 'Unleaded Petrol 95 (ULP-95)',
    'Diesel-10': 'Diesel 10 ppm Sulphur',
    'Diesel-50': 'Diesel 50 ppm Sulphur',
    'Diesel-500': 'Diesel 500 ppm Sulphur',
    // Legacy fuel types (for backward compatibility with existing data)
    'ULP-97': 'ULP-97 Octane',
    'LRP': 'Lead Replacement Petrol (LRP)',
    'AdBlue': 'AdBlue (Diesel Exhaust Fluid)'
  };
  return displayNames[fuelType] || fuelType;
};

export const sortFuelTypes = (fuelTypes: string[]): string[] => {
  const order = [
    'ULP-93',
    'ULP-95',
    'Diesel-10',
    'Diesel-50',
    'Diesel-500',
    // Legacy types (for backward compatibility)
    'ULP-97',
    'LRP',
    'AdBlue'
  ];

  return [...fuelTypes].sort((a, b) => {
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);

    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;

    return indexA - indexB;
  });
};

export const FUEL_TYPES = [
  'ULP-93',
  'ULP-95',
  'Diesel-10',
  'Diesel-50',
  'Diesel-500'
] as const;

export type FuelType = typeof FUEL_TYPES[number];
