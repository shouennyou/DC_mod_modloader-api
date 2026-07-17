/**
 * 贴纸模块。
 */
(function() {
	'use strict';

	const factory = modloader.DataModuleFactory;

	factory.createArrayHookModule({
		tag: '贴纸助手',
		color: '#e91e63',
		apiPath: 'sticker',
		stateKey: 'entries',
		checkReady: function() {
			try {
				return typeof TYRANO !== 'undefined' && TYRANO.kag && TYRANO.kag.dc && typeof TYRANO.kag.dc.stickerData === 'function';
			} catch (error) {
				return false;
			}
		},
		getSource: function() {
			return TYRANO.kag.dc.stickerData;
		},
		setSource: function(fn) {
			TYRANO.kag.dc.stickerData = fn;
		},
		validateEntry: function(entry) {
			return !!(entry && entry.data && entry.data.file);
		},
		getEntryName: function(entry) {
			return entry && entry.data && entry.data.name ? entry.data.name : '未知贴纸';
		},
		matcher: function(target, finalItem) {
			return target && finalItem && target.file == finalItem.file;
		},
		resolveItemData: true,
		logRegister: function(runtime, entry) {
			const data = entry.data;
			const descDisplay = typeof data.desc === 'function' ? '[动态逻辑]' : data.desc;
			runtime.logRegisterSuccess(data.name, [
				`文件编号: [${data.file}]`,
				`描述预览: [${descDisplay || '无'}]`
			]);
		},
		readAll: function() {
			return TYRANO.kag.dc.stickerData();
		}
	});
})();
