import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'sujalmehta.prof@gmail.com',
    pass: process.env.EMAIL_PASS || 'zyol dwey lgzi dcox',
  },
});

export async function sendOtpEmail(to: string, otp: string) {
  const mailOptions = {
    from: '"MedHub" <sujalmehta.prof@gmail.com>',
    to: to,
    subject: 'MedHub Account Verification OTP',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0ea5e9; text-align: center;">MedHub Verification Code</h2>
        <p>Hello,</p>
        <p>Thank you for registering with MedHub. Please use the following 6-digit One-Time Password (OTP) to complete your registration:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; background-color: #f0f9ff; padding: 10px 20px; border: 1px solid #bae6fd; color: #0ea5e9; border-radius: 6px;">${otp}</span>
        </div>
        <p>This code is valid for 10 minutes. Please do not share this code with anyone.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">This is an automated message, please do not reply directly to this email.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
}

export async function sendResetPasswordEmail(to: string, tempPassword: string) {
  const mailOptions = {
    from: '"MedHub" <sujalmehta.prof@gmail.com>',
    to: to,
    subject: 'MedHub Password Recovery Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0ea5e9; text-align: center;">MedHub Password Recovery</h2>
        <p>Hello,</p>
        <p>A password recovery request was initiated for your MedHub account. Use the following temporary passcode to log in:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 24px; font-weight: bold; letter-spacing: 2px; background-color: #fff7ed; padding: 10px 20px; border: 1px solid #fed7aa; color: #f97316; border-radius: 6px; font-family: monospace;">${tempPassword}</span>
        </div>
        <p style="color: #ef4444; font-weight: bold;">You will be prompted to choose a new password immediately upon logging in with this temporary passcode.</p>
        <p>If you did not request a password reset, please secure your account immediately.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">This is an automated message, please do not reply directly to this email.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
}

export async function sendInvoiceEmail(to: string, order: any) {
  const itemsHtml = order.items.map((item: any) => {
    const totalPerBox = item.product.tabletsPerStrip * item.product.stripsPerBox;
    const qtyBoxes = item.quantity / totalPerBox;
    const pricePerBox = item.pricePerUnit * totalPerBox;
    const subtotal = item.quantity * item.pricePerUnit;
    return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${item.product.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${qtyBoxes.toFixed(1)} Boxes</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">Rs. ${pricePerBox.toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">Rs. ${subtotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const mailOptions = {
    from: '"MedHub" <sujalmehta.prof@gmail.com>',
    to: to,
    subject: `Digital Tax Invoice - MedHub Order #${order.id.substring(0, 8).toUpperCase()}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0ea5e9; padding-bottom: 15px; margin-bottom: 25px;">
          <div>
            <h1 style="color: #0ea5e9; margin: 0; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">MedHub</h1>
            <span style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Digital Invoice</span>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 13px; font-weight: 700; color: #1e293b;">Invoice: #${order.id.substring(0, 8).toUpperCase()}</p>
            <p style="margin: 3px 0 0; font-size: 11px; color: #64748b;">Date: ${new Date(order.createdAt).toLocaleDateString('en-US', { dateStyle: 'long' })}</p>
          </div>
        </div>

        <!-- Addresses -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; font-size: 12px; line-height: 1.5; color: #475569;">
          <div>
            <strong style="color: #0ea5e9; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Issued By:</strong>
            <p style="margin: 5px 0 0; font-weight: 700; color: #1e293b; font-size: 13px;">${order.wholesaler.companyName}</p>
            <p style="margin: 3px 0 0;">PAN/VAT: ${order.wholesaler.taxId}</p>
            <p style="margin: 3px 0 0;">${order.wholesaler.address}</p>
            <p style="margin: 3px 0 0;">Phone: ${order.wholesaler.phone}</p>
          </div>
          <div style="text-align: right;">
            <strong style="color: #0ea5e9; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Billed To:</strong>
            <p style="margin: 5px 0 0; font-weight: 700; color: #1e293b; font-size: 13px;">${order.retailer.pharmacyName}</p>
            <p style="margin: 3px 0 0;">License: ${order.retailer.registrationNumber}</p>
            <p style="margin: 3px 0 0;">${order.retailer.address}</p>
            <p style="margin: 3px 0 0;">Phone: ${order.retailer.phone}</p>
          </div>
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 25px;">
          <thead>
            <tr style="background-color: #f8fafc;">
              <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: left; color: #475569; font-weight: 700;">Product Name</th>
              <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: center; color: #475569; font-weight: 700;">Qty</th>
              <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: right; color: #475569; font-weight: 700;">Price/Box</th>
              <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: right; color: #475569; font-weight: 700;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <!-- Totals -->
        <div style="border-top: 2px solid #e2e8f0; padding-top: 15px; margin-bottom: 30px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #475569;">
            <span>Subtotal</span>
            <span>Rs. ${order.totalAmount.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #10b981; font-weight: 600;">
            <span>Discount Applied</span>
            <span>- Rs. ${order.discountAmount.toFixed(2)}</span>
          </div>
          ${order.advanceApplied > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #6366f1;">
              <span>Advance Balance Applied</span>
              <span>- Rs. ${order.advanceApplied.toFixed(2)}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; margin-top: 12px; padding-top: 12px; border-top: 1px dashed #e2e8f0; font-size: 16px; font-weight: 800; color: #1e293b;">
            <span>Grand Total</span>
            <span style="color: #0ea5e9;">Rs. ${order.netAmount.toFixed(2)}</span>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 11px; color: #94a3b8; line-height: 1.5;">
          <p style="margin: 0; font-weight: 600;">Thank you for your business!</p>
          <p style="margin: 5px 0 0;">This is a digitally generated invoice dispatched securely via MedHub.</p>
        </div>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
}

export async function sendConsumerOrderConfirmation(to: string, order: any) {
  const itemsHtml = order.items.map((item: any) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${item.product.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity} units</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">Rs. ${item.pricePerUnit.toFixed(2)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">Rs. ${(item.quantity * item.pricePerUnit).toFixed(2)}</td>
    </tr>
  `).join('');

  const mailOptions = {
    from: '"MedHub" <sujalmehta.prof@gmail.com>',
    to: to,
    subject: `Order Confirmation - Tracker: ${order.trackingCode}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0ea5e9; text-align: center;">Order Confirmed!</h2>
        <p>Hello <strong>${order.buyerName}</strong>,</p>
        <p>Your order has been successfully placed at <strong>${order.retailer.pharmacyName}</strong>.</p>
        <p><strong>Tracking Code:</strong> <span style="font-family: monospace; font-size: 16px; background: #f0f9ff; padding: 4px 8px; border: 1px solid #bae6fd; border-radius: 4px; color: #0ea5e9; font-weight: bold;">${order.trackingCode}</span></p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0;">Medicine</th>
              <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e2e8f0;">Qty</th>
              <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e2e8f0;">Unit Price</th>
              <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e2e8f0;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div style="text-align: right; margin-top: 15px; font-size: 15px; font-weight: bold; color: #1e293b;">
          Total Payable (COD): Rs. ${order.totalAmount.toFixed(2)}
        </div>
        
        <div style="margin-top: 20px; padding: 12px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; font-size: 12px; color: #b45309;">
          📍 <strong>Delivery Address:</strong> ${order.deliveryAddress}<br/>
          📞 <strong>Phone:</strong> ${order.buyerPhone}
        </div>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">You can track this order on the MedHub landing page using your unique code.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
}

export async function sendConsumerOrderStatusUpdate(to: string, order: any, newStatus: string) {
  const mailOptions = {
    from: '"MedHub" <sujalmehta.prof@gmail.com>',
    to: to,
    subject: `Order Status Update [${newStatus}] - Tracker: ${order.trackingCode}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0ea5e9; text-align: center;">Order Status: ${newStatus}</h2>
        <p>Hello <strong>${order.buyerName}</strong>,</p>
        <p>The status of your order <strong>${order.trackingCode}</strong> has changed.</p>
        
        <div style="text-align: center; margin: 25px 0;">
          <span style="font-size: 18px; font-weight: bold; background-color: #f0fdf4; padding: 10px 20px; border: 1px solid #bbf7d0; color: #16a34a; border-radius: 6px; text-transform: uppercase;">
            ${newStatus}
          </span>
        </div>
        
        <p><strong>Pharmacy:</strong> ${order.retailer.pharmacyName}</p>
        <p><strong>Total Amount:</strong> Rs. ${order.totalAmount.toFixed(2)} (${order.paymentMethod})</p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">Thank you for choosing MedHub!</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
}

