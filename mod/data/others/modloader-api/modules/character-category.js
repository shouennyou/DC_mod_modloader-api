/**
 * 角色图鉴分类模块。
 */
(function() {
	'use strict';

	const modloader = window.modloaderApi;
	const helper = modloader.ModHelper;
	const runtime = modloader.ModuleRuntime.createRuntime({
		tag: '角色分类助手',
		color: '#2196f3',
		retryInterval: 100
	});
	const api = helper.ensurePath(modloader, 'chara.category');
	const state = { entries: [], patchEntries: [] };
	const hookKey = '__modloaderApiCharaCategoryHook';

	function getDc() {
		return typeof TYRANO !== 'undefined' && TYRANO.kag ? TYRANO.kag.dc : null;
	}

	function checkReady() {
		const dc = getDc();
		return !!(dc && typeof dc.collectionCharaCategoryData === 'function' &&
			typeof dc.characterCount === 'function' && typeof dc.collectedCharacterCount === 'function' &&
			typeof dc.totalCharacters === 'function' && typeof dc.collectedTotalCharacters === 'function');
	}

	function normalizeVisibility(value) {
		return value === 'allCharasOpen' ? 'allCharasOpen' : 'always';
	}

	function isVisible(entry, allCharasOpen) {
		return normalizeVisibility(entry.data.visibility) === 'always' || allCharasOpen;
	}

	function countedCategories(allCharasOpen) {
		const names = ['beast'];
		state.entries.forEach(function(entry) {
			if (!isVisible(entry, allCharasOpen)) return;
			const name = entry.data.name;
			if (!names.includes(name)) names.push(name);
		});
		return names;
	}

	function getCategoryText(entry, thisArg) {
		if (entry.data.text !== undefined) {
			return typeof entry.data.text === 'function'
				? entry.data.text.call(thisArg, helper.getTyranoContext().f, helper.getTyranoContext().sf)
				: entry.data.text;
		}
		try {
			return $.lang('collection').chara[entry.data.name];
		} catch (error) {
			return entry.data.name;
		}
	}

	function injectCategories(originalData, thisArg) {
		const categories = Array.isArray(originalData) ? originalData.slice() : [];
		const dc = getDc();
		const allCharasOpen = !!(dc && typeof dc.allCharasOpenInCollection === 'function' && dc.allCharasOpenInCollection());

		state.entries.forEach(function(entry) {
			if (!isVisible(entry, allCharasOpen)) return;
			const category = { name: entry.data.name, text: getCategoryText(entry, thisArg) };
			const index = categories.findIndex(function(item) { return item && item.name === category.name; });
			const mode = helper.normalizeMode(entry.mode, ['append', 'prepend', 'override'], 'append');
			if (index !== -1 && mode === 'override') categories[index] = category;
			else if (index === -1 && mode === 'prepend') categories.unshift(category);
			else if (index === -1) categories.push(category);
		});

		state.patchEntries.forEach(function(entry) {
			const index = categories.findIndex(function(item) {
				return item && item.name === entry.data.name;
			});
			if (index !== -1) {
				const patch = {};
				if (entry.data.text !== undefined) patch.text = getCategoryText(entry, thisArg);
				categories[index] = Object.assign({}, categories[index], patch);
			} else if (entry.appendIfMissing === true && isVisible(entry, allCharasOpen)) {
				categories.push({ name: entry.data.name, text: getCategoryText(entry, thisArg) });
			}
		});
		return categories;
	}

	function characterNamesForCategories(dc, categories) {
		return dc.collectionCharaData()
			.filter(function(chara) { return chara && categories.includes(chara.category) && chara.no !== '00'; })
			.map(function(chara) { return chara.name; });
	}

	function totalForCategories(dc, categories) {
		return dc.collectionCharaData()
			.filter(function(chara) { return chara && chara.name !== '  ' && categories.includes(chara.category); })
			.length;
	}

	function hook(name, transform) {
		const dc = getDc();
		if (!dc || typeof dc[name] !== 'function' || dc[name][hookKey]) return;
		const original = dc[name];
		const wrapped = function() {
			const originalResult = original.apply(this, arguments);
			return transform.call(this, originalResult);
		};
		wrapped[hookKey] = true;
		dc[name] = wrapped;
	}

	function applyHooks() {
		if (!checkReady()) return;
		hook('collectionCharaCategoryData', function(data) {
			return injectCategories(data, this);
		});
		hook('characterCount', function(data) {
			const dc = getDc();
			const sf = TYRANO.kag.variable.sf;
			if (sf.allCharactersOpen) return data;
			const names = characterNamesForCategories(dc, countedCategories(dc.allCharasOpenInCollection()));
			return sf.characters.filter(function(name) { return names.includes(name); }).length;
		});
		hook('collectedCharacterCount', function(data) {
			const dc = getDc();
			const sf = TYRANO.kag.variable.sf;
			const allCharasOpen = dc.allCharasOpenInCollection();
			if (allCharasOpen) return data;
			const names = characterNamesForCategories(dc, countedCategories(false));
			return sf.collectedCharacters.filter(function(name) { return names.includes(name); }).length;
		});
		hook('totalCharacters', function(data) {
			const dc = getDc();
			if (TYRANO.kag.variable.sf.allCharactersOpen) return data;
			return totalForCategories(dc, countedCategories(dc.allCharasOpenInCollection()));
		});
		hook('collectedTotalCharacters', function(data) {
			const dc = getDc();
			if (dc.allCharasOpenInCollection()) return data;
			return totalForCategories(dc, countedCategories(false));
		});
	}

	function registerEntries(list) {
		if (!Array.isArray(list)) {
			runtime.logError('注册失败: 必须传入数组');
			return null;
		}

		const registered = [];
		list.forEach(function(entry) {
			try {
				if (!entry || !entry.data || !entry.data.name) return;
				const normalized = {
					mode: helper.normalizeMode(entry.mode, ['append', 'prepend', 'override'], 'append'),
					data: Object.assign({}, entry.data, { visibility: normalizeVisibility(entry.data.visibility) })
				};
				const existingIndex = state.entries.findIndex(function(item) { return item.data.name === normalized.data.name; });
				if (normalized.mode === 'override' && existingIndex !== -1) state.entries[existingIndex] = normalized;
				else if (normalized.mode === 'prepend') state.entries.unshift(normalized);
				else state.entries.push(normalized);
				registered.push(normalized);
				runtime.logRegisterSuccess(normalized.data.name, [
					`显示条件: [${normalized.data.visibility}]`,
					`注入模式: [${normalized.mode}]`
				]);
			} catch (error) {
				runtime.logError('注册异常: 角色分类', error);
			}
		});
		applyHooks();
		return registered.length > 0 ? registered : null;
	}

	function registerPatchEntries(list) {
		if (!Array.isArray(list)) {
			runtime.logError('补丁注册失败: 必须传入数组');
			return null;
		}

		const registered = [];
		list.forEach(function(entry) {
			try {
				if (!entry || !entry.data || !entry.data.name) return;
				const normalized = {
					data: Object.assign({}, entry.data, { visibility: normalizeVisibility(entry.data.visibility) }),
					appendIfMissing: entry.appendIfMissing === true
				};
				state.patchEntries.push(normalized);
				registered.push(normalized);
				runtime.logRegisterSuccess(normalized.data.name, [
					`显示条件: [${normalized.data.visibility}]`,
					'注入模式: [patch]'
				]);
			} catch (error) {
				runtime.logError('补丁注册异常: 角色分类', error);
			}
		});
		applyHooks();
		return registered.length > 0 ? registered : null;
	}

	// 图鉴函数尚未创建时也允许依赖模组注册, 数据会暂存在 state.entries.
	api.register = registerEntries;
	api.patch = { register: registerPatchEntries };
	api.show = function() {
		const dc = getDc();
		return dc && typeof dc.collectionCharaCategoryData === 'function'
			? dc.collectionCharaCategoryData()
			: null;
	};

	runtime.initialize(checkReady, function() {
		applyHooks();
		window.setInterval(applyHooks, 500);
	});
})();
