/**
 * 新版扩展番外模块。
 * 对应新版游戏的 TYRANO.kag.dc.additionalNgSceneData()。
 */
(function() {
	'use strict';

	const modloader = window.modloaderApi;
	const factory = modloader.DataModuleFactory;
	const OPTIONAL_SOURCE = 'game-resources/data/others/omake_ex.js';
	const MAX_WAIT_ATTEMPTS = 30;
	let waitAttempts = 0;
	let unsupported = false;

	function markUnsupported(reason) {
		if (unsupported) return;
		unsupported = true;
		console.info('[ModLoader API] 扩展番外助手已停用: ' + reason);
	}

	function hasOptionalSource() {
		const fileApi = window.modloader;
		if (!fileApi || typeof fileApi.statSync !== 'function') return null;
		try {
			const stat = fileApi.statSync(OPTIONAL_SOURCE);
			if (!stat) return false;
			return typeof stat.isFile === 'function' ? stat.isFile() : stat.isFile === true;
		} catch (error) {
			return null;
		}
	}

	factory.createArrayHookModule({
		tag: '扩展番外助手',
		color: '#673ab7',
		retryInterval: 500,
		apiPath: 'omake.ex',
		stateKey: 'entries',
		enablePatch: true,
		checkReady: function() {
			try {
				if (unsupported) return true;
				if (typeof TYRANO !== 'undefined' && TYRANO.kag && TYRANO.kag.dc &&
					typeof TYRANO.kag.dc.additionalNgSceneData === 'function') return true;

				const sourceExists = hasOptionalSource();
				if (sourceExists === false) {
					markUnsupported('当前游戏资源不存在 data/others/omake_ex.js');
					return true;
				}
				if (++waitAttempts >= MAX_WAIT_ATTEMPTS) {
					markUnsupported(sourceExists === true
						? '等待 additionalNgSceneData 超时'
						: '无法确认 omake_ex.js 支持状态，已停止等待');
					return true;
				}
				return false;
			} catch (error) {
				return false;
			}
		},
		shouldSkipHook: function() {
			return unsupported;
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
			return unsupported ? [] : TYRANO.kag.dc.additionalNgSceneData();
		}
	});
})();
