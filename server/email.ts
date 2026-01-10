// Resend integration for email notifications
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  'assedio': 'Assédio',
  'iluminacao_precaria': 'Iluminação Precária',
  'deserto': 'Lugar Deserto',
  'abrigo_seguro': 'Abrigo Seguro',
  'outro': 'Outro'
};

export async function sendNewReportNotification(
  adminEmail: string,
  report: {
    type: string;
    description: string;
    severity: number;
    lat: number;
    lng: number;
  }
) {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const typeLabel = REPORT_TYPE_LABELS[report.type] || report.type;
    const googleMapsLink = `https://www.google.com/maps?q=${report.lat},${report.lng}`;
    
    await client.emails.send({
      from: fromEmail,
      to: adminEmail,
      subject: `[CaminhoSeguro] Novo Relato: ${typeLabel}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7c3aed;">Novo Relato no CaminhoSeguro</h2>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Tipo:</strong> ${typeLabel}</p>
            <p><strong>Gravidade:</strong> ${report.severity}/5</p>
            <p><strong>Descrição:</strong> ${report.description}</p>
            <p><strong>Localização:</strong> <a href="${googleMapsLink}" target="_blank">Ver no Google Maps</a></p>
          </div>
          
          <p style="color: #666; font-size: 12px;">
            Este email foi enviado automaticamente pelo sistema CaminhoSeguro.
          </p>
        </div>
      `
    });
    
    console.log(`Email notification sent to ${adminEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send email notification:', error);
    return false;
  }
}
