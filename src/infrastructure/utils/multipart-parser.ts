export interface MultipartPart {
  headers: Record<string, string>;
  data: Buffer;
}

/**
 * Parses a raw multipart/form-data Buffer using the provided boundary string.
 * This is a buffer-safe parser that prevents binary data corruption (like JPEGs)
 * which typically occurs when converting the entire request payload to a string first.
 *
 * @param buffer The raw request body Buffer
 * @param boundary The boundary string extracted from the Content-Type header
 */
export function parseMultipartBuffer(buffer: Buffer, boundary: string): MultipartPart[] {
  const parts: MultipartPart[] = [];
  const boundaryBuffer = Buffer.from('--' + boundary);
  let offset = 0;

  while (true) {
    const index = buffer.indexOf(boundaryBuffer, offset);
    if (index === -1) break;

    const nextIndex = buffer.indexOf(boundaryBuffer, index + boundaryBuffer.length);
    if (nextIndex === -1) break;

    // Determine the content boundaries of the current part
    let partStart = index + boundaryBuffer.length;
    
    // Skip leading \r\n of the part body
    if (buffer[partStart] === 13 && buffer[partStart + 1] === 10) {
      partStart += 2;
    }

    let partEnd = nextIndex;
    
    // Trim trailing \r\n before the next boundary
    if (buffer[partEnd - 2] === 13 && buffer[partEnd - 1] === 10) {
      partEnd -= 2;
    }
    
    // Trim trailing "--" if it's the closing boundary
    if (buffer[partEnd - 1] === 45 && buffer[partEnd - 2] === 45) {
      partEnd -= 2;
      if (buffer[partEnd - 2] === 13 && buffer[partEnd - 1] === 10) {
        partEnd -= 2;
      }
    }

    const partBuffer = buffer.subarray(partStart, partEnd);
    const separator = Buffer.from('\r\n\r\n');
    const sepIndex = partBuffer.indexOf(separator);

    if (sepIndex !== -1) {
      const headerStr = partBuffer.subarray(0, sepIndex).toString('utf8');
      const dataBuffer = partBuffer.subarray(sepIndex + separator.length);

      // Parse headers
      const headers: Record<string, string> = {};
      const headerLines = headerStr.split('\r\n');
      for (const line of headerLines) {
        const colon = line.indexOf(':');
        if (colon !== -1) {
          const key = line.substring(0, colon).trim().toLowerCase();
          const val = line.substring(colon + 1).trim();
          headers[key] = val;
        }
      }

      parts.push({ headers, data: dataBuffer });
    }

    offset = nextIndex;
  }
  return parts;
}
