import type { TaxRate } from '@prisma/client';

export type BusinessBaseTypeId =
  | 'GENERIC'
  | 'RETAIL'
  | 'CYBER_CAFE'
  | 'WINE_SPIRITS'
  | 'AGROVET';

export type FeatureBlockId =
  | 'TOBACCO_COUNTER'
  | 'MICRO_SNACKS'
  | 'GAME_LOUNGE'
  | 'DIGITAL_CONTENT'
  | 'LIQUOR_SHELF';

export type FeatureBlockDefinition = {
  id: FeatureBlockId;
  label: string;
  description: string;
  recommendedFor: BusinessBaseTypeId[];
  tags?: string[];
};

export type BaseTemplateDefinition = {
  id: BusinessBaseTypeId;
  label: string;
  description: string;
  recommendedBlocks: FeatureBlockId[];
};

export const FEATURE_BLOCKS: FeatureBlockDefinition[] = [
  {
    id: 'TOBACCO_COUNTER',
    label: 'Tobacco Counter',
    description:
      'Adds Sportsman (Packet) with Stick UoM for single-stick sales in Wines & Spirits or kiosks.',
    recommendedFor: ['RETAIL', 'WINE_SPIRITS'],
    tags: ['kadogo', 'tobacco'],
  },
  {
    id: 'MICRO_SNACKS',
    label: 'Micro Snacks (Njugu/Smokies)',
    description:
      'Adds Peanuts (10 Bob Pkt) and Smokie (Piece) for kadogo snacks at the till.',
    recommendedFor: ['RETAIL', 'CYBER_CAFE'],
    tags: ['kadogo', 'snacks'],
  },
  {
    id: 'GAME_LOUNGE',
    label: 'Game Lounge (PlayStation)',
    description:
      'Adds FIFA Game (10 Mins) as a time-based service for PlayStation or gaming lounges.',
    recommendedFor: ['CYBER_CAFE'],
    tags: ['service', 'gaming'],
  },
  {
    id: 'DIGITAL_CONTENT',
    label: 'Digital Content (Movie Shop)',
    description:
      'Adds Movie Transfer (Per GB) and Full Series as digital services for movie shops.',
    recommendedFor: ['CYBER_CAFE', 'RETAIL'],
    tags: ['digital', 'movies'],
  },
  {
    id: 'LIQUOR_SHELF',
    label: 'Liquor Shelf',
    description:
      'Adds Chrome Vodka 250ml, Tusker Lager, and a Tot UoM for open-bottle shots.',
    recommendedFor: ['WINE_SPIRITS'],
    tags: ['liquor', 'bar'],
  },
];

export const BASE_TEMPLATES: BaseTemplateDefinition[] = [
  {
    id: 'GENERIC',
    label: 'Generic Shop',
    description:
      'A simple mixed shop. Start light, then add feature blocks as you grow.',
    recommendedBlocks: ['MICRO_SNACKS'],
  },
  {
    id: 'RETAIL',
    label: 'Retail / FMCG Shop',
    description:
      'Supermarket or duka selling fast-moving goods, airtime, and basics.',
    recommendedBlocks: ['MICRO_SNACKS'],
  },
  {
    id: 'CYBER_CAFE',
    label: 'Cyber Café',
    description:
      'Browsers, printers, and scanners that often sell movies, snacks, and gaming.',
    // We pre-select digital content + snacks. Gaming is an optional add-on.
    recommendedBlocks: ['DIGITAL_CONTENT', 'MICRO_SNACKS'],
  },
  {
    id: 'WINE_SPIRITS',
    label: 'Wines & Spirits',
    description:
      'Liquor shop with single-stick cigarettes and bar-style tots for shots.',
    recommendedBlocks: ['LIQUOR_SHELF', 'TOBACCO_COUNTER', 'MICRO_SNACKS'],
  },
  {
    id: 'AGROVET',
    label: 'Agrovet / Vet',
    description:
      'Farm inputs and vet supplies. Combine with snacks or digital content as needed.',
    recommendedBlocks: ['MICRO_SNACKS'],
  },
];