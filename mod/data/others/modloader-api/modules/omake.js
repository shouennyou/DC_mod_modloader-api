/**
 * 番外模块。
 */
(function() {
	'use strict';

	const modloader = window.modloaderApi;

	const factory = modloader.DataModuleFactory;

	factory.createArrayHookModule({
		tag: '番外助手',
		color: '#9c27b0',
		apiPath: 'omake',
		stateKey: 'entries',
		enablePatch: true,
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
		mergePatch: function(target, finalItem) {
			return Object.assign({}, target, finalItem);
		},
		hasOriginalPatchTarget: function(originalFn, thisArg, args, finalItem) {
			const allItems = originalFn.apply(thisArg, [0, Number.MAX_SAFE_INTEGER]);
			return Array.isArray(allItems) && allItems.some(function(item) {
				return item && item.name === finalItem.name;
			});
		},
		resolveItemData: false,
		logRegister: function(runtime, entry) {
			let data = entry.data;
			try {
				const current = TYRANO.kag.dc.ngSceneData();
				const effective = current.find(function(item) { return item && item.name === entry.data.name; });
				if (effective) data = effective;
			} catch (error) {
				// 引擎尚未就绪时退回显示提交的差异数据。
			}
			runtime.logRegisterSuccess(data.title, [
				`剧本文件: [${data.storage}.ks]`,
				`解锁条件: [${data.cond}]`,
				`注册模式: [${entry.mode || 'append'}]`
			]);
		},
		readAll: function() {
			return TYRANO.kag.dc.ngSceneData();
		}
	});
})();
