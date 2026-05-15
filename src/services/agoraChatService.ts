import AC from 'agora-chat';

// Agora Chat Configuration
const APP_KEY = '711200504#1446700';

class AgoraChatService {
  private conn: any;
  private eventHandlers: Map<string, any> = new Map();
  private isOpened: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      this.conn = new (AC as any).connection({
        appKey: APP_KEY,
        isHttpDNS: false,
        url: 'wss://msync-a71.chat.agora.io',
        apiUrl: 'https://a71.chat.agora.io',
        https: true
      });
      console.log('Agora Chat Connection Initialized');
    } catch (e) {
      console.error('Failed to initialize Agora Chat connection:', e);
    }
  }

  async login(userId: string, token: string) {
    if (!this.conn) {
      this.init();
    }
    
    console.log(`Agora Chat attempting login for ${userId}`);
    try {
      const res = await this.conn.open({
        user: userId,
        agoraToken: token
      });
      this.isOpened = true;
      console.log('Agora Chat Login Successful');
      return res;
    } catch (e) {
      console.error('Agora Chat Login Failed:', e);
      throw e;
    }
  }

  async logout() {
    if (this.conn && this.isOpened) {
      this.isOpened = false;
      return this.conn.close();
    }
  }

  addEventHandler(name: string, handler: any) {
    if (!this.conn) return;
    this.eventHandlers.set(name, handler);
    this.conn.addEventHandler(name, handler);
  }

  removeEventHandler(name: string) {
    if (!this.conn) return;
    this.eventHandlers.delete(name);
    this.conn.removeEventHandler(name);
  }

  async sendMessage(to: string, content: string) {
    if (!this.conn || !this.isOpened) {
      console.warn('Agora Chat not logged in, skipping real-time message');
      return;
    }

    try {
      console.log(`Agora Chat creating message for ${to}: ${content}`);
      const msg = (AC as any).message.create({
        type: 'txt',
        msg: content,
        to: to,
        chatType: 'singleChat'
      });
      console.log('Agora Chat message created, sending...', msg);
      const res = await this.conn.send(msg);
      console.log('Agora Chat message send response:', res);
      return res;
    } catch (e) {
      console.error('Agora Chat Send Message Failed:', e);
    }
  }
}

export const agoraChatService = new AgoraChatService();
