import { NextRequest, NextResponse } from 'next/server';

/**
 * Diagnostic endpoint to check Firebase Admin configuration
 * Helps identify what's wrong with the setup
 */
export async function GET(req: NextRequest) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      hasProjectId: !!projectId,
      hasClientEmail: !!clientEmail,
      hasPrivateKey: !!privateKey,
    },
    details: {
      projectId: projectId ? `${projectId.substring(0, 10)}...` : 'NOT SET',
      clientEmail: clientEmail ? `${clientEmail.substring(0, 20)}...` : 'NOT SET',
      privateKeyLength: privateKey ? privateKey.length : 0,
      privateKeyStartsWith: privateKey ? privateKey.substring(0, 30) : 'NOT SET',
      privateKeyEndsWith: privateKey ? privateKey.substring(privateKey.length - 30) : 'NOT SET',
    },
    validation: {
      projectIdFormat: projectId ? '✓ Valid format' : '✗ Missing',
      clientEmailFormat: clientEmail?.includes('@') ? '✓ Valid format' : clientEmail ? '⚠ Check format' : '✗ Missing',
      privateKeyFormat: privateKey?.includes('BEGIN PRIVATE KEY') ? '✓ Has BEGIN marker' : privateKey ? '⚠ Missing BEGIN marker' : '✗ Missing',
      privateKeyEndMarker: privateKey?.includes('END PRIVATE KEY') ? '✓ Has END marker' : privateKey ? '⚠ Missing END marker' : '✗ Missing',
      privateKeyHasNewlines: privateKey?.includes('\n') || privateKey?.includes('\\n') ? '✓ Has newlines' : privateKey ? '⚠ No newlines detected' : '✗ Missing',
    },
    commonIssues: [] as string[],
  };

  // Check for common issues
  if (!projectId) {
    diagnostics.commonIssues.push('FIREBASE_ADMIN_PROJECT_ID is not set in Vercel environment variables');
  }
  if (!clientEmail) {
    diagnostics.commonIssues.push('FIREBASE_ADMIN_CLIENT_EMAIL is not set in Vercel environment variables');
  }
  if (!privateKey) {
    diagnostics.commonIssues.push('FIREBASE_ADMIN_PRIVATE_KEY is not set in Vercel environment variables');
  } else {
    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      diagnostics.commonIssues.push('FIREBASE_ADMIN_PRIVATE_KEY is missing the BEGIN marker - make sure you copied the entire key including -----BEGIN PRIVATE KEY-----');
    }
    if (!privateKey.includes('END PRIVATE KEY')) {
      diagnostics.commonIssues.push('FIREBASE_ADMIN_PRIVATE_KEY is missing the END marker - make sure you copied the entire key including -----END PRIVATE KEY-----');
    }
    if (!privateKey.includes('\n') && !privateKey.includes('\\n')) {
      diagnostics.commonIssues.push('FIREBASE_ADMIN_PRIVATE_KEY appears to have no newlines - Vercel should handle this automatically, but verify the key format');
    }
  }

  const allSet = projectId && clientEmail && privateKey;
  const allValid = allSet && 
    privateKey.includes('BEGIN PRIVATE KEY') && 
    privateKey.includes('END PRIVATE KEY');

  return NextResponse.json({
    status: allValid ? 'ready' : 'issues_found',
    message: allValid 
      ? 'Firebase Admin credentials appear to be configured correctly' 
      : 'Firebase Admin credentials have issues - see diagnostics below',
    diagnostics,
    instructions: allValid ? [] : [
      '1. Go to Firebase Console → Project Settings → Service Accounts',
      '2. Click "Generate new private key"',
      '3. Download the JSON file',
      '4. In Vercel Dashboard → Your Project → Settings → Environment Variables, set:',
      '   - FIREBASE_ADMIN_PROJECT_ID = value from "project_id" in JSON',
      '   - FIREBASE_ADMIN_CLIENT_EMAIL = value from "client_email" in JSON',
      '   - FIREBASE_ADMIN_PRIVATE_KEY = value from "private_key" in JSON (paste entire multi-line key)',
      '5. Redeploy your application',
      '',
      'Note: Vercel handles multi-line keys automatically - you can paste the key directly with newlines.',
    ],
  });
}

export const dynamic = 'force-dynamic';

