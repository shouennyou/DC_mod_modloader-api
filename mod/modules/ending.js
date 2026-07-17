/**
 * 结局模块。
 */
(function() {
	'use strict';

	const helper = modloader.ModHelper;
	const factory = modloader.DataModuleFactory;

	factory.createObjectHookModule({
		tag: '结局助手',
		color: '#e91e63',
		apiPath: 'ending',
		checkReady: function() {
			try {
				return typeof TYRANO !== 'undefined' && TYRANO.kag && TYRANO.kag.dc && TYRANO.kag.dc._ends;
			} catch (error) {
				return false;
			}
		},
		getSource: function() {
			return TYRANO.kag.dc._ends;
		},
		setSource: function(fn) {
			TYRANO.kag.dc._ends = fn;
		},
		cloneSource: function(baseData) {
			return Object.assign({}, baseData || {});
		},
		validateEntry: function(entry) {
			return !!(entry && entry.data && entry.data.title);
		},
		getEntryName: function(entry) {
			return entry && entry.data && entry.data.title ? entry.data.title : '未知结局';
		},
		logRegister: function(runtime, entry) {
			const data = entry.data;
			const rawPhrase = helper.stringifyValue(data.phrase);
			const phraseDisplay = rawPhrase.length > 50 ? `${rawPhrase.substring(0, 50)}...` : rawPhrase;
			runtime.logRegisterSuccess(data.title, [
				`结局分类: [${data.category || 'normal'}]`,
				`注入内容: [${phraseDisplay || '无'}]`,
				`解锁条件: [${helper.stringifyValue(data.cond) || '无'}]`,
				`触发时机: [${data.timing || '未定义'}]`,
				`注入模式: [${entry.mode || 'append'}${entry.id !== undefined ? ` (ID:${entry.id})` : ''}]`
			]);
		},
		injectEntry: function(target, entry, thisArg) {
			let targetId;
			const mode = helper.normalizeMode(entry.mode, ['append', 'fixed'], 'append');
			if (mode === 'fixed' && entry.id !== undefined) {
				targetId = entry.id;
			} else {
				const keys = Object.keys(target).map(Number).filter(function(n) { return !isNaN(n); });
				targetId = keys.length > 0 ? Math.max.apply(null, keys) + 1 : 0;
			}
			target[targetId] = helper.resolveObjectSafe(entry.data, thisArg, helper.getTyranoContext(), {
				onError: function(error) {
					return `[动态解析错误: ${error.message}]`;
				}
			});
		},
		readAll: function() {
			return TYRANO.kag.dc._ends();
		}
	});
})();
