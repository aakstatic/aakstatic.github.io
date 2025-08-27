## CutieCart 💖

Playful mock shopping site (static) made for GitHub Pages.

Pages:
- `index.html`: homepage with product grid and carousel
- `checkout.html`: checkout with cute payment methods
- `confirm.html`: order confirmation with hearts confetti

### Run locally
Open `index.html` directly or use a static server (Live Server, `npx serve`, etc.).

### GitHub Pages
Push to `main` and enable Pages for the root (`/`). Site will be available at your repo URL.

### Email notifications (to Gmail)
This project uses EmailJS (client-side) to send order details.
1. Create an EmailJS account.
2. Add an email service connected to Gmail.
3. Create a template with variables: `to_email`, `order_id`, `buyer_name`, `buyer_email`, `payment_method`, `note`, `items`, `total`.
4. In `assets/js/config.js`, set:
   - `EMAILJS_PUBLIC_KEY`
   - `EMAILJS_SERVICE_ID`
   - `EMAILJS_TEMPLATE_ID`
   - `NOTIFY_EMAIL` (your Gmail)

If keys are left empty, email sending is skipped silently.

### Customize
- Edit products in `assets/js/app.js`.
- Update theme in `assets/css/style.css`.


