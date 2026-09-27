import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST || "smtp.ethereal.email";
const smtpPort = Number(process.env.SMTP_PORT || "587");

const smtpSecure =
  process.env.SMTP_SECURE === "true";

const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;

const smtpFrom =
  process.env.SMTP_FROM ||
  smtpUser ||
  "ReachInbox <no-reply@reachinbox.local>";

const createTransporter = async () => {
  if (smtpUser && smtpPassword) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPassword
      }
    });
  }

  console.log(
    "[Email Service] SMTP credentials not configured. Creating Ethereal test account..."
  );

  const testAccount = await nodemailer.createTestAccount();

  console.log(
    `[Email Service] Ethereal account created: ${testAccount.user}`
  );

  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });
};

const transporterPromise = createTransporter();

export interface SendEmailInput {
  to: string;
  toName?: string | null;
  subject: string;
  body: string;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl?: string;
}

export const sendEmail = async (
  input: SendEmailInput
): Promise<SendEmailResult> => {
  const transporter = await transporterPromise;

  const result = await transporter.sendMail({
    from: smtpFrom,
    to: input.toName
      ? `"${input.toName}" <${input.to}>`
      : input.to,
    subject: input.subject,
    text: input.body,
    html: input.body.replace(/\n/g, "<br />")
  });

  const previewUrl = nodemailer.getTestMessageUrl(result);

  return {
    messageId: result.messageId,
    previewUrl: previewUrl || undefined
  };
};

export const verifyEmailTransport = async (): Promise<void> => {
  const transporter = await transporterPromise;

  await transporter.verify();

  console.log(
    "[Email Service] SMTP transport verified successfully."
  );
};
