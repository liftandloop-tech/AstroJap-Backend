// ─── Config (no sensitive keys here — auth goes through the backend) ──────────
const CometChatConfig = {
  APP_ID: '167764494523f5d44',
  REGION: 'in'
  // AUTH_KEY intentionally removed — auth tokens are generated server-side
};

// ─── AstroChat ────────────────────────────────────────────────────────────────
const AstroChat = {
  async init() {
    try {
      const settings = new CometChat.AppSettingsBuilder()
        .subscribePresenceForAllUsers()
        .setRegion(CometChatConfig.REGION)
        .autoEstablishSocketConnection(true)
        .build();
      await CometChat.init(CometChatConfig.APP_ID, settings);
      console.log('CometChat initialized');
    } catch (error) {
      console.error('CometChat init failed:', error);
      throw error;
    }
  },

  // Step 1.3: Login using a server-generated auth token — AUTH_KEY never exposed
  async login(customerId, customerName) {
    try {
      // 1. Ensure init is done first
      await this.init();

      // 2. Check if already logged in
      const existing = await CometChat.getLoggedInUser();
      if (existing) return existing;

      // 3. Fetch token (safeguard API base URL)
      const apiBase = window.AstroAPIBase || 'https://astro-jap-backend.vercel.app/api';
      const res = await fetch(`${apiBase}/sessions/get-chat-token`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ customer_id: customerId, customer_name: customerName })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }

      const { authToken } = await res.json();
      if (!authToken) throw new Error('No auth token returned from backend');

      return await CometChat.login(authToken); // Modern SDK uses .login(token)
    } catch (error) {
      console.error('CometChat login failed:', error);
      throw error;
    }
  },

  // Step 1.2: Opens a direct chat with the astrologer using CometChat Widget
  startConversation(receiverUID) {
    // Priority: 1. window variable (from Liquid theme settings) | 2. hardcoded fallback
    const WIDGET_ID = window.AstroCometChatWidgetID || '69de2245130bd98e163ec51a';

    CometChatWidget.init({
      appID:     CometChatConfig.APP_ID,
      appRegion: CometChatConfig.REGION
    }).then(() => {
      CometChatWidget.launch({
        widgetID:     WIDGET_ID,
        target:       '#cometchat-container',
        roundedCorners: 'true',
        height:       '600px',
        width:        '100%',
        defaultID:    receiverUID,
        defaultType:  'user'
      });
    }).catch(err => console.error('CometChat Widget failed:', err));
  },

  logout() {
    CometChat.logout()
      .then(() => { window.location.href = '/'; })
      .catch(console.error);
  }
};

window.AstroChat = AstroChat;
