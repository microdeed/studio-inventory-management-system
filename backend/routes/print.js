const express = require('express');
const database = require('../database/connection');
const QRCode = require('qrcode');
const Jimp = require('jimp');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);
const { getPrintersByPlatform, printFile, getPlatform } = require('../utils/printerUtils.js');

const router = express.Router();

// Load printer configuration
let printerConfig = {};
const configPath = path.join(__dirname, '../printer-config.json');
try {
  if (fs.existsSync(configPath)) {
    printerConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } else {
    // Create default config if doesn't exist
    printerConfig = {
      printerName: '',
      description: 'Configure your Epson LABELWORKS printer name here',
      instructions: [
        '1. Open Control Panel > Devices and Printers',
        '2. Find your Epson LABELWORKS printer',
        '3. Copy the exact printer name',
        '4. Update the \'printerName\' field above with that exact name'
      ],
      note: 'The printer name must match exactly as shown in Windows'
    };
    fs.writeFileSync(configPath, JSON.stringify(printerConfig, null, 2));
  }
} catch (err) {
  console.error('Error loading printer config:', err.message);
  printerConfig = {
    printerName: '',
    description: 'Configure your Epson LABELWORKS printer name here'
  };
}

// Authentication middleware - checks if user is authenticated
const requireAuth = async (req, res, next) => {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const user = await database.get('SELECT id, role FROM users WHERE id = ? AND is_active = 1', [userId]);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Middleware to check if user is admin or manager
const requireAdminOrManager = async (req, res, next) => {
  const userId = req.body.created_by || req.body.updated_by || req.body.deleted_by || req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const user = await database.get('SELECT role FROM users WHERE id = ? AND is_active = 1', [userId]);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.role !== 'admin' && user.role !== 'manager') {
      return res.status(403).json({ error: 'Admin or Manager access required' });
    }

    next();
  } catch (error) {
    console.error('[Auth] Error checking admin/manager status:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Get available printers (platform-aware)
async function getAvailablePrinters() {
  try {
    const printers = await getPrintersByPlatform();
    console.log(`Found ${printers.length} printer(s) on ${getPlatform()}`);
    return printers;
  } catch (err) {
    console.error('Error getting printers:', err);
    return [];
  }
}

// Generate composite label: QR code on top, text below (rotated 90° clockwise)
// Portrait layout sized for 12mm (1/2 inch) print media at 300 DPI (~141 pixels width)
// If useHalfSize is true, generates QR only at half size with no text
async function generateCompositeLabel(barcodeText, qrcodeData, useHalfSize = false) {
  try {
    // Adjust sizes based on half-size option
    const qrSize = useHalfSize ? 50 : 100;
    const padding = useHalfSize ? 4 : 8;

    // Generate QR code as PNG buffer
    const qrBuffer = await QRCode.toBuffer(qrcodeData, {
      errorCorrectionLevel: 'M',
      width: qrSize,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Load QR code into Jimp
    const qrImage = await Jimp.read(qrBuffer);

    let canvasWidth, canvasHeight;

    if (useHalfSize) {
      // Half size: QR only, no text
      canvasWidth = qrSize + (padding * 2);
      canvasHeight = qrSize + (padding * 2);

      // Create white background
      const image = await new Jimp(canvasWidth, canvasHeight, 0xFFFFFFFF);

      // Composite QR code (centered)
      const qrX = Math.floor((canvasWidth - qrSize) / 2);
      image.composite(qrImage, qrX, padding);

      return await image.getBufferAsync(Jimp.MIME_PNG);
    } else {
      // Full size: QR + text
      // Estimate text dimensions (roughly 7 pixels per character for 14px font)
      const estimatedTextWidth = barcodeText.length * 7;

      // Portrait layout: width matches 12mm (~116px), height accommodates QR + rotated text
      canvasWidth = qrSize + (padding * 2);
      canvasHeight = qrSize + estimatedTextWidth + (padding * 3);

      // Create white background
      const image = await new Jimp(canvasWidth, canvasHeight, 0xFFFFFFFF);

      // Composite QR code at top (centered horizontally)
      const qrX = Math.floor((canvasWidth - qrSize) / 2);
      image.composite(qrImage, qrX, padding);

      // Load font for text (using Jimp's built-in font)
      const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);

      // Position for text (below QR code)
      const textY = qrSize + (padding * 2);
      const textX = Math.floor(canvasWidth / 2);

      // Print text vertically by rotating the entire image temporarily
      // Create a temporary image for the text
      const textHeight = estimatedTextWidth;
      const textWidth = 20; // Height of the font
      const textImage = await new Jimp(textHeight, textWidth, 0xFFFFFFFF);

      // Print text horizontally on the temporary image
      textImage.print(font, 0, 0, barcodeText);

      // Rotate text image 90 degrees clockwise
      textImage.rotate(-90);

      // Composite rotated text onto main image
      const textCompositeX = Math.floor((canvasWidth - textImage.bitmap.width) / 2);
      image.composite(textImage, textCompositeX, textY);

      return await image.getBufferAsync(Jimp.MIME_PNG);
    }
  } catch (err) {
    throw new Error(`Label generation error: ${err.message}`);
  }
}

// Generate PDF label for 12mm media with QR code and text (no barcode image)
// HORIZONTAL LAYOUT: Height 34pt (12mm), Width variable
// Content arranged left-to-right: [QR] [Text]
// If useHalfSize is true, generates QR only at half size with no text
// Printer settings: Set margins to "None" for optimal results
async function generateLabelPDF(barcodeText, qrcodeData, useHalfSize = false) {
  return new Promise(async (resolve, reject) => {
    try {
      // Dimensions based on print.example.js architecture
      let qrSize, qrPixelSize, leftPosition, topPosition, width, height;
      let leftMargin, topMargin, textWidth, spacing;

      if (useHalfSize) {
        // Half size: 34x34pt with 15pt QR (from example.js)
        width = 34;
        height = 34;
        qrSize = 15;
        qrPixelSize = 100;
        leftPosition = 16;
        topPosition = (height - qrSize) / 2; // 9.5pt - centered vertically
      } else {
        // Full size: Original dimensions with text
        qrSize = 86;
        qrPixelSize = 100;
        leftMargin = 14;
        topMargin = 60;
        textWidth = 300;
        spacing = 18;
        width = leftMargin + qrSize + spacing + textWidth + leftMargin;
        height = 160;
        leftPosition = leftMargin;
        topPosition = topMargin;
      }

      // Generate QR code as PNG buffer
      const qrBuffer = await QRCode.toBuffer(qrcodeData, {
        errorCorrectionLevel: 'M',
        width: qrPixelSize,
        margin: 0,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Create PDF document with NO margins
      const doc = new PDFDocument({
        size: [width, height],
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });

      // Collect PDF chunks
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add QR code at calculated position
      doc.image(qrBuffer, leftPosition, topPosition, { width: qrSize, height: qrSize });

      // Add text only if full size
      if (!useHalfSize) {
        const spacing = 18;
        const textWidth = 300;
        const xPosition = leftMargin + qrSize + spacing;
        const textY = topMargin + (qrSize / 2) - 16;

        doc.fontSize(32);
        doc.text(barcodeText, xPosition, textY, {
          width: textWidth,
          align: 'center'
        });
      }

      // Finalize PDF
      doc.end();

    } catch (err) {
      reject(new Error(`PDF generation error: ${err.message}`));
    }
  });
}

// Get available printers endpoint
router.get('/printers', requireAuth, async (req, res) => {
  try {
    const printers = await getAvailablePrinters();
    res.json({
      printers,
      configured: printerConfig.printerName || null,
      message: printers.length > 0 ? 'Printers found' : 'No printers found'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update printer configuration endpoint
router.post('/printers/configure', requireAuth, (req, res) => {
  try {
    const { printerName } = req.body;
    if (!printerName) {
      return res.status(400).json({ error: 'Printer name is required' });
    }

    printerConfig.printerName = printerName;
    fs.writeFileSync(configPath, JSON.stringify(printerConfig, null, 2));

    res.json({ success: true, message: 'Printer configured successfully', printerName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate PNG endpoint - streams PNG to browser (no file storage)
router.get('/:id', requireAdminOrManager, async (req, res) => {
  const id = req.params.id;
  const useHalfSize = req.query.size === 'half';

  try {
    // Get equipment data from database
    const equipment = await database.get(
      'SELECT barcode, qr_code, name FROM equipment WHERE id = ? AND is_active = 1',
      [id]
    );

    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Generate composite label
    const labelBuffer = await generateCompositeLabel(equipment.barcode, equipment.qr_code, useHalfSize);

    // Stream PNG directly to browser
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="label_${id}.png"`);
    res.setHeader('Content-Length', labelBuffer.length);
    res.send(labelBuffer);

  } catch (err) {
    console.error('Error in PNG generation endpoint:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate PDF endpoint - streams PDF to browser (no file storage)
router.get('/pdf/:id', requireAdminOrManager, async (req, res) => {
  const id = req.params.id;
  const useHalfSize = req.query.size === 'half';

  try {
    // Get equipment data from database
    const equipment = await database.get(
      'SELECT barcode, qr_code, name FROM equipment WHERE id = ? AND is_active = 1',
      [id]
    );

    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Generate PDF
    const pdfBuffer = await generateLabelPDF(equipment.barcode, equipment.qr_code, useHalfSize);

    // Stream PDF to browser
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="label_${id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

    console.log('PDF generated:', { id, barcode: equipment.barcode, size: pdfBuffer.length });

  } catch (err) {
    console.error('Error in PDF generation endpoint:', err);
    res.status(500).json({ error: err.message });
  }
});

// Direct PNG print endpoint - generates PNG, prints, then deletes temp file
router.post('/direct/:id', requireAdminOrManager, async (req, res) => {
  const id = req.params.id;
  const useHalfSize = req.query.size === 'half';

  try {
    // Check if printer is configured
    if (!printerConfig.printerName) {
      return res.status(400).json({
        error: 'Printer not configured',
        message: 'Please configure your printer first using the printer settings'
      });
    }

    // Get equipment data from database
    const equipment = await database.get(
      'SELECT barcode, qr_code, name FROM equipment WHERE id = ? AND is_active = 1',
      [id]
    );

    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Generate composite label
    const labelBuffer = await generateCompositeLabel(equipment.barcode, equipment.qr_code, useHalfSize);

    // Save to temporary file for printing
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const tempFilename = `label_${id}_${timestamp}.png`;
    const tempPath = path.join(tempDir, tempFilename);

    fs.writeFileSync(tempPath, labelBuffer);

    try {
      // Print the file using platform-aware utility
      const printResult = await printFile(tempPath, printerConfig.printerName);

      if (!printResult.success) {
        throw new Error(printResult.message);
      }

      console.log('PNG sent to printer:', { id, printer: printerConfig.printerName, platform: getPlatform() });

      // Delete temp file after printing
      setTimeout(() => {
        try {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        } catch (deleteErr) {
          console.error('Error deleting temp file:', deleteErr);
        }
      }, 5000); // Wait 5 seconds before deleting

      res.json({
        success: true,
        message: `Label sent to printer: ${printerConfig.printerName}`,
        printer: printerConfig.printerName,
        data: {
          barcode: equipment.barcode,
          qr_code: equipment.qr_code,
          name: equipment.name
        }
      });

    } catch (printErr) {
      // Clean up temp file on error
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      throw printErr;
    }

  } catch (err) {
    console.error('Error in direct PNG print:', err);
    res.status(500).json({ error: err.message });
  }
});

// Direct PDF print endpoint - generates PDF, prints, then deletes temp file
router.post('/pdf-direct/:id', requireAdminOrManager, async (req, res) => {
  const id = req.params.id;
  const useHalfSize = req.query.size === 'half';

  try {
    // Check if printer is configured
    if (!printerConfig.printerName) {
      return res.status(400).json({
        error: 'Printer not configured',
        message: 'Please configure your printer first using the printer settings'
      });
    }

    // Get equipment data from database
    const equipment = await database.get(
      'SELECT barcode, qr_code, name FROM equipment WHERE id = ? AND is_active = 1',
      [id]
    );

    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Generate PDF
    const pdfBuffer = await generateLabelPDF(equipment.barcode, equipment.qr_code, useHalfSize);

    // Save to temporary file for printing
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const tempFilename = `label_${id}_${timestamp}.pdf`;
    const tempPath = path.join(tempDir, tempFilename);

    fs.writeFileSync(tempPath, pdfBuffer);

    try {
      // Send PDF directly to printer using platform-aware utility
      const printResult = await printFile(tempPath, printerConfig.printerName);

      if (!printResult.success) {
        throw new Error(printResult.message);
      }

      console.log('PDF sent to printer:', { id, printer: printerConfig.printerName, platform: getPlatform() });

      // Delete temp file after printing
      setTimeout(() => {
        try {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        } catch (deleteErr) {
          console.error('Error deleting temp file:', deleteErr);
        }
      }, 5000); // Wait 5 seconds before deleting

      res.json({
        success: true,
        message: `PDF sent directly to printer: ${printerConfig.printerName}`,
        printer: printerConfig.printerName,
        data: {
          barcode: equipment.barcode,
          qr_code: equipment.qr_code,
          name: equipment.name
        }
      });

    } catch (printErr) {
      // Clean up temp file on error
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      throw printErr;
    }

  } catch (err) {
    console.error('Error in direct PDF print:', err);
    res.status(500).json({
      error: err.message,
      details: 'Failed to generate or print PDF'
    });
  }
});

module.exports = router;
