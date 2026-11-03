/**
 * 使用说明.
 * 1. 注册方法:
 * window.modloaderApi.chara.setting.register([
 * { name: "角色名", audio: "音频文件名.ogg", font: "字体名称" }
 * ]);
 * 2. 查看当前配置:
 * window.modloaderApi.chara.setting.show();
 */

(function() {
	'use strict';

	const modloader = window.modloaderApi;

	var CONFIG = {
		retryInterval: 3000,
		debug: true,
		tag: '角色配置助手'
	};

	var state = {
		isReady: false,
		isLoaded: false,
		registeredNames: new Set(),
		entries: []
	};

	function applyEntry(chara) {
		if (chara.applied || !checkReady()) return;
		try {
			const { name, audio, font } = chara;
			if (audio) TYRANO.kag.ftag.startTag('popopo_chara', { name, storage: audio });
			if (font) TYRANO.kag.ftag.startTag('font_chara', { name, face: font });
			chara.applied = true;
		} catch (error) {
			console.error('[角色配置助手] 注册应用失败:', error);
		}
	}

	modloader.chara.setting.register = function(charaList) {
		if (!Array.isArray(charaList)) return null;
		const registeredList = [];
		charaList.forEach(chara => {
			if (!chara || !chara.name) return;
			const entry = Object.assign({}, chara, { applied: false });
			state.registeredNames.add(entry.name);
			state.entries.push(entry);
			applyEntry(entry);
			registeredList.push(chara);
			if (CONFIG.debug) console.log(`${logTag} %c注册成功: %c${entry.name}`, tagStyle, resetStyle, successStyle, resetStyle);
		});
		return registeredList.length > 0 ? registeredList : null;
	};

	const logger = modloader.ModHelper.createLogger(CONFIG.tag, '#00bcd4');
	const logTag = logger.logTag;
	const tagStyle = logger.tagStyle;
	const successStyle = logger.successStyle;
	const errorStyle = logger.errorStyle;
	const resetStyle = logger.resetStyle;

	const checkReady = () => {
		try {
			return (
				typeof TYRANO !== 'undefined' &&
				TYRANO.kag &&
				TYRANO.kag.ftag &&
				TYRANO.kag.ftag.master_tag &&
				TYRANO.kag.ftag.master_tag.popopo_chara &&
				TYRANO.kag.ftag.master_tag.font_chara
			);
		} catch (e) {
			return false;
		}
	};

	function initLoader() {
		if (!checkReady()) {
			modloader.ModHelper.waitUntilReady(checkReady, CONFIG.retryInterval, initLoader);
			return;
		}

		if (state.isLoaded) return;

		try {
			state.entries.forEach(applyEntry);

			modloader.chara.setting.show = function() {
				try {
					if (!checkReady()) {
						console.error(`${logTag} %c统计显示失败:%c 引擎未就绪`, tagStyle, resetStyle, errorStyle, resetStyle);
						return null;
					}

					const audioStore = typeof storages !== 'undefined' ? storages : null;
					const fontStore = (TYRANO.kag && TYRANO.kag.dc) ? TYRANO.kag.dc.font_chara : null;

					return {
						audioStore: audioStore,
						fontStore: fontStore,
						registeredNames: Array.from(state.registeredNames)
					};
				} catch (e) {
					console.error(`${logTag} %c统计显示异常:`, tagStyle, resetStyle, errorStyle, resetStyle, e);
					return null;
				}
			};

			state.isLoaded = true;
			console.log(`${logTag} %c加载成功.`, tagStyle, resetStyle, successStyle);
		} catch (e) {
			console.error(`${logTag} %c加载失败: %c初始化过程异常`, tagStyle, resetStyle, errorStyle, resetStyle);
			console.log('      └─ 详细信息:', e);
		}
	}

	initLoader();
})();
