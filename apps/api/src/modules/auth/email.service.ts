import nodemailer from 'nodemailer';

interface SendMagicLinkEmailOptions {
  to: string;
  magicUrl: string;
}

export async function sendMagicLinkEmail({ to, magicUrl }: SendMagicLinkEmailOptions): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const brevoApiKey = process.env.BREVO_API_KEY;

  const smtpHost = process.env.SMTP_HOST || (process.env.GMAIL_USER ? 'smtp.gmail.com' : undefined);
  const smtpPort = Number(process.env.SMTP_PORT || (process.env.GMAIL_USER ? 465 : 587));
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  const fromEmail =
    process.env.EMAIL_FROM ||
    (smtpUser ? `"Prosperity CRM" <${smtpUser}>` : 'Prosperity CRM <onboarding@resend.dev>');

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
      <div style="margin-bottom: 24px;">
        <h2 style="color: #111827; font-size: 22px; font-weight: 700; margin: 0 0 8px 0;">Sign in to Prosperity CRM</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.5; margin: 0;">Click the button below to sign in instantly. This link will expire in 15 minutes.</p>
      </div>
      <div style="margin: 32px 0;">
        <a href="${magicUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; display: inline-block;">
          Sign In to Prosperity CRM
        </a>
      </div>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">Or copy and paste this link in your browser:<br/><a href="${magicUrl}" style="color: #2563eb; word-break: break-all;">${magicUrl}</a></p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 16px 0;" />
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">If you did not request this link, you can safely ignore this email.</p>
    </div>
  `;

  // 1. Resend API (Most popular modern transactional API)
  if (resendApiKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: 'Your Prosperity CRM Sign-In Link',
        html: htmlContent,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Resend API error (${res.status}): ${errBody}`);
    }
    return;
  }

  // 2. SMTP / Gmail App Password via Nodemailer (100% free with any email account)
  if (smtpHost && smtpUser && smtpPass) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: fromEmail,
      to,
      subject: 'Your Prosperity CRM Sign-In Link',
      html: htmlContent,
    });
    return;
  }

  // 3. Brevo API (Free 300 emails/day)
  if (brevoApiKey) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: fromEmail.includes('<') ? fromEmail.match(/<([^>]+)>/)?.[1] : fromEmail, name: 'Prosperity CRM' },
        to: [{ email: to }],
        subject: 'Your Prosperity CRM Sign-In Link',
        htmlContent,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Brevo API error (${res.status}): ${errBody}`);
    }
    return;
  }

  // If in production and no email provider is configured, do not pretend it succeeded
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Email provider not configured. Please add RESEND_API_KEY, GMAIL credentials, or SMTP settings in your Render environment.'
    );
  }

  // In development, log to terminal
  console.log(`\n========================================`);
  console.log(`✨ [Magic Link] Sign-in link for: ${to}`);
  console.log(`🔗 URL: ${magicUrl}`);
  console.log(`========================================\n`);
}
