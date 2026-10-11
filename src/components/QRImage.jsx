import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { qrPayload } from '../utils.js';

export default function QRImage({ memberId, size = 180, className = '' }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(qrPayload(memberId), {
      width: 360, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0a1f44', light: '#ffffff' },
    })
      .then((url) => !cancelled && setSrc(url))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [memberId]);

  return src ? (
    <img src={src} width={size} height={size} alt={`QR code for ${memberId}`} className={className} />
  ) : (
    <div className={`qr-placeholder ${className}`} style={{ width: size, height: size }} />
  );
}
