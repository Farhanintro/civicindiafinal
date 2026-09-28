import "server-only";
import nodemailer from "nodemailer";

function getMailConfig() {
  // Preferred names
  const user =
    process.env.GMAIL_USER ||
    process.env.EMAIL_USER;

  const pass =
    process.env.GMAIL_APP_PASS ||
    process.env.EMAIL_PASS ||
    process.env.GMAIL_PASS;

  if (!user) {
    throw new Error(
      "Missing GMAIL_USER environment variable."
    );
  }

  if (!pass) {
    throw new Error(
      "Missing GMAIL_APP_PASS environment variable."
    );
  }

  return {
    user,
    pass,
  };
}

function createTransporter() {
  const { user, pass } = getMailConfig();

  return nodemailer.createTransport({
    service: "gmail",

    auth: {
      user,
      pass,
    },

    // Fail reasonably quickly instead of hanging the signup request.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

export async function sendVerificationEmail(
  toEmail: string,
  token: string
): Promise<void> {
  const { user } = getMailConfig();

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";

  const cleanBaseUrl = baseUrl.replace(/\/+$/, "");

  const verifyUrl =
    `${cleanBaseUrl}/api/auth/verify?token=` +
    encodeURIComponent(token);

  const transporter = createTransporter();

  // Verify SMTP credentials before attempting delivery.
  await transporter.verify();

  await transporter.sendMail({
    from: `"Civic India" <${user}>`,
    to: toEmail,

    subject: "Verify your Civic India account",

    text: `
Welcome to Civic India!

Please verify your email address by opening this link:

${verifyUrl}

This verification link expires in 24 hours.

If you did not create a Civic India account, you can safely ignore this email.
`.trim(),

    html: `
      <div
        style="
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            'Segoe UI',
            Roboto,
            Helvetica,
            Arial,
            sans-serif;
          max-width: 560px;
          margin: 0 auto;
          padding: 28px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background-color: #ffffff;
        "
      >
        <div style="margin-bottom: 20px;">
          <h2
            style="
              color: #0f766e;
              margin: 0;
              font-size: 22px;
            "
          >
            Civic India
          </h2>

          <p
            style="
              color: #64748b;
              font-size: 13px;
              margin-top: 4px;
            "
          >
            AI-Powered Civic Issue Intelligence
          </p>
        </div>

        <p
          style="
            color: #1e293b;
            font-size: 15px;
            line-height: 1.6;
          "
        >
          Thank you for registering with Civic India.
          Please confirm your email address to activate your
          citizen account.
        </p>

        <div style="margin: 28px 0;">
          <a
            href="${verifyUrl}"
            style="
              background-color: #0f766e;
              color: #ffffff;
              padding: 12px 24px;
              border-radius: 8px;
              text-decoration: none;
              font-weight: 600;
              font-size: 14px;
              display: inline-block;
            "
          >
            Verify Email Address
          </a>
        </div>

        <p
          style="
            color: #64748b;
            font-size: 13px;
            line-height: 1.5;
          "
        >
          Or copy and paste this link into your browser:
        </p>

        <p
          style="
            font-size: 13px;
            line-height: 1.5;
            word-break: break-all;
          "
        >
          <a
            href="${verifyUrl}"
            style="color: #0f766e;"
          >
            ${verifyUrl}
          </a>
        </p>

        <hr
          style="
            border: none;
            border-top: 1px solid #e2e8f0;
            margin: 24px 0;
          "
        />

        <p
          style="
            color: #94a3b8;
            font-size: 12px;
            margin: 0;
          "
        >
          This verification link expires in 24 hours.
          If you did not create an account on Civic India,
          you can safely ignore this email.
        </p>
      </div>
    `,
  });
}