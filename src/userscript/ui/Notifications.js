const GG = window.GhostGuessr;

export const showNotification = (message, type = 'info', duration = 5000) => {
    const id = 'gg-notification-' + Date.now();
    const banner = document.createElement('div');
    banner.id = id;
    
    const colors = {
        info: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        error: 'linear-gradient(135deg, #ff9966 0%, #ff5e62 100%)',
        success: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'
    };

    banner.style.cssText = `
      position: fixed;
      top: 80px;
      left: 20px;
      width: auto;
      max-width: 350px;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-family: 'Neo Sans', sans-serif;
      font-weight: 600;
      font-size: 14px;
      animation: slideDown 0.3s ease-out;
      border-radius: 8px;
      pointer-events: auto;
      border: 1px solid rgba(255,255,255,0.2);
    `;
    
    banner.textContent = message;
    document.body.appendChild(banner);

    if (duration > 0) {
        setTimeout(() => {
            banner.style.opacity = '0';
            banner.style.transition = 'opacity 0.5s';
            setTimeout(() => banner.remove(), 500);
        }, duration);
    }
};

export const showUpdateNotification = (newHash) => {
    if (document.getElementById('gg-update-banner')) return;
    
    if (!document.body) {
        setTimeout(() => showUpdateNotification(newHash), 500);
        return;
    }

    const banner = document.createElement('div');
    banner.id = 'gg-update-banner';
    banner.style.cssText = `
      position: fixed;
      top: 24px;
      left: 24px;
      width: 340px;
      background: rgba(26, 26, 46, 0.95);
      backdrop-filter: blur(12px);
      color: #fff;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 999999;
      box-shadow: 0 10px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(121, 80, 229, 0.4);
      font-family: "Neo Sans", "Segoe UI", sans-serif;
      border-radius: 12px;
      animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: auto;
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(-120%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .gg-close-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    `;
    document.head.appendChild(style);

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;';

    const titleGroup = document.createElement('div');
    titleGroup.style.cssText = 'display: flex; gap: 12px; align-items: center;';

    const icon = document.createElement('div');
    icon.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="20" height="20" rx="8" fill="#7950E5"/>
        <path d="M12 16L12 8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 13L12 16L15 13" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    
    const textGroup = document.createElement('div');
    textGroup.innerHTML = `
      <div style="font-weight: 800; font-size: 16px; letter-spacing: 0.5px;">UPDATE AVAILABLE</div>
      <div style="font-size: 13px; color: #a4a4b5; margin-top: 2px;">GhostGuessr UserScript</div>
    `;

    titleGroup.appendChild(icon);
    titleGroup.appendChild(textGroup);

    const closeBtn = document.createElement('div');
    closeBtn.className = 'gg-close-btn';
    closeBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #a4a4b5;">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    closeBtn.style.cssText = `
      cursor: pointer;
      padding: 4px;
      border-radius: 50%;
      display: flex;
      transition: background 0.2s;
    `;
    closeBtn.onclick = () => {
      if (typeof GG.dismissUpdate === 'function') {
        GG.dismissUpdate(newHash);
      } else {
        banner.remove();
      }
    };

    header.appendChild(titleGroup);
    header.appendChild(closeBtn);

    const message = document.createElement('div');
    message.style.cssText = 'background: rgba(121, 80, 229, 0.1); border-radius: 8px; padding: 12px; border: 1px solid rgba(121, 80, 229, 0.2);';
    message.innerHTML = `
      <div style="display: flex; gap: 10px; align-items: flex-start;">
        <div style="font-size: 13px; line-height: 1.5; color: #eaeaef;">
          <span style="color: #7950E5; font-weight: 700;">Please re-patch!</span><br>
          Open the <b>GhostGuessr Patcher</b> on your desktop to install the latest version.
        </div>
      </div>
    `;

    banner.appendChild(header);
    banner.appendChild(message);

    document.body.appendChild(banner);
};
