export abstract class FileStoragePort {
  abstract uploadBase64Image(
    base64: string,
    prefix?: string,
  ): Promise<string>;
}
