/**
 * 画廊模块。
 */
(function() {
	'use strict';

	const factory = modloader.DataModuleFactory;

	factory.createArrayHookModule({
		tag: '画廊助手',
		color: '#ff9800',
		apiPath: 'gallery',
		stateKey: 'entries',
		checkReady: function() {
			try {
				return typeof TYRANO !== 'undefined' && TYRANO.kag && TYRANO.kag.dc && typeof TYRANO.kag.dc.galleryData === 'function';
			} catch (error) {
				return false;
			}
		},
		getSource: function() {
			return TYRANO.kag.dc.galleryData;
		},
		setSource: function(fn) {
			TYRANO.kag.dc.galleryData = fn;
		},
		validateEntry: function(entry) {
			return !!(entry && entry.data && entry.data.name);
		},
		getEntryName: function(entry) {
			return entry && entry.data && entry.data.title ? entry.data.title : '未知画廊';
		},
		matcher: function(target, finalItem) {
			return target && finalItem && target.name === finalItem.name;
		},
		resolveItemData: false,
		logRegister: function(runtime, entry) {
			const data = entry.data;
			runtime.logRegisterSuccess(data.title, [
				`内部标识: [${data.name}]`,
				`资源数量: [${data.storages && data.storages.length ? data.storages.length : 0} 张]`
			]);
		},
		readAll: function() {
			return TYRANO.kag.dc.galleryData();
		}
	});
})();
