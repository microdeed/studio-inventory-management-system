const QRCode = require('qrcode');

/**
 * Generates a QR code string based on equipment ID
 * Format: EQ-{5-digit-padded-id}
 * Example: EQ-00123
 *
 * @param {number} equipmentId - The equipment database ID
 * @returns {string} QR code string
 */
function generateQRCode(equipmentId) {
    if (!equipmentId || equipmentId < 0) {
        throw new Error('Invalid equipment ID for QR code generation');
    }

    // Pad the ID to 5 digits (supports up to 99,999 equipment items)
    const paddedId = String(equipmentId).padStart(5, '0');
    return `EQ-${paddedId}`;
}

/**
 * Generates a QR code image as a data URL
 *
 * @param {string} qrCodeString - The QR code string to encode
 * @param {object} options - QRCode generation options
 * @returns {Promise<string>} Data URL of the QR code image
 */
async function generateQRImage(qrCodeString, options = {}) {
    const defaultOptions = {
        width: process.env.QR_CODE_SIZE || 200,
        margin: 2,
        ...options
    };

    try {
        return await QRCode.toDataURL(qrCodeString, defaultOptions);
    } catch (error) {
        throw new Error(`Failed to generate QR code image: ${error.message}`);
    }
}

/**
 * Validates a QR code string format
 * Expected format: EQ-{5-digit-number}
 *
 * @param {string} qrCode - The QR code string to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateQRCode(qrCode) {
    if (!qrCode || typeof qrCode !== 'string') {
        return false;
    }

    // Pattern: EQ- followed by exactly 5 digits
    const pattern = /^EQ-\d{5}$/;
    return pattern.test(qrCode);
}

/**
 * Parses a QR code string to extract the equipment ID
 *
 * @param {string} qrCode - The QR code string to parse
 * @returns {object|null} Object with equipmentId, or null if invalid
 */
function parseQRCode(qrCode) {
    if (!validateQRCode(qrCode)) {
        return null;
    }

    const parts = qrCode.split('-');
    const equipmentId = parseInt(parts[1], 10);

    return {
        prefix: parts[0],
        equipmentId: equipmentId
    };
}

module.exports = {
    generateQRCode,
    generateQRImage,
    validateQRCode,
    parseQRCode
};
