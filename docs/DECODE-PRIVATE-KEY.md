# Decoding Firebase Private Key from Base64

If your Firebase private key is base64-encoded, here's how to decode it for Vercel:

## Quick Method (Terminal)

```bash
# Method 1: Decode and show (replace YOUR_BASE64_STRING)
echo "YOUR_BASE64_STRING" | base64 -d

# Method 2: Save to file
echo "YOUR_BASE64_STRING" | base64 -d > private-key-decoded.txt
```

## Using the Script

```bash
# Interactive mode
node scripts/decode-private-key.js

# Or pass the base64 string directly
node scripts/decode-private-key.js "YOUR_BASE64_STRING"
```

## Format for Vercel

The decoded private key should look like:
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
(multiple lines)
...
-----END PRIVATE KEY-----
```

**Important:** When pasting into Vercel:
- Keep the entire string including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Keep all the newlines (the script formats them with `\n` for Vercel)
- Vercel will automatically handle the `\n` escape sequences

## Step-by-Step Process

1. **Get your base64-encoded key** (from Firebase Console or wherever it's stored)

2. **Decode it:**
   ```bash
   echo "your-base64-string-here" | base64 -d
   ```

3. **Copy the decoded output** (should start with `-----BEGIN PRIVATE KEY-----`)

4. **Format for Vercel** (replace newlines with `\n`):
   ```bash
   echo "your-base64-string-here" | base64 -d | sed 's/$/\\n/' | tr -d '\n' | sed 's/\\n$//'
   ```
   
   Or use the script:
   ```bash
   echo "your-base64-string-here" | base64 -d | node -e "require('fs').readFileSync(0,'utf8').trim().split('\n').join('\\n')"
   ```

5. **Paste into Vercel** as `FIREBASE_ADMIN_PRIVATE_KEY`

## Example

If your base64 string is: `LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0t...`

```bash
# Decode
echo "LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0t..." | base64 -d

# Output will be:
# -----BEGIN PRIVATE KEY-----
# MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
# ...
# -----END PRIVATE KEY-----
```

Then copy that entire output (with BEGIN/END markers) and paste into Vercel.

## Alternative: Direct from Firebase JSON

If you have the Firebase service account JSON file:

```bash
# Extract private_key from JSON (already decoded)
cat firebase-service-account.json | jq -r '.private_key'

# This gives you the properly formatted key ready for Vercel
```

You can pipe this directly into Vercel's environment variable input.

