/**
 * 核心工具与命名空间初始化。
 */
(function() {
	'use strict';

	const modloader = window.modloader || (window.modloader = {});
	const api = modloader.api || (modloader.api = {});

	function ensurePath(root, path) {
		return path.split('.').reduce((current, key) => {
			current[key] = current[key] || {};
			return current[key];
		}, root);
	}

	[
		'chara.profile',
		'chara.data.character',
		'chara.data.devil',
		'chara.setting',
		'ending',
		'word',
		'gallery',
		'omake',
		'gekizyou',
		'sticker',
		'script',
		'sysvar'
	].forEach(path => ensurePath(api, path));

	if (modloader.ModHelper) return;

	function createLogger(tag, color) {
		return {
			logTag: `[ModLoader - %c${tag}%c]`,
			tagStyle: `color: ${color}; font-weight: bold;`,
			successStyle: 'color: #4caf50; font-weight: bold;',
			errorStyle: 'color: #f44336; font-weight: bold;',
			resetStyle: 'color: inherit; font-weight: normal;'
		};
	}

	function getTyranoContext() {
		const kag = window.TYRANO && TYRANO.kag;
		return {
			f: (kag && kag.stat && kag.stat.f) || {},
			sf: (kag && kag.variable && kag.variable.sf) || {}
		};
	}

	function stringifyValue(value) {
		if (typeof value === 'function') return value.toString().replace(/\s+/g, ' ');
		if (value === undefined || value === null) return '';
		return String(value);
	}

	function previewValue(value, maxLength) {
		const text = stringifyValue(value);
		const limit = typeof maxLength === 'number' ? maxLength : 50;
		return text.length > limit ? `${text.substring(0, limit)}...` : text;
	}

	function resolveObject(source, thisArg, context) {
		const finalData = {};
		const runtime = context || getTyranoContext();
		Object.keys(source || {}).forEach(key => {
			const value = source[key];
			finalData[key] = typeof value === 'function' ? value.call(thisArg, runtime.f, runtime.sf) : value;
		});
		return finalData;
	}

	function resolveObjectSafe(source, thisArg, context, options) {
		const finalData = {};
		const runtime = context || getTyranoContext();
		const settings = options || {};
		const shouldResolve = settings.shouldResolve || function() { return true; };
		const onError = settings.onError || function(error) { return `[解析错误: ${error.message}]`; };

		Object.keys(source || {}).forEach(key => {
			const value = source[key];
			if (typeof value === 'function' && shouldResolve(key, value)) {
				try {
					finalData[key] = value.call(thisArg, runtime.f, runtime.sf);
				} catch (error) {
					finalData[key] = onError(error, key, value);
				}
			} else {
				finalData[key] = value;
			}
		});
		return finalData;
	}

	function waitUntilReady(checkReady, retryInterval, init) {
		if (!checkReady()) {
			setTimeout(function() {
				waitUntilReady(checkReady, retryInterval, init);
			}, retryInterval);
			return false;
		}
		init();
		return true;
	}

	function ensureArray(value) {
		if (Array.isArray(value)) return value;
		if (value === undefined || value === null) return [];
		return [value];
	}

	function uniqueArray(list) {
		return Array.from(new Set(ensureArray(list)));
	}

	function insertByMode(list, item, mode) {
		if (mode === 'prepend') list.unshift(item);
		else list.push(item);
		return list;
	}

	function normalizeMode(mode, allowedModes, fallbackMode) {
		const allowed = Array.isArray(allowedModes) && allowedModes.length > 0 ? allowedModes : ['append'];
		const fallback = fallbackMode || allowed[0];
		const raw = typeof mode === 'string' ? mode.trim().toLowerCase() : '';
		const normalized = raw || fallback;
		return allowed.includes(normalized) ? normalized : fallback;
	}

	function replaceArrayContents(list, items) {
		list.splice(0, list.length, ...ensureArray(items));
		return list;
	}

	function upsertBy(list, item, mode, matcher) {
		const index = list.findIndex(matcher);
		if (index !== -1) {
			list[index] = item;
			return true;
		}
		insertByMode(list, item, mode);
		return false;
	}

	function applyArrayItemMode(list, item, mode, matcher) {
		const normalized = normalizeMode(mode, ['append', 'prepend', 'override'], 'append');
		if (normalized === 'override' && typeof matcher === 'function') {
			upsertBy(list, item, 'append', matcher);
			return list;
		}
		insertByMode(list, item, normalized);
		return list;
	}

	function applyArrayBatchMode(list, items, mode, matcher) {
		const normalized = normalizeMode(mode, ['append', 'prepend', 'override', 'replace'], 'append');
		const batch = ensureArray(items);
		if (normalized === 'replace') return replaceArrayContents(list, batch);
		if (normalized === 'prepend') {
			for (let i = batch.length - 1; i >= 0; i--) applyArrayItemMode(list, batch[i], 'prepend', matcher);
			return list;
		}
		batch.forEach(item => applyArrayItemMode(list, item, normalized, matcher));
		return list;
	}

	function cloneShallow(data) {
		if (Array.isArray(data)) {
			return data.map(item => item && typeof item === 'object' ? Object.assign({}, item) : item);
		}
		if (data && typeof data === 'object') return Object.assign({}, data);
		return data;
	}

	modloader.ModHelper = {
		ensurePath,
		createLogger,
		getTyranoContext,
		stringifyValue,
		previewValue,
		resolveObject,
		resolveObjectSafe,
		waitUntilReady,
		ensureArray,
		uniqueArray,
		normalizeMode,
		insertByMode,
		replaceArrayContents,
		applyArrayItemMode,
		applyArrayBatchMode,
		upsertBy,
		cloneShallow
	};
})();
