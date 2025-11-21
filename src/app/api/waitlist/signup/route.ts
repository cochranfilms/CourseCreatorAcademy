import { NextRequest, NextResponse } from 'next/server';
import { checkDuplicateEmail, appendWaitlistRow } from '@/lib/googleSheets';
import { sendEmailJS } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { email, name, phone, link, excitement } = await req.json();

    // Validate required fields
    if (!email || !name || !phone || !link || !excitement) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(link);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format for link' },
        { status: 400 }
      );
    }

    // Check for duplicate email
    try {
      const isDuplicate = await checkDuplicateEmail(email);
      if (isDuplicate) {
        return NextResponse.json(
          { error: 'This email is already registered' },
          { status: 400 }
        );
      }
    } catch (error: any) {
      console.error('Error checking duplicate:', error);
      return NextResponse.json(
        { error: 'Failed to check for duplicate email' },
        { status: 500 }
      );
    }

    // Append to Google Sheet
    try {
      await appendWaitlistRow({
        email,
        name,
        phone,
        link,
        excitement,
      });
    } catch (error: any) {
      console.error('Error appending to sheet:', error);
      return NextResponse.json(
        { error: 'Failed to save signup. Please try again.' },
        { status: 500 }
      );
    }

    // Send confirmation email via EmailJS
    try {
      const templateId = process.env.EMAILJS_TEMPLATE_ID_WAITLIST;
      if (templateId) {
        await sendEmailJS(templateId, {
          user_name: name,
          user_email: email,
          excitement: excitement,
          confirmation_message: 'Thank you for joining our waitlist! We\'ll notify you when we launch.',
          to_email: email,
          name: 'Course Creator Academy',
          year: new Date().getFullYear().toString(),
        });
      }
    } catch (error: any) {
      // Don't fail the request if email fails, just log it
      console.error('Failed to send confirmation email:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully joined the waitlist!',
    });
  } catch (error: any) {
    console.error('Error processing waitlist signup:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process signup' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

