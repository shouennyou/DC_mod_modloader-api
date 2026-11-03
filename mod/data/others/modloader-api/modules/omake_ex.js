/**
 * 新版扩展番外模块。
 * 对应新版游戏的 TYRANO.kag.dc.additionalNgSceneData()。
 */
(function() {
	'use strict';

	const modloader = window.modloaderApi;
	const factory = modloader.DataModuleFactory;

	factory.createArrayHookModule({
		tag: '扩展番外助手',
		color: '#673ab7',
		apiPath: 'omake.ex',
		stateKey: 'entries',
		enablePatch: true,
		checkReady: function() {
			try {
				return typeof TYRANO !== 'undefined' && TYRANO.kag && TYRANO.kag.dc &&
					typeof TYRANO.kag.dc.additionalNgSceneData === 'function';
			} catch (error) {
				return false;
			}
		},
		getSource: function() {
			return TYRANO.kag.dc.additionalNgSceneData;
		},
		setSource: function(fn) {
			TYRANO.kag.dc.additionalNgSceneData = fn;
		},
		validateEntry: function(entry) {
			return !!(entry && entry.data && entry.data.name);
		},
		getEntryName: function(entry) {
			return entry && entry.data && entry.data.title ? entry.data.title : '未知扩展番外';
		},
		matcher: function(target, finalItem) {
			return target && finalItem && target.name === finalItem.name;
		},
		mergePatch: function(target, finalItem) {
			return Object.assign({}, target, finalItem);
		},
		resolveItemData: false,
		logRegister: function(runtime, entry) {
			let data = entry.data;
			try {
				const current = TYRANO.kag.dc.additionalNgSceneData();
				const effective = current.find(function(item) { return item && item.name === entry.data.name; });
				if (effective) data = effective;
			} catch (error) {
				// 引擎尚未就绪时退回显示提交的数据。
			}
			runtime.logRegisterSuccess(data.title || data.name, [
				`剧本文件: [${data.storage || '未指定'}.ks]`,
				`解锁条件: [${data.cond || '未指定'}]`,
				`注册模式: [${entry.mode || 'append'}]`
			]);
		},
		readAll: function() {
			return TYRANO.kag.dc.additionalNgSceneData();
		}
	});
})();
