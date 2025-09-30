# SECURITY NOTICE

## IMPORTANT: Webhook URLs Were Exposed

During the development process, your N8N webhook URLs were temporarily committed to the `.env.production.example` file:

- N8N_WEBHOOK_URL: `https://n8n.srv937238.hstgr.cloud/webhook/226162b3-XXXX-XXXX-XXXX-XXXXXXXXXXXX` (redacted)
- N8N_BIRTHDAY_WEBHOOK_URL: `https://n8n.srv937238.hstgr.cloud/webhook/8034999b-XXXX-XXXX-XXXX-XXXXXXXXXXXX` (redacted)

**Note:** The actual webhook IDs have been redacted from this document for security reasons.

## Required Actions

### 1. Rotate Your Webhook URLs (CRITICAL)

Since these webhook URLs have been exposed, you should regenerate them in n8n to prevent unauthorized access:

1. Log in to your n8n instance at `https://n8n.srv937238.hstgr.cloud`
2. Navigate to each webhook workflow
3. Generate new webhook URLs for both:
   - WhatsApp booking integration
   - Birthday wishes automation
4. Update your production `.env` file with the new webhook URLs
5. Restart your application

### 2. Update Your .env File

After rotating the webhooks, update your `.env` file with the new URLs:

```bash
# New webhook URLs (after rotation)
N8N_WEBHOOK_URL=https://n8n.srv937238.hstgr.cloud/webhook/YOUR_NEW_WEBHOOK_ID
N8N_BIRTHDAY_WEBHOOK_URL=https://n8n.srv937238.hstgr.cloud/webhook/YOUR_NEW_WEBHOOK_ID
```

### 3. Additional Security Recommendations

- **Never commit** `.env` files to version control
- Keep `.env` in your `.gitignore` file (already configured)
- Use strong, randomly generated values for `SESSION_SECRET` and `PGPASSWORD`
- Regularly rotate secrets and webhook URLs
- Monitor your n8n logs for any suspicious activity

## What Was Fixed

The `.env.production.example` file has been updated to use placeholder values instead of real credentials. Future deployments should use this template and fill in actual values only in the production `.env` file (which is not committed to git).

## Questions?

If you need help rotating the webhook URLs or have security concerns, please consult your n8n documentation or contact your security team.
