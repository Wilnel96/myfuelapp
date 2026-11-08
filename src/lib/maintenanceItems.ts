export type MaintenanceType = 'service' | 'other' | 'license_renewal' | 'insurance';

export const MAINTENANCE_TYPE_OPTIONS: { value: MaintenanceType; label: string }[] = [
  { value: 'service', label: 'Service' },
  { value: 'other', label: 'Other Maintenance' },
  { value: 'license_renewal', label: 'License Renewal' },
  { value: 'insurance', label: 'Insurance' },
];

export const SERVICE_ITEMS = [
  'Minor Service',
  'Major Service',
  'Oil Change',
  'Oil Filter Replacement',
  'Air Filter Replacement',
  'Fuel Filter Replacement',
  'Cabin Filter Replacement',
  'Spark Plug Replacement',
  'Coolant Flush',
  'Brake Fluid Change',
  'Transmission Fluid Change',
  'Differential Fluid Change',
  'General Inspection',
  'Other',
];

export const OTHER_ITEMS = [
  'Tire Replacement',
  'Tire Rotation',
  'Wheel Alignment',
  'Brake Pads',
  'Brake Discs',
  'Brake Calipers',
  'Battery Replacement',
  'Alternator Repair',
  'Starter Motor Repair',
  'Clutch Replacement',
  'Shock Absorbers',
  'Exhaust Repair',
  'Engine Repair',
  'Gearbox Repair',
  'Differential Repair',
  'Electrical Fault',
  'Bodywork / Panel Beating',
  'Windscreen Replacement',
  'Air Conditioning Service',
  'Tow Bar Fitment',
  'Other',
];

export const LICENSE_RENEWAL_ITEMS = [
  'Annual License Renewal',
  'Roadworthy Certificate',
  'Vehicle Registration',
  'License Disc Renewal',
  'Change of Ownership',
  'Deregistration',
  'Re-registration',
  'Other',
];

export const INSURANCE_ITEMS = [
  'Comprehensive Insurance',
  'Third Party Insurance',
  'Third Party Fire & Theft',
  'Fleet Insurance Premium',
  'Insurance Excess Payment',
  'Insurance Claim Deductible',
  'Gap Cover',
  'Other',
];

export const getMaintenanceItems = (type: MaintenanceType): string[] => {
  switch (type) {
    case 'service':
      return SERVICE_ITEMS;
    case 'license_renewal':
      return LICENSE_RENEWAL_ITEMS;
    case 'insurance':
      return INSURANCE_ITEMS;
    default:
      return OTHER_ITEMS;
  }
};
