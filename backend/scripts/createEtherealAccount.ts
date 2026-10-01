import nodemailer from 'nodemailer';

// Creates a throwaway Ethereal inbox and prints the values to paste into backend/.env.
async function main(): Promise<void> {
  const account = await nodemailer.createTestAccount();
  console.log('Add these lines to backend/.env:\n');
  console.log(`SMTP_HOST=${account.smtp.host}`);
  console.log(`SMTP_PORT=${account.smtp.port}`);
  console.log(`SMTP_USER=${account.user}`);
  console.log(`SMTP_PASSWORD=${account.pass}`);
  console.log(`SMTP_FROM="Scheduled Email App <${account.user}>"`);
  console.log(`\nInbox: ${account.web} (log in with the user/password above)`);
}

main().catch((error) => {
  console.error('Could not create an Ethereal account (are you online?):', error);
  process.exitCode = 1;
});
