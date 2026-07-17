/**
 * 番外模块。
 */
(function() {
	'use strict';

	const factory = modloader.DataModuleFactory;

	factory.createArrayHookModule({
		tag: '番外助手',
		color: '#9c27b0',
		apiPath: 'omake',
		stateKey: 'entries',
		checkReady: function() {
			try {
				return typeof TYRANO !== 'undefined' && TYRANO.kag && TYRANO.kag.dc && typeof TYRANO.kag.dc.ngSceneData === 'function';
			} catch (error) {
				return false;
			}
		},
		getSource: function() {
			return TYRANO.kag.dc.ngSceneData;
		},
		setSource: function(fn) {
			TYRANO.kag.dc.ngSceneData = fn;
		},
		validateEntry: function(entry) {
			return !!(entry && entry.data && entry.data.name);
		},
		getEntryName: function(entry) {
			return entry && entry.data && entry.data.title ? entry.data.title : '未知番外';
		},
		matcher: function(target, finalItem) {
			return target && finalItem && target.name === finalItem.name;
		},
		resolveItemData: false,
		logRegister: function(runtime, entry) {
			const data = entry.data;
			runtime.logRegisterSuccess(data.title, [
				`剧本文件: [${data.storage}.ks]`,
				`解锁条件: [${data.cond}]`
			]);
		},
		readAll: function() {
			return TYRANO.kag.dc.ngSceneData();
		}
	});
})();
