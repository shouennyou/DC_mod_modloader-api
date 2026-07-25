/**
 * 角色资料模块。
 */
(function() {
	'use strict';

	const helper = modloader.ModHelper;
	const factory = modloader.DataModuleFactory;

	factory.createArrayHookModule({
		tag: '角色助手',
		color: '#2196f3',
		apiPath: 'chara.profile',
		stateKey: 'entries',
		allowedModes: ['append', 'prepend'],
		defaultMode: 'append',
		checkReady: function() {
			try {
				return typeof TYRANO !== 'undefined' && TYRANO.kag && TYRANO.kag.dc && typeof TYRANO.kag.dc.collectionCharaData === 'function';
			} catch (error) {
				return false;
			}
		},
		getSource: function() {
			return TYRANO.kag.dc.collectionCharaData;
		},
		setSource: function(fn) {
			TYRANO.kag.dc.collectionCharaData = fn;
		},
		validateEntry: function(entry) {
			return !!(entry && entry.data && entry.data.name);
		},
		getEntryName: function(entry) {
			return entry && entry.data && entry.data.name ? entry.data.name : '未知角色';
		},
		matcher: function() {
			return false;
		},
		logRegister: function(runtime, entry) {
			const data = entry.data;
			const rawDesc = helper.stringifyValue(data.description);
			const descDisplay = rawDesc.length > 50 ? `${rawDesc.substring(0, 50)}...` : rawDesc;
			runtime.logRegisterSuccess(data.name, [
				`角色编号: [${data.no || '未定义'}]`,
				`描述预览: [${descDisplay || '无'}]`,
				`种族分类: [${data.breed || '-'}] / [${data.category || 'normal'}]`
			]);
		},
		readAll: function() {
			return TYRANO.kag.dc.collectionCharaData();
		}
	});
})();
