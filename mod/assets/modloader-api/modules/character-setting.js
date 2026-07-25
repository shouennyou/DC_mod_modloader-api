/**
 * 使用说明.
 * 1. 注册方法:
 * modloader.api.chara.setting.register([
 * { name: "角色名", audio: "音频文件名.ogg", font: "字体名称" }
 * ]);
 * 2. 查看当前配置:
 * modloader.api.chara.setting.show();
 */

(function() {
	'use strict';

	var CONFIG = {
		retryInterval: 3000,
		debug: true,
		tag: '角色配置助手'
	};

	var state = {
		isReady: false,
		isLoaded: false,
		registeredNames: new Set()
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
			modloader.api.chara.setting.register = function(charaList) {
				if (!Array.isArray(charaList)) return null;

				if (!checkReady()) {
					console.error(`${logTag} %c注册失败:%c 引擎未就绪`, tagStyle, resetStyle, errorStyle, resetStyle);
					return null;
				}

				const registeredList = [];
				charaList.forEach(chara => {
					const { name, audio, font } = chara;
					if (!name) return;

					try {
						state.registeredNames.add(name);
						registeredList.push(chara);
						if (audio) {
							TYRANO.kag.ftag.startTag('popopo_chara', { name, storage: audio });
						}
						if (font) {
							TYRANO.kag.ftag.startTag('font_chara', { name, face: font });
						}

						if (CONFIG.debug) {
							setTimeout(() => {
								const audioStore = typeof storages !== 'undefined' ? storages : null;
								const fontStore = (TYRANO.kag && TYRANO.kag.dc) ? TYRANO.kag.dc.font_chara : null;
								const curAudio = audioStore ? (audioStore[name] || '未定义') : '无法读取';
								const curFont = fontStore ? (fontStore[name] || '未定义') : '无法读取';

								console.log(`${logTag} %c注册成功: %c${name}`, tagStyle, resetStyle, successStyle, resetStyle);
								console.log(`      └─ 音频: [${curAudio}]`);
								console.log(`      └─ 字体: [${curFont}]`);
							}, 200);
						}
					} catch (e) {
						console.error(`${logTag} %c注册异常: %c${name}`, tagStyle, resetStyle, errorStyle, resetStyle);
						console.log('      └─ 详细信息:', e);
					}
				});
				return registeredList.length > 0 ? registeredList : null;
			};

			modloader.api.chara.setting.show = function() {
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
