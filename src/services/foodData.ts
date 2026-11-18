import type { GroceryCategory } from '../types/health';

export const highSugarFoods = [
  'sweet',
  'sweets',
  'cake',
  'ice cream',
  'jaggery',
  'gulab jamun',
  'payasam',
  'chocolate',
  'sugar',
  'halwa',
  'laddu',
  'mysore pak',
  'kesari',
  'large white rice',
  'white rice',
  'sweet pongal',
  'jalebi',
  'kheer',
];

export const highSaltFoods = [
  'pickle',
  'chips',
  'papad',
  'appalam',
  'instant noodles',
  'salted snacks',
  'processed meat',
  'mixture',
  'salted nuts',
  'namkeen',
  'french fries',
  'soy sauce',
];

export const highOilFoods = [
  'deep fried',
  'vada',
  'medu vada',
  'bajji',
  'samosa',
  'poori',
  'fried chicken',
  'bonda',
  'pakoda',
  'parotta',
  'bhatura',
  'biriyani',
];

export const quickAddFoods = [
  'Idli',
  'Dosa',
  'Sambar',
  'Rice',
  'Chapati',
  'Pongal',
  'Upma',
  'Curd Rice',
  'Ragi Koozh',
  'Oats Porridge',
  'Vegetable Kootu',
  'Dal Tadka',
  'Rasam',
  'Sprouts Salad',
  'Biriyani',
  'Vada',
  'Samosa',
  'Pickle',
  'Chips',
  'Sweets',
  'Payasam',
  'Ice Cream',
];

export interface IngredientMapping {
  name: string;
  category: GroceryCategory;
}

export const MEAL_INGREDIENT_MAP: Record<string, IngredientMapping[]> = {
  idli: [
    { name: 'Idli Rice', category: 'Grains' },
    { name: 'Urad Dal', category: 'Grains' },
  ],
  dosa: [
    { name: 'Dosa Batter / Rice & Urad Dal', category: 'Grains' },
  ],
  sambar: [
    { name: 'Toor Dal', category: 'Grains' },
    { name: 'Drumstick & Carrot', category: 'Vegetables' },
    { name: 'Tomatoes', category: 'Vegetables' },
    { name: 'Onions', category: 'Vegetables' },
    { name: 'Tamarind & Sambar Powder', category: 'Others' },
  ],
  rice: [
    { name: 'Ponni / Brown Rice', category: 'Grains' },
  ],
  'white rice': [
    { name: 'Steamed Rice', category: 'Grains' },
  ],
  chapati: [
    { name: 'Whole Wheat Atta', category: 'Grains' },
  ],
  pongal: [
    { name: 'Moong Dal', category: 'Grains' },
    { name: 'Raw Rice', category: 'Grains' },
    { name: 'Ghee & Pepper', category: 'Dairy' },
  ],
  upma: [
    { name: 'Rava / Semolina', category: 'Grains' },
    { name: 'Green Peas & Beans', category: 'Vegetables' },
  ],
  'curd rice': [
    { name: 'Fresh Curd / Yogurt', category: 'Dairy' },
    { name: 'Pomegranate & Curry Leaves', category: 'Vegetables' },
  ],
  'ragi koozh': [
    { name: 'Ragi (Finger Millet) Flour', category: 'Grains' },
    { name: 'Buttermilk', category: 'Dairy' },
  ],
  'oats porridge': [
    { name: 'Rolled Oats', category: 'Grains' },
    { name: 'Low-fat Milk', category: 'Dairy' },
  ],
  'vegetable kootu': [
    { name: 'Bottle Gourd / Snake Gourd', category: 'Vegetables' },
    { name: 'Chana Dal', category: 'Grains' },
  ],
  'dal tadka': [
    { name: 'Yellow Moong / Toor Dal', category: 'Grains' },
    { name: 'Garlic & Spinach', category: 'Vegetables' },
  ],
  rasam: [
    { name: 'Tomatoes', category: 'Vegetables' },
    { name: 'Coriander Leaves', category: 'Vegetables' },
    { name: 'Pepper & Cumin', category: 'Others' },
  ],
  'sprouts salad': [
    { name: 'Green Moong Sprouts', category: 'Grains' },
    { name: 'Cucumber & Lemon', category: 'Vegetables' },
  ],
  biriyani: [
    { name: 'Basmati Rice', category: 'Grains' },
    { name: 'Mint & Coriander', category: 'Vegetables' },
    { name: 'Curd', category: 'Dairy' },
    { name: 'Whole Spices', category: 'Others' },
  ],
};

export function inferCategoryForItem(itemName: string): GroceryCategory {
  const lower = itemName.toLowerCase();
  if (/(milk|curd|yogurt|paneer|ghee|butter|cheese|buttermilk)/.test(lower)) return 'Dairy';
  if (/(tomato|onion|carrot|spinach|cucumber|beans|peas|gourd|coriander|vegetable|mint|drumstick|lemon|garlic|potato|greens|keerai)/.test(lower)) {
    return 'Vegetables';
  }
  if (/(rice|dal|atta|wheat|oats|ragi|millet|rava|semolina|flour|bread|sprouts)/.test(lower)) {
    return 'Grains';
  }
  return 'Others';
}
