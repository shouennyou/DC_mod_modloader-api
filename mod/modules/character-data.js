/**
 * 角色线路与恶魔数据模块。
 */
(function() {
	'use strict';

	const helper = modloader.ModHelper;
	const factory = modloader.SpecialModuleFactory;

	factory.createDcInterceptorModule({
		tag: '角色数据助手',
		color: '#2196f3',
		showApiPath: 'chara.data',
		targets: [
			{
				name: 'characters',
				apiPath: 'chara.data.character',
				stateKey: 'externalCharacters',
				validateEntry: function(entry) {
					return !!(entry && entry.data && entry.data.name && entry.data.folder);
				},
				getEntryName: function(entry) {
					return entry && entry.data && entry.data.name ? entry.data.name : '未知角色';
				},
				logRegister: function(runtime, entry) {
					runtime.logRegisterSuccess(`普通角色: ${entry.data.name}`, [`目标路线: [${entry.target || 'notKilled'}]`]);
				},
				transform: function(data, entries, thisArg) {
					const context = helper.getTyranoContext();
					const isKillMode = context.sf && context.sf.kill > 0;
					entries.forEach(function(entry) {
						try {
							const target = entry.target || 'notKilled';
							if (isKillMode && target !== 'killed') return;
							if (!isKillMode && target !== 'notKilled') return;
							const finalData = helper.resolveObjectSafe(entry.data, thisArg, context, {
								shouldResolve: function(key) { return key !== 'cond'; },
								onError: function(error) { return `[解析错误: ${error.message}]`; }
							});
							const existingIndex = data.findIndex(function(item) {
								return String(item.folder) === String(finalData.folder);
							});
							const mode = helper.normalizeMode(entry.mode, ['append', 'prepend', 'override'], 'override');
							if (mode === 'override' && existingIndex !== -1) data[existingIndex] = finalData;
							else if (mode === 'prepend') data.unshift(finalData);
							else data.push(finalData);
						} catch (error) {}
					});
					return data;
				}
			},
			{
				name: 'devilCharacters',
				apiPath: 'chara.data.devil',
				stateKey: 'externalDevils',
				validateEntry: function(entry) {
					return !!(entry && entry.data && entry.data.name && entry.data.folder);
				},
				getEntryName: function(entry) {
					return entry && entry.data && entry.data.name ? entry.data.name : '未知恶魔';
				},
				logRegister: function(runtime, entry) {
					runtime.logRegisterSuccess(`恶魔: ${entry.data.name}`, [`文件夹 ID: [${entry.data.folder}]`]);
				},
				transform: function(data, entries, thisArg) {
					const context = helper.getTyranoContext();
					entries.forEach(function(entry) {
						try {
							const finalData = helper.resolveObjectSafe(entry.data, thisArg, context, {
								shouldResolve: function(key) { return key !== 'cond'; },
								onError: function(error) { return `[解析错误: ${error.message}]`; }
							});
							const existingIndex = data.findIndex(function(item) {
								return String(item.folder) === String(finalData.folder);
							});
							const mode = helper.normalizeMode(entry.mode, ['append', 'prepend', 'override'], 'override');
							if (mode === 'override' && existingIndex !== -1) data[existingIndex] = finalData;
							else if (mode === 'prepend') data.unshift(finalData);
							else data.push(finalData);
						} catch (error) {}
					});
					return data;
				}
			}
		],
		show: function(state, runtime) {
			try {
				const hasEngine = typeof TYRANO !== 'undefined' && TYRANO.kag && TYRANO.kag.dc;
				const isKillMode = hasEngine && TYRANO.kag.variable.sf.kill > 0;
				const characterList = hasEngine && typeof TYRANO.kag.dc.characters === 'function'
					? TYRANO.kag.dc.characters()
					: state.externalCharacters.filter(function(entry) {
						return isKillMode ? entry.target === 'killed' : !entry.target || entry.target === 'notKilled';
					}).map(function(entry) { return entry.data; });
				const devilList = hasEngine && typeof TYRANO.kag.dc.devilCharacters === 'function'
					? TYRANO.kag.dc.devilCharacters()
					: state.externalDevils.map(function(entry) { return entry.data; });

				return {
					route: isKillMode ? 'killed' : 'notKilled',
					characters: characterList,
					devils: devilList
				};
			} catch (error) {
				runtime.logError('统计显示失败', error);
				return null;
			}
		}
	});
})();
