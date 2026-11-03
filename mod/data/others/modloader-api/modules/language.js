/**
 * Tyrano 语言文本模块。
 */
(function() {
	'use strict';

	const modloader = window.modloaderApi;
	const helper = modloader.ModHelper;
	const runtime = modloader.ModuleRuntime.createRuntime({
		tag: '语言文本助手',
		color: '#8bc34a',
		retryInterval: 1000
	});
	const moduleApi = helper.ensurePath(modloader, 'lang');
	const state = { entries: [] };

	function isObject(value) {
		return value && typeof value === 'object' && !Array.isArray(value);
	}

	function resolveValue(value, thisArg, context) {
		if (typeof value === 'function') return value.call(thisArg, context.f, context.sf);
		if (Array.isArray(value)) return value.map(item => resolveValue(item, thisArg, context));
		if (!isObject(value)) return value;
		return Object.keys(value).reduce((result, key) => {
			result[key] = resolveValue(value[key], thisArg, context);
			return result;
		}, {});
	}

	function mergeObject(target, source, mode) {
		Object.keys(source).forEach(key => {
			const value = source[key];
			if (isObject(value) && isObject(target[key])) {
				mergeObject(target[key], value, mode);
				return;
			}
			if (mode === 'append' && Object.prototype.hasOwnProperty.call(target, key)) return;
			target[key] = value;
		});
		return target;
	}

	function checkReady() {
		return isObject(window.tyrano_lang);
	}

	function registerEntries(list) {
		if (!Array.isArray(list)) {
			runtime.logError('注册失败: 必须传入数组');
			return null;
		}
		const registered = [];
		list.forEach(entry => {
			try {
				if (!entry || !isObject(entry.data) || Object.keys(entry.data).length === 0) return;
				const mode = helper.normalizeMode(entry.mode, ['append', 'override'], 'append');
				const stored = { mode, source: entry.data, applied: false };
				state.entries.push(stored);
				registered.push(stored);
				applyEntry(stored, this);
				if (runtime.settings.debug) runtime.logRegisterSuccess('语言文本', [
					`注入模式: [${mode}]`,
					`注入分组: [${Object.keys(entry.data).join(', ')}]`
				]);
			} catch (error) {
				runtime.logError('注册异常: 语言文本', error);
			}
		});
		return registered.length > 0 ? registered : null;
	}

	function applyEntry(entry, thisArg) {
		if (entry.applied || !checkReady()) return;
		const data = resolveValue(entry.source, thisArg, helper.getTyranoContext());
		mergeObject(window.tyrano_lang, data, entry.mode);
		entry.data = data;
		entry.applied = true;
	}

	runtime.initialize(checkReady, function() {
		state.entries.forEach(function(entry) { applyEntry(entry, moduleApi); });
		moduleApi.show = function() {
			return checkReady() ? window.tyrano_lang : null;
		};
	});
	moduleApi.register = registerEntries;
	moduleApi.show = function() {
		return checkReady() ? window.tyrano_lang : null;
	};
})();
