import * as crypto from 'crypto';

export class HikvisionIsapiClient {
  private realm = '';
  private nonce = '';
  private opaque = '';
  private qop = '';
  private nc = 0;

  constructor(
    private readonly host: string,
    private readonly username = 'admin',
    private readonly password = ''
  ) {}

  private md5(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex');
  }

  private parseChallenge(header: string): any {
    const params: any = {};
    const matches = header.matchAll(/(\w+)="?([^",]+)"?/g);
    for (const match of matches) {
      params[match[1]] = match[2];
    }
    return params;
  }

  async request(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: any): Promise<any> {
    const url = `http://${this.host}${path}`;
    const headers: any = {};
    
    let requestBody: any = undefined;
    if (body) {
      if (typeof body === 'string') {
        headers['Content-Type'] = 'application/xml';
        requestBody = body;
      } else {
        headers['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
      }
    }

    if (this.nonce) {
      headers['Authorization'] = this.getAuthorizationHeader(method, path);
    }

    let response = await fetch(url, {
      method,
      headers,
      body: requestBody,
    });

    if (response.status === 401) {
      const wwwAuth = response.headers.get('www-authenticate');
      if (wwwAuth) {
        const challenge = this.parseChallenge(wwwAuth);
        this.realm = challenge.realm || '';
        this.nonce = challenge.nonce || '';
        this.opaque = challenge.opaque || '';
        this.qop = challenge.qop || '';
        this.nc = 0;

        headers['Authorization'] = this.getAuthorizationHeader(method, path);
        response = await fetch(url, {
          method,
          headers,
          body: requestBody,
        });
      }
    }

    if (!response.ok) {
      throw new Error(`Hikvision ISAPI request failed with status: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  }

  private getAuthorizationHeader(method: string, path: string): string {
    this.nc++;
    const ncStr = this.nc.toString(16).padStart(8, '0');
    const cnonce = crypto.randomBytes(8).toString('hex');
    const ha1 = this.md5(`${this.username}:${this.realm}:${this.password}`);
    const ha2 = this.md5(`${method}:${path}`);
    
    let response: string;
    if (this.qop) {
      response = this.md5(`${ha1}:${this.nonce}:${ncStr}:${cnonce}:${this.qop}:${ha2}`);
    } else {
      response = this.md5(`${ha1}:${this.nonce}:${ha2}`);
    }

    let header = `Digest username="${this.username}", realm="${this.realm}", nonce="${this.nonce}", uri="${path}", response="${response}"`;
    if (this.opaque) {
      header += `, opaque="${this.opaque}"`;
    }
    if (this.qop) {
      header += `, qop=${this.qop}, nc=${ncStr}, cnonce="${cnonce}"`;
    }
    return header;
  }
}
