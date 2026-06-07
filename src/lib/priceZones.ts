export interface PriceZoneRef {
  town: string;
  district: string;
  province: string;
  zone: string;
}

export const PRICE_ZONES = [
  'Coastal',
  'Inland Zone 1',
  'Inland Zone 2',
  'Inland Zone 3',
  'Inland Zone 4',
] as const;

export type PriceZone = typeof PRICE_ZONES[number];

// SA towns mapped to their magisterial district and fuel price zone.
// Towns not listed fall under a nearby magisterial district - e.g. Ashton → Montagu (Inland Zone 1).
export const PRICE_ZONE_REFS: PriceZoneRef[] = [
  // ── Western Cape – Coastal ──
  { town: 'Cape Town', district: 'Cape Town', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Bellville', district: 'Cape Town', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Mitchells Plain', district: 'Cape Town', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Khayelitsha', district: 'Cape Town', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Stellenbosch', district: 'Stellenbosch', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Franschhoek', district: 'Stellenbosch', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Paarl', district: 'Paarl', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Wellington', district: 'Paarl', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Somerset West', district: 'Strand', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Strand', district: 'Strand', province: 'Western Cape', zone: 'Coastal' },
  { town: "Gordon's Bay", district: 'Strand', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Malmesbury', district: 'Malmesbury', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Darling', district: 'Malmesbury', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Moorreesburg', district: 'Malmesbury', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Piketberg', district: 'Piketberg', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Velddrif', district: 'Piketberg', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Hopefield', district: 'Piketberg', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Hermanus', district: 'Caledon', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Caledon', district: 'Caledon', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Grabouw', district: 'Caledon', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Bredasdorp', district: 'Bredasdorp', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Napier', district: 'Bredasdorp', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Arniston', district: 'Bredasdorp', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Swellendam', district: 'Swellendam', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Barrydale', district: 'Swellendam', province: 'Western Cape', zone: 'Coastal' },
  { town: 'George', district: 'George', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Wilderness', district: 'George', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Knysna', district: 'Knysna', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Plettenberg Bay', district: 'Knysna', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Mossel Bay', district: 'Mossel Bay', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Hartenbos', district: 'Mossel Bay', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Stilbaai', district: 'Riversdale', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Riversdale', district: 'Riversdale', province: 'Western Cape', zone: 'Coastal' },
  { town: 'Albertinia', district: 'Riversdale', province: 'Western Cape', zone: 'Coastal' },
  // ── Western Cape – Inland Zone 1 ──
  { town: 'Worcester', district: 'Worcester', province: 'Western Cape', zone: 'Inland Zone 1' },
  { town: 'Rawsonville', district: 'Worcester', province: 'Western Cape', zone: 'Inland Zone 1' },
  { town: 'Robertson', district: 'Robertson', province: 'Western Cape', zone: 'Inland Zone 1' },
  { town: 'McGregor', district: 'Robertson', province: 'Western Cape', zone: 'Inland Zone 1' },
  { town: 'Ashton', district: 'Montagu', province: 'Western Cape', zone: 'Inland Zone 1' },
  { town: 'Montagu', district: 'Montagu', province: 'Western Cape', zone: 'Inland Zone 1' },
  { town: 'Bonnievale', district: 'Montagu', province: 'Western Cape', zone: 'Inland Zone 1' },
  { town: 'Ceres', district: 'Ceres', province: 'Western Cape', zone: 'Inland Zone 1' },
  { town: 'Tulbagh', district: 'Ceres', province: 'Western Cape', zone: 'Inland Zone 1' },
  { town: 'Wolseley', district: 'Ceres', province: 'Western Cape', zone: 'Inland Zone 1' },
  { town: 'Prince Alfred Hamlet', district: 'Ceres', province: 'Western Cape', zone: 'Inland Zone 1' },
  { town: 'Villiersdorp', district: 'Villiersdorp', province: 'Western Cape', zone: 'Inland Zone 1' },
  { town: 'Oudtshoorn', district: 'Oudtshoorn', province: 'Western Cape', zone: 'Inland Zone 1' },
  { town: 'De Rust', district: 'Oudtshoorn', province: 'Western Cape', zone: 'Inland Zone 1' },
  { town: 'Calitzdorp', district: 'Calitzdorp', province: 'Western Cape', zone: 'Inland Zone 1' },
  { town: 'Ladismith', district: 'Ladismith', province: 'Western Cape', zone: 'Inland Zone 1' },
  { town: 'Uniondale', district: 'Uniondale', province: 'Western Cape', zone: 'Inland Zone 1' },
  // ── Western Cape – Inland Zone 2 ──
  { town: 'Willowmore', district: 'Willowmore', province: 'Western Cape', zone: 'Inland Zone 2' },
  { town: 'Beaufort West', district: 'Beaufort West', province: 'Western Cape', zone: 'Inland Zone 2' },
  { town: 'Laingsburg', district: 'Laingsburg', province: 'Western Cape', zone: 'Inland Zone 2' },
  { town: 'Prince Albert', district: 'Prince Albert', province: 'Western Cape', zone: 'Inland Zone 2' },
  { town: 'Matjiesfontein', district: 'Laingsburg', province: 'Western Cape', zone: 'Inland Zone 2' },
  // ── Northern Cape – Coastal ──
  { town: 'Springbok', district: 'Namaqualand', province: 'Northern Cape', zone: 'Coastal' },
  { town: 'Port Nolloth', district: 'Namaqualand', province: 'Northern Cape', zone: 'Coastal' },
  { town: 'Garies', district: 'Namaqualand', province: 'Northern Cape', zone: 'Coastal' },
  // ── Northern Cape – Inland Zone 2 ──
  { town: 'Calvinia', district: 'Calvinia', province: 'Northern Cape', zone: 'Inland Zone 2' },
  { town: 'Carnarvon', district: 'Carnarvon', province: 'Northern Cape', zone: 'Inland Zone 2' },
  { town: 'Victoria West', district: 'Victoria West', province: 'Northern Cape', zone: 'Inland Zone 2' },
  { town: 'De Aar', district: 'De Aar', province: 'Northern Cape', zone: 'Inland Zone 2' },
  { town: 'Britstown', district: 'Britstown', province: 'Northern Cape', zone: 'Inland Zone 2' },
  { town: 'Prieska', district: 'Prieska', province: 'Northern Cape', zone: 'Inland Zone 2' },
  { town: 'Douglas', district: 'Douglas', province: 'Northern Cape', zone: 'Inland Zone 2' },
  // ── Northern Cape – Inland Zone 3 ──
  { town: 'Kimberley', district: 'Kimberley', province: 'Northern Cape', zone: 'Inland Zone 3' },
  { town: 'Upington', district: 'Gordonia', province: 'Northern Cape', zone: 'Inland Zone 3' },
  { town: 'Postmasburg', district: 'Postmasburg', province: 'Northern Cape', zone: 'Inland Zone 3' },
  { town: 'Kuruman', district: 'Kuruman', province: 'Northern Cape', zone: 'Inland Zone 3' },
  { town: 'Kathu', district: 'Kuruman', province: 'Northern Cape', zone: 'Inland Zone 3' },
  // ── Eastern Cape – Coastal ──
  { town: 'Gqeberha', district: 'Port Elizabeth', province: 'Eastern Cape', zone: 'Coastal' },
  { town: 'Port Elizabeth', district: 'Port Elizabeth', province: 'Eastern Cape', zone: 'Coastal' },
  { town: 'Uitenhage', district: 'Uitenhage', province: 'Eastern Cape', zone: 'Coastal' },
  { town: 'Despatch', district: 'Uitenhage', province: 'Eastern Cape', zone: 'Coastal' },
  { town: 'East London', district: 'East London', province: 'Eastern Cape', zone: 'Coastal' },
  { town: "King William's Town", district: "King William's Town", province: 'Eastern Cape', zone: 'Coastal' },
  { town: 'Makhanda', district: 'Albany', province: 'Eastern Cape', zone: 'Coastal' },
  { town: 'Grahamstown', district: 'Albany', province: 'Eastern Cape', zone: 'Coastal' },
  { town: 'Port Alfred', district: 'Albany', province: 'Eastern Cape', zone: 'Coastal' },
  { town: 'Humansdorp', district: 'Humansdorp', province: 'Eastern Cape', zone: 'Coastal' },
  { town: 'Jeffreys Bay', district: 'Humansdorp', province: 'Eastern Cape', zone: 'Coastal' },
  { town: 'Butterworth', district: 'Butterworth', province: 'Eastern Cape', zone: 'Coastal' },
  { town: 'Bisho', district: "King William's Town", province: 'Eastern Cape', zone: 'Coastal' },
  { town: 'Alice', district: 'Victoria East', province: 'Eastern Cape', zone: 'Coastal' },
  // ── Eastern Cape – Inland Zone 1 ──
  { town: 'Mthatha', district: 'Mthatha', province: 'Eastern Cape', zone: 'Inland Zone 1' },
  { town: 'Komani', district: 'Queenstown', province: 'Eastern Cape', zone: 'Inland Zone 1' },
  { town: 'Queenstown', district: 'Queenstown', province: 'Eastern Cape', zone: 'Inland Zone 1' },
  { town: 'Fort Beaufort', district: 'Fort Beaufort', province: 'Eastern Cape', zone: 'Inland Zone 1' },
  { town: 'Somerset East', district: 'Somerset East', province: 'Eastern Cape', zone: 'Inland Zone 1' },
  { town: 'Steytlerville', district: 'Steytlerville', province: 'Eastern Cape', zone: 'Inland Zone 1' },
  { town: 'Tarkastad', district: 'Tarkastad', province: 'Eastern Cape', zone: 'Inland Zone 1' },
  { town: 'Elliot', district: 'Elliot', province: 'Eastern Cape', zone: 'Inland Zone 1' },
  { town: 'Engcobo', district: 'Engcobo', province: 'Eastern Cape', zone: 'Inland Zone 1' },
  // ── Eastern Cape – Inland Zone 2 ──
  { town: 'Graaff-Reinet', district: 'Graaff-Reinet', province: 'Eastern Cape', zone: 'Inland Zone 2' },
  { town: 'Cradock', district: 'Cradock', province: 'Eastern Cape', zone: 'Inland Zone 2' },
  { town: 'Middelburg (EC)', district: 'Middelburg', province: 'Eastern Cape', zone: 'Inland Zone 2' },
  { town: 'Aliwal North', district: 'Aliwal North', province: 'Eastern Cape', zone: 'Inland Zone 2' },
  { town: 'Burgersdorp', district: 'Burgersdorp', province: 'Eastern Cape', zone: 'Inland Zone 2' },
  { town: 'Barkly East', district: 'Barkly East', province: 'Eastern Cape', zone: 'Inland Zone 2' },
  { town: 'Lady Grey', district: 'Lady Grey', province: 'Eastern Cape', zone: 'Inland Zone 2' },
  // ── KwaZulu-Natal – Coastal ──
  { town: 'Durban', district: 'Durban', province: 'KwaZulu-Natal', zone: 'Coastal' },
  { town: 'eThekwini', district: 'Durban', province: 'KwaZulu-Natal', zone: 'Coastal' },
  { town: 'Pinetown', district: 'Pinetown', province: 'KwaZulu-Natal', zone: 'Coastal' },
  { town: 'Amanzimtoti', district: 'Durban', province: 'KwaZulu-Natal', zone: 'Coastal' },
  { town: 'Umhlanga', district: 'Durban', province: 'KwaZulu-Natal', zone: 'Coastal' },
  { town: 'Ballito', district: 'Stanger', province: 'KwaZulu-Natal', zone: 'Coastal' },
  { town: 'Stanger', district: 'Stanger', province: 'KwaZulu-Natal', zone: 'Coastal' },
  { town: 'Richards Bay', district: 'Empangeni', province: 'KwaZulu-Natal', zone: 'Coastal' },
  { town: 'Empangeni', district: 'Empangeni', province: 'KwaZulu-Natal', zone: 'Coastal' },
  { town: 'Pietermaritzburg', district: 'Pietermaritzburg', province: 'KwaZulu-Natal', zone: 'Coastal' },
  { town: 'Port Shepstone', district: 'Port Shepstone', province: 'KwaZulu-Natal', zone: 'Coastal' },
  { town: 'Margate', district: 'Port Shepstone', province: 'KwaZulu-Natal', zone: 'Coastal' },
  // ── KwaZulu-Natal – Inland Zone 1 ──
  { town: 'Howick', district: 'Lions River', province: 'KwaZulu-Natal', zone: 'Inland Zone 1' },
  { town: 'Kokstad', district: 'Kokstad', province: 'KwaZulu-Natal', zone: 'Inland Zone 1' },
  { town: 'Ulundi', district: 'Nongoma', province: 'KwaZulu-Natal', zone: 'Inland Zone 1' },
  { town: 'Nongoma', district: 'Nongoma', province: 'KwaZulu-Natal', zone: 'Inland Zone 1' },
  { town: 'Greytown', district: 'Greytown', province: 'KwaZulu-Natal', zone: 'Inland Zone 1' },
  // ── KwaZulu-Natal – Inland Zone 2 ──
  { town: 'Newcastle', district: 'Newcastle', province: 'KwaZulu-Natal', zone: 'Inland Zone 2' },
  { town: 'Ladysmith', district: 'Ladysmith', province: 'KwaZulu-Natal', zone: 'Inland Zone 2' },
  { town: 'Estcourt', district: 'Estcourt', province: 'KwaZulu-Natal', zone: 'Inland Zone 2' },
  { town: 'Dundee', district: 'Dundee', province: 'KwaZulu-Natal', zone: 'Inland Zone 2' },
  { town: 'Glencoe', district: 'Dundee', province: 'KwaZulu-Natal', zone: 'Inland Zone 2' },
  { town: 'Vryheid', district: 'Vryheid', province: 'KwaZulu-Natal', zone: 'Inland Zone 2' },
  { town: 'Bergville', district: 'Bergville', province: 'KwaZulu-Natal', zone: 'Inland Zone 2' },
  // ── Free State – Inland Zone 3 ──
  { town: 'Bloemfontein', district: 'Bloemfontein', province: 'Free State', zone: 'Inland Zone 3' },
  { town: 'Mangaung', district: 'Bloemfontein', province: 'Free State', zone: 'Inland Zone 3' },
  { town: 'Welkom', district: 'Welkom', province: 'Free State', zone: 'Inland Zone 3' },
  { town: 'Virginia', district: 'Welkom', province: 'Free State', zone: 'Inland Zone 3' },
  { town: 'Odendaalsrus', district: 'Welkom', province: 'Free State', zone: 'Inland Zone 3' },
  { town: 'Kroonstad', district: 'Kroonstad', province: 'Free State', zone: 'Inland Zone 3' },
  { town: 'Sasolburg', district: 'Sasolburg', province: 'Free State', zone: 'Inland Zone 3' },
  { town: 'Parys', district: 'Parys', province: 'Free State', zone: 'Inland Zone 3' },
  { town: 'Harrismith', district: 'Harrismith', province: 'Free State', zone: 'Inland Zone 3' },
  { town: 'Bethlehem', district: 'Bethlehem', province: 'Free State', zone: 'Inland Zone 3' },
  { town: 'Phuthaditjhaba', district: 'Qwaqwa', province: 'Free State', zone: 'Inland Zone 3' },
  { town: 'Zastron', district: 'Zastron', province: 'Free State', zone: 'Inland Zone 3' },
  { town: 'Ladybrand', district: 'Ladybrand', province: 'Free State', zone: 'Inland Zone 3' },
  { town: 'Ficksburg', district: 'Ficksburg', province: 'Free State', zone: 'Inland Zone 3' },
  { town: 'Senekal', district: 'Senekal', province: 'Free State', zone: 'Inland Zone 3' },
  { town: 'Frankfort', district: 'Frankfort', province: 'Free State', zone: 'Inland Zone 3' },
  { town: 'Vrede', district: 'Vrede', province: 'Free State', zone: 'Inland Zone 3' },
  // ── Gauteng – Inland Zone 4 ──
  { town: 'Johannesburg', district: 'Johannesburg', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Sandton', district: 'Johannesburg', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Soweto', district: 'Johannesburg', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Roodepoort', district: 'Johannesburg', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Randburg', district: 'Johannesburg', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Midrand', district: 'Johannesburg', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Pretoria', district: 'Pretoria', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Tshwane', district: 'Pretoria', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Centurion', district: 'Pretoria', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Soshanguve', district: 'Pretoria', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Mamelodi', district: 'Pretoria', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Germiston', district: 'Germiston', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Ekurhuleni', district: 'Germiston', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Boksburg', district: 'Germiston', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Benoni', district: 'Benoni', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Brakpan', district: 'Brakpan', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Springs', district: 'Springs', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Alberton', district: 'Alberton', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Krugersdorp', district: 'Krugersdorp', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Randfontein', district: 'Randfontein', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Westonaria', district: 'Westonaria', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Vereeniging', district: 'Vereeniging', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Vanderbijlpark', district: 'Vereeniging', province: 'Gauteng', zone: 'Inland Zone 4' },
  { town: 'Evaton', district: 'Vereeniging', province: 'Gauteng', zone: 'Inland Zone 4' },
  // ── North West ──
  { town: 'Rustenburg', district: 'Rustenburg', province: 'North West', zone: 'Inland Zone 4' },
  { town: 'Potchefstroom', district: 'Potchefstroom', province: 'North West', zone: 'Inland Zone 4' },
  { town: 'Brits', district: 'Brits', province: 'North West', zone: 'Inland Zone 4' },
  { town: 'Hartbeespoort', district: 'Brits', province: 'North West', zone: 'Inland Zone 4' },
  { town: 'Ventersdorp', district: 'Ventersdorp', province: 'North West', zone: 'Inland Zone 4' },
  { town: 'Klerksdorp', district: 'Klerksdorp', province: 'North West', zone: 'Inland Zone 3' },
  { town: 'Orkney', district: 'Klerksdorp', province: 'North West', zone: 'Inland Zone 3' },
  { town: 'Mahikeng', district: 'Mafikeng', province: 'North West', zone: 'Inland Zone 3' },
  { town: 'Mafikeng', district: 'Mafikeng', province: 'North West', zone: 'Inland Zone 3' },
  { town: 'Lichtenburg', district: 'Lichtenburg', province: 'North West', zone: 'Inland Zone 3' },
  { town: 'Zeerust', district: 'Zeerust', province: 'North West', zone: 'Inland Zone 3' },
  { town: 'Wolmaransstad', district: 'Wolmaransstad', province: 'North West', zone: 'Inland Zone 3' },
  // ── Limpopo – Inland Zone 4 ──
  { town: 'Polokwane', district: 'Pietersburg', province: 'Limpopo', zone: 'Inland Zone 4' },
  { town: 'Mokopane', district: 'Potgietersrus', province: 'Limpopo', zone: 'Inland Zone 4' },
  { town: 'Bela-Bela', district: 'Warmbad', province: 'Limpopo', zone: 'Inland Zone 4' },
  { town: 'Makhado', district: 'Louis Trichardt', province: 'Limpopo', zone: 'Inland Zone 4' },
  { town: 'Louis Trichardt', district: 'Louis Trichardt', province: 'Limpopo', zone: 'Inland Zone 4' },
  { town: 'Musina', district: 'Soutpansberg', province: 'Limpopo', zone: 'Inland Zone 4' },
  { town: 'Tzaneen', district: 'Tzaneen', province: 'Limpopo', zone: 'Inland Zone 4' },
  { town: 'Lephalale', district: 'Ellisras', province: 'Limpopo', zone: 'Inland Zone 4' },
  { town: 'Phalaborwa', district: 'Phalaborwa', province: 'Limpopo', zone: 'Inland Zone 4' },
  { town: 'Giyani', district: 'Giyani', province: 'Limpopo', zone: 'Inland Zone 4' },
  { town: 'Thohoyandou', district: 'Vuwani', province: 'Limpopo', zone: 'Inland Zone 4' },
  { town: 'Burgersfort', district: 'Lydenburg', province: 'Limpopo', zone: 'Inland Zone 4' },
  { town: 'Marble Hall', district: 'Marble Hall', province: 'Limpopo', zone: 'Inland Zone 4' },
  { town: 'Modimolle', district: 'Nylstroom', province: 'Limpopo', zone: 'Inland Zone 4' },
  // ── Mpumalanga ──
  { town: 'Mbombela', district: 'Nelspruit', province: 'Mpumalanga', zone: 'Inland Zone 3' },
  { town: 'Nelspruit', district: 'Nelspruit', province: 'Mpumalanga', zone: 'Inland Zone 3' },
  { town: 'White River', district: 'Nelspruit', province: 'Mpumalanga', zone: 'Inland Zone 3' },
  { town: 'Hazyview', district: 'Nelspruit', province: 'Mpumalanga', zone: 'Inland Zone 3' },
  { town: 'Komatipoort', district: 'Komatipoort', province: 'Mpumalanga', zone: 'Inland Zone 3' },
  { town: 'Barberton', district: 'Barberton', province: 'Mpumalanga', zone: 'Inland Zone 3' },
  { town: 'Lydenburg', district: 'Lydenburg', province: 'Mpumalanga', zone: 'Inland Zone 3' },
  { town: 'Standerton', district: 'Standerton', province: 'Mpumalanga', zone: 'Inland Zone 3' },
  { town: 'Ermelo', district: 'Ermelo', province: 'Mpumalanga', zone: 'Inland Zone 3' },
  { town: 'Carolina', district: 'Carolina', province: 'Mpumalanga', zone: 'Inland Zone 3' },
  { town: 'Piet Retief', district: 'Piet Retief', province: 'Mpumalanga', zone: 'Inland Zone 3' },
  { town: 'Volksrust', district: 'Volksrust', province: 'Mpumalanga', zone: 'Inland Zone 3' },
  { town: 'eMalahleni', district: 'Witbank', province: 'Mpumalanga', zone: 'Inland Zone 4' },
  { town: 'Witbank', district: 'Witbank', province: 'Mpumalanga', zone: 'Inland Zone 4' },
  { town: 'Middelburg (MP)', district: 'Middelburg', province: 'Mpumalanga', zone: 'Inland Zone 4' },
  { town: 'Secunda', district: 'Secunda', province: 'Mpumalanga', zone: 'Inland Zone 4' },
  { town: 'Evander', district: 'Evander', province: 'Mpumalanga', zone: 'Inland Zone 4' },
  { town: 'Balfour', district: 'Balfour', province: 'Mpumalanga', zone: 'Inland Zone 4' },
  { town: 'Bethal', district: 'Bethal', province: 'Mpumalanga', zone: 'Inland Zone 4' },
];

export function lookupZone(townOrDistrict: string): PriceZoneRef | null {
  const q = townOrDistrict.trim().toLowerCase();
  return (
    PRICE_ZONE_REFS.find(r => r.town.toLowerCase() === q || r.district.toLowerCase() === q) ?? null
  );
}

export function downloadZoneReference(): void {
  const header = 'Town/Area,Magisterial District,Province,Price Zone\n';
  const rows = PRICE_ZONE_REFS.map(r =>
    `"${r.town}","${r.district}","${r.province}","${r.zone}"`
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sa_fuel_price_zones_reference.csv';
  a.click();
  URL.revokeObjectURL(url);
}
