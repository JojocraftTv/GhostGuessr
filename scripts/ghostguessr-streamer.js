(function () {
  "use strict";

  const GG = window.GhostGuessr;

  if (GG.isSteam || GG.isElectron) {
    console.log("[GG Streamer Mode] Disabled in Steam environment");
    return;
  }

  const ANONYMOUS_NAMES = [
    "Player", "User", "Guesser", "Explorer", "Traveler", 
    "Navigator", "Mapper", "Wanderer", "Scout", "Adventurer"
  ];
  
  const PLACEHOLDER_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='144' height='144'%3E%3Crect fill='%23666' width='144' height='144'/%3E%3Ctext x='50%25' y='50%25' font-size='48' fill='%23ccc' text-anchor='middle' dy='.3em'%3E%3F%3C/text%3E%3C/svg%3E";

  const processedElements = new WeakSet();
  let anonymousCounter = 0;

  function getAnonymousName(index) {
    const baseName = ANONYMOUS_NAMES[index % ANONYMOUS_NAMES.length];
    const number = Math.floor(index / ANONYMOUS_NAMES.length) + 1;
    return number > 1 ? `${baseName}${number}` : baseName;
  }

  function anonymizeUsernames() {
    if (!GG.settings || !GG.settings.streamerMode) return;

    const userNickSelectors = [
      '.user-nick_nick__sRjZ2',
      '.header-profile_title__vqkkK label',
      '._token__container__qvdIo label',
      '.chat-friend_name__V0nzL',
      '.stylized-text_main__5S_jb',
      '[class*="player-name"]',
      '[class*="userName"]',
      '[class*="user-name"]',
      '[class*="nickname"]',
      '[class*="teamName"]',
      '[class*="team-name"]',
      '[class*="name"]',
      '[class*="username"]',
      '[class*="nick"]',
      '[class*="playerNick"]'
    ]; // TODO: Add more selectors if needed

    userNickSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (processedElements.has(el)) return;
        
        const originalText = el.textContent.trim();
        
        if (!originalText || 
            originalText.length < 2 || 
            originalText.length > 30 ||
            originalText.startsWith('Player') || 
            originalText.startsWith('User') || 
            originalText.startsWith('Guesser') ||
            originalText.startsWith('Waiting') ||
            originalText.includes('...') ||
            /^\d+$/.test(originalText)) {
          return;
        }
        
        processedElements.add(el);
        el.textContent = getAnonymousName(anonymousCounter++);
        el.setAttribute('data-original', originalText);
      });
    });
  }

  function hideClubTags() {
    const clubTagSelectors = [
      '[class*="clubTag"]',
      '[class*="club-tag"]',
      '[class*="club"]',
      '[class*="tag"]'
    ];

    // TODO: Add more selectors if needed
    if (!GG.settings || !GG.settings.streamerMode) return;

    clubTagSelectors.forEach(selector => {
      const clubTags = document.querySelectorAll(selector);
      clubTags.forEach(tag => {
        if (!processedElements.has(tag)) {
          processedElements.add(tag);
          tag.style.display = 'none';
        }
      });
    });
  }

  function hideFlags() {
    const flagSelectors = [
      '[class*="flag"]'
    ];

    // TODO: Add more selectors if needed
    if (!GG.settings || !GG.settings.streamerMode) return;

    flagSelectors.forEach(selector => {
      const flags = document.querySelectorAll(selector);
      flags.forEach(flag => {
        if (!processedElements.has(flag)) {
          processedElements.add(flag);
          flag.style.display = 'none';
        }
      });
    });
  }

  function anonymizeAvatars() {
    if (!GG.settings || !GG.settings.streamerMode) return;

    const avatarContainers = document.querySelectorAll('.avatar_titleAvatarImage__sXIP7, .play-along-standings_avatar__2FtjJ');
    
    avatarContainers.forEach(container => {
      if (processedElements.has(container)) return;
      processedElements.add(container);
      
      const images = container.querySelectorAll('img');
      
      images.forEach((img, index) => {
        if (index === 0) {
          if (!img.src.startsWith('data:')) {
            img.setAttribute('data-original-src', img.src);
            img.src = PLACEHOLDER_AVATAR;
          }
        } else {
          img.style.display = 'none';
        }
      });
    });
  }

  function anonymizeMapPins() {
    if (!GG.settings || !GG.settings.streamerMode) return;

    const mapPinImages = document.querySelectorAll('[data-qa="guess-marker"] img, .map-pin_mapPin__vG6pA img');
    
    mapPinImages.forEach(img => {
      if (processedElements.has(img)) return;
      processedElements.add(img);
      
      if (img.alt && img.alt.length > 0) {
        img.setAttribute('data-original-alt', img.alt);
        img.alt = getAnonymousName(anonymousCounter++);
      }
      
      if (img.src && !img.src.startsWith('data:')) {
        img.setAttribute('data-original-src', img.src);
        img.src = PLACEHOLDER_AVATAR;
      }
    });
  }

  function restoreOriginals() {
    const usernameElements = document.querySelectorAll('[data-original]');
    usernameElements.forEach(el => {
      const original = el.getAttribute('data-original');
      if (original) {
        el.textContent = original;
        el.removeAttribute('data-original');
      }
      processedElements.delete(el);
    });

    const clubTags = document.querySelectorAll('.club-tag_clubTag__UquGW');
    clubTags.forEach(tag => {
      tag.style.display = '';
      processedElements.delete(tag);
    });

    const flags = document.querySelectorAll('.user-nick_flag__24EXB, .country-flag_flag__tlHIr');
    flags.forEach(flag => {
      flag.style.display = '';
      processedElements.delete(flag);
    });

    const avatarContainers = document.querySelectorAll('.avatar_titleAvatarImage__sXIP7, .play-along-standings_avatar__2FtjJ');
    avatarContainers.forEach(container => {
      const images = container.querySelectorAll('img');
      images.forEach((img, index) => {
        if (index === 0) {
          const originalSrc = img.getAttribute('data-original-src');
          if (originalSrc) {
            img.src = originalSrc;
            img.removeAttribute('data-original-src');
          }
        } else {
          img.style.display = '';
        }
      });
      processedElements.delete(container);
    });

    const mapPinImages = document.querySelectorAll('img[data-original-alt], img[data-original-src]');
    mapPinImages.forEach(img => {
      const originalAlt = img.getAttribute('data-original-alt');
      if (originalAlt) {
        img.alt = originalAlt;
        img.removeAttribute('data-original-alt');
      }
      
      const originalSrc = img.getAttribute('data-original-src');
      if (originalSrc) {
        img.src = originalSrc;
        img.removeAttribute('data-original-src');
      }
      
      processedElements.delete(img);
    });

    anonymousCounter = 0;
  }

  GG.applyStreamerMode = function() {
    if (!GG.settings || !GG.settings.streamerMode) {
      restoreOriginals();
      return;
    }
    
    anonymizeUsernames();
    hideClubTags();
    hideFlags();
    anonymizeAvatars();
    anonymizeMapPins();
  };

  GG.toggleStreamerMode = function() {
    GG.settings.streamerMode = !GG.settings.streamerMode;
    GG.saveSettings();
    GG.applyStreamerMode();
  };

  const observer = new MutationObserver(() => {
    if (GG.settings && GG.settings.streamerMode) {
      setTimeout(() => {
        GG.applyStreamerMode();
      }, 50);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  if (GG.settings && GG.settings.streamerMode) {
    GG.applyStreamerMode();
  }

  console.log("[GG Streamer Mode] Initialized");
})();
