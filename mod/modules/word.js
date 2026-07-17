/**
 * 词汇模块。
 */
(function() {
	'use strict';

	const helper = modloader.ModHelper;
	const factory = modloader.CollectionModuleFactory;

	factory.createCollectionModule({
		tag: '词汇助手',
		color: '#00bcd4',
		apiPath: 'word',
		defaultKey: 'ngWords',
		checkReady: function() {
			try {
				return typeof TYRANO !== 'undefined' && TYRANO.kag && TYRANO.kag.dc && Array.isArray(TYRANO.kag.dc.ngWords);
			} catch (error) {
				return false;
			}
		},
		getCollectionKey: function(item) {
			return item.type || 'ngWords';
		},
		getPayloadData: function(item) {
			return item.data;
		},
		ensureCollection: function(key) {
			if (typeof TYRANO.kag.dc[key] === 'undefined') TYRANO.kag.dc[key] = [];
		},
		writeCollection: function(key, nextList) {
			TYRANO.kag.dc[key] = helper.uniqueArray(nextList);
		},
		getAvailableKeys: function(collections) {
			return Array.from(new Set([
				...Object.keys(TYRANO.kag.dc).filter(function(key) { return key.endsWith('Words') && Array.isArray(TYRANO.kag.dc[key]); }),
				...Object.keys(collections)
			]));
		},
		logRegister: function(runtime, key, mode, values) {
			runtime.logRegisterSuccess(key, [
				`注入模式: [${mode}]`,
				`注入数量: [${values.length} 个词汇]`
			]);
		},
		getRawData: function(keys) {
			return keys.reduce(function(acc, key) {
				acc[key] = TYRANO.kag.dc[key] || [];
				return acc;
			}, {});
		}
	});
})();
