/**
 * Cross-platform printer utilities
 * Supports Windows, macOS, and Linux printer detection and printing
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Get the current operating system platform
 * @returns {string} 'windows', 'macos', or 'linux'
 */
function getPlatform() {
  const platform = process.platform;
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'macos';
  return 'linux';
}

/**
 * Get list of available printers for Windows
 * @returns {Promise<string[]>} Array of printer names
 */
async function getWindowsPrinters() {
  try {
    const { stdout } = await execAsync(
      'powershell -Command "Get-Printer | Select-Object Name | ConvertTo-Json"'
    );
    const printers = JSON.parse(stdout);

    if (!printers) return [];
    if (Array.isArray(printers)) {
      return printers.map(p => p.Name).filter(name => name);
    }
    return printers.Name ? [printers.Name] : [];
  } catch (err) {
    console.error('Error getting Windows printers:', err.message);
    return [];
  }
}

/**
 * Get list of available printers for macOS
 * @returns {Promise<string[]>} Array of printer names
 */
async function getMacPrinters() {
  try {
    // Use lpstat to list all printers
    const { stdout } = await execAsync('lpstat -p -d 2>/dev/null');

    // Parse lpstat output
    // Format: "printer PRINTER_NAME is idle. enabled since..."
    const lines = stdout.split('\n');
    const printers = [];

    for (const line of lines) {
      if (line.startsWith('printer ')) {
        // Extract printer name between "printer " and " is" or " disabled"
        const match = line.match(/^printer\s+(\S+)\s+(is|disabled)/);
        if (match && match[1]) {
          printers.push(match[1]);
        }
      }
    }

    return printers;
  } catch (err) {
    console.error('Error getting macOS printers:', err.message);
    // Try alternative method using system_profiler (slower but more reliable)
    try {
      const { stdout } = await execAsync(
        'system_profiler SPPrintersDataType | grep "Print Name:" | awk -F": " \'{print $2}\''
      );
      const printers = stdout.trim().split('\n').filter(name => name);
      return printers;
    } catch (err2) {
      console.error('Error with alternative macOS printer detection:', err2.message);
      return [];
    }
  }
}

/**
 * Get list of available printers for Linux
 * @returns {Promise<string[]>} Array of printer names
 */
async function getLinuxPrinters() {
  try {
    // Use lpstat to list all printers (requires CUPS)
    const { stdout } = await execAsync('lpstat -p -d 2>/dev/null');

    // Parse lpstat output
    // Format: "printer PRINTER_NAME is idle. enabled since..."
    const lines = stdout.split('\n');
    const printers = [];

    for (const line of lines) {
      if (line.startsWith('printer ')) {
        // Extract printer name between "printer " and " is" or " disabled"
        const match = line.match(/^printer\s+(\S+)\s+(is|disabled)/);
        if (match && match[1]) {
          printers.push(match[1]);
        }
      }
    }

    return printers;
  } catch (err) {
    console.error('Error getting Linux printers:', err.message);
    console.error('Note: CUPS must be installed for printer detection on Linux');
    return [];
  }
}

/**
 * Get list of available printers for the current platform
 * @returns {Promise<string[]>} Array of printer names
 */
async function getPrintersByPlatform() {
  const platform = getPlatform();

  console.log(`Detecting printers for platform: ${platform}`);

  switch (platform) {
    case 'windows':
      return await getWindowsPrinters();
    case 'macos':
      return await getMacPrinters();
    case 'linux':
      return await getLinuxPrinters();
    default:
      console.error(`Unsupported platform: ${platform}`);
      return [];
  }
}

/**
 * Print a file on Windows
 * @param {string} filePath - Path to the file to print
 * @param {string} printerName - Name of the printer
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function printFileWindows(filePath, printerName) {
  try {
    // Escape single quotes in paths for PowerShell
    const escapedPath = filePath.replace(/'/g, "''");
    const escapedPrinter = printerName.replace(/'/g, "''");

    const command = `powershell -Command "Start-Process -FilePath '${escapedPath}' -Verb Print -ArgumentList '/d:${escapedPrinter}'"`;

    await execAsync(command);
    return { success: true, message: `File sent to printer: ${printerName}` };
  } catch (err) {
    console.error('Error printing on Windows:', err.message);
    return { success: false, message: `Print failed: ${err.message}` };
  }
}

/**
 * Print a file on macOS
 * @param {string} filePath - Path to the file to print
 * @param {string} printerName - Name of the printer
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function printFileMac(filePath, printerName) {
  try {
    // Use lp command (line printer) which is standard on macOS
    // The lp command supports various file types including PDF, images, etc.
    const command = `lp -d "${printerName}" "${filePath}"`;

    const { stdout, stderr } = await execAsync(command);

    if (stderr && !stdout) {
      console.error('Print command stderr:', stderr);
      return { success: false, message: `Print warning: ${stderr}` };
    }

    return { success: true, message: `File sent to printer: ${printerName}` };
  } catch (err) {
    console.error('Error printing on macOS:', err.message);
    return { success: false, message: `Print failed: ${err.message}` };
  }
}

/**
 * Print a file on Linux
 * @param {string} filePath - Path to the file to print
 * @param {string} printerName - Name of the printer
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function printFileLinux(filePath, printerName) {
  try {
    // Use lp command (requires CUPS)
    const command = `lp -d "${printerName}" "${filePath}"`;

    const { stdout, stderr } = await execAsync(command);

    if (stderr && !stdout) {
      console.error('Print command stderr:', stderr);
      return { success: false, message: `Print warning: ${stderr}` };
    }

    return { success: true, message: `File sent to printer: ${printerName}` };
  } catch (err) {
    console.error('Error printing on Linux:', err.message);
    console.error('Note: CUPS must be installed for printing on Linux');
    return { success: false, message: `Print failed: ${err.message}` };
  }
}

/**
 * Print a file using the appropriate method for the current platform
 * @param {string} filePath - Path to the file to print
 * @param {string} printerName - Name of the printer
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function printFile(filePath, printerName) {
  const platform = getPlatform();

  console.log(`Printing file on platform: ${platform}, printer: ${printerName}`);

  switch (platform) {
    case 'windows':
      return await printFileWindows(filePath, printerName);
    case 'macos':
      return await printFileMac(filePath, printerName);
    case 'linux':
      return await printFileLinux(filePath, printerName);
    default:
      return {
        success: false,
        message: `Printing not supported on platform: ${platform}`
      };
  }
}

/**
 * Check if printer functionality is available on the current platform
 * @returns {Promise<{available: boolean, platform: string, message: string}>}
 */
async function checkPrinterSupport() {
  const platform = getPlatform();

  try {
    const printers = await getPrintersByPlatform();

    if (printers.length === 0) {
      return {
        available: false,
        platform,
        message: 'No printers detected. Please ensure printers are installed and CUPS is running (macOS/Linux).'
      };
    }

    return {
      available: true,
      platform,
      message: `${printers.length} printer(s) detected`
    };
  } catch (err) {
    return {
      available: false,
      platform,
      message: `Printer detection failed: ${err.message}`
    };
  }
}

module.exports = {
  getPlatform,
  getPrintersByPlatform,
  printFile,
  checkPrinterSupport
};
