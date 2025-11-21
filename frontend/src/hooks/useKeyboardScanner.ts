import { useEffect, useRef, useCallback } from 'react';

interface UseKeyboardScannerOptions {
  onScanComplete: (barcode: string) => void;
  enabled?: boolean;
}

interface UseKeyboardScannerReturn {
  isListening: boolean;
}

export const useKeyboardScanner = (
  options: UseKeyboardScannerOptions
): UseKeyboardScannerReturn => {
  const { onScanComplete, enabled = true } = options;

  const bufferRef = useRef<string>('');
  const lastInputTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Configuration
  const SCAN_THRESHOLD_MS = 10; // Time between rapid keypresses (scanner is very fast)
  const SCAN_COMPLETE_DELAY = 200; // Pause duration that signals scan is complete
  const MIN_BARCODE_LENGTH = 3; // Minimum characters to be considered a barcode

  // Check if user is actively typing in an input field
  const isUserTypingInField = useCallback((): boolean => {
    const activeElement = document.activeElement;
    const isInputField =
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      activeElement?.getAttribute('contenteditable') === 'true';

    return isInputField && (activeElement as HTMLInputElement).type !== 'hidden';
  }, []);

  // Process the completed scan
  const processScan = useCallback((barcode: string) => {
    if (barcode.length >= MIN_BARCODE_LENGTH) {
      console.log('✅ Barcode detected via keyboard:', barcode);
      onScanComplete(barcode);
    }
    bufferRef.current = '';
  }, [onScanComplete]);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Skip if disabled
    if (!enabled) {
      return;
    }

    // Skip if user is typing in an input field
    if (isUserTypingInField()) {
      return;
    }

    const currentTime = Date.now();
    const timeSinceLastInput = currentTime - lastInputTimeRef.current;

    // If too much time has passed, reset the buffer (not a scan)
    if (timeSinceLastInput > 500 && bufferRef.current.length > 0) {
      console.log('⏱️ Input too slow, resetting buffer');
      bufferRef.current = '';
    }

    lastInputTimeRef.current = currentTime;

    // Handle Enter key - scan complete
    if (event.key === 'Enter') {
      event.preventDefault();

      // Check if we have fast input (likely a scanner)
      if (bufferRef.current.length > 0 && timeSinceLastInput < SCAN_THRESHOLD_MS) {
        console.log('🎯 Enter detected, processing scan');
        processScan(bufferRef.current);
        return;
      }

      // Clear buffer on Enter even if not a scan
      bufferRef.current = '';
      return;
    }

    // Handle printable characters
    if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      // Only capture if typing is FAST (scanner speed)
      // Allow normal human typing to pass through
      const isFastTyping = bufferRef.current.length > 0 && timeSinceLastInput < SCAN_THRESHOLD_MS;
      const isFirstChar = bufferRef.current.length === 0;

      if (isFastTyping || isFirstChar) {
        // This might be scanner input - capture it
        event.preventDefault();
        bufferRef.current += event.key;
        console.log('📝 Buffer:', bufferRef.current, `(${timeSinceLastInput}ms since last)`);

        // Clear any existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Set timeout to detect end of scan (pause in input)
        timeoutRef.current = setTimeout(() => {
          if (bufferRef.current.length > 0) {
            console.log('⏸️ Pause detected, processing scan');
            processScan(bufferRef.current);
          }
        }, SCAN_COMPLETE_DELAY);
      } else {
        // Slow typing - this is human input, let it through
        console.log('👤 Human typing detected, ignoring');
        bufferRef.current = '';
      }
    }
  }, [enabled, isUserTypingInField, processScan]);

  // Attach global keyboard listener
  useEffect(() => {
    if (!enabled) {
      return;
    }

    console.log('🎧 Keyboard scanner listener attached');
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      console.log('🔇 Keyboard scanner listener removed');
      document.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, handleKeyDown]);

  return {
    isListening: enabled
  };
};
