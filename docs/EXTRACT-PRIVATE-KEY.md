# How to Extract Firebase Private Key for Vercel

## From Firebase Service Account JSON File

If you have the Firebase service account JSON file downloaded from Firebase Console:

### Method 1: Use the Extraction Script (Recommended)

```bash
node scripts/extract-private-key.js path/to/your-service-account-key.json
```

This will:
- Extract the private key
- Show you exactly what to copy
- Show you the project ID and client email too

### Method 2: Manual Extraction

1. **Open your Firebase service account JSON file** (downloaded from Firebase Console)

2. **Find the `private_key` field** - it looks like this:
   ```json
   {
     "type": "service_account",
     "project_id": "...",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAOIBAQC...\n-----END PRIVATE KEY-----\n",
     "client_email": "...",
     ...
   }
   ```

3. **Copy the ENTIRE value** of `private_key` field:
   - Start from: `-----BEGIN PRIVATE KEY-----\n`
   - Include: All the encoded characters in between
   - End with: `\n-----END PRIVATE KEY-----\n`
   - **Include the quotes** - but when pasting into Vercel, DON'T include the quotes

4. **What to paste into Vercel:**
   ```
   -----BEGIN PRIVATE KEY-----
   MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAOIBAQC...
   (all the lines in between)
   -----END PRIVATE KEY-----
   ```

### Important Notes:

✅ **DO include:**
- `-----BEGIN PRIVATE KEY-----`
- All the encoded characters (usually 3-4 lines)
- `-----END PRIVATE KEY-----`

✅ **The `\n` escape sequences are OK** - Vercel will convert them to actual newlines

❌ **DON'T include:**
- The quotes around the value in JSON
- Any extra spaces or characters
- Only part of the key

### Example:

If your JSON has:
```json
"private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEA...\n-----END PRIVATE KEY-----\n"
```

Copy this (without quotes):
```
-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEA...
-----END PRIVATE KEY-----
```

### Quick Command Line Extraction:

If you have `jq` installed:
```bash
cat firebase-service-account.json | jq -r '.private_key'
```

Or with Node.js:
```bash
node -e "console.log(require('./firebase-service-account.json').private_key)"
```

Both will output the key ready to paste into Vercel.

## If Your Key is Base64 Encoded

If your private key is stored as base64 (unusual, but possible):

```bash
# Decode it
echo "YOUR_BASE64_STRING" | base64 -d

# Then copy the decoded output (should start with -----BEGIN PRIVATE KEY-----)
```

## Verification

After pasting into Vercel, verify:
- ✅ Starts with `-----BEGIN PRIVATE KEY-----`
- ✅ Ends with `-----END PRIVATE KEY-----`
- ✅ Contains encoded characters in between
- ✅ No extra quotes or spaces

Your code will automatically handle the `\n` escape sequences:
```typescript
privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
```

