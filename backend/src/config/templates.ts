import type { TaxRate } from '@prisma/client';

export type BusinessBaseTypeId =
  | 'GENERIC'
  | 'RETAIL'
  | 'SERVICE_HUB'
  | 'HOSPITALITY'
  | 'AGRO';

export type FeatureBlockId =
  | 'SINGLES_COUNTER'
  | 'SNACK_BAR'
  | 'GAME_SESSION'
  | 'DIGITAL_SERVICE'
  | 'BEVERAGE_SHELF';

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
    id: 'SINGLES_COUNTER',
    label: 'Singles Counter',
    description:
      'Adds a bundled item and a derived smaller unit for selling single pieces from a pack.',
    recommendedFor: ['RETAIL', 'HOSPITALITY'],
    tags: ['kadogo', 'singles'],
  },
  {
    id: 'SNACK_BAR',
    label: 'Snack Bar',
    description:
      'Adds a small snack pack and a single-piece snack for low price-point add-ons.',
    recommendedFor: ['RETAIL', 'SERVICE_HUB'],
    tags: ['kadogo', 'snacks'],
  },
  {
    id: 'GAME_SESSION',
    label: 'Game Session',
    description:
      'Adds a time-based service item (e.g. 10-minute session) for gaming or similar services.',
    recommendedFor: ['SERVICE_HUB'],
    tags: ['service', 'gaming'],
  },
  {
    id: 'DIGITAL_SERVICE',
    label: 'Digital Service',
    description:
      'Adds per-unit digital transfer and bundled digital service products (e.g. per GB, per bundle).',
    recommendedFor: ['SERVICE_HUB', 'RETAIL'],
    tags: ['digital', 'services'],
  },
  {
    id: 'BEVERAGE_SHELF',
    label: 'Beverage Shelf',
    description:
      'Adds bottled beverages and a smaller pouring unit derived from the bottle size.',
    recommendedFor: ['HOSPITALITY', 'RETAIL'],
    tags: ['beverage', 'bar'],
  },
];

export const BASE_TEMPLATES: BaseTemplateDefinition[] = [
  {
    id: 'GENERIC',
    label: 'Generic Business',
    description:
      'A simple mixed business. Start light, then add feature blocks as you grow.',
    recommendedBlocks: ['SNACK_BAR'],
  },
  {
    id: 'RETAIL',
    label: 'Retail / Shop',
    description:
      'A convenience or general store selling goods at the counter.',
    recommendedBlocks: ['SNACK_BAR'],
  },
  {
    id: 'SERVICE_HUB',
    label: 'Service Hub',
    description:
      'Any service-oriented business (workstations, repairs, entertainment, etc.).',
    // Pre-select digital and snack services; game sessions are an optional add-on.
    recommendedBlocks: ['DIGITAL_SERVICE', 'SNACK_BAR'],
  },
  {
    id: 'HOSPITALITY',
    label: 'Hospitality / Lounge',
    description:
      'A small bar, lounge, or meeting spot that needs beverages and singles.',
    recommendedBlocks: ['BEVERAGE_SHELF', 'SINGLES_COUNTER', 'SNACK_BAR'],
  },
  {
    id: 'AGRO',
    label: 'Agro / Inputs',
    description:
      'Farm inputs and related services. Combine with snacks or digital as needed.',
    recommendedBlocks: ['SNACK_BAR'],
  },
];