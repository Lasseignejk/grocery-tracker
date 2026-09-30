// Item categories. Shared by the add/edit item forms and the receipt parser's
// JSON schema, so the model can only return values the UI knows about.
export const CATEGORIES = [
  'bakery',
  'beverages',
  'bread',
  'cans',
  'dairy and eggs',
  'frozen',
  'household',
  'meat',
  'personal-care',
  'pet',
  'produce',
  'snacks',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];
