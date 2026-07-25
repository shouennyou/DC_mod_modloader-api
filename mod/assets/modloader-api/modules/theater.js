/**
 * 剧场模块。
 */
(function() {
	'use strict';

	const helper = modloader.ModHelper;
	const factory = modloader.CollectionModuleFactory;

	factory.createCollectionModule({
		tag: '剧场助手',
		color: '#00bcd4',
		apiPath: 'gekizyou',
		defaultKey: 'gekizyouNumbers',
		checkReady: function() {
			try {
				return typeof TYRANO !== 'undefined' && TYRANO.kag && TYRANO.kag.dc && Array.isArray(TYRANO.kag.dc.gekizyouNumbers);
			} catch (error) {
				return false;
			}
		},
		getCollectionKey: function() {
			return 'gekizyouNumbers';
		},
		getPayloadData: function(item) {
			return item.data;
		},
		ensureCollection: function() {},
		writeCollection: function(key, nextList) {
			TYRANO.kag.dc.gekizyouNumbers = helper.uniqueArray(nextList);
		},
		getAvailableKeys: function() {
			return ['gekizyouNumbers'];
		},
		logRegister: function(runtime, key, mode, values) {
			runtime.logRegisterSuccess(`模式 [${mode}]`, [`新增编号: [${values.join(', ')}]`]);
		},
		getRawData: function() {
			return TYRANO.kag.dc.gekizyouNumbers || [];
		}
	});
})();
