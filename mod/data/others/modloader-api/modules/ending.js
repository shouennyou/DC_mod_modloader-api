/**
 * 结局模块。
 */
(function() {
	'use strict';

	const modloader = window.modloaderApi;

	const helper = modloader.ModHelper;
	const factory = modloader.DataModuleFactory;

	// 结局类别与结局条目分别注入. 游戏仅在 secretEndOpenInCollection() 满足条件后显示秘密类别.
	const categoryModule = factory.createArrayHookModule({
		tag: '结局分类',
		color: '#e91e63',
		apiPath: 'ending.category',
		checkReady: function() {
			try {
				return typeof TYRANO !== 'undefined' && TYRANO.kag && TYRANO.kag.dc &&
					typeof TYRANO.kag.dc.endCategoryData === 'function';
			} catch (error) {
				return false;
			}
		},
		getSource: function() {
			return TYRANO.kag.dc.endCategoryData;
		},
		setSource: function(fn) {
			TYRANO.kag.dc.endCategoryData = fn;
		},
		allowedModes: ['append', 'prepend', 'override'],
		defaultMode: 'append',
		validateEntry: function(entry) {
			return !!(entry && entry.data && entry.data.name);
		},
		matcher: function(target, item) {
			return target && item && target.name === item.name;
		},
		logRegister: function(runtime, entry) {
			const data = entry.data || {};
			runtime.logRegisterSuccess(data.name, [
				`结局类别文本: [${helper.stringifyValue(data.text) || '未指定'}]`,
				`显示方式: [${data.visibility || data.display || 'always'}]`,
				`注入模式: [${entry.mode || 'append'}]`
			]);
		}
	});

	function installCategoryVisibilityHook() {
		try {
			if (typeof TYRANO === 'undefined' || !TYRANO.kag || !TYRANO.kag.dc) return;
			const dc = TYRANO.kag.dc;
			const original = dc.endCategoryNames;
			if (typeof original !== 'function' || original.__modloaderApiCategoryVisibilityHook) return;
			const wrapped = function() {
				let names = original.apply(this, arguments) || [];
				names = names.slice();
				const secretOpen = typeof this.secretEndOpenInCollection === 'function' &&
					this.secretEndOpenInCollection();
				const entries = categoryModule.state.items || [];
				const visibility = {};
				entries.forEach(function(entry) {
					const data = entry && entry.data;
					if (!data || !data.name) return;
					const value = String(data.visibility || data.display || 'always').toLowerCase();
					visibility[data.name] = value === 'secret' || value === 'locked' ? 'secret' : 'always';
				});
				// 游戏原始实现未解锁时只返回 `normal`, 因此先补充自定义的常驻类别, 再筛选秘密类别.
				entries.forEach(function(entry) {
					const data = entry && entry.data;
					if (!data || !data.name || visibility[data.name] === 'secret' && !secretOpen) return;
					if (!names.includes(data.name)) names.push(data.name);
				});
				return names.filter(function(name) {
					return visibility[name] !== 'secret' || !!secretOpen;
				});
			};
			wrapped.__modloaderApiCategoryVisibilityHook = true;
			dc.endCategoryNames = wrapped;
		} catch (error) {
			// 常规模块运行时会报告数据 hook 错误, 此处等待下一次轮询重试.
		}
	}

	if (typeof window.setInterval === 'function') window.setInterval(installCategoryVisibilityHook, 500);

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
