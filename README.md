# Grocery Tracker

Upload a receipt and have items parsed out.

## To do

### General

- [x] Sign in with Google
- [x] Show Google profile icon
- [x] Change icon to grocery cart or something simmilar
- [ ] Change Google sign-in to be more branded
- [ ] Add ability to search through purchased items by keyword

### Receipts

- [x] Upload a receipt and view past receipts
- [x] Parse a receipt and insert grocery items into database
- [x] Parse a receipt on upload
- [x] CRUD on parsed items
- [x] Add brand and generic name for items to help with analytics, as well as 'variant'

| Brand Name (optional) | Generic Name    | Variant  |
| --------------------- | --------------- | -------- |
| Kraft                 | Shredded Cheese | Cheddar  |
| Food Lion             | Mushrooms       | Shiitake |

- [ ] Add ability to link items, so no matter what store 'Kraft Cheddar Shredded Cheese' remains the same (ADDED not tested)

### Analytics

- [x] Create analytics page so users can view basic stats about their shopping (most visited store, top spending category, est. savings, etc.)
- [x] Create 'Spending by store' graph
- [x] Create 'Spending by category' graph
- [x] Create 'Spending over time' graph
- [ ] Allow users to select a store and receive store-specific stats
- [x] Allow users to filter purchased items by 'generic name' (lunch meat) and 'brand' (Oscar Mayer) to see how often they buy those items
- [ ] Allow users to view by month/year to see change over time

### Admin

- [x] Let admins add and edit stores (logo, color)
- [ ] Make it so not everyone is an admin
