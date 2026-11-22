# Sent by Sahen: ordering website

Free to host. No build step, just files.

## 1. Try it now (demo mode)
Open `index.html` through any static server (or after you upload it, see step 3).
With no keys in `js/config.js`, orders are saved only in your own browser. Open `admin.html` to see them.

## 2. Turn on real orders (Supabase, free)
1. Make a free project at supabase.com.
2. SQL Editor, New query, paste everything from `supabase/setup.sql`, Run.
3. Authentication > Users > Add user (your email + a strong password). This is your owner login.
4. Authentication > Sign In / Providers: turn OFF "Allow new users to sign up".
5. Project Settings > API: copy the Project URL and the `anon` public key into `js/config.js`
   (`supabaseUrl`, `supabaseAnonKey`). The anon key is meant to be public.
6. Note: free Supabase projects pause after about a week with no activity. Open the admin page now and then.

## 3. Put it online (free)
GitHub Pages: make a repo, upload all files in this folder, Settings > Pages > deploy from `main`.
Your shop is `index.html`, your orders page is `/admin.html`.

## Things you can edit in `js/config.js`
Prices, 70/30 rate, thread colors, free texts, custom text fees, IG handle.
Replace `assets/gcash-qr.png` if your QR changes.

## Notes
- Stitched letters use your own alphabet (traced from the charts you sent). Template 1's calendar, box and halftone colors are fixed (see `template1` in `config.js`). Thread colors only change the stitched text.
- Customized text fee: 5-7 letters +150, 8-10 +200, 11 letters +250, then +7 for every extra letter. Spaces don't count. Symbols count as 1 letter each.
- After the background is removed, customers can slide "keep more / keep less" and touch it up by hand.
- 1 to 4 customized characters were not in your price list, so they use the +150 tier. Change `customTiers`.
- The background remover downloads a free AI model (about 25 MB) in the customer's browser the first time. It needs internet.
- Delivery fee is never computed by the site, it is only a notice.
