import { describe, expect, it } from 'vitest';
import { defaultCategories, defaultSettings } from '../db/defaults';
import { PURCHASED_ITEM_KEYS, type MealType, type PurchasedItemKey } from '../db/schema';
import { itemCost } from './calc';

const { rates } = defaultSettings();
const perHead = (categoryId: string, meal: MealType) => {
  const category = defaultCategories().find((c) => c.id === categoryId)!;
  return Object.fromEntries(PURCHASED_ITEM_KEYS.map((item) => [item, itemCost(item, category.norms[meal][item], rates)])) as Record<
    PurchasedItemKey,
    number
  >;
};

describe('default money per head (AWC 547 registers)', () => {
  it('pays mothers 1 egg, ₹0.23 vegetables and ₹1.40 potato on khichuri day', () => {
    for (const id of ['pregnant', 'nursing']) expect(perHead(id, 'khichuri')).toEqual({ egg: 8.5, veg: 0.23, potato: 1.4, chatu: 0 });
  });

  it('pays mothers 1 egg and ₹0.84 potato on rice day', () => {
    for (const id of ['pregnant', 'nursing']) expect(perHead(id, 'rice')).toEqual({ egg: 8.5, veg: 0, potato: 0.84, chatu: 0 });
  });

  it('pays children ½ egg, ₹0.41 vegetables and ₹1.68 potato on khichuri day', () => {
    for (const id of ['child-6m-3y', 'child-3y-6y']) expect(perHead(id, 'khichuri')).toEqual({ egg: 4.25, veg: 0.41, potato: 1.68, chatu: 0 });
  });

  it('pays children 1 egg and ₹1.67 chatu (10 g at ₹167/kg) on rice day', () => {
    for (const id of ['child-6m-3y', 'child-3y-6y']) expect(perHead(id, 'rice')).toEqual({ egg: 8.5, veg: 0, potato: 0, chatu: 1.67 });
  });
});
