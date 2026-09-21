/**
 * PivotOps Email Base Layout
 * Premium dark-on-white design matching brand identity
 */
export function baseLayout(params: {
  title:       string;
  preview?:    string;
  content:     string;
  footer?:     string;
  accentColor?: string;
}): string {
  const accent = params.accentColor ?? "#10b981";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${params.title}</title>
  ${params.preview ? `<div style="display:none;max-height:0;overflow:hidden;">${params.preview}</div>` : ""}
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding:0 0 24px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:18px;font-weight:700;color:#18181b;letter-spacing:-0.5px;">PivotOps</span>
                  </td>
                  <td align="right">
                    <span style="font-size:11px;color:#a1a1aa;font-family:monospace;text-transform:uppercase;letter-spacing:1px;">Workforce OS</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;padding:40px;border:1px solid #e4e4e7;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
              <!-- Accent bar -->
              <div style="height:4px;background:linear-gradient(90deg,${accent},${accent}99);border-radius:4px;margin-bottom:32px;"></div>
              ${params.content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                ${params.footer ?? `PivotOps by Craftstreams &bull; <a href="https://www.pivotops.app" style="color:#a1a1aa;">pivotops.app</a><br>
                <a href="https://www.pivotops.app/legal/privacy" style="color:#a1a1aa;">Privacy Policy</a> &bull;
                <a href="https://www.pivotops.app/legal/terms" style="color:#a1a1aa;">Terms of Use</a>`}
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#d4d4d8;">
                &copy; ${new Date().getFullYear()} Craftstreams. PivotOps is a trademark of Craftstreams.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function btn(label: string, url: string, color = "#10b981"): string {
  return `<a href="${url}" style="display:inline-block;padding:13px 28px;background:${color};color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:-0.2px;">${label}</a>`;
}

export function infoBox(lines: { label: string; value: string }[], accentColor = "#f4f4f5"): string {
  const rows = lines.map(l => `
    <tr>
      <td style="padding:8px 16px;font-size:13px;color:#71717a;font-weight:500;white-space:nowrap;">${l.label}</td>
      <td style="padding:8px 16px;font-size:13px;color:#18181b;font-weight:600;">${l.value}</td>
    </tr>`).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${accentColor};border-radius:10px;margin:24px 0;border:1px solid #e4e4e7;">
    <tbody>${rows}</tbody>
  </table>`;
}

export function h1(text: string, color = "#18181b"): string {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:${color};letter-spacing:-0.5px;">${text}</h1>`;
}

export function p(text: string, muted = false): string {
  return `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:${muted ? "#71717a" : "#3f3f46"};">${text}</p>`;
}

export function divider(): string {
  return `<hr style="border:none;border-top:1px solid #f4f4f5;margin:24px 0;" />`;
}