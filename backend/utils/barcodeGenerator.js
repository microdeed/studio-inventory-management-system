/**
 * Barcode Generator Utility
 * Generates barcodes following the convention:
 * [Type Code]-[CountYear]-[Unique Number]-[Last 4 of Serial]
 * Format: XX-XXYY-XXXXX-XXXX
 *
 * Type Codes:
 * CA: Camera, LN: Lens, MI: Microphone, LG: Lighting,
 * MS: Misc, GR: Grip, SD: Stand, SB: Strobe,
 * MD: Modifier, DN: Drone, BY: Battery, RT: Remote,
 * VL: Video Light, SR: Storage
 *
 * Count: 2-digit number for multiples (01, 02, etc.) or 00 for single items
 * Year: 2-digit year (no dash between count and year)
 * Last 4 of Serial: Only added for multiple identical items
 */

const database = require('../database/connection');

// Category name to type code mapping
const CATEGORY_TYPE_CODES = {
    'camera': 'CA',
    'cameras': 'CA',
    'lens': 'LN',
    'lenses': 'LN',
    'microphone': 'MI',
    'microphones': 'MI',
    'audio': 'MI',
    'lighting': 'LG',
    'light': 'LG',
    'lights': 'LG',
    'misc': 'MS',
    'miscellaneous': 'MS',
    'grip': 'GR',
    'stand': 'SD',
    'stands': 'SD',
    'strobe': 'SB',
    'strobes': 'SB',
    'modifier': 'MD',
    'modifiers': 'MD',
    'drone': 'DN',
    'drones': 'DN',
    'battery': 'BY',
    'batteries': 'BY',
    'remote': 'RT',
    'remotes': 'RT',
    'video light': 'VL',
    'video lights': 'VL',
    'storage': 'SR',
    'accessories': 'MS',
    'computing': 'MS',
    'cables': 'MS',
    'furniture': 'MS'
};

/**
 * Get type code from category name
 * @param {string} categoryName - Category name
 * @returns {string} Type code
 */
function getTypeCode(categoryName) {
    if (!categoryName) return 'MS'; // Default to Misc

    const normalized = categoryName.toLowerCase().trim();
    return CATEGORY_TYPE_CODES[normalized] || 'MS';
}

/**
 * Get the next sequential number for a given type code and year
 * @param {string} typeCode - Equipment type code
 * @param {string} year - 2-digit year
 * @returns {Promise<number>} Next sequential number
 */
async function getNextSequentialNumber(typeCode, year) {
    try {
        // Find all barcodes with this type and year
        // Format: XX-CCYY-NNNNN or XX-CCYY-NNNNN-SSSS
        const pattern = `${typeCode}-__${year}-%`;
        const result = await database.get(`
            SELECT barcode FROM equipment
            WHERE barcode LIKE ?
            ORDER BY barcode DESC
            LIMIT 1
        `, [pattern]);

        if (!result || !result.barcode) {
            return 1; // Start at 1 if no existing codes
        }

        // Extract the sequential number from the barcode
        // Format: XX-CCYY-NNNNN-SSSS (parts[2] is the unique number)
        const parts = result.barcode.split('-');
        if (parts.length >= 3) {
            const lastNumber = parseInt(parts[2], 10);
            return isNaN(lastNumber) ? 1 : lastNumber + 1;
        }

        return 1;
    } catch (error) {
        console.error('[Barcode Generator] Error getting next sequential number:', error);
        return 1;
    }
}

/**
 * Generate a barcode for equipment
 * @param {string} categoryName - Category name (optional)
 * @param {string} purchaseDate - Purchase date (optional, defaults to now)
 * @param {number} count - Item count for multiples (01-99, or 00 for single items)
 * @param {string} serialNumber - Serial number (optional, last 4 digits appended for multiples)
 * @returns {Promise<string>} Generated barcode
 */
async function generateBarcode(categoryName = null, purchaseDate = null, count = 1, serialNumber = null, totalQuantity = 1) {
    try {
        // Get type code
        const typeCode = getTypeCode(categoryName);

        // Get year (last 2 digits), or '00' if purchase date is unknown
        const year = purchaseDate ? new Date(purchaseDate).getFullYear().toString().slice(-2) : '00';

        // Get next sequential number
        const sequentialNumber = await getNextSequentialNumber(typeCode, year);

        // Format count: 00 for single items, 01-99 for multiples
        let countStr;
        if (totalQuantity === 1) {
            countStr = '00'; // Single item, not part of multiples
        } else {
            countStr = Math.max(1, Math.min(99, count)).toString().padStart(2, '0');
        }

        // Pad sequential number to 5 digits
        const paddedNumber = sequentialNumber.toString().padStart(5, '0');

        // Build barcode: XX-CCYY-NNNNN (no dash between count and year)
        let barcode = `${typeCode}-${countStr}${year}-${paddedNumber}`;

        // Add last 4 of serial number if provided (only for multiples)
        if (serialNumber && serialNumber.length > 0 && totalQuantity > 1) {
            const last4 = serialNumber.slice(-4).padStart(4, '0');
            barcode += `-${last4}`;
        }

        console.log(`[Barcode Generator] Generated: ${barcode} (Category: ${categoryName || 'N/A'}, Count: ${countStr})`);

        return barcode;
    } catch (error) {
        console.error('[Barcode Generator] Error generating barcode:', error);
        // Fallback to timestamp-based barcode
        const year = new Date().getFullYear().toString().slice(-2);
        return `MS-00${year}-${Date.now().toString().slice(-5)}`;
    }
}

/**
 * Validate barcode format
 * @param {string} barcode - Barcode to validate
 * @returns {boolean} True if valid
 */
function validateBarcode(barcode) {
    if (!barcode || typeof barcode !== 'string') return false;

    // Format: XX-CCYY-NNNNN or XX-CCYY-NNNNN-SSSS
    const pattern = /^[A-Z]{2}-\d{4}-\d{5}(-\d{4})?$/;
    return pattern.test(barcode);
}

/**
 * Parse barcode into components
 * @param {string} barcode - Barcode to parse
 * @returns {object|null} Parsed components or null if invalid
 */
function parseBarcode(barcode) {
    if (!validateBarcode(barcode)) return null;

    const parts = barcode.split('-');
    const countYear = parts[1]; // CCYY format

    const parsed = {
        typeCode: parts[0],
        count: parseInt(countYear.substring(0, 2), 10),
        year: countYear.substring(2, 4),
        sequentialNumber: parseInt(parts[2], 10)
    };

    // Add serial suffix if present
    if (parts.length === 4) {
        parsed.serialSuffix = parts[3];
    }

    return parsed;
}

module.exports = {
    generateBarcode,
    validateBarcode,
    parseBarcode,
    getTypeCode,
    CATEGORY_TYPE_CODES
};
