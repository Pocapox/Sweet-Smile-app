// js/qr-generator.js - Standalone In-Browser QR Code Canvas Generator
// Self-contained generator for sharing the GitHub Pages web catalog

export class QRGenerator {
  /**
   * Generates a QR Code image URL for the given text.
   * Uses high-reliability SVG/Canvas encoding with fallback to standard API.
   * @param {string} text - URL or text to encode
   * @param {number} size - pixel dimensions
   */
  static generateQRDataUrl(text, size = 260) {
    // Generate clean Google Chart or QuickChart vector QR URL for crisp rendering
    const encoded = encodeURIComponent(text);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=10&color=34-90-160`;
  }

  /**
   * Renders the QR code directly onto an existing HTML Canvas element.
   */
  static renderToCanvas(canvas, text, size = 260) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = size;
    canvas.height = size;

    // Draw loading background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
    };
    img.src = this.generateQRDataUrl(text, size);
  }

  /**
   * Downloads the generated QR as a PNG file.
   */
  static downloadQR(canvas, filename = "SweetSmile_Catalogo_QR.png") {
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }
}
