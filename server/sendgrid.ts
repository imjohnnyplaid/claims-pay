import sgMail from '@sendgrid/mail';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
    throw new Error('SendGrid not connected');
  }
  return {apiKey: connectionSettings.settings.api_key, email: connectionSettings.settings.from_email};
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableSendGridClient() {
  const {apiKey, email} = await getCredentials();
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: email
  };
}

export async function sendInvitationEmail(to: string, firstName: string, lastName: string, role: string, invitationLink: string, inviterName: string) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    
    const msg = {
      to,
      from: fromEmail,
      subject: `You've been invited to ClaimPay ${role === 'admin' ? 'Admin' : 'Bank'} Portal`,
      html: `
        <h2>ClaimPay Invitation</h2>
        <p>Hi ${firstName} ${lastName},</p>
        <p>${inviterName} has invited you to join the ClaimPay ${role === 'admin' ? 'Admin' : 'Bank Partner'} Portal.</p>
        <p>Click the link below to accept your invitation and create your account:</p>
        <p><a href="${invitationLink}" style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Accept Invitation</a></p>
        <p>This invitation will expire in 7 days.</p>
        <p>If you didn't expect this invitation, you can safely ignore this email.</p>
        <br>
        <p>Best regards,<br>The ClaimPay Team</p>
      `,
    };
    
    await client.send(msg);
    console.log(`Invitation email sent to ${to}`);
  } catch (error) {
    console.error('Error sending invitation email:', error);
    throw error;
  }
}

export async function sendApprovalRequestEmail(to: string, firstName: string, lastName: string, role: string, approvalLink: string, denyLink: string) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    
    const msg = {
      to,
      from: fromEmail,
      subject: `New ${role === 'admin' ? 'Admin' : 'Bank Partner'} Account Pending Approval`,
      html: `
        <h2>Account Approval Required</h2>
        <p>${firstName} ${lastName} has accepted their invitation and created an account.</p>
        <p>Please review and approve or deny their access:</p>
        <p>
          <a href="${approvalLink}" style="background: #00a86b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">Approve</a>
          <a href="${denyLink}" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Deny</a>
        </p>
        <p>You can also approve or deny this account from your dashboard.</p>
        <br>
        <p>Best regards,<br>The ClaimPay Team</p>
      `,
    };
    
    await client.send(msg);
    console.log(`Approval request email sent to ${to}`);
  } catch (error) {
    console.error('Error sending approval request email:', error);
    throw error;
  }
}

export async function sendAccountApprovedEmail(to: string, firstName: string, role: string, loginLink: string) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    
    const msg = {
      to,
      from: fromEmail,
      subject: `Your ClaimPay Account Has Been Approved`,
      html: `
        <h2>Account Approved!</h2>
        <p>Hi ${firstName},</p>
        <p>Great news! Your ClaimPay ${role === 'admin' ? 'Admin' : 'Bank Partner'} account has been approved.</p>
        <p>You can now log in to access your dashboard:</p>
        <p><a href="${loginLink}" style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Log In Now</a></p>
        <p>Use the email address and password you created during registration to sign in.</p>
        <br>
        <p>Best regards,<br>The ClaimPay Team</p>
      `,
    };
    
    await client.send(msg);
    console.log(`Account approved email sent to ${to}`);
  } catch (error) {
    console.error('Error sending account approved email:', error);
    throw error;
  }
}

export async function sendAccountRejectedEmail(to: string, firstName: string) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    
    const msg = {
      to,
      from: fromEmail,
      subject: `ClaimPay Account Application Update`,
      html: `
        <h2>Account Application Update</h2>
        <p>Hi ${firstName},</p>
        <p>Thank you for your interest in joining ClaimPay. Unfortunately, your account application was not approved at this time.</p>
        <p>If you have questions or believe this was an error, please contact your administrator.</p>
        <br>
        <p>Best regards,<br>The ClaimPay Team</p>
      `,
    };
    
    await client.send(msg);
    console.log(`Account rejected email sent to ${to}`);
  } catch (error) {
    console.error('Error sending account rejected email:', error);
    throw error;
  }
}
