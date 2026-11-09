const config = require('../../config');

Page({
  onLoad(options) {
    if (wx.showShareMenu) {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline'],
      });
    }

    // 支持从小程序分享卡片直接带房间号进入牌桌。
    if (options && options.room) {
      wx.navigateTo({ url: `/pages/game/game?room=${encodeURIComponent(options.room)}` });
    }
  },

  enterGame() {
    wx.navigateTo({ url: '/pages/game/game' });
  },

  onShareAppMessage() {
    return {
      title: config.shareTitle,
      path: '/pages/index/index',
      imageUrl: '/assets/share.jpg',
    };
  },

  onShareTimeline() {
    return {
      title: config.shareTitle,
      imageUrl: '/assets/share.jpg',
    };
  },

  onAddToFavorites() {
    return {
      title: config.shareTitle,
      imageUrl: '/assets/share.jpg',
    };
  },
});