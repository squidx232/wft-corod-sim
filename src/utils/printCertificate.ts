/**
 * Dedicated certificate printing.
 *
 * Instead of calling window.print() on the whole app (which prints the entire
 * screen across several pages), we open a clean popup window containing ONLY a
 * formal, self-contained certificate document and print that. This guarantees a
 * single, well-formatted page regardless of the app's on-screen layout.
 */

export interface CertificateField {
  label: string;
  value: string;
  /** Optional accent colour for the value (e.g. score green/amber). */
  accent?: string;
}

export interface CertificateSpec {
  /** Small eyebrow line, e.g. "CERTIFICATE OF OPERATIONAL COMPETENCY". */
  eyebrow: string;
  /** Main title, e.g. "Weatherford COROD® Mobile Gripper Operator". */
  title: string;
  /** Sub-line under the title (protocol / standard reference). */
  protocol: string;
  /** Ordered detail rows shown in the framed body. */
  fields: CertificateField[];
  /** Large watermark grade/seal text (e.g. "EXCELLENT" or "CERTIFIED"). */
  seal?: string;
  /** Footer note line. */
  footer?: string;
  /** Optional signatory blocks (name over role). */
  signatories?: { name: string; role: string }[];
  /** Document/serial reference printed small at the bottom. */
  serial?: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildCertificateHtml(spec: CertificateSpec): string {
  const rows = spec.fields
    .map(
      (f) => `
        <div class="row">
          <span class="row-label">${esc(f.label)}</span>
          <span class="dots"></span>
          <span class="row-value" style="${f.accent ? `color:${esc(f.accent)}` : ''}">${esc(f.value)}</span>
        </div>`,
    )
    .join('');

  const signs = (spec.signatories ?? [])
    .map(
      (s) => `
        <div class="sign">
          <div class="sign-line"></div>
          <div class="sign-name">${esc(s.name)}</div>
          <div class="sign-role">${esc(s.role)}</div>
        </div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(spec.title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4 landscape; margin: 0; }
  html, body { width: 100%; height: 100%; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    color: #1e293b;
    background: #f8fafc;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
  }
  .cert {
    position: relative;
    width: 1000px; max-width: 100%;
    padding: 40px 56px;
    background:
      radial-gradient(circle at 50% 0%, #ffffff 0%, #f4f6fb 100%);
    border: 3px solid #b45309;
    outline: 1px solid #d97706;
    outline-offset: 6px;
    box-shadow: 0 8px 30px rgba(0,0,0,.12);
    overflow: hidden;
  }
  .corner {
    position: absolute; width: 34px; height: 34px; border: 3px solid #b45309;
  }
  .corner.tl { top:14px; left:14px; border-right:0; border-bottom:0; }
  .corner.tr { top:14px; right:14px; border-left:0; border-bottom:0; }
  .corner.bl { bottom:14px; left:14px; border-right:0; border-top:0; }
  .corner.br { bottom:14px; right:14px; border-left:0; border-top:0; }
  .seal-wm {
    position: absolute; inset: 0; display:flex; align-items:center; justify-content:center;
    font-size: 150px; font-weight: 800; letter-spacing: 6px;
    color: rgba(180, 83, 9, 0.06); transform: rotate(-16deg); pointer-events:none;
    text-transform: uppercase;
  }
  .logo {
    width: 60px; height: 60px; border-radius: 12px; background: #dc2626;
    color:#fff; font-weight: 800; font-size: 34px; font-family: Arial, sans-serif;
    display:flex; align-items:center; justify-content:center; margin: 0 auto 14px;
    box-shadow: 0 4px 12px rgba(220,38,38,.35);
  }
  .eyebrow { text-align:center; letter-spacing: 3px; font-size: 12px; font-weight:700;
    color:#b45309; text-transform: uppercase; font-family: Arial, sans-serif; }
  .title { text-align:center; font-size: 34px; font-weight: 700; margin-top: 8px; color:#0f172a; }
  .protocol { text-align:center; font-size: 13px; color:#64748b; margin-top: 4px; font-family: Arial, sans-serif; }
  .divider { height: 2px; background: linear-gradient(90deg, transparent, #d97706, transparent); margin: 22px 0; }
  .awarded { text-align:center; font-size: 14px; color:#334155; font-style: italic; }
  .body {
    margin: 20px auto 8px; max-width: 640px;
    border: 1px solid #cbd5e1; border-radius: 10px; background: rgba(255,255,255,.75);
    padding: 20px 26px;
  }
  .row { display:flex; align-items:baseline; gap: 8px; padding: 7px 0; font-size: 15px; }
  .row-label { color:#64748b; font-family: Arial, sans-serif; font-size: 13px; white-space: nowrap; }
  .row-value { font-weight: 700; color:#0f172a; white-space: nowrap; }
  .dots { flex: 1; border-bottom: 1px dotted #94a3b8; transform: translateY(-3px); }
  .signs { display:flex; justify-content: space-around; gap: 32px; margin-top: 34px; }
  .sign { text-align:center; min-width: 200px; }
  .sign-line { border-top: 1.5px solid #475569; margin-bottom: 6px; }
  .sign-name { font-weight: 700; font-size: 14px; }
  .sign-role { font-size: 11px; color:#64748b; font-family: Arial, sans-serif; }
  .footer { text-align:center; font-size: 11px; color:#94a3b8; margin-top: 26px; font-family: Arial, sans-serif; }
  .serial { position:absolute; bottom: 12px; right: 20px; font-size: 10px; color:#94a3b8; font-family: Arial, sans-serif; }
  @media print { body { background:#fff; padding:0; } .cert { box-shadow:none; } }
</style>
</head>
<body>
  <div class="cert">
    <div class="corner tl"></div><div class="corner tr"></div>
    <div class="corner bl"></div><div class="corner br"></div>
    ${spec.seal ? `<div class="seal-wm">${esc(spec.seal)}</div>` : ''}
    <div class="logo">W</div>
    <div class="eyebrow">${esc(spec.eyebrow)}</div>
    <div class="title">${esc(spec.title)}</div>
    <div class="protocol">${esc(spec.protocol)}</div>
    <div class="divider"></div>
    <div class="awarded">This is to certify that the operator named below has satisfactorily
      demonstrated the required competencies under the standard operating protocol.</div>
    <div class="body">${rows}</div>
    ${signs ? `<div class="signs">${signs}</div>` : ''}
    ${spec.footer ? `<div class="footer">${esc(spec.footer)}</div>` : ''}
    ${spec.serial ? `<div class="serial">${esc(spec.serial)}</div>` : ''}
  </div>
</body>
</html>`;
}

/** Open a clean popup and print a single-page certificate for `spec`. */
export function printCertificate(spec: CertificateSpec): void {
  const html = buildCertificateHtml(spec);
  const win = window.open('', '_blank', 'width=1100,height=800');
  if (!win) {
    // Popup blocked — fall back to a hidden iframe.
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 300);
    }
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  // Give the popup a moment to lay out before printing.
  setTimeout(() => win.print(), 350);
}
